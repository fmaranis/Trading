import { assessAgainstCashBenchmark, CashBenchmarkService } from './cashBenchmark';
import {
  PortfolioDecisionEngine,
  type ContributionRecommendation,
  type PortfolioDecisionResult,
  type PortfolioPositionDecision
} from './portfolioDecisionEngine';
import {
  isStrategicGrowthCoreAssetId,
  portfolioAssetRole,
  STRATEGIC_GROWTH_CORE_PRIORITY
} from './portfolioAssetRole';
import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { STRATEGIC_CORE_POLICY } from './strategicCorePolicy';
import { StrategyConsensusEngine } from './strategyConsensusEngine';

export type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];

export interface CoreGateV1Counters {
  KEEP: number;
  CORE: number;
  CHALLENGER: number;
}

export interface CoreArchitectureV1Counters {
  protectedCoreSales: number;
  cappedNonCoreContributions: number;
  salesReturnedToCore: number;
  coreTopUps: number;
}

export const CORE_GATE_V1_THRESHOLDS = {
  challengerExceptionMinPriorStrong: 5,
  challengerExceptionMinConsensus: 4,
  challengerExceptionMinScoreAdvantage: 10,
  challengerExceptionMinCashAdvantagePctPoints: 5
} as const;

/**
 * Portfolio architecture guardrails, deliberately versioned and not fitted to a
 * single historical path. The structural core is the default home for long-run
 * investable capital; the non-core sleeve is a bounded budget, not a replacement
 * for the market core. Cash is an operational reserve rather than a market-timing
 * destination.
 */
export const CORE_ARCHITECTURE_V1_LIMITS = {
  LOW: { maximumNonCoreShare: 0.18, operationalCashReserveShare: 0.08 },
  MEDIUM: { maximumNonCoreShare: 0.25, operationalCashReserveShare: 0.05 },
  HIGH: { maximumNonCoreShare: 0.35, operationalCashReserveShare: 0.03 }
} as const;

export const CORE_ARCHITECTURE_V1 = 'CORE_ARCHITECTURE_V1' as const;

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
  for (const assetId of STRATEGIC_GROWTH_CORE_PRIORITY) {
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

function removeContribution(result: PortfolioDecisionResult, assetId: string, rotationOnly = false): ContributionRecommendation | null {
  const index = result.contributions.findIndex(row => row.assetId === assetId && (!rotationOnly || row.positionStage === 'ROTATION_ENTRY'));
  if (index < 0) return null;
  return result.contributions.splice(index, 1)[0] ?? null;
}

function plannedSaleValue(position: PortfolioPositionDecision): number {
  const value = Math.max(0, position.currentValueEur ?? 0);
  if (position.action === 'EXIT') return value;
  if (position.action === 'REDUCE') return value * clamp(position.suggestedReductionPct ?? 50, 0, 100) / 100;
  return 0;
}

function currentPlannedRotationProceeds(result: PortfolioDecisionResult): number {
  return result.existingPositions
    .filter(position => (position.action === 'EXIT' || position.action === 'REDUCE') && position.rotationChallengerAssetId)
    .reduce((sum, position) => sum + plannedSaleValue(position), 0);
}

function refreshPlanningTotals(result: PortfolioDecisionResult, oldRotationProceeds: number, oldRecommended: number): void {
  const newRotationProceeds = currentPlannedRotationProceeds(result);
  const newRecommended = result.contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.plannedRotationProceedsEur = newRotationProceeds;
  result.deployableToAssetsEur = Math.max(0, result.deployableToAssetsEur + newRotationProceeds - oldRotationProceeds);
  result.recommendedNewInvestmentEur = newRecommended;
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + (newRotationProceeds - oldRotationProceeds) - (newRecommended - oldRecommended));
}

function coreCurrentValue(result: PortfolioDecisionResult): number {
  return result.existingPositions
    .filter(position => isStrategicGrowthCoreAssetId(position.assetId))
    .reduce((sum, position) => sum + Math.max(0, position.currentValueEur ?? 0), 0);
}

function contributionRole(input: PortfolioEvaluationInput, contribution: ContributionRecommendation) {
  const candidate = input.scan.candidates.find(row => row.asset.assetId === contribution.assetId);
  return portfolioAssetRole({ assetId: contribution.assetId, category: candidate?.asset.category ?? contribution.category });
}

function addOrMergeCoreContribution(input: PortfolioEvaluationInput, result: PortfolioDecisionResult, amountEur: number, reason: string, stage: ContributionRecommendation['positionStage']): boolean {
  const amount = Math.max(0, amountEur);
  if (amount <= 1e-9) return false;
  const core = chooseCoreCandidate(input);
  if (!core) return false;

  const existingIndex = result.contributions.findIndex(row => row.assetId === core.asset.assetId);
  const currentValue = coreCurrentValue(result);
  if (existingIndex >= 0) {
    const existing = result.contributions[existingIndex];
    const mergedAmount = Math.max(0, existing.amountEur) + amount;
    result.contributions[existingIndex] = {
      ...existing,
      amountEur: mergedAmount,
      currentAssetValueEur: currentValue,
      targetAssetValueEur: currentValue + mergedAmount,
      executableTargetAssetValueEur: currentValue + mergedAmount,
      positionStage: existing.positionStage === 'ROTATION_ENTRY' || stage === 'ROTATION_ENTRY' ? 'ROTATION_ENTRY' : existing.positionStage,
      reason: `${existing.reason} ${reason}`
    };
    return true;
  }

  result.contributions.push({
    category: core.asset.category,
    assetId: core.asset.assetId,
    ticker: core.asset.ticker,
    name: core.asset.name,
    instrumentType: core.asset.instrumentType ?? 'ETF_ETC',
    amountEur: amount,
    targetCategoryGapEur: amount,
    currentAssetValueEur: currentValue,
    targetAssetValueEur: currentValue + amount,
    executableTargetAssetValueEur: currentValue + amount,
    positionStage: stage,
    portfolioShareCapPct: undefined,
    reason
  });
  return true;
}

function routeToCore(
  result: PortfolioDecisionResult,
  incumbent: PortfolioPositionDecision,
  baselineContribution: ContributionRecommendation,
  core: NonNullable<ReturnType<typeof chooseCoreCandidate>>,
  detail: string
): void {
  const routeAmount = Math.max(0, plannedSaleValue(incumbent) || incumbent.currentValueEur || baselineContribution.amountEur);
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
    instrumentType: core.asset.instrumentType ?? 'ETF_ETC',
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
    removeContribution(result, challengerAssetId, true);
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

  removeContribution(result, challengerAssetId, true);
  routeToCore(result, rotation, baselineContribution, core, detail);
  counters.CORE += 1;
  refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
  return result;
}

/**
 * CORE_ARCHITECTURE_V1 turns the global market core into an explicit portfolio
 * invariant instead of another tactical position:
 *
 * - structural global core cannot be REDUCE/EXITed by short-horizon health;
 * - regional indexes and tactical assets share a bounded non-core budget;
 * - non-core sales return to the structural core by default;
 * - residual investable cash above a small operational reserve is deployed to
 *   the structural core without EntryTiming/market-timing gates.
 *
 * It deliberately does NOT rotate 100% of the core into the strongest recent
 * region. Full core replacement is reserved for a separate equivalent-product
 * transfer decision with product-level evidence, not performance chasing.
 */
export function applyCoreArchitectureV1(
  input: PortfolioEvaluationInput,
  result: PortfolioDecisionResult,
  counters: CoreArchitectureV1Counters = { protectedCoreSales: 0, cappedNonCoreContributions: 0, salesReturnedToCore: 0, coreTopUps: 0 }
): PortfolioDecisionResult {
  const limits = CORE_ARCHITECTURE_V1_LIMITS[input.decision.riskProfile];
  const total = Math.max(0, result.totalPlannedCapitalEur);
  const core = chooseCoreCandidate(input);
  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;

  // 1) Structural global core is observable but not tactically sellable.
  for (const position of result.existingPositions) {
    if (!isStrategicGrowthCoreAssetId(position.assetId)) continue;
    if (position.action !== 'REDUCE' && position.action !== 'EXIT' && !position.rotationChallengerAssetId) continue;
    if (position.rotationChallengerAssetId) removeContribution(result, position.rotationChallengerAssetId, true);
    const observed = position.action;
    position.action = 'HOLD';
    position.suggestedReductionPct = null;
    clearRotationFields(position);
    position.reason = `[CORE_ARCHITECTURE_V1:STRUCTURAL_CORE] [${STRATEGIC_CORE_POLICY}] ${position.label} es core global estructural: ${observed} queda como diagnóstico y no se ejecuta. El core sólo puede sustituirse por otro producto global equivalente mediante una política de transferencia explícita, no por timing táctico. ${position.reason}`;
    counters.protectedCoreSales += 1;
  }

  refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);

  // 2) Bound the entire non-core sleeve. Existing exposure is never force-sold
  // merely for exceeding the cap; the cap controls fresh/rotated capital.
  const plannedNonCoreSaleEur = result.existingPositions
    .filter(position => !isStrategicGrowthCoreAssetId(position.assetId))
    .reduce((sum, position) => sum + plannedSaleValue(position), 0);
  const currentNonCoreEur = result.existingPositions
    .filter(position => !isStrategicGrowthCoreAssetId(position.assetId))
    .reduce((sum, position) => sum + Math.max(0, position.currentValueEur ?? 0), 0);
  const nonCoreAfterPlannedSales = Math.max(0, currentNonCoreEur - plannedNonCoreSaleEur);
  let remainingNonCoreBudget = Math.max(0, total * limits.maximumNonCoreShare - nonCoreAfterPlannedSales);

  const orderedNonCore = result.contributions
    .filter(row => contributionRole(input, row) !== 'STRATEGIC_GROWTH_CORE')
    .sort((a, b) => {
      const rotation = Number(b.positionStage === 'ROTATION_ENTRY') - Number(a.positionStage === 'ROTATION_ENTRY');
      if (rotation) return rotation;
      return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
    });

  for (const contribution of orderedNonCore) {
    const requested = Math.max(0, contribution.amountEur);
    if (requested <= remainingNonCoreBudget + 1e-9) {
      remainingNonCoreBudget -= requested;
      continue;
    }

    const source = result.existingPositions.find(position => position.rotationChallengerAssetId === contribution.assetId);
    if (contribution.positionStage === 'ROTATION_ENTRY' && source && core) {
      removeContribution(result, contribution.assetId, true);
      routeToCore(
        result,
        source,
        contribution,
        core,
        `[${CORE_ARCHITECTURE_V1}] El challenger excedería el presupuesto no-core ${(limits.maximumNonCoreShare * 100).toFixed(0)}%; el capital vuelve al core en lugar de aumentar riesgo táctico.`
      );
      counters.cappedNonCoreContributions += 1;
      continue;
    }

    const allowed = Math.max(0, remainingNonCoreBudget);
    if (allowed <= 1e-9) {
      removeContribution(result, contribution.assetId, false);
    } else {
      contribution.amountEur = allowed;
      contribution.targetAssetValueEur = Math.max(0, contribution.currentAssetValueEur ?? 0) + allowed;
      contribution.executableTargetAssetValueEur = contribution.targetAssetValueEur;
      contribution.reason += ` [${CORE_ARCHITECTURE_V1}] Importe limitado por presupuesto no-core máximo ${(limits.maximumNonCoreShare * 100).toFixed(0)}%.`;
    }
    remainingNonCoreBudget = 0;
    counters.cappedNonCoreContributions += 1;
  }

  refreshPlanningTotals(result, result.plannedRotationProceedsEur, result.recommendedNewInvestmentEur);

  // 3) A non-core REDUCE/EXIT without a funded destination returns to core.
  // Marking the destination on the source preserves atomic replay/live semantics.
  if (core) {
    for (const position of result.existingPositions) {
      if (isStrategicGrowthCoreAssetId(position.assetId)) continue;
      if (position.action !== 'REDUCE' && position.action !== 'EXIT') continue;
      if (position.rotationChallengerAssetId) continue;
      const amount = plannedSaleValue(position);
      if (amount <= 1e-9) continue;
      position.rotationChallengerAssetId = core.asset.assetId;
      position.rotationChallengerTicker = core.asset.ticker;
      position.reason += ` [${CORE_ARCHITECTURE_V1}:RETURN_TO_CORE] El capital liberado no queda esperando en cash: vuelve al core global ${core.asset.ticker}.`;
      if (addOrMergeCoreContribution(
        input,
        result,
        amount,
        `[${CORE_ARCHITECTURE_V1}:RETURN_TO_CORE] ${amount.toFixed(2)} € procedentes de ${position.action} no-core vuelven al core global.`,
        'ROTATION_ENTRY'
      )) counters.salesReturnedToCore += 1;
    }
  }

  const beforeCoreTopUpRotation = result.plannedRotationProceedsEur;
  const beforeCoreTopUpRecommended = result.recommendedNewInvestmentEur;
  refreshPlanningTotals(result, beforeCoreTopUpRotation, beforeCoreTopUpRecommended);

  // 4) Idle investable cash is not a market-timing position. Keep only the
  // risk-profile operational reserve; deploy the rest to the global core.
  const operationalCashReserveEur = total * limits.operationalCashReserveShare;
  const coreTopUpEur = core ? Math.max(0, result.residualPlannedCashEur - operationalCashReserveEur) : 0;
  if (coreTopUpEur > 1e-9 && addOrMergeCoreContribution(
    input,
    result,
    coreTopUpEur,
    `[${CORE_ARCHITECTURE_V1}:CORE_TOP_UP] Cash residual por encima de la reserva operativa ${(limits.operationalCashReserveShare * 100).toFixed(0)}% se invierte en el core global; no se exige breakout para mantener exposición estructural al mercado.`,
    'BUILD'
  )) {
    counters.coreTopUps += 1;
    result.targetCashEur = Math.min(result.targetCashEur, operationalCashReserveEur);
    result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur - coreTopUpEur);
    result.recommendedNewInvestmentEur = result.contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
    result.deployableToAssetsEur = Math.max(result.deployableToAssetsEur, Math.max(0, result.recommendedNewInvestmentEur - result.plannedRotationProceedsEur));
  }

  result.warnings.push(
    `${CORE_ARCHITECTURE_V1}: core global protegido; no-core máximo ${(limits.maximumNonCoreShare * 100).toFixed(0)}%; cash operativo ${(limits.operationalCashReserveShare * 100).toFixed(0)}%. El exceso de cash y las ventas no-core se dirigen al core. No existe rotación 100% regional por momentum.`
  );
  return result;
}

/**
 * Única entrada productiva para la decisión de cartera: baseline + CORE_GATE_V1
 * + CORE_ARCHITECTURE_V1. Replay, UI y backend deben converger en esta misma
 * cadena para un estado idéntico.
 */
export function evaluatePortfolioDecision(input: PortfolioEvaluationInput): PortfolioDecisionResult {
  const normalizedInput: PortfolioEvaluationInput = {
    ...input,
    cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct ?? CashBenchmarkService.load()
  };
  const baseline = PortfolioDecisionEngine.evaluate(normalizedInput);
  const gated = applyCoreGateV1(normalizedInput, baseline);
  return applyCoreArchitectureV1(normalizedInput, gated);
}
