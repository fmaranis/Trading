import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';
import type { CashBenchmarkMode } from './cashBenchmark';
import { brokerCommission } from './costAwareExecutionPolicy';
import { accrueRemuneratedCashScenarioAfterTax } from './remuneratedCash';
import { STRATEGIC_GROWTH_CORE_PRIORITY } from './portfolioAssetRole';

export const FORWARD_RISK_FORECAST_V1 = 'FORWARD_RISK_FORECAST_V1' as const;

export interface ForwardRiskModelMetrics {
  horizonSessions: 5 | 20 | 60;
  drawdownThresholdPct: 3 | 5 | 10;
  observations: number;
  eventRatePct: number | null;
  auc: number | null;
  brier: number | null;
  topDecileEventRatePct: number | null;
  liftVsBaseRate: number | null;
}

export interface ForwardRiskEconomicResult {
  finalEur: number;
  returnPct: number;
  cagrPct: number | null;
  maxDrawdownPct: number;
  averageCoreExposurePct: number;
  minimumCoreExposurePct: number;
  rebalanceCount: number;
  turnoverEur: number;
  feesEur: number;
  estimatedTaxEur: number;
  cashInterestNetEur: number;
}

export interface ForwardRiskForecastAuditPoint {
  informationDate: string;
  executionDate: string;
  probability5d3Pct: number;
  probability20d5Pct: number;
  probability60d10Pct: number;
  riskPercentilePct: number;
  targetCoreExposurePct: number;
  trainingRows5d: number;
  trainingRows20d: number;
  trainingRows60d: number;
}

export interface ForwardRiskForecastResult {
  version: typeof FORWARD_RISK_FORECAST_V1;
  status: 'VALID' | 'INSUFFICIENT_DATA';
  methodology: 'STRICT_WALK_FORWARD_NEXT_OPEN';
  coreAssetId: string | null;
  coreTicker: string | null;
  startDate: string;
  endDate: string;
  trainingWarmupStartDate: string | null;
  diagnosticSeriesUsed: string[];
  diagnosticSeriesMissing: string[];
  featureCount: number;
  retrainEverySessions: number;
  minimumTrainingRows: number;
  maximumTrainingRows: number;
  modelMetrics: ForwardRiskModelMetrics[];
  benchmark: ForwardRiskEconomicResult | null;
  frictionless: ForwardRiskEconomicResult | null;
  realistic: ForwardRiskEconomicResult | null;
  excessFinalEurFrictionless: number | null;
  excessFinalEurRealistic: number | null;
  excessReturnPctPointsFrictionless: number | null;
  excessReturnPctPointsRealistic: number | null;
  economicPassFrictionless: boolean | null;
  economicPassRealistic: boolean | null;
  predictiveSignalPass: boolean | null;
  forecastsEvaluated: number;
  exposureChanges: number;
  sampledForecasts: ForwardRiskForecastAuditPoint[];
  notes: string[];
}

interface FeatureRow {
  index: number;
  date: string;
  features: number[];
  labels: [number, number, number];
  labelEndIndexes: [number, number, number];
}

interface ProbabilityModel {
  means: number[];
  stds: number[];
  weights: number[];
  calibrationA: number;
  calibrationB: number;
  trainingPredictionsSorted: number[];
  trainingRows: number;
}

interface ForecastInternal extends ForwardRiskForecastAuditPoint {
  executionIndex: number;
  targetCoreExposure: number;
  labels: [number, number, number];
  hasAllLabels: boolean;
}

const FEATURE_NAMES = [
  'coreRet5', 'coreRet20', 'coreRet60', 'coreRet120',
  'coreVol5', 'coreVol20', 'coreVol60', 'coreDownsideVol20',
  'coreDrawdown20', 'coreDrawdown60', 'coreDrawdown252',
  'coreDistanceSma20', 'coreDistanceSma50', 'coreDistanceSma200',
  'coreVolAcceleration',
  'breadthPositive20', 'breadthPositive60', 'breadthAboveSma50', 'breadthAboveSma200',
  'breadthShortMinusMedium', 'crossSectionDispersion20', 'defensiveRelative20',
  'vixLevel', 'vixReturn5', 'vixReturn20', 'vixZ60', 'vixTermRatio',
  'vixMissing', 'vix3mMissing'
] as const;

const HORIZONS = [5, 20, 60] as const;
const THRESHOLDS = [3, 5, 10] as const;
const MINIMUM_TRAINING_ROWS = 504;
const MAXIMUM_TRAINING_ROWS = 1512;
const RETRAIN_EVERY_SESSIONS = 20;
const RIDGE_LAMBDA = 8;

const DEFENSIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GOV_BONDS', 'CORP_BONDS', 'AGG_BONDS', 'MONEY_MARKET', 'GOLD', 'COMMODITIES'
]);

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN; }
function std(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}
function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const position = clamp(q, 0, 1) * (sorted.length - 1);
  const low = Math.floor(position), high = Math.ceil(position);
  if (low === high) return sorted[low];
  const fraction = position - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
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
function drawdownFromWindow(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || current <= 0) return Number.NaN;
  const start = Math.max(0, index - lookback + 1);
  const window = values.slice(start, index + 1).filter((value): value is number => value != null && value > 0);
  if (!window.length) return Number.NaN;
  const peak = Math.max(...window);
  return peak > 0 ? Math.max(0, (peak - current) / peak * 100) : Number.NaN;
}
function distanceToSma(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || current <= 0 || index + 1 < lookback) return Number.NaN;
  const window = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && value > 0);
  if (window.length < Math.floor(lookback * 0.9)) return Number.NaN;
  const avg = mean(window);
  return avg > 0 ? (current / avg - 1) * 100 : Number.NaN;
}
function zScore(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index];
  if (current == null || index + 1 < lookback) return Number.NaN;
  const window = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && Number.isFinite(value));
  if (window.length < Math.floor(lookback * 0.8)) return Number.NaN;
  const s = std(window);
  return Number.isFinite(s) && s > 1e-9 ? (current - mean(window)) / s : 0;
}
function yearsBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 86_400_000 / 365.2425 : 0;
}
function maxDrawdownPct(values: number[]): number {
  if (!values.length) return 0;
  let peak = values[0], maximum = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) maximum = Math.max(maximum, (peak - value) / peak * 100);
  }
  return maximum;
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

function chooseCoreAsset(dataset: MultiAssetDataset, startDate: string, endDate: string): MultiAssetDatasetItem | null {
  const usable = (assetId: string) => {
    const asset = dataset.assets.find(row => row.assetId === assetId);
    if (!asset) return null;
    const bars = sortedBars(asset);
    const start = bars.find(bar => isoDate(bar.timestamp) >= startDate && isoDate(bar.timestamp) <= endDate);
    const end = [...bars].reverse().find(bar => isoDate(bar.timestamp) <= endDate);
    if (!start || !end) return null;
    const startGap = (Date.parse(`${isoDate(start.timestamp)}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
    return startGap <= 7 ? asset : null;
  };
  const preferred = usable('EUNL');
  if (preferred) return preferred;
  for (const id of STRATEGIC_GROWTH_CORE_PRIORITY) {
    const asset = usable(id);
    if (asset) return asset;
  }
  return dataset.assets.find(asset => asset.assetId.toUpperCase().includes('WORLD')) ?? null;
}

function futureDrawdownLabel(values: Array<number | null>, index: number, horizon: number, thresholdPct: number): number {
  const current = values[index];
  if (current == null || current <= 0 || index + horizon >= values.length) return Number.NaN;
  const future = values.slice(index + 1, index + horizon + 1).filter((value): value is number => value != null && value > 0);
  if (future.length < Math.floor(horizon * 0.8)) return Number.NaN;
  const minimum = Math.min(...future);
  return (minimum / current - 1) * 100 <= -thresholdPct ? 1 : 0;
}

function featureRows(input: {
  dataset: MultiAssetDataset;
  diagnosticDataset?: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  core: MultiAssetDatasetItem;
}): { rows: FeatureRow[]; dates: string[]; coreBars: PriceBar[]; diagnosticUsed: string[]; diagnosticMissing: string[] } {
  const coreBars = sortedBars(input.core);
  const dates = coreBars.map(bar => isoDate(bar.timestamp));
  const coreValues = coreBars.map(bar => bar.close as number | null);
  const categoryById = new Map(input.catalog.map(asset => [asset.assetId, asset.category] as const));
  const risky = input.dataset.assets
    .filter(asset => asset.assetId !== input.core.assetId)
    .filter(asset => {
      const category = categoryById.get(asset.assetId);
      return category != null && !DEFENSIVE_CATEGORIES.has(category);
    })
    .map(asset => alignedCloses(asset, dates));
  const defensive = input.dataset.assets
    .filter(asset => {
      const category = categoryById.get(asset.assetId);
      return category != null && DEFENSIVE_CATEGORIES.has(category);
    })
    .map(asset => alignedCloses(asset, dates));

  const diagnosticMap = new Map((input.diagnosticDataset?.assets ?? []).map(asset => [asset.assetId, asset] as const));
  const vixAsset = diagnosticMap.get('DIAG_VIX') ?? null;
  const vix3mAsset = diagnosticMap.get('DIAG_VIX3M') ?? null;
  const vix = alignedCloses(vixAsset, dates);
  const vix3m = alignedCloses(vix3mAsset, dates);
  const diagnosticUsed = [vixAsset ? '^VIX' : null, vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);
  const diagnosticMissing = [!vixAsset ? '^VIX' : null, !vix3mAsset ? '^VIX3M' : null].filter((value): value is string => value != null);

  const rows: FeatureRow[] = [];
  for (let i = 252; i < dates.length; i++) {
    const riskyRet20 = risky.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    const riskyRet60 = risky.map(series => pctReturn(series, i, 60)).filter(Number.isFinite);
    const breadthPositive20 = riskyRet20.length ? riskyRet20.filter(value => value > 0).length / riskyRet20.length : Number.NaN;
    const breadthPositive60 = riskyRet60.length ? riskyRet60.filter(value => value > 0).length / riskyRet60.length : Number.NaN;
    const breadthAbove50Rows = risky.map(series => distanceToSma(series, i, 50)).filter(Number.isFinite);
    const breadthAbove200Rows = risky.map(series => distanceToSma(series, i, 200)).filter(Number.isFinite);
    const breadthAbove50 = breadthAbove50Rows.length ? breadthAbove50Rows.filter(value => value > 0).length / breadthAbove50Rows.length : Number.NaN;
    const breadthAbove200 = breadthAbove200Rows.length ? breadthAbove200Rows.filter(value => value > 0).length / breadthAbove200Rows.length : Number.NaN;
    const defensiveRet20 = defensive.map(series => pctReturn(series, i, 20)).filter(Number.isFinite);
    const defensiveRelative20 = defensiveRet20.length && riskyRet20.length ? mean(defensiveRet20) - mean(riskyRet20) : Number.NaN;
    const vixLevel = vix[i] ?? Number.NaN;
    const vix3mLevel = vix3m[i] ?? Number.NaN;
    const vol5 = realizedVol(coreValues, i, 5), vol60 = realizedVol(coreValues, i, 60);

    const features = [
      pctReturn(coreValues, i, 5), pctReturn(coreValues, i, 20), pctReturn(coreValues, i, 60), pctReturn(coreValues, i, 120),
      vol5, realizedVol(coreValues, i, 20), vol60, downsideVol(coreValues, i, 20),
      drawdownFromWindow(coreValues, i, 20), drawdownFromWindow(coreValues, i, 60), drawdownFromWindow(coreValues, i, 252),
      distanceToSma(coreValues, i, 20), distanceToSma(coreValues, i, 50), distanceToSma(coreValues, i, 200),
      Number.isFinite(vol5) && Number.isFinite(vol60) ? vol5 - vol60 : Number.NaN,
      breadthPositive20, breadthPositive60, breadthAbove50, breadthAbove200,
      Number.isFinite(breadthPositive20) && Number.isFinite(breadthPositive60) ? breadthPositive20 - breadthPositive60 : Number.NaN,
      riskyRet20.length >= 3 ? std(riskyRet20) : Number.NaN,
      defensiveRelative20,
      vixLevel,
      pctReturn(vix, i, 5), pctReturn(vix, i, 20), zScore(vix, i, 60),
      Number.isFinite(vixLevel) && Number.isFinite(vix3mLevel) && vix3mLevel > 0 ? vixLevel / vix3mLevel : Number.NaN,
      Number.isFinite(vixLevel) ? 0 : 1,
      Number.isFinite(vix3mLevel) ? 0 : 1
    ];

    const labels = HORIZONS.map((horizon, idx) => futureDrawdownLabel(coreValues, i, horizon, THRESHOLDS[idx])) as [number, number, number];
    rows.push({ index: i, date: dates[i], features, labels, labelEndIndexes: [i + 5, i + 20, i + 60] });
  }
  return { rows, dates, coreBars, diagnosticUsed, diagnosticMissing };
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    if (Math.abs(augmented[pivot][col]) < 1e-10) return null;
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let j = col; j <= n; j++) augmented[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let j = col; j <= n; j++) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  return augmented.map(row => row[n]);
}

function fitProbabilityModel(trainingRows: FeatureRow[], labelIndex: 0 | 1 | 2): ProbabilityModel | null {
  const usable = trainingRows.filter(row => Number.isFinite(row.labels[labelIndex]));
  if (usable.length < MINIMUM_TRAINING_ROWS) return null;
  const featureCount = FEATURE_NAMES.length;
  const means = Array(featureCount).fill(0);
  const stds = Array(featureCount).fill(1);

  for (let column = 0; column < featureCount; column++) {
    const finite = usable.map(row => row.features[column]).filter(Number.isFinite);
    means[column] = finite.length ? mean(finite) : 0;
    const s = finite.length > 1 ? std(finite) : 1;
    stds[column] = Number.isFinite(s) && s > 1e-8 ? s : 1;
  }

  const size = featureCount + 1;
  const xtx = Array.from({ length: size }, () => Array(size).fill(0));
  const xty = Array(size).fill(0);
  const standardized: number[][] = [];
  for (const row of usable) {
    const x = [1, ...row.features.map((value, column) => Number.isFinite(value) ? (value - means[column]) / stds[column] : 0)];
    standardized.push(x);
    const y = row.labels[labelIndex];
    for (let a = 0; a < size; a++) {
      xty[a] += x[a] * y;
      for (let b = 0; b <= a; b++) xtx[a][b] += x[a] * x[b];
    }
  }
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < a; b++) xtx[b][a] = xtx[a][b];
    if (a > 0) xtx[a][a] += RIDGE_LAMBDA;
  }
  const weights = solveLinearSystem(xtx, xty);
  if (!weights) return null;
  const rawScores = standardized.map(x => x.reduce((sum, value, index) => sum + value * weights[index], 0));
  const eventRate = clamp(mean(usable.map(row => row.labels[labelIndex])), 0.01, 0.99);
  let calibrationA = 1;
  let calibrationB = Math.log(eventRate / (1 - eventRate)) - mean(rawScores);
  for (let iteration = 0; iteration < 80; iteration++) {
    let gradA = 0, gradB = 0;
    for (let i = 0; i < rawScores.length; i++) {
      const z = clamp(calibrationA * rawScores[i] + calibrationB, -30, 30);
      const p = 1 / (1 + Math.exp(-z));
      const error = p - usable[i].labels[labelIndex];
      gradA += error * rawScores[i];
      gradB += error;
    }
    const scale = 0.08 / rawScores.length;
    calibrationA -= scale * gradA;
    calibrationB -= scale * gradB;
  }
  const trainingPredictionsSorted = rawScores
    .map(raw => 1 / (1 + Math.exp(-clamp(calibrationA * raw + calibrationB, -30, 30))))
    .sort((a, b) => a - b);
  return { means, stds, weights, calibrationA, calibrationB, trainingPredictionsSorted, trainingRows: usable.length };
}

function predict(model: ProbabilityModel, features: number[]): number {
  const x = [1, ...features.map((value, column) => Number.isFinite(value) ? (value - model.means[column]) / model.stds[column] : 0)];
  const raw = x.reduce((sum, value, index) => sum + value * model.weights[index], 0);
  return 1 / (1 + Math.exp(-clamp(model.calibrationA * raw + model.calibrationB, -30, 30)));
}

function auc(labels: number[], predictions: number[]): number | null {
  const pairs = labels.map((label, index) => ({ label, prediction: predictions[index] })).filter(row => Number.isFinite(row.label) && Number.isFinite(row.prediction)).sort((a, b) => a.prediction - b.prediction);
  const positives = pairs.filter(row => row.label === 1).length;
  const negatives = pairs.length - positives;
  if (!positives || !negatives) return null;
  let rankSum = 0;
  let index = 0;
  while (index < pairs.length) {
    let end = index + 1;
    while (end < pairs.length && Math.abs(pairs[end].prediction - pairs[index].prediction) < 1e-12) end++;
    const averageRank = (index + 1 + end) / 2;
    for (let j = index; j < end; j++) if (pairs[j].label === 1) rankSum += averageRank;
    index = end;
  }
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

function modelMetrics(horizonIndex: 0 | 1 | 2, forecasts: Array<{ probability: number; label: number }>): ForwardRiskModelMetrics {
  const usable = forecasts.filter(row => Number.isFinite(row.label));
  const labels = usable.map(row => row.label), predictions = usable.map(row => row.probability);
  const eventRate = usable.length ? mean(labels) : Number.NaN;
  const brier = usable.length ? mean(usable.map(row => (row.probability - row.label) ** 2)) : Number.NaN;
  const sorted = [...usable].sort((a, b) => b.probability - a.probability);
  const topCount = Math.max(1, Math.floor(sorted.length * 0.10));
  const topRate = sorted.length ? mean(sorted.slice(0, topCount).map(row => row.label)) : Number.NaN;
  return {
    horizonSessions: HORIZONS[horizonIndex],
    drawdownThresholdPct: THRESHOLDS[horizonIndex],
    observations: usable.length,
    eventRatePct: Number.isFinite(eventRate) ? eventRate * 100 : null,
    auc: auc(labels, predictions),
    brier: Number.isFinite(brier) ? brier : null,
    topDecileEventRatePct: Number.isFinite(topRate) ? topRate * 100 : null,
    liftVsBaseRate: Number.isFinite(topRate) && Number.isFinite(eventRate) && eventRate > 0 ? topRate / eventRate : null
  };
}

function buildForecasts(rows: FeatureRow[], startDate: string, endDate: string, coreBarsLength: number): ForecastInternal[] {
  const forecasts: ForecastInternal[] = [];
  let models: [ProbabilityModel | null, ProbabilityModel | null, ProbabilityModel | null] = [null, null, null];
  let lastRetrainCoreIndex = -Infinity;
  let currentExposure = 1;
  let lowRiskStreak = 0;

  for (const row of rows) {
    if (row.date < startDate || row.date >= endDate || row.index + 1 >= coreBarsLength) continue;
    if (row.index - lastRetrainCoreIndex >= RETRAIN_EVERY_SESSIONS || models.some(model => model == null)) {
      const trainingFor = (labelIndex: 0 | 1 | 2) => rows
        .filter(candidate => candidate.index < row.index && candidate.labelEndIndexes[labelIndex] < row.index && Number.isFinite(candidate.labels[labelIndex]))
        .slice(-MAXIMUM_TRAINING_ROWS);
      models = [fitProbabilityModel(trainingFor(0), 0), fitProbabilityModel(trainingFor(1), 1), fitProbabilityModel(trainingFor(2), 2)];
      lastRetrainCoreIndex = row.index;
    }
    if (models.some(model => model == null)) continue;
    const typedModels = models as [ProbabilityModel, ProbabilityModel, ProbabilityModel];
    const probabilities = typedModels.map(model => predict(model, row.features)) as [number, number, number];
    const percentiles = typedModels.map((model, index) => percentileRank(model.trainingPredictionsSorted, probabilities[index]));
    const riskPercentile = mean(percentiles);
    let desiredExposure = riskPercentile >= 0.95 ? 0.70 : riskPercentile >= 0.85 ? 0.80 : riskPercentile >= 0.70 ? 0.90 : 1.00;

    if (desiredExposure < currentExposure) {
      currentExposure = desiredExposure;
      lowRiskStreak = 0;
    } else if (desiredExposure > currentExposure) {
      if (riskPercentile < 0.65) lowRiskStreak += 1; else lowRiskStreak = 0;
      if (lowRiskStreak >= 5) {
        currentExposure = Math.min(desiredExposure, currentExposure + 0.10);
        lowRiskStreak = 0;
      }
    } else {
      lowRiskStreak = riskPercentile < 0.65 ? lowRiskStreak + 1 : 0;
    }

    forecasts.push({
      informationDate: row.date,
      executionDate: '',
      executionIndex: row.index + 1,
      probability5d3Pct: probabilities[0] * 100,
      probability20d5Pct: probabilities[1] * 100,
      probability60d10Pct: probabilities[2] * 100,
      riskPercentilePct: riskPercentile * 100,
      targetCoreExposurePct: currentExposure * 100,
      targetCoreExposure: currentExposure,
      trainingRows5d: typedModels[0].trainingRows,
      trainingRows20d: typedModels[1].trainingRows,
      trainingRows60d: typedModels[2].trainingRows,
      labels: row.labels,
      hasAllLabels: row.labels.every(Number.isFinite)
    });
  }
  return forecasts;
}

function economicResult(input: {
  coreBars: PriceBar[];
  forecasts: ForecastInternal[];
  startDate: string;
  endDate: string;
  initialCapitalEur: number;
  cashBenchmarkMode: CashBenchmarkMode;
  cashBenchmarkAnnualPct: number;
  realistic: boolean;
  benchmarkOnly?: boolean;
}): ForwardRiskEconomicResult | null {
  const bars = input.coreBars;
  const startIndex = bars.findIndex(bar => isoDate(bar.timestamp) >= input.startDate && isoDate(bar.timestamp) <= input.endDate);
  let endIndex = -1;
  for (let i = bars.length - 1; i >= 0; i--) if (isoDate(bars[i].timestamp) <= input.endDate) { endIndex = i; break; }
  if (startIndex < 0 || endIndex <= startIndex) return null;

  const initialOpen = bars[startIndex].open;
  if (!(initialOpen > 0)) return null;
  let cash = 0;
  let units = input.realistic ? Math.floor(input.initialCapitalEur / initialOpen) : input.initialCapitalEur / initialOpen;
  let basis = units * initialOpen;
  let fees = 0;
  if (input.realistic) {
    const fee = brokerCommission(basis);
    while (units > 0 && units * initialOpen + brokerCommission(units * initialOpen) > input.initialCapitalEur) units--;
    const notional = units * initialOpen;
    const actualFee = units > 0 ? brokerCommission(notional) : 0;
    basis = notional + actualFee;
    cash = input.initialCapitalEur - basis;
    fees += actualFee;
  }
  let tax = 0, turnover = basis, rebalances = input.realistic ? 1 : 0, cashInterestNet = 0;
  let previousDate = isoDate(bars[startIndex].timestamp);
  let currentExposure = 1;
  let minimumExposure = 1;
  let exposureAccumulator = 0;
  let exposureObservations = 0;
  const equityPath: number[] = [];
  const targetByIndex = new Map<number, number>();
  if (!input.benchmarkOnly) for (const forecast of input.forecasts) targetByIndex.set(forecast.executionIndex, forecast.targetCoreExposure);

  for (let i = startIndex; i <= endIndex; i++) {
    const bar = bars[i];
    const date = isoDate(bar.timestamp);
    if (date > previousDate && cash > 0) {
      const accrued = accrueRemuneratedCashScenarioAfterTax({
        cashEur: cash,
        mode: input.cashBenchmarkMode,
        fixedAnnualPct: input.cashBenchmarkAnnualPct,
        fromDate: previousDate,
        toDate: date,
        taxOnInterest: gross => gross * 0.19
      });
      cash = accrued.cashEur;
      cashInterestNet += accrued.netInterestEur;
    }

    const nextTarget = input.benchmarkOnly ? 1 : targetByIndex.get(i);
    if (nextTarget != null && Math.abs(nextTarget - currentExposure) > 1e-9 && bar.open > 0) {
      const equityAtOpen = cash + units * bar.open;
      const targetValue = equityAtOpen * nextTarget;
      if (!input.realistic) {
        units = targetValue / bar.open;
        cash = Math.max(0, equityAtOpen - targetValue);
        turnover += Math.abs(targetValue - (equityAtOpen - cash));
      } else {
        const targetUnits = Math.max(0, Math.floor(targetValue / bar.open + 1e-9));
        if (targetUnits < units) {
          const sellUnits = units - targetUnits;
          const gross = sellUnits * bar.open;
          const fee = brokerCommission(gross);
          const basisSold = units > 0 ? basis * (sellUnits / units) : 0;
          const realizedGain = gross - fee - basisSold;
          const estimatedTax = Math.max(0, realizedGain) * 0.30;
          cash += Math.max(0, gross - fee - estimatedTax);
          units -= sellUnits;
          basis = Math.max(0, basis - basisSold);
          fees += fee; tax += estimatedTax; turnover += gross; rebalances += 1;
        } else if (targetUnits > units) {
          let buyUnits = targetUnits - units;
          while (buyUnits > 0) {
            const notional = buyUnits * bar.open;
            const fee = brokerCommission(notional);
            if (notional + fee <= cash + 1e-9) break;
            buyUnits--;
          }
          if (buyUnits > 0) {
            const notional = buyUnits * bar.open;
            const fee = brokerCommission(notional);
            cash -= notional + fee;
            units += buyUnits;
            basis += notional + fee;
            fees += fee; turnover += notional; rebalances += 1;
          }
        }
      }
      currentExposure = nextTarget;
    }

    minimumExposure = Math.min(minimumExposure, currentExposure);
    exposureAccumulator += currentExposure;
    exposureObservations += 1;
    equityPath.push(cash + units * bar.close);
    previousDate = date;
  }

  const finalEur = equityPath.at(-1) ?? input.initialCapitalEur;
  const startDateActual = isoDate(bars[startIndex].timestamp), endDateActual = isoDate(bars[endIndex].timestamp);
  const years = yearsBetween(startDateActual, endDateActual);
  return {
    finalEur,
    returnPct: (finalEur / input.initialCapitalEur - 1) * 100,
    cagrPct: years > 0 ? (Math.pow(finalEur / input.initialCapitalEur, 1 / years) - 1) * 100 : null,
    maxDrawdownPct: maxDrawdownPct(equityPath),
    averageCoreExposurePct: exposureObservations ? exposureAccumulator / exposureObservations * 100 : 100,
    minimumCoreExposurePct: minimumExposure * 100,
    rebalanceCount: rebalances,
    turnoverEur: turnover,
    feesEur: fees,
    estimatedTaxEur: tax,
    cashInterestNetEur: cashInterestNet
  };
}

/**
 * Independent research experiment. It never changes PortfolioDecisionEngine and
 * never feeds a live recommendation. Each forecast is trained only on samples
 * whose complete future label window had already elapsed before informationDate;
 * portfolio changes execute at the next core open.
 */
export function runForwardRiskForecastV1(input: {
  dataset: MultiAssetDataset;
  diagnosticDataset?: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  startDate: string;
  endDate: string;
  initialCapitalEur: number;
  cashBenchmarkMode: CashBenchmarkMode;
  cashBenchmarkAnnualPct: number;
}): ForwardRiskForecastResult {
  const core = chooseCoreAsset(input.dataset, input.startDate, input.endDate);
  if (!core) {
    return {
      version: FORWARD_RISK_FORECAST_V1, status: 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_NEXT_OPEN',
      coreAssetId: null, coreTicker: null, startDate: input.startDate, endDate: input.endDate, trainingWarmupStartDate: null,
      diagnosticSeriesUsed: [], diagnosticSeriesMissing: ['^VIX', '^VIX3M'], featureCount: FEATURE_NAMES.length,
      retrainEverySessions: RETRAIN_EVERY_SESSIONS, minimumTrainingRows: MINIMUM_TRAINING_ROWS, maximumTrainingRows: MAXIMUM_TRAINING_ROWS,
      modelMetrics: [], benchmark: null, frictionless: null, realistic: null,
      excessFinalEurFrictionless: null, excessFinalEurRealistic: null, excessReturnPctPointsFrictionless: null, excessReturnPctPointsRealistic: null,
      economicPassFrictionless: null, economicPassRealistic: null, predictiveSignalPass: null, forecastsEvaluated: 0, exposureChanges: 0, sampledForecasts: [],
      notes: ['No existe un core global con cobertura suficiente para ejecutar el experimento predictivo.']
    };
  }

  const built = featureRows({ dataset: input.dataset, diagnosticDataset: input.diagnosticDataset, catalog: input.catalog, core });
  const forecasts = buildForecasts(built.rows, input.startDate, input.endDate, built.coreBars.length);
  for (const forecast of forecasts) forecast.executionDate = built.coreBars[forecast.executionIndex] ? isoDate(built.coreBars[forecast.executionIndex].timestamp) : '';
  const metricInputs = [0, 1, 2].map(labelIndex => forecasts.filter(row => row.hasAllLabels).map(row => ({ probability: [row.probability5d3Pct, row.probability20d5Pct, row.probability60d10Pct][labelIndex] / 100, label: row.labels[labelIndex] })));
  const metrics = [modelMetrics(0, metricInputs[0]), modelMetrics(1, metricInputs[1]), modelMetrics(2, metricInputs[2])];

  const benchmark = economicResult({ ...input, coreBars: built.coreBars, forecasts, realistic: false, benchmarkOnly: true });
  const frictionless = economicResult({ ...input, coreBars: built.coreBars, forecasts, realistic: false });
  const realistic = economicResult({ ...input, coreBars: built.coreBars, forecasts, realistic: true });
  const excessFinalEurFrictionless = benchmark && frictionless ? frictionless.finalEur - benchmark.finalEur : null;
  const excessFinalEurRealistic = benchmark && realistic ? realistic.finalEur - benchmark.finalEur : null;
  const excessReturnPctPointsFrictionless = benchmark && frictionless ? frictionless.returnPct - benchmark.returnPct : null;
  const excessReturnPctPointsRealistic = benchmark && realistic ? realistic.returnPct - benchmark.returnPct : null;
  const validAucs = metrics.map(metric => metric.auc).filter((value): value is number => value != null);
  const predictiveSignalPass = validAucs.length === 3 && validAucs.every(value => value > 0.52) && mean(validAucs) > 0.55;
  const economicPassFrictionless = benchmark && frictionless ? frictionless.finalEur > benchmark.finalEur && frictionless.maxDrawdownPct < benchmark.maxDrawdownPct : null;
  const economicPassRealistic = benchmark && realistic ? realistic.finalEur > benchmark.finalEur && realistic.maxDrawdownPct <= benchmark.maxDrawdownPct + 0.5 : null;
  let exposureChanges = 0;
  for (let i = 1; i < forecasts.length; i++) if (Math.abs(forecasts[i].targetCoreExposurePct - forecasts[i - 1].targetCoreExposurePct) > 1e-9) exposureChanges++;
  const sampledForecasts = forecasts.filter((row, index) => index % 20 === 0 || index === forecasts.length - 1 || (index > 0 && row.targetCoreExposurePct !== forecasts[index - 1].targetCoreExposurePct)).slice(-300);

  return {
    version: FORWARD_RISK_FORECAST_V1,
    status: forecasts.length >= 60 && benchmark != null ? 'VALID' : 'INSUFFICIENT_DATA',
    methodology: 'STRICT_WALK_FORWARD_NEXT_OPEN',
    coreAssetId: core.assetId,
    coreTicker: core.ticker,
    startDate: input.startDate,
    endDate: input.endDate,
    trainingWarmupStartDate: built.rows[0]?.date ?? null,
    diagnosticSeriesUsed: built.diagnosticUsed,
    diagnosticSeriesMissing: built.diagnosticMissing,
    featureCount: FEATURE_NAMES.length,
    retrainEverySessions: RETRAIN_EVERY_SESSIONS,
    minimumTrainingRows: MINIMUM_TRAINING_ROWS,
    maximumTrainingRows: MAXIMUM_TRAINING_ROWS,
    modelMetrics: metrics,
    benchmark,
    frictionless,
    realistic,
    excessFinalEurFrictionless,
    excessFinalEurRealistic,
    excessReturnPctPointsFrictionless,
    excessReturnPctPointsRealistic,
    economicPassFrictionless,
    economicPassRealistic,
    predictiveSignalPass,
    forecastsEvaluated: forecasts.length,
    exposureChanges,
    sampledForecasts,
    notes: [
      'Objetivo predictivo: probabilidad de drawdown >=3%/5 sesiones, >=5%/20 sesiones y >=10%/60 sesiones.',
      'Cada modelo usa ridge sobre features estandarizadas y calibración probabilística; reentrena cada 20 sesiones con una ventana causal móvil de hasta 1512 observaciones.',
      'Una muestra sólo entra en entrenamiento cuando su horizonte futuro completo ya terminó antes de la fecha de forecast. No hay K-fold aleatorio ni etiquetas solapadas con el presente.',
      'Las reducciones se basan en percentiles de riesgo calculados únicamente sobre las predicciones del conjunto de entrenamiento de esa fecha: 100/90/80/70% de core en percentiles <70/<85/<95/>=95.',
      'El riesgo puede reducir exposición de inmediato; la vuelta al mercado se limita a +10 pp tras cinco sesiones consecutivas por debajo del percentil 65 para evitar whipsaw.',
      'Toda señal usa cierre disponible y se ejecuta al siguiente open del core. VIX/VIX3M son diagnósticos no invertibles y nunca entran en el universo de órdenes.',
      'La variante frictionless es un límite superior. La variante realistic usa acciones enteras, comisión del broker, 30% conservador sobre plusvalías realizadas y 19% sobre intereses de cash; no compensa minusvalías, por lo que sesga en contra del predictor.',
      'FORWARD_RISK_FORECAST_V1 es investigación aislada: no modifica Custodia, Telegram, PortfolioDecisionEngine ni la cartera real.'
    ]
  };
}
