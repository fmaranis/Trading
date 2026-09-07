export interface ForwardRiskV11SizingInput {
  opportunityEligible: boolean;
  v5VulnerabilityScorePct: number | null;
  v7OptionsScorePct: number | null;
}

export interface ForwardRiskV11SizingDecision {
  opportunityEligible: boolean;
  combinedRiskScorePct: number;
  deployFraction: number;
  retainCashFraction: number;
  action: 'NO_DEPLOYMENT_BASE_GATE_REJECTED' | 'DEPLOY_SCALED_NEXT_OPEN';
  reason: 'BASE_GATE_REJECTED' | 'RISK_AT_OR_BELOW_ACTIVATION' | 'CONTINUOUS_RISK_SIZING';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteScore(value: number | null): number {
  return value != null && Number.isFinite(value) ? clamp(value, 0, 100) : 0;
}

/**
 * Frozen V11 research policy.
 *
 * V11 is not connected to production until a blind validation passes. The
 * existing PortfolioCandidateGate still decides WHETHER fresh cash may be
 * deployed. Forward Risk only scales HOW MUCH of currently available cash is
 * deployed on an eligible monthly decision. Existing holdings are never sold.
 *
 * Unlike V10, withheld cash has no risk-specific release trigger and no 63-day
 * waiting state. It simply remains remunerated portfolio cash until a future
 * ordinary monthly decision again finds the asset ELIGIBLE.
 */
export const FORWARD_RISK_V11_POLICY = {
  policyVersion: 'V11_POLICY_1',
  purpose: 'CONTINUOUS_FORWARD_RISK_NEW_MONEY_SIZING_OVERLAY',
  productionIntegration: 'RESEARCH_ONLY_NOT_CONNECTED',
  existingHoldingsAction: 'NEVER_SELL_OR_REDUCE',
  baseDecision: {
    source: 'PORTFOLIO_CANDIDATE_GATE',
    rule: 'ELIGIBLE_REQUIRED_FOR_ANY_DEPLOYMENT',
    v11CannotOverrideRejected: true
  },
  riskInput: {
    architecture: 'V8_CONTINUOUS_SCORE',
    scoreDefinition: 'MAX_V5_VULNERABILITY_V7_OPTIONS',
    activationScorePct: 80,
    minimumScorePct: 0,
    maximumScorePct: 100
  },
  sizing: {
    deployFractionAtOrBelowActivation: 1,
    minimumDeployFractionAtMaximumRisk: 0.5,
    formula: 'score<=80 ? 1 : 1 - 0.5*((score-80)/20)',
    clampMinimum: 0.5,
    clampMaximum: 1,
    withheldCash: 'RETAIN_AS_REMUNERATED_CASH_NO_FORCED_RELEASE',
    reviewCadence: 'MONTHLY_NEW_MONEY_DECISION'
  },
  economicSemantics: {
    contributionSchedule: 'FIRST_TRADING_SESSION_OF_EACH_CALENDAR_MONTH',
    contributionEur: 1000,
    executionMode: 'NEXT_OPEN',
    wholeShares: true,
    broker: 'MYINVESTOR',
    cashMode: 'HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX',
    taxMode: 'CASH_INTEREST_ONLY_NO_POSITION_SALES'
  }
} as const;

export const FORWARD_RISK_V11_DATA_QUALITY_GATE = {
  minimumBars: 756,
  minimumMonthlyDecisionEvents: 36,
  minimumEligibleDecisionEvents: 12,
  minimumRiskModulatedEligibleEvents: 4,
  maxAbsoluteOneSessionCloseReturnPct: 40,
  duplicateDatesAllowed: false,
  nonPositiveOpenCloseAllowed: false
} as const;

/**
 * V11 is explicitly a return/risk test rather than an absolute-return-only test.
 * A candidate may accept at most 0.5% terminal wealth drag versus contributed
 * capital, but only if flow-adjusted max drawdown improves by >=0.5 percentage
 * points and terminal-wealth-per-drawdown efficiency is not worse.
 */
export const FORWARD_RISK_V11_VALIDATION_GATE = {
  validBlindAssetsRequired: 6,
  minimumIndividualPasses: 4,
  minimumIndividualDrawdownReductionPctPoints: 0.5,
  minimumIndividualFinalDeltaPctOfContributions: -0.5,
  minimumIndividualWealthEfficiencyRatio: 1,
  minimumMedianDrawdownReductionPctPoints: 0.5,
  minimumMedianFinalDeltaPctOfContributions: -0.5,
  minimumMedianWealthEfficiencyRatio: 1,
  individualRule: 'drawdownReductionPctPoints >= 0.5 AND finalDeltaPctOfContributions >= -0.5 AND wealthEfficiencyRatio >= 1'
} as const;

export const FORWARD_RISK_V11_POLICY_FINGERPRINT =
  'sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1' as const;

export function combinedForwardRiskV11Score(input: Pick<ForwardRiskV11SizingInput, 'v5VulnerabilityScorePct' | 'v7OptionsScorePct'>): number {
  return Math.max(finiteScore(input.v5VulnerabilityScorePct), finiteScore(input.v7OptionsScorePct));
}

export function deployFractionForForwardRiskV11Score(scorePct: number): number {
  const score = clamp(scorePct, 0, 100);
  const activation = FORWARD_RISK_V11_POLICY.riskInput.activationScorePct;
  if (score <= activation) return FORWARD_RISK_V11_POLICY.sizing.deployFractionAtOrBelowActivation;
  const scaled = 1 - 0.5 * ((score - activation) / (100 - activation));
  return clamp(
    scaled,
    FORWARD_RISK_V11_POLICY.sizing.clampMinimum,
    FORWARD_RISK_V11_POLICY.sizing.clampMaximum
  );
}

export function decideForwardRiskV11Sizing(input: ForwardRiskV11SizingInput): ForwardRiskV11SizingDecision {
  const combinedRiskScorePct = combinedForwardRiskV11Score(input);
  if (!input.opportunityEligible) {
    return {
      opportunityEligible: false,
      combinedRiskScorePct,
      deployFraction: 0,
      retainCashFraction: 1,
      action: 'NO_DEPLOYMENT_BASE_GATE_REJECTED',
      reason: 'BASE_GATE_REJECTED'
    };
  }

  const deployFraction = deployFractionForForwardRiskV11Score(combinedRiskScorePct);
  return {
    opportunityEligible: true,
    combinedRiskScorePct,
    deployFraction,
    retainCashFraction: 1 - deployFraction,
    action: 'DEPLOY_SCALED_NEXT_OPEN',
    reason: combinedRiskScorePct <= FORWARD_RISK_V11_POLICY.riskInput.activationScorePct
      ? 'RISK_AT_OR_BELOW_ACTIVATION'
      : 'CONTINUOUS_RISK_SIZING'
  };
}
