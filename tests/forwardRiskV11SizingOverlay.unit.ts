import crypto from 'node:crypto';
import {
  FORWARD_RISK_V11_POLICY,
  FORWARD_RISK_V11_POLICY_FINGERPRINT,
  FORWARD_RISK_V11_VALIDATION_GATE,
  decideForwardRiskV11Sizing,
  deployFractionForForwardRiskV11Score
} from '../src/investment/decision/forwardRiskV11SizingOverlay';

function assertNear(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 1e-12) throw new Error(`FORWARD_RISK_V11_POLICY_GUARD_FAIL:${label}:${actual}:${expected}`);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

if (FORWARD_RISK_V11_POLICY.policyVersion !== 'V11_POLICY_1') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:VERSION');
if (FORWARD_RISK_V11_POLICY.productionIntegration !== 'RESEARCH_ONLY_NOT_CONNECTED') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:PRODUCTION_MUST_STAY_DISCONNECTED');
if (FORWARD_RISK_V11_POLICY.existingHoldingsAction !== 'NEVER_SELL_OR_REDUCE') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:NO_SELL_RULE');
if (FORWARD_RISK_V11_POLICY.baseDecision.source !== 'PORTFOLIO_CANDIDATE_GATE' || FORWARD_RISK_V11_POLICY.baseDecision.rule !== 'ELIGIBLE_REQUIRED_FOR_ANY_DEPLOYMENT') {
  throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:BASE_GATE_CHANGED');
}
if (FORWARD_RISK_V11_POLICY.riskInput.scoreDefinition !== 'MAX_V5_VULNERABILITY_V7_OPTIONS') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:RISK_SCORE_CHANGED');
if (FORWARD_RISK_V11_POLICY.riskInput.activationScorePct !== 80) throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:ACTIVATION_CHANGED');
if (FORWARD_RISK_V11_POLICY.sizing.minimumDeployFractionAtMaximumRisk !== 0.5) throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:MIN_DEPLOY_CHANGED');
if (FORWARD_RISK_V11_POLICY.sizing.withheldCash !== 'RETAIN_AS_REMUNERATED_CASH_NO_FORCED_RELEASE') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:WAITING_STATE_REINTRODUCED');

assertNear(deployFractionForForwardRiskV11Score(0), 1, 'DEPLOY_0');
assertNear(deployFractionForForwardRiskV11Score(80), 1, 'DEPLOY_80');
assertNear(deployFractionForForwardRiskV11Score(85), 0.875, 'DEPLOY_85');
assertNear(deployFractionForForwardRiskV11Score(90), 0.75, 'DEPLOY_90');
assertNear(deployFractionForForwardRiskV11Score(95), 0.625, 'DEPLOY_95');
assertNear(deployFractionForForwardRiskV11Score(100), 0.5, 'DEPLOY_100');
assertNear(deployFractionForForwardRiskV11Score(120), 0.5, 'DEPLOY_CLAMP_HIGH');
assertNear(deployFractionForForwardRiskV11Score(-20), 1, 'DEPLOY_CLAMP_LOW');

const rejected = decideForwardRiskV11Sizing({ opportunityEligible: false, v5VulnerabilityScorePct: 100, v7OptionsScorePct: 100 });
if (rejected.action !== 'NO_DEPLOYMENT_BASE_GATE_REJECTED' || rejected.deployFraction !== 0) throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:CANNOT_OVERRIDE_REJECTED');
const continuous = decideForwardRiskV11Sizing({ opportunityEligible: true, v5VulnerabilityScorePct: 92, v7OptionsScorePct: 84 });
assertNear(continuous.combinedRiskScorePct, 92, 'MAX_SCORE');
assertNear(continuous.deployFraction, 0.7, 'DEPLOY_92');
assertNear(continuous.retainCashFraction, 0.3, 'CASH_92');
if (continuous.action !== 'DEPLOY_SCALED_NEXT_OPEN' || continuous.reason !== 'CONTINUOUS_RISK_SIZING') throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:CONTINUOUS_ACTION');

if (FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualPasses !== 4
  || FORWARD_RISK_V11_VALIDATION_GATE.validBlindAssetsRequired !== 6
  || FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualDrawdownReductionPctPoints !== 0.5
  || FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualFinalDeltaPctOfContributions !== -0.5
  || FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualWealthEfficiencyRatio !== 1) {
  throw new Error('FORWARD_RISK_V11_POLICY_GUARD_FAIL:VALIDATION_GATE_CHANGED');
}

const canonicalPolicy = {
  policyVersion: FORWARD_RISK_V11_POLICY.policyVersion,
  purpose: FORWARD_RISK_V11_POLICY.purpose,
  productionIntegration: FORWARD_RISK_V11_POLICY.productionIntegration,
  existingHoldingsAction: FORWARD_RISK_V11_POLICY.existingHoldingsAction,
  baseDecision: FORWARD_RISK_V11_POLICY.baseDecision,
  riskInput: FORWARD_RISK_V11_POLICY.riskInput,
  sizing: FORWARD_RISK_V11_POLICY.sizing,
  economicSemantics: FORWARD_RISK_V11_POLICY.economicSemantics
};
const actualFingerprint = `sha256:${crypto.createHash('sha256').update(stable(canonicalPolicy)).digest('hex')}`;
if (actualFingerprint !== FORWARD_RISK_V11_POLICY_FINGERPRINT) throw new Error(`FORWARD_RISK_V11_POLICY_GUARD_FAIL:FINGERPRINT:${actualFingerprint}`);

console.log('forwardRiskV11SizingOverlay.unit: PASS');
