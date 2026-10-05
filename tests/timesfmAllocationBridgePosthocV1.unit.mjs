import assert from 'node:assert/strict';
import {
  TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1 as P,
  classifyTimesFmAllocationBridgePosthoc
} from '../scripts/timesfmAllocationBridgePosthocV1Protocol.mjs';

assert.equal(P.version,'TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1');
assert.equal(P.role,'POSTHOC_ARCHITECTURE_DIAGNOSTIC_ONLY');
assert.equal(P.sample,'CONSUMED_2018Q1_2025Q3');
assert.equal(P.architecture,'CORE_ARCHITECTURE_V1');
assert.equal(P.baselineSelectionPolicy,'LEGACY');
assert.equal(P.baselineAllocationPolicy,'LEGACY');
assert.equal(P.candidateSelectionPolicy,'TIMESFM_RELATIVE_RANK_V1');
assert.equal(P.candidateAllocationPolicy,'TIMESFM_ALLOCATION_BRIDGE_V1');
assert.equal(P.intervention,'TIMESFM_ORDINAL_QUEUE_ORDER_ONLY');
assert.equal(P.sizingFormula,'LEGACY_UNCHANGED');
assert.equal(P.gateAuthority,false);
assert.equal(P.cashAuthority,false);
assert.equal(P.sizingAuthority,false);
assert.equal(P.capAuthority,false);
assert.equal(P.timingAuthority,false);
assert.equal(P.decisionCountExpected,31);
assert.equal(P.totalScenarios,15);
assert.equal(P.promotionAuthority,false);
assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);

assert.equal(classifyTimesFmAllocationBridgePosthoc([
  {executedTradeSignatureChanged:false,excessFinalEur:0},
  {executedTradeSignatureChanged:false,excessFinalEur:0}
]),'POSTHOC_NO_REACH');

assert.equal(classifyTimesFmAllocationBridgePosthoc([
  {executedTradeSignatureChanged:true,excessFinalEur:10},
  {executedTradeSignatureChanged:true,excessFinalEur:2},
  {executedTradeSignatureChanged:true,excessFinalEur:-1}
]),'POSTHOC_POSITIVE_ECONOMIC_REACH');

assert.equal(classifyTimesFmAllocationBridgePosthoc([
  {executedTradeSignatureChanged:true,excessFinalEur:-10},
  {executedTradeSignatureChanged:true,excessFinalEur:-2},
  {executedTradeSignatureChanged:true,excessFinalEur:1}
]),'POSTHOC_NEGATIVE_ECONOMIC_REACH');

console.log('timesfmAllocationBridgePosthocV1.unit: PASS');
