export const TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1 = Object.freeze({
  version: 'TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1',
  role: 'CONSUMED_HISTORICAL_ECONOMIC_DIAGNOSTIC_NO_PROMOTION',
  signalSource: 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1',
  policy: 'TIMESFM_RELATIVE_RANK_V1',
  architecture: 'CORE_ARCHITECTURE_V1',
  baselineSelectionPolicy: 'LEGACY',
  candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1',
  allocationPolicy: 'LEGACY',
  decisionCalendar: 'EXACT_STAGE_B_INFORMATION_DATES',
  decisionCountExpected: 31,
  initialPortfolio: 'ZERO',
  externalCashFlows: 'NONE',
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  taxContext: 'CONSERVATIVE_DEFAULT_NO_CONFIRMED_PRIOR_SAVINGS_BASE',
  executionSemantics: 'NEXT_OPEN',
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
  descriptiveVerdict: Object.freeze({
    noReach: 'NO_ECONOMIC_REACH',
    positive: 'POSITIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC',
    negative: 'NEGATIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC',
    mixed: 'MIXED_HISTORICAL_ECONOMIC_DIAGNOSTIC',
    rule: 'NO_REACH_IF_ALL_EXECUTED_TRADE_SIGNATURES_EQUAL_AND_FINAL_DELTAS_ZERO_ELSE_SIGN_OF_MEDIAN_EXCESS_WITH_SCENARIO_MAJORITY'
  }),
  promotionAuthority: false,
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function classifyTimesFmHistoricalEconomicDiagnostic(rows) {
  const reachable = rows.filter(row => row.executedTradeSignatureChanged || Math.abs(row.excessFinalEur) > 0.005);
  if (reachable.length === 0) return 'NO_ECONOMIC_REACH';
  const deltas = rows.map(row => Number(row.excessFinalEur)).filter(Number.isFinite).sort((a,b)=>a-b);
  const median = deltas.length % 2 ? deltas[(deltas.length-1)/2] : (deltas[deltas.length/2-1]+deltas[deltas.length/2])/2;
  const positive = deltas.filter(value => value > 0.005).length;
  const negative = deltas.filter(value => value < -0.005).length;
  if (median > 0.005 && positive > negative) return 'POSITIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC';
  if (median < -0.005 && negative > positive) return 'NEGATIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC';
  return 'MIXED_HISTORICAL_ECONOMIC_DIAGNOSTIC';
}
