import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';
import { STRATEGIC_GROWTH_CORE_PRIORITY } from './portfolioAssetRole';
import { runForwardRiskForecastV3, type ForwardRiskV3Metric, type ForwardRiskV3EpisodeAudit } from './forwardRiskForecastV3';

export const FORWARD_RISK_FORECAST_V31 = 'FORWARD_RISK_FORECAST_V3_1' as const;

const HORIZONS = [20, 60] as const;
const THRESHOLDS = [5, 10] as const;
const CALM_LIMITS = [2, 3] as const;
const MINIMUM_TRAINING_ROWS = 504;
const MAXIMUM_TRAINING_ROWS = 1512;
const RETRAIN_EVERY_SESSIONS = 20;
const HIGH_RISK_PERCENTILE = 0.80;
const ITERATIONS = 420;
const LEARNING_RATE = 0.04;
const INNER_VALIDATION_FRACTION = 0.20;
const REGULARIZATION_MULTIPLIERS = [0.5, 1, 2, 4] as const;

const DEFENSIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GOV_BONDS', 'CORP_BONDS', 'AGG_BONDS', 'MONEY_MARKET', 'GOLD', 'COMMODITIES'
]);

const FEATURES_20 = [
  'momentumLossPersistent',
  'breadth50DeclinePersistent',
  'breadth20DeclinePersistent',
  'dispersionWidenPersistent',
  'defensiveRotationPersistent',
  'vixRisePersistent',
  'vixTermDeteriorationPersistent',
  'sma50DeteriorationPersistent',
  'priceBreadthDivergencePersistent',
  'multiSignalPersistence'
] as const;

const FEATURES_60 = [
  'nearHigh252',
  'longMomentumPositiveButDecelerating',
  'breadth200WeakUnderStrongIndex',
  'breadth200SlowDeterioration',
  'breadth50SlowDeterioration',
  'dispersionSlowWidening',
  'defensiveRotationSlow',
  'lowVixBreadthFragility',
  'contangoCompressionCalm',
  'silentDivergence',
  'concentrationFragility'
] as const;

type Feature20 = typeof FEATURES_20[number];
type Feature60 = typeof FEATURES_60[number];
type FeatureName = Feature20 | Feature60;

type HorizonMetric = ForwardRiskV3Metric;

export interface ForwardRiskV31ModelDiagnostic {
  horizonSessions: 20 | 60;
  featureCount: number;
  trainingRows: number;
  regularizationMultiplier: number | null;
  innerValidationAuc: number | null;
  innerValidationOrientation: 'DIRECT' | 'INVERTED' | 'UNRESOLVED';
}

export interface ForwardRiskV31FeatureWeight {
  feature: string;
  coefficient: number;
  absCoefficient: number;
}

export interface ForwardRiskV31AuditPoint {
  informationDate: string;
  executionDate: string;
  probability20d5Pct: number;
  probability60d10Pct: number;
  nearTermRiskPercentilePct: number;
  mediumTermRiskPercentilePct: number;
  combinedRiskPercentilePct: number;
  labels: [number | null, number | null];
}

export interface ForwardRiskForecastV31Result {
  version: typeof FORWARD_RISK_FORECAST_V31;
  status: 'VALID' | 'INSUFFICIENT_DATA';
  methodology: 'STRICT_WALK_FORWARD_V3_5D_FROZEN_PERSISTENCE_20D_SILENT_FRAGILITY_60D';
  objective: 'PRE_CRASH_PERSISTENCE_AND_SILENT_FRAGILITY';
  coreAssetId: string | null;
  coreTicker: string | null;
  startDate: string;
  endDate: string;
  fiveDayFrozenFromV3: true;
  diagnosticSeriesUsed: string[];
  diagnosticSeriesMissing: string[];
  metrics: HorizonMetric[];
  predictiveSignalPass: boolean | null;
  anticipationPass: boolean | null;
  anticipatedEpisodeRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  forecastsEvaluated: number;
  modelDiagnostics: ForwardRiskV31ModelDiagnostic[];
  episodeAudits: ForwardRiskV3EpisodeAudit[];
  featureWeights: Array<{ horizonSessions: 20 | 60; top: ForwardRiskV31FeatureWeight[] }>;
  sampledForecasts: ForwardRiskV31AuditPoint[];
  notes: string[];
}

interface FeatureRow {
  index: number;
  date: string;
  f20: Record<Feature20, number>;
  f60: Record<Feature60, number>;
  labels: [number, number];
  labelEndIndexes: [number, number];
}

interface Model {
  names: readonly FeatureName[];
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

interface Forecast {
  index: number;
  informationDate: string;
  executionDate: string;
  probabilities: [number, number];
  percentiles: [number, number];
  labels: [number, number];
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function positive(value: number): number { return Number.isFinite(value) ? Math.max(0, value) : Number.NaN; }
function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN; }
function std(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}
function sigmoid(value: number): number { return 1 / (1 + Math.exp(-clamp(value, -30, 30))); }
function sortedBars(asset: MultiAssetDatasetItem): PriceBar[] {
  return [...asset.bars].filter(b => b.close > 0 && b.open > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
}
function alignedCloses(asset: MultiAssetDatasetItem | null, dates: string[], maxStalenessDays = 5): Array<number | null> {
  if (!asset) return dates.map(() => null);
  const bars = sortedBars(asset); const out: Array<number | null> = []; let cursor = 0; let latest: PriceBar | null = null;
  for (const date of dates) {
    while (cursor < bars.length && isoDate(bars[cursor].timestamp) <= date) latest = bars[cursor++];
    if (!latest) { out.push(null); continue; }
    const gap = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${isoDate(latest.timestamp)}T00:00:00Z`)) / 86_400_000;
    out.push(gap <= maxStalenessDays ? latest.close : null);
  }
  return out;
}
function pctReturn(values: Array<number | null>, index: number, lookback: number): number {
  const a = values[index - lookback], b = values[index];
  return a != null && b != null && a > 0 && b > 0 ? (b / a - 1) * 100 : Number.NaN;
}
function distanceToSma(values: Array<number | null>, index: number, lookback: number): number {
  if (index + 1 < lookback) return Number.NaN;
  const current = values[index]; if (current == null || current <= 0) return Number.NaN;
  const finite = values.slice(index - lookback + 1, index + 1).filter((v): v is number => v != null && v > 0);
  if (finite.length < Math.floor(lookback * 0.9)) return Number.NaN;
  return (current / mean(finite) - 1) * 100;
}
function drawdown(values: Array<number | null>, index: number, lookback: number): number {
  const current = values[index]; if (current == null || current <= 0) return Number.NaN;
  const finite = values.slice(Math.max(0, index - lookback + 1), index + 1).filter((v): v is number => v != null && v > 0);
  if (!finite.length) return Number.NaN;
  return Math.max(0, (Math.max(...finite) - current) / Math.max(...finite) * 100);
}
function slopeDeterioration(values: number[], index: number, lag: number): number {
  const now = values[index], p1 = values[index - lag], p2 = values[index - lag * 2];
  if (![now, p1, p2].every(Number.isFinite)) return Number.NaN;
  return positive(((p2 - p1) + (p1 - now)) / 2);
}
function persistence(values: number[], index: number, lag: number): number {
  const now = values[index], p1 = values[index - lag], p2 = values[index - lag * 2], p3 = values[index - lag * 3];
  if (![now, p1, p2, p3].every(Number.isFinite)) return Number.NaN;
  return [p3 > p2, p2 > p1, p1 > now].filter(Boolean).length / 3;
}
function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] <= value) lo = mid + 1; else hi = mid; }
  return lo / sorted.length;
}
function chooseCore(dataset: MultiAssetDataset, startDate: string, endDate: string): MultiAssetDatasetItem | null {
  const usable = (id: string) => {
    const asset = dataset.assets.find(a => a.assetId === id); if (!asset) return null;
    const bars = sortedBars(asset); const start = bars.find(b => isoDate(b.timestamp) >= startDate && isoDate(b.timestamp) <= endDate);
    if (!start) return null;
    const gap = (Date.parse(`${isoDate(start.timestamp)}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
    return gap <= 7 ? asset : null;
  };
  return usable('EUNL') ?? STRATEGIC_GROWTH_CORE_PRIORITY.map(usable).find(Boolean) ?? dataset.assets.find(a => a.assetId.toUpperCase().includes('WORLD')) ?? null;
}
function futureLabel(values: Array<number | null>, index: number, horizon: number, threshold: number, calmLimit: number): number {
  const current = values[index]; if (current == null || current <= 0 || index + horizon >= values.length) return Number.NaN;
  if (drawdown(values, index, 252) > calmLimit) return Number.NaN;
  const future = values.slice(index + 1, index + horizon + 1).filter((v): v is number => v != null && v > 0);
  if (future.length < Math.floor(horizon * 0.8)) return Number.NaN;
  return (Math.min(...future) / current - 1) * 100 <= -threshold ? 1 : 0;
}
function auc(labels: number[], scores: number[]): number | null {
  const pairs = labels.map((label, i) => ({ label, score: scores[i] })).filter(r => Number.isFinite(r.label) && Number.isFinite(r.score)).sort((a, b) => a.score - b.score);
  const p = pairs.filter(r => r.label === 1).length, n = pairs.length - p; if (!p || !n) return null;
  let rankSum = 0, i = 0;
  while (i < pairs.length) {
    let j = i + 1; while (j < pairs.length && Math.abs(pairs[j].score - pairs[i].score) < 1e-12) j++;
    const rank = (i + 1 + j) / 2; for (let k = i; k < j; k++) if (pairs[k].label === 1) rankSum += rank; i = j;
  }
  return (rankSum - p * (p + 1) / 2) / (p * n);
}

function buildRows(input: { dataset: MultiAssetDataset; diagnosticDataset?: MultiAssetDataset; catalog: AssetUniverseItem[]; core: MultiAssetDatasetItem }) {
  const coreBars = sortedBars(input.core); const dates = coreBars.map(b => isoDate(b.timestamp)); const core = coreBars.map(b => b.close as number | null);
  const category = new Map(input.catalog.map(a => [a.assetId, a.category] as const));
  const risky = input.dataset.assets.filter(a => a.assetId !== input.core.assetId && category.get(a.assetId) && !DEFENSIVE_CATEGORIES.has(category.get(a.assetId)!)).map(a => alignedCloses(a, dates));
  const defensive = input.dataset.assets.filter(a => category.get(a.assetId) && DEFENSIVE_CATEGORIES.has(category.get(a.assetId)!)).map(a => alignedCloses(a, dates));
  const diag = new Map((input.diagnosticDataset?.assets ?? []).map(a => [a.assetId, a] as const));
  const vixAsset = diag.get('DIAG_VIX') ?? null, vix3mAsset = diag.get('DIAG_VIX3M') ?? null;
  const vix = alignedCloses(vixAsset, dates), vix3m = alignedCloses(vix3mAsset, dates);
  const diagnosticSeriesUsed = [vixAsset ? '^VIX' : null, vix3mAsset ? '^VIX3M' : null].filter((v): v is string => v != null);
  const diagnosticSeriesMissing = [!vixAsset ? '^VIX' : null, !vix3mAsset ? '^VIX3M' : null].filter((v): v is string => v != null);

  const breadth20 = Array(dates.length).fill(Number.NaN), breadth50 = Array(dates.length).fill(Number.NaN), breadth200 = Array(dates.length).fill(Number.NaN);
  const dispersion20 = Array(dates.length).fill(Number.NaN), defensiveRel20 = Array(dates.length).fill(Number.NaN), term = Array(dates.length).fill(Number.NaN);
  for (let i = 252; i < dates.length; i++) {
    const r20 = risky.map(s => pctReturn(s, i, 20)).filter(Number.isFinite);
    const a50 = risky.map(s => distanceToSma(s, i, 50)).filter(Number.isFinite);
    const a200 = risky.map(s => distanceToSma(s, i, 200)).filter(Number.isFinite);
    const d20 = defensive.map(s => pctReturn(s, i, 20)).filter(Number.isFinite);
    breadth20[i] = r20.length ? r20.filter(v => v > 0).length / r20.length : Number.NaN;
    breadth50[i] = a50.length ? a50.filter(v => v > 0).length / a50.length : Number.NaN;
    breadth200[i] = a200.length ? a200.filter(v => v > 0).length / a200.length : Number.NaN;
    dispersion20[i] = r20.length >= 3 ? std(r20) : Number.NaN;
    defensiveRel20[i] = d20.length && r20.length ? mean(d20) - mean(r20) : Number.NaN;
    term[i] = vix[i] != null && vix3m[i] != null && vix3m[i]! > 0 ? vix[i]! / vix3m[i]! : Number.NaN;
  }

  const rows: FeatureRow[] = [];
  for (let i = 312; i < dates.length; i++) {
    const ret20 = pctReturn(core, i, 20), ret60 = pctReturn(core, i, 60), sma50 = distanceToSma(core, i, 50);
    const dd252 = drawdown(core, i, 252), vixLevel = vix[i] ?? Number.NaN;
    const momentumLossPersistent = positive(pctReturn(core, i - 20, 20) - ret20) * persistence(Array.from({length: dates.length}, (_, k) => pctReturn(core, k, 20)), i, 5);
    const breadth50DeclinePersistent = slopeDeterioration(breadth50, i, 5) * persistence(breadth50, i, 5);
    const breadth20DeclinePersistent = slopeDeterioration(breadth20, i, 5) * persistence(breadth20, i, 5);
    const dispersionWidenPersistent = positive(dispersion20[i] - dispersion20[i - 10]) * Math.max(0.25, persistence(dispersion20.map(v => -v), i, 5));
    const defensiveRotationPersistent = positive(defensiveRel20[i]) * positive(defensiveRel20[i] - defensiveRel20[i - 10]);
    const vixRisePersistent = positive(pctReturn(vix, i, 10)) * positive(pctReturn(vix, i - 5, 10) + 5) / 5;
    const vixTermDeteriorationPersistent = positive(term[i] - term[i - 10]) * Math.max(0.25, persistence(term.map(v => -v), i, 5));
    const sma50DeteriorationPersistent = positive(distanceToSma(core, i - 10, 50) - sma50);
    const priceBreadthDivergencePersistent = positive(ret20) * positive(breadth20[i - 10] - breadth20[i]);
    const persistenceSignals = [breadth50DeclinePersistent, breadth20DeclinePersistent, defensiveRotationPersistent, vixTermDeteriorationPersistent, sma50DeteriorationPersistent].filter(v => Number.isFinite(v) && v > 0).length / 5;

    const nearHigh252 = Number.isFinite(dd252) ? clamp(1 - dd252 / 6, 0, 1) : Number.NaN;
    const longMomentumPositiveButDecelerating = positive(ret60) * positive(pctReturn(core, i - 20, 60) - ret60);
    const breadth200WeakUnderStrongIndex = positive(ret60) * positive(0.65 - breadth200[i]);
    const breadth200SlowDeterioration = positive(breadth200[i - 40] - breadth200[i]);
    const breadth50SlowDeterioration = positive(breadth50[i - 30] - breadth50[i]);
    const dispersionSlowWidening = positive(dispersion20[i] - dispersion20[i - 30]);
    const defensiveRotationSlow = positive(defensiveRel20[i] - defensiveRel20[i - 20]);
    const lowVix = Number.isFinite(vixLevel) ? clamp((22 - vixLevel) / 10, 0, 1) : 0;
    const lowVixBreadthFragility = nearHigh252 * lowVix * positive(0.70 - breadth200[i]);
    const contangoCompressionCalm = nearHigh252 * lowVix * positive(term[i] - term[i - 20]);
    const silentDivergence = nearHigh252 * positive(ret60) * positive(breadth200[i - 20] - breadth200[i]);
    const concentrationFragility = nearHigh252 * positive(breadth50[i] - breadth200[i]) * positive(0.75 - breadth200[i]);

    rows.push({
      index: i, date: dates[i],
      f20: {
        momentumLossPersistent, breadth50DeclinePersistent, breadth20DeclinePersistent, dispersionWidenPersistent,
        defensiveRotationPersistent, vixRisePersistent, vixTermDeteriorationPersistent, sma50DeteriorationPersistent,
        priceBreadthDivergencePersistent, multiSignalPersistence: persistenceSignals
      },
      f60: {
        nearHigh252, longMomentumPositiveButDecelerating, breadth200WeakUnderStrongIndex, breadth200SlowDeterioration,
        breadth50SlowDeterioration, dispersionSlowWidening, defensiveRotationSlow, lowVixBreadthFragility,
        contangoCompressionCalm, silentDivergence, concentrationFragility
      },
      labels: [futureLabel(core, i, 20, 5, 2), futureLabel(core, i, 60, 10, 3)],
      labelEndIndexes: [i + 20, i + 60]
    });
  }
  return { rows, coreBars, diagnosticSeriesUsed, diagnosticSeriesMissing };
}

function rowVector(row: FeatureRow, horizon: 20 | 60): number[] {
  const names = horizon === 20 ? FEATURES_20 : FEATURES_60;
  const values = horizon === 20 ? row.f20 : row.f60;
  return names.map(name => (values as Record<string, number>)[name]);
}

function fitWithRegularization(rows: FeatureRow[], labelIndex: 0 | 1, horizon: 20 | 60, multiplier: number): Model | null {
  const usable = rows.filter(r => Number.isFinite(r.labels[labelIndex]));
  if (usable.length < MINIMUM_TRAINING_ROWS) return null;
  const labels = usable.map(r => r.labels[labelIndex]); const positives = labels.filter(v => v === 1).length; const negatives = labels.length - positives;
  if (positives < 8 || negatives < 8) return null;
  const names = horizon === 20 ? FEATURES_20 : FEATURES_60; const vectors = usable.map(r => rowVector(r, horizon));
  const means = names.map((_, c) => { const f = vectors.map(v => v[c]).filter(Number.isFinite); return f.length ? mean(f) : 0; });
  const stds = names.map((_, c) => { const f = vectors.map(v => v[c]).filter(Number.isFinite); const s = f.length > 1 ? std(f) : 1; return Number.isFinite(s) && s > 1e-8 ? s : 1; });
  const x = vectors.map(v => v.map((z, c) => Number.isFinite(z) ? (z - means[c]) / stds[c] : 0));
  const weights = Array(names.length).fill(0); const positiveWeight = clamp(negatives / positives, 1, 8);
  let intercept = Math.log(clamp(positives / usable.length, 0.01, 0.99) / clamp(negatives / usable.length, 0.01, 0.99));
  const l1 = (horizon === 20 ? 0.0035 : 0.0060) * multiplier, l2 = (horizon === 20 ? 0.050 : 0.085) * multiplier;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const grads = Array(weights.length).fill(0); let gi = 0, tw = 0;
    for (let r = 0; r < x.length; r++) {
      const sw = labels[r] === 1 ? positiveWeight : 1; const logit = intercept + x[r].reduce((s, z, c) => s + z * weights[c], 0); const e = (sigmoid(logit) - labels[r]) * sw;
      gi += e; tw += sw; for (let c = 0; c < weights.length; c++) grads[c] += e * x[r][c];
    }
    const rate = LEARNING_RATE / Math.max(1, tw); intercept -= rate * gi;
    for (let c = 0; c < weights.length; c++) {
      let updated = weights[c] - rate * (grads[c] + l2 * weights[c] * tw);
      updated = Math.max(0, updated - rate * l1 * tw);
      weights[c] = clamp(updated, 0, 8);
    }
  }
  const logits = x.map(v => intercept + v.reduce((s, z, c) => s + z * weights[c], 0)); const eventRate = positives / usable.length;
  let lo = -12, hi = 12; for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (mean(logits.map(z => sigmoid(z + mid))) > eventRate) hi = mid; else lo = mid; }
  const calibrationShift = (lo + hi) / 2; const trainingPredictionsSorted = logits.map(z => sigmoid(z + calibrationShift)).sort((a, b) => a - b);
  return { names, means, stds, weights, intercept, calibrationShift, trainingPredictionsSorted, trainingRows: usable.length, regularizationMultiplier: multiplier, innerValidationAuc: null };
}

function predict(model: Model, row: FeatureRow, horizon: 20 | 60): number {
  const v = rowVector(row, horizon).map((z, c) => Number.isFinite(z) ? (z - model.means[c]) / model.stds[c] : 0);
  return sigmoid(model.intercept + model.calibrationShift + v.reduce((s, z, c) => s + z * model.weights[c], 0));
}

function selectModel(rows: FeatureRow[], labelIndex: 0 | 1, horizon: 20 | 60): Model | null {
  const usable = rows.filter(r => Number.isFinite(r.labels[labelIndex])); if (usable.length < MINIMUM_TRAINING_ROWS) return null;
  const split = Math.max(MINIMUM_TRAINING_ROWS, Math.floor(usable.length * (1 - INNER_VALIDATION_FRACTION))); if (split >= usable.length - 20) return fitWithRegularization(usable, labelIndex, horizon, 1);
  const innerTrain = usable.slice(0, split), innerValidation = usable.slice(split);
  let bestMultiplier = 1, bestAuc = -Infinity;
  for (const multiplier of REGULARIZATION_MULTIPLIERS) {
    const model = fitWithRegularization(innerTrain, labelIndex, horizon, multiplier); if (!model) continue;
    const score = auc(innerValidation.map(r => r.labels[labelIndex]), innerValidation.map(r => predict(model, r, horizon)));
    if (score != null && score > bestAuc) { bestAuc = score; bestMultiplier = multiplier; }
  }
  const final = fitWithRegularization(usable, labelIndex, horizon, bestMultiplier); if (final) final.innerValidationAuc = Number.isFinite(bestAuc) ? bestAuc : null; return final;
}

function buildForecasts(rows: FeatureRow[], coreBars: PriceBar[], startDate: string, endDate: string) {
  const forecasts: Forecast[] = []; let models: [Model | null, Model | null] = [null, null]; let lastRetrain = -Infinity;
  for (const row of rows) {
    if (row.date < startDate || row.date >= endDate || row.index + 1 >= coreBars.length) continue;
    if (row.index - lastRetrain >= RETRAIN_EVERY_SESSIONS || models.some(m => m == null)) {
      const training = (li: 0 | 1) => rows.filter(c => c.index < row.index && c.labelEndIndexes[li] < row.index && Number.isFinite(c.labels[li])).slice(-MAXIMUM_TRAINING_ROWS);
      models = [selectModel(training(0), 0, 20), selectModel(training(1), 1, 60)]; lastRetrain = row.index;
    }
    if (models.some(m => m == null)) continue;
    const m = models as [Model, Model]; const probabilities: [number, number] = [predict(m[0], row, 20), predict(m[1], row, 60)];
    const percentiles: [number, number] = [percentileRank(m[0].trainingPredictionsSorted, probabilities[0]), percentileRank(m[1].trainingPredictionsSorted, probabilities[1])];
    forecasts.push({ index: row.index, informationDate: row.date, executionDate: isoDate(coreBars[row.index + 1].timestamp), probabilities, percentiles, labels: row.labels });
  }
  return { forecasts, latestModels: models };
}

function metric(forecasts: Forecast[], horizonIndex: 0 | 1): HorizonMetric {
  const usable = forecasts.filter(f => Number.isFinite(f.labels[horizonIndex])); const labels = usable.map(f => f.labels[horizonIndex]); const scores = usable.map(f => f.probabilities[horizonIndex]);
  const eventRate = labels.length ? mean(labels) : Number.NaN; const directAuc = auc(labels, scores); const invertedAuc = directAuc == null ? null : 1 - directAuc;
  const sorted = usable.map((f, i) => ({ f, score: scores[i] })).sort((a, b) => b.score - a.score); const topCount = Math.max(1, Math.floor(sorted.length * 0.1));
  const topRate = sorted.length ? mean(sorted.slice(0, topCount).map(x => x.f.labels[horizonIndex])) : Number.NaN; const high = usable.filter(f => f.percentiles[horizonIndex] >= HIGH_RISK_PERCENTILE); const precision = high.length ? mean(high.map(f => f.labels[horizonIndex])) : Number.NaN;
  return {
    horizonSessions: HORIZONS[horizonIndex], preCrashThresholdPct: THRESHOLDS[horizonIndex], observations: usable.length,
    eventRatePct: Number.isFinite(eventRate) ? eventRate * 100 : null, auc: directAuc, invertedAuc,
    topDecileEventRatePct: Number.isFinite(topRate) ? topRate * 100 : null,
    liftVsBaseRate: Number.isFinite(topRate) && Number.isFinite(eventRate) && eventRate > 0 ? topRate / eventRate : null,
    highRiskForecasts: high.length, highRiskPrecisionPct: Number.isFinite(precision) ? precision * 100 : null,
    highRiskFalsePositivePct: Number.isFinite(precision) ? (1 - precision) * 100 : null,
    orientation: directAuc == null ? 'UNRESOLVED' : directAuc >= 0.5 ? 'DIRECT' : 'INVERTED'
  };
}

function detectEpisodes(coreBars: PriceBar[], thresholdPct: 5 | 10) {
  const out: Array<{ peakIndex: number; breachIndex: number }> = []; if (!coreBars.length) return out;
  let peakIndex = 0, peakPrice = coreBars[0].close, inEpisode = false;
  for (let i = 1; i < coreBars.length; i++) {
    const price = coreBars[i].close;
    if (!inEpisode) {
      if (price >= peakPrice) { peakPrice = price; peakIndex = i; continue; }
      if ((price / peakPrice - 1) * 100 <= -thresholdPct) { out.push({ peakIndex, breachIndex: i }); inEpisode = true; }
    } else if (price >= peakPrice) { inEpisode = false; peakPrice = price; peakIndex = i; }
  }
  return out;
}

function auditEpisodes(coreBars: PriceBar[], forecasts: Forecast[]): ForwardRiskV3EpisodeAudit[] {
  const byIndex = new Map(forecasts.map(f => [f.index, f] as const)); const audits: ForwardRiskV3EpisodeAudit[] = [];
  ([0, 1] as const).forEach(hi => {
    const horizon = HORIZONS[hi], threshold = THRESHOLDS[hi];
    for (const episode of detectEpisodes(coreBars, threshold)) {
      const rows: Array<{ index: number; percentile: number; date: string }> = [];
      for (let i = Math.max(0, episode.peakIndex - horizon); i <= episode.peakIndex; i++) { const f = byIndex.get(i); if (f) rows.push({ index: i, percentile: f.percentiles[hi], date: f.informationDate }); }
      const high = rows.find(r => r.percentile >= HIGH_RISK_PERCENTILE) ?? null; const max = rows.length ? Math.max(...rows.map(r => r.percentile)) : Number.NaN;
      audits.push({ thresholdPct: threshold, horizonSessions: horizon, peakDate: isoDate(coreBars[episode.peakIndex].timestamp), breachDate: isoDate(coreBars[episode.breachIndex].timestamp), peakToBreachSessions: episode.breachIndex - episode.peakIndex, firstHighRiskDateBeforePeak: high?.date ?? null, leadSessionsBeforePeak: high ? episode.peakIndex - high.index : null, maxRiskPercentileBeforePeak: Number.isFinite(max) ? max * 100 : null, anticipatedBeforePeak: high != null });
    }
  });
  return audits;
}

export function runForwardRiskForecastV31(input: { dataset: MultiAssetDataset; diagnosticDataset?: MultiAssetDataset; catalog: AssetUniverseItem[]; startDate: string; endDate: string }): ForwardRiskForecastV31Result {
  const frozenV3 = runForwardRiskForecastV3(input);
  const core = chooseCore(input.dataset, input.startDate, input.endDate);
  if (!core) return {
    version: FORWARD_RISK_FORECAST_V31, status: 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_V3_5D_FROZEN_PERSISTENCE_20D_SILENT_FRAGILITY_60D', objective: 'PRE_CRASH_PERSISTENCE_AND_SILENT_FRAGILITY',
    coreAssetId: null, coreTicker: null, startDate: input.startDate, endDate: input.endDate, fiveDayFrozenFromV3: true,
    diagnosticSeriesUsed: [], diagnosticSeriesMissing: ['^VIX', '^VIX3M'], metrics: frozenV3.metrics.slice(0, 1), predictiveSignalPass: null, anticipationPass: null,
    anticipatedEpisodeRatePct: null, medianLeadSessionsBeforePeak: null, forecastsEvaluated: 0, modelDiagnostics: [], episodeAudits: frozenV3.episodeAudits.filter(a => a.horizonSessions === 5), featureWeights: [], sampledForecasts: [], notes: ['No core global usable para V3.1.']
  };
  const built = buildRows({ dataset: input.dataset, diagnosticDataset: input.diagnosticDataset, catalog: input.catalog, core }); const { forecasts, latestModels } = buildForecasts(built.rows, built.coreBars, input.startDate, input.endDate);
  const metrics = [frozenV3.metrics.find(m => m.horizonSessions === 5), metric(forecasts, 0), metric(forecasts, 1)].filter((m): m is HorizonMetric => m != null);
  const episodeAudits = [...frozenV3.episodeAudits.filter(a => a.horizonSessions === 5), ...auditEpisodes(built.coreBars, forecasts).filter(a => a.peakDate >= input.startDate && a.peakDate <= input.endDate)];
  const auditable = episodeAudits.filter(a => a.maxRiskPercentileBeforePeak != null); const anticipated = auditable.filter(a => a.anticipatedBeforePeak); const leads = anticipated.map(a => a.leadSessionsBeforePeak).filter((v): v is number => v != null).sort((a, b) => a - b);
  const anticipatedEpisodeRatePct = auditable.length ? anticipated.length / auditable.length * 100 : null; const medianLeadSessionsBeforePeak = leads.length ? leads[Math.floor(leads.length / 2)] : null;
  const anticipationPass = auditable.length >= 3 && anticipated.length / auditable.length >= 0.5 && (medianLeadSessionsBeforePeak ?? 0) >= 2;
  const validAucs = metrics.map(m => m.auc).filter((v): v is number => v != null); const predictiveSignalPass = validAucs.length === 3 && metrics.every(m => m.orientation === 'DIRECT') && validAucs.every(v => v > 0.5) && mean(validAucs) > 0.55 && metrics.filter(m => (m.auc ?? 0) > 0.55).length >= 2;
  const modelDiagnostics: ForwardRiskV31ModelDiagnostic[] = latestModels.map((model, i) => ({ horizonSessions: HORIZONS[i], featureCount: (i === 0 ? FEATURES_20 : FEATURES_60).length, trainingRows: model?.trainingRows ?? 0, regularizationMultiplier: model?.regularizationMultiplier ?? null, innerValidationAuc: model?.innerValidationAuc ?? null, innerValidationOrientation: model?.innerValidationAuc == null ? 'UNRESOLVED' : model.innerValidationAuc >= 0.5 ? 'DIRECT' : 'INVERTED' })) as ForwardRiskV31ModelDiagnostic[];
  const featureWeights = latestModels.map((model, i) => ({ horizonSessions: HORIZONS[i], top: model ? model.names.map((feature, c) => ({ feature, coefficient: model.weights[c], absCoefficient: Math.abs(model.weights[c]) })).sort((a, b) => b.absCoefficient - a.absCoefficient).slice(0, 10) : [] })) as Array<{ horizonSessions: 20 | 60; top: ForwardRiskV31FeatureWeight[] }>;
  const sampledForecasts = forecasts.filter((_, i) => i % 20 === 0).concat(forecasts.slice(-1)).slice(-600).map(f => ({ informationDate: f.informationDate, executionDate: f.executionDate, probability20d5Pct: f.probabilities[0] * 100, probability60d10Pct: f.probabilities[1] * 100, nearTermRiskPercentilePct: f.percentiles[0] * 100, mediumTermRiskPercentilePct: f.percentiles[1] * 100, combinedRiskPercentilePct: Math.max(...f.percentiles) * 100, labels: f.labels.map(v => Number.isFinite(v) ? v : null) as [number | null, number | null] }));
  return {
    version: FORWARD_RISK_FORECAST_V31, status: forecasts.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA', methodology: 'STRICT_WALK_FORWARD_V3_5D_FROZEN_PERSISTENCE_20D_SILENT_FRAGILITY_60D', objective: 'PRE_CRASH_PERSISTENCE_AND_SILENT_FRAGILITY',
    coreAssetId: core.assetId, coreTicker: core.ticker, startDate: input.startDate, endDate: input.endDate, fiveDayFrozenFromV3: true,
    diagnosticSeriesUsed: built.diagnosticSeriesUsed, diagnosticSeriesMissing: built.diagnosticSeriesMissing, metrics, predictiveSignalPass, anticipationPass,
    anticipatedEpisodeRatePct, medianLeadSessionsBeforePeak, forecastsEvaluated: forecasts.length, modelDiagnostics, episodeAudits, featureWeights, sampledForecasts,
    notes: [
      'V3.1 congela literalmente la métrica y auditoría 5d de V3; no reentrena ni altera ese horizonte.',
      '20d usa deterioro persistente: una señal aislada de 1-3 sesiones no basta; se combinan pendientes y persistencia multi-ventana.',
      '60d busca fragilidad silenciosa cerca de máximos: breadth de largo plazo débil, concentración, dispersión, desaceleración y compresión de contango con VIX todavía bajo.',
      'Todas las features 20d/60d están orientadas a riesgo creciente y los coeficientes se restringen a >=0; no existe inversión automática 1-score.',
      'La regularización se selecciona sólo con split cronológico interno de observaciones ya maduras.',
      'V3.1 sigue aislado de Custodia y no contiene ninguna política de exposición o compraventa.'
    ]
  };
}
