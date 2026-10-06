export const TIMESFM_PANEL_STICKY_OOS_V1 = Object.freeze({
  version: 'TIMESFM_PANEL_STICKY_OOS_V1',
  role: 'FROZEN_OUT_OF_SAMPLE_ECONOMIC_SCREEN_NO_PRODUCTION_PROMOTION',
  designedAfterConsumedSample: 'TIMESFM_MULTIVARIATE_CONTEXT_V1_2018Q1_2025Q3',
  consumedSampleMayNotValidatePolicy: true,
  signal: Object.freeze({
    source: 'TIMESFM_MULTIVARIATE_CONTEXT_V1',
    arm: 'FULL_PANEL_TARGETS_ONLY',
    horizonSessions: 60,
    targetIds: Object.freeze(['EUNL','SXR8','EQQQ','EXSA','IS3N','ZPRV','EXH1','IBCI','4GLD'])
  }),
  policy: Object.freeze({
    version: 'TIMESFM_PANEL_STICKY_SELECTOR_V1',
    entryRank: 1,
    incumbentRetentionRank: 3,
    relativeReturnFloorPct: 0,
    structuralCoreAssetId: 'EUNL',
    sizingMode: 'FULL_SHADOW_EQUITY_TO_SELECTED_ASSET',
    executionSemantics: 'NEXT_OPEN',
    reviewCadence: 'MONTHLY_LAST_COMMON_TRADING_SESSION'
  }),
  holdout: Object.freeze({
    firstCalendarMonth: '2025-10',
    lastCalendarMonth: '2026-06',
    expectedAnchors: 9,
    minimumUsableAnchors: 9,
    outcomesThrough: '2026-09-30',
    informationDatesPreviouslyUsedByTimesFmResearch: false,
    outcomesOpenedBeforeSeal: false
  }),
  data: Object.freeze({
    provider: 'YAHOO_FINANCE',
    sourceType: 'REAL',
    downloadFrom: '2023-01-01',
    fields: Object.freeze(['open','high','low','close','volume']),
    syntheticFallback: false
  }),
  scenarios: Object.freeze({
    capitalEur: Object.freeze([250,500,2500,10000,30000]),
    riskProfiles: Object.freeze(['LOW','MEDIUM','HIGH']),
    externalCashFlows: Object.freeze([]),
    cashBenchmarkAnnualPct: 2.5,
    taxContextConfirmed: false
  }),
  comparators: Object.freeze([
    'LEGACY_APP',
    'EUNL_CORE_DIRECT',
    'PANEL_TOP1_60_NAIVE'
  ]),
  interpretation: Object.freeze({
    minimumScenariosBeatingCore: 10,
    minimumScenariosBeatingLegacy: 10,
    requirePositiveMedianExcessReturnVsCore: true,
    requirePositiveMedianExcessReturnVsLegacy: true,
    maximumDrawdownDeteriorationVsCorePctPoints: 5,
    requireWinnerChangesNotAboveNaive: true,
    passLabel: 'PASS_OOS_ECONOMIC_SCREEN_CONTINUE_PROSPECTIVE',
    failLabel: 'FAIL_OOS_ECONOMIC_SCREEN_DO_NOT_PROMOTE',
    insufficientLabel: 'INCONCLUSIVE_OOS_COVERAGE',
    promotionAuthority: false
  }),
  productionDefault: 'LEGACY',
  productionAuthority: false
});
