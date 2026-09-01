import express from 'express';
import path from 'path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { marketDataRouter } from './server/marketDataRoutes';
import { alphaVantageRouter } from './server/alphaVantageRoutes';
import { eodhdRouter } from './server/eodhdRoutes';
import { alertAutomationRouter } from './server/alertAutomationRoutes';
import { startDailyAlertScheduler } from './server/alertAutomation';

const HISTORICAL_AUDIT_FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const HISTORICAL_AUDIT_SCHEMA_VERSION = 1;
const MAX_HISTORICAL_AUDIT_BYTES = 25 * 1024 * 1024;
const CHATGPT_REPLAY_PROJECTION_VERSION = 1;
const DEFAULT_REPLAY_SYNC_REPOSITORY = 'fmaranis/Trading';
const DEFAULT_REPLAY_SYNC_BRANCH = 'replay-results';
const CHATGPT_REPLAY_SYNC_PATH = 'validation-runs/latest-chatgpt.json';

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
  if (!session || Number(session.version) !== 3) throw new Error('UNSUPPORTED_REPLAY_STORAGE_VERSION');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(session.startDate ?? ''))) throw new Error('INVALID_START_DATE');
  for (const field of ['checkpoints', 'executions', 'path', 'signals']) {
    if (!Array.isArray(session[field])) throw new Error(`MISSING_${field.toUpperCase()}`);
  }
}

function auditArchiveName(exportedAt: string): string {
  const safe = exportedAt.replace(/[:.]/g, '-').replace(/[^0-9TZ-]/g, '');
  return `${safe || Date.now()}-historical-replay.json`;
}

function compactReplaySignal(signal: any): Record<string, unknown> {
  const action = String(signal?.action ?? '');
  const keepReason = signal?.executed === true || ['BUY', 'ADD', 'REDUCE', 'EXIT', 'WATCH'].includes(action);
  return {
    id: signal?.id ?? null,
    signalDate: signal?.signalDate ?? null,
    executionDate: signal?.executionDate ?? null,
    assetId: signal?.assetId ?? null,
    ticker: signal?.ticker ?? null,
    action,
    recommendedAmountEur: signal?.recommendedAmountEur ?? 0,
    targetWeight: signal?.targetWeight ?? 0,
    currentWeight: signal?.currentWeight ?? 0,
    consensusScore: signal?.consensusScore ?? null,
    favorableVotes: signal?.favorableVotes ?? null,
    unfavorableVotes: signal?.unfavorableVotes ?? null,
    structuralDowntrend: signal?.structuralDowntrend ?? false,
    buyTheDipCandidate: signal?.buyTheDipCandidate ?? false,
    timingState: signal?.timingState ?? null,
    timingSetup: signal?.timingSetup ?? null,
    timingScore: signal?.timingScore ?? null,
    suggestedInitialFraction: signal?.suggestedInitialFraction ?? null,
    positionCurrentReturnPct: signal?.positionCurrentReturnPct ?? null,
    positionMfePct: signal?.positionMfePct ?? null,
    positionGivebackFromMfePctPoints: signal?.positionGivebackFromMfePctPoints ?? null,
    positionDeteriorationStreakSessions: signal?.positionDeteriorationStreakSessions ?? null,
    positionIsDiversifiedCore: signal?.positionIsDiversifiedCore ?? null,
    executed: signal?.executed === true,
    unitsDelta: signal?.unitsDelta ?? 0,
    notionalEur: signal?.notionalEur ?? 0,
    feeEur: signal?.feeEur ?? 0,
    realizedGainEur: signal?.realizedGainEur ?? 0,
    estimatedTaxEur: signal?.estimatedTaxEur ?? 0,
    taxDeferredTransferEur: signal?.taxDeferredTransferEur ?? 0,
    executionPriceEur: signal?.executionPriceEur ?? null,
    ...(keepReason ? { reason: String(signal?.reason ?? '') } : {})
  };
}

function buildChatgptReplayProjection(payload: any): any {
  const session = payload.session;
  return {
    metadata: {
      ...payload.metadata,
      chatgptProjectionVersion: CHATGPT_REPLAY_PROJECTION_VERSION,
      publishedAt: new Date().toISOString(),
      note: 'Proyección canónica compacta del último replay para lectura directa por ChatGPT desde GitHub. Conserva configuración, resumen, checkpoints, operaciones, posiciones, path y campos diagnósticos esenciales de todas las señales.'
    },
    session: {
      ...session,
      signals: session.signals.map(compactReplaySignal)
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

async function publishReplayProjectionToGithub(payload: any): Promise<Record<string, unknown>> {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  const target = replaySyncTarget();
  if (!token) return { configured: false, published: false, ...target };

  // This endpoint is intentionally development-only. The public SaaS must not expose
  // a browser-triggerable route that can spend a repository write credential.
  if (process.env.NODE_ENV === 'production') {
    return {
      configured: true,
      published: false,
      blockedReason: 'PRODUCTION_SYNC_DISABLED',
      ...target
    };
  }

  const repository = target.repository.trim();
  const branch = target.branch.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('INVALID_GITHUB_REPLAY_SYNC_REPOSITORY');
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) throw new Error('INVALID_GITHUB_REPLAY_SYNC_BRANCH');

  const projection = buildChatgptReplayProjection(payload);
  const serialized = JSON.stringify(projection, null, 2);
  const apiUrl = `https://api.github.com/repos/${repository}/contents/${CHATGPT_REPLAY_SYNC_PATH}`;
  const headers = githubHeaders(token);
  const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  let sha: string | undefined;
  if (currentResponse.ok) {
    const current = await currentResponse.json() as any;
    sha = typeof current?.sha === 'string' ? current.sha : undefined;
  } else if (currentResponse.status !== 404) {
    const detail = await currentResponse.text();
    throw new Error(`GITHUB_REPLAY_SYNC_READ_FAILED:${currentResponse.status}:${detail.slice(0, 500)}`);
  }

  const body: Record<string, unknown> = {
    message: `Update latest replay audit ${String(payload?.session?.startDate ?? '')} ${String(payload?.session?.frequency ?? '')}`.trim(),
    content: Buffer.from(`${serialized}\n`, 'utf8').toString('base64'),
    branch
  };
  if (sha) body.sha = sha;

  const writeResponse = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!writeResponse.ok) {
    const detail = await writeResponse.text();
    throw new Error(`GITHUB_REPLAY_SYNC_WRITE_FAILED:${writeResponse.status}:${detail.slice(0, 500)}`);
  }
  const written = await writeResponse.json() as any;
  return {
    configured: true,
    published: true,
    repository,
    branch,
    path: CHATGPT_REPLAY_SYNC_PATH,
    bytes: Buffer.byteLength(serialized, 'utf8'),
    commitSha: written?.commit?.sha ?? null
  };
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
      const serialized = JSON.stringify(req.body, null, 2);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_HISTORICAL_AUDIT_BYTES) {
        return res.status(413).json({ error: 'HISTORICAL_AUDIT_TOO_LARGE' });
      }

      const root = path.resolve(process.cwd(), 'validation-runs');
      const archiveDir = path.resolve(root, 'archive');
      if (!archiveDir.startsWith(`${root}${path.sep}`)) throw new Error('INVALID_ARCHIVE_PATH');
      await mkdir(archiveDir, { recursive: true });

      const exportedAt = String(req.body?.metadata?.exportedAt || new Date().toISOString());
      const archiveName = auditArchiveName(exportedAt);
      const latestPath = path.resolve(root, 'latest.json');
      const archivePath = path.resolve(archiveDir, archiveName);
      if (!latestPath.startsWith(`${root}${path.sep}`) || !archivePath.startsWith(`${archiveDir}${path.sep}`)) throw new Error('INVALID_OUTPUT_PATH');

      await writeFile(latestPath, `${serialized}\n`, 'utf8');
      await writeFile(archivePath, `${serialized}\n`, 'utf8');

      let githubSync: Record<string, unknown>;
      try {
        githubSync = await publishReplayProjectionToGithub(req.body);
      } catch (syncError: any) {
        githubSync = {
          configured: Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
          published: false,
          ...replaySyncTarget(),
          error: syncError?.message || String(syncError)
        };
      }

      res.json({
        ok: true,
        latestPath: path.relative(process.cwd(), latestPath).replaceAll('\\', '/'),
        archivePath: path.relative(process.cwd(), archivePath).replaceAll('\\', '/'),
        bytes: Buffer.byteLength(serialized, 'utf8'),
        githubSync
      });
    } catch (error: any) {
      res.status(400).json({ error: 'HISTORICAL_AUDIT_SAVE_FAILED', detail: error?.message || String(error) });
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
