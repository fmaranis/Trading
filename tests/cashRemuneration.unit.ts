import assert from 'node:assert/strict';
import {
  CashBenchmarkService,
  ecbDepositFacilityAnnualPct,
  historicalCashBenchmarkAnnualPct
} from '../src/investment/decision/cashBenchmark';
import { accrueRemuneratedCash, allCashBenchmark, calendarDaysBetween, remuneratedCashGrowthFactor } from '../src/investment/decision/remuneratedCash';

const configured = CashBenchmarkService.set(2.5);
assert.equal(configured, 2.5);
assert.equal(CashBenchmarkService.set(-10), 0);
assert.equal(CashBenchmarkService.set(80), 50);

// Historical ECB DFR must not back-fill the first 2011 row into earlier replays.
// These dates guard the official pre-2011 table and the nominal 0% retail floor.
assert.equal(ecbDepositFacilityAnnualPct('2000-10-06'), 3.75);
assert.equal(ecbDepositFacilityAnnualPct('2003-06-06'), 1.00);
assert.equal(ecbDepositFacilityAnnualPct('2008-07-09'), 3.25);
assert.equal(ecbDepositFacilityAnnualPct('2009-05-13'), 0.25);
assert.equal(ecbDepositFacilityAnnualPct('2011-07-13'), 0.75);
assert.equal(ecbDepositFacilityAnnualPct('2014-09-10'), -0.20);
assert.equal(historicalCashBenchmarkAnnualPct('2014-09-10'), 0);

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
