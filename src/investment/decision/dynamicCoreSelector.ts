import { assessAgainstCashBenchmark } from './cashBenchmark';
import { PortfolioDecisionEngine, type PortfolioDecisionResult } from './portfolioDecisionEngine';
import { isStrategicGrowthCoreAssetId } from './portfolioAssetRole';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export const DYNAMIC_CORE_SELECTOR_V1 = 'DYNAMIC_CORE_SELECTOR_V1' as const;

export type DynamicCoreSelectionReason =
  | 'HEALTHY_INCUMBENT_INERTIA'
  | 'INCUMBENT_EVIDENCE_INSUFFICIENT'
  | 'DEGRADED_INCUMBENT_HOLD'
  | 'BEST_HEALTHY_CORE'
  | 'REPLACE_UNHEALTHY_INCUMBENT'
  | 'BROKEN_INCUMBENT_TO_CASH'
  | 'NO_HEALTHY_CORE';

export type DynamicCoreIncumbentState = 'NONE' | 'HEALTHY' | 'DEGRADED' | 'BROKEN' | 'UNKNOWN';

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
  evidenceSufficient: boolean;
  healthy: boolean;
  currentlyHeldEur: number;
}

export interface DynamicCoreSelectionV1 {
  version: typeof DYNAMIC_CORE_SELECTOR_V1;
  selected: ScanCandidate | null;
  selectedAssetId: string | null;
  incumbentAssetId: string | null;
  incumbentHealthy: boolean | null;
  incumbentState: DynamicCoreIncumbentState;
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

function healthActionFor(input: PortfolioEvaluationInput, assetId: string): string | null {
  const map = input.positionHealth ?? {};
  const normalized = assetId.toUpperCase();
  const direct = map[assetId] ?? map[normalized];
  if (direct?.action) return direct.action;
  for (const [key, value] of Object.entries(map)) {
    if (key.toUpperCase() === normalized && value?.action) return value.action;
  }
  return null;
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
  const evidenceSufficient = assessment != null && rawScore != null && cash.passes != null;
  const compositeScore = rawScore == null || consensusScore == null
    ? null
    : rawScore + consensusScore * 5 + clamp(excess ?? 0, -20, 20) * 0.5;
  const healthy = evidenceSufficient
    && candidate.status === 'ACCEPTED'
    && compositeScore != null
    && !structuralDowntrend
    && consensusScore != null
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
    evidenceSufficient,
    healthy,
    currentlyHeldEur: heldEur
  };
}

/**
 * Causal selector for the structural global core.
 *
 * The incumbent has three economically different states:
 * - HEALTHY: eligible for new money and retained by inertia;
 * - DEGRADED: not eligible for fresh core money, but not sold merely because it
 *   temporarily lags cash or another broad index;
 * - BROKEN: position-health has independently reached EXIT. Only then may the
 *   structural core be replaced, or moved to cash if no healthy global core exists.
 *
 * Missing evidence is UNKNOWN and can never authorize a sale. New core selection
 * and replacement use only data available on the current decision date; no fixed
 * Vanguard/EUNL product priority and no future return enter this function.
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

  const candidateScores = [...scoreById.values()].sort(
    (a, b) => (b.compositeScore ?? -Infinity) - (a.compositeScore ?? -Infinity) || a.assetId.localeCompare(b.assetId)
  );
  const incumbentEntries = [...heldValues.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const incumbentAssetId = incumbentEntries[0]?.[0] ?? null;
  const incumbentScore = incumbentAssetId ? scoreById.get(incumbentAssetId) ?? null : null;

  const healthyAlternatives = candidates
    .map(candidate => ({ candidate, score: scoreById.get(candidate.asset.assetId.toUpperCase())! }))
    .filter(row => row.score.healthy)
    .sort((a, b) => (b.score.compositeScore ?? -Infinity) - (a.score.compositeScore ?? -Infinity)
      || (b.score.consensusScore ?? -Infinity) - (a.score.consensusScore ?? -Infinity)
      || a.candidate.asset.assetId.localeCompare(b.candidate.asset.assetId));
  const best = healthyAlternatives[0]?.candidate ?? null;

  if (!incumbentAssetId) {
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected: best,
      selectedAssetId: best?.asset.assetId ?? null,
      incumbentAssetId: null,
      incumbentHealthy: null,
      incumbentState: 'NONE',
      reason: best ? 'BEST_HEALTHY_CORE' : 'NO_HEALTHY_CORE',
      candidateScores
    };
  }

  if (!incumbentScore || !incumbentScore.evidenceSufficient) {
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected: null,
      selectedAssetId: null,
      incumbentAssetId,
      incumbentHealthy: null,
      incumbentState: 'UNKNOWN',
      reason: 'INCUMBENT_EVIDENCE_INSUFFICIENT',
      candidateScores
    };
  }

  if (incumbentScore.healthy) {
    const selected = candidates.find(candidate => candidate.asset.assetId.toUpperCase() === incumbentAssetId) ?? null;
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected,
      selectedAssetId: selected?.asset.assetId ?? null,
      incumbentAssetId,
      incumbentHealthy: true,
      incumbentState: 'HEALTHY',
      reason: 'HEALTHY_INCUMBENT_INERTIA',
      candidateScores
    };
  }

  // A core that merely fails the new-money/cash gate is degraded, not broken.
  // This explicitly prevents a broad-index switch caused by one weak period.
  const broken = healthActionFor(input, incumbentAssetId) === 'EXIT';
  if (!broken) {
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected: null,
      selectedAssetId: null,
      incumbentAssetId,
      incumbentHealthy: false,
      incumbentState: 'DEGRADED',
      reason: 'DEGRADED_INCUMBENT_HOLD',
      candidateScores
    };
  }

  if (!best) {
    return {
      version: DYNAMIC_CORE_SELECTOR_V1,
      selected: null,
      selectedAssetId: null,
      incumbentAssetId,
      incumbentHealthy: false,
      incumbentState: 'BROKEN',
      reason: 'BROKEN_INCUMBENT_TO_CASH',
      candidateScores
    };
  }

  return {
    version: DYNAMIC_CORE_SELECTOR_V1,
    selected: best,
    selectedAssetId: best.asset.assetId,
    incumbentAssetId,
    incumbentHealthy: false,
    incumbentState: 'BROKEN',
    reason: 'REPLACE_UNHEALTHY_INCUMBENT',
    candidateScores
  };
}
