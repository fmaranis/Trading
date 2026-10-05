export const TIMESFM_MULTIVARIATE_CONTEXT_V1 = Object.freeze({
  version: 'TIMESFM_MULTIVARIATE_CONTEXT_V1',
  role: 'HISTORICAL_SIGNAL_DIAGNOSTIC_CONSUMED_SAMPLE_NO_PROMOTION',
  model: Object.freeze({
    package: 'timesfm',
    packageVersion: '3.0.2',
    checkpoint: 'google/timesfm-3.0-pytorch',
    checkpointRevision: '24701cec1b1ea47232c0766e888855c9976ef62b',
    expectedWeightSha256: 'a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da',
    nativeApi: 'timesfm3.TimesFM3Evaluator',
    maxVariates: 32,
    remoteBatchMaxAnchors: 8,
    runnerApiVersion: 3,
    zeroGpuDurationSecondsPerBatch: 45
  }),
  data: Object.freeze({
    sourceType: 'REAL',
    provider: 'YAHOO_FINANCE',
    timeframe: '1d',
    fields: Object.freeze(['open','high','low','close','volume']),
    downloadFrom: '2015-01-01',
    outcomesThrough: '2025-12-31',
    syntheticFallback: false
  }),
  targets: Object.freeze([
    Object.freeze({assetId:'EUNL',ticker:'EUNL.DE',role:'STRUCTURAL_CORE',defensive:false}),
    Object.freeze({assetId:'SXR8',ticker:'SXR8.DE',role:'US_EQUITY',defensive:false}),
    Object.freeze({assetId:'EQQQ',ticker:'EQQQ.DE',role:'TECHNOLOGY',defensive:false}),
    Object.freeze({assetId:'EXSA',ticker:'EXSA.DE',role:'EUROPE_EQUITY',defensive:false}),
    Object.freeze({assetId:'IS3N',ticker:'IS3N.DE',role:'EMERGING_EQUITY',defensive:false}),
    Object.freeze({assetId:'ZPRV',ticker:'ZPRV.DE',role:'SMALL_CAP',defensive:false}),
    Object.freeze({assetId:'EXH1',ticker:'EXH1.DE',role:'ENERGY',defensive:false}),
    Object.freeze({assetId:'IBCI',ticker:'IBCI.DE',role:'GOV_BONDS',defensive:true}),
    Object.freeze({assetId:'4GLD',ticker:'4GLD.DE',role:'GOLD',defensive:true})
  ]),
  contextLength: 512,
  forecastHorizon: 60,
  evaluationHorizons: Object.freeze([1,5,20,60]),
  primaryHorizons: Object.freeze([20,60]),
  targetNormalization: 'TIMESFM3_EVALUATOR_DEFAULT_NORMALIZATION',
  arms: Object.freeze({
    fullPanelTargetsOnly: Object.freeze({
      id: 'FULL_PANEL_TARGETS_ONLY',
      targetVariates: 9,
      pastOnlyCovariates: 0,
      pastFutureCovariates: 0
    }),
    fullPanelCausalCovariates: Object.freeze({
      id: 'FULL_PANEL_PLUS_CAUSAL_COVARIATES',
      targetVariates: 9,
      pastOnlyCovariates: 23,
      pastFutureCovariates: 0
    })
  }),
  covariates: Object.freeze({
    perTarget: Object.freeze([
      'LOG_VOLUME_Z',
      'INTRADAY_RANGE_PCT'
    ]),
    shared: Object.freeze([
      'CORE_REALIZED_VOL20',
      'CORE_DRAWDOWN60_PCT',
      'XSEC_RETURN_DISPERSION20',
      'XSEC_OVERNIGHT_GAP_MEAN_PCT',
      'XSEC_OVERNIGHT_GAP_DISPERSION_PCT'
    ]),
    totalPastOnly: 23,
    futureKnownCovariates: Object.freeze([]),
    causalRule: 'EVERY_VALUE_MUST_BE_DERIVED_FROM_DATA_AT_OR_BEFORE_INFORMATION_DATE'
  }),
  diagnostic: Object.freeze({
    firstAnchorQuarterEnd: '2018-03-31',
    lastAnchorQuarterEnd: '2025-09-30',
    expectedAnchors: 31,
    anchorMonths: Object.freeze([3,6,9,12]),
    minimumUsableAnchors: 27,
    sampleDisposition: 'CONSUMED_DIAGNOSTIC_ONLY'
  }),
  interpretation: Object.freeze({
    minimumDirectionalAccuracyPct20_60: 52,
    minimumMeanRankIc20_60: 0.05,
    minimumCovariateRankIcLiftVsTargetsOnly20_60: 0.02,
    minimumPositiveTemporalIcTargets: 5,
    quantile80CoverageMinPct: 60,
    quantile80CoverageMaxPct: 95,
    noPromotionFromHistorical: true,
    noEconomicPolicyInThisStudy: true
  }),
  prospective: Object.freeze({
    freezeBothArmsBeforeFirstAnchor: true,
    startAfter: '2026-10-05',
    firstEligibleIsoWeek: '2026-W42',
    cadence: 'WEEKLY_FIRST_COMMON_TRADING_SESSION',
    minimumMaturedAnchors: 26,
    outcomesOpened: false,
    noRetuneAfterCollectionOpens: true
  }),
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function quarterEndCalendarDates(firstYear=2018,lastYear=2025){
  const result=[];
  for(let year=firstYear;year<=lastYear;year++){
    for(const month of [3,6,9,12]){
      if(year===2025 && month>9) continue;
      result.push(new Date(Date.UTC(year,month,0)).toISOString().slice(0,10));
    }
  }
  return result;
}

export function validateTimesFmMultivariateContextProtocol(){
  const P=TIMESFM_MULTIVARIATE_CONTEXT_V1;
  if(P.targets.length!==9) throw new Error('TIMESFM_MV_V1_TARGET_COUNT');
  if(P.arms.fullPanelCausalCovariates.targetVariates + P.arms.fullPanelCausalCovariates.pastOnlyCovariates + P.arms.fullPanelCausalCovariates.pastFutureCovariates > P.model.maxVariates){
    throw new Error('TIMESFM_MV_V1_MAX_VARIATES_EXCEEDED');
  }
  if(P.covariates.totalPastOnly!==P.targets.length*P.covariates.perTarget.length+P.covariates.shared.length){
    throw new Error('TIMESFM_MV_V1_COVARIATE_COUNT');
  }
  if(P.prospective.outcomesOpened!==false || P.productionAuthority!==false || P.productionDefault!=='LEGACY'){
    throw new Error('TIMESFM_MV_V1_AUTHORITY');
  }
  return true;
}
