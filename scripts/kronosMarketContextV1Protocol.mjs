export const KRONOS_MARKET_CONTEXT_V1 = Object.freeze({
  version: 'KRONOS_MARKET_CONTEXT_V1',
  role: 'RESEARCH_ONLY_FINANCIAL_KLINE_FOUNDATION_MODEL_CONTEXT',
  source: Object.freeze({
    repository: 'shiyu-coder/Kronos',
    commit: '67b630e67f6a18c9e9be918d9b4337c960db1e9a',
    license: 'MIT',
    files: Object.freeze({
      'model/__init__.py': '718d07a21b53b7eff4a6564e6dfcae8ee7e8c6b1',
      'model/kronos.py': 'ce4494ee0b3ec8751b09d5488c93bde995e008e0',
      'model/module.py': 'f2a05158b48a56e9235426f6583e384360d761f9'
    })
  }),
  model: Object.freeze({
    repoId: 'NeoQuasar/Kronos-small',
    revision: '901c26c1332695a2a8f243eb2f37243a37bea320',
    weightSha256: 'b082dfcbd8e8c142a725c8bbb99781802f38fec81210e13479effb32b3c3e020',
    parameters: 24700000,
    maxContext: 512
  }),
  tokenizer: Object.freeze({
    repoId: 'NeoQuasar/Kronos-Tokenizer-base',
    revision: '0e0117387f39004a9016484a186a908917e22426',
    weightSha256: '59d85f6af76a2c3b8240ea06cb21db4213b4eeca053f246b23e29cf832fc6bee'
  }),
  sampling: Object.freeze({
    temperature: 1,
    topP: 0.9,
    topK: 0,
    stageASamplePaths: 4,
    stageBProspectiveSamplePaths: 20,
    deterministicSeedBase: 20261007
  }),
  horizons: Object.freeze([20, 60]),
  stageA: Object.freeze({
    dataProvenance: 'SYNTHETIC',
    lookback: 128,
    smokeHorizon: 5,
    marketPricesFetched: false,
    marketOutcomesOpened: false,
    economicPolicyOpened: false
  }),
  pretrainingCutoff: Object.freeze({
    known: false,
    consequence: 'HISTORICAL_KRONOS_RESULTS_DIAGNOSTIC_ONLY_NO_PROMOTION'
  }),
  firstProspectiveEligibleWeek: '2026-10-12',
  productionDefault: 'LEGACY',
  productionAuthority: false
});
