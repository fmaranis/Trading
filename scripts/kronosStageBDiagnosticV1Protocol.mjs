import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as TIMESFM_B } from './timesfmStageBProtocol.mjs';

export const KRONOS_STAGE_B_DIAGNOSTIC_V1 = Object.freeze({
  version: 'KRONOS_STAGE_B_DIAGNOSTIC_V1',
  role: 'HISTORICAL_DESCRIPTIVE_SIGNAL_DIAGNOSTIC_NO_PROMOTION',
  sourceStageA: 'KRONOS_STAGE_A_SMOKE_V1',
  stageADisposition: 'PASS_STAGE_A_TECHNICAL_SMOKE',
  model: Object.freeze({
    repoId: 'NeoQuasar/Kronos-small',
    revision: '901c26c1332695a2a8f243eb2f37243a37bea320',
    weightSha256: 'b082dfcbd8e8c142a725c8bbb99781802f38fec81210e13479effb32b3c3e020',
    tokenizerRepoId: 'NeoQuasar/Kronos-Tokenizer-base',
    tokenizerRevision: '0e0117387f39004a9016484a186a908917e22426',
    tokenizerWeightSha256: '59d85f6af76a2c3b8240ea06cb21db4213b4eeca053f246b23e29cf832fc6bee',
    sourceCommit: '67b630e67f6a18c9e9be918d9b4337c960db1e9a',
    maxContext: 512
  }),
  sampleReuse: Object.freeze({
    source: TIMESFM_B.version,
    rationale: 'REUSE_ALREADY_CONSUMED_TIMESFM_SAMPLE_FOR_APPLES_TO_APPLES_DIAGNOSTIC',
    firstAnchorQuarterEnd: TIMESFM_B.diagnostic.firstAnchorQuarterEnd,
    lastAnchorQuarterEnd: TIMESFM_B.diagnostic.lastAnchorQuarterEnd,
    anchorMonths: TIMESFM_B.diagnostic.anchorMonths,
    expectedMaximumCases: TIMESFM_B.diagnostic.expectedMaximumCases,
    promotionAuthority: false
  }),
  data: TIMESFM_B.data,
  core: TIMESFM_B.core,
  assets: TIMESFM_B.assets,
  contextLength: 512,
  forecastHorizon: 60,
  primaryHorizons: Object.freeze([20, 60]),
  sampling: Object.freeze({
    temperature: 1,
    topP: 0.9,
    topK: 0,
    pathsPerAssetAnchor: 20,
    deterministicSeedBase: 20261007,
    assetChunkSize: 1,
    pathBatchSize: 4,
    cpuThreads: 1,
    preserveIndividualPaths: true
  }),
  outputs: Object.freeze({
    centralReturn: 'MEDIAN_PATH_RETURN',
    probabilityReturnPositive: 'FRACTION_PATH_RETURN_GT_ZERO',
    probabilitySlopePositive: 'FRACTION_PATH_LOG_CLOSE_SLOPE_GT_ZERO',
    slope: 'OLS_LOG_CLOSE_FORECAST_PATH',
    uncertainty: 'PATH_RETURN_P10_P50_P90'
  }),
  baselines: Object.freeze({
    momentum: 'TRAILING_60_SESSION_LOG_DRIFT',
    timesfm: 'EXISTING_TIMESFM_STAGE_B_RESULT_IF_AVAILABLE'
  }),
  diagnosticGates: Object.freeze({
    minimumCoveragePct: 85,
    minimumMeanRankIc20_60: 0.05,
    minimumRelativeDirectionalAccuracyPct20_60: 52,
    maximumAbsoluteDirectionBrier20_60: 0.25,
    minimumPositiveTemporalIcAssets: 5
  }),
  pretrainingCutoff: Object.freeze({
    known: false,
    historicalResultAuthority: 'DESCRIPTIVE_ONLY',
    promotionAllowed: false
  }),
  nextIfInformative: 'KRONOS_PROSPECTIVE_SHADOW_W42_PLUS',
  productionDefault: 'LEGACY',
  productionAuthority: false
});
