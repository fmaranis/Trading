import {
  activeReplayCashContextSnapshot,
  activeReplayCashTaxSettings,
  isReplayCashContextActive
} from './cashBenchmark';
import {
  accrueRemuneratedCashScenarioAfterTax,
  allCashBenchmark
} from './remuneratedCash';
import { estimateSpanishTaxOnCashInterest } from './spanishTaxModel';

export type DynamicReplayExternalCashFlowKind = 'CONTRIBUTION' | 'WITHDRAWAL';

/**
 * External money entering/leaving the portfolio account. This is intentionally
 * different from replay decision cadence and from stagedCapitalPlan, which is
 * capital already available for staged deployment.
 *
 * The shape is structurally compatible with PortfolioCashFlowHistoryEntry once
 * BASELINE rows are excluded by the caller.
 */
export interface DynamicReplayExternalCashFlow {
  id?: string;
  date: string;
  amountEur: number;
  kind?: DynamicReplayExternalCashFlowKind;
  label?: string;
}

export interface DynamicReplayAppliedCashFlow {
  id: string;
  scheduledDate: string;
  appliedDate: string;
  amountEur: number;
  kind: DynamicReplayExternalCashFlowKind;
  label: string;
}

export interface DynamicReplayCashFlowSummary {
  contributionsEur: number;
  withdrawalsEur: number;
  netExternalCashFlowEur: number;
  grossContributedCapitalEur: number;
}

export interface IndependentReplayCashAccumulator {
  readonly startDate: string;
  readonly annualPct: number;
  currentDate(): string;
  valueEur(): number;
  advanceTo(date: string): number;
  applyExternalFlow(amountEur: number, date: string): number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeReplayExternalCashFlows(
  rows: readonly DynamicReplayExternalCashFlow[] | null | undefined,
  startDate: string,
  endDate: string
): DynamicReplayExternalCashFlow[] {
  if (!rows?.length) return [];
  return rows
    .map((row, index) => {
      const date = String(row?.date ?? '');
      const amountEur = Number(row?.amountEur);
      if (!ISO_DATE.test(date)) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_INVALID_DATE:${date || index}`);
      if (!Number.isFinite(amountEur) || Math.abs(amountEur) < 0.005) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_INVALID_AMOUNT:${date}`);
      if (date < startDate || date > endDate) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_OUTSIDE_REPLAY:${date}`);
      const inferredKind: DynamicReplayExternalCashFlowKind = amountEur > 0 ? 'CONTRIBUTION' : 'WITHDRAWAL';
      if (row.kind && row.kind !== inferredKind) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_KIND_AMOUNT_MISMATCH:${date}`);
      return {
        id: String(row.id || `flow_${index}_${date}`),
        date,
        amountEur,
        kind: inferredKind,
        label: String(row.label || (amountEur > 0 ? 'Aportación externa' : 'Retirada externa'))
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}

export function summarizeAppliedCashFlows(
  flows: readonly DynamicReplayAppliedCashFlow[],
  initialCapitalEur: number
): DynamicReplayCashFlowSummary {
  const contributionsEur = flows.reduce((sum, flow) => sum + Math.max(0, flow.amountEur), 0);
  const withdrawalsEur = flows.reduce((sum, flow) => sum + Math.max(0, -flow.amountEur), 0);
  return {
    contributionsEur,
    withdrawalsEur,
    netExternalCashFlowEur: contributionsEur - withdrawalsEur,
    grossContributedCapitalEur: Math.max(0, initialCapitalEur) + contributionsEur
  };
}

/**
 * Simple cumulative performance measure that removes external money from P/L.
 * It is deliberately not labelled IRR/TWR: timing-aware portfolio analytics can
 * be added separately without silently redefining the existing replay metric.
 */
export function cashFlowAdjustedPerformance(input: {
  finalValueEur: number;
  initialCapitalEur: number;
  appliedFlows: readonly DynamicReplayAppliedCashFlow[];
}): { profitEur: number; returnPct: number; summary: DynamicReplayCashFlowSummary } {
  const summary = summarizeAppliedCashFlows(input.appliedFlows, input.initialCapitalEur);
  const profitEur = input.finalValueEur + summary.withdrawalsEur - input.initialCapitalEur - summary.contributionsEur;
  const returnPct = summary.grossContributedCapitalEur > 0 ? profitEur / summary.grossContributedCapitalEur * 100 : 0;
  return { profitEur, returnPct, summary };
}

/**
 * Independent cash accumulator for benchmarks/path comparisons.
 * It reads the active replay cash mode/tax settings but never writes to the
 * active replay context, so benchmark interest cannot contaminate portfolio
 * interest, tax progression or the engine/path accounting phases.
 */
export function createIndependentReplayCashAccumulator(input: {
  initialCapitalEur: number;
  annualPct: number;
  startDate: string;
}): IndependentReplayCashAccumulator {
  const context = activeReplayCashContextSnapshot();
  const taxSettings = activeReplayCashTaxSettings();
  const grossInterestByYear = new Map<string, number>();
  let cashEur = Math.max(0, input.initialCapitalEur);
  let cursor = input.startDate;

  const advanceTo = (date: string): number => {
    if (date < cursor) throw new Error(`REPLAY_INDEPENDENT_CASH_DATE_REGRESSION:${cursor}:${date}`);
    if (date === cursor) return cashEur;
    if (isReplayCashContextActive() && context && taxSettings) {
      const accrued = accrueRemuneratedCashScenarioAfterTax({
        cashEur,
        mode: context.mode,
        fixedAnnualPct: context.fixedAnnualPct,
        fromDate: cursor,
        toDate: date,
        taxOnInterest: (grossInterestEur, taxDate) => {
          const year = taxDate.slice(0, 4);
          const prior = grossInterestByYear.get(year) ?? 0;
          const tax = estimateSpanishTaxOnCashInterest(grossInterestEur, taxSettings, prior).estimatedTaxEur;
          grossInterestByYear.set(year, prior + Math.max(0, grossInterestEur));
          return tax;
        }
      });
      cashEur = accrued.cashEur;
    } else {
      cashEur = allCashBenchmark(cashEur, input.annualPct, cursor, date).finalEur;
    }
    cursor = date;
    return cashEur;
  };

  return {
    startDate: input.startDate,
    annualPct: input.annualPct,
    currentDate: () => cursor,
    valueEur: () => cashEur,
    advanceTo,
    applyExternalFlow: (amountEur: number, date: string) => {
      advanceTo(date);
      if (amountEur < 0 && cashEur + amountEur < -0.01) throw new Error(`REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_CASH_BENCHMARK:${date}`);
      cashEur = Math.max(0, cashEur + amountEur);
      return cashEur;
    }
  };
}

export function allCashBenchmarkWithAppliedFlows(input: {
  initialCapitalEur: number;
  annualPct: number;
  startDate: string;
  endDate: string;
  appliedFlows: readonly DynamicReplayAppliedCashFlow[];
}): { finalEur: number; returnPct: number; profitEur: number } {
  const accumulator = createIndependentReplayCashAccumulator({
    initialCapitalEur: input.initialCapitalEur,
    annualPct: input.annualPct,
    startDate: input.startDate
  });
  for (const flow of [...input.appliedFlows].sort((a, b) => a.appliedDate.localeCompare(b.appliedDate) || a.id.localeCompare(b.id))) {
    accumulator.applyExternalFlow(flow.amountEur, flow.appliedDate);
  }
  accumulator.advanceTo(input.endDate);
  const finalEur = accumulator.valueEur();
  const performance = cashFlowAdjustedPerformance({ finalValueEur: finalEur, initialCapitalEur: input.initialCapitalEur, appliedFlows: input.appliedFlows });
  return { finalEur, returnPct: performance.returnPct, profitEur: performance.profitEur };
}
