import assert from 'node:assert/strict';
import { calendarDaysBetween } from '../src/investment/decision/remuneratedCash';

function creditedMonthlyInterest(principalEur: number, annualPct: number, periods: Array<{ from: string; to: string; principalEur?: number }>): number {
  const daily = annualPct > 0 ? Math.pow(1 + annualPct / 100, 1 / 365) - 1 : 0;
  return periods.reduce((sum, period) => sum + (period.principalEur ?? principalEur) * daily * calendarDaysBetween(period.from, period.to), 0);
}

const augustInterest = creditedMonthlyInterest(13_000, 2.5, [
  { from: '2026-08-11', to: '2026-08-12', principalEur: 14_400 },
  { from: '2026-08-12', to: '2026-08-31', principalEur: 13_000 }
]);

assert.ok(augustInterest > 17 && augustInterest < 18, `Interés parcial agosto inesperado: ${augustInterest}`);
assert.ok(augustInterest < 13_000 * 0.025, '2,5% TAE no puede aplicarse como 2,5% mensual');

console.log('monthlyCashInterest.unit: PASS');
