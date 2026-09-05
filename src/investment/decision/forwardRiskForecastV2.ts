import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';
import { STRATEGIC_GROWTH_CORE_PRIORITY } from './portfolioAssetRole';

export const FORWARD_RISK_FORECAST_V2 = 'FORWARD_RISK_FORECAST_V2' as const;

const HORIZONS = [5, 20, 60] as const;
const THRESHOLDS = [3, 5, 10] as const;
const CALM_DRAWDOWN_LIMITS = [1.5, 2.0, 3.0] as const;
const MINIMUM_TRAINING_ROWS = 504;
const MAXIMUM_TRAINING_ROWS = 1512;
const RETRAIN_EVERY_SESSIONS = 20;
const LOGISTIC_ITERATIONS = 320;
const LOGISTIC_LEARNING_RATE = 0.035;
const ELASTIC_L1 = 0.0015;
const ELASTIC_L2 = 0.025;
const HIGH_RISK_PERCENTILE = 0.80;

const DEFENSIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GOV_BONDS', 'CORP_BONDS', 'AGG_BONDS', 'MONEY_MARKET', 'GOLD', 'COMMODITIES'
]);

const FEATURE_NAMES = [
  'coreRet1', 'coreRet3', 'coreRet5', 'coreRet10', 'coreRet20', 'coreRet60',
  'coreMomentumDeceleration5', 'coreMomentumDeceleration20',
  'coreVol5', 'coreVol20', 'coreVol60', 'coreVolAcceleration', 'coreVolAcceleration5d',
  'coreDownsideVol20', 'coreDownsideShare20',
  'coreDrawdown20', 'coreDrawdown60', 'coreDrawdown252', 'coreDrawdownChange5d',
  'coreDistanceSma20', 'coreDistanceSma50', 'coreDistanceSma200',
  'coreDistanceSma20Change5d', 'coreDistanceSma50Change10d',
  'breadthPositive20', 'breadthPositive60', 'breadthAboveSma50', 'breadthAboveSma200',
  'breadthPositive20Change5d', 'breadthAboveSma50Change10d', 'breadthShortMinusMedium',
  'crossSectionDispersion20', 'crossSectionDispersionChange5d',
  'defensiveRelative5', 'defensiveRelative20', 'defensiveRotationAcceleration',
  'priceBreadthDivergence20',
  'vixLevel', 'vixReturn1', 'vixReturn3', 'vixReturn5', 'vixReturn20', 'vixZ60',
  'vixAcceleration5d', 'vixTermRatio', 'vixTermRatioChange3d', 'vixTermRatioChange5d',
  'vixMissing', 'vix3mMissing'
] as const;

export interface ForwardRiskV2Metric {
  horizonSessions: 5 | 20 | 60;
  preCrashThresholdPct: 3 | 5 | 10;
  observations: number;
  eventRatePct: number | null;
  auc: number | null;
  invertedAuc: number | null;
  topDecileEventRatePct: number | null;
  liftVsBaseRate: number | null;
  orientation: 'DIRECT' | 'INVERTED' | 'UNRESOLVED';
}

export interface ForwardRiskV2FeatureWeight {
  feature: string;
  coefficient: number;
  absCoefficient: number;
}

export interface ForwardRiskV2AuditPoint {
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

export interface ForwardRiskV2EpisodeAudit {
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

export interface ForwardRiskForecastV2Result {
  version: typeof FORWARD_RISK_FORECAST_V2;
  status: 'VALID' | 'INSUFFICIENT_DATA';
  methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_NEXT_OPEN';
  objective: 'PRE_CRASH_NOT_ACTIVE_CRASH';
  coreAssetId: string | null;
  coreTicker: string | null;
  startDate: string;
  endDate: string;
  diagnosticSeriesUsed: string[];
  diagnosticSeriesMissing: string[];
  featureCount: number;
  retrainEverySessions: number;
  minimumTrainingRows: number;
  maximumTrainingRows: number;
  metrics: ForwardRiskV2Metric[];
  rankingOrientationPass: boolean | null;
  predictiveSignalPass: boolean | null;
  anticipationPass: boolean | null;
  forecastsEvaluated: number;
  episodeAudits: ForwardRiskV2EpisodeAudit[];
  featureWeights: Array<{ horizonSessions: 5 | 20 | 60; top: ForwardRiskV2FeatureWeight[] }>;
  sampledForecasts: ForwardRiskV2AuditPoint[];
  notes: string[];
}

interface FeatureRow {
  index: number;
  date: string;
  features: number[];
  labels: [number, number, number];
  labelEndIndexes: [number, number, number];
  activeCrash: [boolean, boolean, boolean];
}

interface LogisticModel {
  means: number[];
  stds: number[];
  weights: number[];
  intercept: number;
  calibrationShift: number;
  trainingPredictionsSorted: number[];
  trainingRows: number;
}

interface ForecastInternal extends ForwardRiskV2AuditPoint {
  index: number;
  percentiles: [number, number, number];
  rawLabels: [number, number, number];
  hasAllLabels: boolean;
}

interface CrashEpisode {
  thresholdPct: 3 | 5 | 10;
  peakIndex: number;
  breachIndex: number;
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function sigmoid(value: number): number { return 1 / (1 + Math.exp(-clamp(value, -30, 30))); }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN; }
function std(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}
function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 0.5;
  let low = 0, high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid] <= value) low = mid + 1; else high = mid;
  }
  return low / sorted.length;
}
function sortedBars(asset: MultiAssetDatasetItem): PriceBar[] {
  return [...asset.bars].filter(bar => bar.close > 0 && bar.open > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
}
function alignedCloses(asset: MultiAssetDatasetItem | null, dates: string[], maximumStalenessDays = 5): Array<number | null> {
  if (!asset) return dates.map(() => null);
  const bars = sortedBars(asset);
  const out: Array<number | null> = [];
  let cursor = 0;
  let latest: PriceBar | null = null;
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
    const a = values[i - 1], b = values[i];
    if (a != null && b != null && a > 0 && b > 0) returns.push(Math.log(b / a));
  }
  return returns.length >= Math.max(3, Math.floor(lookback * 0.7)) ? std(returns) * Math.sqrt(252) * 100 : Number.NaN;
}
function downsideVol(values: Array<number | null>, index: number, lookback: number): number {
  if (index < lookback) return Number.NaN;
  const returns: number[] = [];
  for (let i = index - lookback + 1; i <= index; i++) {
    const a = values[i - 1], b = values[i];
    if (a != null && b != null && a > 0 && b > 0) returns.push(Math.min(0, Math.log(b / a)));
  }
  return returns.length >= Math.max(3, Math.floor(lookback * 0.7)) ? Math.sqrt(mean(returns.map(value => value * value))) * Math.sqrt(252) * 100 : Number.NaN;
}
function downsideShare(values: Array<number | null>, index: number, lookback: number): number {
  if (index < lookback) return Number.NaN;
  let valid = 0, negative = 0;
  for (let i = index - lookback + 1; i <= index; i++) {
    const a = values[i - 1], b = values[i];
    if (a != null && b != null && a > 0 && b > 0) { valid++; if (b < a) negative++; }
  }
  return valid >= Math.floor(lookback * 0.7) ? negative / valid : Number.NaN;
}
function drawdownFromWindow(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || current <= 0) return Number.NaN;
  const start = Math.max(0, index - lookback + 1);
  const finite = values.slice(start, index + 1).filter((value): value is number => value != null && value > 0);
  if (!finite.length) return Number.NaN;
  const peak = Math.max(...finite);
  return peak > 0 ? Math.max(0, (peak - current) / peak * 100) : Number.NaN;
}
function distanceToSma(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || current <= 0 || index + 1 < lookback) return Number.NaN;
  const finite = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && value > 0);
  if (finite.length < Math.floor(lookback * 0.9)) return Number.NaN;
  const avg = mean(finite);
  return avg > 0 ? (current / avg - 1) * 100 : Number.NaN;
}
function zScore(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || index + 1 < lookback) return Number.NaN;
  const finite = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && Number.isFinite(value));
  if (finite.length < Math.floor(lookback * 0.8)) return Number.NaN;
  const s = std(finite);
  return Number.isFinite(s) && s > 1e-9 ? (current - mean(finite)) / s : 0;
}
function delta(valueNow: number, valuePast: number): number {
  return Number.isFinite(valueNow) && Number.isFinite(valuePast) ? valueNow - valuePast : Number.NaN;
}

function chooseCoreAsset(dataset: MultiAssetDataset, startDate: string, endDate: string): MultiAssetDatasetItem | null {
  const usable = (assetId: string) => {
    const asset = dataset.assets.find(row => row.assetId === assetId);
    if (!asset) return null;
    const bars = sortedBars(asset);
    const start = bars.find(bar => isoDate(bar.timestamp) >= startDate && isoDate(bar.timestamp) <= endDate);
    if (!start) return null;
    const gap = (Date.parse(`${isoDate(start.timestamp)}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
    return gap <= 7 ? asset : null;
  };
  const preferred = usable('EUNL');
  if (preferred) return preferred;
  for (const id of STRATEGIC_GROWTH_CORE_PRIORITY) {
    const asset = usable(id);
    if (asset) return asset;
  }
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
  const minimum = Math.min(...future);
  return { label: (minimum / current - 1) * 100 <= -thresholdPct ? 1 : 0, activeCrash: false };
}

function featureRows(input: { dataset: MultiAssetDataset; diagnosticDataset?: MultiAssetDataset; catalog: AssetUniverseItem[]; core: MultiAssetDatasetItem }): {
  rows: FeatureRow[]; dates: string[]; coreBars: PriceBar[]; diagnosticUsed: string[]; diagnosticMissing: string[];
} {
  const coreBars = sortedBars(input.core);
  const dates = coreBars.map(bar => isoDate(bar.timestamp));
  const core = coreBars.map(bar => bar.close as number | null);
  const categoryById = new Map(input.catalog.map(asset => [asset.assetId, asset.category] as const));
  const risky = input.dataset.assets.filter(asset => asset.assetId !== input.core.assetId).filter(asset => {
    const category = categoryById.get(asset.assetId); return category != null && !DEFENSIVE_CATEGORIES.has(category);
  }).map(asset => alignedCloses(asset, dates));
  const defensive = input.dataset.assets.filter(asset => {
    const category = categoryById.get(asset.assetId); return category != null && DEFENSIVE_CATEGORIES.has(category);
  }).map(asset => alignedCloses(asset, dates));
  const diagnosticMap = new Map((input.diagnosticDataset?.assets ?? []).map(asset => [asset.assetId, asset] as const));
  const vixAsset = diagnosticMap.get('DIAG_VIX') ?? null;
  const vix3mAsset = diagnosticMap.get('DIAG_VIX3M') ?? null;
  const vix = alignedCloses(vixAsset, dates);
  const vix3m = alignedCloses(vix3mAsset, dates);
  const diagnosticUsed = [vixAsset ? '^VIX' : null, vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);
  const diagnosticMissing = [!vixAsset ? '^VIX' : null, !vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);

  const breadthPositive20: number[] = Array(dates.length).fill(Number.NaN);
  const breadthPositive60: number[] = Array(dates.length).fill(Number.NaN);
  const breadthAbove50: number[] = Array(dates.length).fill(Number.NaN);
  const breadthAbove200: number[] = Array(dates.length).fill(Number.NaN);
  const dispersion20: number[] = Array(dates.length).fill(Number.NaN);
  const defensiveRelative5: number[] = Array(dates.length).fill(Number.NaN);
  const defensiveRelative20: number[] = Array(dates.length).fill(Number.NaN);
  const vixTermRatio: number[] = Array(dates.length).fill(Number.NaN);

  for (let i = 252; i < dates.length; i++) {
    const risky5 = risky.map(series => pctReturn(series, i, 5)).filter(Number.isFinite);
    const risky20 = risky.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    const risky60 = risky.map(series => pctReturn(series, i, 60)).filter(Number.isFinite);
    const above50Rows = risky.map(series => distanceToSma(series, i, 50)).filter(Number.isFinite);
    const above200Rows = risky.map(series => distanceToSma(series, i, 200)).filter(Number.isFinite);
    const defensive5 = defensive.map(series => pctReturn(series, i, 5)).filter(Number.isFinite);
    const defensive20 = defensive.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    breadthPositive20[i] = risky20.length ? risky20.filter(value => value > 0).length / risky20.length : Number.NaN;
    breadthPositive60[i] = risky60.length ? risky60.filter(value => value > 0).length / risky60.length : Number.NaN;
    breadthAbove50[i] = above50Rows.length ? above50Rows.filter(value => value > 0).length / above50Rows.length : Number.NaN;
    breadthAbove200[i] = above200Rows.length ? above200Rows.filter(value => value > 0).length / above200Rows.length : Number.NaN;
    dispersion20[i] = risky20.length >= 3 ? std(risky20) : Number.NaN;
    defensiveRelative5[i] = defensive5.length && risky5.length ? mean(defensive5) - mean(risky5) : Number.NaN;
    defensiveRelative20[i] = defensive20.length && risky20.length ? mean(defensive20) - mean(risky20) : Number.NaN;
    const vixLevel = vix[i], vix3mLevel = vix3m[i];
    vixTermRatio[i] = vixLevel != null && vix3mLevel != null && vix3mLevel > 0 ? vixLevel / vix3mLevel : Number.NaN;
  }

  const rows: FeatureRow[] = [];
  for (let i = 252; i < dates.length; i++) {
    const coreVol5 = realizedVol(core, i, 5), coreVol20 = realizedVol(core, i, 20), coreVol60 = realizedVol(core, i, 60);
    const dd20 = drawdownFromWindow(core, i, 20), dd60 = drawdownFromWindow(core, i, 60), dd252 = drawdownFromWindow(core, i, 252);
    const sma20 = distanceToSma(core, i, 20), sma50 = distanceToSma(core, i, 50), sma200 = distanceToSma(core, i, 200);
    const coreRet20 = pctReturn(core, i, 20);
    const riskyRet20 = risky.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    const vixLevel = vix[i] ?? Number.NaN;

    const features = [
      pctReturn(core, i, 1), pctReturn(core, i, 3), pctReturn(core, i, 5), pctReturn(core, i, 10), coreRet20, pctReturn(core, i, 60),
      delta(pctReturn(core, i, 5), pctReturn(core, i - 5, 5)), delta(coreRet20, pctReturn(core, i - 10, 20)),
      coreVol5, coreVol20, coreVol60, delta(coreVol5, coreVol60), delta(coreVol5, realizedVol(core, i - 5, 5)),
      downsideVol(core, i, 20), downsideShare(core, i, 20),
      dd20, dd60, dd252, delta(dd252, drawdownFromWindow(core, i - 5, 252)),
      sma20, sma50, sma200, delta(sma20, distanceToSma(core, i - 5, 20)), delta(sma50, distanceToSma(core, i - 10, 50)),
      breadthPositive20[i], breadthPositive60[i], breadthAbove50[i], breadthAbove200[i],
      delta(breadthPositive20[i], breadthPositive20[i - 5]), delta(breadthAbove50[i], breadthAbove50[i - 10]), delta(breadthPositive20[i], breadthPositive60[i]),
      dispersion20[i], delta(dispersion20[i], dispersion20[i - 5]),
      defensiveRelative5[i], defensiveRelative20[i], delta(defensiveRelative5[i], defensiveRelative20[i]),
      Number.isFinite(coreRet20) && riskyRet20.length ? coreRet20 - mean(riskyRet20) : Number.NaN,
      vixLevel, pctReturn(vix, i, 1), pctReturn(vix, i, 3), pctReturn(vix, i, 5), pctReturn(vix, i, 20), zScore(vix, i, 60),
      delta(pctReturn(vix, i, 5), pctReturn(vix, i - 5, 5)), vixTermRatio[i], delta(vixTermRatio[i], vixTermRatio[i - 3]), delta(vixTermRatio[i], vixTermRatio[i - 5]),
      Number.isFinite(vixLevel) ? 0 : 1, Number.isFinite(vix3m[i] ?? Number.NaN) ? 0 : 1
    ];

    const targets = HORIZONS.map((horizon, idx) => futurePreCrashLabel(core, i, horizon, THRESHOLDS[idx], CALM_DRAWDOWN_LIMITS[idx]));
    rows.push({
      index: i,
      date: dates[i],
      features,
      labels: targets.map(target => target.label) as [number, number, number],
      labelEndIndexes: [i + 5, i + 20, i + 60],
      activeCrash: targets.map(target => target.activeCrash) as [boolean, boolean, boolean]
    });
  }
  return { rows, dates, coreBars, diagnosticUsed, diagnosticMissing };
}

function fitLogisticModel(trainingRows: FeatureRow[], labelIndex: 0 | 1 | 2): LogisticModel | null {
  const usable = trainingRows.filter(row => Number.isFinite(row.labels[labelIndex]));
  if (usable.length < MINIMUM_TRAINING_ROWS) return null;
  const positives = usable.filter(row => row.labels[labelIndex] === 1).length;
  const negatives = usable.length - positives;
  if (positives < 8 || negatives < 8) return null;

  const means = Array(FEATURE_NAMES.length).fill(0);
  const stds = Array(FEATURE_NAMES.length).fill(1);
  for (let column = 0; column < FEATURE_NAMES.length; column++) {
    const finite = usable.map(row => row.features[column]).filter(Number.isFinite);
    means[column] = finite.length ? mean(finite) : 0;
    const s = finite.length > 1 ? std(finite) : 1;
    stds[column] = Number.isFinite(s) && s > 1e-8 ? s : 1;
  }
  const xRows = usable.map(row => row.features.map((value, column) => Number.isFinite(value) ? (value - means[column]) / stds[column] : 0));
  const labels = usable.map(row => row.labels[labelIndex]);
  const positiveWeight = clamp(negatives / Math.max(1, positives), 1, 8);
  const weights = Array(FEATURE_NAMES.length).fill(0);
  let intercept = Math.log(clamp(positives / usable.length, 0.01, 0.99) / clamp(negatives / usable.length, 0.01, 0.99));

  for (let iteration = 0; iteration < LOGISTIC_ITERATIONS; iteration++) {
    const gradients = Array(weights.length).fill(0);
    let interceptGradient = 0;
    let totalWeight = 0;
    for (let rowIndex = 0; rowIndex < xRows.length; rowIndex++) {
      const x = xRows[rowIndex], y = labels[rowIndex];
      const sampleWeight = y === 1 ? positiveWeight : 1;
      const logit = intercept + x.reduce((sum, value, column) => sum + value * weights[column], 0);
      const error = (sigmoid(logit) - y) * sampleWeight;
      interceptGradient += error;
      totalWeight += sampleWeight;
      for (let column = 0; column < weights.length; column++) gradients[column] += error * x[column];
    }
    const rate = LOGISTIC_LEARNING_RATE / Math.max(1, totalWeight);
    intercept -= rate * interceptGradient;
    for (let column = 0; column < weights.length; column++) {
      const l2Gradient = ELASTIC_L2 * weights[column];
      let updated = weights[column] - rate * (gradients[column] + l2Gradient * totalWeight);
      const shrink = rate * ELASTIC_L1 * totalWeight;
      updated = Math.sign(updated) * Math.max(0, Math.abs(updated) - shrink);
      weights[column] = clamp(updated, -8, 8);
    }
  }

  const rawLogits = xRows.map(x => intercept + x.reduce((sum, value, column) => sum + value * weights[column], 0));
  const eventRate = positives / usable.length;
  let low = -12, high = 12;
  for (let iteration = 0; iteration < 80; iteration++) {
    const mid = (low + high) / 2;
    const calibratedMean = mean(rawLogits.map(logit => sigmoid(logit + mid)));
    if (calibratedMean > eventRate) high = mid; else low = mid;
  }
  const calibrationShift = (low + high) / 2;
  const trainingPredictionsSorted = rawLogits.map(logit => sigmoid(logit + calibrationShift)).sort((a, b) => a - b);
  return { means, stds, weights, intercept, calibrationShift, trainingPredictionsSorted, trainingRows: usable.length };
}

function predict(model: LogisticModel, features: number[]): number {
  const x = features.map((value, column) => Number.isFinite(value) ? (value - model.means[column]) / model.stds[column] : 0);
  return sigmoid(model.intercept + model.calibrationShift + x.reduce((sum, value, column) => sum + value * model.weights[column], 0));
}

function auc(labels: number[], predictions: number[]): number | null {
  const pairs = labels.map((label, index) => ({ label, prediction: predictions[index] })).filter(row => Number.isFinite(row.label) && Number.isFinite(row.prediction)).sort((a, b) => a.prediction - b.prediction);
  const positives = pairs.filter(row => row.label === 1).length;
  const negatives = pairs.length - positives;
  if (!positives || !negatives) return null;
  let rankSum = 0, index = 0;
  while (index < pairs.length) {
    let end = index + 1;
    while (end < pairs.length && Math.abs(pairs[end].prediction - pairs[index].prediction) < 1e-12) end++;
    const averageRank = (index + 1 + end) / 2;
    for (let j = index; j < end; j++) if (pairs[j].label === 1) rankSum += averageRank;
    index = end;
  }
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

function metric(horizonIndex: 0 | 1 | 2, forecasts: ForecastInternal[]): ForwardRiskV2Metric {
  const usable = forecasts.filter(row => row.hasAllLabels && Number.isFinite(row.rawLabels[horizonIndex]));
  const labels = usable.map(row => row.rawLabels[horizonIndex]);
  const predictions = usable.map(row => [row.probability5d3Pct, row.probability20d5Pct, row.probability60d10Pct][horizonIndex] / 100);
  const eventRate = labels.length ? mean(labels) : Number.NaN;
  const directAuc = auc(labels, predictions);
  const invertedAuc = directAuc == null ? null : 1 - directAuc;
  const sorted = usable.map((row, index) => ({ row, probability: predictions[index] })).sort((a, b) => b.probability - a.probability);
  const topCount = Math.max(1, Math.floor(sorted.length * 0.10));
  const topRate = sorted.length ? mean(sorted.slice(0, topCount).map(entry => entry.row.rawLabels[horizonIndex])) : Number.NaN;
  const orientation = directAuc == null || invertedAuc == null ? 'UNRESOLVED' : directAuc >= invertedAuc ? 'DIRECT' : 'INVERTED';
  return {
    horizonSessions: HORIZONS[horizonIndex], preCrashThresholdPct: THRESHOLDS[horizonIndex], observations: usable.length,
    eventRatePct: Number.isFinite(eventRate) ? eventRate * 100 : null, auc: directAuc, invertedAuc,
    topDecileEventRatePct: Number.isFinite(topRate) ? topRate * 100 : null,
    liftVsBaseRate: Number.isFinite(topRate) && Number.isFinite(eventRate) && eventRate > 0 ? topRate / eventRate : null,
    orientation
  };
}

function buildForecasts(rows: FeatureRow[], startDate: string, endDate: string, coreBars: PriceBar[]): { forecasts: ForecastInternal[]; latestModels: [LogisticModel | null, LogisticModel | null, LogisticModel | null] } {
  const forecasts: ForecastInternal[] = [];
  let models: [LogisticModel | null, LogisticModel | null, LogisticModel | null] = [null, null, null];
  let lastRetrainCoreIndex = -Infinity;
  for (const row of rows) {
    if (row.date < startDate || row.date >= endDate || row.index + 1 >= coreBars.length) continue;
    if (row.index - lastRetrainCoreIndex >= RETRAIN_EVERY_SESSIONS || models.some(model => model == null)) {
      const trainingFor = (labelIndex: 0 | 1 | 2) => rows
        .filter(candidate => candidate.index < row.index && candidate.labelEndIndexes[labelIndex] < row.index && Number.isFinite(candidate.labels[labelIndex]))
        .slice(-MAXIMUM_TRAINING_ROWS);
      models = [fitLogisticModel(trainingFor(0), 0), fitLogisticModel(trainingFor(1), 1), fitLogisticModel(trainingFor(2), 2)];
      lastRetrainCoreIndex = row.index;
    }
    if (models.some(model => model == null)) continue;
    const typed = models as [LogisticModel, LogisticModel, LogisticModel];
    const probabilities = typed.map(model => predict(model, row.features)) as [number, number, number];
    const percentiles = typed.map((model, idx) => percentileRank(model.trainingPredictionsSorted, probabilities[idx])) as [number, number, number];
    const combined = Math.max(percentiles[0], percentiles[1], percentiles[2]);
    const validLabels = row.labels.map(label => Number.isFinite(label) ? label : null) as [number | null, number | null, number | null];
    const regime = row.activeCrash.some(Boolean) ? 'CRASH_ACTIVE' : row.labels.some(label => label === 1) ? 'PRE_CRASH' : 'NORMAL';
    forecasts.push({
      index: row.index,
      informationDate: row.date,
      executionDate: isoDate(coreBars[row.index + 1].timestamp),
      probability5d3Pct: probabilities[0] * 100,
      probability20d5Pct: probabilities[1] * 100,
      probability60d10Pct: probabilities[2] * 100,
      imminentRiskPercentilePct: percentiles[0] * 100,
      nearTermRiskPercentilePct: percentiles[1] * 100,
      mediumTermRiskPercentilePct: percentiles[2] * 100,
      combinedRiskPercentilePct: combined * 100,
      regime,
      labels: validLabels,
      percentiles,
      rawLabels: row.labels,
      hasAllLabels: row.labels.every(Number.isFinite)
    });
  }
  return { forecasts, latestModels: models };
}

function detectCrashEpisodes(coreBars: PriceBar[], thresholdPct: 3 | 5 | 10): CrashEpisode[] {
  if (!coreBars.length) return [];
  const episodes: CrashEpisode[] = [];
  let peakIndex = 0, peakPrice = coreBars[0].close, inEpisode = false;
  for (let i = 1; i < coreBars.length; i++) {
    const price = coreBars[i].close;
    if (!inEpisode) {
      if (price >= peakPrice) { peakPrice = price; peakIndex = i; continue; }
      const drawdownPct = (price / peakPrice - 1) * 100;
      if (drawdownPct <= -thresholdPct) {
        episodes.push({ thresholdPct, peakIndex, breachIndex: i });
        inEpisode = true;
      }
    } else if (price >= peakPrice) {
      inEpisode = false;
      peakPrice = price;
      peakIndex = i;
    }
  }
  return episodes;
}

function auditEpisodes(coreBars: PriceBar[], forecasts: ForecastInternal[]): ForwardRiskV2EpisodeAudit[] {
  const byIndex = new Map(forecasts.map(row => [row.index, row] as const));
  const audits: ForwardRiskV2EpisodeAudit[] = [];
  for (let horizonIndex = 0 as 0 | 1 | 2; horizonIndex < 3; horizonIndex = (horizonIndex + 1) as 0 | 1 | 2) {
    const threshold = THRESHOLDS[horizonIndex];
    const horizon = HORIZONS[horizonIndex];
    for (const episode of detectCrashEpisodes(coreBars, threshold)) {
      const windowStart = Math.max(0, episode.peakIndex - horizon);
      const prePeak: Array<{ index: number; percentile: number; date: string }> = [];
      for (let index = windowStart; index <= episode.peakIndex; index++) {
        const forecast = byIndex.get(index);
        if (!forecast) continue;
        prePeak.push({ index, percentile: forecast.percentiles[horizonIndex], date: forecast.informationDate });
      }
      const high = prePeak.find(row => row.percentile >= HIGH_RISK_PERCENTILE) ?? null;
      const maximum = prePeak.length ? Math.max(...prePeak.map(row => row.percentile)) : Number.NaN;
      audits.push({
        thresholdPct: threshold,
        horizonSessions: horizon,
        peakDate: isoDate(coreBars[episode.peakIndex].timestamp),
        breachDate: isoDate(coreBars[episode.breachIndex].timestamp),
        peakToBreachSessions: episode.breachIndex - episode.peakIndex,
        firstHighRiskDateBeforePeak: high?.date ?? null,
        leadSessionsBeforePeak: high ? episode.peakIndex - high.index : null,
        maxRiskPercentileBeforePeak: Number.isFinite(maximum) ? maximum * 100 : null,
        anticipatedBeforePeak: high != null
      });
    }
  }
  return audits;
}

function topWeights(models: [LogisticModel | null, LogisticModel | null, LogisticModel | null]): Array<{ horizonSessions: 5 | 20 | 60; top: ForwardRiskV2FeatureWeight[] }> {
  return models.map((model, idx) => ({
    horizonSessions: HORIZONS[idx],
    top: model ? model.weights.map((coefficient, featureIndex) => ({ feature: FEATURE_NAMES[featureIndex], coefficient, absCoefficient: Math.abs(coefficient) }))
      .sort((a, b) => b.absCoefficient - a.absCoefficient).slice(0, 12) : []
  })) as Array<{ horizonSessions: 5 | 20 | 60; top: ForwardRiskV2FeatureWeight[] }>;
}

export function runForwardRiskForecastV2(input: {
  dataset: MultiAssetDataset;
  diagnosticDataset?: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  startDate: string;
  endDate: string;
}): ForwardRiskForecastV2Result {
  const core = chooseCoreAsset(input.dataset, input.startDate, input.endDate);
  if (!core) {
    return {
      version: FORWARD_RISK_FORECAST_V2, status: 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_NEXT_OPEN', objective: 'PRE_CRASH_NOT_ACTIVE_CRASH',
      coreAssetId: null, coreTicker: null, startDate: input.startDate, endDate: input.endDate,
      diagnosticSeriesUsed: [], diagnosticSeriesMissing: ['^VIX', '^VIX3M'], featureCount: FEATURE_NAMES.length,
      retrainEverySessions: RETRAIN_EVERY_SESSIONS, minimumTrainingRows: MINIMUM_TRAINING_ROWS, maximumTrainingRows: MAXIMUM_TRAINING_ROWS,
      metrics: [], rankingOrientationPass: null, predictiveSignalPass: null, anticipationPass: null, forecastsEvaluated: 0,
      episodeAudits: [], featureWeights: [], sampledForecasts: [], notes: ['No existe core global con cobertura suficiente para V2.']
    };
  }

  const built = featureRows({ dataset: input.dataset, diagnosticDataset: input.diagnosticDataset, catalog: input.catalog, core });
  const { forecasts, latestModels } = buildForecasts(built.rows, input.startDate, input.endDate, built.coreBars);
  const metrics = [metric(0, forecasts), metric(1, forecasts), metric(2, forecasts)];
  const validAucs = metrics.map(row => row.auc).filter((value): value is number => value != null);
  const rankingOrientationPass = metrics.every(row => row.orientation === 'DIRECT');
  const predictiveSignalPass = validAucs.length === 3 && rankingOrientationPass && validAucs.every(value => value > 0.50) && mean(validAucs) > 0.55 && metrics.filter(row => (row.auc ?? 0) > 0.55).length >= 2;
  const episodeAudits = auditEpisodes(built.coreBars, forecasts).filter(row => row.peakDate >= input.startDate && row.peakDate <= input.endDate);
  const auditableEpisodes = episodeAudits.filter(row => row.maxRiskPercentileBeforePeak != null);
  const anticipated = auditableEpisodes.filter(row => row.anticipatedBeforePeak);
  const leadValues = anticipated.map(row => row.leadSessionsBeforePeak).filter((value): value is number => value != null).sort((a, b) => a - b);
  const medianLead = leadValues.length ? leadValues[Math.floor(leadValues.length / 2)] : null;
  const anticipationPass = auditableEpisodes.length >= 3 && anticipated.length / auditableEpisodes.length >= 0.50 && medianLead != null && medianLead >= 2;
  const sampledForecasts = forecasts.filter((_, index) => index % 20 === 0).concat(forecasts.slice(-1)).slice(-300).map(row => ({
    informationDate: row.informationDate, executionDate: row.executionDate,
    probability5d3Pct: row.probability5d3Pct, probability20d5Pct: row.probability20d5Pct, probability60d10Pct: row.probability60d10Pct,
    imminentRiskPercentilePct: row.imminentRiskPercentilePct, nearTermRiskPercentilePct: row.nearTermRiskPercentilePct, mediumTermRiskPercentilePct: row.mediumTermRiskPercentilePct,
    combinedRiskPercentilePct: row.combinedRiskPercentilePct, regime: row.regime, labels: row.labels
  }));

  return {
    version: FORWARD_RISK_FORECAST_V2,
    status: forecasts.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA',
    methodology: 'STRICT_WALK_FORWARD_PRE_CRASH_NEXT_OPEN', objective: 'PRE_CRASH_NOT_ACTIVE_CRASH',
    coreAssetId: core.assetId, coreTicker: core.ticker, startDate: input.startDate, endDate: input.endDate,
    diagnosticSeriesUsed: built.diagnosticUsed, diagnosticSeriesMissing: built.diagnosticMissing,
    featureCount: FEATURE_NAMES.length, retrainEverySessions: RETRAIN_EVERY_SESSIONS,
    minimumTrainingRows: MINIMUM_TRAINING_ROWS, maximumTrainingRows: MAXIMUM_TRAINING_ROWS,
    metrics, rankingOrientationPass, predictiveSignalPass, anticipationPass, forecastsEvaluated: forecasts.length,
    episodeAudits, featureWeights: topWeights(latestModels), sampledForecasts,
    notes: [
      'V2 no intenta reconocer una crisis activa: las filas cuyo drawdown actual supera el límite de calma de cada horizonte quedan fuera del target de entrenamiento/evaluación.',
      'Targets PRE_CRASH: caída futura >=3%/5 sesiones, >=5%/20 o >=10%/60 únicamente desde estados todavía próximos a máximos (drawdown <=1.5/2/3%).',
      'Modelo: regresión logística ponderada por desbalance de clases con regularización Elastic Net; probabilidades recalibradas al event-rate causal de entrenamiento.',
      'Features nuevas priorizan deterioro y divergencias: aceleración de volatilidad/VIX, cambios de breadth, cambios de dispersión, rotación defensiva y divergencia precio-breadth.',
      'Los tres horizontes permanecen separados. combinedRiskPercentile usa el máximo y nunca diluye una señal fuerte mediante promedio.',
      'Cada forecast sólo entrena con muestras cuyo horizonte futuro completo terminó antes de informationDate y ejecutaría, si algún día se autorizase, al siguiente open.',
      'La AUC invertida se exporta sólo como diagnóstico de orientación. V2 nunca invierte automáticamente una señal para mejorar un backtest.',
      'episodeAudits exige anticipación antes del último máximo previo al breach; detectar riesgo después del peak no cuenta como anticipación.',
      'V2 es investigación aislada: no modifica Custodia, PortfolioDecisionEngine, Telegram ni posiciones reales, y no contiene política económica de exposición.'
    ]
  };
}
