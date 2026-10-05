import assert from 'node:assert/strict';
import {
  TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1 as P,
  classifyTimesFmHistoricalEconomicDiagnostic
} from '../scripts/timesfmRelativeRankEconomicDiagnosticV1Protocol.mjs';

assert.equal(P.version,'TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1');
assert.equal(P.role,'CONSUMED_HISTORICAL_ECONOMIC_DIAGNOSTIC_NO_PROMOTION');
assert.equal(P.policy,'TIMESFM_RELATIVE_RANK_V1');
assert.equal(P.architecture,'CORE_ARCHITECTURE_V1');
assert.equal(P.baselineSelectionPolicy,'LEGACY');
assert.equal(P.candidateSelectionPolicy,'TIMESFM_RELATIVE_RANK_V1');
assert.equal(P.allocationPolicy,'LEGACY');
assert.equal(P.decisionCalendar,'EXACT_STAGE_B_INFORMATION_DATES');
assert.equal(P.decisionCountExpected,31);
assert.equal(P.initialPortfolio,'ZERO');
assert.equal(P.externalCashFlows,'NONE');
assert.equal(P.cashBenchmarkMode,'HISTORICAL_ECB_DFR_FLOOR_0');
assert.equal(P.executionSemantics,'NEXT_OPEN');
assert.equal(P.horizonYears,5);
assert.equal(P.minimumBars,252);
assert.deepEqual(P.capitalScenarios.map(row=>row.initialCapitalEur),[250,500,2500,10000,30000]);
assert.deepEqual(P.riskProfiles,['LOW','MEDIUM','HIGH']);
assert.equal(P.totalScenarios,15);
assert.equal(P.promotionAuthority,false);
assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);

assert.equal(classifyTimesFmHistoricalEconomicDiagnostic([
  {executedTradeSignatureChanged:false,excessFinalEur:0},
  {executedTradeSignatureChanged:false,excessFinalEur:0}
]),'NO_ECONOMIC_REACH');

assert.equal(classifyTimesFmHistoricalEconomicDiagnostic([
  {executedTradeSignatureChanged:true,excessFinalEur:10},
  {executedTradeSignatureChanged:true,excessFinalEur:5},
  {executedTradeSignatureChanged:true,excessFinalEur:-1}
]),'POSITIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC');

assert.equal(classifyTimesFmHistoricalEconomicDiagnostic([
  {executedTradeSignatureChanged:true,excessFinalEur:-10},
  {executedTradeSignatureChanged:true,excessFinalEur:-5},
  {executedTradeSignatureChanged:true,excessFinalEur:1}
]),'NEGATIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC');

console.log('timesfmRelativeRankEconomicDiagnosticV1.unit: PASS');
