import assert from 'node:assert/strict';
import {
  TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1 as P,
  classifyTimesFmDirectHistorical
} from '../scripts/timesfmDirectSelectorHistoricalDiagnosticV1Protocol.mjs';

assert.equal(P.version,'TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1');
assert.equal(P.role,'POSTHOC_DIRECT_SELECTOR_DIAGNOSTIC_NO_PROMOTION');
assert.equal(P.selector,'TIMESFM_DIRECT_SELECTOR_V1');
assert.equal(P.decisionCountExpected,31);
assert.equal(P.candidatePool,'8_STAGE_B_ASSETS_PLUS_EUNL_CORE');
assert.equal(P.selectionRule,'LOWEST_MEAN_ORDINAL_RANK_20_60');
assert.equal(P.target,'100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET');
assert.equal(P.executionSemantics,'NEXT_OPEN');
assert.equal(P.totalScenarios,15);
assert.equal(P.promotionAuthority,false);
assert.equal(P.productionAuthority,false);

assert.equal(classifyTimesFmDirectHistorical([
  {timesFmExcessFinalEurVsLegacy:10,timesFmExcessFinalEurVsCore:8},
  {timesFmExcessFinalEurVsLegacy:5,timesFmExcessFinalEurVsCore:2},
  {timesFmExcessFinalEurVsLegacy:4,timesFmExcessFinalEurVsCore:1}
]),'POSTHOC_TIMESFM_DIRECT_BEATS_BOTH');

assert.equal(classifyTimesFmDirectHistorical([
  {timesFmExcessFinalEurVsLegacy:-10,timesFmExcessFinalEurVsCore:-8},
  {timesFmExcessFinalEurVsLegacy:-5,timesFmExcessFinalEurVsCore:-2},
  {timesFmExcessFinalEurVsLegacy:-4,timesFmExcessFinalEurVsCore:-1}
]),'POSTHOC_TIMESFM_DIRECT_BEATS_NEITHER');

console.log('timesfmDirectSelectorHistoricalDiagnosticV1.unit: PASS');
