import { PortfolioDecisionEngine, type PortfolioDecisionResult, type PortfolioPositionDecision } from './portfolioDecisionEngine';
import type { PortfolioPositionHealthAction, PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { isDiversifiedCoreCategory } from './portfolioPositionHealth';
import { StrategyConsensusEngine } from './strategyConsensusEngine';
import { classifyTrendProtectionV2, type TrendProtectionV2Decision } from './trendProtectionPolicy';
import { runDynamicReplayWithRotationExperiment } from './replayRotationPolicyExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];
type ReplayRunInput = Parameters<typeof runDynamicReplayWithRotationExperiment>[0];

interface V2EpisodeState {
  mfePct: number;
  armed: boolean;
  observations: number;
  referenceReturnPct: number | null;
  reductionExecuted: boolean;
  pendingReduction: boolean;
  lastUnits: number | null;
}

function emptyState(): V2EpisodeState {
  return { mfePct: 0, armed: false, observations: 0, referenceReturnPct: null, reductionExecuted: false, pendingReduction: false, lastUnits: null };
}

function resetEpisode(state: V2EpisodeState, resetMfe = false): void {
  if (resetMfe) state.mfePct = 0;
  state.armed = false;
  state.observations = 0;
  state.referenceReturnPct = null;
  state.reductionExecuted = false;
  state.pendingReduction = false;
}

function candidateForSnapshot(input: PortfolioEvaluationInput, snapshot: PortfolioPositionHealthSnapshot) {
  const keys = new Set([snapshot.key?.toUpperCase(), snapshot.tickerOrIsin?.toUpperCase()].filter(Boolean));
  return input.scan.candidates.find(row =>
    keys.has(row.asset.assetId.toUpperCase())
    || keys.has(row.asset.ticker.toUpperCase())
    || (row.asset.isin ? keys.has(row.asset.isin.toUpperCase()) : false)
  ) ?? null;
}

function portfolioUnits(input: PortfolioEvaluationInput, assetId: string, ticker: string, isin?: string | null): number {
  const listed = input.portfolio.holdings.find(row => row.ticker.toUpperCase() === ticker.toUpperCase());
  if (listed) return Math.max(0, listed.shares);
  const fund = (input.portfolio.funds ?? []).find(row =>
    row.id === assetId
    || row.isin.toUpperCase() === (isin ?? '').toUpperCase()
    || row.isin.toUpperCase() === ticker.toUpperCase()
  );
  return Math.max(0, fund?.units ?? 0);
}

export function adaptTrendProtectionV2ForWholeShareExecution(
  decision: TrendProtectionV2Decision,
  instrumentType: 'ETF_ETC' | 'MUTUAL_FUND',
  units: number
): TrendProtectionV2Decision {
  if (decision.action !== 'REDUCE' || instrumentType !== 'ETF_ETC') return decision;
  const reductionPct = Math.max(0, Math.min(100, decision.suggestedReductionPct ?? 25));
  const wholeUnitsToSell = Math.floor(Math.max(0, units) * reductionPct / 100 + 1e-9);
  if (wholeUnitsToSell >= 1) return decision;
  return {
    ...decision,
    action: 'PROTECT',
    suggestedReductionPct: null,
    reason: `${decision.reason} REDUCE ${reductionPct.toFixed(0)}% no ejecutable con ${Math.max(0, units).toFixed(4)} títulos enteros; mantener PROTECT en lugar de declarar una venta que el broker no puede materializar.`
  };
}

function operationalAction(base: PortfolioPositionHealthAction, decision: TrendProtectionV2Decision): PortfolioPositionHealthAction {
  if (decision.action === 'REDUCE' || decision.action === 'EXIT') return decision.action;
  if (decision.action === 'PROTECT' || decision.action === 'WATCH') return 'WATCH';
  // V2 replaces baseline protective sales but preserves healthy ADD and pre-existing
  // WATCH semantics when V2 itself sees no protective break.
  if (base === 'REDUCE' || base === 'EXIT') return 'HOLD';
  return base;
}

function applyTrendProtectionV2(input: PortfolioEvaluationInput, states: Map<string, V2EpisodeState>): PortfolioEvaluationInput {
  const health = input.positionHealth ?? {};
  const transformed = new Map<PortfolioPositionHealthSnapshot, PortfolioPositionHealthSnapshot>();
  const active = new Set<string>();
  const nextHealth: Record<string, PortfolioPositionHealthSnapshot> = {};

  for (const [key, snapshot] of Object.entries(health)) {
    const cached = transformed.get(snapshot);
    if (cached) { nextHealth[key] = cached; continue; }

    const candidate = candidateForSnapshot(input, snapshot);
    if (!candidate) {
      transformed.set(snapshot, snapshot);
      nextHealth[key] = snapshot;
      continue;
    }

    const assetId = candidate.asset.assetId;
    active.add(assetId);
    const state = states.get(assetId) ?? emptyState();
    const units = portfolioUnits(input, assetId, candidate.asset.ticker, candidate.asset.isin);

    if (state.lastUnits != null) {
      if (units > state.lastUnits + 1e-9) {
        // ADD changes the basis/exposure and starts a fresh protection episode.
        resetEpisode(state, true);
      } else if (units < state.lastUnits - 1e-9) {
        if (state.pendingReduction) {
          // Idempotence is consumed only by an actually executed partial sale.
          state.reductionExecuted = true;
          state.pendingReduction = false;
        } else {
          // A non-V2 reduction/rotation creates a fresh remaining tranche.
          resetEpisode(state, true);
        }
      }
    }
    state.lastUnits = units;

    const currentReturnPct = snapshot.currentReturnPct ?? null;
    if (currentReturnPct != null) state.mfePct = Math.max(state.mfePct, currentReturnPct, 0);
    const giveback = currentReturnPct == null ? null : Math.max(0, state.mfePct - currentReturnPct);
    const observationsForDecision = state.armed ? state.observations + 1 : 1;
    const referenceForDecision = state.armed ? state.referenceReturnPct : currentReturnPct;
    const assessment = StrategyConsensusEngine.assess(input.scan, assetId, input.cashBenchmarkAnnualPct);
    const rawDecision = classifyTrendProtectionV2(assessment, {
      currentReturnPct,
      mfePct: state.mfePct,
      givebackFromMfePctPoints: giveback,
      isDiversifiedCore: snapshot.isDiversifiedCore ?? isDiversifiedCoreCategory(candidate.asset.category, assetId),
      deteriorationStreakSessions: snapshot.deteriorationStreakSessions ?? 0,
      momentum20Pct: snapshot.momentum20Pct ?? candidate.momentum20Pct,
      protectionObservations: observationsForDecision,
      protectionReferenceReturnPct: referenceForDecision,
      protectionReductionExecuted: state.reductionExecuted
    });
    const decision = adaptTrendProtectionV2ForWholeShareExecution(rawDecision, candidate.asset.instrumentType, units);

    if (decision.reclaimDetected) {
      resetEpisode(state, false);
    } else {
      const protectionActive = decision.winnerProtectionArmed
        || decision.loserFailureArmed
        || decision.action === 'PROTECT'
        || decision.action === 'REDUCE'
        || decision.action === 'EXIT';
      if (protectionActive) {
        if (!state.armed) {
          state.armed = true;
          state.observations = 1;
          state.referenceReturnPct = currentReturnPct;
          state.reductionExecuted = false;
          state.pendingReduction = false;
        } else state.observations = observationsForDecision;
      }
    }
    if (decision.action === 'REDUCE') state.pendingReduction = true;
    states.set(assetId, state);

    const action = operationalAction(snapshot.action, decision);
    const next: PortfolioPositionHealthSnapshot = {
      ...snapshot,
      action,
      suggestedReductionPct: decision.action === 'REDUCE' || decision.action === 'EXIT'
        ? decision.suggestedReductionPct
        : (action === snapshot.action ? snapshot.suggestedReductionPct : null),
      reason: `[TREND_PROTECTION_V2:${decision.action}] ${decision.reason} Política base observada: ${snapshot.action}.`
    };
    transformed.set(snapshot, next);
    nextHealth[key] = next;
  }

  for (const assetId of [...states.keys()]) if (!active.has(assetId)) states.delete(assetId);
  return { ...input, positionHealth: nextHealth };
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

function blockRotationsDuringProtect(input: PortfolioEvaluationInput, result: PortfolioDecisionResult): PortfolioDecisionResult {
  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  let changed = false;

  for (const position of result.existingPositions) {
    if (!position.rotationChallengerAssetId) continue;
    const health = healthFor(input, position);
    if (!health?.reason.includes('[TREND_PROTECTION_V2:PROTECT]')) continue;
    const challengerAssetId = position.rotationChallengerAssetId;
    result.contributions = result.contributions.filter(row => !(row.assetId === challengerAssetId && row.positionStage === 'ROTATION_ENTRY'));
    position.action = 'HOLD';
    position.suggestedReductionPct = null;
    position.rotationChallengerAssetId = null;
    position.rotationChallengerTicker = null;
    position.rotationAdvantageScore = null;
    position.rotationChallengerRecentStrongCount = null;
    position.rotationChallengerPersistenceLookbackSessions = null;
    position.reason = `${health.reason} [TREND_PROTECTION_V2:PROTECT] No se permite que una ruptura recién armada se convierta indirectamente en venta por rotación competitiva.`;
    changed = true;
  }

  if (changed) refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
  return result;
}

export function runDynamicReplayWithTrendProtectionV2Experiment(input: ReplayRunInput): DynamicHistoricalReplayResult {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const states = new Map<string, V2EpisodeState>();
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const transformed = applyTrendProtectionV2(evaluationInput, states);
      const result = originalEvaluate.call(PortfolioDecisionEngine, transformed);
      return blockRotationsDuringProtect(transformed, result);
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_GATE_V1');
    result.notes.push(
      'TREND_PROTECTION_V2 full causal replay: mismo universo, scanner, Entry Timing, sizing, rotación CORE_GATE_V1, cash y límites de plazas; sólo se sustituye la protección REDUCE/EXIT de salud por V2. Las entradas posteriores pueden divergir causalmente si cambia el cash o la ocupación de plazas.',
      'PROTECT es no operativo: no vende por salud ni puede convertirse indirectamente en una rotación competitiva. Un REDUCE V2 consume la idempotencia sólo cuando la siguiente evaluación confirma una caída real de unidades; si el 25% de un ETF equivale a menos de un título entero, se degrada a PROTECT y no se declara una venta ficticia.'
    );
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}