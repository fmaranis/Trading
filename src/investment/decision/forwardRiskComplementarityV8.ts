import type { ForwardRiskVulnerabilityV5Result } from './forwardRiskVulnerabilityV5';
import type { ForwardRiskOptionsV7Result } from './forwardRiskOptionsV7';

export const FORWARD_RISK_COMPLEMENTARITY_V8 = 'FORWARD_RISK_COMPLEMENTARITY_V8' as const;

const V5_VULNERABLE_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;
const PRE_PEAK_LOOKBACK_SESSIONS = 63;

export interface ForwardRiskComplementarityV8EpisodeAudit {
  peakDate: string;
  breachDate: string;
  v5SignalDate: string | null;
  v7SignalDate: string | null;
  firstCombinedSignalDate: string | null;
  leadSessionsBeforePeak: number | null;
  source: 'V5' | 'V7' | 'BOTH' | null;
}

export interface ForwardRiskComplementarityV8Result {
  version: typeof FORWARD_RISK_COMPLEMENTARITY_V8;
  methodology: 'FROZEN_V5_OR_V7_COMPLEMENTARITY_DIAGNOSTIC_NO_RETUNING';
  status: 'VALID' | 'INSUFFICIENT_DATA';
  startDate: string;
  endDate: string;
  forecastsEvaluated: number;
  combinedSignalForecasts: number;
  auditableEpisodes: number;
  anticipatedEpisodes: number;
  anticipationRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  falseSignalTimePct: number | null;
  v5OnlyEpisodes: number;
  v7OnlyEpisodes: number;
  bothEpisodes: number;
  researchGatePass: boolean;
  episodeAudits: ForwardRiskComplementarityV8EpisodeAudit[];
  notes: string[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function runForwardRiskComplementarityV8(input: {
  v5: ForwardRiskVulnerabilityV5Result;
  v7: ForwardRiskOptionsV7Result;
}): ForwardRiskComplementarityV8Result {
  const { v5, v7 } = input;
  const startDate = v5.startDate > v7.startDate ? v5.startDate : v7.startDate;
  const endDate = v5.endDate < v7.endDate ? v5.endDate : v7.endDate;
  if (v5.status !== 'VALID' || v7.status !== 'VALID') return empty(startDate, endDate, ['V5 and V7 must both be VALID.']);

  const v5ByDate = new Map(v5.points.map(point => [point.informationDate, point] as const));
  const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point] as const));
  const dates = [...v5ByDate.keys()].filter(date => v7ByDate.has(date) && date >= startDate && date <= endDate).sort();
  if (dates.length < 60) return empty(startDate, endDate, ['Insufficient overlapping V5/V7 forecast dates.']);

  const dateIndex = new Map(dates.map((date, index) => [date, index] as const));
  const combinedSignalDates = new Set<string>();
  for (const date of dates) {
    const v5Point = v5ByDate.get(date)!;
    const v7Point = v7ByDate.get(date)!;
    if (v5Point.vulnerabilityScorePct >= V5_VULNERABLE_SCORE_PCT || v7Point.signalScorePct >= V7_SIGNAL_SCORE_PCT) combinedSignalDates.add(date);
  }

  const v7Episodes = new Map(v7.episodeAudits.map(ep => [ep.peakDate, ep] as const));
  const episodeAudits: ForwardRiskComplementarityV8EpisodeAudit[] = [];
  const prePeakDates = new Set<string>();
  const leads: number[] = [];
  let anticipated = 0;
  let v5OnlyEpisodes = 0;
  let v7OnlyEpisodes = 0;
  let bothEpisodes = 0;

  for (const ep5 of v5.episodeAudits) {
    const ep7 = v7Episodes.get(ep5.peakDate);
    if (!ep7) continue;
    const peakIndex = dateIndex.get(ep5.peakDate);
    if (peakIndex == null) continue;
    const lookbackStart = Math.max(0, peakIndex - PRE_PEAK_LOOKBACK_SESSIONS);
    for (let i = lookbackStart; i <= peakIndex; i++) prePeakDates.add(dates[i]);

    const v5Signal = ep5.firstVulnerableDateBeforePeak;
    const v7Signal = ep7.firstSignalDateBeforePeak;
    const candidates = [v5Signal, v7Signal].filter((value): value is string => Boolean(value && dateIndex.has(value)));
    let firstCombinedSignalDate: string | null = null;
    let lead: number | null = null;
    if (candidates.length) {
      firstCombinedSignalDate = [...candidates].sort()[0];
      const signalIndex = dateIndex.get(firstCombinedSignalDate)!;
      lead = Math.max(0, peakIndex - signalIndex);
      anticipated++;
      leads.push(lead);
      if (v5Signal && v7Signal) bothEpisodes++;
      else if (v5Signal) v5OnlyEpisodes++;
      else v7OnlyEpisodes++;
    }

    episodeAudits.push({
      peakDate: ep5.peakDate,
      breachDate: ep5.breachDate,
      v5SignalDate: v5Signal,
      v7SignalDate: v7Signal,
      firstCombinedSignalDate,
      leadSessionsBeforePeak: lead,
      source: v5Signal && v7Signal ? 'BOTH' : v5Signal ? 'V5' : v7Signal ? 'V7' : null
    });
  }

  const falseSignals = [...combinedSignalDates].filter(date => !prePeakDates.has(date));
  const anticipationRatePct = episodeAudits.length ? anticipated / episodeAudits.length * 100 : null;
  const medianLeadSessionsBeforePeak = median(leads);
  const falseSignalTimePct = dates.length ? falseSignals.length / dates.length * 100 : null;
  const researchGatePass = (anticipationRatePct ?? 0) >= 50
    && (medianLeadSessionsBeforePeak ?? 0) >= 10
    && (falseSignalTimePct ?? 100) <= 35;

  return {
    version: FORWARD_RISK_COMPLEMENTARITY_V8,
    methodology: 'FROZEN_V5_OR_V7_COMPLEMENTARITY_DIAGNOSTIC_NO_RETUNING',
    status: 'VALID',
    startDate,
    endDate,
    forecastsEvaluated: dates.length,
    combinedSignalForecasts: combinedSignalDates.size,
    auditableEpisodes: episodeAudits.length,
    anticipatedEpisodes: anticipated,
    anticipationRatePct,
    medianLeadSessionsBeforePeak,
    falseSignalTimePct,
    v5OnlyEpisodes,
    v7OnlyEpisodes,
    bothEpisodes,
    researchGatePass,
    episodeAudits,
    notes: [
      'V8 does not fit or tune a new predictor. It is the OR-union of the already frozen V5 >=80 vulnerability signal and V7 >=80 options-implied signal.',
      'The combined screening gate remains anticipation >=50%, median lead >=10 sessions and false signal time <=35%.',
      'Because V8 was conceived after observing V5 and V7 results on 2011-2026, a pass is diagnostic only and requires independent confirmation before any economic or production gate.',
      'V5 uses current-vintage FRED data, so any apparent pass also requires a point-in-time vintage-safe macro retest.',
      'No V8 output feeds Custodia, replay decisions, sizing or alerts.'
    ]
  };
}

function empty(startDate: string, endDate: string, notes: string[]): ForwardRiskComplementarityV8Result {
  return {
    version: FORWARD_RISK_COMPLEMENTARITY_V8,
    methodology: 'FROZEN_V5_OR_V7_COMPLEMENTARITY_DIAGNOSTIC_NO_RETUNING',
    status: 'INSUFFICIENT_DATA',
    startDate,
    endDate,
    forecastsEvaluated: 0,
    combinedSignalForecasts: 0,
    auditableEpisodes: 0,
    anticipatedEpisodes: 0,
    anticipationRatePct: null,
    medianLeadSessionsBeforePeak: null,
    falseSignalTimePct: null,
    v5OnlyEpisodes: 0,
    v7OnlyEpisodes: 0,
    bothEpisodes: 0,
    researchGatePass: false,
    episodeAudits: [],
    notes
  };
}
