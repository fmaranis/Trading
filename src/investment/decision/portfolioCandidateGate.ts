import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export type PortfolioCandidateGateStatus = 'ELIGIBLE' | 'REJECTED';

export interface PortfolioCandidateGateEntry {
  assetId: string;
  ticker: string;
  status: PortfolioCandidateGateStatus;
  reason: string;
  consensusScore: number | null;
  favorableVotes: number | null;
  unfavorableVotes: number | null;
  annualizedProxyPct: number | null;
  excessVsCashPctPoints: number | null;
  rankingScore: number | null;
}

export interface PortfolioCandidateGateResult {
  scan: AssetUniverseScanResult;
  entries: PortfolioCandidateGateEntry[];
  eligibleCount: number;
  rejectedCount: number;
  selectedCount: number;
}

function candidateRankingScore(candidate: AssetScanCandidate, consensusScore: number, excessVsCash: number): number {
  return (candidate.score ?? -999) + consensusScore * 5 + Math.max(-20, Math.min(20, excessVsCash)) * 0.5;
}

function buildDataset(scan: AssetUniverseScanResult, selected: AssetScanCandidate[]) {
  const ids = new Set(selected.map(c => c.asset.assetId));
  return {
    timeframe: scan.acceptedDataset.timeframe,
    assets: scan.acceptedDataset.assets.filter(asset => ids.has(asset.assetId))
  };
}

/**
 * New-money candidates must earn the right to enter the allocator.
 * Risk parity / inverse volatility / relative momentum only distribute capital
 * after the candidate has passed BOTH the explicit cash hurdle and the same
 * multi-signal consensus used elsewhere in the app.
 */
export class PortfolioCandidateGate {
  static apply(scan: AssetUniverseScanResult, cashBenchmarkAnnualPct: number, maxSelected = 12): PortfolioCandidateGateResult {
    const entries: PortfolioCandidateGateEntry[] = [];
    const eligible: Array<{ candidate: AssetScanCandidate; rankingScore: number }> = [];

    for (const candidate of scan.candidates) {
      if (candidate.status !== 'ACCEPTED') {
        entries.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, status: 'REJECTED', reason: candidate.reason ?? 'DATA_REJECTED', consensusScore: null, favorableVotes: null, unfavorableVotes: null, annualizedProxyPct: null, excessVsCashPctPoints: null, rankingScore: null });
        continue;
      }

      const cash = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
      const consensus = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);

      if (!consensus) {
        entries.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, status: 'REJECTED', reason: 'CONSENSUS_UNAVAILABLE', consensusScore: null, favorableVotes: null, unfavorableVotes: null, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, rankingScore: null });
        continue;
      }
      if (cash.passes !== true) {
        entries.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, status: 'REJECTED', reason: cash.passes === false ? 'DOES_NOT_BEAT_CASH' : 'CASH_COMPARISON_UNAVAILABLE', consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, rankingScore: null });
        continue;
      }
      if (consensus.newMoneyAction !== 'BUY' || consensus.structuralDowntrend) {
        entries.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, status: 'REJECTED', reason: consensus.structuralDowntrend ? 'STRUCTURAL_DOWNTREND' : `CONSENSUS_${consensus.newMoneyAction}`, consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, rankingScore: null });
        continue;
      }

      const rankingScore = candidateRankingScore(candidate, consensus.consensusScore, cash.excessVsCashPctPoints ?? 0);
      eligible.push({ candidate, rankingScore });
      entries.push({ assetId: candidate.asset.assetId, ticker: candidate.asset.ticker, status: 'ELIGIBLE', reason: 'BEATS_CASH_AND_CONSENSUS_BUY', consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, rankingScore });
    }

    eligible.sort((a, b) => b.rankingScore - a.rankingScore);
    const selected: AssetScanCandidate[] = [];
    const perCategory = new Map<string, number>();
    for (const row of eligible) {
      if (selected.length >= maxSelected) break;
      const category = row.candidate.asset.category;
      const used = perCategory.get(category) ?? 0;
      if (used >= 2) continue;
      selected.push(row.candidate);
      perCategory.set(category, used + 1);
    }

    const dataset = buildDataset(scan, selected);
    const gatedScan: AssetUniverseScanResult = {
      ...scan,
      selected,
      dataset
    };

    return {
      scan: gatedScan,
      entries,
      eligibleCount: eligible.length,
      rejectedCount: entries.filter(x => x.status === 'REJECTED').length,
      selectedCount: selected.length
    };
  }
}
