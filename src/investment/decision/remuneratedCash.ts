import {
  activeReplayCashContextSnapshot,
  activeReplayCashTaxSettings,
  activeReplaySavingsIncomeBeforeCurrentYear,
  cashBenchmarkChangeDatesBetween,
  isReplayCashContextActive,
  recordActiveReplayCashInterest,
  resolveCashBenchmarkAnnualPct,
  setActiveReplayCashDate,
  type CashBenchmarkMode
} from './cashBenchmark';
import { activeReplayExternalCashFlowsBetween } from './replayExternalCashFlows';
import { estimateSpanishTaxOnCashInterest } from './spanishTaxModel';

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

function accrueFixedRemuneratedCash(cashEur: number, annualPct: number, fromDate: string, toDate: string): { cashEur: number; interestEur: number; days: number } {
  if (!(cashEur >= 0)) throw new Error('El efectivo remunerado no puede partir de saldo negativo.');
  const days = calendarDaysBetween(fromDate, toDate);
  const factor = remuneratedCashGrowthFactor(annualPct, fromDate, toDate);
  const next = cashEur * factor;
  return { cashEur: next, interestEur: next - cashEur, days };
}

function accrueRemuneratedCashWithoutExternalFlows(cashEur: number, annualPct: number, fromDate: string, toDate: string): { cashEur: number; interestEur: number; days: number } {
  if (!isReplayCashContextActive()) return accrueFixedRemuneratedCash(cashEur, annualPct, fromDate, toDate);
  const context = activeReplayCashContextSnapshot();
  const taxSettings = activeReplayCashTaxSettings();
  if (!context || !taxSettings) return accrueFixedRemuneratedCash(cashEur, annualPct, fromDate, toDate);
  const accrued = accrueRemuneratedCashScenarioAfterTax({
    cashEur,
    mode: context.mode,
    fixedAnnualPct: context.fixedAnnualPct,
    fromDate,
    toDate,
    taxOnInterest: (grossInterestEur, taxDate) => {
      setActiveReplayCashDate(taxDate);
      const tax = estimateSpanishTaxOnCashInterest(
        grossInterestEur,
        taxSettings,
        activeReplaySavingsIncomeBeforeCurrentYear()
      ).estimatedTaxEur;
      recordActiveReplayCashInterest(grossInterestEur, tax, taxDate);
      return tax;
    }
  });
  setActiveReplayCashDate(toDate);
  return { cashEur: accrued.cashEur, interestEur: accrued.grossInterestEur, days: accrued.days };
}

/**
 * Replay-aware cash accrual. External cash flows are pure dated account
 * movements: only rows with fromDate < flow.date <= toDate are applied. This
 * keeps a future contribution invisible to all earlier decisions and also makes
 * weekend flows available to the first subsequent market/decision interval.
 */
export function accrueRemuneratedCash(cashEur: number, annualPct: number, fromDate: string, toDate: string): { cashEur: number; interestEur: number; days: number } {
  const flows = activeReplayExternalCashFlowsBetween(fromDate, toDate);
  if (!flows.length) return accrueRemuneratedCashWithoutExternalFlows(cashEur, annualPct, fromDate, toDate);

  let currentCashEur = cashEur;
  let grossInterestEur = 0;
  let cursor = fromDate;
  for (const flow of flows) {
    if (flow.date > cursor) {
      const accrued = accrueRemuneratedCashWithoutExternalFlows(currentCashEur, annualPct, cursor, flow.date);
      currentCashEur = accrued.cashEur;
      grossInterestEur += accrued.interestEur;
      cursor = flow.date;
    }
    const nextCashEur = currentCashEur + flow.amountEur;
    if (nextCashEur < -0.01) {
      throw new Error(`REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_AVAILABLE_CASH:${flow.date}:${Math.abs(flow.amountEur).toFixed(2)}`);
    }
    currentCashEur = Math.max(0, nextCashEur);
  }
  if (toDate > cursor) {
    const accrued = accrueRemuneratedCashWithoutExternalFlows(currentCashEur, annualPct, cursor, toDate);
    currentCashEur = accrued.cashEur;
    grossInterestEur += accrued.interestEur;
  }
  return { cashEur: currentCashEur, interestEur: grossInterestEur, days: calendarDaysBetween(fromDate, toDate) };
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
    const accrued = accrueFixedRemuneratedCash(cashEur, annualPct, fromDate, toDate);
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
    const accrued = accrueFixedRemuneratedCash(cashEur, annualPct, fromDate, toDate);
    const segmentTax = Math.min(accrued.interestEur, Math.max(0, input.taxOnInterest(accrued.interestEur, toDate)));
    const netInterestEur = accrued.interestEur - segmentTax;
    cashEur += netInterestEur;
    grossInterestEur += accrued.interestEur;
    taxEur += segmentTax;
    segments.push({ fromDate, toDate, annualPct, interestEur: accrued.interestEur, taxEur: segmentTax, netInterestEur });
  }
  return { cashEur, grossInterestEur, taxEur, netInterestEur: grossInterestEur - taxEur, days, segments };
}

function benchmarkReturnAdjustedForExternalFlows(
  finalEur: number,
  initialCapitalEur: number,
  flows: ReturnType<typeof activeReplayExternalCashFlowsBetween>
): number {
  const contributionsEur = flows.reduce((sum, flow) => sum + Math.max(0, flow.amountEur), 0);
  const withdrawalsEur = flows.reduce((sum, flow) => sum + Math.max(0, -flow.amountEur), 0);
  const profitEur = finalEur + withdrawalsEur - initialCapitalEur - contributionsEur;
  const grossContributedCapitalEur = Math.max(0, initialCapitalEur) + contributionsEur;
  return grossContributedCapitalEur > 0 ? profitEur / grossContributedCapitalEur * 100 : 0;
}

export function allCashBenchmark(initialCapitalEur: number, annualPct: number, fromDate: string, toDate: string): { finalEur: number; returnPct: number; interestEur: number } {
  const externalFlows = activeReplayExternalCashFlowsBetween(fromDate, toDate);
  if (!externalFlows.length) {
    if (!isReplayCashContextActive()) {
      const accrued = accrueFixedRemuneratedCash(initialCapitalEur, annualPct, fromDate, toDate);
      return {
        finalEur: accrued.cashEur,
        returnPct: initialCapitalEur > 0 ? (accrued.cashEur / initialCapitalEur - 1) * 100 : 0,
        interestEur: accrued.interestEur
      };
    }
    const context = activeReplayCashContextSnapshot();
    const taxSettings = activeReplayCashTaxSettings();
    if (!context || !taxSettings) {
      const accrued = accrueFixedRemuneratedCash(initialCapitalEur, annualPct, fromDate, toDate);
      return { finalEur: accrued.cashEur, returnPct: initialCapitalEur > 0 ? (accrued.cashEur / initialCapitalEur - 1) * 100 : 0, interestEur: accrued.interestEur };
    }
    const simulatedByYear = new Map<string, number>();
    const accrued = allCashBenchmarkScenarioAfterTax({
      initialCapitalEur,
      mode: context.mode,
      fixedAnnualPct: context.fixedAnnualPct,
      fromDate,
      toDate,
      taxOnInterest: (grossInterestEur, taxDate) => {
        const year = taxDate.slice(0, 4);
        const prior = simulatedByYear.get(year) ?? 0;
        const tax = estimateSpanishTaxOnCashInterest(grossInterestEur, taxSettings, prior).estimatedTaxEur;
        simulatedByYear.set(year, prior + Math.max(0, grossInterestEur));
        return tax;
      }
    });
    return { finalEur: accrued.finalEur, returnPct: accrued.returnPct, interestEur: accrued.grossInterestEur };
  }

  let cashEur = Math.max(0, initialCapitalEur);
  let grossInterestEur = 0;
  let cursor = fromDate;
  const context = activeReplayCashContextSnapshot();
  const taxSettings = activeReplayCashTaxSettings();
  const simulatedByYear = new Map<string, number>();

  const accrueBenchmarkSegment = (segmentFrom: string, segmentTo: string) => {
    if (segmentTo <= segmentFrom) return;
    if (!context || !taxSettings) {
      const accrued = accrueFixedRemuneratedCash(cashEur, annualPct, segmentFrom, segmentTo);
      cashEur = accrued.cashEur;
      grossInterestEur += accrued.interestEur;
      return;
    }
    const accrued = allCashBenchmarkScenarioAfterTax({
      initialCapitalEur: cashEur,
      mode: context.mode,
      fixedAnnualPct: context.fixedAnnualPct,
      fromDate: segmentFrom,
      toDate: segmentTo,
      taxOnInterest: (grossInterest, taxDate) => {
        const year = taxDate.slice(0, 4);
        const prior = simulatedByYear.get(year) ?? 0;
        const tax = estimateSpanishTaxOnCashInterest(grossInterest, taxSettings, prior).estimatedTaxEur;
        simulatedByYear.set(year, prior + Math.max(0, grossInterest));
        return tax;
      }
    });
    cashEur = accrued.finalEur;
    grossInterestEur += accrued.grossInterestEur;
  };

  for (const flow of externalFlows) {
    accrueBenchmarkSegment(cursor, flow.date);
    const nextCashEur = cashEur + flow.amountEur;
    if (nextCashEur < -0.01) throw new Error(`REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_ALL_CASH_BENCHMARK:${flow.date}`);
    cashEur = Math.max(0, nextCashEur);
    cursor = flow.date;
  }
  accrueBenchmarkSegment(cursor, toDate);

  return {
    finalEur: cashEur,
    returnPct: benchmarkReturnAdjustedForExternalFlows(cashEur, initialCapitalEur, externalFlows),
    interestEur: grossInterestEur
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
