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

function taxYearBoundariesBetween(fromDate: string, toDate: string): string[] {
  const startYear = Number(fromDate.slice(0, 4));
  const endYear = Number(toDate.slice(0, 4));
  const out: string[] = [];
  for (let year = startYear + 1; year <= endYear; year++) {
    const boundary = `${year}-01-01`;
    if (boundary > fromDate && boundary < toDate) out.push(boundary);
  }
  return out;
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

export interface RemuneratedCashScenarioSegment {
  fromDate: string;
  toDate: string;
  annualPct: number;
  interestEur: number;
}

function scenarioBoundaries(mode: CashBenchmarkMode, fromDate: string, toDate: string): string[] {
  const rateChanges = mode === 'HISTORICAL_ECB_DFR_FLOOR_0' ? cashBenchmarkChangeDatesBetween(fromDate, toDate) : [];
  return [...new Set([fromDate, ...rateChanges, ...taxYearBoundariesBetween(fromDate, toDate), toDate])].sort();
}

export function accrueRemuneratedCashScenario(input: {
  cashEur: number;
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  fromDate: string;
  toDate: string;
}): { cashEur: number; interestEur: number; days: number; segments: RemuneratedCashScenarioSegment[] } {
  if (!(input.cashEur >= 0)) throw new Error('El efectivo remunerado no puede partir de saldo negativo.');
  const days = calendarDaysBetween(input.fromDate, input.toDate);
  if (days === 0) return { cashEur: input.cashEur, interestEur: 0, days: 0, segments: [] };

  const boundaries = scenarioBoundaries(input.mode, input.fromDate, input.toDate);
  let cashEur = input.cashEur;
  const segments: RemuneratedCashScenarioSegment[] = [];
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

export function accrueRemuneratedCashScenarioAfterTax(input: {
  cashEur: number;
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  fromDate: string;
  toDate: string;
  taxOnInterest: (grossInterestEur: number, taxDate: string) => number;
}): {
  cashEur: number;
  grossInterestEur: number;
  taxEur: number;
  netInterestEur: number;
  days: number;
  segments: Array<RemuneratedCashScenarioSegment & { taxEur: number; netInterestEur: number }>;
} {
  if (!(input.cashEur >= 0)) throw new Error('El efectivo remunerado no puede partir de saldo negativo.');
  const days = calendarDaysBetween(input.fromDate, input.toDate);
  if (days === 0) return { cashEur: input.cashEur, grossInterestEur: 0, taxEur: 0, netInterestEur: 0, days: 0, segments: [] };

  const boundaries = scenarioBoundaries(input.mode, input.fromDate, input.toDate);
  let cashEur = input.cashEur;
  let grossInterestEur = 0;
  let taxEur = 0;
  const segments: Array<RemuneratedCashScenarioSegment & { taxEur: number; netInterestEur: number }> = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const fromDate = boundaries[index];
    const toDate = boundaries[index + 1];
    const annualPct = resolveCashBenchmarkAnnualPct({ mode: input.mode, fixedAnnualPct: input.fixedAnnualPct, date: fromDate });
    const accrued = accrueRemuneratedCash(cashEur, annualPct, fromDate, toDate);
    const segmentTax = Math.min(accrued.interestEur, Math.max(0, input.taxOnInterest(accrued.interestEur, toDate)));
    const netInterestEur = accrued.interestEur - segmentTax;
    cashEur += netInterestEur;
    grossInterestEur += accrued.interestEur;
    taxEur += segmentTax;
    segments.push({ fromDate, toDate, annualPct, interestEur: accrued.interestEur, taxEur: segmentTax, netInterestEur });
  }
  return { cashEur, grossInterestEur, taxEur, netInterestEur: grossInterestEur - taxEur, days, segments };
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
}): { finalEur: number; returnPct: number; interestEur: number; segments: RemuneratedCashScenarioSegment[] } {
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

export function allCashBenchmarkScenarioAfterTax(input: {
  initialCapitalEur: number;
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  fromDate: string;
  toDate: string;
  taxOnInterest: (grossInterestEur: number, taxDate: string) => number;
}): { finalEur: number; returnPct: number; grossInterestEur: number; taxEur: number; netInterestEur: number } {
  const accrued = accrueRemuneratedCashScenarioAfterTax({
    cashEur: input.initialCapitalEur,
    mode: input.mode,
    fixedAnnualPct: input.fixedAnnualPct,
    fromDate: input.fromDate,
    toDate: input.toDate,
    taxOnInterest: input.taxOnInterest
  });
  return {
    finalEur: accrued.cashEur,
    returnPct: input.initialCapitalEur > 0 ? (accrued.cashEur / input.initialCapitalEur - 1) * 100 : 0,
    grossInterestEur: accrued.grossInterestEur,
    taxEur: accrued.taxEur,
    netInterestEur: accrued.netInterestEur
  };
}
