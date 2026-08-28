import { OpportunityThresholdResearchEngine } from '../src/investment/decision';
import type { OpportunityOutcomeBacktestResult, OpportunityOutcomeEvent } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

function event(date: string, i: number, strong: boolean, holdoutBad = false): OpportunityOutcomeEvent {
  const good = strong && !holdoutBad;
  return {
    informationDate: date,
    ticker: `T${i}.DE`, assetId: `A${i}`, rank: strong ? 1 : 3,
    score: strong ? 6 : 2.2, momentum120Pct: strong ? 12 : 1,
    annualizedVolatilityPct: strong ? 18 : 28,
    forwardReturnsPct: { 5: good ? 1.2 : 0.2, 20: good ? 4 : 0.8, 60: good ? 8 : 2 },
    benchmarkForwardReturnsPct: { 5: 0.5, 20: 1.5, 60: 3 },
    excessReturnsPct: { 5: good ? 0.7 : -0.3, 20: good ? 2.5 : -0.7, 60: good ? 5 : -1 }
  };
}

const dates = Array.from({ length: 20 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-28`);
const events: OpportunityOutcomeEvent[] = [];
for (let i = 0; i < dates.length; i++) {
  for (let j = 0; j < 3; j++) events.push(event(dates[i], i * 3 + j, j === 0));
}
const base: OpportunityOutcomeBacktestResult = {
  scope: 'CAUSAL_OPPORTUNITY_SIGNALS_WITHIN_CURRENTLY_VALIDATED_UNIVERSE',
  eventCount: events.length, observationWindows: dates.length, events,
  metrics: [], notes: []
};

const result = OpportunityThresholdResearchEngine.run(base, 0.70);
check('401 methodology is temporal train holdout', result.methodology === 'TEMPORAL_TRAIN_HOLDOUT_THRESHOLD_RESEARCH');
check('402 candidate grid is finite and nontrivial', result.candidateCount === 225);
check('403 a threshold configuration is selected from training only', result.selected != null);
check('404 selected threshold is stricter than or equal to baseline score gate', (result.selected?.minimumScore ?? 0) >= 2);
check('405 holdout is evaluated independently', (result.holdout?.events ?? 0) > 0);
check('406 positive holdout can be promoted for review', result.deploymentRecommendation === 'PROMOTE_FOR_REVIEW');
check('407 positive holdout requires positive relative evidence', result.holdoutAssessment === 'POSITIVE_RELATIVE_EVIDENCE');
check('408 train ends before holdout starts', Boolean(result.trainEndDate && result.holdoutStartDate && result.trainEndDate < result.holdoutStartDate));

const badEvents = events.map((e, idx) => {
  const dateIndex = dates.indexOf(e.informationDate);
  if (dateIndex < 14) return e;
  return {
    ...e,
    forwardReturnsPct: { 5: 0.1, 20: 0.5, 60: 1 },
    benchmarkForwardReturnsPct: { 5: 0.5, 20: 1.5, 60: 3 },
    excessReturnsPct: { 5: -0.4, 20: -1, 60: -2 }
  } as OpportunityOutcomeEvent;
});
const bad = OpportunityThresholdResearchEngine.run({ ...base, events: badEvents }, 0.70);
check('409 failed holdout remains experimental', bad.deploymentRecommendation === 'KEEP_EXPERIMENTAL');
check('410 holdout failure is not hidden by good training fit', bad.holdoutAssessment === 'NO_POSITIVE_RELATIVE_EVIDENCE');

console.log(`Opportunity threshold research: ${passed}/10 invariants passed.`);
