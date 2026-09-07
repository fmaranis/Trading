import { FORWARD_RISK_V10_POLICY_FINGERPRINT } from './forwardRiskV10Policy';

export interface ForwardRiskV10PolicyFreeze {
  readonly status: 'NOT_FROZEN' | 'FROZEN';
  readonly fingerprint: string | null;
}

export interface ForwardRiskV10LocalGateRecord {
  readonly status: 'PENDING' | 'PASS';
}

/**
 * V10 preregistration boundary.
 *
 * V9's six blind instruments are permanently contaminated for successor design.
 * V10 uses a new structurally selected holdout and changes the economic action:
 * existing holdings are never sold; only new-money entry timing can be delayed.
 */
export const FORWARD_RISK_V10_VALIDATION_PROTOCOL = {
  protocolVersion: 'V10_PREREG_2026_09_07',
  sealedAt: '2026-09-07',
  researchOnly: true,
  productionPromotionAllowed: false,

  objective: 'Test whether frozen forward-risk evidence adds value as a causal admission controller for new money when combined with the existing opportunity gate, without selling existing holdings.',

  predecessorBoundary: {
    v8: 'PREDICTIVE_INFORMATION_RETAINED_RESEARCH_ONLY',
    v9: 'BLIND_FAIL_RETIRED',
    v9PolicyFingerprint: 'sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0',
    v9BlindTickersPermanentlyContaminated: ['SPPW.DE', 'SPY5.DE', 'SPYM.DE', 'ZPRS.DE', 'VGEU.DE', 'ZPDJ.DE'] as const,
    rule: 'V9 outcomes may motivate the architectural change from selling holdings to gating new money, but may not tune V10 thresholds, horizons, sizing or pass criteria.'
  },

  frozenRiskInput: {
    architecture: 'V8',
    rule: 'V5_VULNERABILITY_GTE_80_OR_V7_OPTIONS_GTE_80',
    v5ThresholdPct: 80,
    v7ThresholdPct: 80,
    thresholdsRetunableInV10: false
  },

  frozenOpportunityInput: {
    source: 'PORTFOLIO_CANDIDATE_GATE',
    signal: 'ELIGIBLE',
    purpose: 'UPSIDE_OR_NEW_MONEY_OPPORTUNITY_OVERRIDE',
    newV10OpportunityThresholdAllowed: false,
    note: 'V10 does not build a new upside predictor. It reuses the existing causal production eligibility decision as the positive-opportunity counterweight to V8 risk.'
  },

  historicalBlindHoldout: {
    status: 'SEALED_READY_FOR_ONE_SHOT_OPEN',
    selectionBasis: 'STRUCTURAL_ONLY_NO_RETURN_DRAWDOWN_VOLATILITY_OR_V10_OUTCOME_QUERY',
    eligibility: [
      'UCITS equity ETF',
      'EUR Deutsche Boerse listing',
      'sufficient listing age by structural metadata for at least 756 sessions',
      'absent from EUR_ASSET_UNIVERSE',
      'absent from EUR_VALIDATION_HOLDOUT_UNIVERSE',
      'absent from V9 blind holdout',
      'regional diversification fixed before V10 policy validation'
    ],
    assets: [
      { assetId: 'V10_BLIND_VGVF', ticker: 'VGVF.DE', isin: 'IE00BK5BQV03', name: 'Vanguard FTSE Developed World UCITS ETF Acc', exposure: 'GLOBAL_DEVELOPED_EQUITY' },
      { assetId: 'V10_BLIND_VNRA', ticker: 'VNRA.DE', isin: 'IE00BK5BQW10', name: 'Vanguard FTSE North America UCITS ETF Acc', exposure: 'NORTH_AMERICA_EQUITY' },
      { assetId: 'V10_BLIND_VFEM', ticker: 'VFEM.DE', isin: 'IE00B3VVMM84', name: 'Vanguard FTSE Emerging Markets UCITS ETF Dist', exposure: 'EMERGING_EQUITY' },
      { assetId: 'V10_BLIND_VERE', ticker: 'VERE.DE', isin: 'IE00BK5BQY34', name: 'Vanguard FTSE Developed Europe ex UK UCITS ETF Acc', exposure: 'EUROPE_EX_UK_EQUITY' },
      { assetId: 'V10_BLIND_VGEK', ticker: 'VGEK.DE', isin: 'IE00BK5BQZ41', name: 'Vanguard FTSE Developed Asia Pacific ex Japan UCITS ETF Acc', exposure: 'ASIA_PACIFIC_EX_JAPAN_EQUITY' },
      { assetId: 'V10_BLIND_VJPN', ticker: 'VJPN.DE', isin: 'IE00B95PGT31', name: 'Vanguard FTSE Japan UCITS ETF Dist', exposure: 'JAPAN_EQUITY' }
    ] as const,
    openPolicy: 'ONE_SHOT_AFTER_POLICY_FINGERPRINT_AND_LOCAL_GATES',
    replacementAfterOpeningAllowed: false,
    insufficientDataReplacementAllowed: false,
    dataQualityFailureReplacementAllowed: false
  },

  futureForwardConfirmation: {
    status: 'RESERVED',
    startDateInclusive: '2026-09-08',
    purpose: 'TEMPORALLY_VIRGIN_CONFIRMATION',
    tuningAllowedAfterStart: false
  },

  policyFreeze: {
    status: 'FROZEN',
    fingerprint: FORWARD_RISK_V10_POLICY_FINGERPRINT
  } satisfies ForwardRiskV10PolicyFreeze,

  localImplementationGates: {
    status: 'PASS',
    recordedAt: '2026-09-07',
    evidence: [
      'forwardRiskV10Policy.unit: PASS',
      'forwardRiskV10ValidationProtocol.unit: PASS',
      'npm run lint / tsc --noEmit: PASS'
    ],
    required: [
      'npx tsx tests/forwardRiskV10Policy.unit.ts',
      'npx tsx tests/forwardRiskV10ValidationProtocol.unit.ts',
      'npm run lint'
    ]
  } satisfies ForwardRiskV10LocalGateRecord & { readonly recordedAt: string; readonly evidence: readonly string[]; readonly required: readonly string[] },

  dataQualityContract: {
    minimumBars: 756,
    minimumContributionEvents: 36,
    minimumDeferredContributionsPerAsset: 6,
    maxAbsoluteOneSessionCloseReturnPct: 40,
    duplicateDatesAllowed: false,
    nonPositiveOpenCloseAllowed: false,
    failureSemantics: 'ASSET_INVALID_DATA_AND_AGGREGATE_INCONCLUSIVE_IF_FEWER_THAN_6_VALID_NO_REPLACEMENT'
  },

  frozenEconomicContract: {
    existingHoldings: 'NEVER_SELL_OR_REDUCE',
    contributionSchedule: 'FIRST_TRADING_SESSION_OF_EACH_CALENDAR_MONTH',
    contributionEur: 1000,
    baseline: 'INVEST_EACH_CONTRIBUTION_NEXT_OPEN_IMMEDIATELY',
    v10RiskOff: 'INVEST_100_PCT_NEXT_OPEN',
    v10RiskOnOpportunityEligible: 'INVEST_100_PCT_NEXT_OPEN',
    v10RiskOnOpportunityNotEligible: 'DEFER_100_PCT_IN_REMUNERATED_CASH',
    deferredCashRelease: 'FIRST_OF_RISK_OFF_OR_OPPORTUNITY_ELIGIBLE_OR_63_SESSIONS',
    executionMode: 'NEXT_OPEN',
    wholeShares: true,
    broker: 'MYINVESTOR',
    cashMode: 'HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX',
    taxMode: 'CASH_INTEREST_ONLY_NO_POSITION_SALES'
  },

  frozenValidationGate: {
    deferredPathHorizonSessions: 63,
    downsideThresholdPct: -5,
    upsideThresholdPct: 5,
    pathClassification: 'FIRST_HIT_DOWN_5_OR_UP_5_WITHIN_63_SESSIONS_AFTER_BASELINE_ENTRY',
    individualRule: 'finalDeltaEur >= 0 AND medianDeferredExecutionPriceImprovementPct >= 0 AND downFirstCount >= upFirstCount',
    validBlindAssetsRequired: 6,
    minimumIndividualPasses: 4,
    medianFinalDeltaEurMustBeNonNegative: true,
    medianDeferredExecutionPriceImprovementPctMustBeNonNegative: true,
    aggregateDownFirstMustBeGteUpFirst: true
  },

  antiLeakageRules: [
    'Do not fetch or inspect historical price series for V10 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.',
    'Do not use V9 blind assets as V10 validation assets or replacements.',
    'Do not select, replace or drop V10 blind assets using returns, drawdowns, volatility, crisis behavior, provider quirks or V10 outcomes.',
    'Do not retune V8 thresholds in V10.',
    'Do not add a V10-specific opportunity threshold; use the existing PortfolioCandidateGate ELIGIBLE boolean only.',
    'Do not sell or reduce existing holdings inside V10_POLICY_1.',
    'Do not tune V10 after the historical blind holdout is opened.',
    'A failed V10 blind validation retires V10_POLICY_1; any successor needs a newly sealed holdout.',
    'Long validation runs execute locally; never use GitHub Actions.'
  ]
} as const;

export function assertForwardRiskV10HistoricalHoldoutUnlocked(): string {
  const freeze: ForwardRiskV10PolicyFreeze = FORWARD_RISK_V10_VALIDATION_PROTOCOL.policyFreeze;
  const localGates: ForwardRiskV10LocalGateRecord = FORWARD_RISK_V10_VALIDATION_PROTOCOL.localImplementationGates;
  if (freeze.status !== 'FROZEN' || !freeze.fingerprint) {
    throw new Error('V10_BLIND_HOLDOUT_LOCKED_POLICY_NOT_FROZEN');
  }
  if (localGates.status !== 'PASS') {
    throw new Error('V10_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED');
  }
  return freeze.fingerprint;
}
