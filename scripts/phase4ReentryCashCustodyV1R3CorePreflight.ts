import { spawn } from 'node:child_process';
import {
  PHASE4_R3_CORE,
  PHASE4_R3_DATA_START_DATE,
  PHASE4_R3_END_DATE,
  PHASE4_R3_MINIMUM_BARS,
  PHASE4_R3_REPLAY_START_DATE
} from './phase4ReentryCashCustodyV1R3Protocol';

const MARKER = 'PHASE4_R3_CORE_PREFLIGHT_RESULT';

interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

function validateBars(bars: MarketBar[]): { valid: boolean; reason: string | null } {
  let previous = '';
  const dates = new Set<string>();
  for (const bar of bars) {
    const date = String(bar.timestamp).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { valid: false, reason: 'INVALID_DATE' };
    if (dates.has(date)) return { valid: false, reason: 'DUPLICATE_DATE' };
    if (previous && date <= previous) return { valid: false, reason: 'NON_MONOTONIC_DATE' };
    dates.add(date);
    previous = date;
    if (![bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0)) {
      return { valid: false, reason: 'INVALID_OHLC' };
    }
    if (bar.high + 1e-9 < Math.max(bar.open, bar.close) || bar.low - 1e-9 > Math.min(bar.open, bar.close)) {
      return { valid: false, reason: 'INVALID_OHLC_RANGE' };
    }
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
    const params = new URLSearchParams({
      symbol: PHASE4_R3_CORE.ticker,
      startDate: PHASE4_R3_DATA_START_DATE,
      endDate: PHASE4_R3_END_DATE,
      timeframe: '1d',
      adjusted: 'false'
    });
    const response = await fetch(`${baseUrl}/api/market-data/history?${params.toString()}`);
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      throw new Error(`PHASE4_R3_CORE_YAHOO_HTTP_${response.status}:${payload?.error ?? 'UNKNOWN'}`);
    }

    const bars = Array.isArray(payload?.bars) ? payload.bars as MarketBar[] : [];
    const integrity = validateBars(bars);
    const causalBars = bars.filter(bar => String(bar.timestamp).slice(0, 10) <= PHASE4_R3_REPLAY_START_DATE).length;
    const firstDate = bars[0]?.timestamp?.slice(0, 10) ?? null;
    const latestDate = bars.at(-1)?.timestamp?.slice(0, 10) ?? null;
    const provider = String(payload?.metadata?.providerId ?? payload?.metadata?.provider?.id ?? '');
    const providerOk = provider === 'yahoo_finance';
    const currency = String(payload?.metadata?.currency ?? '');
    const currencyOk = currency === 'EUR';
    const endCoverageOk = Boolean(latestDate && latestDate >= '2010-12-20');
    const pass = integrity.valid && providerOk && currencyOk && causalBars >= PHASE4_R3_MINIMUM_BARS && endCoverageOk;
    const result = {
      version: 'PHASE4_R3_CORE_PREFLIGHT_V2_LISTED_YAHOO',
      core: {
        assetId: PHASE4_R3_CORE.assetId,
        ticker: PHASE4_R3_CORE.ticker,
        isin: PHASE4_R3_CORE.isin,
        name: PHASE4_R3_CORE.name
      },
      provider,
      currency,
      bars: bars.length,
      causalBarsBeforeReplay: causalBars,
      firstDate,
      latestDate,
      integrity,
      providerOk,
      currencyOk,
      endCoverageOk,
      pass
    };
    console.log(MARKER, JSON.stringify(result));
    if (!pass) throw new Error(`PHASE4_R3_CORE_PREFLIGHT_FAILED:${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE4_R3_CORE_PREFLIGHT_ERROR', error?.stack || error);
  process.exitCode = 1;
});
