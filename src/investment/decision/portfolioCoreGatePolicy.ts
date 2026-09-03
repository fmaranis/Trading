import { assessAgainstCashBenchmark } from './cashBenchmark';
import {
  PortfolioDecisionEngine,
  type ContributionRecommendation,
  type PortfolioDecisionResult,
  type PortfolioPositionDecision
} from './portfolioDecisionEngine';
import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];

export interface CoreGateV1Counters {
  KEEP: number;
  CORE: number;
  CHALLENGER: number;
}

export const CORE_GATE_V1_THRESHOLDS = {
  challengerExceptionMinPriorStrong: 5,
  challengerExceptionMinConsensus: 4,
  challengerExceptionMinScoreAdvantage: 10,
  challengerExceptionMinCashAdvantagePctPoints: 5
} as const;

const CORE_PRIORITY = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'EUNL',
  'IWDA',
  'SXR8',
  'VUSA'
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function healthFor(input: PortfolioEvaluationInput, position: PortfolioPositionDecision): PortfolioPositionHealthSnapshot | undefined {
  const map = input.positionHealth ?? {};
  for (const key of [position.assetId, position.id]) {
    if (!key) continue;
    const found = map[key] ?? map[key.toUpperCase()];
    if (found) return found;
  }
  return undefined;
}

function chooseCoreCandidate(input: PortfolioEvaluationInput) {
  const accepted = input.scan.candidates.filter(candidate => candidate.status === 'ACCEPTED');
  for (const assetId of CORE_PRIORITY) {
    const found = accepted.find(candidate => candidate.asset.assetId === assetId);
    if (found) return found;
  }
  return accepted
    .filter(candidate => candidate.asset.category === 'GLOBAL_EQUITY' && !candidate.asset.assetId.startsWith('EQ_'))
    .sort((a, b) => a.asset.assetId.localeCompare(b.asset.assetId))[0] ?? null;
}

function causalSelectionScore(input: PortfolioEvaluationInput, assetId: string): {
  score: number | null;
  excessVsCashPctPoints: number | null;
  consensusScore: number | null;
  favorableVotes: number | null;
  structuralDowntrend: boolean;
  cashPasses: boolean;
} {
  const candidate = input.scan.candidates.find(row => row.asset.assetId === assetId);
  const assessment = StrategyConsensusEngine.assess(input.scan, assetId, input.cashBenchmarkAnnualPct);
  if (!candidate || !assessment) {
    return { score: null, excessVsCashPctPoints: null, consensusScore: null, favorableVotes: null, structuralDowntrend: false, cashPasses: false };
  }
  const cash = assessAgainstCashBenchmark({
    momentum120Pct: candidate.momentum120Pct,
    benchmarkAnnualPct: input.cashBenchmarkAnnualPct ?? 0,
    notionalEur: 0,
    estimatedFeeEur: 0
  });
  const excess = cash.excessVsCashPctPoints;
  const score = candidate.score == null || !Number.isFinite(candidate.score)
    ? null
    : candidate.score + assessment.consensusScore * 5 + clamp(excess ?? 0, -20, 20) * 0.5;
  return {
    score,
    excessVsCashPctPoints: excess,
    consensusScore: assessment.consensusScore,
    favorableVotes: assessment.favorableVotes,
    structuralDowntrend: assessment.structuralDowntrend,
    cashPasses: cash.passes === true
  };
}

function clearRotationFields(position: PortfolioPositionDecision): void {
  position.rotationChallengerAssetId = null;
  position.rotationChallengerTicker = null;
  position.rotationAdvantageScore = null;
  position.rotationChallengerRecentStrongCount = null;
  position.rotationChallengerPersistenceLookbackSessions = null;
}

function removeContribution(result: PortfolioDecisionResult, assetId: string): ContributionRecommendation | null {
  const index = result.contributions.findIndex(row => row.assetId === assetId && row.positionStage === 'ROTATION_ENTRY');
  if (index < 0) return null;
  return result.contributions.splice(index, 1)[0] ?? null;
}

function refreshPlanningTotals(result: PortfolioDecisionResult, oldRotationProceeds: number, oldRecommended: number): void {
  const newRotationProceeds = result.existingPositions
    .filter(position => position.action === 'EXIT' && position.rotationChallengerAssetId)
    .reduce((sum, position) => sum + Math.max(0, position.currentValueEur ?? 0), 0);
  const newRecommended = result.contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.plannedRotationProceedsEur = newRotationProceeds;
  result.deployableToAssetsEur = Math.max(0, result.deployableToAssetsEur + newRotationProceeds - oldRotationProceeds);
  result.recommendedNewInvestmentEur = newRecommended;
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + (newRotationProceeds - oldRotationProceeds) - (newRecommended - oldRecommended));
}

function routeToCore(
  result: PortfolioDecisionResult,
  incumbent: PortfolioPositionDecision,
  baselineContribution: ContributionRecommendation,
  core: NonNullable<ReturnType<typeof chooseCoreCandidate>>,
  detail: string
): void {
  const routeAmount = Math.max(0, incumbent.currentValueEur ?? baselineContribution.amountEur);
  const currentCoreValue = Math.max(0, result.existingPositions.find(position => position.assetId === core.asset.assetId)?.currentValueEur ?? 0);
  const existingCoreIndex = result.contributions.findIndex(row => row.assetId === core.asset.assetId);
  const existingCore = existingCoreIndex >= 0 ? result.contributions[existingCoreIndex] : null;
  if (existingCoreIndex >= 0) result.contributions.splice(existingCoreIndex, 1);

  const mergedAmount = routeAmount + Math.max(0, existingCore?.amountEur ?? 0);
  const replacement: ContributionRecommendation = {
    ...(existingCore ?? baselineContribution),
    category: core.asset.category,
    assetId: core.asset.assetId,
    ticker: core.asset.ticker,
    name: core.asset.name,
    instrumentType: core.asset.instrumentType,
    amountEur: mergedAmount,
    currentAssetValueEur: currentCoreValue,
    targetAssetValueEur: currentCoreValue + mergedAmount,
    executableTargetAssetValueEur: currentCoreValue + mergedAmount,
    positionStage: 'ROTATION_ENTRY',
    portfolioShareCapPct: undefined,
    reason: `[CORE_GATE_V1:CORE] Se libera ${incumbent.label} y el capital se dirige al core diversificado ${core.asset.ticker}, no al challenger táctico original ${baselineContribution.ticker}. ${detail} El core es una base de mercado, no un activo libre de riesgo.`
  };
  result.contributions.push(replacement);

  incumbent.rotationChallengerAssetId = core.asset.assetId;
  incumbent.rotationChallengerTicker = core.asset.ticker;
  incumbent.reason = `[CORE_GATE_V1:CORE] Rotación de ${incumbent.label} hacia core diversificado ${core.asset.ticker}. Challenger baseline rechazado: ${baselineContribution.ticker}. ${detail}`;
}

/**
 * Política productiva CORE_GATE_V1.
 *
 * Esta función es deliberadamente pura respecto a la fuente temporal: recibe la
 * misma entrada y el mismo PortfolioDecisionResult tanto en vivo como en replay.
 * No reconstruye datos, no mira al futuro y no cambia ningún threshold según el
 * modo de ejecución.
 */
export function applyCoreGateV1(
  input: PortfolioEvaluationInput,
  result: PortfolioDecisionResult,
  counters: CoreGateV1Counters = { KEEP: 0, CORE: 0, CHALLENGER: 0 }
): PortfolioDecisionResult {
  const rotation = result.existingPositions.find(position => position.action === 'EXIT' && position.rotationChallengerAssetId);
  if (!rotation?.rotationChallengerAssetId || !rotation.assetId) return result;

  const challengerAssetId = rotation.rotationChallengerAssetId;
  const baselineContribution = result.contributions.find(row => row.assetId === challengerAssetId && row.positionStage === 'ROTATION_ENTRY');
  if (!baselineContribution) return result;

  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  const health = healthFor(input, rotation);
  const core = chooseCoreCandidate(input);

  if (health?.action === 'HOLD' && !health.structuralDowntrend && (health.consensusScore ?? -Infinity) >= 0) {
    removeContribution(result, challengerAssetId);
    rotation.action = 'HOLD';
    rotation.suggestedReductionPct = null;
    clearRotationFields(rotation);
    health.reason = `${health.reason} [CORE_GATE_V1:KEEP] Se descartó la rotación competitiva hacia ${baselineContribution.ticker}: el incumbent sigue en HOLD con consenso no negativo; no se vende sólo para perseguir un challenger.`;
    counters.KEEP += 1;
    refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
    return result;
  }

  if (!core || core.asset.assetId === rotation.assetId) {
    rotation.reason += ' [CORE_GATE_V1:CHALLENGER] No existe un core alternativo utilizable; se conserva la rotación baseline.';
    baselineContribution.reason += ' [CORE_GATE_V1:CHALLENGER] Sin core alternativo utilizable.';
    counters.CHALLENGER += 1;
    return result;
  }

  if (core.asset.assetId === challengerAssetId) {
    rotation.reason += ' [CORE_GATE_V1:CHALLENGER] El challenger baseline ya es el core diversificado prioritario.';
    baselineContribution.reason += ' [CORE_GATE_V1:CHALLENGER] El destino ya coincide con el core prioritario.';
    counters.CHALLENGER += 1;
    return result;
  }

  const coreState = causalSelectionScore(input, core.asset.assetId);
  const challengerState = causalSelectionScore(input, challengerAssetId);
  const coreEligible = coreState.cashPasses
    && !coreState.structuralDowntrend
    && (coreState.consensusScore ?? -Infinity) >= 0;

  if (!coreEligible) {
    rotation.reason += ` [CORE_GATE_V1:CHALLENGER] El core ${core.asset.ticker} no supera el gate defensivo causal de esta fecha; no se fuerza refugio relativo.`;
    baselineContribution.reason += ` [CORE_GATE_V1:CHALLENGER] Core ${core.asset.ticker} no apto causalmente.`;
    counters.CHALLENGER += 1;
    return result;
  }

  const strongCount = Math.max(0, rotation.rotationChallengerRecentStrongCount ?? 0);
  const scoreAdvantage = challengerState.score == null || coreState.score == null ? -Infinity : challengerState.score - coreState.score;
  const cashAdvantage = challengerState.excessVsCashPctPoints == null || coreState.excessVsCashPctPoints == null
    ? -Infinity
    : challengerState.excessVsCashPctPoints - coreState.excessVsCashPctPoints;
  const challengerExceptional = strongCount >= CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong
    && (challengerState.consensusScore ?? -Infinity) >= CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus
    && (challengerState.favorableVotes ?? 0) >= 4
    && scoreAdvantage >= CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage
    && cashAdvantage >= CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints;

  const detail = `Comparación causal challenger/core: persistencia STRONG ${strongCount}/10; consenso ${challengerState.consensusScore ?? 'N/D'} vs ${coreState.consensusScore ?? 'N/D'}; ventaja de score ${Number.isFinite(scoreAdvantage) ? scoreAdvantage.toFixed(1) : 'N/D'}; ventaja frente a cash ${Number.isFinite(cashAdvantage) ? `${cashAdvantage.toFixed(1)} pp` : 'N/D'}. Para saltarse el core se exige ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong}/10, consenso ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus}, score +${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage} y cash +${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints} pp.`;

  if (challengerExceptional) {
    rotation.reason += ` [CORE_GATE_V1:CHALLENGER] ${detail}`;
    baselineContribution.reason += ` [CORE_GATE_V1:CHALLENGER] ${detail}`;
    counters.CHALLENGER += 1;
    return result;
  }

  removeContribution(result, challengerAssetId);
  routeToCore(result, rotation, baselineContribution, core, detail);
  counters.CORE += 1;
  refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
  return result;
}

/**
 * Única entrada productiva para la decisión de cartera: baseline + CORE_GATE_V1.
 * Replay y UI deben converger en esta misma política para el mismo estado.
 */
export function evaluatePortfolioDecision(input: PortfolioEvaluationInput): PortfolioDecisionResult {
  return applyCoreGateV1(input, PortfolioDecisionEngine.evaluate(input));
}
