import assert from 'node:assert/strict';
import {
  DEFAULT_REPLAY_CASH_BENCHMARK_MODE,
  historicalCashBenchmarkAnnualPct,
  resolveCashBenchmarkAnnualPct
} from '../src/investment/decision/cashBenchmark';
import { accrueRemuneratedCashScenario } from '../src/investment/decision/remuneratedCash';

assert.equal(DEFAULT_REPLAY_CASH_BENCHMARK_MODE, 'HISTORICAL_ECB_DFR_FLOOR_0');
assert.equal(historicalCashBenchmarkAnnualPct('2012-01-03'), 0.25);
assert.equal(historicalCashBenchmarkAnnualPct('2015-06-01'), 0);
assert.equal(historicalCashBenchmarkAnnualPct('2022-10-01'), 0.75);
assert.equal(historicalCashBenchmarkAnnualPct('2023-10-01'), 4);
assert.equal(historicalCashBenchmarkAnnualPct('2025-04-01'), 2.5);
assert.equal(historicalCashBenchmarkAnnualPct('2026-07-01'), 2.25);

assert.equal(resolveCashBenchmarkAnnualPct({ mode: 'FIXED_USER_RATE', fixedAnnualPct: 2.5, date: '2015-06-01' }), 2.5);
assert.equal(resolveCashBenchmarkAnnualPct({ mode: 'HISTORICAL_ECB_DFR_FLOOR_0', fixedAnnualPct: 2.5, date: '2015-06-01' }), 0);

const acrossChange = accrueRemuneratedCashScenario({
  cashEur: 10_000,
  mode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  fixedAnnualPct: 2.5,
  fromDate: '2022-09-01',
  toDate: '2022-10-01'
});
assert.equal(acrossChange.segments.length, 2);
assert.equal(acrossChange.segments[0].annualPct, 0);
assert.equal(acrossChange.segments[1].annualPct, 0.75);
assert.ok(acrossChange.cashEur > 10_000);

console.log('historicalCashBenchmark.unit PASS');
