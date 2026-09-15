import {
  FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
  FORWARD_RISK_CONTEXT_V1
} from './forwardRiskContextV1';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL } from './phase6ForwardRiskContextStageAProtocol';

/**
 * Phase 6 carries retained V8 information into the canonical decision chain as
 * research-only context. Stage A now has a frozen future-forward sample and
 * predictive gate, but market/outcome access remains prohibited until the
 * collector/evaluator and durable state are implemented and sealed.
 */
export const PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL = {
  protocolVersion: 'PHASE6_FORWARD_RISK_CONTEXT_PREREG_2026_09_15',
  status: 'CONTEXT_PREREGISTERED_STAGE_A_SAMPLE_FROZEN_NOT_OPENED',
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
    protocol: PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL,
    requiredReporting: [
      'signal quality separately from any future economic policy',
      'coverage and missing-data rate for both V5 and V7 legs',
      'context reach inside the candidate-decision population',
      'future downside outcomes only after runner/state seal and observation maturity'
    ] as const,
    economicOrdersAllowed: false,
    economicPolicyDefined: false
  },

  futureEconomicStage: {
    status: 'NOT_DESIGNED',
    rule: 'Only if Stage A passes the separately sealed fresh predictive validation may an economic policy be designed. The Stage A sample is then consumed for policy design and cannot validate that economic policy.',
    forbiddenShortcuts: [
      'reuse Stage A outcomes to both design and promote one policy',
      'restore V8 daily ON/OFF trading authority',
      'revive V9, V10 or V11 under renamed parameters',
      'create V12/V13 as retrospective parameter chasing'
    ] as const
  },

  validationSample: {
    status: 'FUTURE_FORWARD_FROZEN_NOT_OPENED',
    sampleVersion: PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL.version,
    selectionFrozenBeforeAnyOutcomeAccess: true,
    selectionBasis: 'PRESELECTED_CANONICAL_ASSET_IDENTITIES_PLUS_POST_FREEZE_FUTURE_OUTCOMES',
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
      'causal future-forward collector/evaluator',
      'durable immutable prospective state',
      'no-backfill guard',
      'fingerprint/seal of Stage A runner and state contract'
    ] as const,
    marketDataAccessBeforeRunnerSealAllowed: false
  },

  governance: {
    commonProtocol: 'ECONOMIC_VALIDATION_PROTOCOL_V1',
    signalQualitySeparateFromPolicyQuality: true,
    consumedSamplesCannotPromote: true,
    noRetuningAfterOutcome: true,
    phase5DoesNotAuthorizePhase6Parameters: true
  }
} as const;
