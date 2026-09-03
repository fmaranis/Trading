export const DEFAULT_CASH_BENCHMARK_ANNUAL_PCT = 2.5;
const STORAGE_KEY = 'custodia_cash_benchmark_annual_pct_v1';
export const CASH_BENCHMARK_UPDATED_EVENT = 'custodia:cash-benchmark-updated';

export type CashBenchmarkMode = 'FIXED_USER_RATE' | 'HISTORICAL_ECB_DFR_FLOOR_0';
export const DEFAULT_REPLAY_CASH_BENCHMARK_MODE: CashBenchmarkMode = 'HISTORICAL_ECB_DFR_FLOOR_0';

export interface CashBenchmarkAssessment {
  benchmarkAnnualPct: number;
  grossAnnualizedProxyPct: number | null;
  feeDragPct: number;
  netAnnualizedProxyPct: number | null;
  excessVsCashPctPoints: number | null;
  passes: boolean | null;
  basis: 'ANNUALIZED_120_SESSION_MOMENTUM_PROXY';
}

export interface HistoricalCashRatePoint {
  effectiveDate: string;
  annualPct: number;
}

export interface ReplayCashTaxSettings {
  priorSavingsTaxableBaseEur: number;
  contextConfirmed: boolean;
}

export interface ReplayCashContextSnapshot {
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  currentDate: string;
  phase: 'ENGINE' | 'PATH';
  grossInterestEur: number;
  interestTaxEur: number;
  netInterestEur: number;
}

interface ReplayCashContextState {
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  currentDate: string;
  taxSettings: ReplayCashTaxSettings;
  phase: 'ENGINE' | 'PATH';
  engineGrossInterestEur: number;
  engineInterestTaxEur: number;
  pathGrossInterestEur: number;
  pathInterestTaxEur: number;
  interestByYear: Map<string, number>;
  realizedGainByYear: Map<string, number>;
}

let activeReplayCashContext: ReplayCashContextState | null = null;

/**
 * Official ECB deposit-facility rate changes relevant to the replay range.
 * Source: ECB "Key ECB interest rates" table (effective dates and annual %).
 * Negative policy rates are retained here as source data; the retail-cash proxy
 * applies a 0% floor because the alternative to investing is assumed not to
 * accept a contractually negative nominal account rate.
 */
export const ECB_DEPOSIT_FACILITY_RATE_HISTORY: readonly HistoricalCashRatePoint[] = [
  { effectiveDate: '2011-12-14', annualPct: 0.25 },
  { effectiveDate: '2012-07-11', annualPct: 0.00 },
  { effectiveDate: '2013-05-08', annualPct: 0.00 },
  { effectiveDate: '2013-11-13', annualPct: 0.00 },
  { effectiveDate: '2014-06-11', annualPct: -0.10 },
  { effectiveDate: '2014-09-10', annualPct: -0.20 },
  { effectiveDate: '2015-12-09', annualPct: -0.30 },
  { effectiveDate: '2016-03-16', annualPct: -0.40 },
  { effectiveDate: '2019-09-18', annualPct: -0.50 },
  { effectiveDate: '2022-07-27', annualPct: 0.00 },
  { effectiveDate: '2022-09-14', annualPct: 0.75 },
  { effectiveDate: '2022-11-02', annualPct: 1.50 },
  { effectiveDate: '2022-12-21', annualPct: 2.00 },
  { effectiveDate: '2023-02-08', annualPct: 2.50 },
  { effectiveDate: '2023-03-22', annualPct: 3.00 },
  { effectiveDate: '2023-05-10', annualPct: 3.25 },
  { effectiveDate: '2023-06-21', annualPct: 3.50 },
  { effectiveDate: '2023-08-02', annualPct: 3.75 },
  { effectiveDate: '2023-09-20', annualPct: 4.00 },
  { effectiveDate: '2024-06-12', annualPct: 3.75 },
  { effectiveDate: '2024-09-18', annualPct: 3.50 },
  { effectiveDate: '2024-10-23', annualPct: 3.25 },
  { effectiveDate: '2024-12-18', annualPct: 3.00 },
  { effectiveDate: '2025-02-05', annualPct: 2.75 },
  { effectiveDate: '2025-03-12', annualPct: 2.50 },
  { effectiveDate: '2025-04-23', annualPct: 2.25 },
  { effectiveDate: '2025-06-11', annualPct: 2.00 },
  { effectiveDate: '2026-06-17', annualPct: 2.25 }
] as const;

function sanitizeRate(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
  return Math.min(50, Math.max(0, value));
}

function emitBenchmarkUpdated(value: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(CASH_BENCHMARK_UPDATED_EVENT, { detail: value }));
}

export function ecbDepositFacilityAnnualPct(date: string): number {
  const normalized = date.slice(0, 10);
  let rate = ECB_DEPOSIT_FACILITY_RATE_HISTORY[0]?.annualPct ?? 0;
  for (const point of ECB_DEPOSIT_FACILITY_RATE_HISTORY) {
    if (point.effectiveDate > normalized) break;
    rate = point.annualPct;
  }
  return rate;
}

export function historicalCashBenchmarkAnnualPct(date: string): number {
  return Math.max(0, ecbDepositFacilityAnnualPct(date));
}

export function resolveCashBenchmarkAnnualPct(input: {
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  date: string;
}): number {
  return input.mode === 'HISTORICAL_ECB_DFR_FLOOR_0'
    ? historicalCashBenchmarkAnnualPct(input.date)
    : sanitizeRate(input.fixedAnnualPct);
}

export function cashBenchmarkChangeDatesBetween(fromDate: string, toDate: string): string[] {
  return ECB_DEPOSIT_FACILITY_RATE_HISTORY
    .map(point => point.effectiveDate)
    .filter(date => date > fromDate && date < toDate);
}

export function cashBenchmarkModeLabel(mode: CashBenchmarkMode): string {
  return mode === 'HISTORICAL_ECB_DFR_FLOOR_0'
    ? 'Histórico BCE · facilidad de depósito · suelo 0%'
    : 'TAE fija configurada';
}

export function beginReplayCashContext(input: {
  mode: CashBenchmarkMode;
  fixedAnnualPct: number;
  startDate: string;
  taxSettings?: ReplayCashTaxSettings;
}): void {
  activeReplayCashContext = {
    mode: input.mode,
    fixedAnnualPct: sanitizeRate(input.fixedAnnualPct),
    currentDate: input.startDate.slice(0, 10),
    taxSettings: {
      priorSavingsTaxableBaseEur: Math.max(0, Number(input.taxSettings?.priorSavingsTaxableBaseEur) || 0),
      contextConfirmed: Boolean(input.taxSettings?.contextConfirmed)
    },
    phase: 'ENGINE',
    engineGrossInterestEur: 0,
    engineInterestTaxEur: 0,
    pathGrossInterestEur: 0,
    pathInterestTaxEur: 0,
    interestByYear: new Map<string, number>(),
    realizedGainByYear: new Map<string, number>()
  };
}

export function endReplayCashContext(): ReplayCashContextSnapshot | null {
  const state = activeReplayCashContext;
  activeReplayCashContext = null;
  if (!state) return null;
  return {
    mode: state.mode,
    fixedAnnualPct: state.fixedAnnualPct,
    currentDate: state.currentDate,
    phase: state.phase,
    grossInterestEur: state.engineGrossInterestEur,
    interestTaxEur: state.engineInterestTaxEur,
    netInterestEur: state.engineGrossInterestEur - state.engineInterestTaxEur
  };
}

export function activeReplayCashContextSnapshot(): ReplayCashContextSnapshot | null {
  const state = activeReplayCashContext;
  if (!state) return null;
  const gross = state.phase === 'ENGINE' ? state.engineGrossInterestEur : state.pathGrossInterestEur;
  const tax = state.phase === 'ENGINE' ? state.engineInterestTaxEur : state.pathInterestTaxEur;
  return {
    mode: state.mode,
    fixedAnnualPct: state.fixedAnnualPct,
    currentDate: state.currentDate,
    phase: state.phase,
    grossInterestEur: gross,
    interestTaxEur: tax,
    netInterestEur: gross - tax
  };
}

export function activeReplayCashTaxSettings(): ReplayCashTaxSettings | null {
  return activeReplayCashContext ? { ...activeReplayCashContext.taxSettings } : null;
}

export function setActiveReplayCashDate(date: string): void {
  const state = activeReplayCashContext;
  if (!state) return;
  const normalized = date.slice(0, 10);
  if (normalized < state.currentDate && state.phase === 'ENGINE') {
    state.phase = 'PATH';
    state.interestByYear.clear();
    state.realizedGainByYear.clear();
  }
  state.currentDate = normalized;
}

export function resolveReplayAwareCashBenchmarkAnnualPct(fallbackAnnualPct: number, date?: string): number {
  const state = activeReplayCashContext;
  if (!state) return sanitizeRate(fallbackAnnualPct);
  if (date) setActiveReplayCashDate(date);
  return resolveCashBenchmarkAnnualPct({
    mode: state.mode,
    fixedAnnualPct: state.fixedAnnualPct,
    date: state.currentDate
  });
}

export function activeReplaySavingsIncomeBeforeCurrentYear(): number {
  const state = activeReplayCashContext;
  if (!state) return 0;
  const year = state.currentDate.slice(0, 4);
  return (state.interestByYear.get(year) ?? 0) + (state.realizedGainByYear.get(year) ?? 0);
}

export function activeReplayInterestBeforeCurrentYear(): number {
  const state = activeReplayCashContext;
  if (!state) return 0;
  return state.interestByYear.get(state.currentDate.slice(0, 4)) ?? 0;
}

export function recordActiveReplayCashInterest(grossInterestEur: number, taxEur: number, date: string): void {
  const state = activeReplayCashContext;
  if (!state) return;
  setActiveReplayCashDate(date);
  const gross = Math.max(0, grossInterestEur);
  const tax = Math.max(0, Math.min(gross, taxEur));
  const year = state.currentDate.slice(0, 4);
  state.interestByYear.set(year, (state.interestByYear.get(year) ?? 0) + gross);
  if (state.phase === 'ENGINE') {
    state.engineGrossInterestEur += gross;
    state.engineInterestTaxEur += tax;
  } else {
    state.pathGrossInterestEur += gross;
    state.pathInterestTaxEur += tax;
  }
}

export function recordActiveReplayRealizedGain(gainEur: number): void {
  const state = activeReplayCashContext;
  if (!state) return;
  const positive = Math.max(0, gainEur);
  if (positive <= 0) return;
  const year = state.currentDate.slice(0, 4);
  state.realizedGainByYear.set(year, (state.realizedGainByYear.get(year) ?? 0) + positive);
}

export function isReplayCashContextActive(): boolean {
  return activeReplayCashContext != null;
}

export class CashBenchmarkService {
  static load(): number {
    if (typeof window === 'undefined') return DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw == null) return DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
      return sanitizeRate(Number(raw));
    } catch {
      return DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    }
  }

  static set(annualPct: number): number {
    const value = sanitizeRate(annualPct);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(value));
      emitBenchmarkUpdated(value);
    }
    return value;
  }

  static reset(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      emitBenchmarkUpdated(DEFAULT_CASH_BENCHMARK_ANNUAL_PCT);
    }
  }
}

/**
 * Converts the scanner's trailing 120-session momentum into an annualized
 * historical proxy. It is an execution hurdle diagnostic, not a forecast.
 * The first-year order commission drag is subtracted before comparing with cash.
 */
export function assessAgainstCashBenchmark(input: {
  momentum120Pct: number | null | undefined;
  benchmarkAnnualPct?: number;
  notionalEur?: number | null;
  estimatedFeeEur?: number | null;
}): CashBenchmarkAssessment {
  const benchmarkAnnualPct = resolveReplayAwareCashBenchmarkAnnualPct(input.benchmarkAnnualPct ?? DEFAULT_CASH_BENCHMARK_ANNUAL_PCT);
  const notional = input.notionalEur ?? 0;
  const fee = Math.max(0, input.estimatedFeeEur ?? 0);
  const feeDragPct = notional > 0 ? fee / notional * 100 : 0;
  const momentum120Pct = input.momentum120Pct;

  if (momentum120Pct == null || !Number.isFinite(momentum120Pct) || momentum120Pct <= -100) {
    return {
      benchmarkAnnualPct,
      grossAnnualizedProxyPct: null,
      feeDragPct,
      netAnnualizedProxyPct: null,
      excessVsCashPctPoints: null,
      passes: null,
      basis: 'ANNUALIZED_120_SESSION_MOMENTUM_PROXY'
    };
  }

  const grossAnnualizedProxyPct = (Math.pow(1 + momentum120Pct / 100, 252 / 120) - 1) * 100;
  const netAnnualizedProxyPct = grossAnnualizedProxyPct - feeDragPct;
  const excessVsCashPctPoints = netAnnualizedProxyPct - benchmarkAnnualPct;

  return {
    benchmarkAnnualPct,
    grossAnnualizedProxyPct,
    feeDragPct,
    netAnnualizedProxyPct,
    excessVsCashPctPoints,
    passes: excessVsCashPctPoints > 0,
    basis: 'ANNUALIZED_120_SESSION_MOMENTUM_PROXY'
  };
}
