import { spawn } from 'node:child_process';
import {
  PHASE5_CONFIRMATION_ASSETS_PER_COHORT,
  PHASE5_CONFIRMATION_COHORT_COUNT,
  PHASE5_CONFIRMATION_COHORTS,
  PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_CONFIRMATION_DATA_START_DATE,
  PHASE5_CONFIRMATION_END_DATE,
  PHASE5_CONFIRMATION_MINIMUM_CAUSAL_BARS,
  PHASE5_CONFIRMATION_PREFLIGHT_MARKER,
  PHASE5_CONFIRMATION_REPLAY_START_DATE,
  PHASE5_CONFIRMATION_SAMPLE,
  PHASE5_CONFIRMATION_SAMPLE_STATE,
  PHASE5_CONFIRMATION_SELECTION_RULE,
  PHASE5_CONFIRMATION_TARGET_ASSETS,
  PHASE5_CONFIRMATION_VERSION
} from './phase5WinnerProtectionV2ConfirmationProtocol';

interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CoverageRow {
  assetId: string;
  ticker: string;
  provider: string;
  currency: string;
  bars: number;
  causalBarsBeforeReplay: number;
  firstDate: string | null;
  latestDate: string | null;
  integrityValid: boolean;
  integrityReason: string | null;
  providerOk: boolean;
  currencyOk: boolean;
  endCoverageOk: boolean;
  eligible: boolean;
  error: string | null;
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

async function loadCoverage(baseUrl: string, assetId: string, ticker: string): Promise<CoverageRow> {
  try {
    const params = new URLSearchParams({
      symbol: ticker,
      startDate: PHASE5_CONFIRMATION_DATA_START_DATE,
      endDate: PHASE5_CONFIRMATION_END_DATE,
      timeframe: '1d',
      adjusted: 'false'
    });
    const response = await fetch(`${baseUrl}/api/market-data/history?${params.toString()}`);
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) throw new Error(`HTTP_${response.status}:${payload?.error ?? 'UNKNOWN'}`);

    const bars = Array.isArray(payload?.bars) ? payload.bars as MarketBar[] : [];
    const integrity = validateBars(bars);
    const causalBars = bars.filter(bar => String(bar.timestamp).slice(0, 10) < PHASE5_CONFIRMATION_REPLAY_START_DATE).length;
    const firstDate = bars[0]?.timestamp?.slice(0, 10) ?? null;
    const latestDate = bars.at(-1)?.timestamp?.slice(0, 10) ?? null;
    const provider = String(payload?.metadata?.providerId ?? payload?.metadata?.provider?.id ?? '');
    const currency = String(payload?.metadata?.currency ?? '');
    const providerOk = provider === 'yahoo_finance';
    const currencyOk = currency === 'EUR';
    const endCoverageOk = Boolean(latestDate && latestDate >= '2007-12-20');
    const eligible = integrity.valid
      && providerOk
      && currencyOk
      && causalBars >= PHASE5_CONFIRMATION_MINIMUM_CAUSAL_BARS
      && endCoverageOk;
    return {
      assetId,
      ticker,
      provider,
      currency,
      bars: bars.length,
      causalBarsBeforeReplay: causalBars,
      firstDate,
      latestDate,
      integrityValid: integrity.valid,
      integrityReason: integrity.reason,
      providerOk,
      currencyOk,
      endCoverageOk,
      eligible,
      error: null
    };
  } catch (error: any) {
    return {
      assetId,
      ticker,
      provider: '',
      currency: '',
      bars: 0,
      causalBarsBeforeReplay: 0,
      firstDate: null,
      latestDate: null,
      integrityValid: false,
      integrityReason: null,
      providerOk: false,
      currencyOk: false,
      endCoverageOk: false,
      eligible: false,
      error: error?.message || String(error)
    };
  }
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE5_CONFIRMATION_PREFLIGHT_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const coverage: CoverageRow[] = [];
    for (const asset of PHASE5_CONFIRMATION_SAMPLE) {
      coverage.push(await loadCoverage(baseUrl, asset.assetId, asset.ticker));
    }

    const rejected = coverage.filter(row => !row.eligible);
    const pass = PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL === false
      && PHASE5_CONFIRMATION_SAMPLE.length === PHASE5_CONFIRMATION_TARGET_ASSETS
      && PHASE5_CONFIRMATION_COHORTS.length === PHASE5_CONFIRMATION_COHORT_COUNT
      && PHASE5_CONFIRMATION_COHORTS.every(cohort => cohort.length === PHASE5_CONFIRMATION_ASSETS_PER_COHORT)
      && rejected.length === 0;

    const result = {
      version: PHASE5_CONFIRMATION_VERSION,
      sampleState: PHASE5_CONFIRMATION_SAMPLE_STATE,
      economicOutcomesOpened: false,
      window: {
        dataStartDate: PHASE5_CONFIRMATION_DATA_START_DATE,
        replayStartDate: PHASE5_CONFIRMATION_REPLAY_START_DATE,
        endDate: PHASE5_CONFIRMATION_END_DATE
      },
      selectionRule: PHASE5_CONFIRMATION_SELECTION_RULE,
      currentDiscoveryHistorical: PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL,
      selected: PHASE5_CONFIRMATION_SAMPLE.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker })),
      cohorts: PHASE5_CONFIRMATION_COHORTS.map((cohort, index) => ({
        cohort: index + 1,
        assets: cohort.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker }))
      })),
      coverageEligible: coverage.filter(row => row.eligible).length,
      rejected,
      coverage,
      pass
    };

    console.log(PHASE5_CONFIRMATION_PREFLIGHT_MARKER, JSON.stringify(result));
    if (!pass) throw new Error(`PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_PREFLIGHT_FAILED:${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_PREFLIGHT_ERROR', error?.stack || error);
  process.exitCode = 1;
});
