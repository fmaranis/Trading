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
let activeReplayExternalCashFlows: DynamicReplayExternalCashFlow[] | null = null;

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
      if (date <= startDate) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_MUST_BE_AFTER_START:${date}`);
      if (date > endDate) throw new Error(`REPLAY_EXTERNAL_CASH_FLOW_OUTSIDE_REPLAY:${date}`);
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

export function beginReplayExternalCashFlowContext(
  rows: readonly DynamicReplayExternalCashFlow[] | null | undefined,
  startDate: string,
  endDate: string
): DynamicReplayExternalCashFlow[] {
  const normalized = normalizeReplayExternalCashFlows(rows, startDate, endDate);
  activeReplayExternalCashFlows = normalized;
  return normalized.map(row => ({ ...row }));
}

export function endReplayExternalCashFlowContext(): void {
  activeReplayExternalCashFlows = null;
}

export function isReplayExternalCashFlowContextActive(): boolean {
  return activeReplayExternalCashFlows != null;
}

export function activeReplayExternalCashFlowsSnapshot(): DynamicReplayExternalCashFlow[] {
  return (activeReplayExternalCashFlows ?? []).map(row => ({ ...row }));
}

/**
 * Cash flows are calendar-dated account movements. A weekend contribution is
 * therefore part of the first cash interval that crosses that calendar date and
 * is visible only to decisions after it. This is causal and does not require a
 * fictitious market session on the flow date.
 */
export function activeReplayExternalCashFlowsBetween(fromDate: string, toDate: string): DynamicReplayExternalCashFlow[] {
  if (!activeReplayExternalCashFlows?.length || toDate <= fromDate) return [];
  return activeReplayExternalCashFlows
    .filter(row => row.date > fromDate && row.date <= toDate)
    .map(row => ({ ...row }));
}

export function appliedReplayExternalCashFlowsSnapshot(): DynamicReplayAppliedCashFlow[] {
  return (activeReplayExternalCashFlows ?? []).map(row => ({
    id: String(row.id),
    scheduledDate: row.date,
    appliedDate: row.date,
    amountEur: row.amountEur,
    kind: row.amountEur > 0 ? 'CONTRIBUTION' : 'WITHDRAWAL',
    label: String(row.label)
  }));
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

export function flowAdjustedEquityValue(
  equityEur: number,
  flows: readonly DynamicReplayAppliedCashFlow[],
  date: string
): number {
  const netExternalToDate = flows
    .filter(flow => flow.appliedDate <= date)
    .reduce((sum, flow) => sum + flow.amountEur, 0);
  return equityEur - netExternalToDate;
}

export function flowAdjustedMaxDrawdownPct(input: {
  equityPath: readonly { date: string; equityEur: number }[];
  appliedFlows: readonly DynamicReplayAppliedCashFlow[];
}): number {
  let peak = 0;
  let maximum = 0;
  for (const point of input.equityPath) {
    const adjusted = flowAdjustedEquityValue(point.equityEur, input.appliedFlows, point.date);
    if (!(adjusted > 0)) continue;
    peak = Math.max(peak, adjusted);
    if (peak > 0) maximum = Math.max(maximum, (peak - adjusted) / peak * 100);
  }
  return maximum;
}
