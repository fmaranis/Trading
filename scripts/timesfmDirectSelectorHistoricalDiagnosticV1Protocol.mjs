export const TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1 = Object.freeze({
  version: 'TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1',
  role: 'POSTHOC_DIRECT_SELECTOR_DIAGNOSTIC_NO_PROMOTION',
  selector: 'TIMESFM_DIRECT_SELECTOR_V1',
  signalSource: 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1',
  architecture: 'CORE_ARCHITECTURE_V1_REPLAY_WITH_RESEARCH_DIRECT_SELECTOR',
  sample: 'CONSUMED_2018Q1_2025Q3',
  decisionCalendar: 'EXACT_STAGE_B_INFORMATION_DATES',
  decisionCountExpected: 31,
  candidatePool: '8_STAGE_B_ASSETS_PLUS_EUNL_CORE',
  coreRelativeForecastPct: 0,
  selectionRule: 'LOWEST_MEAN_ORDINAL_RANK_20_60',
  target: '100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET',
  executionSemantics: 'NEXT_OPEN',
  baselineArm: 'LEGACY_APP_CORE_ARCHITECTURE_V1',
  coreArm: 'DIRECT_EUNL_CORE',
  initialPortfolio: 'ZERO',
  externalCashFlows: 'NONE',
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  horizonYears: 5,
  minimumBars: 252,
  capitalScenarios: Object.freeze([
    Object.freeze({ band: 'MICRO', initialCapitalEur: 250 }),
    Object.freeze({ band: 'SMALL', initialCapitalEur: 500 }),
    Object.freeze({ band: 'MEDIUM', initialCapitalEur: 2500 }),
    Object.freeze({ band: 'LARGE', initialCapitalEur: 10000 }),
    Object.freeze({ band: 'INSTITUTIONAL', initialCapitalEur: 30000 })
  ]),
  riskProfiles: Object.freeze(['LOW','MEDIUM','HIGH']),
  totalScenarios: 15,
  promotionAuthority: false,
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function classifyTimesFmDirectHistorical(rows) {
  const eps = 0.005;
  const vsLegacy = rows.map(row => Number(row.timesFmExcessFinalEurVsLegacy)).filter(Number.isFinite).sort((a,b)=>a-b);
  const vsCore = rows.map(row => Number(row.timesFmExcessFinalEurVsCore)).filter(Number.isFinite).sort((a,b)=>a-b);
  const median = values => values.length % 2 ? values[(values.length-1)/2] : (values[values.length/2-1]+values[values.length/2])/2;
  const mLegacy = median(vsLegacy);
  const mCore = median(vsCore);
  const beatLegacy = vsLegacy.filter(value => value > eps).length;
  const beatCore = vsCore.filter(value => value > eps).length;
  if (mLegacy > eps && mCore > eps && beatLegacy >= 8 && beatCore >= 8) return 'POSTHOC_TIMESFM_DIRECT_BEATS_BOTH';
  if (mLegacy > eps && beatLegacy >= 8 && !(mCore > eps && beatCore >= 8)) return 'POSTHOC_TIMESFM_DIRECT_BEATS_LEGACY_ONLY';
  if (mCore > eps && beatCore >= 8 && !(mLegacy > eps && beatLegacy >= 8)) return 'POSTHOC_TIMESFM_DIRECT_BEATS_CORE_ONLY';
  if (mLegacy < -eps && mCore < -eps && beatLegacy < 8 && beatCore < 8) return 'POSTHOC_TIMESFM_DIRECT_BEATS_NEITHER';
  return 'POSTHOC_TIMESFM_DIRECT_MIXED';
}
