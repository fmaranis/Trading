export const DEFAULT_CASH_BENCHMARK_ANNUAL_PCT = 2.5;
const STORAGE_KEY = 'custodia_cash_benchmark_annual_pct_v1';

export interface CashBenchmarkAssessment {
  benchmarkAnnualPct: number;
  grossAnnualizedProxyPct: number | null;
  feeDragPct: number;
  netAnnualizedProxyPct: number | null;
  excessVsCashPctPoints: number | null;
  passes: boolean | null;
  basis: 'ANNUALIZED_120_SESSION_MOMENTUM_PROXY';
}

function sanitizeRate(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
  return Math.min(50, Math.max(0, value));
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
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, String(value));
    return value;
  }

  static reset(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
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
  const benchmarkAnnualPct = sanitizeRate(input.benchmarkAnnualPct ?? DEFAULT_CASH_BENCHMARK_ANNUAL_PCT);
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
