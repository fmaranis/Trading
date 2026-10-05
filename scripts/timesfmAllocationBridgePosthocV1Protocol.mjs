export const TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1 = Object.freeze({
  version: 'TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1',
  role: 'POSTHOC_ARCHITECTURE_DIAGNOSTIC_ONLY',
  lineage: 'TIMESFM_STAGE_B_PASS -> TIMESFM_RELATIVE_RANK_V1_NO_ECONOMIC_REACH -> ALLOCATION_BRIDGE',
  signalSource: 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1',
  policy: 'TIMESFM_ALLOCATION_BRIDGE_V1',
  architecture: 'CORE_ARCHITECTURE_V1',
  sample: 'CONSUMED_2018Q1_2025Q3',
  baselineSelectionPolicy: 'LEGACY',
  baselineAllocationPolicy: 'LEGACY',
  candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1',
  candidateAllocationPolicy: 'TIMESFM_ALLOCATION_BRIDGE_V1',
  intervention: 'TIMESFM_ORDINAL_QUEUE_ORDER_ONLY',
  sizingFormula: 'LEGACY_UNCHANGED',
  gateAuthority: false,
  cashAuthority: false,
  sizingAuthority: false,
  capAuthority: false,
  timingAuthority: false,
  decisionCalendar: 'EXACT_STAGE_B_INFORMATION_DATES',
  decisionCountExpected: 31,
  initialPortfolio: 'ZERO',
  externalCashFlows: 'NONE',
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
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
  verdicts: Object.freeze({
    noReach: 'POSTHOC_NO_REACH',
    positive: 'POSTHOC_POSITIVE_ECONOMIC_REACH',
    negative: 'POSTHOC_NEGATIVE_ECONOMIC_REACH',
    mixed: 'POSTHOC_MIXED_ECONOMIC_REACH'
  }),
  promotionAuthority: false,
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function classifyTimesFmAllocationBridgePosthoc(rows) {
  const reachable = rows.filter(row => row.executedTradeSignatureChanged || Math.abs(Number(row.excessFinalEur)) > 0.005);
  if (!reachable.length) return 'POSTHOC_NO_REACH';
  const deltas = rows.map(row => Number(row.excessFinalEur)).filter(Number.isFinite).sort((a,b)=>a-b);
  const median = deltas.length % 2 ? deltas[(deltas.length-1)/2] : (deltas[deltas.length/2-1]+deltas[deltas.length/2])/2;
  const positive = deltas.filter(value => value > 0.005).length;
  const negative = deltas.filter(value => value < -0.005).length;
  if (median > 0.005 && positive > negative) return 'POSTHOC_POSITIVE_ECONOMIC_REACH';
  if (median < -0.005 && negative > positive) return 'POSTHOC_NEGATIVE_ECONOMIC_REACH';
  return 'POSTHOC_MIXED_ECONOMIC_REACH';
}
