import {
  cashBenchmarkChangeDatesBetween,
  resolveCashBenchmarkAnnualPct,
  type CashBenchmarkMode
} from './cashBenchmark';

export const DEFAULT_CASH_DAY_COUNT = 365;

function utcDay(date: string): number {
  const parsed = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Fecha no válida para efectivo remunerado: ${date}`);
  return parsed;
}

export function calendarDaysBetween(fromDate: string, toDate: string): number {
  const days = Math.round((utcDay(toDate) - utcDay(fromDate)) / 86_400_000);
  return Math.max(0, days);
}

export function remuneratedCashGrowthFactor(annualPct: number, fromDate: string, toDate: string, dayCount = DEFAULT_CASH_DAY_COUNT): number {
  const rate = Number.isFinite(annualPct) ? Math.max(0, annualPct) / 100 : 0;
  if (rate === 0) return 1;
  const days = calendarDaysBetween(fromDate, toDate);
  if (days === 0) return 1;
  return Math.pow(1 + rate, days / dayCount);
}

export function accrueRemuneratedCash(cashEur: number, annualPct: number, fromDate: string, toDate: string): { cashEur: number; interestEur: number; days: number } {
  if (!(cashEur >= 0)) throw new Error('El efectivo remunerado no puede partir de saldo negativo.');
  const days = calendarDaysBetween(fromDate, toDate);
  const factor = remuneratedCashGrowthFactor(annualPct, fromDate, toDate);
  const next = cashEur * factor;
  return { cashEur: next, interestEur: next - cashEur, days };
}

export function accrueRemuneratedCashScenario(input: {
  cashEur: number;
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  fromDate: string;
  toDate: string;
}): { cashEur: number; interestEur: number; days: number; segments: Array<{ fromDate: string; toDate: string; annualPct: number; interestEur: number }> } {
  if (!(input.cashEur >= 0)) throw new Error('El efectivo remunerado no puede partir de saldo negativo.');
  const days = calendarDaysBetween(input.fromDate, input.toDate);
  if (days === 0) return { cashEur: input.cashEur, interestEur: 0, days: 0, segments: [] };

  const boundaries = input.mode === 'HISTORICAL_ECB_DFR_FLOOR_0'
    ? [input.fromDate, ...cashBenchmarkChangeDatesBetween(input.fromDate, input.toDate), input.toDate]
    : [input.fromDate, input.toDate];

  let cashEur = input.cashEur;
  const segments: Array<{ fromDate: string; toDate: string; annualPct: number; interestEur: number }> = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const fromDate = boundaries[index];
    const toDate = boundaries[index + 1];
    const annualPct = resolveCashBenchmarkAnnualPct({ mode: input.mode, fixedAnnualPct: input.fixedAnnualPct, date: fromDate });
    const accrued = accrueRemuneratedCash(cashEur, annualPct, fromDate, toDate);
    segments.push({ fromDate, toDate, annualPct, interestEur: accrued.interestEur });
    cashEur = accrued.cashEur;
  }
  return { cashEur, interestEur: cashEur - input.cashEur, days, segments };
}

export function allCashBenchmark(initialCapitalEur: number, annualPct: number, fromDate: string, toDate: string): { finalEur: number; returnPct: number; interestEur: number } {
  const accrued = accrueRemuneratedCash(initialCapitalEur, annualPct, fromDate, toDate);
  return {
    finalEur: accrued.cashEur,
    returnPct: initialCapitalEur > 0 ? (accrued.cashEur / initialCapitalEur - 1) * 100 : 0,
    interestEur: accrued.interestEur
  };
}

export function allCashBenchmarkScenario(input: {
  initialCapitalEur: number;
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  fromDate: string;
  toDate: string;
}): { finalEur: number; returnPct: number; interestEur: number; segments: Array<{ fromDate: string; toDate: string; annualPct: number; interestEur: number }> } {
  const accrued = accrueRemuneratedCashScenario({
    cashEur: input.initialCapitalEur,
    mode: input.mode,
    fixedAnnualPct: input.fixedAnnualPct,
    fromDate: input.fromDate,
    toDate: input.toDate
  });
  return {
    finalEur: accrued.cashEur,
    returnPct: input.initialCapitalEur > 0 ? (accrued.cashEur / input.initialCapitalEur - 1) * 100 : 0,
    interestEur: accrued.interestEur,
    segments: accrued.segments
  };
}
