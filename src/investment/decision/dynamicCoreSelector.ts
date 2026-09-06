import { assessAgainstCashBenchmark } from './cashBenchmark';
import { PortfolioDecisionEngine, type PortfolioDecisionResult } from './portfolioDecisionEngine';
import { isStrategicGrowthCoreAssetId } from './portfolioAssetRole';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export const DYNAMIC_CORE_SELECTOR_V1 = 'DYNAMIC_CORE_SELECTOR_V1' as const;

export type DynamicCoreSelectionReason =
  | 'HEALTHY_INCUMBENT_INERTIA'
  | 'BEST_HEALTHY_CORE'
  | 'REPLACE_UNHEALTHY_INCUMBENT'
  | 'NO_HEALTHY_CORE';

type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];
type ScanCandidate = PortfolioEvaluationInput['scan']['candidates'][number];

export interface DynamicCoreCandidateScore {
  assetId: string;
  ticker: string;
  compositeScore: number | null;
  rawScore: number | null;
  consensusScore: number | null;
  favorableVotes: number | null;
  excessVsCashPctPoints: number | null;
  structuralDowntrend: boolean;
  cashPasses: boolean;
  healthy: boolean;
  currentlyHeldEur: number;
}

export interface DynamicCoreSelectionV1 {
  version: typeof DYNAMIC_CORE_SELECTOR_V1;
  selected: ScanCandidate | null;
  selectedAssetId: string | null;
  incumbentAssetId: string | null;
  incumbentHealthy: boolean | null;
  reason: DynamicCoreSelectionReason;
  candidateScores: DynamicCoreCandidateScore[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function currentCoreValues(result: PortfolioDecisionResult): Map<string, number> {
  const values = new Map<string, number>();
  for (const position of result.existingPositions) {
    if (!isStrategicGrowthCoreAssetId(position.assetId)) continue;
    const assetId = position.assetId?.toUpperCase();
    if (!assetId) continue;
    values.set(assetId, (values.get(assetId) ?? 0) + Math.max(0, position.currentValueEur ?? 0));
  }
  return values;
}

function scoreCandidate(
  input: PortfolioEvaluationInput,
  candidate: ScanCandidate,
  heldEur: number
): DynamicCoreCandidateScore {
  const assessment = StrategyConsensusEngine.assess(input.scan, candidate.asset.assetId, input.cashBenchmarkAnnualPct);
  const cash = assessAgainstCashBenchmark({
    momentum120Pct: candidate.momentum120Pct,
    benchmarkAnnualPct: input.cashBenchmarkAnnualPct ?? 0,
    notionalEur: 0,
    estimatedFeeEur: 0
  });
  const rawScore = candidate.score != null && Number.isFinite(candidate.score) ? candidate.score : null;
  const consensusScore = assessment?.consensusScore ?? null;
  const excess = cash.excessVsCashPctPoints != null && Number.isFinite(cash.excessVsCashPctPoints)
    ? cash.excessVsCashPctPoints
    : null;
  const structuralDowntrend = assessment?.structuralDowntrend ?? false;
  const cashPasses = cash.passes === true;
  const compositeScore = rawScore == null || consensusScore == null
    ? null
    : rawScore + consensusScore * 5 + clamp(excess ?? 0, -20, 20) * 0.5;
  const healthy = candidate.status === 'ACCEPTED'
    && compositeScore != null
    && !structuralDowntrend
    && consensusScore >= 0
    && cashPasses;

  return {
    assetId: candidate.asset.assetId,
    ticker: candidate.asset.ticker,
    compositeScore,
    rawScore,
    consensusScore,
    favorableVotes: assessment?.favorableVotes ?? null,
    excessVsCashPctPoints: excess,
    structuralDowntrend,
    cashPasses,
    healthy,
    currentlyHeldEur: heldEur
  };
}

/**
 * Causal selector for the structural global core.
 *
 * Rules:
 * - only broad products explicitly classified as STRATEGIC_GROWTH_CORE compete;
 * - no hard-coded product priority decides the winner;
 * - a currently-held healthy core is retained (inertia, no performance chasing);
 * - only when no held core remains healthy is the best healthy alternative chosen;
 * - if no healthy core exists, returns null so new money is not forced into a
 *   known-unhealthy/default product.
 *
 * The selector reads only the scan/portfolio state supplied for the current
 * decision date. It does not inspect future returns or replay outcomes.
 */
export function selectDynamicCoreV1(
  input: PortfolioEvaluationInput,
  result: PortfolioDecisionResult
): DynamicCoreSelectionV1 {
  const heldValues = currentCoreValues(result);
  const candidates = input.scan.candidates
    .filter(candidate => candidate.status === 'ACCEPTED' && isStrategicGrowthCoreAssetId(candidate.asset.assetId));

  const scoreById = new Map<string, DynamicCoreCandidateScore>();
  for (const candidate of candidates) {
    const id = candidate.asset.assetId.toUpperCase();
    scoreById.set(id, scoreCandidate(input, candidate, heldValues.get(id) ?? 0));
  }

  const incumbentEntries = [...heldValues.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const incumbentAssetId = incumbentEntries[0]?.[0] ?? null;
  const incumbentScore = incumbentAssetId ? scoreById.get(incumbentAssetId) ?? null : null;

  // Inertia is deliberate: a healthy core is not replaced simply because a
  // competitor has recently scored a little better.
  const healthyHeld = incumbentEntries
    .map(([assetId]) => ({ assetId, score: scoreById.get(assetId) ?? null }))
    .filter((row): row is { assetId: string; score: DynamicCoreCandidateScore } => row.score?.healthy === true);

  if (healthyHeld.length) {
    const selectedId = healthyHeld[0].assetId;
    const selected = candidates.find(candidate => candidate.asset.assetId.toUpperCase() === selectedId) ?? null;
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected,
      selectedAssetId: selected?.asset.assetId ?? null,
      incumbentAssetId,
      incumbentHealthy: incumbentScore?.healthy ?? null,
      reason: 'HEALTHY_INCUMBENT_INERTIA',
      candidateScores: [...scoreById.values()].sort((a, b) => (b.compositeScore ?? -Infinity) - (a.compositeScore ?? -Infinity) || a.assetId.localeCompare(b.assetId))
    };
  }

  const healthyAlternatives = candidates
    .map(candidate => ({ candidate, score: scoreById.get(candidate.asset.assetId.toUpperCase())! }))
    .filter(row => row.score.healthy)
    .sort((a, b) => (b.score.compositeScore ?? -Infinity) - (a.score.compositeScore ?? -Infinity)
      || (b.score.consensusScore ?? -Infinity) - (a.score.consensusScore ?? -Infinity)
      || a.candidate.asset.assetId.localeCompare(b.candidate.asset.assetId));

  const best = healthyAlternatives[0]?.candidate ?? null;
  const candidateScores = [...scoreById.values()].sort((a, b) => (b.compositeScore ?? -Infinity) - (a.compositeScore ?? -Infinity) || a.assetId.localeCompare(b.assetId));

  if (!best) {
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected: null,
      selectedAssetId: null,
      incumbentAssetId,
      incumbentHealthy: incumbentScore?.healthy ?? (incumbentAssetId ? false : null),
      reason: 'NO_HEALTHY_CORE',
      candidateScores
    };
  }

  return {
    version: DYNAMIC_CORE_SELECTOR_V1,
    selected: best,
    selectedAssetId: best.asset.assetId,
    incumbentAssetId,
    incumbentHealthy: incumbentScore?.healthy ?? (incumbentAssetId ? false : null),
    reason: incumbentAssetId ? 'REPLACE_UNHEALTHY_INCUMBENT' : 'BEST_HEALTHY_CORE',
    candidateScores
  };
}
