import assert from 'node:assert/strict';
import { evaluateProfitabilityValueFutureForward } from '../scripts/coreOutperformanceProfitabilityValueFutureForwardV1.mjs';

const snapshot = {
  study:'CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1',
  outcome:{outcomeOpened:false},
  concentration:{effectiveNumberOfPositions:1},
  selected:[{symbol:'NASDAQ:CHTR',weight:1}]
};
const d = evaluateProfitabilityValueFutureForward(snapshot,{
  months:3,
  selectedStartAdjustedPrices:{'NASDAQ:CHTR':100},
  selectedEndAdjustedPrices:{'NASDAQ:CHTR':110},
  benchmarkStartAdjustedPrices:{SPY:100,URTH:100},
  benchmarkEndAdjustedPrices:{SPY:105,URTH:104}
});
assert.equal(d.status,'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION');
assert.equal(d.concentrationBlockedForPromotion,true);

const p = evaluateProfitabilityValueFutureForward(snapshot,{
  months:12,
  selectedStartAdjustedPrices:{'NASDAQ:CHTR':100},
  selectedEndAdjustedPrices:{'NASDAQ:CHTR':120},
  benchmarkStartAdjustedPrices:{SPY:100,URTH:100},
  benchmarkEndAdjustedPrices:{SPY:115,URTH:110}
});
assert.equal(p.status,'PASS_PRIMARY_12M_SIGNAL_ONLY');
assert.equal(p.concentrationBlockedForPromotion,true);

const missing=evaluateProfitabilityValueFutureForward(snapshot,{
  months:12,
  selectedStartAdjustedPrices:{},
  selectedEndAdjustedPrices:{},
  benchmarkStartAdjustedPrices:{SPY:100,URTH:100},
  benchmarkEndAdjustedPrices:{SPY:115,URTH:110}
});
assert.equal(missing.status,'INCONCLUSIVE_OUTCOME_COVERAGE');
console.log('CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1_UNIT_PASS');
