import { FORWARD_RISK_V11_POLICY_FINGERPRINT } from './forwardRiskV11SizingOverlay';

export interface ForwardRiskV11PolicyFreeze {
  readonly status: 'NOT_FROZEN' | 'FROZEN';
  readonly fingerprint: string | null;
}

export interface ForwardRiskV11LocalGateRecord {
  readonly status: 'PENDING' | 'PASS';
}

/**
 * V11 preregistration boundary.
 *
 * V9 and V10 blind instruments are permanently contaminated for successor
 * design. The V11 holdout below was selected only from structural metadata:
 * UCITS equity exposure, long-lived EUR Xetra listing, accumulating share
 * classes, and absence from existing catalogues and prior blind samples.
 */
export const FORWARD_RISK_V11_VALIDATION_PROTOCOL = {
  protocolVersion: 'V11_PREREG_2026_09_07',
  sealedAt: '2026-09-07',
  researchOnly: true,
  productionPromotionAllowed: false,

  objective: 'Test whether the frozen continuous Forward Risk score improves return/risk efficiency when used only as a sizing overlay on cash that the existing PortfolioCandidateGate already considers ELIGIBLE.',

  predecessorBoundary: {
    v8: 'PREDICTIVE_INFORMATION_RETAINED_RESEARCH_ONLY',
    v9: 'BLIND_FAIL_RETIRED',
    v10: 'BLIND_FAIL_RETIRED',
    permanentlyContaminatedTickers: [
      'SPPW.DE', 'SPY5.DE', 'SPYM.DE', 'ZPRS.DE', 'VGEU.DE', 'ZPDJ.DE',
      'VGVF.DE', 'VNRA.DE', 'VFEM.DE', 'VERE.DE', 'VGEK.DE', 'VJPN.DE'
    ] as const,
    rule: 'Prior failures may motivate the architectural move to continuous sizing but may not tune V11 score mapping, sizing floor, validation gates or blind sample.'
  },

  historicalBlindHoldout: {
    status: 'SEALED_PENDING_LOCAL_IMPLEMENTATION_GATES',
    selectionBasis: 'STRUCTURAL_ONLY_NO_RETURN_DRAWDOWN_VOLATILITY_OR_V11_OUTCOME_QUERY',
    eligibility: [
      'UCITS broad or regional equity ETF',
      'accumulating share class to avoid dividend-cashflow bias when using causal split-adjusted Close',
      'EUR Deutsche Boerse/Xetra listing',
      'listing age structurally sufficient for >=756 sessions',
      'absent from EUR_ASSET_UNIVERSE',
      'absent from EUR_VALIDATION_HOLDOUT_UNIVERSE',
      'absent from V9 and V10 blind samples',
      'six distinct broad/regional exposures fixed before any V11 historical fetch'
    ],
    assets: [
      { assetId: 'V11_BLIND_IUSQ', ticker: 'IUSQ.DE', isin: 'IE00B6R52259', name: 'iShares MSCI ACWI UCITS ETF', exposure: 'GLOBAL_ALL_COUNTRY_EQUITY', xetraListingDate: '2012-04-02' },
      { assetId: 'V11_BLIND_SXR4', ticker: 'SXR4.DE', isin: 'IE00B52SFT06', name: 'iShares MSCI USA UCITS ETF USD (Acc)', exposure: 'US_EQUITY', xetraListingDate: '2010-03-10' },
      { assetId: 'V11_BLIND_EUNM', ticker: 'EUNM.DE', isin: 'IE00B4L5YC18', name: 'iShares MSCI EM UCITS ETF USD (Acc)', exposure: 'EMERGING_EQUITY', xetraListingDate: '2009-10-20' },
      { assetId: 'V11_BLIND_EUNK', ticker: 'EUNK.DE', isin: 'IE00B4K48X80', name: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)', exposure: 'EUROPE_EQUITY', xetraListingDate: '2009-10-20' },
      { assetId: 'V11_BLIND_SXR1', ticker: 'SXR1.DE', isin: 'IE00B52MJY50', name: 'iShares Core MSCI Pacific ex-Japan UCITS ETF', exposure: 'PACIFIC_EX_JAPAN_EQUITY', xetraListingDate: '2010-03-10' },
      { assetId: 'V11_BLIND_SXRZ', ticker: 'SXRZ.DE', isin: 'IE00B52MJD48', name: 'iShares Nikkei 225 UCITS ETF JPY (Acc)', exposure: 'JAPAN_EQUITY', xetraListingDate: '2010-03-10' }
    ] as const,
    openPolicy: 'ONE_SHOT_AFTER_POLICY_FINGERPRINT_AND_LOCAL_GATES',
    replacementAfterOpeningAllowed: false,
    insufficientDataReplacementAllowed: false,
    dataQualityFailureReplacementAllowed: false
  },

  policyFreeze: {
    status: 'FROZEN',
    fingerprint: FORWARD_RISK_V11_POLICY_FINGERPRINT
  } satisfies ForwardRiskV11PolicyFreeze,

  localImplementationGates: {
    status: 'PENDING',
    required: [
      'npx tsx tests/forwardRiskV11SizingOverlay.unit.ts',
      'npx tsx tests/forwardRiskV11ValidationProtocol.unit.ts',
      'npx tsx tests/forwardRiskV11BlindValidation.unit.ts',
      'npm run lint'
    ]
  } satisfies ForwardRiskV11LocalGateRecord & { readonly required: readonly string[] },

  validationSemantics: {
    baseline: 'MONTHLY_CONTRIBUTION_PLUS_EXISTING_PORTFOLIO_CANDIDATE_GATE_WITH_FULL_AVAILABLE_CASH_DEPLOYMENT_WHEN_ELIGIBLE',
    v11: 'SAME_BASE_GATE_AND_CASH_FLOWS_WITH_CONTINUOUS_FORWARD_RISK_DEPLOYMENT_FRACTION_ON_ELIGIBLE_MONTHLY_DECISIONS',
    existingHoldings: 'NEVER_SELL_OR_REDUCE',
    rejectedBaseGate: 'BOTH_STRATEGIES_KEEP_CASH',
    withheldCash: 'RETAINS_HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX_AND_HAS_NO_V11_SPECIFIC_RELEASE_TRIGGER',
    drawdownMetric: 'FLOW_ADJUSTED_UNIT_NAV_MAX_DRAWDOWN',
    terminalMetric: 'FINAL_EUR_VALUE_WITH_IDENTICAL_EXTERNAL_CONTRIBUTIONS',
    wealthEfficiency: '(finalValueEur/totalContributionsEur)/(1+maxDrawdownPct/100)',
    causality: 'ALL_RISK_AND_OPPORTUNITY_INPUTS_INFORMATION_DATE_OR_PRICE_PREFIX_AT_OR_BEFORE_DECISION_DATE; ORDERS_NEXT_OPEN'
  },

  dataQualityContract: {
    minimumBars: 756,
    minimumMonthlyDecisionEvents: 36,
    minimumEligibleDecisionEvents: 12,
    minimumRiskModulatedEligibleEvents: 4,
    maxAbsoluteOneSessionCloseReturnPct: 40,
    duplicateDatesAllowed: false,
    nonPositiveOpenCloseAllowed: false,
    failureSemantics: 'ASSET_INVALID_DATA_AND_AGGREGATE_INCONCLUSIVE_IF_FEWER_THAN_6_VALID_NO_REPLACEMENT'
  },

  frozenValidationGate: {
    individualRule: 'drawdownReductionPctPoints >= 0.5 AND finalDeltaPctOfContributions >= -0.5 AND wealthEfficiencyRatio >= 1',
    validBlindAssetsRequired: 6,
    minimumIndividualPasses: 4,
    minimumMedianDrawdownReductionPctPoints: 0.5,
    minimumMedianFinalDeltaPctOfContributions: -0.5,
    minimumMedianWealthEfficiencyRatio: 1
  },

  futureForwardConfirmation: {
    status: 'RESERVED',
    startDateInclusive: '2026-09-08',
    purpose: 'TEMPORALLY_VIRGIN_CONFIRMATION_IF_AND_ONLY_IF_HISTORICAL_BLIND_PASSES',
    tuningAllowedAfterStart: false
  },

  antiLeakageRules: [
    'Do not fetch or inspect historical price series for V11 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.',
    'Do not use V9 or V10 blind assets as V11 validation assets or replacements.',
    'Do not select, replace or drop V11 blind assets using returns, drawdowns, volatility, crisis behavior, provider quirks or V11 outcomes.',
    'Do not change the activation score 80, linear 100%-to-50% sizing map, 50% floor, contribution size or validation gates after opening the holdout.',
    'Do not let Forward Risk make a rejected PortfolioCandidateGate asset eligible.',
    'Do not sell or reduce existing holdings inside V11_POLICY_1.',
    'Do not add a risk-specific daily release/waiting state to V11.',
    'A failed V11 blind validation retires V11_POLICY_1; any successor needs a newly sealed holdout.',
    'Long validation runs execute locally; never use GitHub Actions, Gemini or agents.'
  ]
} as const;

export function assertForwardRiskV11HistoricalHoldoutUnlocked(): string {
  const freeze: ForwardRiskV11PolicyFreeze = FORWARD_RISK_V11_VALIDATION_PROTOCOL.policyFreeze;
  const localGates: ForwardRiskV11LocalGateRecord = FORWARD_RISK_V11_VALIDATION_PROTOCOL.localImplementationGates;
  if (freeze.status !== 'FROZEN' || !freeze.fingerprint) {
    throw new Error('V11_BLIND_HOLDOUT_LOCKED_POLICY_NOT_FROZEN');
  }
  if (localGates.status !== 'PASS') {
    throw new Error('V11_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED');
  }
  return freeze.fingerprint;
}
