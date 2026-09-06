import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';

export const FORWARD_RISK_REGIME_SHIFT_V4 = 'FORWARD_RISK_REGIME_SHIFT_V4' as const;

const CALIBRATION_SESSIONS = 756;
const MIN_CALIBRATION_SESSIONS = 252;
const HIGH_RISK_SCORE = 0.80;
const HORIZON_SESSIONS = 20;
const EVENT_THRESHOLD_PCT = 5;

export interface ForwardRiskRegimeShiftV4Point {
  informationDate: string;
  executionDate: string;
  riskScorePct: number;
  components: Record<string, number | null>;
  future20dDrop5Pct: 0 | 1 | null;
}

export interface ForwardRiskRegimeShiftV4Result {
  version: typeof FORWARD_RISK_REGIME_SHIFT_V4;
  methodology: 'PAST_ONLY_UNSUPERVISED_REGIME_SHIFT_NO_LABEL_FIT';
  status: 'VALID' | 'INSUFFICIENT_DATA';
  startDate: string;
  endDate: string;
  coreAssetId: string | null;
  coreTicker: string | null;
  forecastsEvaluated: number;
  observations20d: number;
  eventRatePct: number | null;
  auc20d: number | null;
  orientation20d: 'DIRECT' | 'INVERTED' | 'UNRESOLVED';
  highRiskForecasts: number;
  highRiskPrecisionPct: number | null;
  highRiskFalsePositivePct: number | null;
  anticipatedEpisodes: number;
  auditableEpisodes: number;
  anticipationRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  points: ForwardRiskRegimeShiftV4Point[];
  notes: string[];
}

interface RawRow {
  index: number;
  date: string;
  executionDate: string;
  components: Record<string, number>;
  label: number;
}

function isoDate(value: string): string { return value.slice(0, 10); }
function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN; }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function sortedBars(asset: MultiAssetDatasetItem): PriceBar[] {
  return [...asset.bars].filter(bar => bar.open > 0 && bar.close > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
}
function chooseCore(dataset: MultiAssetDataset): MultiAssetDatasetItem | null {
  return dataset.assets.find(asset => asset.assetId === 'EUNL')
    ?? dataset.assets.find(asset => asset.ticker === 'EUNL.DE')
    ?? dataset.assets.find(asset => asset.assetId.toUpperCase().includes('WORLD'))
    ?? null;
}
function alignedCloses(asset: MultiAssetDatasetItem, dates: string[]): Array<number | null> {
  const bars = sortedBars(asset);
  const out: Array<number | null> = [];
  let cursor = 0;
  let latest: PriceBar | null = null;
  for (const date of dates) {
    while (cursor < bars.length && isoDate(bars[cursor].timestamp) <= date) latest = bars[cursor++];
    if (!latest) { out.push(null); continue; }
    const gapDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${isoDate(latest.timestamp)}T00:00:00Z`)) / 86_400_000;
    out.push(gapDays <= 5 ? latest.close : null);
  }
  return out;
}
function pctReturn(values: Array<number | null>, index: number, lookback: number): number {
  const a = values[index - lookback], b = values[index];
  return a != null && b != null && a > 0 && b > 0 ? (b / a - 1) * 100 : Number.NaN;
}
function smaDistance(values: Array<number | null>, index: number, lookback: number): number {
  if (index + 1 < lookback) return Number.NaN;
  const current = values[index];
  if (current == null || current <= 0) return Number.NaN;
  const window = values.slice(index - lookback + 1, index + 1).filter((value): value is number => value != null && value > 0);
  if (window.length < Math.floor(lookback * 0.9)) return Number.NaN;
  return current / mean(window) - 1;
}
function realizedVol(values: Array<number | null>, index: number, lookback: number): number {
  if (index < lookback) return Number.NaN;
  const returns: number[] = [];
  for (let i = index - lookback + 1; i <= index; i++) {
    const a = values[i - 1], b = values[i];
    if (a == null || b == null || a <= 0 || b <= 0) continue;
    returns.push(Math.log(b / a));
  }
  if (returns.length < Math.floor(lookback * 0.8)) return Number.NaN;
  const m = mean(returns);
  return Math.sqrt(mean(returns.map(value => (value - m) ** 2))) * Math.sqrt(252) * 100;
}
function percentileRank(history: number[], value: number): number {
  const finite = history.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length || !Number.isFinite(value)) return Number.NaN;
  let lo = 0, hi = finite.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (finite[mid] <= value) lo = mid + 1; else hi = mid;
  }
  return lo / finite.length;
}
function auc(labels: number[], scores: number[]): number | null {
  const pairs = labels.map((label, i) => ({ label, score: scores[i] }))
    .filter(row => Number.isFinite(row.label) && Number.isFinite(row.score))
    .sort((a, b) => a.score - b.score);
  const positives = pairs.filter(row => row.label === 1).length;
  const negatives = pairs.length - positives;
  if (!positives || !negatives) return null;
  let rankSum = 0;
  let i = 0;
  while (i < pairs.length) {
    let j = i + 1;
    while (j < pairs.length && Math.abs(pairs[j].score - pairs[i].score) < 1e-12) j++;
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (pairs[k].label === 1) rankSum += averageRank;
    i = j;
  }
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}
function futureDropLabel(values: Array<number | null>, index: number): number {
  const current = values[index];
  if (current == null || current <= 0 || index + HORIZON_SESSIONS >= values.length) return Number.NaN;
  const future = values.slice(index + 1, index + HORIZON_SESSIONS + 1).filter((value): value is number => value != null && value > 0);
  if (future.length < Math.floor(HORIZON_SESSIONS * 0.8)) return Number.NaN;
  return (Math.min(...future) / current - 1) * 100 <= -EVENT_THRESHOLD_PCT ? 1 : 0;
}
function detectEpisodes(values: Array<number | null>): Array<{ peakIndex: number; breachIndex: number }> {
  const out: Array<{ peakIndex: number; breachIndex: number }> = [];
  let peakIndex = 0;
  let peak = values[0] ?? Number.NaN;
  let inEpisode = false;
  for (let i = 1; i < values.length; i++) {
    const value = values[i];
    if (value == null || !Number.isFinite(peak)) continue;
    if (!inEpisode) {
      if (value >= peak) { peak = value; peakIndex = i; continue; }
      if ((value / peak - 1) * 100 <= -EVENT_THRESHOLD_PCT) { out.push({ peakIndex, breachIndex: i }); inEpisode = true; }
    } else if (value >= peak) {
      peak = value; peakIndex = i; inEpisode = false;
    }
  }
  return out;
}

export function runForwardRiskRegimeShiftV4(input: {
  dataset: MultiAssetDataset;
  diagnosticDataset?: MultiAssetDataset;
  startDate: string;
  endDate: string;
}): ForwardRiskRegimeShiftV4Result {
  const core = chooseCore(input.dataset);
  if (!core) return {
    version: FORWARD_RISK_REGIME_SHIFT_V4,
    methodology: 'PAST_ONLY_UNSUPERVISED_REGIME_SHIFT_NO_LABEL_FIT',
    status: 'INSUFFICIENT_DATA', startDate: input.startDate, endDate: input.endDate,
    coreAssetId: null, coreTicker: null, forecastsEvaluated: 0, observations20d: 0,
    eventRatePct: null, auc20d: null, orientation20d: 'UNRESOLVED', highRiskForecasts: 0,
    highRiskPrecisionPct: null, highRiskFalsePositivePct: null, anticipatedEpisodes: 0,
    auditableEpisodes: 0, anticipationRatePct: null, medianLeadSessionsBeforePeak: null, points: [],
    notes: ['No usable global core was available.']
  };

  const coreBars = sortedBars(core);
  const dates = coreBars.map(bar => isoDate(bar.timestamp));
  const coreCloses = coreBars.map(bar => bar.close as number | null);
  const riskAssets = input.dataset.assets.filter(asset => asset.assetId !== core.assetId && sortedBars(asset).length >= 252);
  const aligned = riskAssets.map(asset => alignedCloses(asset, dates));
  const vix = input.diagnosticDataset?.assets.find(asset => asset.ticker === '^VIX' || asset.assetId === 'DIAG_VIX');
  const vix3m = input.diagnosticDataset?.assets.find(asset => asset.ticker === '^VIX3M' || asset.assetId === 'DIAG_VIX3M');
  const vixCloses = vix ? alignedCloses(vix, dates) : dates.map(() => null);
  const vix3mCloses = vix3m ? alignedCloses(vix3m, dates) : dates.map(() => null);

  const rawRows: RawRow[] = [];
  for (let i = 200; i < dates.length - 1; i++) {
    const ret20 = pctReturn(coreCloses, i, 20);
    const ret60 = pctReturn(coreCloses, i, 60);
    const vol20 = realizedVol(coreCloses, i, 20);
    const vol120 = realizedVol(coreCloses, i, 120);
    const breadth50Distances = aligned.map(values => smaDistance(values, i, 50)).filter(Number.isFinite);
    const breadth200Distances = aligned.map(values => smaDistance(values, i, 200)).filter(Number.isFinite);
    const ret20Cross = aligned.map(values => pctReturn(values, i, 20)).filter(Number.isFinite);
    const vix20 = pctReturn(vixCloses, i, 20);
    const vixLevel = vixCloses[i];
    const vix3mLevel = vix3mCloses[i];
    const components: Record<string, number> = {
      coreLoss20: Number.isFinite(ret20) ? Math.max(0, -ret20) : Number.NaN,
      coreLoss60: Number.isFinite(ret60) ? Math.max(0, -ret60) : Number.NaN,
      volExpansion: Number.isFinite(vol20) && Number.isFinite(vol120) && vol120 > 0 ? vol20 / vol120 : Number.NaN,
      breadth50Weak: breadth50Distances.length ? 1 - breadth50Distances.filter(value => value >= 0).length / breadth50Distances.length : Number.NaN,
      breadth200Weak: breadth200Distances.length ? 1 - breadth200Distances.filter(value => value >= 0).length / breadth200Distances.length : Number.NaN,
      negative20Share: ret20Cross.length ? ret20Cross.filter(value => value < 0).length / ret20Cross.length : Number.NaN,
      vix20Rise: Number.isFinite(vix20) ? Math.max(0, vix20) : Number.NaN,
      vixTermStress: vixLevel != null && vix3mLevel != null && vix3mLevel > 0 ? Math.max(0, vixLevel / vix3mLevel - 1) : Number.NaN
    };
    rawRows.push({
      index: i,
      date: dates[i],
      executionDate: dates[i + 1],
      components,
      label: futureDropLabel(coreCloses, i)
    });
  }

  const scored: Array<{ row: RawRow; score: number; normalized: Record<string, number | null> }> = [];
  const names = ['coreLoss20', 'coreLoss60', 'volExpansion', 'breadth50Weak', 'breadth200Weak', 'negative20Share', 'vix20Rise', 'vixTermStress'];
  for (let r = 0; r < rawRows.length; r++) {
    const historyStart = Math.max(0, r - CALIBRATION_SESSIONS);
    const history = rawRows.slice(historyStart, r);
    if (history.length < MIN_CALIBRATION_SESSIONS) continue;
    const normalized: Record<string, number | null> = {};
    const ranks: number[] = [];
    for (const name of names) {
      const current = rawRows[r].components[name];
      const rank = percentileRank(history.map(row => row.components[name]), current);
      normalized[name] = Number.isFinite(rank) ? rank * 100 : null;
      if (Number.isFinite(rank)) ranks.push(rank);
    }
    if (ranks.length < 5) continue;
    const score = mean(ranks);
    scored.push({ row: rawRows[r], score, normalized });
  }

  const inWindow = scored.filter(item => item.row.date >= input.startDate && item.row.date <= input.endDate);
  const usable = inWindow.filter(item => Number.isFinite(item.row.label));
  const labels = usable.map(item => item.row.label);
  const scores = usable.map(item => item.score);
  const directAuc = auc(labels, scores);
  const high = usable.filter(item => item.score >= HIGH_RISK_SCORE);
  const precision = high.length ? mean(high.map(item => item.row.label)) : Number.NaN;

  const scoreByIndex = new Map(inWindow.map(item => [item.row.index, item.score] as const));
  const episodes = detectEpisodes(coreCloses).filter(episode => dates[episode.peakIndex] >= input.startDate && dates[episode.peakIndex] <= input.endDate);
  const leads: number[] = [];
  let anticipated = 0;
  let auditable = 0;
  for (const episode of episodes) {
    const candidates: Array<{ index: number; score: number }> = [];
    for (let i = Math.max(0, episode.peakIndex - HORIZON_SESSIONS); i <= episode.peakIndex; i++) {
      const score = scoreByIndex.get(i);
      if (score != null) candidates.push({ index: i, score });
    }
    if (!candidates.length) continue;
    auditable++;
    const first = candidates.find(item => item.score >= HIGH_RISK_SCORE);
    if (first) { anticipated++; leads.push(episode.peakIndex - first.index); }
  }

  return {
    version: FORWARD_RISK_REGIME_SHIFT_V4,
    methodology: 'PAST_ONLY_UNSUPERVISED_REGIME_SHIFT_NO_LABEL_FIT',
    status: inWindow.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA',
    startDate: input.startDate,
    endDate: input.endDate,
    coreAssetId: core.assetId,
    coreTicker: core.ticker,
    forecastsEvaluated: inWindow.length,
    observations20d: usable.length,
    eventRatePct: usable.length ? mean(labels) * 100 : null,
    auc20d: directAuc,
    orientation20d: directAuc == null ? 'UNRESOLVED' : directAuc >= 0.5 ? 'DIRECT' : 'INVERTED',
    highRiskForecasts: high.length,
    highRiskPrecisionPct: Number.isFinite(precision) ? precision * 100 : null,
    highRiskFalsePositivePct: Number.isFinite(precision) ? (1 - precision) * 100 : null,
    anticipatedEpisodes: anticipated,
    auditableEpisodes: auditable,
    anticipationRatePct: auditable ? anticipated / auditable * 100 : null,
    medianLeadSessionsBeforePeak: median(leads),
    points: inWindow.map(item => ({
      informationDate: item.row.date,
      executionDate: item.row.executionDate,
      riskScorePct: item.score * 100,
      components: item.normalized,
      future20dDrop5Pct: Number.isFinite(item.row.label) ? item.row.label as 0 | 1 : null
    })),
    notes: [
      'V4 does not fit coefficients, thresholds or probabilities to future drawdown labels.',
      'Every component is converted to a percentile using only the preceding 252-756 sessions.',
      'The final regime-shift score is the equal-weight mean of available past-only component percentiles.',
      'Future 20-session drawdown labels are used only after scoring for audit metrics.',
      'V4 is research-only and has no portfolio action, sizing or production wiring.'
    ]
  };
}
