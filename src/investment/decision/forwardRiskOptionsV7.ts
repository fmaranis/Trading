import type { PriceBar } from '../backtesting/types';
import type { ForwardRiskOptionsDataV7, ForwardRiskOptionsPointV7 } from './forwardRiskOptionsDataV7';

export const FORWARD_RISK_OPTIONS_V7 = 'FORWARD_RISK_OPTIONS_V7' as const;

const CALIBRATION_SESSIONS = 756;
const MIN_CALIBRATION_SESSIONS = 252;
const SIGNAL_SCORE = 0.80;
const PRE_PEAK_LOOKBACK_SESSIONS = 63;
const EVENT_THRESHOLD_PCT = 5;
const MAX_STALENESS_DAYS = 5;

export interface ForwardRiskOptionsV7Point {
  informationDate: string;
  executionDate: string;
  signalScorePct: number;
  components: Record<string, number | null>;
}

export interface ForwardRiskOptionsV7EpisodeAudit {
  peakDate: string;
  breachDate: string;
  firstSignalDateBeforePeak: string | null;
  leadSessionsBeforePeak: number | null;
}

export interface ForwardRiskOptionsV7Result {
  version: typeof FORWARD_RISK_OPTIONS_V7;
  methodology: 'PAST_ONLY_OPTIONS_IMPLIED_STRESS_NO_LABEL_FIT';
  status: 'VALID' | 'INSUFFICIENT_DATA';
  startDate: string;
  endDate: string;
  forecastsEvaluated: number;
  signalForecasts: number;
  auditableEpisodes: number;
  anticipatedEpisodes: number;
  anticipationRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  falseSignalTimePct: number | null;
  researchGatePass: boolean;
  points: ForwardRiskOptionsV7Point[];
  episodeAudits: ForwardRiskOptionsV7EpisodeAudit[];
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
function sortedBars(bars: PriceBar[]): PriceBar[] {
  return [...bars].filter(bar => bar.open > 0 && bar.close > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
}
function align(points: ForwardRiskOptionsPointV7[], dates: string[]): Array<number | null> {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: Array<number | null> = [];
  let cursor = 0;
  let latest: ForwardRiskOptionsPointV7 | null = null;
  for (const date of dates) {
    while (cursor < sorted.length && sorted[cursor].date <= date) latest = sorted[cursor++];
    if (!latest) { out.push(null); continue; }
    const staleDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${latest.date}T00:00:00Z`)) / 86_400_000;
    out.push(staleDays <= MAX_STALENESS_DAYS ? latest.value : null);
  }
  return out;
}
function delta(values: Array<number | null>, index: number, lookback: number): number {
  const a = values[index - lookback];
  const b = values[index];
  return a != null && b != null ? b - a : Number.NaN;
}
function ratio(a: number | null, b: number | null): number {
  return a != null && b != null && a > 0 && b > 0 ? a / b : Number.NaN;
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

export function runForwardRiskOptionsV7(input: {
  coreBars: PriceBar[];
  optionsData: ForwardRiskOptionsDataV7;
  startDate: string;
  endDate: string;
}): ForwardRiskOptionsV7Result {
  const coreBars = sortedBars(input.coreBars);
  const dates = coreBars.map(bar => isoDate(bar.timestamp));
  const coreCloses = coreBars.map(bar => bar.close);
  if (dates.length < MIN_CALIBRATION_SESSIONS + 80) return empty(input, ['Insufficient core history for V7 calibration.']);

  const vix = align(input.optionsData.series.VIX.points, dates);
  const vix9d = align(input.optionsData.series.VIX9D.points, dates);
  const vvix = align(input.optionsData.series.VVIX.points, dates);

  const raw: Array<{ index: number; date: string; executionDate: string; components: Record<string, number> }> = [];
  for (let i = 20; i < dates.length - 1; i++) {
    const components: Record<string, number> = {
      vixLevel: vix[i] ?? Number.NaN,
      vixRise20: Math.max(0, delta(vix, i, 20)),
      vix9dLevel: vix9d[i] ?? Number.NaN,
      vix9dRise20: Math.max(0, delta(vix9d, i, 20)),
      nearTermVolRatio: ratio(vix9d[i], vix[i]),
      vvixLevel: vvix[i] ?? Number.NaN,
      vvixRise20: Math.max(0, delta(vvix, i, 20)),
      convexityDemandRatio: ratio(vvix[i], vix[i])
    };
    raw.push({ index: i, date: dates[i], executionDate: dates[i + 1], components });
  }

  const componentNames = [
    'vixLevel',
    'vixRise20',
    'vix9dLevel',
    'vix9dRise20',
    'nearTermVolRatio',
    'vvixLevel',
    'vvixRise20',
    'convexityDemandRatio'
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
  const points: ForwardRiskOptionsV7Point[] = inWindow.map(row => ({
    informationDate: row.date,
    executionDate: row.executionDate,
    signalScorePct: row.score * 100,
    components: row.normalized
  }));
  const byIndex = new Map(inWindow.map((row, idx) => [row.index, points[idx]] as const));

  const episodes = detectEpisodes(coreCloses)
    .filter(episode => dates[episode.peakIndex] >= input.startDate && dates[episode.peakIndex] <= input.endDate);
  const prePeakIndexes = new Set<number>();
  const episodeAudits: ForwardRiskOptionsV7EpisodeAudit[] = [];
  const leads: number[] = [];
  let anticipated = 0;

  for (const episode of episodes) {
    const start = Math.max(0, episode.peakIndex - PRE_PEAK_LOOKBACK_SESSIONS);
    for (let i = start; i <= episode.peakIndex; i++) prePeakIndexes.add(i);
    const candidates: Array<{ index: number; point: ForwardRiskOptionsV7Point }> = [];
    for (let i = start; i <= episode.peakIndex; i++) {
      const point = byIndex.get(i);
      if (point) candidates.push({ index: i, point });
    }
    if (!candidates.length) continue;
    const first = candidates.find(row => row.point.signalScorePct >= SIGNAL_SCORE * 100) ?? null;
    if (first) {
      anticipated++;
      leads.push(episode.peakIndex - first.index);
    }
    episodeAudits.push({
      peakDate: dates[episode.peakIndex],
      breachDate: dates[episode.breachIndex],
      firstSignalDateBeforePeak: first?.point.informationDate ?? null,
      leadSessionsBeforePeak: first ? episode.peakIndex - first.index : null
    });
  }

  const signalRows = inWindow.filter(row => row.score >= SIGNAL_SCORE);
  const falseRows = signalRows.filter(row => !prePeakIndexes.has(row.index));
  const anticipationRatePct = episodeAudits.length ? anticipated / episodeAudits.length * 100 : null;
  const medianLeadSessionsBeforePeak = nullableMedian(leads);
  const falseSignalTimePct = inWindow.length ? falseRows.length / inWindow.length * 100 : null;
  const researchGatePass = (anticipationRatePct ?? 0) >= 50
    && (medianLeadSessionsBeforePeak ?? 0) >= 10
    && (falseSignalTimePct ?? 100) <= 35;

  return {
    version: FORWARD_RISK_OPTIONS_V7,
    methodology: 'PAST_ONLY_OPTIONS_IMPLIED_STRESS_NO_LABEL_FIT',
    status: inWindow.length >= 60 ? 'VALID' : 'INSUFFICIENT_DATA',
    startDate: input.startDate,
    endDate: input.endDate,
    forecastsEvaluated: inWindow.length,
    signalForecasts: signalRows.length,
    auditableEpisodes: episodeAudits.length,
    anticipatedEpisodes: anticipated,
    anticipationRatePct,
    medianLeadSessionsBeforePeak,
    falseSignalTimePct,
    researchGatePass,
    points,
    episodeAudits,
    notes: [
      'V7 uses observed options-implied volatility indices from Cboe: VIX, VIX9D and VVIX.',
      'There are no fitted coefficients, future drawdown labels, probability calibration or optimization grid.',
      'Each raw component is converted to a percentile using only its preceding 252-756 observations.',
      'The gate is frozen before evaluation and is identical to V6: anticipation >=50%, median lead >=10 sessions, false signal time <=35%.',
      'V7 is research-only and is not connected to Custodia, replay decisions, sizing or alerts.'
    ]
  };
}

function empty(input: { startDate: string; endDate: string }, notes: string[]): ForwardRiskOptionsV7Result {
  return {
    version: FORWARD_RISK_OPTIONS_V7,
    methodology: 'PAST_ONLY_OPTIONS_IMPLIED_STRESS_NO_LABEL_FIT',
    status: 'INSUFFICIENT_DATA',
    startDate: input.startDate,
    endDate: input.endDate,
    forecastsEvaluated: 0,
    signalForecasts: 0,
    auditableEpisodes: 0,
    anticipatedEpisodes: 0,
    anticipationRatePct: null,
    medianLeadSessionsBeforePeak: null,
    falseSignalTimePct: null,
    researchGatePass: false,
    points: [],
    episodeAudits: [],
    notes
  };
}
