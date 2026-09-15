import fs from 'node:fs';
import path from 'node:path';
import {
  FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
  resolveForwardRiskContextV1
} from '../src/investment/decision/forwardRiskContextV1';
import { PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL } from '../src/investment/decision/phase6ForwardRiskContextProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_READINESS_FAIL:${label}`);
}
function approx(actual: number | null, expected: number, label: string): void {
  assert(actual != null && Math.abs(actual - expected) < 1e-9, label);
}

assert(FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT === 80, 'V8_THRESHOLD_CHANGED');

const calm = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 35, v7OptionsScorePct: 42 });
assert(calm.status === 'AVAILABLE', 'CALM_CONTEXT_UNAVAILABLE');
approx(calm.contextScorePct, 42, 'CONTEXT_IS_NOT_MAX_SCORE');
assert(calm.highRiskContext === false && calm.source === 'NONE', 'CALM_CONTEXT_MISCLASSIFIED');

const v5High = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 86, v7OptionsScorePct: 55 });
assert(v5High.highRiskContext === true && v5High.source === 'V5', 'V5_OR_RULE_CHANGED');
approx(v5High.contextScorePct, 86, 'V5_MAX_SCORE_CHANGED');

const v7High = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 60, v7OptionsScorePct: 91 });
assert(v7High.highRiskContext === true && v7High.source === 'V7', 'V7_OR_RULE_CHANGED');
approx(v7High.contextScorePct, 91, 'V7_MAX_SCORE_CHANGED');

const both = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 82, v7OptionsScorePct: 88 });
assert(both.highRiskContext === true && both.source === 'BOTH', 'BOTH_RULE_CHANGED');
approx(both.contextScorePct, 88, 'BOTH_MAX_SCORE_CHANGED');

const missing = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: null, v7OptionsScorePct: 90 });
assert(missing.status === 'UNAVAILABLE', 'MISSING_LEG_MUST_NOT_FALL_BACK');
assert(missing.contextScorePct === null && missing.highRiskContext === false, 'MISSING_LEG_CREATED_SIGNAL');

for (const row of [calm, v5High, v7High, both, missing]) {
  assert(row.authority === 'SHADOW_CONTEXT_ONLY', 'CONTEXT_GAINED_AUTHORITY');
  assert(row.canChangeEligibility === false, 'CONTEXT_CAN_CHANGE_ELIGIBILITY');
  assert(row.canChangeRanking === false, 'CONTEXT_CAN_CHANGE_RANKING');
  assert(row.canChangeSizing === false, 'CONTEXT_CAN_CHANGE_SIZING');
  assert(row.canSellOrReduce === false, 'CONTEXT_CAN_SELL_OR_REDUCE');
}

const protocol = PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL;
assert(protocol.status === 'CONTEXT_PREREGISTERED_SAMPLE_NOT_SELECTED_NOT_OPENED', 'PROTOCOL_STATE_CHANGED');
assert(protocol.productionDefault === 'LEGACY', 'PRODUCTION_NOT_LEGACY');
assert(protocol.productionPromotionAllowed === false, 'PRODUCTION_PROMOTION_ENABLED');
assert(protocol.stageA.economicOrdersAllowed === false, 'STAGE_A_CAN_TRADE');
assert(protocol.stageA.economicPolicyDefined === false, 'ECONOMIC_POLICY_PREMATURELY_DEFINED');
assert(protocol.validationSample.status === 'NOT_SELECTED_NOT_OPENED', 'SAMPLE_OPENED_OR_SELECTED');
assert(protocol.validationSample.outcomeInspectionAllowedNow === false, 'OUTCOME_INSPECTION_ENABLED');
assert(protocol.nextFreezeBeforeOpening.marketDataAccessBeforeFreezeAllowed === false, 'MARKET_ACCESS_ALLOWED_BEFORE_FREEZE');
assert(protocol.integrationBoundary.directDailyOnOffAuthority === false, 'DAILY_ON_OFF_REINTRODUCED');
assert(protocol.predecessorDisposition.v9 === 'RETIRED_AS_TESTED', 'V9_REACTIVATED');
assert(protocol.predecessorDisposition.v10 === 'RETIRED_AS_TESTED', 'V10_REACTIVATED');
assert(protocol.predecessorDisposition.v11 === 'RETIRED_AS_TESTED', 'V11_REACTIVATED');

const v8Source = source('src/investment/decision/forwardRiskComplementarityV8.ts');
assert(v8Source.includes('const V5_VULNERABLE_SCORE_PCT = 80;'), 'V8_V5_THRESHOLD_SOURCE_CHANGED');
assert(v8Source.includes('const V7_SIGNAL_SCORE_PCT = 80;'), 'V8_V7_THRESHOLD_SOURCE_CHANGED');

const candidateGateSource = source('src/investment/decision/portfolioCandidateGate.ts');
assert(!candidateGateSource.includes('FORWARD_RISK_CONTEXT_V1'), 'PHASE6_SHADOW_WIRED_INTO_PRODUCT_GATE');

const protocolSource = source('src/investment/decision/phase6ForwardRiskContextProtocol.ts');
assert(protocolSource.includes("status: 'NOT_SELECTED_NOT_OPENED'"), 'UNOPENED_SAMPLE_RECORD_MISSING');
assert(protocolSource.includes("status: 'NOT_DESIGNED'"), 'FUTURE_POLICY_NOT_LEFT_UNDESIGNED');
assert(protocolSource.includes('V12/V13 as retrospective parameter chasing'), 'NO_PARAMETER_CHASING_RULE_MISSING');

const validationRoutesSource = source('server/researchValidationRoutes.ts');
assert(
  validationRoutesSource.includes("archivedJob(\n    'phase5-winner-protection-v2-confirmation'"),
  'PHASE5_CONFIRMATION_ONE_SHOT_NOT_ARCHIVED'
);
assert(
  !validationRoutesSource.includes("id: 'phase5-winner-protection-v2-confirmation'"),
  'PHASE5_CONFIRMATION_EXECUTABLE_BLOCK_STILL_PRESENT'
);
assert(
  validationRoutesSource.includes("id: 'phase6-forward-risk-context-readiness'"),
  'PHASE6_READINESS_JOB_MISSING'
);
assert(
  validationRoutesSource.includes("name: 'Fase 6 · Forward Risk V8 como contexto · readiness'"),
  'PHASE6_READINESS_LABEL_CHANGED'
);

console.log('PHASE6_FORWARD_RISK_CONTEXT_READINESS_PASS', JSON.stringify({
  contextVersion: calm.version,
  thresholdPct: FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
  protocolStatus: protocol.status,
  sampleStatus: protocol.validationSample.status,
  productionDefault: protocol.productionDefault,
  economicPolicyDefined: protocol.stageA.economicPolicyDefined,
  phase5ConfirmationArchived: true
}));
