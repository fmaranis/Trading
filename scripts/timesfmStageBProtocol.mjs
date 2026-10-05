export const TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 = Object.freeze({
  version: 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1',
  role: 'HISTORICAL_SIGNAL_DIAGNOSTIC_NO_PROMOTION',
  model: Object.freeze({
    package: 'timesfm',
    packageVersion: '3.0.2',
    checkpoint: 'google/timesfm-3.0-pytorch',
    checkpointRevision: '24701cec1b1ea47232c0766e888855c9976ef62b',
    expectedWeightSha256: 'a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da'
  }),
  data: Object.freeze({
    sourceType: 'REAL',
    provider: 'YAHOO_FINANCE',
    timeframe: '1d',
    adjusted: false,
    downloadFrom: '2015-01-01',
    outcomesThrough: '2025-12-31'
  }),
  core: Object.freeze({
    assetId: 'EUNL',
    ticker: 'EUNL.DE',
    role: 'STRUCTURAL_CORE_REFERENCE'
  }),
  assets: Object.freeze([
    Object.freeze({ assetId: 'SXR8', ticker: 'SXR8.DE', category: 'US_EQUITY', defensive: false }),
    Object.freeze({ assetId: 'EQQQ', ticker: 'EQQQ.DE', category: 'TECHNOLOGY', defensive: false }),
    Object.freeze({ assetId: 'EXSA', ticker: 'EXSA.DE', category: 'EUROPE_EQUITY', defensive: false }),
    Object.freeze({ assetId: 'IS3N', ticker: 'IS3N.DE', category: 'EMERGING_EQUITY', defensive: false }),
    Object.freeze({ assetId: 'ZPRV', ticker: 'ZPRV.DE', category: 'SMALL_CAP', defensive: false }),
    Object.freeze({ assetId: 'EXH1', ticker: 'EXH1.DE', category: 'ENERGY', defensive: false }),
    Object.freeze({ assetId: 'IBCI', ticker: 'IBCI.DE', category: 'GOV_BONDS', defensive: true }),
    Object.freeze({ assetId: '4GLD', ticker: '4GLD.DE', category: 'GOLD', defensive: true })
  ]),
  contextLength: 512,
  forecastHorizon: 60,
  evaluationHorizons: Object.freeze([1, 5, 20, 60]),
  primaryHorizons: Object.freeze([20, 60]),
  normalization: 'REBASE_100_AT_CONTEXT_START',
  payloadRoundDecimals: 6,
  diagnostic: Object.freeze({
    firstAnchorQuarterEnd: '2018-03-31',
    lastAnchorQuarterEnd: '2025-09-30',
    anchorMonths: Object.freeze([3, 6, 9, 12]),
    minimumAssetsPerAnchor: 6,
    expectedMaximumCases: 248,
    statusAfterOpen: 'DIAGNOSTIC_CONSUMED_NO_PROMOTION'
  }),
  models: Object.freeze({
    primary: 'TIMESFM3_MV_ASSET_PLUS_CORE',
    secondary: 'TIMESFM3_UV_ASSET_ONLY'
  }),
  baselines: Object.freeze({
    zero: 'ZERO_RETURN',
    buyAndHold: 'ALWAYS_POSITIVE_DIRECTION',
    momentum: 'TRAILING_60_SESSION_LOG_DRIFT',
    legacy: 'MARKET_SHORTLIST_LEGACY_SCORE_V1'
  }),
  gates: Object.freeze({
    minimumCoveragePct: 85,
    minimumMeanRankIcPrimary20_60: 0.05,
    minimumRankIcLiftVsLegacy20_60: 0.02,
    minimumRelativeDirectionalAccuracyPct20_60: 52,
    minimumPositiveTemporalIcAssets: 5,
    quantile80CoverageMinPct: 60,
    quantile80CoverageMaxPct: 95
  }),
  prospectiveConfirmation: Object.freeze({
    status: 'FROZEN_BEFORE_DIAGNOSTIC_OUTCOMES',
    startAfter: '2026-10-05',
    cadence: 'WEEKLY_FIRST_COMMON_TRADING_SESSION',
    sameCore: true,
    sameAssets: true,
    sameContextLength: true,
    sameHorizons: true,
    minimumMaturedAnchors: 26,
    primaryOutcomeRequires60SessionMaturity: true,
    noRetuneAfterDiagnostic: true
  }),
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function quarterEndCalendarDates(firstYear = 2018, lastYear = 2025): string[] {
  const result: string[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    for (const month of [3, 6, 9, 12]) {
      if (year === 2025 && month > 9) continue;
      const date = new Date(Date.UTC(year, month, 0));
      result.push(date.toISOString().slice(0, 10));
    }
  }
  return result;
}

export function rebase100(values: number[]): number[] {
  if (values.length === 0 || !(values[0] > 0) || values.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('TIMESFM_STAGE_B_INVALID_REBASE_INPUT');
  }
  const base = values[0];
  return values.map(value => value / base * 100);
}

function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const start = prices[prices.length - 1 - lookback];
  const end = prices[prices.length - 1];
  return start > 0 && end > 0 ? (end / start - 1) * 100 : null;
}

function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function maxDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (slice.length === 0) return null;
  let peak = slice[0];
  let maximum = 0;
  for (const price of slice) {
    peak = Math.max(peak, price);
    if (peak > 0) maximum = Math.max(maximum, (peak - price) / peak * 100);
  }
  return maximum;
}

export function legacyScannerScore(prices: number[], defensive: boolean): number | null {
  if (prices.length < 121) return null;
  const m20 = pctReturn(prices, 20);
  const m60 = pctReturn(prices, 60);
  const m120 = pctReturn(prices, 120);
  const vol = annualizedVolatility(prices, 60);
  const dd = maxDrawdown(prices, 252);
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  return momentum - riskPenalty + (defensive ? 2.5 : 0);
}

export function trailing60LogDriftForecast(prices: number[], horizon: number): number | null {
  if (prices.length <= 60 || !(horizon > 0)) return null;
  const start = prices[prices.length - 61];
  const end = prices[prices.length - 1];
  if (!(start > 0) || !(end > 0)) return null;
  const dailyLogDrift = Math.log(end / start) / 60;
  return (Math.exp(dailyLogDrift * horizon) - 1) * 100;
}
