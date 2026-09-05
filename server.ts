import express from 'express';
import path from 'path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { marketDataRouter } from './server/marketDataRoutes';
import { alphaVantageRouter } from './server/alphaVantageRoutes';
import { eodhdRouter } from './server/eodhdRoutes';
import { alertAutomationRouter } from './server/alertAutomationRoutes';
import { startDailyAlertScheduler } from './server/alertAutomation';

const HISTORICAL_AUDIT_FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const HISTORICAL_AUDIT_SCHEMA_VERSION = 1;
const SUPPORTED_REPLAY_STORAGE_VERSIONS = new Set([3, 4]);
const MAX_HISTORICAL_AUDIT_BYTES = 25 * 1024 * 1024;
const DEFAULT_REPLAY_SYNC_REPOSITORY = 'fmaranis/Trading';
const DEFAULT_REPLAY_SYNC_BRANCH = 'replay-results';
const CHATGPT_REPLAY_SYNC_PATH = 'validation-runs/latest-chatgpt.json';
const CHATGPT_REPLAY_FULL_PATH = 'validation-runs/latest-chatgpt-full.json';
const CHATGPT_REPLAY_ARCHIVE_DIR = 'validation-runs/archive-chatgpt';
const CHATGPT_REPLAY_ARCHIVE_LIMIT = 10;
const CHATGPT_READABLE_TARGET_BYTES = 900_000;
const GITHUB_REPLAY_SYNC_TIMEOUT_MS = 120_000;

function redactSecrets(value: unknown): unknown {
  const secrets = [
    process.env.ALPHA_VANTAGE_API_KEY,
    process.env.EODHD_API_KEY,
    process.env.MARKET_DATA_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.ALERT_WEBHOOK_URL,
    process.env.ALERT_ADMIN_TOKEN,
    process.env.GITHUB_REPLAY_SYNC_TOKEN
  ].filter((v): v is string => Boolean(v && v.trim()));
  if (!secrets.length) return value;
  const scrub = (input: unknown): unknown => {
    if (typeof input === 'string') return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), input);
    if (Array.isArray(input)) return input.map(scrub);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]));
    return input;
  };
  return scrub(value);
}

function validateHistoricalAuditPayload(payload: any): void {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_AUDIT_PAYLOAD');
  if (payload?.metadata?.format !== HISTORICAL_AUDIT_FORMAT) throw new Error('INVALID_AUDIT_FORMAT');
  if (Number(payload?.metadata?.schemaVersion) !== HISTORICAL_AUDIT_SCHEMA_VERSION) throw new Error('UNSUPPORTED_AUDIT_SCHEMA');
  const session = payload.session;
  if (!session || !SUPPORTED_REPLAY_STORAGE_VERSIONS.has(Number(session.version))) throw new Error('UNSUPPORTED_REPLAY_STORAGE_VERSION');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(session.startDate ?? ''))) throw new Error('INVALID_START_DATE');
  for (const field of ['checkpoints', 'executions', 'path', 'signals']) {
    if (!Array.isArray(session[field])) throw new Error(`MISSING_${field.toUpperCase()}`);
  }
}

function auditArchiveName(exportedAt: string): string {
  const safe = exportedAt.replace(/[:.]/g, '-').replace(/[^0-9TZ-]/g, '');
  return `${safe || Date.now()}-historical-replay.json`;
}

function chatgptArchiveName(payload: any): string {
  const exportedAt = String(payload?.metadata?.exportedAt || new Date().toISOString());
  const stamp = exportedAt.replace(/[:.]/g, '-').replace(/[^0-9TZ-]/g, '') || String(Date.now());
  const start = String(payload?.session?.startDate ?? 'start').replace(/[^0-9A-Za-z_-]/g, '-');
  const end = String(payload?.session?.summary?.endDate ?? payload?.session?.path?.at?.(-1)?.date ?? 'partial').replace(/[^0-9A-Za-z_-]/g, '-');
  return `${stamp}__${start}__${end}.json`;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function signalIsDiagnostic(signal: any, strict = false): boolean {
  const action = String(signal?.action ?? '');
  const reason = String(signal?.reason ?? '');
  const marker = reason.includes('CORE_GATE_V1') || reason.includes('ROTATION_CF_V1');
  if (signal?.executed === true || marker || action === 'REDUCE' || action === 'EXIT') return true;
  if (strict) return false;
  if (action === 'BUY' || action === 'ADD') return true;
  if (action !== 'WATCH') return false;
  const streak = finiteOrNull(signal?.positionDeteriorationStreakSessions) ?? 0;
  const mfe = finiteOrNull(signal?.positionMfePct) ?? 0;
  const giveback = finiteOrNull(signal?.positionGivebackFromMfePctPoints) ?? 0;
  const currentReturn = finiteOrNull(signal?.positionCurrentReturnPct) ?? 0;
  return streak >= 8 || (mfe >= 5 && giveback >= 12 && currentReturn < 0);
}

function buildReadableReplayAudit(payload: any, strict = false): any {
  const session = payload?.session ?? {};
  const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints : [];
  const executions = Array.isArray(session.executions) ? session.executions : [];
  const pathPoints = Array.isArray(session.path) ? session.path : [];
  const signals = Array.isArray(session.signals) ? session.signals : [];
  const positions = Array.isArray(session.positions) ? session.positions : [];
  const {
    checkpoints: _checkpoints,
    executions: _executions,
    path: _path,
    signals: _signals,
    positions: _positions,
    ...sessionConfigAndSummary
  } = session;

  const actionCounts: Record<string, number> = {};
  const executedActionCounts: Record<string, number> = {};
  for (const signal of signals) {
    const action = String(signal?.action ?? 'UNKNOWN');
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    if (signal?.executed === true) executedActionCounts[action] = (executedActionCounts[action] ?? 0) + 1;
  }

  const diagnosticSignals = signals.filter((signal: any) => signalIsDiagnostic(signal, strict));
  return {
    metadata: {
      ...payload?.metadata,
      readableAuditVersion: 1,
      generatedAt: new Date().toISOString(),
      githubStorageFormat: 'plain-json',
      sourceFullReplayPath: CHATGPT_REPLAY_FULL_PATH,
      diagnosticSignalPolicy: strict
        ? 'executed + REDUCE/EXIT + CORE_GATE_V1/ROTATION_CF_V1 markers'
        : 'executed + BUY/ADD/REDUCE/EXIT + diagnostic WATCH + CORE_GATE_V1/ROTATION_CF_V1 markers',
      note: 'JSON de auditoría directamente legible por ChatGPT. El replay completo se publica también como JSON normal en sourceFullReplayPath.'
    },
    session: {
      ...sessionConfigAndSummary,
      counts: {
        checkpoints: checkpoints.length,
        executions: executions.length,
        path: pathPoints.length,
        signals: signals.length,
        positions: positions.length,
        diagnosticSignals: diagnosticSignals.length,
        actionCounts,
        executedActionCounts
      },
      checkpoints: checkpoints.map((checkpoint: any) => ({
        startDate: checkpoint?.startDate ?? null,
        endDate: checkpoint?.endDate ?? checkpoint?.date ?? null,
        summary: checkpoint?.summary ?? null
      })),
      executions,
      positions,
      path: pathPoints.map((point: any) => ({
        date: point?.date ?? null,
        equityEur: point?.equityEur ?? null,
        cashEur: point?.cashEur ?? null,
        investedEur: point?.investedEur ?? null,
        cashBenchmarkEur: point?.cashBenchmarkEur ?? null,
        regime: point?.regime ?? null,
        method: point?.method ?? null
      })),
      signals: diagnosticSignals
    }
  };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'fmaranis-trading-replay-sync',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function replaySyncTarget() {
  return {
    repository: process.env.GITHUB_REPLAY_SYNC_REPOSITORY || DEFAULT_REPLAY_SYNC_REPOSITORY,
    branch: process.env.GITHUB_REPLAY_SYNC_BRANCH || DEFAULT_REPLAY_SYNC_BRANCH,
    path: CHATGPT_REPLAY_SYNC_PATH
  };
}

function validateReplaySyncTarget(repository: string, branch: string): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('INVALID_GITHUB_REPLAY_SYNC_REPOSITORY');
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) throw new Error('INVALID_GITHUB_REPLAY_SYNC_BRANCH');
}

async function githubFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(GITHUB_REPLAY_SYNC_TIMEOUT_MS) });
}

async function upsertGithubTextFile(repository: string, branch: string, targetPath: string, content: string, message: string, headers: Record<string, string>): Promise<string | null> {
  const apiUrl = `https://api.github.com/repos/${repository}/contents/${targetPath}`;
  const currentResponse = await githubFetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  let sha: string | undefined;
  if (currentResponse.ok) {
    const current = await currentResponse.json() as any;
    sha = typeof current?.sha === 'string' ? current.sha : undefined;
  } else if (currentResponse.status !== 404) {
    const detail = await currentResponse.text();
    throw new Error(`GITHUB_REPLAY_SYNC_READ_FAILED:${currentResponse.status}:${detail.slice(0, 500)}`);
  }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(`${content}\n`, 'utf8').toString('base64'),
    branch
  };
  if (sha) body.sha = sha;

  const writeResponse = await githubFetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!writeResponse.ok) {
    const detail = await writeResponse.text();
    throw new Error(`GITHUB_REPLAY_SYNC_WRITE_FAILED:${writeResponse.status}:${detail.slice(0, 500)}`);
  }
  const written = await writeResponse.json() as any;
  return written?.commit?.sha ?? null;
}

async function listGithubArchive(repository: string, branch: string, headers: Record<string, string>): Promise<any[]> {
  const apiUrl = `https://api.github.com/repos/${repository}/contents/${CHATGPT_REPLAY_ARCHIVE_DIR}?ref=${encodeURIComponent(branch)}`;
  const response = await githubFetch(apiUrl, { headers });
  if (response.status === 404) return [];
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GITHUB_REPLAY_ARCHIVE_LIST_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  const entries = await response.json() as any[];
  return Array.isArray(entries)
    ? entries.filter(entry => {
        if (entry?.type !== 'file') return false;
        const name = String(entry?.name ?? '');
        return name.endsWith('.json') || name.endsWith('.json.gz.b64');
      })
    : [];
}

async function deleteGithubArchiveFile(repository: string, branch: string, targetPath: string, sha: string, headers: Record<string, string>): Promise<void> {
  const apiUrl = `https://api.github.com/repos/${repository}/contents/${targetPath}`;
  const response = await githubFetch(apiUrl, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ message: `Delete archived replay ${path.posix.basename(targetPath)}`, sha, branch })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GITHUB_REPLAY_ARCHIVE_DELETE_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
}

async function pruneGithubArchive(repository: string, branch: string, headers: Record<string, string>): Promise<number> {
  const entries = await listGithubArchive(repository, branch, headers);
  const ordered = [...entries].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const excess = Math.max(0, ordered.length - CHATGPT_REPLAY_ARCHIVE_LIMIT);
  for (const entry of ordered.slice(0, excess)) {
    await deleteGithubArchiveFile(repository, branch, String(entry.path), String(entry.sha), headers);
  }
  return excess;
}

async function publishReplayProjectionToGithub(payload: any, archive: boolean): Promise<Record<string, unknown>> {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  const target = replaySyncTarget();
  if (!token) return { configured: false, published: false, archived: false, ...target };

  if (process.env.NODE_ENV === 'production') {
    return { configured: true, published: false, archived: false, blockedReason: 'PRODUCTION_SYNC_DISABLED', ...target };
  }

  const repository = target.repository.trim();
  const branch = target.branch.trim();
  validateReplaySyncTarget(repository, branch);
  const headers = githubHeaders(token);

  const fullPayload = {
    ...payload,
    metadata: {
      ...payload.metadata,
      publishedAt: new Date().toISOString(),
      githubStorageFormat: 'plain-json',
      note: 'Replay completo en JSON normal. La auditoría directamente legible por ChatGPT está en validation-runs/latest-chatgpt.json.'
    }
  };
  const fullSerialized = JSON.stringify(fullPayload, null, 2);

  let readableAudit = buildReadableReplayAudit(fullPayload, false);
  let readableSerialized = JSON.stringify(readableAudit, null, 2);
  let reducedDiagnosticSet = false;
  if (Buffer.byteLength(readableSerialized, 'utf8') > CHATGPT_READABLE_TARGET_BYTES) {
    readableAudit = buildReadableReplayAudit(fullPayload, true);
    readableAudit.metadata.reducedDiagnosticSet = true;
    readableSerialized = JSON.stringify(readableAudit, null, 2);
    reducedDiagnosticSet = true;
  }

  const fullCommitSha = await upsertGithubTextFile(
    repository,
    branch,
    CHATGPT_REPLAY_FULL_PATH,
    fullSerialized,
    `Update full readable replay audit ${String(payload?.session?.startDate ?? '')} ${String(payload?.session?.frequency ?? '')}`.trim(),
    headers
  );

  const latestCommitSha = await upsertGithubTextFile(
    repository,
    branch,
    CHATGPT_REPLAY_SYNC_PATH,
    readableSerialized,
    `Update ChatGPT-readable replay audit ${String(payload?.session?.startDate ?? '')} ${String(payload?.session?.frequency ?? '')}`.trim(),
    headers
  );

  let archivePath: string | null = null;
  let pruned = 0;
  if (archive) {
    archivePath = `${CHATGPT_REPLAY_ARCHIVE_DIR}/${chatgptArchiveName(payload)}`;
    await upsertGithubTextFile(
      repository,
      branch,
      archivePath,
      readableSerialized,
      `Archive ChatGPT-readable replay audit ${String(payload?.session?.startDate ?? '')} ${String(payload?.session?.frequency ?? '')}`.trim(),
      headers
    );
    pruned = await pruneGithubArchive(repository, branch, headers);
  }

  return {
    configured: true,
    published: true,
    archived: archive,
    repository,
    branch,
    path: CHATGPT_REPLAY_SYNC_PATH,
    fullPath: CHATGPT_REPLAY_FULL_PATH,
    archivePath,
    archiveLimit: CHATGPT_REPLAY_ARCHIVE_LIMIT,
    pruned,
    bytes: Buffer.byteLength(readableSerialized, 'utf8'),
    fullBytes: Buffer.byteLength(fullSerialized, 'utf8'),
    compression: 'none',
    storageFormat: 'plain-json',
    reducedDiagnosticSet,
    commitSha: latestCommitSha,
    fullCommitSha
  };
}

async function clearGithubReplayArchive(): Promise<Record<string, unknown>> {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  const target = replaySyncTarget();
  if (!token) return { configured: false, deleted: 0, ...target };
  if (process.env.NODE_ENV === 'production') return { configured: true, deleted: 0, blockedReason: 'PRODUCTION_SYNC_DISABLED', ...target };

  const repository = target.repository.trim();
  const branch = target.branch.trim();
  validateReplaySyncTarget(repository, branch);
  const headers = githubHeaders(token);
  const entries = await listGithubArchive(repository, branch, headers);
  for (const entry of entries) {
    await deleteGithubArchiveFile(repository, branch, String(entry.path), String(entry.sha), headers);
  }
  return { configured: true, deleted: entries.length, repository, branch, preservedPath: CHATGPT_REPLAY_SYNC_PATH };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: `${MAX_HISTORICAL_AUDIT_BYTES}b` }));

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => originalJson(redactSecrets(body))) as typeof res.json;
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/validation/latest-broker-aware', async (_req, res) => {
    try {
      const validationPath = path.join(process.cwd(), 'validation-results', 'latest-broker-aware-execution-sweep.json');
      const raw = await readFile(validationPath, 'utf8');
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error: any) {
      res.status(404).json({ error: 'LATEST_VALIDATION_RESULT_NOT_AVAILABLE', detail: error?.message || String(error) });
    }
  });

  app.post('/api/validation/historical-audit/save', async (req, res) => {
    try {
      validateHistoricalAuditPayload(req.body);
      const serialized = JSON.stringify(req.body);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_HISTORICAL_AUDIT_BYTES) {
        return res.status(413).json({ error: 'HISTORICAL_AUDIT_TOO_LARGE' });
      }

      const archiveRequested = String(req.query.archive ?? '1') !== '0';
      const root = path.resolve(process.cwd(), 'validation-runs');
      const archiveDir = path.resolve(root, 'archive');
      if (!archiveDir.startsWith(`${root}${path.sep}`)) throw new Error('INVALID_ARCHIVE_PATH');
      await mkdir(root, { recursive: true });
      if (archiveRequested) await mkdir(archiveDir, { recursive: true });

      const exportedAt = String(req.body?.metadata?.exportedAt || new Date().toISOString());
      const archiveName = auditArchiveName(exportedAt);
      const latestPath = path.resolve(root, 'latest.json');
      const archivePath = path.resolve(archiveDir, archiveName);
      if (!latestPath.startsWith(`${root}${path.sep}`) || !archivePath.startsWith(`${archiveDir}${path.sep}`)) throw new Error('INVALID_OUTPUT_PATH');

      await writeFile(latestPath, `${serialized}\n`, 'utf8');
      if (archiveRequested) await writeFile(archivePath, `${serialized}\n`, 'utf8');

      let githubSync: Record<string, unknown>;
      try {
        githubSync = await publishReplayProjectionToGithub(req.body, archiveRequested);
      } catch (syncError: any) {
        githubSync = {
          configured: Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
          published: false,
          archived: false,
          ...replaySyncTarget(),
          error: syncError?.message || String(syncError)
        };
      }

      res.json({
        ok: true,
        latestPath: path.relative(process.cwd(), latestPath).replaceAll('\\', '/'),
        archivePath: archiveRequested ? path.relative(process.cwd(), archivePath).replaceAll('\\', '/') : null,
        archived: archiveRequested,
        bytes: Buffer.byteLength(serialized, 'utf8'),
        githubSync
      });
    } catch (error: any) {
      res.status(400).json({ error: 'HISTORICAL_AUDIT_SAVE_FAILED', detail: error?.message || String(error) });
    }
  });

  app.delete('/api/validation/historical-audit/archive', async (_req, res) => {
    try {
      const root = path.resolve(process.cwd(), 'validation-runs');
      const archiveDir = path.resolve(root, 'archive');
      let localDeleted = 0;
      try {
        const entries = await readdir(archiveDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
          await unlink(path.resolve(archiveDir, entry.name));
          localDeleted += 1;
        }
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }

      let githubArchive: Record<string, unknown>;
      try {
        githubArchive = await clearGithubReplayArchive();
      } catch (syncError: any) {
        githubArchive = {
          configured: Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
          deleted: 0,
          ...replaySyncTarget(),
          error: syncError?.message || String(syncError)
        };
      }

      res.json({ ok: true, localDeleted, githubArchive, latestPreserved: true });
    } catch (error: any) {
      res.status(400).json({ error: 'HISTORICAL_AUDIT_ARCHIVE_CLEAR_FAILED', detail: error?.message || String(error) });
    }
  });

  app.use('/api/market-data', marketDataRouter);
  app.use('/api/alpha-vantage', alphaVantageRouter);
  app.use('/api/eodhd', eodhdRouter);
  app.use('/api/alerts', alertAutomationRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Custodia] Server running on http://0.0.0.0:${PORT}`);
    const scheduler = startDailyAlertScheduler();
    console.log(`[Custodia] Daily alerts ${scheduler ? 'enabled' : 'disabled'}${scheduler ? ` (${process.env.ALERT_RUN_TIME_LOCAL || '22:30'} Europe/Madrid)` : ''}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});