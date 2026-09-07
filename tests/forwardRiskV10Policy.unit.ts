import { createHash } from 'node:crypto';
import {
  FORWARD_RISK_V10_DATA_QUALITY_GATE,
  FORWARD_RISK_V10_POLICY,
  FORWARD_RISK_V10_POLICY_FINGERPRINT,
  FORWARD_RISK_V10_VALIDATION_GATE,
  decideForwardRiskV10
} from '../src/investment/decision/forwardRiskV10Policy';

function requireAction(input: Parameters<typeof decideForwardRiskV10>[0], action: ReturnType<typeof decideForwardRiskV10>['action'], reason: ReturnType<typeof decideForwardRiskV10>['reason']): void {
  const actual = decideForwardRiskV10(input);
  if (actual.action !== action || actual.reason !== reason) {
    throw new Error(`FORWARD_RISK_V10_POLICY_GUARD_FAIL:${JSON.stringify({ input, expected: { action, reason }, actual })}`);
  }
}

if (FORWARD_RISK_V10_POLICY.policyVersion !== 'V10_POLICY_1') throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:VERSION');
if (FORWARD_RISK_V10_POLICY.existingHoldingsAction !== 'NEVER_SELL_OR_REDUCE') throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:EXISTING_HOLDINGS_MUST_NEVER_SELL');
if (FORWARD_RISK_V10_POLICY.riskInput.v5ThresholdPct !== 80 || FORWARD_RISK_V10_POLICY.riskInput.v7ThresholdPct !== 80) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:V8_THRESHOLDS_CHANGED');
if (FORWARD_RISK_V10_POLICY.opportunityInput.source !== 'PORTFOLIO_CANDIDATE_GATE' || FORWARD_RISK_V10_POLICY.opportunityInput.signal !== 'ELIGIBLE') throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:OPPORTUNITY_INPUT_CHANGED');
if (FORWARD_RISK_V10_POLICY.opportunityInput.newThresholdsAllowed !== false) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:V10_OPPORTUNITY_THRESHOLD_MUST_NOT_EXIST');
if (FORWARD_RISK_V10_POLICY.newMoneyPolicy.maxDeferralSessions !== 63) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:MAX_DEFERRAL_CHANGED');
if (FORWARD_RISK_V10_POLICY.economicSemantics.contributionEur !== 1000) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:CONTRIBUTION_CHANGED');
if (FORWARD_RISK_V10_POLICY.economicSemantics.executionMode !== 'NEXT_OPEN') throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:EXECUTION_MODE');
if (FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumBars !== 756 || FORWARD_RISK_V10_DATA_QUALITY_GATE.maxAbsoluteOneSessionCloseReturnPct !== 40) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:DATA_QUALITY_GATE');
if (FORWARD_RISK_V10_VALIDATION_GATE.validBlindAssetsRequired !== 6 || FORWARD_RISK_V10_VALIDATION_GATE.minimumIndividualPasses !== 4) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:VALIDATION_GATE');

const decisions = [
  decideForwardRiskV10({ riskActive: false, opportunityEligible: false, hasDeferredCash: false, deferredAgeSessions: 0 }),
  decideForwardRiskV10({ riskActive: true, opportunityEligible: true, hasDeferredCash: false, deferredAgeSessions: 0 }),
  decideForwardRiskV10({ riskActive: true, opportunityEligible: false, hasDeferredCash: false, deferredAgeSessions: 0 }),
  decideForwardRiskV10({ riskActive: true, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 20 }),
  decideForwardRiskV10({ riskActive: false, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 20 }),
  decideForwardRiskV10({ riskActive: true, opportunityEligible: true, hasDeferredCash: true, deferredAgeSessions: 20 }),
  decideForwardRiskV10({ riskActive: true, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 63 })
];
const allowedActions = new Set([
  'INVEST_100_PCT_NEXT_OPEN',
  'DEFER_100_PCT_IN_REMUNERATED_CASH',
  'HOLD_DEFERRED_CASH',
  'RELEASE_100_PCT_NEXT_OPEN'
]);
for (const decision of decisions) {
  if (!allowedActions.has(decision.action)) throw new Error(`FORWARD_RISK_V10_POLICY_GUARD_FAIL:FORBIDDEN_ACTION:${decision.action}`);
}

requireAction(
  { riskActive: false, opportunityEligible: false, hasDeferredCash: false, deferredAgeSessions: 0 },
  'INVEST_100_PCT_NEXT_OPEN',
  'RISK_OFF'
);
requireAction(
  { riskActive: true, opportunityEligible: true, hasDeferredCash: false, deferredAgeSessions: 0 },
  'INVEST_100_PCT_NEXT_OPEN',
  'OPPORTUNITY_OVERRIDES_RISK'
);
requireAction(
  { riskActive: true, opportunityEligible: false, hasDeferredCash: false, deferredAgeSessions: 0 },
  'DEFER_100_PCT_IN_REMUNERATED_CASH',
  'RISK_ON_NO_ELIGIBLE_OPPORTUNITY'
);
requireAction(
  { riskActive: true, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 20 },
  'HOLD_DEFERRED_CASH',
  'DEFERRED_STILL_RISK_ON_NO_ELIGIBLE_OPPORTUNITY'
);
requireAction(
  { riskActive: false, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 20 },
  'RELEASE_100_PCT_NEXT_OPEN',
  'DEFERRED_RELEASE_RISK_OFF'
);
requireAction(
  { riskActive: true, opportunityEligible: true, hasDeferredCash: true, deferredAgeSessions: 20 },
  'RELEASE_100_PCT_NEXT_OPEN',
  'DEFERRED_RELEASE_OPPORTUNITY_ELIGIBLE'
);
const forced = decideForwardRiskV10({ riskActive: true, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: 63 });
if (forced.action !== 'RELEASE_100_PCT_NEXT_OPEN' || forced.reason !== 'DEFERRED_FORCE_RELEASE_MAX_AGE' || !forced.forceRelease) {
  throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:FORCE_RELEASE');
}

const canonicalPolicy = {
  policyVersion: FORWARD_RISK_V10_POLICY.policyVersion,
  purpose: FORWARD_RISK_V10_POLICY.purpose,
  existingHoldingsAction: FORWARD_RISK_V10_POLICY.existingHoldingsAction,
  riskInput: FORWARD_RISK_V10_POLICY.riskInput,
  opportunityInput: FORWARD_RISK_V10_POLICY.opportunityInput,
  newMoneyPolicy: FORWARD_RISK_V10_POLICY.newMoneyPolicy,
  economicSemantics: FORWARD_RISK_V10_POLICY.economicSemantics,
  dataQuality: FORWARD_RISK_V10_DATA_QUALITY_GATE,
  validationGate: FORWARD_RISK_V10_VALIDATION_GATE
};
const actualFingerprint = `sha256:${createHash('sha256').update(JSON.stringify(canonicalPolicy)).digest('hex')}`;
if (actualFingerprint !== FORWARD_RISK_V10_POLICY_FINGERPRINT) {
  throw new Error(`FORWARD_RISK_V10_POLICY_GUARD_FAIL:FINGERPRINT:${actualFingerprint}`);
}

let invalidAgeRejected = false;
try {
  decideForwardRiskV10({ riskActive: true, opportunityEligible: false, hasDeferredCash: true, deferredAgeSessions: -1 });
} catch (error) {
  invalidAgeRejected = error instanceof Error && error.message === 'V10_INVALID_DEFERRED_AGE:-1';
}
if (!invalidAgeRejected) throw new Error('FORWARD_RISK_V10_POLICY_GUARD_FAIL:INVALID_AGE_NOT_REJECTED');

console.log('forwardRiskV10Policy.unit: PASS');
