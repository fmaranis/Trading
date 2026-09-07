export type ForwardRiskV10Action =
  | 'INVEST_100_PCT_NEXT_OPEN'
  | 'DEFER_100_PCT_IN_REMUNERATED_CASH'
  | 'HOLD_DEFERRED_CASH'
  | 'RELEASE_100_PCT_NEXT_OPEN';

export type ForwardRiskV10DecisionReason =
  | 'RISK_OFF'
  | 'OPPORTUNITY_OVERRIDES_RISK'
  | 'RISK_ON_NO_ELIGIBLE_OPPORTUNITY'
  | 'DEFERRED_STILL_RISK_ON_NO_ELIGIBLE_OPPORTUNITY'
  | 'DEFERRED_RELEASE_RISK_OFF'
  | 'DEFERRED_RELEASE_OPPORTUNITY_ELIGIBLE'
  | 'DEFERRED_FORCE_RELEASE_MAX_AGE';

export interface ForwardRiskV10DecisionInput {
  riskActive: boolean;
  opportunityEligible: boolean;
  hasDeferredCash: boolean;
  deferredAgeSessions: number;
}

export interface ForwardRiskV10Decision {
  action: ForwardRiskV10Action;
  reason: ForwardRiskV10DecisionReason;
  forceRelease: boolean;
}

/**
 * V10 is intentionally not a V9 parameter retune.
 *
 * It never sells or reduces an existing holding. It is an admission controller
 * for new money only: frozen V8 downside evidence can delay a new purchase, but
 * the existing production opportunity gate can override that delay when the
 * asset is already ELIGIBLE for new money on information available that day.
 */
export const FORWARD_RISK_V10_POLICY = {
  policyVersion: 'V10_POLICY_1',
  purpose: 'NEW_MONEY_RISK_OPPORTUNITY_ADMISSION_CONTROL',
  existingHoldingsAction: 'NEVER_SELL_OR_REDUCE',
  riskInput: {
    architecture: 'V8',
    rule: 'V5_VULNERABILITY_GTE_80_OR_V7_OPTIONS_GTE_80',
    v5ThresholdPct: 80,
    v7ThresholdPct: 80
  },
  opportunityInput: {
    source: 'PORTFOLIO_CANDIDATE_GATE',
    signal: 'ELIGIBLE',
    newThresholdsAllowed: false
  },
  newMoneyPolicy: {
    riskOff: 'INVEST_100_PCT_NEXT_OPEN',
    riskOnOpportunityEligible: 'INVEST_100_PCT_NEXT_OPEN',
    riskOnOpportunityNotEligible: 'DEFER_100_PCT_IN_REMUNERATED_CASH',
    deferredReevaluation: 'EVERY_MARKET_SESSION',
    releaseWhenRiskOff: true,
    releaseWhenOpportunityEligible: true,
    maxDeferralSessions: 63,
    forceReleaseAtMaxDeferral: true
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

export const FORWARD_RISK_V10_DATA_QUALITY_GATE = {
  minimumBars: 756,
  minimumContributionEvents: 36,
  minimumDeferredContributionsPerAsset: 6,
  maxAbsoluteOneSessionCloseReturnPct: 40,
  duplicateDatesAllowed: false,
  nonPositiveOpenCloseAllowed: false
} as const;

export const FORWARD_RISK_V10_VALIDATION_GATE = {
  deferredPathHorizonSessions: 63,
  downsideThresholdPct: -5,
  upsideThresholdPct: 5,
  individualRule: 'finalDeltaEur >= 0 AND medianDeferredExecutionPriceImprovementPct >= 0 AND downFirstCount >= upFirstCount',
  validBlindAssetsRequired: 6,
  minimumIndividualPasses: 4,
  medianFinalDeltaEurMustBeNonNegative: true,
  medianDeferredExecutionPriceImprovementPctMustBeNonNegative: true,
  aggregateDownFirstMustBeGteUpFirst: true
} as const;

export const FORWARD_RISK_V10_POLICY_FINGERPRINT =
  'sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f' as const;

export function decideForwardRiskV10(input: ForwardRiskV10DecisionInput): ForwardRiskV10Decision {
  if (!Number.isInteger(input.deferredAgeSessions) || input.deferredAgeSessions < 0) {
    throw new Error(`V10_INVALID_DEFERRED_AGE:${input.deferredAgeSessions}`);
  }

  if (!input.hasDeferredCash) {
    if (!input.riskActive) {
      return { action: 'INVEST_100_PCT_NEXT_OPEN', reason: 'RISK_OFF', forceRelease: false };
    }
    if (input.opportunityEligible) {
      return { action: 'INVEST_100_PCT_NEXT_OPEN', reason: 'OPPORTUNITY_OVERRIDES_RISK', forceRelease: false };
    }
    return {
      action: 'DEFER_100_PCT_IN_REMUNERATED_CASH',
      reason: 'RISK_ON_NO_ELIGIBLE_OPPORTUNITY',
      forceRelease: false
    };
  }

  if (input.deferredAgeSessions >= FORWARD_RISK_V10_POLICY.newMoneyPolicy.maxDeferralSessions) {
    return {
      action: 'RELEASE_100_PCT_NEXT_OPEN',
      reason: 'DEFERRED_FORCE_RELEASE_MAX_AGE',
      forceRelease: true
    };
  }
  if (!input.riskActive) {
    return { action: 'RELEASE_100_PCT_NEXT_OPEN', reason: 'DEFERRED_RELEASE_RISK_OFF', forceRelease: false };
  }
  if (input.opportunityEligible) {
    return {
      action: 'RELEASE_100_PCT_NEXT_OPEN',
      reason: 'DEFERRED_RELEASE_OPPORTUNITY_ELIGIBLE',
      forceRelease: false
    };
  }
  return {
    action: 'HOLD_DEFERRED_CASH',
    reason: 'DEFERRED_STILL_RISK_ON_NO_ELIGIBLE_OPPORTUNITY',
    forceRelease: false
  };
}
