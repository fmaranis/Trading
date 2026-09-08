import { accrueRemuneratedCash } from './remuneratedCash';

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

export function allCashBenchmarkWithAppliedFlows(input: {
  initialCapitalEur: number;
  annualPct: number;
  startDate: string;
  endDate: string;
  appliedFlows: readonly DynamicReplayAppliedCashFlow[];
}): { finalEur: number; returnPct: number; profitEur: number } {
  let cashEur = Math.max(0, input.initialCapitalEur);
  let cursor = input.startDate;
  for (const flow of [...input.appliedFlows].sort((a, b) => a.appliedDate.localeCompare(b.appliedDate) || a.id.localeCompare(b.id))) {
    if (flow.appliedDate > cursor) {
      cashEur = accrueRemuneratedCash(cashEur, input.annualPct, cursor, flow.appliedDate).cashEur;
      cursor = flow.appliedDate;
    }
    if (flow.amountEur < 0 && cashEur + flow.amountEur < -0.01) {
      throw new Error(`REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_CASH:${flow.appliedDate}`);
    }
    cashEur = Math.max(0, cashEur + flow.amountEur);
  }
  if (input.endDate > cursor) cashEur = accrueRemuneratedCash(cashEur, input.annualPct, cursor, input.endDate).cashEur;
  const performance = cashFlowAdjustedPerformance({ finalValueEur: cashEur, initialCapitalEur: input.initialCapitalEur, appliedFlows: input.appliedFlows });
  return { finalEur: cashEur, returnPct: performance.returnPct, profitEur: performance.profitEur };
}
