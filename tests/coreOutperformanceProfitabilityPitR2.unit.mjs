import assert from 'node:assert/strict';
import {
  CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2 as P,
  topDecileCount,
  selectTopDecile,
  yahooTicker
} from '../scripts/coreOutperformanceProfitabilityPitR2Protocol.mjs';

assert.equal(P.version,'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2');
assert.equal(P.supersedesPreOutcome,'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1');
assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);
assert.equal(P.fundamentals.eligibility,'REVENUE_REQUIRED_AND_AT_LEAST_ONE_OF_COGS_SGA_INTEREST_PRESENT');
assert.equal(P.fundamentals.missingExpenseRule,'MISSING_COGS_SGA_OR_INTEREST_IMPUTED_ZERO_AFTER_AT_LEAST_ONE_EXPENSE_IS_PRESENT');
assert.equal(P.fundamentals.noOperatingIncomeFallback,true);
assert.equal(P.coverage.minimumEvaluable,250);
assert.equal(P.coverage.minimumSelected,25);
assert.equal(P.anchors.length,6);
assert.equal(P.stageC1Gate.requiredPeriods,5);
assert.equal(topDecileCount(250),25);
assert.equal(topDecileCount(251),26);
assert.equal(yahooTicker('BRK.B'),'BRK-B');

const rows=Array.from({length:21},(_,i)=>({ticker:`T${String(i).padStart(2,'0')}`,operatingProfitability:i}));
assert.deepEqual(selectTopDecile(rows).map(x=>x.ticker),['T20','T19','T18']);

console.log('coreOutperformanceProfitabilityPitR2.unit: PASS');
