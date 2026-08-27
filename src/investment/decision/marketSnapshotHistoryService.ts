import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { InvestmentDecisionResult } from './types';
import type { CrossProviderEvidenceQuality } from './evidenceQuality';
import type { OpportunityAlert } from './opportunityAlertEngine';

const STORAGE_KEY = 'custodia_market_snapshot_history_v1';
const MAX_ENTRIES = 180;

export interface MarketSnapshotEntry {
  id: string;
  savedAt: string;
  asOfDate: string;
  marketRegime: string;
  shortlist: Array<{ ticker: string; category: string; score: number | null; momentum120Pct: number | null; annualizedVolatilityPct: number | null; maxDrawdownPct: number | null }>;
  allocation: Array<{ ticker: string; weight: number; amountEur: number }>;
  cashWeight: number;
  evidenceState: string;
  evidenceCoveragePct: number | null;
  evidenceDivergent: number | null;
  alerts: OpportunityAlert[];
  portfolioDatasetFingerprint: string;
}

export class MarketSnapshotHistoryService {
  static load(): MarketSnapshotEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  static saveDaily(scan: AssetUniverseScanResult, decision: InvestmentDecisionResult, evidence: CrossProviderEvidenceQuality | null, alerts: OpportunityAlert[]): MarketSnapshotEntry[] {
    if (typeof window === 'undefined') return [];
    const entry: MarketSnapshotEntry = {
      id: `market_${decision.asOfDate}_${decision.riskProfile}_${decision.horizonYears}`,
      savedAt: new Date().toISOString(),
      asOfDate: decision.asOfDate,
      marketRegime: decision.marketRegime,
      shortlist: scan.selected.map(c => ({
        ticker: c.asset.ticker,
        category: c.asset.category,
        score: c.score,
        momentum120Pct: c.momentum120Pct,
        annualizedVolatilityPct: c.annualizedVolatilityPct,
        maxDrawdownPct: c.maxDrawdownPct
      })),
      allocation: decision.assets.filter(a => a.weight > 0).map(a => ({ ticker: a.ticker, weight: a.weight, amountEur: a.amountEur })),
      cashWeight: decision.cashWeight,
      evidenceState: evidence?.state ?? 'PRIMARY_ONLY',
      evidenceCoveragePct: evidence?.coveragePct ?? null,
      evidenceDivergent: evidence?.divergent ?? null,
      alerts,
      portfolioDatasetFingerprint: decision.portfolioDatasetFingerprint
    };
    const next = [entry, ...this.load().filter(x => x.id !== entry.id)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  static latestBefore(asOfDate: string): MarketSnapshotEntry | null {
    return this.load().find(x => x.asOfDate < asOfDate) ?? null;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}
