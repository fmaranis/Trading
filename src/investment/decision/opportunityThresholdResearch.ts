import type { OpportunityOutcomeBacktestResult, OpportunityOutcomeEvent, OpportunityOutcomeHorizon } from './opportunityOutcomeBacktest';

export interface OpportunityThresholdConfig {
  maxRank: 1 | 2 | 3;
  minimumScore: number;
  minimumMomentum120Pct: number;
  maximumVolatilityPct: number;
}

export interface OpportunityThresholdMetrics {
  events: number;
  metrics: Array<{
    horizonSessions: OpportunityOutcomeHorizon;
    evaluated: number;
    averageReturnPct: number | null;
    positiveHitRatePct: number | null;
    averageExcessReturnPct: number | null;
    outperformRatePct: number | null;
  }>;
}

export interface OpportunityThresholdResearchResult {
  methodology: 'TEMPORAL_TRAIN_HOLDOUT_THRESHOLD_RESEARCH';
  trainSharePct: number;
  trainEndDate: string | null;
  holdoutStartDate: string | null;
  candidateCount: number;
  baseline: OpportunityThresholdConfig;
  selected: OpportunityThresholdConfig | null;
  train: OpportunityThresholdMetrics | null;
  holdout: OpportunityThresholdMetrics | null;
  holdoutAssessment:
    | 'POSITIVE_RELATIVE_EVIDENCE'
    | 'MIXED_RELATIVE_EVIDENCE'
    | 'NO_POSITIVE_RELATIVE_EVIDENCE'
    | 'INSUFFICIENT_HOLDOUT_SAMPLE';
  deploymentRecommendation: 'PROMOTE_FOR_REVIEW' | 'KEEP_EXPERIMENTAL';
  notes: string[];
}

const BASELINE: OpportunityThresholdConfig = {
  maxRank: 3,
  minimumScore: 2,
  minimumMomentum120Pct: 0,
  maximumVolatilityPct: 30
};

function eligible(e: OpportunityOutcomeEvent, c: OpportunityThresholdConfig): boolean {
  return e.rank <= c.maxRank
    && e.score >= c.minimumScore
    && e.momentum120Pct >= c.minimumMomentum120Pct
    && e.annualizedVolatilityPct <= c.maximumVolatilityPct;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
function round(v: number | null): number | null { return v == null ? null : Number(v.toFixed(6)); }

function summarize(events: OpportunityOutcomeEvent[]): OpportunityThresholdMetrics {
  const horizons: OpportunityOutcomeHorizon[] = [5, 20, 60];
  return {
    events: events.length,
    metrics: horizons.map(h => {
      const rows = events.filter(e => e.forwardReturnsPct[h] != null && e.excessReturnsPct[h] != null);
      const returns = rows.map(e => e.forwardReturnsPct[h]!);
      const excess = rows.map(e => e.excessReturnsPct[h]!);
      return {
        horizonSessions: h,
        evaluated: rows.length,
        averageReturnPct: round(mean(returns)),
        positiveHitRatePct: returns.length ? round(returns.filter(v => v > 0).length / returns.length * 100) : null,
        averageExcessReturnPct: round(mean(excess)),
        outperformRatePct: excess.length ? round(excess.filter(v => v > 0).length / excess.length * 100) : null
      };
    })
  };
}

function metricAt(metrics: OpportunityThresholdMetrics, h: OpportunityOutcomeHorizon) {
  return metrics.metrics.find(m => m.horizonSessions === h)!;
}

function trainingScore(metrics: OpportunityThresholdMetrics): number {
  const m20 = metricAt(metrics, 20);
  const m60 = metricAt(metrics, 60);
  if (m20.evaluated < 12 || m60.evaluated < 8) return -Infinity;
  const excess20 = m20.averageExcessReturnPct ?? -99;
  const excess60 = m60.averageExcessReturnPct ?? -99;
  const out20 = (m20.outperformRatePct ?? 0) - 50;
  const out60 = (m60.outperformRatePct ?? 0) - 50;
  // Relative performance dominates. Hit-rate contributes only weakly to avoid selecting
  // assets that rise with the whole market but add no cross-sectional value.
  return excess20 * 0.35 + excess60 * 0.45 + out20 * 0.01 + out60 * 0.01;
}

function candidates(): OpportunityThresholdConfig[] {
  const result: OpportunityThresholdConfig[] = [];
  for (const maxRank of [1, 2, 3] as const) {
    for (const minimumScore of [2, 3, 4, 5, 6]) {
      for (const minimumMomentum120Pct of [0, 3, 5, 8, 12]) {
        for (const maximumVolatilityPct of [20, 25, 30]) {
          result.push({ maxRank, minimumScore, minimumMomentum120Pct, maximumVolatilityPct });
        }
      }
    }
  }
  return result;
}

function assessHoldout(metrics: OpportunityThresholdMetrics): OpportunityThresholdResearchResult['holdoutAssessment'] {
  const m20 = metricAt(metrics, 20);
  const m60 = metricAt(metrics, 60);
  if (m20.evaluated < 8 || m60.evaluated < 6) return 'INSUFFICIENT_HOLDOUT_SAMPLE';
  const positive20 = (m20.averageExcessReturnPct ?? -Infinity) > 0 && (m20.outperformRatePct ?? 0) >= 50;
  const positive60 = (m60.averageExcessReturnPct ?? -Infinity) > 0 && (m60.outperformRatePct ?? 0) >= 50;
  if (positive20 && positive60) return 'POSITIVE_RELATIVE_EVIDENCE';
  if (positive20 || positive60) return 'MIXED_RELATIVE_EVIDENCE';
  return 'NO_POSITIVE_RELATIVE_EVIDENCE';
}

export class OpportunityThresholdResearchEngine {
  static run(result: OpportunityOutcomeBacktestResult, trainShare = 0.70): OpportunityThresholdResearchResult {
    const dates = [...new Set(result.events.map(e => e.informationDate))].sort();
    if (dates.length < 10) throw new Error('Se requieren al menos 10 ventanas temporales para calibración/holdout.');
    const trainCount = Math.max(1, Math.min(dates.length - 1, Math.floor(dates.length * trainShare)));
    const trainDates = new Set(dates.slice(0, trainCount));
    const holdoutDates = new Set(dates.slice(trainCount));
    const trainEvents = result.events.filter(e => trainDates.has(e.informationDate));
    const holdoutEvents = result.events.filter(e => holdoutDates.has(e.informationDate));

    let selected: OpportunityThresholdConfig | null = null;
    let selectedTrain: OpportunityThresholdMetrics | null = null;
    let bestScore = -Infinity;
    const grid = candidates();
    for (const config of grid) {
      const metrics = summarize(trainEvents.filter(e => eligible(e, config)));
      const score = trainingScore(metrics);
      if (score > bestScore + 1e-12) {
        bestScore = score;
        selected = config;
        selectedTrain = metrics;
      }
    }

    const holdout = selected ? summarize(holdoutEvents.filter(e => eligible(e, selected!))) : null;
    const assessment = holdout ? assessHoldout(holdout) : 'INSUFFICIENT_HOLDOUT_SAMPLE';
    return {
      methodology: 'TEMPORAL_TRAIN_HOLDOUT_THRESHOLD_RESEARCH',
      trainSharePct: Number((trainCount / dates.length * 100).toFixed(2)),
      trainEndDate: dates[trainCount - 1] ?? null,
      holdoutStartDate: dates[trainCount] ?? null,
      candidateCount: grid.length,
      baseline: BASELINE,
      selected,
      train: selectedTrain,
      holdout,
      holdoutAssessment: assessment,
      deploymentRecommendation: assessment === 'POSITIVE_RELATIVE_EVIDENCE' ? 'PROMOTE_FOR_REVIEW' : 'KEEP_EXPERIMENTAL',
      notes: [
        'Los umbrales se seleccionan exclusivamente con el tramo temporal de calibración; el holdout no participa en la selección.',
        'La función objetivo prioriza exceso de retorno y frecuencia de outperform a 20/60 sesiones, no rentabilidad absoluta.',
        'PROMOTE_FOR_REVIEW exige evidencia relativa positiva simultánea a 20 y 60 sesiones con muestra mínima.',
        'No se modifican automáticamente las reglas de producción: la promoción requiere validación independiente y revisión explícita.',
        'Persiste survivorship bias porque el universo parte de instrumentos actualmente consultables.'
      ]
    };
  }
}
