import {
  FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
  FORWARD_RISK_CONTEXT_V1
} from './forwardRiskContextV1';

/**
 * Phase 6 Stage A freezes how retained V8 information may be carried into the
 * canonical decision chain as research context. It deliberately does NOT yet
 * define an economic execution policy or open a validation sample.
 *
 * This two-stage boundary prevents a new sizing/ranking/hurdle rule from being
 * designed after observing its own economic holdout.
 */
export const PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL = {
  protocolVersion: 'PHASE6_FORWARD_RISK_CONTEXT_PREREG_2026_09_15',
  status: 'CONTEXT_PREREGISTERED_SAMPLE_NOT_SELECTED_NOT_OPENED',
  researchOnly: true,
  productionDefault: 'LEGACY',
  productionPromotionAllowed: false,

  objective: 'Test whether retained Forward Risk V8 information has incremental downside value inside the existing candidate-decision context before designing any new economic policy.',

  retainedSignalBoundary: {
    sourceArchitecture: 'FORWARD_RISK_COMPLEMENTARITY_V8',
    contextVersion: FORWARD_RISK_CONTEXT_V1,
    v8Rule: `V5 vulnerability >= ${FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT} OR V7 options >= ${FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT}`,
    continuousContext: 'MAX_OF_V5_VULNERABILITY_SCORE_PCT_AND_V7_OPTIONS_SCORE_PCT',
    thresholdPct: FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
    coefficientsFitted: false,
    thresholdsRetuned: false,
    missingLegFallbackAllowed: false
  },

  predecessorDisposition: {
    v8: 'PREDICTIVE_INFORMATION_RETAINED',
    v9: 'RETIRED_AS_TESTED',
    v10: 'RETIRED_AS_TESTED',
    v11: 'RETIRED_AS_TESTED',
    rule: 'Economic failures of V8-V11 do not erase V8 predictive information and may not be used to retune successor thresholds, waiting periods, sizing maps or release rules.'
  },

  integrationBoundary: {
    architecture: 'CORE_ARCHITECTURE_V1',
    researchLocation: 'SHADOW_CONTEXT_AT_PORTFOLIO_CANDIDATE_GATE_DECISION_DATE',
    changesEligibility: false,
    changesRanking: false,
    changesSizing: false,
    changesExistingHoldings: false,
    createsSellOrReduce: false,
    createsWaitingState: false,
    createsParallelEngine: false,
    directDailyOnOffAuthority: false
  },

  stageA: {
    purpose: 'SIGNAL_INFORMATION_ONLY_BEFORE_ECONOMIC_POLICY_DESIGN',
    question: 'Conditional on the canonical candidate-decision context, does high/continuous V8 risk retain incremental information about subsequent downside?',
    requiredReporting: [
      'signal quality separately from any future economic policy',
      'coverage and missing-data rate for both V5 and V7 legs',
      'context reach inside the candidate-decision population',
      'future downside outcomes only after sample and predictive gate are sealed'
    ] as const,
    economicOrdersAllowed: false,
    economicPolicyDefined: false
  },

  futureEconomicStage: {
    status: 'NOT_DESIGNED',
    rule: 'Only if Stage A passes a separately sealed fresh predictive validation may an economic policy be designed. The Stage A sample is then consumed for policy design and cannot validate that economic policy.',
    forbiddenShortcuts: [
      'reuse Stage A outcomes to both design and promote one policy',
      'restore V8 daily ON/OFF trading authority',
      'revive V9, V10 or V11 under renamed parameters',
      'create V12/V13 as retrospective parameter chasing'
    ] as const
  },

  validationSample: {
    status: 'NOT_SELECTED_NOT_OPENED',
    selectionMustBeFrozenBeforeAnyOutcomeAccess: true,
    selectionBasisAllowed: 'STRUCTURAL_AND_REAL_DATA_COVERAGE_ONLY',
    currentYahooDiscoveryHistoricalReconstructionAllowed: false,
    previouslyOpenedForwardRiskHoldoutsAllowedForPromotion: false,
    replacementAfterOpeningAllowed: false,
    outcomeInspectionAllowedNow: false
  },

  dataContract: {
    v5: 'REAL_VINTAGE_SAFE_POINT_IN_TIME_MACRO_REQUIRED',
    v7: 'REAL_CBOE_OBSERVED_OPTIONS_INDEX_DATA_REQUIRED',
    marketPrices: 'REAL_ONLY',
    syntheticFallbackAllowed: false,
    causalInformationDateRequired: true
  },

  nextFreezeBeforeOpening: {
    required: [
      'fresh sample-selection rule and exact sample',
      'observation window and warm-up',
      'predictive outcome definitions',
      'minimum evaluable observations / reach',
      'PASS / FAIL / INCONCLUSIVE predictive gate',
      'missing-data semantics',
      'fingerprint/seal of the Stage A runner'
    ] as const,
    marketDataAccessBeforeFreezeAllowed: false
  },

  governance: {
    commonProtocol: 'ECONOMIC_VALIDATION_PROTOCOL_V1',
    signalQualitySeparateFromPolicyQuality: true,
    consumedSamplesCannotPromote: true,
    noRetuningAfterOutcome: true,
    phase5DoesNotAuthorizePhase6Parameters: true
  }
} as const;
