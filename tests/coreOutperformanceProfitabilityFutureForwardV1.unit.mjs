import assert from 'node:assert/strict';
import {
  CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1 as P,
  evaluateFutureForwardCheckpoint,
  totalReturnPct,
  validateFrozenSnapshot
} from '../scripts/coreOutperformanceProfitabilityFutureForwardV1Protocol.mjs';

const snapshot = {
  study: P.version,
  productionDefault: 'LEGACY',
  productionAuthority: false,
  outcome: { outcomeOpened: false },
  selected: [
    { symbol: 'NASDAQ:A', ticker: 'A', selectedWeight: 0.6 },
    { symbol: 'NYSE:B', ticker: 'B', selectedWeight: 0.4 }
  ]
};
assert.equal(validateFrozenSnapshot(snapshot).length, 2);
assert.equal(totalReturnPct(100, 110), 10);

const descriptive = evaluateFutureForwardCheckpoint(snapshot, {
  months: 3,
  startDate: '2026-09-28',
  endDate: '2026-12-28',
  startAdjustedPrices: { 'NASDAQ:A': 100, 'NYSE:B': 100 },
  endAdjustedPrices: { 'NASDAQ:A': 110, 'NYSE:B': 90 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 102, URTH: 101 }
});
assert.equal(descriptive.status, 'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION');
assert.ok(Math.abs(descriptive.basketReturnPct - 2) < 1e-12);

const primary = evaluateFutureForwardCheckpoint(snapshot, {
  months: 12,
  startDate: '2026-09-28',
  endDate: '2027-09-28',
  startAdjustedPrices: { 'NASDAQ:A': 100, 'NYSE:B': 100 },
  endAdjustedPrices: { 'NASDAQ:A': 130, 'NYSE:B': 120 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 115, URTH: 110 }
});
assert.equal(primary.status, 'PASS_PRIMARY_12M_SIGNAL_ONLY');

const missing = evaluateFutureForwardCheckpoint(snapshot, {
  months: 12,
  startAdjustedPrices: { 'NASDAQ:A': 100 },
  endAdjustedPrices: { 'NASDAQ:A': 130 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 115, URTH: 110 }
});
assert.equal(missing.status, 'INCONCLUSIVE_OUTCOME_COVERAGE');
assert.deepEqual(missing.missingSelectedSymbols, ['NYSE:B']);

assert.throws(() => evaluateFutureForwardCheckpoint(snapshot, {
  months: 9,
  startAdjustedPrices: { 'NASDAQ:A': 100, 'NYSE:B': 100 },
  endAdjustedPrices: { 'NASDAQ:A': 110, 'NYSE:B': 110 },
  benchmarkStartAdjustedPrices: { SPY: 100, URTH: 100 },
  benchmarkEndAdjustedPrices: { SPY: 105, URTH: 105 }
}), /HORIZON_NOT_FROZEN/);

console.log('CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_UNIT_PASS');
