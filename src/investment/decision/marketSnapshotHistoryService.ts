import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { InvestmentDecisionResult, InvestorRiskProfile, InvestmentHorizonYears, DecisionHistoryEntry } from './types';
import type { CrossProviderEvidenceQuality } from './evidenceQuality';
import type { OpportunityAlert } from './opportunityAlertEngine';
import { CashBenchmarkService } from './cashBenchmark';
import { PortfolioCandidateGate } from './portfolioCandidateGate';

const STORAGE_KEY = 'custodia_market_snapshot_history_v1';
const MAX_ENTRIES = 180;

export interface MarketSnapshotShortlistEntry {
  ticker: string;
  category: string;
  score: number | null;
  momentum120Pct: number | null;
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
  eligibleForNewMoney?: boolean;
  gateReason?: string;
  consensusScore?: number | null;
  excessVsCashPctPoints?: number | null;
  rankingScore?: number | null;
}

export interface MarketSnapshotEntry {
  id: string;
  savedAt: string;
  asOfDate: string;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  marketRegime: string;
  shortlist: MarketSnapshotShortlistEntry[];
  allocation: Array<{ assetId: string; ticker: string; weight: number; amountEur: number }>;
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
    const gate = PortfolioCandidateGate.apply(scan, CashBenchmarkService.load(), 1000);
    const gateById = new Map(gate.entries.map(entry => [entry.assetId, entry]));
    const shortlist = scan.candidates
      .filter(candidate => candidate.status === 'ACCEPTED')
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
      .slice(0, 40)
      .map(candidate => {
        const gateEntry = gateById.get(candidate.asset.assetId);
        return {
          ticker: candidate.asset.ticker,
          category: candidate.asset.category,
          score: candidate.score,
          momentum120Pct: candidate.momentum120Pct,
          annualizedVolatilityPct: candidate.annualizedVolatilityPct,
          maxDrawdownPct: candidate.maxDrawdownPct,
          eligibleForNewMoney: gateEntry?.status === 'ELIGIBLE',
          gateReason: gateEntry?.reason,
          consensusScore: gateEntry?.consensusScore ?? null,
          excessVsCashPctPoints: gateEntry?.excessVsCashPctPoints ?? null,
          rankingScore: gateEntry?.rankingScore ?? null
        };
      });

    const entry: MarketSnapshotEntry = {
      id: `market_${decision.asOfDate}_${decision.riskProfile}_${decision.horizonYears}`,
      savedAt: new Date().toISOString(),
      asOfDate: decision.asOfDate,
      riskProfile: decision.riskProfile,
      horizonYears: decision.horizonYears,
      marketRegime: decision.marketRegime,
      shortlist,
      allocation: decision.assets.filter(a => a.weight > 0).map(a => ({ assetId: a.assetId, ticker: a.ticker, weight: a.weight, amountEur: a.amountEur })),
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

  static latestBefore(asOfDate: string, riskProfile?: InvestorRiskProfile, horizonYears?: InvestmentHorizonYears): MarketSnapshotEntry | null {
    return this.load().find(x =>
      x.asOfDate < asOfDate &&
      (riskProfile == null || x.riskProfile === riskProfile) &&
      (horizonYears == null || x.horizonYears === horizonYears)
    ) ?? null;
  }

  static asDecisionHistoryEntry(snapshot: MarketSnapshotEntry): DecisionHistoryEntry {
    const entry: DecisionHistoryEntry & { shortlist?: MarketSnapshotEntry['shortlist'] } = {
      id: snapshot.id,
      savedAt: snapshot.savedAt,
      asOfDate: snapshot.asOfDate,
      capitalEur: snapshot.allocation.reduce((s, a) => s + a.amountEur, 0),
      riskProfile: snapshot.riskProfile,
      horizonYears: snapshot.horizonYears,
      marketRegime: snapshot.marketRegime as DecisionHistoryEntry['marketRegime'],
      confidence: 'MEDIUM',
      confidenceScore: 0,
      cashWeight: snapshot.cashWeight,
      portfolioDatasetFingerprint: snapshot.portfolioDatasetFingerprint,
      recommendedMethod: 'RISK_PARITY_ERC',
      allocations: snapshot.allocation,
      shortlist: snapshot.shortlist
    };
    return entry;
  }

  static clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  }
}
