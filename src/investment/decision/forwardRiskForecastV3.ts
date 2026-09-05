import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';
import { STRATEGIC_GROWTH_CORE_PRIORITY } from './portfolioAssetRole';

export const FORWARD_RISK_FORECAST_V3 = 'FORWARD_RISK_FORECAST_V3' as const;

const HORIZONS = [5, 20, 60] as const;
const THRESHOLDS = [3, 5, 10] as const;
const CALM_DRAWDOWN_LIMITS = [1.5, 2.0, 3.0] as const;
const MINIMUM_TRAINING_ROWS = 504;
const MAXIMUM_TRAINING_ROWS = 1512;
const RETRAIN_EVERY_SESSIONS = 20;
const LOGISTIC_ITERATIONS = 360;
const LOGISTIC_LEARNING_RATE = 0.04;
const HIGH_RISK_PERCENTILE = 0.80;
const INNER_VALIDATION_FRACTION = 0.20;
const REGULARIZATION_MULTIPLIERS = [0.5, 1, 2] as const;

const DEFENSIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GOV_BONDS', 'CORP_BONDS', 'AGG_BONDS', 'MONEY_MARKET', 'GOLD', 'COMMODITIES'
]);

// Every V3 feature is engineered so a larger value means more deterioration/risk.
// This lets the classifier use non-negative coefficients and prevents the model
// from learning a semantically inverted 60-session ranking as V2 did.
const FEATURE_NAMES = [
  'momentumLoss5', 'momentumLoss20',
  'volAcceleration5d', 'downsideShareIncrease5d', 'drawdownWorsening5d',
  'sma20Deterioration5d', 'sma50Deterioration10d', 'sma200Deterioration20d',
  'breadthPositive20Deterioration5d', 'breadthAbove50Deterioration10d', 'breadthAbove200Deterioration20d', 'breadthShortfall',
  'dispersionWidening5d', 'dispersionWidening20d',
  'defensiveRelative20Positive', 'defensiveRotationAcceleration',
  'priceBreadthDivergence20', 'priceBreadthDivergenceAcceleration10d',
  'vixRise3', 'vixRise5', 'vixRise20', 'vixZIncrease5d',
  'vixTermDeterioration3d', 'vixTermDeterioration5d', 'vixTermDeterioration10d', 'vixContangoCompression',
  'strongTrendBreadthDeterioration', 'strongTrendVixRising', 'positiveMomentumMomentumLoss',
  'calmMarketVolRising', 'highBreadthBreadthCollapse', 'dispersionBreadthStress',
  'contangoFlattening', 'riskOnDefensiveRotation'
] as const;

type FeatureName = typeof FEATURE_NAMES[number];
type HorizonIndex = 0 | 1 | 2;

const HORIZON_FEATURES: Record<5 | 20 | 60, readonly FeatureName[]> = {
  5: [
    'momentumLoss5', 'volAcceleration5d', 'downsideShareIncrease5d', 'drawdownWorsening5d',
    'sma20Deterioration5d', 'breadthPositive20Deterioration5d', 'breadthAbove50Deterioration10d',
    'dispersionWidening5d', 'defensiveRotationAcceleration', 'vixRise3', 'vixRise5',
    'vixTermDeterioration3d', 'vixTermDeterioration5d', 'strongTrendVixRising',
    'calmMarketVolRising', 'highBreadthBreadthCollapse'
  ],
  20: [
    'momentumLoss20', 'volAcceleration5d', 'downsideShareIncrease5d', 'sma50Deterioration10d',
    'breadthPositive20Deterioration5d', 'breadthAbove50Deterioration10d', 'breadthShortfall',
    'dispersionWidening5d', 'dispersionWidening20d', 'defensiveRelative20Positive', 'defensiveRotationAcceleration',
    'priceBreadthDivergence20', 'priceBreadthDivergenceAcceleration10d', 'vixRise5', 'vixRise20', 'vixZIncrease5d',
    'vixTermDeterioration5d', 'vixTermDeterioration10d', 'strongTrendBreadthDeterioration',
    'positiveMomentumMomentumLoss', 'highBreadthBreadthCollapse', 'dispersionBreadthStress',
    'contangoFlattening', 'riskOnDefensiveRotation'
  ],
  60: [
    'momentumLoss20', 'sma200Deterioration20d', 'breadthAbove200Deterioration20d',
    'breadthAbove50Deterioration10d', 'breadthShortfall', 'dispersionWidening20d',
    'defensiveRelative20Positive', 'defensiveRotationAcceleration', 'priceBreadthDivergence20',
    'priceBreadthDivergenceAcceleration10d', 'vixZIncrease5d', 'vixTermDeterioration10d',
    'vixContangoCompression', 'strongTrendBreadthDeterioration', 'positiveMomentumMomentumLoss',
    'highBreadthBreadthCollapse', 'dispersionBreadthStress', 'contangoFlattening', 'riskOnDefensiveRotation'
  ]
};

const BASE_L1: Record<5 | 20 | 60, number> = { 5: 0.0025, 20: 0.0035, 60: 0.0050 };
const BASE_L2: Record<5 | 20 | 60, number> = { 5: 0.030, 20: 0.045, 60: 0.070 };

export interface ForwardRiskV3Metric {
  horizonSessions: 5 | 20 | 60;
  preCrashThresholdPct: 3 | 5 | 10;
  observations: number;
  eventRatePct: number | null;
  auc: number | null;
  invertedAuc: number | null;
  topDecileEventRatePct: number | null;
  liftVsBaseRate: number | null;
  highRiskForecasts: number;
  highRiskPrecisionPct: number | null;
  highRiskFalsePositivePct: number | null;
  orientation: 'DIRECT' | 'INVERTED' | 'UNRESOLVED';
}

export interface ForwardRiskV3ModelDiagnostic {
  horizonSessions: 5 | 20 | 60;
  selectedFeatureCount: number;
  regularizationMultiplier: number | null;
  innerValidationAuc: number | null;
  trainingRows: number;
}

export interface ForwardRiskV3FeatureWeight {
  feature: string;
  coefficient: number;
  absCoefficient: number;
}

export interface ForwardRiskV3AuditPoint {
  informationDate: string;
  executionDate: string;
  probability5d3Pct: number;
  probability20d5Pct: number;
  probability60d10Pct: number;
  imminentRiskPercentilePct: number;
  nearTermRiskPercentilePct: number;
  mediumTermRiskPercentilePct: number;
  combinedRiskPercentilePct: number;
  regime: 'NORMAL' | 'PRE_CRASH' | 'CRASH_ACTIVE';
  labels: [number | null, number | null, number | null];
}

export interface ForwardRiskV3EpisodeAudit {
  thresholdPct: 3 | 5 | 10;
  horizonSessions: 5 | 20 | 60;
  peakDate: string;
  breachDate: string;
  peakToBreachSessions: number;
  firstHighRiskDateBeforePeak: string | null;
  leadSessionsBeforePeak: number | null;
  maxRiskPercentileBeforePeak: number | null;
  anticipatedBeforePeak: boolean;
}

export interface ForwardRiskForecastV3Result {
  version: typeof FORWARD_RISK_FORECAST_V3;
  status: 'VALID' | 'INSUFFICIENT_DATA';
  methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_MONOTONIC_NEXT_OPEN';
  objective: 'PRE_CRASH_DETERIORATION_NOT_ACTIVE_CRASH';
  coreAssetId: string | null;
  coreTicker: string | null;
  startDate: string;
  endDate: string;
  diagnosticSeriesUsed: string[];
  diagnosticSeriesMissing: string[];
  featureCount: number;
  horizonFeatureCounts: Record<'5' | '20' | '60', number>;
  retrainEverySessions: number;
  minimumTrainingRows: number;
  maximumTrainingRows: number;
  metrics: ForwardRiskV3Metric[];
  modelDiagnostics: ForwardRiskV3ModelDiagnostic[];
  rankingOrientationPass: boolean | null;
  innerValidationOrientationPass: boolean | null;
  predictiveSignalPass: boolean | null;
  anticipationPass: boolean | null;
  anticipatedEpisodeRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  forecastsEvaluated: number;
  episodeAudits: ForwardRiskV3EpisodeAudit[];
  featureWeights: Array<{ horizonSessions: 5 | 20 | 60; top: ForwardRiskV3FeatureWeight[] }>;
  sampledForecasts: ForwardRiskV3AuditPoint[];
  notes: string[];
}

interface FeatureRow {
  index: number;
  date: string;
  features: Record<FeatureName, number>;
  labels: [number, number, number];
  labelEndIndexes: [number, number, number];
  activeCrash: [boolean, boolean, boolean];
}

interface LogisticModel {
  featureNames: readonly FeatureName[];
  means: number[];
  stds: number[];
  weights: number[];
  intercept: number;
  calibrationShift: number;
  trainingPredictionsSorted: number[];
  trainingRows: number;
  regularizationMultiplier: number;
  innerValidationAuc: number | null;
}

interface ForecastInternal extends ForwardRiskV3AuditPoint {
  index: number;
  percentiles: [number, number, number];
  rawLabels: [number, number, number];
}

interface CrashEpisode { thresholdPct: 3 | 5 | 10; peakIndex: number; breachIndex: number; }

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function positive(value: number): number { return Number.isFinite(value) ? Math.max(0, value) : Number.NaN; }
function sigmoid(value: number): number { return 1 / (1 + Math.exp(-clamp(value, -30, 30))); }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN; }
function std(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}
function delta(now: number, past: number): number { return Number.isFinite(now) && Number.isFinite(past) ? now - past : Number.NaN; }
function deterioration(now: number, past: number): number { return positive(-delta(now, past)); }
function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 0.5;
  let low = 0, high = sorted.length;
  while (low < high) { const mid = (low + high) >>> 1; if (sorted[mid] <= value) low = mid + 1; else high = mid; }
  return low / sorted.length;
}
function sortedBars(asset: MultiAssetDatasetItem): PriceBar[] {
  return [...asset.bars].filter(bar => bar.close > 0 && bar.open > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
}
function alignedCloses(asset: MultiAssetDatasetItem | null, dates: string[], maximumStalenessDays = 5): Array<number | null> {
  if (!asset) return dates.map(() => null);
  const bars = sortedBars(asset); const out: Array<number | null> = []; let cursor = 0; let latest: PriceBar | null = null;
  for (const date of dates) {
    while (cursor < bars.length && isoDate(bars[cursor].timestamp) <= date) latest = bars[cursor++];
    if (!latest) { out.push(null); continue; }
    const gap = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${isoDate(latest.timestamp)}T00:00:00Z`)) / 86_400_000;
    out.push(gap <= maximumStalenessDays ? latest.close : null);
  }
  return out;
}
function pctReturn(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index], past = values[index - lookback];
  return current != null && past != null && current > 0 && past > 0 ? (current / past - 1) * 100 : Number.NaN;
}
function realizedVol(values: Array<number | null>, index: number, lookback: number): number {
  if (index < lookback) return Number.NaN;
  const returns: number[] = [];
  for (let i = index - lookback + 1; i <= index; i++) {
    const a = values[i - 1], b = values[i]; if (a != null && b != null && a > 0 && b > 0) returns.push(Math.log(b / a));
  }
  return returns.length >= Math.max(3, Math.floor(lookback * 0.7)) ? std(returns) * Math.sqrt(252) * 100 : Number.NaN;
}
function downsideShare(values: Array<number | null>, index: number, lookback: number): number {
  if (index < lookback) return Number.NaN; let valid = 0, negative = 0;
  for (let i = index - lookback + 1; i <= index; i++) {
    const a = values[i - 1], b = values[i]; if (a != null && b != null && a > 0 && b > 0) { valid++; if (b < a) negative++; }
  }
  return valid >= Math.floor(lookback * 0.7) ? negative / valid : Number.NaN;
}
function drawdownFromWindow(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index]; if (current == null || current <= 0) return Number.NaN;
  const finite = values.slice(Math.max(0, index - lookback + 1), index + 1).filter((value): value is number => value != null && value > 0);
  if (!finite.length) return Number.NaN; const peak = Math.max(...finite); return Math.max(0, (peak - current) / peak * 100);
}
function distanceToSma(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index]; if (current == null || current <= 0 || index + 1 < lookback) return Number.NaN;
  const finite = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && value > 0);
  if (finite.length < Math.floor(lookback * 0.9)) return Number.NaN; const avg = mean(finite); return (current / avg - 1) * 100;
}
function zScore(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index]; if (current == null || index + 1 < lookback) return Number.NaN;
  const finite = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && Number.isFinite(value));
  if (finite.length < Math.floor(lookback * 0.8)) return Number.NaN; const s = std(finite); return Number.isFinite(s) && s > 1e-9 ? (current - mean(finite)) / s : 0;
}

function chooseCoreAsset(dataset: MultiAssetDataset, startDate: string, endDate: string): MultiAssetDatasetItem | null {
  const usable = (assetId: string) => {
    const asset = dataset.assets.find(row => row.assetId === assetId); if (!asset) return null;
    const bars = sortedBars(asset); const start = bars.find(bar => isoDate(bar.timestamp) >= startDate && isoDate(bar.timestamp) <= endDate); if (!start) return null;
    const gap = (Date.parse(`${isoDate(start.timestamp)}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
    return gap <= 7 ? asset : null;
  };
  const preferred = usable('EUNL'); if (preferred) return preferred;
  for (const id of STRATEGIC_GROWTH_CORE_PRIORITY) { const asset = usable(id); if (asset) return asset; }
  return dataset.assets.find(asset => asset.assetId.toUpperCase().includes('WORLD')) ?? null;
}

function futurePreCrashLabel(values: Array<number | null>, index: number, horizon: number, thresholdPct: number, calmLimitPct: number): { label: number; activeCrash: boolean } {
  const current = values[index];
  if (current == null || current <= 0 || index + horizon >= values.length) return { label: Number.NaN, activeCrash: false };
  const currentDrawdown = drawdownFromWindow(values, index, 252);
  const activeCrash = Number.isFinite(currentDrawdown) && currentDrawdown > calmLimitPct;
  if (activeCrash) return { label: Number.NaN, activeCrash: true };
  const future = values.slice(index + 1, index + horizon + 1).filter((value): value is number => value != null && value > 0);
  if (future.length < Math.floor(horizon * 0.8)) return { label: Number.NaN, activeCrash: false };
  return { label: (Math.min(...future) / current - 1) * 100 <= -thresholdPct ? 1 : 0, activeCrash: false };
}

function featureRows(input: { dataset: MultiAssetDataset; diagnosticDataset?: MultiAssetDataset; catalog: AssetUniverseItem[]; core: MultiAssetDatasetItem }) {
  const coreBars = sortedBars(input.core); const dates = coreBars.map(bar => isoDate(bar.timestamp)); const core = coreBars.map(bar => bar.close as number | null);
  const categoryById = new Map(input.catalog.map(asset => [asset.assetId, asset.category] as const));
  const risky = input.dataset.assets.filter(asset => asset.assetId !== input.core.assetId).filter(asset => {
    const category = categoryById.get(asset.assetId); return category != null && !DEFENSIVE_CATEGORIES.has(category);
  }).map(asset => alignedCloses(asset, dates));
  const defensive = input.dataset.assets.filter(asset => {
    const category = categoryById.get(asset.assetId); return category != null && DEFENSIVE_CATEGORIES.has(category);
  }).map(asset => alignedCloses(asset, dates));
  const diagnosticMap = new Map((input.diagnosticDataset?.assets ?? []).map(asset => [asset.assetId, asset] as const));
  const vixAsset = diagnosticMap.get('DIAG_VIX') ?? null; const vix3mAsset = diagnosticMap.get('DIAG_VIX3M') ?? null;
  const vix = alignedCloses(vixAsset, dates); const vix3m = alignedCloses(vix3mAsset, dates);
  const diagnosticUsed = [vixAsset ? '^VIX' : null, vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);
  const diagnosticMissing = [!vixAsset ? '^VIX' : null, !vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);

  const breadthPositive20 = Array(dates.length).fill(Number.NaN) as number[];
  const breadthPositive60 = Array(dates.length).fill(Number.NaN) as number[];
  const breadthAbove50 = Array(dates.length).fill(Number.NaN) as number[];
  const breadthAbove200 = Array(dates.length).fill(Number.NaN) as number[];
  const dispersion20 = Array(dates.length).fill(Number.NaN) as number[];
  const defensiveRelative5 = Array(dates.length).fill(Number.NaN) as number[];
  const defensiveRelative20 = Array(dates.length).fill(Number.NaN) as number[];
  const vixTermRatio = Array(dates.length).fill(Number.NaN) as number[];
  const priceBreadthDivergence20 = Array(dates.length).fill(Number.NaN) as number[];

  for (let i = 252; i < dates.length; i++) {
    const risky5 = risky.map(series => pctReturn(series, i, 5)).filter(Number.isFinite);
    const risky20 = risky.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    const risky60 = risky.map(series => pctReturn(series, i, 60)).filter(Number.isFinite);
    const above50 = risky.map(series => distanceToSma(series, i, 50)).filter(Number.isFinite);
    const above200 = risky.map(series => distanceToSma(series, i, 200)).filter(Number.isFinite);
    const defensive5 = defensive.map(series => pctReturn(series, i, 5)).filter(Number.isFinite);
    const defensive20 = defensive.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    breadthPositive20[i] = risky20.length ? risky20.filter(value => value > 0).length / risky20.length : Number.NaN;
    breadthPositive60[i] = risky60.length ? risky60.filter(value => value > 0).length / risky60.length : Number.NaN;
    breadthAbove50[i] = above50.length ? above50.filter(value => value > 0).length / above50.length : Number.NaN;
    breadthAbove200[i] = above200.length ? above200.filter(value => value > 0).length / above200.length : Number.NaN;
    dispersion20[i] = risky20.length >= 3 ? std(risky20) : Number.NaN;
    defensiveRelative5[i] = defensive5.length && risky5.length ? mean(defensive5) - mean(risky5) : Number.NaN;
    defensiveRelative20[i] = defensive20.length && risky20.length ? mean(defensive20) - mean(risky20) : Number.NaN;
    const coreRet20 = pctReturn(core, i, 20);
    priceBreadthDivergence20[i] = Number.isFinite(coreRet20) && risky20.length ? positive(coreRet20 - mean(risky20)) : Number.NaN;
    const v = vix[i], v3m = vix3m[i]; vixTermRatio[i] = v != null && v3m != null && v3m > 0 ? v / v3m : Number.NaN;
  }

  const rows: FeatureRow[] = [];
  for (let i = 272; i < dates.length; i++) {
    const ret20 = pctReturn(core, i, 20); const sma200 = distanceToSma(core, i, 200); const dd252 = drawdownFromWindow(core, i, 252);
    const vol5 = realizedVol(core, i, 5); const vol5Past = realizedVol(core, i - 5, 5);
    const breadthDet5 = deterioration(breadthPositive20[i], breadthPositive20[i - 5]);
    const breadth50Det10 = deterioration(breadthAbove50[i], breadthAbove50[i - 10]);
    const dispersionWide5 = positive(delta(dispersion20[i], dispersion20[i - 5]));
    const termDet5 = positive(delta(vixTermRatio[i], vixTermRatio[i - 5]));
    const defensiveAccel = positive(delta(defensiveRelative5[i], defensiveRelative20[i]));
    const momentumLoss20 = deterioration(ret20, pctReturn(core, i - 10, 20));
    const features: Record<FeatureName, number> = {
      momentumLoss5: deterioration(pctReturn(core, i, 5), pctReturn(core, i - 5, 5)),
      momentumLoss20,
      volAcceleration5d: positive(delta(vol5, vol5Past)),
      downsideShareIncrease5d: positive(delta(downsideShare(core, i, 20), downsideShare(core, i - 5, 20))),
      drawdownWorsening5d: positive(delta(dd252, drawdownFromWindow(core, i - 5, 252))),
      sma20Deterioration5d: deterioration(distanceToSma(core, i, 20), distanceToSma(core, i - 5, 20)),
      sma50Deterioration10d: deterioration(distanceToSma(core, i, 50), distanceToSma(core, i - 10, 50)),
      sma200Deterioration20d: deterioration(sma200, distanceToSma(core, i - 20, 200)),
      breadthPositive20Deterioration5d: breadthDet5,
      breadthAbove50Deterioration10d: breadth50Det10,
      breadthAbove200Deterioration20d: deterioration(breadthAbove200[i], breadthAbove200[i - 20]),
      breadthShortfall: positive(delta(breadthPositive60[i], breadthPositive20[i])),
      dispersionWidening5d: dispersionWide5,
      dispersionWidening20d: positive(delta(dispersion20[i], dispersion20[i - 20])),
      defensiveRelative20Positive: positive(defensiveRelative20[i]),
      defensiveRotationAcceleration: defensiveAccel,
      priceBreadthDivergence20: priceBreadthDivergence20[i],
      priceBreadthDivergenceAcceleration10d: positive(delta(priceBreadthDivergence20[i], priceBreadthDivergence20[i - 10])),
      vixRise3: positive(pctReturn(vix, i, 3)),
      vixRise5: positive(pctReturn(vix, i, 5)),
      vixRise20: positive(pctReturn(vix, i, 20)),
      vixZIncrease5d: positive(delta(zScore(vix, i, 60), zScore(vix, i - 5, 60))),
      vixTermDeterioration3d: positive(delta(vixTermRatio[i], vixTermRatio[i - 3])),
      vixTermDeterioration5d: termDet5,
      vixTermDeterioration10d: positive(delta(vixTermRatio[i], vixTermRatio[i - 10])),
      vixContangoCompression: Number.isFinite(vixTermRatio[i]) ? positive(vixTermRatio[i] - 0.85) : Number.NaN,
      strongTrendBreadthDeterioration: Number.isFinite(sma200) && Number.isFinite(breadth50Det10) ? positive(sma200) * breadth50Det10 : Number.NaN,
      strongTrendVixRising: Number.isFinite(sma200) ? positive(sma200) * positive(pctReturn(vix, i, 5)) : Number.NaN,
      positiveMomentumMomentumLoss: Number.isFinite(ret20) && Number.isFinite(momentumLoss20) ? positive(ret20) * momentumLoss20 : Number.NaN,
      calmMarketVolRising: Number.isFinite(dd252) && Number.isFinite(vol5) && Number.isFinite(vol5Past) ? positive(3 - dd252) * positive(vol5 - vol5Past) : Number.NaN,
      highBreadthBreadthCollapse: Number.isFinite(breadthAbove50[i]) && Number.isFinite(breadth50Det10) ? positive(breadthAbove50[i]) * breadth50Det10 : Number.NaN,
      dispersionBreadthStress: Number.isFinite(dispersionWide5) && Number.isFinite(breadthDet5) ? dispersionWide5 * breadthDet5 : Number.NaN,
      contangoFlattening: Number.isFinite(vixTermRatio[i]) && Number.isFinite(termDet5) ? positive(1 - vixTermRatio[i]) * termDet5 : Number.NaN,
      riskOnDefensiveRotation: Number.isFinite(ret20) && Number.isFinite(defensiveAccel) ? positive(ret20) * defensiveAccel : Number.NaN
    };
    const targets = HORIZONS.map((horizon, idx) => futurePreCrashLabel(core, i, horizon, THRESHOLDS[idx], CALM_DRAWDOWN_LIMITS[idx]));
    rows.push({ index: i, date: dates[i], features, labels: targets.map(x => x.label) as [number, number, number], labelEndIndexes: [i + 5, i + 20, i + 60], activeCrash: targets.map(x => x.activeCrash) as [boolean, boolean, boolean] });
  }
  return { rows, coreBars, diagnosticUsed, diagnosticMissing };
}

function auc(labels: number[], predictions: number[]): number | null {
  const pairs = labels.map((label, index) => ({ label, prediction: predictions[index] })).filter(row => Number.isFinite(row.label) && Number.isFinite(row.prediction)).sort((a, b) => a.prediction - b.prediction);
  const positives = pairs.filter(row => row.label === 1).length; const negatives = pairs.length - positives; if (!positives || !negatives) return null;
  let rankSum = 0, index = 0;
  while (index < pairs.length) { let end = index + 1; while (end < pairs.length && Math.abs(pairs[end].prediction - pairs[index].prediction) < 1e-12) end++; const averageRank = (index + 1 + end) / 2; for (let j = index; j < end; j++) if (pairs[j].label === 1) rankSum += averageRank; index = end; }
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

function fitModel(rows: FeatureRow[], labelIndex: HorizonIndex, featureNames: readonly FeatureName[], regularizationMultiplier: number, minimumRows: number): LogisticModel | null {
  const usable = rows.filter(row => Number.isFinite(row.labels[labelIndex])); if (usable.length < minimumRows) return null;
  const positives = usable.filter(row => row.labels[labelIndex] === 1).length; const negatives = usable.length - positives; if (positives < 8 || negatives < 8) return null;
  const means = featureNames.map(name => { const values = usable.map(row => row.features[name]).filter(Number.isFinite); return values.length ? mean(values) : 0; });
  const stds = featureNames.map((name, column) => { const values = usable.map(row => row.features[name]).filter(Number.isFinite); const s = values.length > 1 ? std(values) : 1; return Number.isFinite(s) && s > 1e-8 ? s : 1; });
  const xRows = usable.map(row => featureNames.map((name, column) => Number.isFinite(row.features[name]) ? (row.features[name] - means[column]) / stds[column] : 0));
  const labels = usable.map(row => row.labels[labelIndex]); const positiveWeight = clamp(negatives / Math.max(1, positives), 1, 8);
  const weights = featureNames.map(() => 0); let intercept = Math.log(clamp(positives / usable.length, 0.01, 0.99) / clamp(negatives / usable.length, 0.01, 0.99));
  const horizon = HORIZONS[labelIndex]; const l1 = BASE_L1[horizon] * regularizationMultiplier; const l2 = BASE_L2[horizon] * regularizationMultiplier;
  for (let iteration = 0; iteration < LOGISTIC_ITERATIONS; iteration++) {
    const gradients = weights.map(() => 0); let interceptGradient = 0; let totalWeight = 0;
    for (let r = 0; r < xRows.length; r++) {
      const x = xRows[r], y = labels[r], sampleWeight = y === 1 ? positiveWeight : 1;
      const logit = intercept + x.reduce((sum, value, column) => sum + value * weights[column], 0); const error = (sigmoid(logit) - y) * sampleWeight;
      interceptGradient += error; totalWeight += sampleWeight; for (let c = 0; c < weights.length; c++) gradients[c] += error * x[c];
    }
    const rate = LOGISTIC_LEARNING_RATE / Math.max(1, totalWeight); intercept -= rate * interceptGradient;
    for (let c = 0; c < weights.length; c++) {
      let updated = weights[c] - rate * (gradients[c] + l2 * weights[c] * totalWeight); const shrink = rate * l1 * totalWeight;
      updated = Math.max(0, updated - shrink); // semantic monotonicity: never learn an inverted deterioration coefficient
      weights[c] = clamp(updated, 0, 8);
    }
  }
  const rawLogits = xRows.map(x => intercept + x.reduce((sum, value, column) => sum + value * weights[column], 0)); const eventRate = positives / usable.length;
  let low = -12, high = 12; for (let iteration = 0; iteration < 80; iteration++) { const mid = (low + high) / 2; const calibratedMean = mean(rawLogits.map(logit => sigmoid(logit + mid))); if (calibratedMean > eventRate) high = mid; else low = mid; }
  const calibrationShift = (low + high) / 2; const trainingPredictionsSorted = rawLogits.map(logit => sigmoid(logit + calibrationShift)).sort((a, b) => a - b);
  return { featureNames, means, stds, weights, intercept, calibrationShift, trainingPredictionsSorted, trainingRows: usable.length, regularizationMultiplier, innerValidationAuc: null };
}

function predict(model: LogisticModel, features: Record<FeatureName, number>): number {
  const x = model.featureNames.map((name, column) => Number.isFinite(features[name]) ? (features[name] - model.means[column]) / model.stds[column] : 0);
  return sigmoid(model.intercept + model.calibrationShift + x.reduce((sum, value, column) => sum + value * model.weights[column], 0));
}

function selectCausalModel(trainingRows: FeatureRow[], labelIndex: HorizonIndex): LogisticModel | null {
  const horizon = HORIZONS[labelIndex]; const featureNames = HORIZON_FEATURES[horizon];
  const usable = trainingRows.filter(row => Number.isFinite(row.labels[labelIndex])); if (usable.length < MINIMUM_TRAINING_ROWS) return null;
  const split = Math.max(320, Math.floor(usable.length * (1 - INNER_VALIDATION_FRACTION))); if (usable.length - split < 80) return fitModel(usable, labelIndex, featureNames, 1, MINIMUM_TRAINING_ROWS);
  const innerTrain = usable.slice(0, split); const innerValidation = usable.slice(split);
  let bestMultiplier = 1; let bestAuc = Number.NEGATIVE_INFINITY;
  for (const multiplier of REGULARIZATION_MULTIPLIERS) {
    const candidate = fitModel(innerTrain, labelIndex, featureNames, multiplier, 300); if (!candidate) continue;
    const validationLabels = innerValidation.map(row => row.labels[labelIndex]); const validationPredictions = innerValidation.map(row => predict(candidate, row.features)); const validationAuc = auc(validationLabels, validationPredictions);
    const score = validationAuc ?? Number.NEGATIVE_INFINITY; if (score > bestAuc) { bestAuc = score; bestMultiplier = multiplier; }
  }
  const finalModel = fitModel(usable, labelIndex, featureNames, bestMultiplier, MINIMUM_TRAINING_ROWS); if (!finalModel) return null;
  finalModel.innerValidationAuc = Number.isFinite(bestAuc) ? bestAuc : null; return finalModel;
}

function buildForecasts(rows: FeatureRow[], startDate: string, endDate: string, coreBars: PriceBar[]) {
  const forecasts: ForecastInternal[] = []; let models: [LogisticModel | null, LogisticModel | null, LogisticModel | null] = [null, null, null]; let lastRetrain = -Infinity;
  for (const row of rows) {
    if (row.date < startDate || row.date >= endDate || row.index + 1 >= coreBars.length) continue;
    if (row.index - lastRetrain >= RETRAIN_EVERY_SESSIONS || models.some(model => model == null)) {
      const trainingFor = (labelIndex: HorizonIndex) => rows.filter(candidate => candidate.index < row.index && candidate.labelEndIndexes[labelIndex] < row.index && Number.isFinite(candidate.labels[labelIndex])).slice(-MAXIMUM_TRAINING_ROWS);
      models = [selectCausalModel(trainingFor(0), 0), selectCausalModel(trainingFor(1), 1), selectCausalModel(trainingFor(2), 2)]; lastRetrain = row.index;
    }
    if (models.some(model => model == null)) continue;
    const typed = models as [LogisticModel, LogisticModel, LogisticModel]; const probabilities = typed.map(model => predict(model, row.features)) as [number, number, number];
    const percentiles = typed.map((model, idx) => percentileRank(model.trainingPredictionsSorted, probabilities[idx])) as [number, number, number]; const combined = Math.max(...percentiles);
    forecasts.push({ index: row.index, informationDate: row.date, executionDate: isoDate(coreBars[row.index + 1].timestamp), probability5d3Pct: probabilities[0] * 100, probability20d5Pct: probabilities[1] * 100, probability60d10Pct: probabilities[2] * 100, imminentRiskPercentilePct: percentiles[0] * 100, nearTermRiskPercentilePct: percentiles[1] * 100, mediumTermRiskPercentilePct: percentiles[2] * 100, combinedRiskPercentilePct: combined * 100, regime: row.activeCrash.some(Boolean) ? 'CRASH_ACTIVE' : row.labels.some(label => label === 1) ? 'PRE_CRASH' : 'NORMAL', labels: row.labels.map(label => Number.isFinite(label) ? label : null) as [number | null, number | null, number | null], percentiles, rawLabels: row.labels });
  }
  return { forecasts, latestModels: models };
}

function metric(horizonIndex: HorizonIndex, forecasts: ForecastInternal[]): ForwardRiskV3Metric {
  const usable = forecasts.filter(row => Number.isFinite(row.rawLabels[horizonIndex])); const labels = usable.map(row => row.rawLabels[horizonIndex]); const predictions = usable.map(row => [row.probability5d3Pct, row.probability20d5Pct, row.probability60d10Pct][horizonIndex] / 100);
  const eventRate = labels.length ? mean(labels) : Number.NaN; const directAuc = auc(labels, predictions); const invertedAuc = directAuc == null ? null : 1 - directAuc;
  const sorted = usable.map((row, index) => ({ row, probability: predictions[index] })).sort((a, b) => b.probability - a.probability); const topCount = Math.max(1, Math.floor(sorted.length * 0.10)); const topRate = sorted.length ? mean(sorted.slice(0, topCount).map(entry => entry.row.rawLabels[horizonIndex])) : Number.NaN;
  const highRisk = usable.filter(row => row.percentiles[horizonIndex] >= HIGH_RISK_PERCENTILE); const precision = highRisk.length ? mean(highRisk.map(row => row.rawLabels[horizonIndex])) : Number.NaN;
  return { horizonSessions: HORIZONS[horizonIndex], preCrashThresholdPct: THRESHOLDS[horizonIndex], observations: usable.length, eventRatePct: Number.isFinite(eventRate) ? eventRate * 100 : null, auc: directAuc, invertedAuc, topDecileEventRatePct: Number.isFinite(topRate) ? topRate * 100 : null, liftVsBaseRate: Number.isFinite(topRate) && Number.isFinite(eventRate) && eventRate > 0 ? topRate / eventRate : null, highRiskForecasts: highRisk.length, highRiskPrecisionPct: Number.isFinite(precision) ? precision * 100 : null, highRiskFalsePositivePct: Number.isFinite(precision) ? (1 - precision) * 100 : null, orientation: directAuc == null ? 'UNRESOLVED' : directAuc >= 0.5 ? 'DIRECT' : 'INVERTED' };
}

function detectCrashEpisodes(coreBars: PriceBar[], thresholdPct: 3 | 5 | 10): CrashEpisode[] {
  if (!coreBars.length) return []; const episodes: CrashEpisode[] = []; let peakIndex = 0, peakPrice = coreBars[0].close, inEpisode = false;
  for (let i = 1; i < coreBars.length; i++) { const price = coreBars[i].close; if (!inEpisode) { if (price >= peakPrice) { peakPrice = price; peakIndex = i; continue; } if ((price / peakPrice - 1) * 100 <= -thresholdPct) { episodes.push({ thresholdPct, peakIndex, breachIndex: i }); inEpisode = true; } } else if (price >= peakPrice) { inEpisode = false; peakPrice = price; peakIndex = i; } }
  return episodes;
}
function auditEpisodes(coreBars: PriceBar[], forecasts: ForecastInternal[]): ForwardRiskV3EpisodeAudit[] {
  const byIndex = new Map(forecasts.map(row => [row.index, row] as const)); const audits: ForwardRiskV3EpisodeAudit[] = [];
  for (let horizonIndex = 0 as HorizonIndex; horizonIndex < 3; horizonIndex = (horizonIndex + 1) as HorizonIndex) {
    const horizon = HORIZONS[horizonIndex]; const threshold = THRESHOLDS[horizonIndex];
    for (const episode of detectCrashEpisodes(coreBars, threshold)) {
      const prePeak: Array<{ index: number; percentile: number; date: string }> = [];
      for (let index = Math.max(0, episode.peakIndex - horizon); index <= episode.peakIndex; index++) { const forecast = byIndex.get(index); if (forecast) prePeak.push({ index, percentile: forecast.percentiles[horizonIndex], date: forecast.informationDate }); }
      const high = prePeak.find(row => row.percentile >= HIGH_RISK_PERCENTILE) ?? null; const maximum = prePeak.length ? Math.max(...prePeak.map(row => row.percentile)) : Number.NaN;
      audits.push({ thresholdPct: threshold, horizonSessions: horizon, peakDate: isoDate(coreBars[episode.peakIndex].timestamp), breachDate: isoDate(coreBars[episode.breachIndex].timestamp), peakToBreachSessions: episode.breachIndex - episode.peakIndex, firstHighRiskDateBeforePeak: high?.date ?? null, leadSessionsBeforePeak: high ? episode.peakIndex - high.index : null, maxRiskPercentileBeforePeak: Number.isFinite(maximum) ? maximum * 100 : null, anticipatedBeforePeak: high != null });
    }
  }
  return audits;
}
function topWeights(models: [LogisticModel | null, LogisticModel | null, LogisticModel | null]) {
  return models.map((model, idx) => ({ horizonSessions: HORIZONS[idx], top: model ? model.weights.map((coefficient, featureIndex) => ({ feature: model.featureNames[featureIndex], coefficient, absCoefficient: Math.abs(coefficient) })).sort((a, b) => b.absCoefficient - a.absCoefficient).slice(0, 12) : [] })) as Array<{ horizonSessions: 5 | 20 | 60; top: ForwardRiskV3FeatureWeight[] }>;
}
function modelDiagnostics(models: [LogisticModel | null, LogisticModel | null, LogisticModel | null]): ForwardRiskV3ModelDiagnostic[] {
  return models.map((model, idx) => ({ horizonSessions: HORIZONS[idx], selectedFeatureCount: model?.featureNames.length ?? HORIZON_FEATURES[HORIZONS[idx]].length, regularizationMultiplier: model?.regularizationMultiplier ?? null, innerValidationAuc: model?.innerValidationAuc ?? null, trainingRows: model?.trainingRows ?? 0 })) as ForwardRiskV3ModelDiagnostic[];
}

export function runForwardRiskForecastV3(input: { dataset: MultiAssetDataset; diagnosticDataset?: MultiAssetDataset; catalog: AssetUniverseItem[]; startDate: string; endDate: string }): ForwardRiskForecastV3Result {
  const core = chooseCoreAsset(input.dataset, input.startDate, input.endDate);
  const horizonFeatureCounts = { '5': HORIZON_FEATURES[5].length, '20': HORIZON_FEATURES[20].length, '60': HORIZON_FEATURES[60].length };
  if (!core) return { version: FORWARD_RISK_FORECAST_V3, status: 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_MONOTONIC_NEXT_OPEN', objective: 'PRE_CRASH_DETERIORATION_NOT_ACTIVE_CRASH', coreAssetId: null, coreTicker: null, startDate: input.startDate, endDate: input.endDate, diagnosticSeriesUsed: [], diagnosticSeriesMissing: ['^VIX', '^VIX3M'], featureCount: FEATURE_NAMES.length, horizonFeatureCounts, retrainEverySessions: RETRAIN_EVERY_SESSIONS, minimumTrainingRows: MINIMUM_TRAINING_ROWS, maximumTrainingRows: MAXIMUM_TRAINING_ROWS, metrics: [], modelDiagnostics: [], rankingOrientationPass: null, innerValidationOrientationPass: null, predictiveSignalPass: null, anticipationPass: null, anticipatedEpisodeRatePct: null, medianLeadSessionsBeforePeak: null, forecastsEvaluated: 0, episodeAudits: [], featureWeights: [], sampledForecasts: [], notes: ['No existe core global con cobertura suficiente para V3.'] };

  const built = featureRows({ dataset: input.dataset, diagnosticDataset: input.diagnosticDataset, catalog: input.catalog, core }); const { forecasts, latestModels } = buildForecasts(built.rows, input.startDate, input.endDate, built.coreBars);
  const metrics = [metric(0, forecasts), metric(1, forecasts), metric(2, forecasts)]; const diagnostics = modelDiagnostics(latestModels); const validAucs = metrics.map(row => row.auc).filter((value): value is number => value != null);
  const rankingOrientationPass = metrics.every(row => row.orientation === 'DIRECT'); const innerValidationOrientationPass = diagnostics.every(row => row.innerValidationAuc != null && row.innerValidationAuc >= 0.50);
  const predictiveSignalPass = validAucs.length === 3 && rankingOrientationPass && innerValidationOrientationPass && validAucs.every(value => value > 0.50) && mean(validAucs) > 0.55 && metrics.filter(row => (row.auc ?? 0) > 0.55).length >= 2;
  const episodeAudits = auditEpisodes(built.coreBars, forecasts).filter(row => row.peakDate >= input.startDate && row.peakDate <= input.endDate); const auditable = episodeAudits.filter(row => row.maxRiskPercentileBeforePeak != null); const anticipated = auditable.filter(row => row.anticipatedBeforePeak);
  const anticipatedEpisodeRatePct = auditable.length ? anticipated.length / auditable.length * 100 : null; const leads = anticipated.map(row => row.leadSessionsBeforePeak).filter((value): value is number => value != null).sort((a, b) => a - b); const medianLeadSessionsBeforePeak = leads.length ? leads[Math.floor(leads.length / 2)] : null;
  const anticipationPass = auditable.length >= 3 && anticipated.length / auditable.length >= 0.50 && medianLeadSessionsBeforePeak != null && medianLeadSessionsBeforePeak >= 2;
  const sampledForecasts = forecasts.filter((row, index) => index % 20 === 0 || row.regime === 'PRE_CRASH' || row.combinedRiskPercentilePct >= HIGH_RISK_PERCENTILE * 100).concat(forecasts.slice(-1)).slice(-1200).map(row => ({ informationDate: row.informationDate, executionDate: row.executionDate, probability5d3Pct: row.probability5d3Pct, probability20d5Pct: row.probability20d5Pct, probability60d10Pct: row.probability60d10Pct, imminentRiskPercentilePct: row.imminentRiskPercentilePct, nearTermRiskPercentilePct: row.nearTermRiskPercentilePct, mediumTermRiskPercentilePct: row.mediumTermRiskPercentilePct, combinedRiskPercentilePct: row.combinedRiskPercentilePct, regime: row.regime, labels: row.labels }));
  return { version: FORWARD_RISK_FORECAST_V3, status: forecasts.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_MONOTONIC_NEXT_OPEN', objective: 'PRE_CRASH_DETERIORATION_NOT_ACTIVE_CRASH', coreAssetId: core.assetId, coreTicker: core.ticker, startDate: input.startDate, endDate: input.endDate, diagnosticSeriesUsed: built.diagnosticUsed, diagnosticSeriesMissing: built.diagnosticMissing, featureCount: FEATURE_NAMES.length, horizonFeatureCounts, retrainEverySessions: RETRAIN_EVERY_SESSIONS, minimumTrainingRows: MINIMUM_TRAINING_ROWS, maximumTrainingRows: MAXIMUM_TRAINING_ROWS, metrics, modelDiagnostics: diagnostics, rankingOrientationPass, innerValidationOrientationPass, predictiveSignalPass, anticipationPass, anticipatedEpisodeRatePct, medianLeadSessionsBeforePeak, forecastsEvaluated: forecasts.length, episodeAudits, featureWeights: topWeights(latestModels), sampledForecasts, notes: [
    'V3 mantiene el target PRE_CRASH de V2 y sigue excluyendo crisis activas del entrenamiento/evaluación.',
    'Las features V3 están orientadas semánticamente: valores mayores representan deterioro. Los coeficientes del clasificador están restringidos a ser no negativos.',
    'Los horizontes 5/20/60 usan subconjuntos distintos de features; 60 sesiones elimina niveles absolutos ambiguos de VIX, breadth y drawdown que dominaron V2.',
    'V3 añade interacciones explícitas de anticipación: tendencia fuerte+breadth deteriorándose, mercado calmo+volatilidad subiendo, momentum positivo perdiendo fuerza, dispersión+breadth y rotación defensiva.',
    'La regularización se selecciona con una validación cronológica interna usando sólo etiquetas ya maduras. Nunca se invierte el score ni se selecciona por el replay futuro.',
    'Cada forecast entrena únicamente con muestras cuyo horizonte completo terminó antes de informationDate y mantiene semántica next-open.',
    'AUC invertida continúa siendo sólo diagnóstica. V3 no contiene ningún camino 1-score ni inversión automática.',
    'V3 es investigación aislada: no modifica Custodia, PortfolioDecisionEngine, Telegram, posiciones reales ni política económica de exposición.'
  ] };
}
