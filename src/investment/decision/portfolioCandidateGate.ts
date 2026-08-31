import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import { EntryTimingEngine, type EntryTimingSetup, type EntryTimingState } from './entryTiming';
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
  timingState: EntryTimingState | null;
  timingSetup: EntryTimingSetup | null;
  timingScore: number | null;
  suggestedInitialFraction: number | null;
}

export interface PortfolioCandidateGateResult {
  scan: AssetUniverseScanResult;
  entries: PortfolioCandidateGateEntry[];
  eligibleCount: number;
  rejectedCount: number;
  selectedCount: number;
}

function candidateRankingScore(candidate: AssetScanCandidate, consensusScore: number, excessVsCash: number, timingScore: number): number {
  return (candidate.score ?? -999) + consensusScore * 5 + Math.max(-20, Math.min(20, excessVsCash)) * 0.5 + timingScore * 0.1;
}

function buildDataset(scan: AssetUniverseScanResult, selected: AssetScanCandidate[]) {
  const ids = new Set(selected.map(c => c.asset.assetId));
  return {
    timeframe: scan.acceptedDataset.timeframe,
    assets: scan.acceptedDataset.assets.filter(asset => ids.has(asset.assetId))
  };
}

function baseEntry(input: {
  candidate: AssetScanCandidate;
  status: PortfolioCandidateGateStatus;
  reason: string;
  consensusScore?: number | null;
  favorableVotes?: number | null;
  unfavorableVotes?: number | null;
  annualizedProxyPct?: number | null;
  excessVsCashPctPoints?: number | null;
  rankingScore?: number | null;
  timingState?: EntryTimingState | null;
  timingSetup?: EntryTimingSetup | null;
  timingScore?: number | null;
  suggestedInitialFraction?: number | null;
}): PortfolioCandidateGateEntry {
  return {
    assetId: input.candidate.asset.assetId,
    ticker: input.candidate.asset.ticker,
    status: input.status,
    reason: input.reason,
    consensusScore: input.consensusScore ?? null,
    favorableVotes: input.favorableVotes ?? null,
    unfavorableVotes: input.unfavorableVotes ?? null,
    annualizedProxyPct: input.annualizedProxyPct ?? null,
    excessVsCashPctPoints: input.excessVsCashPctPoints ?? null,
    rankingScore: input.rankingScore ?? null,
    timingState: input.timingState ?? null,
    timingSetup: input.timingSetup ?? null,
    timingScore: input.timingScore ?? null,
    suggestedInitialFraction: input.suggestedInitialFraction ?? null
  };
}

/**
 * New-money candidates must earn the right to enter the allocator.
 *
 * Selection quality and timing are separate checks in the same gate:
 * REAL data + cash hurdle + BUY consensus decide whether an asset deserves
 * consideration; EntryTimingEngine decides whether TODAY is an acceptable
 * moment to deploy fresh cash. A strategic target therefore never reaches the
 * allocator while timing says WAIT.
 */
export class PortfolioCandidateGate {
  static apply(scan: AssetUniverseScanResult, cashBenchmarkAnnualPct: number, maxSelected = 12): PortfolioCandidateGateResult {
    const entries: PortfolioCandidateGateEntry[] = [];
    const eligible: Array<{ candidate: AssetScanCandidate; rankingScore: number }> = [];

    for (const candidate of scan.candidates) {
      if (candidate.status !== 'ACCEPTED') {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: candidate.reason ?? 'DATA_REJECTED' }));
        continue;
      }

      const cash = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
      const consensus = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);

      if (!consensus) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: 'CONSENSUS_UNAVAILABLE', annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints }));
        continue;
      }
      if (cash.passes !== true) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: cash.passes === false ? 'DOES_NOT_BEAT_CASH' : 'CASH_COMPARISON_UNAVAILABLE', consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints }));
        continue;
      }
      if (consensus.newMoneyAction !== 'BUY' || consensus.structuralDowntrend) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: consensus.structuralDowntrend ? 'STRUCTURAL_DOWNTREND' : `CONSENSUS_${consensus.newMoneyAction}`, consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints }));
        continue;
      }

      const timing = EntryTimingEngine.assess(scan, candidate.asset.assetId, consensus);
      if (timing.state === 'WAIT') {
        entries.push(baseEntry({
          candidate,
          status: 'REJECTED',
          reason: 'ENTRY_TIMING_WAIT',
          consensusScore: consensus.consensusScore,
          favorableVotes: consensus.favorableVotes,
          unfavorableVotes: consensus.unfavorableVotes,
          annualizedProxyPct: cash.netAnnualizedProxyPct,
          excessVsCashPctPoints: cash.excessVsCashPctPoints,
          timingState: timing.state,
          timingSetup: timing.setup,
          timingScore: timing.score,
          suggestedInitialFraction: timing.suggestedInitialFraction
        }));
        continue;
      }

      const rankingScore = candidateRankingScore(candidate, consensus.consensusScore, cash.excessVsCashPctPoints ?? 0, timing.score);
      eligible.push({ candidate, rankingScore });
      entries.push(baseEntry({
        candidate,
        status: 'ELIGIBLE',
        reason: 'BEATS_CASH_CONSENSUS_AND_TIMING',
        consensusScore: consensus.consensusScore,
        favorableVotes: consensus.favorableVotes,
        unfavorableVotes: consensus.unfavorableVotes,
        annualizedProxyPct: cash.netAnnualizedProxyPct,
        excessVsCashPctPoints: cash.excessVsCashPctPoints,
        rankingScore,
        timingState: timing.state,
        timingSetup: timing.setup,
        timingScore: timing.score,
        suggestedInitialFraction: timing.suggestedInitialFraction
      }));
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
