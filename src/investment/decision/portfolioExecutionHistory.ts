import type { PortfolioExecutionLine } from './portfolioExecutionPlan';

const STORAGE_KEY = 'custodia_portfolio_execution_history_v1';

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
