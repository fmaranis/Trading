import { assessAgainstCashBenchmark } from './cashBenchmark';
import { CurrentOpportunityAlertEngine, type CurrentOpportunityAlert } from './currentOpportunityAlerts';
import { EntryTimingEngine } from './entryTiming';
import type { ContributionRecommendation, PortfolioDecisionResult, PortfolioPositionDecision } from './portfolioDecisionEngine';
import { isStrategicGrowthCoreAssetId, portfolioAssetRole } from './portfolioAssetRole';
import { StrategyConsensusEngine } from './strategyConsensusEngine';
import {
  CORE_ARCHITECTURE_V1_LIMITS,
  type PortfolioEvaluationInput
} from './portfolioCoreGatePolicy';

export const CORE_ALPHA_V2 = 'CORE_ALPHA_V2' as const;

export const CORE_ALPHA_V2_LIMITS = {
  LOW: { coreFloorShare: 0.74, maxCoreFundedTiltSharePerDecision: 0.02 },
  MEDIUM: { coreFloorShare: 0.70, maxCoreFundedTiltSharePerDecision: 0.03 },
  HIGH: { coreFloorShare: 0.62, maxCoreFundedTiltSharePerDecision: 0.05 }
} as const;

export const CORE_ALPHA_V2_THRESHOLDS = {
  persistenceLookbackSessions: 10,
  minPriorStrongObservations: 5,
  minConsensusScore: 4,
  minFavorableVotes: 4,
  minRelativeSelectionScoreAdvantage: 10,
  minExcessVsCashAdvantagePctPoints: 5,
  minimumMeaningfulTiltEur: 100
} as const;

export interface CoreAlphaV2Counters {
  coreFundedTilts: number;
  blockedNoExceptionalCandidate: number;
  blockedCoreFloor: number;
  blockedExistingFreshNonCoreOrder: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function selectionState(input: PortfolioEvaluationInput, assetId: string) {
  const candidate = input.scan.candidates.find(row => row.asset.assetId === assetId);
  const consensus = StrategyConsensusEngine.assess(input.scan, assetId, input.cashBenchmarkAnnualPct);
  if (!candidate || candidate.status !== 'ACCEPTED' || !consensus) return null;
  const cash = assessAgainstCashBenchmark({
    momentum120Pct: candidate.momentum120Pct,
    benchmarkAnnualPct: input.cashBenchmarkAnnualPct ?? 0,
    notionalEur: 0,
    estimatedFeeEur: 0
  });
  const score = candidate.score == null || !Number.isFinite(candidate.score)
    ? null
    : candidate.score + consensus.consensusScore * 5 + clamp(cash.excessVsCashPctPoints ?? 0, -20, 20) * 0.5;
  return {
    score,
    excessVsCashPctPoints: cash.excessVsCashPctPoints,
    consensusScore: consensus.consensusScore,
    favorableVotes: consensus.favorableVotes,
    structuralDowntrend: consensus.structuralDowntrend
  };
}

function currentNonCoreValue(result: PortfolioDecisionResult): number {
  return result.existingPositions
    .filter(row => !isStrategicGrowthCoreAssetId(row.assetId))
    .reduce((sum, row) => sum + Math.max(0, row.currentValueEur ?? 0), 0);
}

function currentCoreValue(result: PortfolioDecisionResult): number {
  return result.existingPositions
    .filter(row => isStrategicGrowthCoreAssetId(row.assetId))
    .reduce((sum, row) => sum + Math.max(0, row.currentValueEur ?? 0), 0);
}

function plannedNonCoreContribution(input: PortfolioEvaluationInput, result: PortfolioDecisionResult): number {
  return result.contributions.reduce((sum, row) => {
    const candidate = input.scan.candidates.find(candidateRow => candidateRow.asset.assetId === row.assetId);
    const role = portfolioAssetRole({ assetId: row.assetId, category: candidate?.asset.category ?? row.category });
    return role === 'STRATEGIC_GROWTH_CORE' ? sum : sum + Math.max(0, row.amountEur);
  }, 0);
}

function largestCoreSource(result: PortfolioDecisionResult): PortfolioPositionDecision | null {
  return result.existingPositions
    .filter(row => isStrategicGrowthCoreAssetId(row.assetId) && (row.currentValueEur ?? 0) > 0)
    .sort((a, b) => (b.currentValueEur ?? 0) - (a.currentValueEur ?? 0))[0] ?? null;
}

function heldAssetIds(result: PortfolioDecisionResult): Set<string> {
  return new Set(result.existingPositions
    .filter(row => row.assetId && (row.currentValueEur ?? 0) > 0)
    .map(row => row.assetId!)
  );
}

function exceptionalCandidate(
  input: PortfolioEvaluationInput,
  result: PortfolioDecisionResult,
  coreAssetId: string
): { alert: CurrentOpportunityAlert; relativeScoreAdvantage: number; cashAdvantage: number; strongCount: number } | null {
  const held = heldAssetIds(result);
  const coreState = selectionState(input, coreAssetId);
  if (!coreState || coreState.score == null) return null;

  const rows = CurrentOpportunityAlertEngine.evaluate(input.scan, input.cashBenchmarkAnnualPct)
    .filter(alert => !held.has(alert.assetId))
    .filter(alert => !isStrategicGrowthCoreAssetId(alert.assetId))
    .filter(alert => alert.level === 'HIGH_CONVICTION' && alert.timingState === 'ENTRY_STRONG')
    .filter(alert => alert.consensusScore >= CORE_ALPHA_V2_THRESHOLDS.minConsensusScore && alert.favorableVotes >= CORE_ALPHA_V2_THRESHOLDS.minFavorableVotes)
    .map(alert => {
      const state = selectionState(input, alert.assetId);
      const persistence = EntryTimingEngine.assessRecentPersistence(
        input.scan,
        alert.assetId,
        input.cashBenchmarkAnnualPct ?? 0,
        CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions
      );
      const relativeScoreAdvantage = state?.score == null ? -Infinity : state.score - coreState.score!;
      const cashAdvantage = state?.excessVsCashPctPoints == null || coreState.excessVsCashPctPoints == null
        ? -Infinity
        : state.excessVsCashPctPoints - coreState.excessVsCashPctPoints;
      return { alert, state, persistence, relativeScoreAdvantage, cashAdvantage };
    })
    .filter(row => row.state && !row.state.structuralDowntrend)
    .filter(row => row.persistence.observedSessions >= CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions)
    .filter(row => row.persistence.strongCount >= CORE_ALPHA_V2_THRESHOLDS.minPriorStrongObservations)
    .filter(row => row.relativeScoreAdvantage >= CORE_ALPHA_V2_THRESHOLDS.minRelativeSelectionScoreAdvantage)
    .filter(row => row.cashAdvantage >= CORE_ALPHA_V2_THRESHOLDS.minExcessVsCashAdvantagePctPoints)
    .sort((a, b) =>
      b.relativeScoreAdvantage - a.relativeScoreAdvantage
      || b.persistence.strongCount - a.persistence.strongCount
      || b.alert.rankingScore - a.alert.rankingScore
    );

  const best = rows[0];
  return best
    ? {
      alert: best.alert,
      relativeScoreAdvantage: best.relativeScoreAdvantage,
      cashAdvantage: best.cashAdvantage,
      strongCount: best.persistence.strongCount
    }
    : null;
}

/**
 * Experimental bounded alpha overlay on top of CORE_ARCHITECTURE_V1.
 *
 * The structural core remains the permanent majority of the portfolio. V2 may
 * fund exactly one small new non-core position from the core only when the
 * candidate is persistently ENTRY_STRONG and materially stronger than the core
 * on the same causal information set. The sale and purchase are paired as one
 * atomic rotation. On later REDUCE/EXIT, V1 routes the proceeds back to core.
 */
export function applyCoreAlphaV2(
  input: PortfolioEvaluationInput,
  result: PortfolioDecisionResult,
  counters: CoreAlphaV2Counters = {
    coreFundedTilts: 0,
    blockedNoExceptionalCandidate: 0,
    blockedCoreFloor: 0,
    blockedExistingFreshNonCoreOrder: 0
  }
): PortfolioDecisionResult {
  const total = Math.max(0, result.totalPlannedCapitalEur);
  if (!(total > 0)) return result;

  // Cash-funded/new-money opportunities keep priority. Do not sell core in the
  // same decision simply to stack another active bet on top of fresh orders.
  if (plannedNonCoreContribution(input, result) > 0.01) {
    counters.blockedExistingFreshNonCoreOrder += 1;
    return result;
  }

  const risk = input.decision.riskProfile;
  const architectureLimits = CORE_ARCHITECTURE_V1_LIMITS[risk];
  const alphaLimits = CORE_ALPHA_V2_LIMITS[risk];
  const nonCoreNow = currentNonCoreValue(result);
  const nonCoreCapacity = Math.max(0, total * architectureLimits.maximumNonCoreShare - nonCoreNow);
  const coreNow = currentCoreValue(result);
  const coreFloorEur = total * alphaLimits.coreFloorShare;
  const coreCapacity = Math.max(0, coreNow - coreFloorEur);
  const desiredTilt = total * alphaLimits.maxCoreFundedTiltSharePerDecision;
  const amountEur = Math.min(desiredTilt, nonCoreCapacity, coreCapacity);

  if (amountEur < CORE_ALPHA_V2_THRESHOLDS.minimumMeaningfulTiltEur) {
    counters.blockedCoreFloor += 1;
    return result;
  }

  const source = largestCoreSource(result);
  if (!source?.assetId || !(source.currentValueEur && source.currentValueEur > amountEur)) {
    counters.blockedCoreFloor += 1;
    return result;
  }

  const candidate = exceptionalCandidate(input, result, source.assetId);
  if (!candidate) {
    counters.blockedNoExceptionalCandidate += 1;
    return result;
  }

  const catalogCandidate = input.scan.candidates.find(row => row.asset.assetId === candidate.alert.assetId);
  if (!catalogCandidate) {
    counters.blockedNoExceptionalCandidate += 1;
    return result;
  }

  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  const reductionPct = clamp(amountEur / source.currentValueEur * 100, 0, 100);

  source.action = 'REDUCE';
  source.suggestedReductionPct = reductionPct;
  source.rotationChallengerAssetId = candidate.alert.assetId;
  source.rotationChallengerTicker = candidate.alert.ticker;
  source.rotationAdvantageScore = candidate.relativeScoreAdvantage;
  source.rotationChallengerRecentStrongCount = candidate.strongCount;
  source.rotationChallengerPersistenceLookbackSessions = CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions;
  source.reason = `[${CORE_ALPHA_V2}:CORE_FUNDED_TILT] Se reduce sólo ${reductionPct.toFixed(2)}% de ${source.label} para financiar un tilt de ${(amountEur / total * 100).toFixed(2)}% del patrimonio hacia ${candidate.alert.ticker}. El core total conserva un suelo ${(alphaLimits.coreFloorShare * 100).toFixed(0)}%. Challenger: HIGH_CONVICTION + ENTRY_STRONG persistente ${candidate.strongCount}/${CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions}; consenso +${candidate.alert.consensusScore}, ${candidate.alert.favorableVotes}/5 favorables; ventaja de selección vs core +${candidate.relativeScoreAdvantage.toFixed(1)} y ventaja frente a cash vs core +${candidate.cashAdvantage.toFixed(1)} pp. La operación es atómica y nunca autoriza EXIT total del core.`;

  const contribution: ContributionRecommendation = {
    category: catalogCandidate.asset.category,
    assetId: candidate.alert.assetId,
    ticker: candidate.alert.ticker,
    name: candidate.alert.name,
    instrumentType: catalogCandidate.asset.instrumentType ?? 'ETF_ETC',
    amountEur,
    targetCategoryGapEur: amountEur,
    opportunityLevel: candidate.alert.level,
    priorityScore: candidate.alert.rankingScore,
    currentAssetValueEur: 0,
    targetAssetValueEur: amountEur,
    executableTargetAssetValueEur: amountEur,
    timingState: candidate.alert.timingState,
    suggestedInitialFraction: candidate.alert.suggestedInitialFraction,
    positionStage: 'ROTATION_ENTRY',
    portfolioShareCapPct: alphaLimits.maxCoreFundedTiltSharePerDecision * 100,
    reason: `[${CORE_ALPHA_V2}:CORE_FUNDED_TILT] Entrada financiada por una reducción parcial y acotada del core, no por cash o market timing. ${candidate.alert.ticker} sólo recibe ${(amountEur / total * 100).toFixed(2)}% del patrimonio pese a la señal excepcional; al salir, CORE_ARCHITECTURE_V1 devuelve los proceeds al core.`
  };
  result.contributions.push(contribution);

  result.plannedRotationProceedsEur = oldRotationProceeds + amountEur;
  result.deployableToAssetsEur += amountEur;
  result.recommendedNewInvestmentEur = oldRecommended + amountEur;
  // The paired sale fully funds the paired buy, so planned residual cash does not change.
  result.warnings.push(
    `${CORE_ALPHA_V2}: tilt core→alpha ${(amountEur / total * 100).toFixed(2)}% hacia ${candidate.alert.ticker}; core floor ${(alphaLimits.coreFloorShare * 100).toFixed(0)}%, no-core máximo ${(architectureLimits.maximumNonCoreShare * 100).toFixed(0)}%, persistencia STRONG ${candidate.strongCount}/${CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions}.`
  );
  counters.coreFundedTilts += 1;
  return result;
}
