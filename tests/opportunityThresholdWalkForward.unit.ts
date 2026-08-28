import { OpportunityThresholdWalkForward } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const events: any[] = [];
for (let m = 0; m < 60; m++) {
  const year = 2020 + Math.floor(m / 12);
  const month = String((m % 12) + 1).padStart(2, '0');
  const date = `${year}-${month}-20`;
  // Robust candidate: stricter score/momentum filter has persistent relative edge.
  events.push({
    informationDate: date, ticker: `A${m}`, assetId: `A${m}`, rank: 1, score: 6.5, momentum120Pct: 10,
    annualizedVolatilityPct: 14,
    forwardReturnsPct: { 5: 1.2, 20: 3.0, 60: 7.0 },
    benchmarkForwardReturnsPct: { 5: 0.6, 20: 1.2, 60: 3.0 },
    excessReturnsPct: { 5: 0.6, 20: 1.8, 60: 4.0 }
  });
  // Weak broad signal: satisfies production baseline but underperforms.
  events.push({
    informationDate: date, ticker: `B${m}`, assetId: `B${m}`, rank: 2, score: 2.5, momentum120Pct: 2,
    annualizedVolatilityPct: 28,
    forwardReturnsPct: { 5: 0.2, 20: 0.5, 60: 1.0 },
    benchmarkForwardReturnsPct: { 5: 0.6, 20: 1.2, 60: 3.0 },
    excessReturnsPct: { 5: -0.4, 20: -0.7, 60: -2.0 }
  });
}
const base: any = { scope: 'CAUSAL_OPPORTUNITY_SIGNALS_WITHIN_CURRENTLY_VALIDATED_UNIVERSE', eventCount: events.length, observationWindows: 60, events, metrics: [], notes: [] };
const result = OpportunityThresholdWalkForward.run(base, { minimumTrainWindows: 24, testWindows: 12, stepWindows: 12, minimumTrainEvents: 12 });

check('401 scope is explicit walk-forward research', result.scope === 'WALK_FORWARD_THRESHOLD_RESEARCH');
check('402 creates at least two out-of-sample folds', result.folds.length >= 2);
check('403 every fold train period ends before test period', result.folds.every(f => f.trainEnd < f.testStart));
check('404 selected filters are valid grid thresholds', result.folds.every(f => f.selectedThresholds.minScore >= 2 && f.selectedThresholds.maxRank <= 3));
check('405 training selection uses minimum sample size', result.folds.every(f => f.trainEvaluated20 >= 12));
check('406 out-of-sample test events are produced', result.testEventCount > 0);
const m20 = result.aggregateMetrics.find(m => m.horizonSessions === 20)!;
const m60 = result.aggregateMetrics.find(m => m.horizonSessions === 60)!;
check('407 20-session out-of-sample excess is positive in robust fixture', (m20.averageExcessReturnPct ?? 0) > 0);
check('408 20-session outperform rate exceeds 50 percent', (m20.outperformRatePct ?? 0) > 50);
check('409 60-session out-of-sample excess is positive', (m60.averageExcessReturnPct ?? 0) > 0);
check('410 positive robust fixture earns positive relative evidence assessment', result.assessment === 'POSITIVE_RELATIVE_EVIDENCE');

console.log(`Opportunity threshold walk-forward: ${passed}/10 invariants passed.`);
