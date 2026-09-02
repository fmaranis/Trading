import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import {
  assessAssetSelectionQuality,
  assessSlopeSelectionQuality,
  type AssetSelectionQualityMetrics
} from './assetSelectionQuality';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import { EntryTimingEngine, type EntryTimingSetup, type EntryTimingState } from './entryTiming';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export type PortfolioCandidateGateStatus = 'ELIGIBLE' | 'REJECTED';
export type CandidateSelectionPolicy = 'LEGACY' | 'QUALITY_V1' | 'SLOPE_V1';

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
  reliabilityScore: number | null;
  opportunityScore: number | null;
  slopeQualityScore: number | null;
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
  selectionPolicy: CandidateSelectionPolicy;
}

function qualityForCandidate(scan: AssetUniverseScanResult, candidate: AssetScanCandidate): AssetSelectionQualityMetrics | null {
  const reliability = candidate.reliabilityScore;
  const opportunity = candidate.opportunityScore;
  if (Number.isFinite(reliability) && Number.isFinite(opportunity)) {
    return {
      reliabilityScore: Number(reliability),
      opportunityScore: Number(opportunity),
      currentDrawdownPct: candidate.currentDrawdownPct ?? null,
      positiveRolling60Pct: candidate.positiveRolling60Pct ?? null,
      positiveRolling120Pct: candidate.positiveRolling120Pct ?? null
    };
  }
  const series = scan.acceptedDataset.assets.find(asset => asset.assetId === candidate.asset.assetId);
  if (!series) return null;
  const prices = series.bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
  if (prices.length < 121) return null;
  return assessAssetSelectionQuality({
    prices,
    momentum20Pct: candidate.momentum20Pct,
    momentum60Pct: candidate.momentum60Pct,
    momentum120Pct: candidate.momentum120Pct,
    annualizedVolatilityPct: candidate.annualizedVolatilityPct,
    maxDrawdownPct: candidate.maxDrawdownPct
  });
}

export function candidateQualityAdjustment(reliabilityScore: number | null | undefined, opportunityScore: number | null | undefined): number {
  const reliability = Number.isFinite(reliabilityScore) ? Number(reliabilityScore) : 50;
  const opportunity = Number.isFinite(opportunityScore) ? Number(opportunityScore) : 50;
  return (reliability - 50) * 0.10 + (opportunity - 50) * 0.20;
}

export function candidateSlopeAdjustment(slopeQualityScore: number | null | undefined): number {
  const slope = Number.isFinite(slopeQualityScore) ? Number(slopeQualityScore) : 50;
  return Math.max(-10, Math.min(10, (slope - 50) * 0.20));
}

function candidateRankingScore(
  candidate: AssetScanCandidate,
  consensusScore: number,
  excessVsCash: number,
  timingScore: number,
  quality: AssetSelectionQualityMetrics | null,
  slopeQualityScore: number | null,
  policy: CandidateSelectionPolicy
): number {
  const legacy = (candidate.score ?? -999) + consensusScore * 5 + Math.max(-20, Math.min(20, excessVsCash)) * 0.5 + timingScore * 0.1;
  if (policy === 'QUALITY_V1') return legacy + candidateQualityAdjustment(quality?.reliabilityScore, quality?.opportunityScore);
  if (policy === 'SLOPE_V1') return legacy + candidateSlopeAdjustment(slopeQualityScore);
  return legacy;
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
  reliabilityScore?: number | null;
  opportunityScore?: number | null;
  slopeQualityScore?: number | null;
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
    reliabilityScore: input.reliabilityScore ?? null,
    opportunityScore: input.opportunityScore ?? null,
    slopeQualityScore: input.slopeQualityScore ?? null,
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
 * REAL data + cash hurdle + BUY consensus decide whether an asset deserves
 * consideration; EntryTimingEngine decides whether TODAY is acceptable.
 * Experimental selection policies can only change relative ranking among those
 * already-eligible assets. QUALITY_V1 uses Reliability/Opportunity; SLOPE_V1
 * uses the bounded multi-horizon slope structure already calculated by the
 * consensus engine. Neither policy can bypass a gate or change sizing.
 */
export class PortfolioCandidateGate {
  static apply(
    scan: AssetUniverseScanResult,
    cashBenchmarkAnnualPct: number,
    maxSelected = 12,
    selectionPolicy: CandidateSelectionPolicy = 'LEGACY'
  ): PortfolioCandidateGateResult {
    const entries: PortfolioCandidateGateEntry[] = [];
    const eligible: Array<{ candidate: AssetScanCandidate; rankingScore: number }> = [];

    for (const candidate of scan.candidates) {
      const quality = candidate.status === 'ACCEPTED' ? qualityForCandidate(scan, candidate) : null;
      const qualityFields = {
        reliabilityScore: quality?.reliabilityScore ?? candidate.reliabilityScore ?? null,
        opportunityScore: quality?.opportunityScore ?? candidate.opportunityScore ?? null
      };
      if (candidate.status !== 'ACCEPTED') {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: candidate.reason ?? 'DATA_REJECTED', ...qualityFields }));
        continue;
      }

      const cash = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
      const consensus = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);

      if (!consensus) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: 'CONSENSUS_UNAVAILABLE', annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, ...qualityFields }));
        continue;
      }

      const slopeQualityScore = assessSlopeSelectionQuality(consensus.trendStructure).slopeQualityScore;
      const slopeFields = { slopeQualityScore };

      if (cash.passes !== true) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: cash.passes === false ? 'DOES_NOT_BEAT_CASH' : 'CASH_COMPARISON_UNAVAILABLE', consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, ...qualityFields, ...slopeFields }));
        continue;
      }
      if (consensus.newMoneyAction !== 'BUY' || consensus.structuralDowntrend) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: consensus.structuralDowntrend ? 'STRUCTURAL_DOWNTREND' : `CONSENSUS_${consensus.newMoneyAction}`, consensusScore: consensus.consensusScore, favorableVotes: consensus.favorableVotes, unfavorableVotes: consensus.unfavorableVotes, annualizedProxyPct: cash.netAnnualizedProxyPct, excessVsCashPctPoints: cash.excessVsCashPctPoints, ...qualityFields, ...slopeFields }));
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
          suggestedInitialFraction: timing.suggestedInitialFraction,
          ...qualityFields,
          ...slopeFields
        }));
        continue;
      }

      const rankingScore = candidateRankingScore(candidate, consensus.consensusScore, cash.excessVsCashPctPoints ?? 0, timing.score, quality, slopeQualityScore, selectionPolicy);
      eligible.push({ candidate, rankingScore });
      const reason = selectionPolicy === 'QUALITY_V1'
        ? 'BEATS_CASH_CONSENSUS_TIMING_AND_QUALITY_RANKED'
        : selectionPolicy === 'SLOPE_V1'
          ? 'BEATS_CASH_CONSENSUS_TIMING_AND_SLOPE_RANKED'
          : 'BEATS_CASH_CONSENSUS_AND_TIMING';
      entries.push(baseEntry({
        candidate,
        status: 'ELIGIBLE',
        reason,
        consensusScore: consensus.consensusScore,
        favorableVotes: consensus.favorableVotes,
        unfavorableVotes: consensus.unfavorableVotes,
        annualizedProxyPct: cash.netAnnualizedProxyPct,
        excessVsCashPctPoints: cash.excessVsCashPctPoints,
        rankingScore,
        timingState: timing.state,
        timingSetup: timing.setup,
        timingScore: timing.score,
        suggestedInitialFraction: timing.suggestedInitialFraction,
        ...qualityFields,
        ...slopeFields
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
      selectedCount: selected.length,
      selectionPolicy
    };
  }
}
