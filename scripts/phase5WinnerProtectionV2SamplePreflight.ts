import { spawn } from 'node:child_process';
import {
  PHASE5_ASSETS_PER_COHORT,
  PHASE5_CANDIDATE_POOL,
  PHASE5_COHORT_COUNT,
  PHASE5_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_DATA_START_DATE,
  PHASE5_END_DATE,
  PHASE5_MINIMUM_CAUSAL_BARS,
  PHASE5_REPLAY_START_DATE,
  PHASE5_SAMPLE_PREFLIGHT_MARKER,
  PHASE5_TARGET_ASSETS,
  partitionPhase5Cohorts,
  selectPhase5Assets
} from './phase5WinnerProtectionV2SampleProtocol';

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
      startDate: PHASE5_DATA_START_DATE,
      endDate: PHASE5_END_DATE,
      timeframe: '1d',
      adjusted: 'false'
    });
    const response = await fetch(`${baseUrl}/api/market-data/history?${params.toString()}`);
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) throw new Error(`HTTP_${response.status}:${payload?.error ?? 'UNKNOWN'}`);

    const bars = Array.isArray(payload?.bars) ? payload.bars as MarketBar[] : [];
    const integrity = validateBars(bars);
    const causalBars = bars.filter(bar => String(bar.timestamp).slice(0, 10) < PHASE5_REPLAY_START_DATE).length;
    const firstDate = bars[0]?.timestamp?.slice(0, 10) ?? null;
    const latestDate = bars.at(-1)?.timestamp?.slice(0, 10) ?? null;
    const provider = String(payload?.metadata?.providerId ?? payload?.metadata?.provider?.id ?? '');
    const currency = String(payload?.metadata?.currency ?? '');
    const providerOk = provider === 'yahoo_finance';
    const currencyOk = currency === 'EUR';
    const endCoverageOk = Boolean(latestDate && latestDate >= '2003-12-20');
    const eligible = integrity.valid
      && providerOk
      && currencyOk
      && causalBars >= PHASE5_MINIMUM_CAUSAL_BARS
      && endCoverageOk;
    return {
      assetId, ticker, provider, currency, bars: bars.length, causalBarsBeforeReplay: causalBars,
      firstDate, latestDate, integrityValid: integrity.valid, integrityReason: integrity.reason,
      providerOk, currencyOk, endCoverageOk, eligible, error: null
    };
  } catch (error: any) {
    return {
      assetId, ticker, provider: '', currency: '', bars: 0, causalBarsBeforeReplay: 0,
      firstDate: null, latestDate: null, integrityValid: false, integrityReason: null,
      providerOk: false, currencyOk: false, endCoverageOk: false, eligible: false,
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE5_SAMPLE_PREFLIGHT_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const coverage: CoverageRow[] = [];
    for (const asset of PHASE5_CANDIDATE_POOL) {
      coverage.push(await loadCoverage(baseUrl, asset.assetId, asset.ticker));
    }
    const eligibleIds = new Set(coverage.filter(row => row.eligible).map(row => row.assetId));
    const coverageEligible = PHASE5_CANDIDATE_POOL.filter(asset => eligibleIds.has(asset.assetId));
    const selected = coverageEligible.length >= PHASE5_TARGET_ASSETS ? selectPhase5Assets(coverageEligible) : [];
    const cohorts = selected.length === PHASE5_TARGET_ASSETS ? partitionPhase5Cohorts(selected) : [];
    const pass = PHASE5_CURRENT_DISCOVERY_HISTORICAL === false
      && coverageEligible.length >= PHASE5_TARGET_ASSETS
      && selected.length === PHASE5_TARGET_ASSETS
      && cohorts.length === PHASE5_COHORT_COUNT
      && cohorts.every(cohort => cohort.length === PHASE5_ASSETS_PER_COHORT);

    const result = {
      version: 'PHASE5_WINNER_PROTECTION_V2_SAMPLE_PREFLIGHT_V1',
      sampleState: 'PREOPEN_COVERAGE_ONLY_NO_ECONOMIC_OUTCOMES',
      window: { dataStartDate: PHASE5_DATA_START_DATE, replayStartDate: PHASE5_REPLAY_START_DATE, endDate: PHASE5_END_DATE },
      selectionRule: 'REAL_COVERAGE_AND_252_PRE_REPLAY_BARS_THEN_SHA256_ORDER_FIRST_18',
      currentDiscoveryHistorical: PHASE5_CURRENT_DISCOVERY_HISTORICAL,
      poolSize: PHASE5_CANDIDATE_POOL.length,
      coverageEligible: coverageEligible.length,
      selected: selected.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker })),
      cohorts: cohorts.map((cohort, index) => ({ cohort: index + 1, assets: cohort.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker })) })),
      rejected: coverage.filter(row => !row.eligible),
      coverage,
      pass
    };
    console.log(PHASE5_SAMPLE_PREFLIGHT_MARKER, JSON.stringify(result));
    if (!pass) throw new Error(`PHASE5_WINNER_PROTECTION_V2_SAMPLE_PREFLIGHT_FAILED:${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE5_WINNER_PROTECTION_V2_SAMPLE_PREFLIGHT_ERROR', error?.stack || error);
  process.exitCode = 1;
});
