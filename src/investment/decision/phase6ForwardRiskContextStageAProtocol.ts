import { FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT, FORWARD_RISK_CONTEXT_V1 } from './forwardRiskContextV1';

export const PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL = {
  version: 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_V1',
  status: 'FUTURE_FORWARD_SAMPLE_FROZEN_NOT_OPENED',
  frozenOn: '2026-09-15',
  researchOnly: true,
  productionDefault: 'LEGACY',
  productionPromotionAllowed: false,
  economicPolicyDefined: false,

  objective: 'Test whether frozen V8 context adds incremental downside information inside the existing PortfolioCandidateGate decision context before any economic policy is designed.',

  signal: {
    contextVersion: FORWARD_RISK_CONTEXT_V1,
    score: 'MAX_V5_VULNERABILITY_PCT_V7_OPTIONS_PCT',
    highRiskThresholdPct: FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
    bothLegsRequired: true,
    missingLegSemantics: 'UNAVAILABLE',
    coefficientsFitted: false,
    thresholdRetuned: false
  },

  sample: {
    mode: 'FUTURE_FORWARD',
    rationale: 'Historical Forward Risk time windows through 2026-09-01 are consumed. Stage A therefore uses only post-freeze future outcomes.',
    predictionStartDate: '2026-09-16',
    predictionEndDate: '2027-03-31',
    historyWarmupStartDate: '2022-01-03',
    decisionCadence: 'DAILY',
    backfillAllowed: false,
    replacementAfterOpeningAllowed: false,
    currentYahooDiscoveryHistoricalReconstructionAllowed: false,
    assets: [
      { assetId: 'EUNL', ticker: 'EUNL.DE', category: 'GLOBAL_EQUITY' },
      { assetId: 'SXR8', ticker: 'SXR8.DE', category: 'US_EQUITY' },
      { assetId: 'EXSA', ticker: 'EXSA.DE', category: 'EUROPE_EQUITY' },
      { assetId: 'IS3N', ticker: 'IS3N.DE', category: 'EMERGING_EQUITY' },
      { assetId: 'IUSN', ticker: 'IUSN.DE', category: 'SMALL_CAP' },
      { assetId: 'QDVE', ticker: 'QDVE.DE', category: 'TECHNOLOGY' },
      { assetId: 'VVSM', ticker: 'VVSM.DE', category: 'SEMICONDUCTORS' },
      { assetId: 'XDWH', ticker: 'XDWH.DE', category: 'HEALTHCARE' },
      { assetId: 'EXH1', ticker: 'EXH1.DE', category: 'ENERGY' },
      { assetId: 'ISPA', ticker: 'ISPA.DE', category: 'DIVIDEND' }
    ] as const,
    minimumValidAssets: 8,
    minimumCandidateHistoryBarsAtInformationDate: 252,
    minimumSignalCalibrationBarsBeforePredictionWindow: 756
  },

  decisionContext: {
    architecture: 'CORE_ARCHITECTURE_V1',
    scanner: 'AssetUniverseScanner / causal historical-prefix equivalent',
    gate: 'PortfolioCandidateGate',
    primaryPopulation: 'PORTFOLIO_CANDIDATE_GATE_ELIGIBLE_WITH_CONTEXT_AVAILABLE',
    secondaryPopulation: 'ALL_GATE_EVALUABLE_WITH_CONTEXT_AVAILABLE',
    changesEligibility: false,
    changesRanking: false,
    changesSizing: false,
    changesExistingHoldings: false,
    createsOrders: false
  },

  predictiveOutcome: {
    reference: 'NEXT_OPEN_AFTER_INFORMATION_DATE',
    horizonSessions: 63,
    path: 'REFERENCE_NEXT_OPEN_THEN_SUBSEQUENT_CLOSES',
    metric: 'MAX_PEAK_TO_TROUGH_DRAWDOWN_PCT_WITHIN_63_SESSIONS',
    materialDownsideThresholdPct: 5,
    label: 'MATERIAL_DOWNSIDE_IF_MAX_DRAWDOWN_GTE_5PCT',
    outcomeMayBeReadBeforeMaturity: false,
    finalVerdictRequiresAllFrozenWindowObservationsMature: true
  },

  reachGate: {
    minimumEvaluableEligibleObservations: 200,
    minimumHighRiskEligibleObservations: 30,
    minimumNormalRiskEligibleObservations: 100,
    minimumAssetsWithHighRiskEligibleObservations: 4,
    minimumDistinctCalendarWeeksWithHighRiskEligibleObservations: 6,
    maximumSingleAssetShareOfHighRiskEligiblePct: 35
  },

  predictiveGate: {
    primaryComparison: 'HIGH_RISK_CONTEXT_VS_NORMAL_CONTEXT_WITHIN_ELIGIBLE_POPULATION',
    minimumAbsoluteMaterialDownsideRateLiftPctPoints: 10,
    minimumMaterialDownsideRiskRatio: 1.5,
    minimumMedianMaxDrawdownSeverityLiftPctPoints: 1,
    thresholdsDerivedFromOpenedStageAOutcomes: false
  },

  dataContract: {
    prices: 'REAL_ONLY',
    v5: 'REAL_VINTAGE_SAFE_POINT_IN_TIME_MACRO_REQUIRED',
    v7: 'REAL_CBOE_OBSERVED_OPTIONS_INDEX_DATA_REQUIRED',
    syntheticFallbackAllowed: false,
    causalInformationDateRequired: true,
    invalidOrMissingSignalLeg: 'OBSERVATION_UNAVAILABLE_NOT_FALLBACK',
    providerFailure: 'NO_OBSERVATION_NO_BACKFILL'
  },

  verdicts: {
    pass: 'STAGE_A_PASS_CANDIDATE_FOR_STAGE_B_POLICY_DESIGN',
    fail: 'STAGE_A_FAIL_NO_INCREMENTAL_DOWNSIDE_INFORMATION',
    immature: 'STAGE_A_INCONCLUSIVE_OUTCOMES_IMMATURE',
    insufficientData: 'STAGE_A_INCONCLUSIVE_INSUFFICIENT_REAL_DATA',
    insufficientReach: 'STAGE_A_INCONCLUSIVE_INSUFFICIENT_INCREMENTAL_REACH'
  },

  interpretation: {
    passDoesNotPromoteProduction: true,
    passOnlyAllowsStageBDesign: true,
    stageASampleConsumedForStageBPolicyPromotion: true,
    noRetuningFromStageAOutcome: true,
    noEconomicPolicyMayBeEvaluatedOnThisSample: true
  },

  nextBeforeOpening: {
    required: [
      'implement causal future-forward collector/evaluator',
      'seal runner and durable-state fingerprints',
      'guard no-backfill and observation immutability',
      'run TypeScript and architecture guards'
    ] as const,
    marketOrOutcomeAccessAllowedBeforeRunnerSeal: false
  }
} as const;
