import assert from 'node:assert/strict';
import { CashBenchmarkService } from '../src/investment/decision/cashBenchmark';
import { accrueRemuneratedCash, allCashBenchmark, calendarDaysBetween, remuneratedCashGrowthFactor } from '../src/investment/decision/remuneratedCash';

const configured = CashBenchmarkService.set(2.5);
assert.equal(configured, 2.5);
assert.equal(CashBenchmarkService.set(-10), 0);
assert.equal(CashBenchmarkService.set(80), 50);

assert.equal(calendarDaysBetween('2025-01-01', '2026-01-01'), 365);
assert.equal(calendarDaysBetween('2026-01-01', '2025-01-01'), 0);

const factor = remuneratedCashGrowthFactor(2.5, '2025-01-01', '2026-01-01');
assert.ok(Math.abs(factor - 1.025) < 1e-12);

const accrued = accrueRemuneratedCash(10_000, 2.5, '2025-01-01', '2026-01-01');
assert.ok(Math.abs(accrued.cashEur - 10_250) < 1e-9);
assert.ok(Math.abs(accrued.interestEur - 250) < 1e-9);
assert.equal(accrued.days, 365);

const allCash = allCashBenchmark(13_000, 2.5, '2025-01-01', '2026-01-01');
assert.ok(Math.abs(allCash.finalEur - 13_325) < 1e-9);
assert.ok(Math.abs(allCash.interestEur - 325) < 1e-9);
assert.ok(Math.abs(allCash.returnPct - 2.5) < 1e-12);

const zeroRate = accrueRemuneratedCash(13_000, 0, '2025-01-01', '2026-01-01');
assert.equal(zeroRate.cashEur, 13_000);
assert.equal(zeroRate.interestEur, 0);

console.log('CASH_REMUNERATION_CONTRACT_RESULT', {
  annualPct: configured,
  oneYearGrowthFactor: factor,
  accruedInterestOn10000: accrued.interestEur,
  allCashFinalOn13000: allCash.finalEur
});
