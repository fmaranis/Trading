import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import {
  assessAssetSelectionQuality,
  assessSlopeSelectionQuality,
  type AssetSelectionQualityMetrics
} from './assetSelectionQuality';
import { assessAgainstCashBenchmark, resolveReplayAwareCashBenchmarkAnnualPct } from './cashBenchmark';
import { EntryTimingEngine, type EntryTimingSetup, type EntryTimingState } from './entryTiming';
import { isCurrentListedEquityAsset } from './openMarketDiscoveryV1';
import { StrategyConsensusEngine } from './strategyConsensusEngine';
import { rankEligibleCandidatesWithTimesFmRelativeV1 } from './timesFmRelativeRankV1';

export type PortfolioCandidateGateStatus = 'ELIGIBLE' | 'REJECTED';
export type CandidateSelectionPolicy = 'LEGACY' | 'QUALITY_V1' | 'SLOPE_V1' | 'TIMESFM_RELATIVE_RANK_V1';

export interface TimesFmRelativeRankEvidence {
  assetId: string;
  predictedRelativeReturn20Pct: number;
  predictedRelativeReturn60Pct: number;
}

export interface CandidateSelectionContext {
  timesFmRelativeRankEvidence?: TimesFmRelativeRankEvidence[];
}

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
  legacyRankingScore?: number | null;
  timesFmRelativeRankMean?: number | null;
  timesFmRelativeRankPosition?: number | null;
  timesFmPredictedRelativeReturn20Pct?: number | null;
  timesFmPredictedRelativeReturn60Pct?: number | null;
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
  legacyRankingScore?: number | null;
  timesFmRelativeRankMean?: number | null;
  timesFmRelativeRankPosition?: number | null;
  timesFmPredictedRelativeReturn20Pct?: number | null;
  timesFmPredictedRelativeReturn60Pct?: number | null;
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
    suggestedInitialFraction: input.suggestedInitialFraction ?? null,
    legacyRankingScore: input.legacyRankingScore ?? null,
    timesFmRelativeRankMean: input.timesFmRelativeRankMean ?? null,
    timesFmRelativeRankPosition: input.timesFmRelativeRankPosition ?? null,
    timesFmPredictedRelativeReturn20Pct: input.timesFmPredictedRelativeReturn20Pct ?? null,
    timesFmPredictedRelativeReturn60Pct: input.timesFmPredictedRelativeReturn60Pct ?? null
  };
}

function diversificationBucket(candidate: AssetScanCandidate, dynamicCurrentMarket: boolean): string {
  // The historical/research selector keeps its original category semantics.
  // In current/live mode an individual listed company must not consume the same
  // two-slot category quota as every other EUR company merely because Lookup has
  // only the broad EUROPE_EQUITY classification. Monetary concentration remains
  // controlled later by PortfolioDecisionEngine category/asset caps and position
  // limits; this gate only prevents a metadata artefact from suppressing valid
  // competitors before the allocator sees them.
  if (dynamicCurrentMarket && isCurrentListedEquityAsset(candidate.asset)) {
    return `EQUITY:${candidate.asset.assetId}`;
  }
  return `CATEGORY:${candidate.asset.category}`;
}

/**
 * New-money candidates must earn the right to enter the allocator.
 *
 * In current/live product mode the AssetUniverseScanner first forms the dynamic
 * market shortlist. This gate may only consider accepted candidates inside that
 * recorded shortlist; accepted pool members outside it are explicitly audited
 * as OUTSIDE_DYNAMIC_MARKET_SHORTLIST. Historical/research scans without the
 * dynamic-shortlist marker preserve their previous behavior.
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
    selectionPolicy: CandidateSelectionPolicy = 'LEGACY',
    selectionContext: CandidateSelectionContext = {}
  ): PortfolioCandidateGateResult {
    const entries: PortfolioCandidateGateEntry[] = [];
    const eligible: Array<{ candidate: AssetScanCandidate; rankingScore: number; legacyRankingScore: number }> = [];
    const asOfDate = scan.candidates.map(candidate => candidate.asOfDate).filter(Boolean).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
    const effectiveCashBenchmarkAnnualPct = resolveReplayAwareCashBenchmarkAnnualPct(cashBenchmarkAnnualPct, asOfDate);
    const dynamicShortlistIds = scan.dynamicMarketShortlist?.applied
      ? new Set(scan.dynamicMarketShortlist.shortlistAssetIds)
      : null;

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
      if (dynamicShortlistIds && !dynamicShortlistIds.has(candidate.asset.assetId)) {
        entries.push(baseEntry({ candidate, status: 'REJECTED', reason: 'OUTSIDE_DYNAMIC_MARKET_SHORTLIST', ...qualityFields }));
        continue;
      }

      const cash = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: effectiveCashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
      const consensus = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, effectiveCashBenchmarkAnnualPct);

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

      const legacyRankingScore = candidateRankingScore(candidate, consensus.consensusScore, cash.excessVsCashPctPoints ?? 0, timing.score, quality, slopeQualityScore, 'LEGACY');
      const rankingScore = candidateRankingScore(candidate, consensus.consensusScore, cash.excessVsCashPctPoints ?? 0, timing.score, quality, slopeQualityScore, selectionPolicy);
      eligible.push({ candidate, rankingScore, legacyRankingScore });
      const reason = selectionPolicy === 'QUALITY_V1'
        ? 'BEATS_CASH_CONSENSUS_TIMING_AND_QUALITY_RANKED'
        : selectionPolicy === 'SLOPE_V1'
          ? 'BEATS_CASH_CONSENSUS_TIMING_AND_SLOPE_RANKED'
          : selectionPolicy === 'TIMESFM_RELATIVE_RANK_V1'
            ? 'BEATS_CASH_CONSENSUS_TIMING_AND_TIMESFM_RELATIVE_RANKED'
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
        legacyRankingScore,
        timingState: timing.state,
        timingSetup: timing.setup,
        timingScore: timing.score,
        suggestedInitialFraction: timing.suggestedInitialFraction,
        ...qualityFields,
        ...slopeFields
      }));
    }

    let orderedEligible = [...eligible].sort((a, b) => b.rankingScore - a.rankingScore);
    if (selectionPolicy === 'TIMESFM_RELATIVE_RANK_V1') {
      const ranked = rankEligibleCandidatesWithTimesFmRelativeV1(
        eligible.map(row => ({
          ...row,
          assetId: row.candidate.asset.assetId
        })),
        selectionContext.timesFmRelativeRankEvidence ?? []
      );
      const ordinalScoreByAsset = new Map(ranked.map((row, index) => [row.assetId, ranked.length - index] as const));
      const metaByAsset = new Map(ranked.map(row => [row.assetId, row] as const));
      orderedEligible = ranked.map(row => ({
        candidate: row.candidate,
        legacyRankingScore: row.legacyRankingScore,
        rankingScore: ordinalScoreByAsset.get(row.assetId) ?? 0
      }));
      for (const entry of entries) {
        if (entry.status !== 'ELIGIBLE') continue;
        const meta = metaByAsset.get(entry.assetId);
        if (!meta) continue;
        entry.rankingScore = ordinalScoreByAsset.get(entry.assetId) ?? null;
        entry.legacyRankingScore = meta.legacyRankingScore;
        entry.timesFmRelativeRankMean = meta.timesFmRelativeRankMean;
        entry.timesFmRelativeRankPosition = meta.timesFmRelativeRankPosition;
        entry.timesFmPredictedRelativeReturn20Pct = meta.timesFmPredictedRelativeReturn20Pct;
        entry.timesFmPredictedRelativeReturn60Pct = meta.timesFmPredictedRelativeReturn60Pct;
      }
    }
    const selected: AssetScanCandidate[] = [];
    const perDiversificationBucket = new Map<string, number>();
    const dynamicCurrentMarket = Boolean(scan.dynamicMarketShortlist?.applied);
    for (const row of orderedEligible) {
      if (selected.length >= maxSelected) break;
      const bucket = diversificationBucket(row.candidate, dynamicCurrentMarket);
      const used = perDiversificationBucket.get(bucket) ?? 0;
      if (used >= 2) continue;
      selected.push(row.candidate);
      perDiversificationBucket.set(bucket, used + 1);
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
