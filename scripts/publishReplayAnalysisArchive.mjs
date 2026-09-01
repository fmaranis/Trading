import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const REPOSITORY = process.env.GITHUB_REPLAY_SYNC_REPOSITORY || 'fmaranis/Trading';
const BRANCH = process.env.GITHUB_REPLAY_SYNC_BRANCH || 'replay-results';
const TOKEN = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
const LOCAL_ARCHIVE = path.resolve(process.cwd(), 'validation-runs', 'archive');
const REMOTE_DIR = 'validation-runs/archive-chatgpt-analysis';
const LATEST_PATH = 'validation-runs/latest-chatgpt-analysis.json';
const BEST_EFFORT = process.argv.includes('--best-effort');

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactExecution(raw) {
  return {
    id: raw?.id ?? null,
    signalDate: raw?.signalDate ?? null,
    executionDate: raw?.executionDate ?? null,
    assetId: raw?.assetId ?? null,
    ticker: raw?.ticker ?? null,
    action: raw?.action ?? null,
    unitsDelta: finiteOrNull(raw?.unitsDelta),
    notionalEur: finiteOrNull(raw?.notionalEur),
    feeEur: finiteOrNull(raw?.feeEur),
    realizedGainEur: finiteOrNull(raw?.realizedGainEur),
    estimatedTaxEur: finiteOrNull(raw?.estimatedTaxEur),
    taxDeferredTransferEur: finiteOrNull(raw?.taxDeferredTransferEur),
    executionPriceEur: finiteOrNull(raw?.executionPriceEur),
    reason: String(raw?.reason ?? '')
  };
}

function compactSignal(raw) {
  return {
    id: raw?.id ?? null,
    signalDate: raw?.signalDate ?? null,
    executionDate: raw?.executionDate ?? null,
    assetId: raw?.assetId ?? null,
    ticker: raw?.ticker ?? null,
    action: raw?.action ?? null,
    recommendedAmountEur: finiteOrNull(raw?.recommendedAmountEur),
    targetWeight: finiteOrNull(raw?.targetWeight),
    currentWeight: finiteOrNull(raw?.currentWeight),
    consensusScore: finiteOrNull(raw?.consensusScore),
    favorableVotes: finiteOrNull(raw?.favorableVotes),
    unfavorableVotes: finiteOrNull(raw?.unfavorableVotes),
    structuralDowntrend: raw?.structuralDowntrend === true,
    buyTheDipCandidate: raw?.buyTheDipCandidate === true,
    timingState: raw?.timingState ?? null,
    timingSetup: raw?.timingSetup ?? null,
    timingScore: finiteOrNull(raw?.timingScore),
    suggestedInitialFraction: finiteOrNull(raw?.suggestedInitialFraction),
    positionCurrentReturnPct: finiteOrNull(raw?.positionCurrentReturnPct),
    positionMfePct: finiteOrNull(raw?.positionMfePct),
    positionGivebackFromMfePctPoints: finiteOrNull(raw?.positionGivebackFromMfePctPoints),
    positionDeteriorationStreakSessions: finiteOrNull(raw?.positionDeteriorationStreakSessions),
    positionIsDiversifiedCore: raw?.positionIsDiversifiedCore ?? null,
    executed: raw?.executed === true,
    unitsDelta: finiteOrNull(raw?.unitsDelta),
    notionalEur: finiteOrNull(raw?.notionalEur),
    feeEur: finiteOrNull(raw?.feeEur),
    realizedGainEur: finiteOrNull(raw?.realizedGainEur),
    estimatedTaxEur: finiteOrNull(raw?.estimatedTaxEur),
    taxDeferredTransferEur: finiteOrNull(raw?.taxDeferredTransferEur),
    executionPriceEur: finiteOrNull(raw?.executionPriceEur),
    reason: String(raw?.reason ?? '')
  };
}

function keepDiagnosticSignal(raw) {
  if (raw?.executed === true) return true;
  const action = String(raw?.action ?? '');
  if (action === 'REDUCE' || action === 'EXIT') return true;
  if (action !== 'WATCH') return false;
  const streak = Number(raw?.positionDeteriorationStreakSessions);
  const mfe = Number(raw?.positionMfePct);
  const giveback = Number(raw?.positionGivebackFromMfePctPoints);
  const currentReturn = Number(raw?.positionCurrentReturnPct);
  return (Number.isFinite(streak) && streak >= 8)
    || (Number.isFinite(mfe) && mfe >= 5 && Number.isFinite(giveback) && giveback >= 12 && Number.isFinite(currentReturn) && currentReturn < 0);
}

function buildAnalysis(payload) {
  if (payload?.metadata?.format !== FORMAT || !payload?.session) throw new Error('Invalid replay payload.');
  const s = payload.session;
  const pathPoints = Array.isArray(s.path) ? s.path : [];
  const signals = Array.isArray(s.signals) ? s.signals : [];
  const executions = Array.isArray(s.executions) ? s.executions : [];
  const actionCounts = {};
  const executedActionCounts = {};
  for (const signal of signals) {
    const action = String(signal?.action ?? 'UNKNOWN');
    actionCounts[action] = (actionCounts[action] || 0) + 1;
    if (signal?.executed === true) executedActionCounts[action] = (executedActionCounts[action] || 0) + 1;
  }
  return {
    metadata: {
      format: FORMAT,
      schemaVersion: payload?.metadata?.schemaVersion ?? 1,
      analysisProjectionVersion: 1,
      exportedAt: payload?.metadata?.exportedAt ?? null,
      source: 'Local replay archive backfill',
      note: 'Small directly-readable diagnostic projection. Full replay remains in .json.gz.b64.'
    },
    session: {
      version: s.version,
      startDate: s.startDate,
      endDate: s?.summary?.endDate ?? pathPoints.at(-1)?.date ?? null,
      frequency: s.frequency,
      runMode: s.runMode,
      durationMonths: s.durationMonths,
      chunkDays: s.chunkDays,
      initialCapitalEur: s.initialCapitalEur,
      summary: s.summary ?? null,
      counts: {
        checkpoints: Array.isArray(s.checkpoints) ? s.checkpoints.length : 0,
        executions: executions.length,
        path: pathPoints.length,
        signals: signals.length,
        positions: Array.isArray(s.positions) ? s.positions.length : 0,
        actionCounts,
        executedActionCounts
      },
      executions: executions.map(compactExecution),
      diagnosticSignals: signals.filter(keepDiagnosticSignal).map(compactSignal),
      positions: Array.isArray(s.positions) ? s.positions : [],
      path: pathPoints.map(p => ({
        date: p?.date ?? null,
        equityEur: finiteOrNull(p?.equityEur),
        cashEur: finiteOrNull(p?.cashEur),
        investedEur: finiteOrNull(p?.investedEur),
        cashBenchmarkEur: finiteOrNull(p?.cashBenchmarkEur),
        regime: p?.regime ?? null,
        method: p?.method ?? null
      }))
    }
  };
}

function safeName(value, fallback) {
  const out = String(value ?? '').replace(/[^0-9A-Za-z_-]/g, '-');
  return out || fallback;
}

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'fmaranis-trading-replay-analysis-backfill',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function upsert(targetPath, text, message) {
  const api = `https://api.github.com/repos/${REPOSITORY}/contents/${targetPath}`;
  const current = await fetch(`${api}?ref=${encodeURIComponent(BRANCH)}`, { headers: headers() });
  let sha;
  if (current.ok) {
    const existing = await current.json();
    sha = existing?.sha;
    if (typeof existing?.content === 'string') {
      const decoded = Buffer.from(existing.content.replace(/\s/g, ''), 'base64').toString('utf8').trimEnd();
      if (decoded === text) return false;
    }
  } else if (current.status !== 404) {
    throw new Error(`GitHub read failed ${current.status}: ${(await current.text()).slice(0, 300)}`);
  }
  const body = { message, content: Buffer.from(`${text}\n`, 'utf8').toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) };
  const written = await fetch(api, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!written.ok) throw new Error(`GitHub write failed ${written.status}: ${(await written.text()).slice(0, 300)}`);
  return true;
}

async function main() {
  if (!TOKEN) {
    console.log('[Replay analysis] skipped: GITHUB_REPLAY_SYNC_TOKEN is not configured.');
    return;
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPOSITORY)) throw new Error('Invalid repository.');

  let names;
  try {
    names = (await readdir(LOCAL_ARCHIVE)).filter(name => name.endsWith('.json')).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log('[Replay analysis] skipped: no local replay archive directory yet.');
      return;
    }
    throw error;
  }
  if (!names.length) {
    console.log('[Replay analysis] skipped: no local replay archives found.');
    return;
  }

  const generated = [];
  let changed = 0;
  for (const name of names) {
    const payload = JSON.parse(await readFile(path.join(LOCAL_ARCHIVE, name), 'utf8'));
    const analysis = buildAnalysis(payload);
    const start = safeName(analysis.session.startDate, 'start');
    const end = safeName(analysis.session.endDate, 'partial');
    const target = `${REMOTE_DIR}/${start}__${end}.analysis.json`;
    const text = JSON.stringify(analysis, null, 2);
    if (await upsert(target, text, `Publish replay analysis ${start} ${end}`)) changed += 1;
    generated.push({ target, exportedAt: analysis.metadata.exportedAt, text });
  }

  generated.sort((a, b) => String(a.exportedAt ?? '').localeCompare(String(b.exportedAt ?? '')));
  const latest = generated.at(-1);
  if (latest && await upsert(LATEST_PATH, latest.text, 'Update latest replay analysis')) changed += 1;
  console.log(`[Replay analysis] ${generated.length} archive(s) checked; ${changed} GitHub file(s) updated.`);
}

try {
  await main();
} catch (error) {
  const detail = error?.message || String(error);
  if (!BEST_EFFORT) throw error;
  console.warn(`[Replay analysis] best-effort sync failed and will not block app startup: ${detail}`);
}
