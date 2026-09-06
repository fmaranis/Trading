import type { PriceBar } from '../backtesting/types';
import type { MultiAssetDataset, MultiAssetDatasetItem } from '../portfolioBacktesting/types';

export const FORWARD_RISK_CROSS_ASSET_V6 = 'FORWARD_RISK_CROSS_ASSET_V6' as const;

const CALIBRATION_SESSIONS = 756;
const MIN_CALIBRATION_SESSIONS = 252;
const DIVERGENCE_SCORE = 0.80;
const PRE_PEAK_LOOKBACK_SESSIONS = 63;
const EVENT_THRESHOLD_PCT = 5;

export interface ForwardRiskCrossAssetV6Point {
  informationDate: string;
  executionDate: string;
  divergenceScorePct: number;
  components: Record<string, number | null>;
}

export interface ForwardRiskCrossAssetV6EpisodeAudit {
  peakDate: string;
  breachDate: string;
  firstDivergenceDateBeforePeak: string | null;
  leadSessionsBeforePeak: number | null;
}

export interface ForwardRiskCrossAssetV6Result {
  version: typeof FORWARD_RISK_CROSS_ASSET_V6;
  methodology: 'PAST_ONLY_CROSS_ASSET_DIVERGENCE_NO_LABEL_FIT';
  status: 'VALID' | 'INSUFFICIENT_DATA';
  startDate: string;
  endDate: string;
  riskSensitiveAssetsUsed: string[];
  defensiveAssetsUsed: string[];
  forecastsEvaluated: number;
  divergenceForecasts: number;
  auditableEpisodes: number;
  anticipatedEpisodes: number;
  anticipationRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  falseDivergenceTimePct: number | null;
  researchGatePass: boolean;
  points: ForwardRiskCrossAssetV6Point[];
  episodeAudits: ForwardRiskCrossAssetV6EpisodeAudit[];
  notes: string[];
}

function isoDate(value: string): string { return value.slice(0, 10); }
function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN; }
function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function nullableMedian(values: number[]): number | null {
  const value = median(values.filter(Number.isFinite));
  return Number.isFinite(value) ? value : null;
}
function sortedBars(asset: MultiAssetDatasetItem): PriceBar[] {
  return [...asset.bars]
    .filter(bar => bar.open > 0 && bar.close > 0)
    .sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
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
  const a = values[index - lookback];
  const b = values[index];
  return a != null && b != null && a > 0 && b > 0 ? (b / a - 1) * 100 : Number.NaN;
}
function percentileRank(history: number[], value: number): number {
  const finite = history.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length || !Number.isFinite(value)) return Number.NaN;
  let lo = 0;
  let hi = finite.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (finite[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo / finite.length;
}
function detectEpisodes(values: number[]): Array<{ peakIndex: number; breachIndex: number }> {
  const out: Array<{ peakIndex: number; breachIndex: number }> = [];
  if (!values.length) return out;
  let peakIndex = 0;
  let peak = values[0];
  let inEpisode = false;
  for (let i = 1; i < values.length; i++) {
    const value = values[i];
    if (!inEpisode) {
      if (value >= peak) { peak = value; peakIndex = i; continue; }
      if ((value / peak - 1) * 100 <= -EVENT_THRESHOLD_PCT) {
        out.push({ peakIndex, breachIndex: i });
        inEpisode = true;
      }
    } else if (value >= peak) {
      peak = value;
      peakIndex = i;
      inEpisode = false;
    }
  }
  return out;
}

export function runForwardRiskCrossAssetV6(input: {
  dataset: MultiAssetDataset;
  startDate: string;
  endDate: string;
  riskSensitiveAssetIds: string[];
  defensiveAssetIds: string[];
}): ForwardRiskCrossAssetV6Result {
  const core = chooseCore(input.dataset);
  if (!core) return empty(input, ['No usable global core was available.']);

  const coreBars = sortedBars(core);
  const dates = coreBars.map(bar => isoDate(bar.timestamp));
  const coreCloses = coreBars.map(bar => bar.close as number | null);
  if (dates.length < MIN_CALIBRATION_SESSIONS + 80) return empty(input, ['Insufficient core history for V6 calibration.']);

  const riskAssets = input.dataset.assets.filter(asset => input.riskSensitiveAssetIds.includes(asset.assetId) && asset.assetId !== core.assetId && sortedBars(asset).length >= 80);
  const defensiveAssets = input.dataset.assets.filter(asset => input.defensiveAssetIds.includes(asset.assetId) && sortedBars(asset).length >= 80);
  if (riskAssets.length < 4 || defensiveAssets.length < 3) {
    return empty(input, [`Insufficient cross-asset coverage: risk=${riskAssets.length}, defensive=${defensiveAssets.length}.`]);
  }

  const riskAligned = riskAssets.map(asset => ({ assetId: asset.assetId, closes: alignedCloses(asset, dates) }));
  const defensiveAligned = defensiveAssets.map(asset => ({ assetId: asset.assetId, closes: alignedCloses(asset, dates) }));

  const raw: Array<{ index: number; date: string; executionDate: string; components: Record<string, number> }> = [];
  for (let i = 60; i < dates.length - 1; i++) {
    const core20 = pctReturn(coreCloses, i, 20);
    const core60 = pctReturn(coreCloses, i, 60);
    const risk20 = riskAligned.map(row => pctReturn(row.closes, i, 20)).filter(Number.isFinite);
    const risk60 = riskAligned.map(row => pctReturn(row.closes, i, 60)).filter(Number.isFinite);
    const defensive20 = defensiveAligned.map(row => pctReturn(row.closes, i, 20)).filter(Number.isFinite);
    const defensive60 = defensiveAligned.map(row => pctReturn(row.closes, i, 60)).filter(Number.isFinite);

    const components: Record<string, number> = {
      riskUnderperform20Share: Number.isFinite(core20) && risk20.length >= 3 ? risk20.filter(value => value < core20).length / risk20.length : Number.NaN,
      riskUnderperform60Share: Number.isFinite(core60) && risk60.length >= 3 ? risk60.filter(value => value < core60).length / risk60.length : Number.NaN,
      riskMedianLag20: Number.isFinite(core20) && risk20.length >= 3 ? Math.max(0, core20 - median(risk20)) : Number.NaN,
      riskMedianLag60: Number.isFinite(core60) && risk60.length >= 3 ? Math.max(0, core60 - median(risk60)) : Number.NaN,
      defensiveOutperform20Share: Number.isFinite(core20) && defensive20.length >= 2 ? defensive20.filter(value => value > core20).length / defensive20.length : Number.NaN,
      defensiveOutperform60Share: Number.isFinite(core60) && defensive60.length >= 2 ? defensive60.filter(value => value > core60).length / defensive60.length : Number.NaN,
      defensiveMedianLead20: Number.isFinite(core20) && defensive20.length >= 2 ? Math.max(0, median(defensive20) - core20) : Number.NaN,
      defensiveMedianLead60: Number.isFinite(core60) && defensive60.length >= 2 ? Math.max(0, median(defensive60) - core60) : Number.NaN
    };
    raw.push({ index: i, date: dates[i], executionDate: dates[i + 1], components });
  }

  const componentNames = [
    'riskUnderperform20Share',
    'riskUnderperform60Share',
    'riskMedianLag20',
    'riskMedianLag60',
    'defensiveOutperform20Share',
    'defensiveOutperform60Share',
    'defensiveMedianLead20',
    'defensiveMedianLead60'
  ];

  const scored: Array<{ index: number; date: string; executionDate: string; score: number; normalized: Record<string, number | null> }> = [];
  for (let r = 0; r < raw.length; r++) {
    const history = raw.slice(Math.max(0, r - CALIBRATION_SESSIONS), r);
    if (history.length < MIN_CALIBRATION_SESSIONS) continue;
    const ranks: number[] = [];
    const normalized: Record<string, number | null> = {};
    for (const name of componentNames) {
      const rank = percentileRank(history.map(row => row.components[name]), raw[r].components[name]);
      normalized[name] = Number.isFinite(rank) ? rank * 100 : null;
      if (Number.isFinite(rank)) ranks.push(rank);
    }
    if (ranks.length < 6) continue;
    scored.push({ index: raw[r].index, date: raw[r].date, executionDate: raw[r].executionDate, score: mean(ranks), normalized });
  }

  const inWindow = scored.filter(row => row.date >= input.startDate && row.date <= input.endDate);
  const points: ForwardRiskCrossAssetV6Point[] = inWindow.map(row => ({
    informationDate: row.date,
    executionDate: row.executionDate,
    divergenceScorePct: row.score * 100,
    components: row.normalized
  }));
  const byIndex = new Map(inWindow.map((row, idx) => [row.index, points[idx]] as const));

  const episodes = detectEpisodes(coreCloses as number[])
    .filter(episode => dates[episode.peakIndex] >= input.startDate && dates[episode.peakIndex] <= input.endDate);
  const prePeakIndexes = new Set<number>();
  const episodeAudits: ForwardRiskCrossAssetV6EpisodeAudit[] = [];
  const leads: number[] = [];
  let anticipated = 0;

  for (const episode of episodes) {
    const start = Math.max(0, episode.peakIndex - PRE_PEAK_LOOKBACK_SESSIONS);
    for (let i = start; i <= episode.peakIndex; i++) prePeakIndexes.add(i);
    const candidates: Array<{ index: number; point: ForwardRiskCrossAssetV6Point }> = [];
    for (let i = start; i <= episode.peakIndex; i++) {
      const point = byIndex.get(i);
      if (point) candidates.push({ index: i, point });
    }
    if (!candidates.length) continue;
    const first = candidates.find(row => row.point.divergenceScorePct >= DIVERGENCE_SCORE * 100) ?? null;
    if (first) {
      anticipated++;
      leads.push(episode.peakIndex - first.index);
    }
    episodeAudits.push({
      peakDate: dates[episode.peakIndex],
      breachDate: dates[episode.breachIndex],
      firstDivergenceDateBeforePeak: first?.point.informationDate ?? null,
      leadSessionsBeforePeak: first ? episode.peakIndex - first.index : null
    });
  }

  const divergenceRows = inWindow.filter(row => row.score >= DIVERGENCE_SCORE);
  const falseRows = divergenceRows.filter(row => !prePeakIndexes.has(row.index));
  const anticipationRatePct = episodeAudits.length ? anticipated / episodeAudits.length * 100 : null;
  const medianLeadSessionsBeforePeak = nullableMedian(leads);
  const falseDivergenceTimePct = inWindow.length ? falseRows.length / inWindow.length * 100 : null;
  const researchGatePass = (anticipationRatePct ?? 0) >= 50
    && (medianLeadSessionsBeforePeak ?? 0) >= 10
    && (falseDivergenceTimePct ?? 100) <= 35;

  return {
    version: FORWARD_RISK_CROSS_ASSET_V6,
    methodology: 'PAST_ONLY_CROSS_ASSET_DIVERGENCE_NO_LABEL_FIT',
    status: inWindow.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA',
    startDate: input.startDate,
    endDate: input.endDate,
    riskSensitiveAssetsUsed: riskAssets.map(asset => asset.assetId),
    defensiveAssetsUsed: defensiveAssets.map(asset => asset.assetId),
    forecastsEvaluated: inWindow.length,
    divergenceForecasts: divergenceRows.length,
    auditableEpisodes: episodeAudits.length,
    anticipatedEpisodes: anticipated,
    anticipationRatePct,
    medianLeadSessionsBeforePeak,
    falseDivergenceTimePct,
    researchGatePass,
    points,
    episodeAudits,
    notes: [
      'V6 contains no fitted coefficients, future drawdown labels, probability calibration or portfolio action.',
      'The score measures whether risk-sensitive assets weaken relative to the global core while defensive assets outperform the core.',
      'Each component is converted to a percentile using only its preceding 252-756 scored sessions.',
      'The gate was fixed before evaluation: anticipation >=50%, median lead >=10 sessions, false divergence time <=35%.',
      'V6 is research-only and is not connected to Custodia, replay decisions, sizing or alerts.'
    ]
  };
}

function empty(input: {
  startDate: string;
  endDate: string;
  riskSensitiveAssetIds: string[];
  defensiveAssetIds: string[];
}, notes: string[]): ForwardRiskCrossAssetV6Result {
  return {
    version: FORWARD_RISK_CROSS_ASSET_V6,
    methodology: 'PAST_ONLY_CROSS_ASSET_DIVERGENCE_NO_LABEL_FIT',
    status: 'INSUFFICIENT_DATA',
    startDate: input.startDate,
    endDate: input.endDate,
    riskSensitiveAssetsUsed: [],
    defensiveAssetsUsed: [],
    forecastsEvaluated: 0,
    divergenceForecasts: 0,
    auditableEpisodes: 0,
    anticipatedEpisodes: 0,
    anticipationRatePct: null,
    medianLeadSessionsBeforePeak: null,
    falseDivergenceTimePct: null,
    researchGatePass: false,
    points: [],
    episodeAudits: [],
    notes
  };
}
