import type { PortfolioExecutionLine } from './portfolioExecutionPlan';

const STORAGE_KEY = 'custodia_portfolio_execution_history_v1';
const CASH_FLOW_STORAGE_KEY = 'custodia_portfolio_cash_flow_history_v1';

export interface PortfolioExecutionHistoryEntry {
  id: string;
  appliedAt: string;
  action: PortfolioExecutionLine['action'];
  sourceId?: string;
  sourceLabel?: string;
  sourceIsin?: string;
  targetAssetId?: string;
  targetTicker?: string;
  targetName?: string;
  targetIsin?: string;
  category: string;
  amountEur: number | null;
  shares: number | null;
  feeEur: number;
}

export type PortfolioCashFlowKind = 'BASELINE' | 'CONTRIBUTION' | 'WITHDRAWAL';

export interface PortfolioCashFlowHistoryEntry {
  id: string;
  date: string;
  amountEur: number;
  kind: PortfolioCashFlowKind;
  label: string;
}

function normalize(entry: any): PortfolioExecutionHistoryEntry | null {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.appliedAt !== 'string') return null;
  return {
    id: entry.id,
    appliedAt: entry.appliedAt,
    action: entry.action,
    sourceId: entry.sourceId,
    sourceLabel: entry.sourceLabel,
    sourceIsin: entry.sourceIsin,
    targetAssetId: entry.targetAssetId,
    targetTicker: entry.targetTicker,
    targetName: entry.targetName,
    targetIsin: entry.targetIsin,
    category: String(entry.category ?? 'UNKNOWN'),
    amountEur: entry.amountEur == null ? null : Math.max(0, Number(entry.amountEur) || 0),
    shares: entry.shares == null ? null : Number(entry.shares),
    feeEur: Math.max(0, Number(entry.feeEur) || 0)
  };
}

function normalizeCashFlow(entry: any): PortfolioCashFlowHistoryEntry | null {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date ?? ''))) return null;
  const amountEur = Number(entry.amountEur);
  if (!Number.isFinite(amountEur) || Math.abs(amountEur) < 0.005) return null;
  const kind: PortfolioCashFlowKind = entry.kind === 'BASELINE' || entry.kind === 'WITHDRAWAL' ? entry.kind : 'CONTRIBUTION';
  return {
    id: entry.id,
    date: String(entry.date),
    amountEur,
    kind,
    label: String(entry.label ?? (amountEur >= 0 ? 'Aportación de liquidez' : 'Retirada de liquidez'))
  };
}

export class PortfolioExecutionHistoryService {
  static load(): PortfolioExecutionHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalize).filter(Boolean).sort((a, b) => a!.appliedAt.localeCompare(b!.appliedAt)) as PortfolioExecutionHistoryEntry[];
    } catch { return []; }
  }

  static record(line: PortfolioExecutionLine, appliedAt: string): PortfolioExecutionHistoryEntry {
    const entry: PortfolioExecutionHistoryEntry = {
      id: `${line.id}_${appliedAt}`,
      appliedAt,
      action: line.action,
      sourceId: line.sourceId,
      sourceLabel: line.sourceLabel,
      sourceIsin: line.sourceIsin,
      targetAssetId: line.targetAssetId,
      targetTicker: line.targetTicker,
      targetName: line.targetName,
      targetIsin: line.targetIsin,
      category: line.category,
      amountEur: line.amountEur == null ? null : Math.max(0, Number(line.amountEur) || 0),
      shares: line.shares == null ? null : Number(line.shares),
      feeEur: Math.max(0, Number(line.estimatedFeeEur ?? 0))
    };
    if (typeof window !== 'undefined') {
      const rows = this.load();
      if (!rows.some(row => row.id === entry.id)) window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...rows, entry]));
    }
    return entry;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}

export class PortfolioCashFlowHistoryService {
  static load(): PortfolioCashFlowHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CASH_FLOW_STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeCashFlow)
        .filter(Boolean)
        .sort((a, b) => a!.date.localeCompare(b!.date) || a!.id.localeCompare(b!.id)) as PortfolioCashFlowHistoryEntry[];
    } catch { return []; }
  }

  static ensureBaseline(amountEur: number, date: string, label = 'Aportación inicial a la cuenta operativa'): PortfolioCashFlowHistoryEntry | null {
    if (typeof window === 'undefined' || !(amountEur > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const rows = this.load();
    const existing = rows.find(row => row.kind === 'BASELINE');
    if (existing) return existing;
    const entry: PortfolioCashFlowHistoryEntry = { id: `baseline_${date}`, date, amountEur, kind: 'BASELINE', label };
    window.localStorage.setItem(CASH_FLOW_STORAGE_KEY, JSON.stringify([...rows, entry]));
    return entry;
  }

  static record(amountEur: number, date: string, label?: string): PortfolioCashFlowHistoryEntry | null {
    if (typeof window === 'undefined' || !Number.isFinite(amountEur) || Math.abs(amountEur) < 0.005 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const kind: PortfolioCashFlowKind = amountEur >= 0 ? 'CONTRIBUTION' : 'WITHDRAWAL';
    const entry: PortfolioCashFlowHistoryEntry = {
      id: `cash_${date}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date,
      amountEur,
      kind,
      label: label ?? (amountEur >= 0 ? `Aportación a cuenta: +${amountEur.toFixed(2)} €` : `Retirada de cuenta: ${amountEur.toFixed(2)} €`)
    };
    const rows = this.load();
    window.localStorage.setItem(CASH_FLOW_STORAGE_KEY, JSON.stringify([...rows, entry]));
    return entry;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(CASH_FLOW_STORAGE_KEY);
  }
}