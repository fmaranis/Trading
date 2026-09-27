import assert from 'node:assert/strict';
import {
  capProRataFrozenWeights,
  evaluateCappedPolicy
} from '../scripts/coreOutperformanceProfitabilityCappedPolicyV1.mjs';

const infeasible = [
  { symbol: 'A', selectedWeight: 0.60 },
  { symbol: 'B', selectedWeight: 0.20 },
  { symbol: 'C', selectedWeight: 0.10 },
  { symbol: 'D', selectedWeight: 0.05 },
  { symbol: 'E', selectedWeight: 0.05 }
];
assert.throws(() => capProRataFrozenWeights(infeasible, 0.05), /INFEASIBLE/);

const feasible = Array.from({ length: 20 }, (_, i) => ({
  symbol: String(i),
  selectedWeight: i === 0 ? 0.43 : 0.57 / 19
}));
const capped = capProRataFrozenWeights(feasible, 0.05);
assert.ok(Math.abs(capped.reduce((s, row) => s + row.policyWeight, 0) - 1) < 1e-9);
assert.ok(Math.max(...capped.map(row => row.policyWeight)) <= 0.05 + 1e-12);

const snapshot = {
  study: 'CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1',
  outcome: { outcomeOpened: false },
  selected: [
    { symbol: 'A', policyWeight: 0.5 },
    { symbol: 'B', policyWeight: 0.5 }
  ]
};
const primary = evaluateCappedPolicy(snapshot, {
  months: 12,
  selectedStartAdjustedPrices: { A: 100, B: 100 },
  selectedEndAdjustedPrices: { A: 120, B: 110 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 112, URTH: 108 }
});
assert.equal(primary.status, 'PASS_PRIMARY_12M_POLICY_ONLY');
assert.ok(Math.abs(primary.basketReturnPct - 15) < 1e-12);

const descriptive = evaluateCappedPolicy(snapshot, {
  months: 3,
  selectedStartAdjustedPrices: { A: 100, B: 100 },
  selectedEndAdjustedPrices: { A: 102, B: 101 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 101, URTH: 100.5 }
});
assert.equal(descriptive.status, 'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION');

const missing = evaluateCappedPolicy(snapshot, {
  months: 12,
  selectedStartAdjustedPrices: { A: 100 },
  selectedEndAdjustedPrices: { A: 120 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 112, URTH: 108 }
});
assert.equal(missing.status, 'INCONCLUSIVE_OUTCOME_COVERAGE');
assert.deepEqual(missing.missingSelectedSymbols, ['B']);

console.log('CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1_UNIT_PASS');
