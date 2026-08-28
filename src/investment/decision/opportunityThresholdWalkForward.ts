import type { OpportunityOutcomeBacktestResult, OpportunityOutcomeEvent, OpportunityOutcomeHorizon } from './opportunityOutcomeBacktest';

export interface OpportunityThresholds {
  minScore: number;
  minMomentum120Pct: number;
  maxAnnualizedVolatilityPct: number;
  maxRank: 1 | 2 | 3;
}

export interface OpportunityWalkForwardFold {
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  selectedThresholds: OpportunityThresholds;
  trainEvaluated20: number;
  trainAverageExcess20Pct: number | null;
  trainOutperform20Pct: number | null;
  testEvaluated20: number;
  testAverageExcess20Pct: number | null;
  testOutperform20Pct: number | null;
}

export interface OpportunityThresholdWalkForwardResult {
  scope: 'WALK_FORWARD_THRESHOLD_RESEARCH';
  folds: OpportunityWalkForwardFold[];
  testEventCount: number;
  aggregateMetrics: Array<{
    horizonSessions: OpportunityOutcomeHorizon;
    evaluated: number;
    averageReturnPct: number | null;
    positiveHitRatePct: number | null;
    averageExcessReturnPct: number | null;
    outperformRatePct: number | null;
  }>;
  assessment: 'POSITIVE_RELATIVE_EVIDENCE' | 'MIXED_OR_INSUFFICIENT_EVIDENCE' | 'NO_POSITIVE_RELATIVE_EVIDENCE';
  notes: string[];
}

const GRID: OpportunityThresholds[] = [];
for (const minScore of [2, 3, 4, 5, 6])
  for (const minMomentum120Pct of [0, 3, 6, 9])
    for (const maxAnnualizedVolatilityPct of [15, 20, 25, 30])
      for (const maxRank of [1, 2, 3] as const)
        GRID.push({ minScore, minMomentum120Pct, maxAnnualizedVolatilityPct, maxRank });

function matches(e: OpportunityOutcomeEvent, t: OpportunityThresholds): boolean {
  return e.score >= t.minScore && e.momentum120Pct > t.minMomentum120Pct && e.annualizedVolatilityPct <= t.maxAnnualizedVolatilityPct && e.rank <= t.maxRank;
}
function mean(values: number[]): number | null { return values.length ? values.reduce((s,v)=>s+v,0)/values.length : null; }
function pct(count: number, total: number): number | null { return total ? count / total * 100 : null; }
function round(v: number | null): number | null { return v == null ? null : Number(v.toFixed(6)); }
function metric(events: OpportunityOutcomeEvent[], horizon: OpportunityOutcomeHorizon) {
  const rows = events.filter(e => e.forwardReturnsPct[horizon] != null && e.excessReturnsPct[horizon] != null);
  const ret = rows.map(e => e.forwardReturnsPct[horizon]!);
  const excess = rows.map(e => e.excessReturnsPct[horizon]!);
  return {
    evaluated: rows.length,
    averageReturnPct: round(mean(ret)),
    positiveHitRatePct: round(pct(ret.filter(v=>v>0).length, ret.length)),
    averageExcessReturnPct: round(mean(excess)),
    outperformRatePct: round(pct(excess.filter(v=>v>0).length, excess.length))
  };
}

function chooseThresholds(train: OpportunityOutcomeEvent[], minimumEvents: number): { thresholds: OpportunityThresholds; metric20: ReturnType<typeof metric> } | null {
  let best: { thresholds: OpportunityThresholds; metric20: ReturnType<typeof metric>; score: number } | null = null;
  for (const thresholds of GRID) {
    const selected = train.filter(e => matches(e, thresholds));
    const m = metric(selected, 20);
    if (m.evaluated < minimumEvents || m.averageExcessReturnPct == null || m.outperformRatePct == null) continue;
    // Prefer genuine relative edge, not merely absolute positive return. Penalize sub-50% breadth.
    const objective = m.averageExcessReturnPct + (m.outperformRatePct - 50) * 0.02;
    if (!best || objective > best.score + 1e-12 || (Math.abs(objective - best.score) < 1e-12 && m.evaluated > best.metric20.evaluated)) {
      best = { thresholds, metric20: m, score: objective };
    }
  }
  return best ? { thresholds: best.thresholds, metric20: best.metric20 } : null;
}

export class OpportunityThresholdWalkForward {
  static run(
    base: OpportunityOutcomeBacktestResult,
    options: { minimumTrainWindows?: number; testWindows?: number; stepWindows?: number; minimumTrainEvents?: number } = {}
  ): OpportunityThresholdWalkForwardResult {
    const dates = [...new Set(base.events.map(e => e.informationDate))].sort();
    const minimumTrainWindows = options.minimumTrainWindows ?? 24;
    const testWindows = options.testWindows ?? 12;
    const stepWindows = options.stepWindows ?? testWindows;
    const minimumTrainEvents = options.minimumTrainEvents ?? 12;
    if (dates.length < minimumTrainWindows + testWindows) throw new Error('Ventanas insuficientes para walk-forward de umbrales.');

    const folds: OpportunityWalkForwardFold[] = [];
    const selectedTestEvents: OpportunityOutcomeEvent[] = [];
    for (let trainEndIndex = minimumTrainWindows - 1; trainEndIndex + testWindows < dates.length; trainEndIndex += stepWindows) {
      const trainDates = new Set(dates.slice(0, trainEndIndex + 1));
      const testDates = new Set(dates.slice(trainEndIndex + 1, Math.min(dates.length, trainEndIndex + 1 + testWindows)));
      const train = base.events.filter(e => trainDates.has(e.informationDate));
      const testAll = base.events.filter(e => testDates.has(e.informationDate));
      const chosen = chooseThresholds(train, minimumTrainEvents);
      if (!chosen || testDates.size === 0) continue;
      const test = testAll.filter(e => matches(e, chosen.thresholds));
      selectedTestEvents.push(...test);
      const test20 = metric(test, 20);
      const testDateList = [...testDates].sort();
      folds.push({
        trainStart: dates[0], trainEnd: dates[trainEndIndex], testStart: testDateList[0], testEnd: testDateList.at(-1)!,
        selectedThresholds: chosen.thresholds,
        trainEvaluated20: chosen.metric20.evaluated,
        trainAverageExcess20Pct: chosen.metric20.averageExcessReturnPct,
        trainOutperform20Pct: chosen.metric20.outperformRatePct,
        testEvaluated20: test20.evaluated,
        testAverageExcess20Pct: test20.averageExcessReturnPct,
        testOutperform20Pct: test20.outperformRatePct
      });
    }

    const aggregateMetrics = ([5,20,60] as OpportunityOutcomeHorizon[]).map(h => ({ horizonSessions: h, ...metric(selectedTestEvents, h) }));
    const m20 = aggregateMetrics.find(m => m.horizonSessions === 20)!;
    const m60 = aggregateMetrics.find(m => m.horizonSessions === 60)!;
    const enough = m20.evaluated >= 20 && m60.evaluated >= 15;
    const positive20 = (m20.averageExcessReturnPct ?? -Infinity) > 0 && (m20.outperformRatePct ?? 0) > 50;
    const positive60 = (m60.averageExcessReturnPct ?? -Infinity) > 0 && (m60.outperformRatePct ?? 0) > 50;
    const assessment = enough && positive20 && positive60
      ? 'POSITIVE_RELATIVE_EVIDENCE'
      : enough ? 'NO_POSITIVE_RELATIVE_EVIDENCE' : 'MIXED_OR_INSUFFICIENT_EVIDENCE';

    return {
      scope: 'WALK_FORWARD_THRESHOLD_RESEARCH', folds, testEventCount: selectedTestEvents.length, aggregateMetrics, assessment,
      notes: [
        'Cada fold elige umbrales usando solo ventanas anteriores y los evalúa en ventanas posteriores no usadas para elegirlos.',
        'La selección optimiza evidencia relativa a 20 sesiones con mínimo de eventos; no optimiza rentabilidad absoluta.',
        'Los umbrales walk-forward son investigación y no se promueven automáticamente a producción.',
        'Persiste el sesgo residual de survivorship del universo actualmente consultable.'
      ]
    };
  }
}
