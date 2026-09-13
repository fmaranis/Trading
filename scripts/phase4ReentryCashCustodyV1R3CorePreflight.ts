import { spawn } from 'node:child_process';
import { FundMarketDataService } from '../src/investment/data/marketData/fundMarketData';
import {
  PHASE4_R3_CORE,
  PHASE4_R3_DATA_START_DATE,
  PHASE4_R3_END_DATE,
  PHASE4_R3_MINIMUM_BARS,
  PHASE4_R3_REPLAY_START_DATE
} from './phase4ReentryCashCustodyV1R3Protocol';

const MARKER = 'PHASE4_R3_CORE_PREFLIGHT_RESULT';

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

function validatePoints(points: Array<{ date: string; nav: number }>): { valid: boolean; reason: string | null } {
  let previous = '';
  const dates = new Set<string>();
  for (const point of points) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date)) return { valid: false, reason: 'INVALID_DATE' };
    if (!Number.isFinite(point.nav) || point.nav <= 0) return { valid: false, reason: 'INVALID_NAV' };
    if (dates.has(point.date)) return { valid: false, reason: 'DUPLICATE_DATE' };
    if (previous && point.date <= previous) return { valid: false, reason: 'NON_MONOTONIC_DATE' };
    dates.add(point.date);
    previous = point.date;
  }
  return { valid: true, reason: null };
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const baseUrl = 'http://127.0.0.1:3000';
  if (!(await waitForHealth(`${baseUrl}/api/health`, 1500))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE4_R3_CORE_PREFLIGHT_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    process.env.MARKET_DATA_INTERNAL_BASE_URL = process.env.MARKET_DATA_INTERNAL_BASE_URL || baseUrl;
    process.env.ALERT_INTERNAL_BASE_URL = process.env.ALERT_INTERNAL_BASE_URL || baseUrl;
    const isin = PHASE4_R3_CORE.isin ?? PHASE4_R3_CORE.ticker;
    const fund = await FundMarketDataService.history(isin, PHASE4_R3_DATA_START_DATE, PHASE4_R3_END_DATE);
    const integrity = validatePoints(fund.points);
    const causalBars = fund.points.filter(point => point.date <= PHASE4_R3_REPLAY_START_DATE).length;
    const latestDate = fund.points.at(-1)?.date ?? null;
    const currencyOk = fund.currency === 'EUR';
    const endCoverageOk = Boolean(latestDate && latestDate >= '2003-12-20');
    const pass = integrity.valid && currencyOk && causalBars >= PHASE4_R3_MINIMUM_BARS && endCoverageOk;
    const payload = {
      version: 'PHASE4_R3_CORE_PREFLIGHT_V1',
      core: { assetId: PHASE4_R3_CORE.assetId, isin, name: PHASE4_R3_CORE.name },
      provider: fund.provider,
      resolvedSymbol: fund.symbol,
      currency: fund.currency,
      points: fund.points.length,
      causalBarsBeforeReplay: causalBars,
      firstDate: fund.points[0]?.date ?? null,
      latestDate,
      integrity,
      currencyOk,
      endCoverageOk,
      pass
    };
    console.log(MARKER, JSON.stringify(payload));
    if (!pass) throw new Error(`PHASE4_R3_CORE_PREFLIGHT_FAILED:${JSON.stringify(payload)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE4_R3_CORE_PREFLIGHT_ERROR', error?.stack || error);
  process.exitCode = 1;
});
