import { PortfolioDecisionEngine, type PortfolioDecisionResult } from './portfolioDecisionEngine';
import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';
import { classifyTrendProtectionV2, type TrendProtectionV2Decision } from './trendProtectionPolicy';

export const PHASE5_WINNER_PROTECTION_V2 = 'TREND_PROTECTION_V2_WINNER_ONLY' as const;
export type Phase5WinnerProtectionPolicy = 'LEGACY' | typeof PHASE5_WINNER_PROTECTION_V2;

type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];

export interface Phase5WinnerProtectionEpisodeState {
  assetId: string;
  ticker: string;
  armed: boolean;
  armDate: string | null;
  observations: number;
  referenceReturnPct: number | null;
  reductionExecuted: boolean;
  pendingReduction: boolean;
  pendingReductionSignalDate: string | null;
  lastUnits: number | null;
}

export interface Phase5WinnerProtectionDecisionAudit {
  decisionDate: string;
  assetId: string;
  ticker: string;
  action: TrendProtectionV2Decision['action'];
  winnerProtectionArmed: boolean;
  reclaimDetected: boolean;
  currentReturnPct: number | null;
  mfePct: number | null;
  givebackFromMfePctPoints: number | null;
  protectionObservations: number;
  reductionExecutedBeforeDecision: boolean;
  economicOverrideApplied: boolean;
  reason: string;
}

export interface Phase5WinnerProtectionRuntimeAudit {
  policy: Phase5WinnerProtectionPolicy;
  armedEpisodes: number;
  proposedReductions: number;
  executionConfirmations: number;
  reclaims: number;
  skippedDiversifiedCore: number;
  skippedCanonicalStrongerAction: number;
  wholeShareBlockedReductions: number;
  decisions: Phase5WinnerProtectionDecisionAudit[];
}

export function emptyPhase5WinnerProtectionAudit(policy: Phase5WinnerProtectionPolicy = 'LEGACY'): Phase5WinnerProtectionRuntimeAudit {
  return {
    policy,
    armedEpisodes: 0,
    proposedReductions: 0,
    executionConfirmations: 0,
    reclaims: 0,
    skippedDiversifiedCore: 0,
    skippedCanonicalStrongerAction: 0,
    wholeShareBlockedReductions: 0,
    decisions: []
  };
}

function decisionDate(input: PortfolioEvaluationInput): string {
  const updatedAt = String(input.portfolio.updatedAt ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(updatedAt) ? updatedAt : input.decision.asOfDate;
}

function healthFor(input: PortfolioEvaluationInput, assetId: string, ticker: string): PortfolioPositionHealthSnapshot | null {
  const map = input.positionHealth ?? {};
  return map[assetId]
    ?? map[assetId.toUpperCase()]
    ?? map[ticker]
    ?? map[ticker.toUpperCase()]
    ?? null;
}

function listedUnits(input: PortfolioEvaluationInput, ticker: string): number {
  return Math.max(0, input.portfolio.holdings.find(row => row.ticker.toUpperCase() === ticker.toUpperCase())?.shares ?? 0);
}

function resetEpisode(state: Phase5WinnerProtectionEpisodeState): void {
  state.armed = false;
  state.armDate = null;
  state.observations = 0;
  state.referenceReturnPct = null;
  state.reductionExecuted = false;
  state.pendingReduction = false;
  state.pendingReductionSignalDate = null;
}

function reconcilePendingExecution(
  state: Phase5WinnerProtectionEpisodeState,
  currentUnits: number,
  audit: Phase5WinnerProtectionRuntimeAudit
): void {
  if (state.lastUnits == null) {
    state.lastUnits = currentUnits;
    return;
  }
  if (state.pendingReduction) {
    if (currentUnits < state.lastUnits - 1e-9) {
      state.reductionExecuted = true;
      audit.executionConfirmations += 1;
    }
    state.pendingReduction = false;
    state.pendingReductionSignalDate = null;
  } else if (currentUnits > state.lastUnits + 1e-9) {
    // A new purchase is a new economic episode. Old MFE/giveback protection
    // state must not leak across the acquisition boundary.
    resetEpisode(state);
  }
  state.lastUnits = currentUnits;
}

/**
 * Phase 5 evaluates only the winner branch of the already-frozen V2 classifier.
 * We neutralize loser/failure votes in a cloned assessment instead of editing or
 * duplicating TREND_PROTECTION_V2 thresholds. Trend structure is preserved, so
 * winner arming/confirmation/reclaim semantics stay exactly those of V2.
 */
export function winnerOnlyAssessment(assessment: StrategyConsensusAssessment | null): StrategyConsensusAssessment | null {
  if (!assessment) return null;
  return {
    ...assessment,
    unfavorableVotes: 0,
    consensusScore: Math.max(0, assessment.consensusScore)
  };
}

function wholeShareExecutable(decision: TrendProtectionV2Decision, units: number): boolean {
  if (decision.action !== 'REDUCE') return true;
  const pct = Math.max(0, Math.min(100, decision.suggestedReductionPct ?? 25));
  return Math.floor(Math.max(0, units) * pct / 100 + 1e-9) >= 1;
}

function contributionMatchesAsset(input: PortfolioEvaluationInput, contributionAssetId: string, assetId: string): boolean {
  if (contributionAssetId === assetId) return true;
  const asset = input.scan.candidates.find(row => row.asset.assetId === assetId)?.asset;
  return Boolean(asset && contributionAssetId === asset.assetId);
}

export function applyPhase5WinnerProtectionV2Overlay(input: {
  evaluationInput: PortfolioEvaluationInput;
  gatedResult: PortfolioDecisionResult;
  states: Map<string, Phase5WinnerProtectionEpisodeState>;
  audit: Phase5WinnerProtectionRuntimeAudit;
}): PortfolioDecisionResult {
  const { evaluationInput, states, audit } = input;
  // CORE_GATE_V1 may mutate the engine result. Clone the economic arrays here so
  // Phase 5 cannot leak changes into another paired result or caller reference.
  const result: PortfolioDecisionResult = {
    ...input.gatedResult,
    existingPositions: input.gatedResult.existingPositions.map(row => ({ ...row })),
    contributions: input.gatedResult.contributions.map(row => ({ ...row })),
    exposures: input.gatedResult.exposures.map(row => ({ ...row })),
    warnings: [...input.gatedResult.warnings]
  };
  const date = decisionDate(evaluationInput);
  const active = new Set<string>();

  for (const position of result.existingPositions) {
    if (!position.assetId) continue;
    const candidate = evaluationInput.scan.candidates.find(row => row.asset.assetId === position.assetId);
    if (!candidate) continue;
    const assetId = candidate.asset.assetId;
    const ticker = candidate.asset.ticker;
    active.add(assetId);
    const health = healthFor(evaluationInput, assetId, ticker);
    if (!health) continue;

    const units = listedUnits(evaluationInput, ticker);
    const state = states.get(assetId) ?? {
      assetId,
      ticker,
      armed: false,
      armDate: null,
      observations: 0,
      referenceReturnPct: null,
      reductionExecuted: false,
      pendingReduction: false,
      pendingReductionSignalDate: null,
      lastUnits: null
    };
    reconcilePendingExecution(state, units, audit);

    if (health.isDiversifiedCore === true) {
      audit.skippedDiversifiedCore += 1;
      resetEpisode(state);
      state.lastUnits = units;
      states.set(assetId, state);
      continue;
    }

    const assessment = winnerOnlyAssessment(
      StrategyConsensusEngine.assess(evaluationInput.scan, assetId, evaluationInput.cashBenchmarkAnnualPct)
    );
    const observations = state.armed ? state.observations + 1 : 1;
    const referenceReturn = state.armed ? state.referenceReturnPct : (health.currentReturnPct ?? null);
    const decision = classifyTrendProtectionV2(assessment, {
      currentReturnPct: health.currentReturnPct ?? null,
      mfePct: health.mfePct ?? null,
      givebackFromMfePctPoints: health.givebackFromMfePctPoints ?? null,
      isDiversifiedCore: false,
      deteriorationStreakSessions: health.deteriorationStreakSessions ?? 0,
      momentum20Pct: health.momentum20Pct ?? candidate.momentum20Pct,
      protectionObservations: observations,
      protectionReferenceReturnPct: referenceReturn,
      protectionReductionExecuted: state.reductionExecuted
    });

    if (decision.reclaimDetected) {
      if (state.armed) audit.reclaims += 1;
      resetEpisode(state);
      state.lastUnits = units;
    } else if (decision.winnerProtectionArmed || decision.action === 'PROTECT' || decision.action === 'REDUCE') {
      if (!state.armed) {
        state.armed = true;
        state.armDate = date;
        state.observations = 1;
        state.referenceReturnPct = health.currentReturnPct ?? null;
        state.reductionExecuted = false;
        state.pendingReduction = false;
        state.pendingReductionSignalDate = null;
        audit.armedEpisodes += 1;
      } else {
        state.observations = observations;
      }
    }

    let economicOverrideApplied = false;
    if (decision.action === 'REDUCE') {
      const canonicalStronger = position.action === 'REDUCE'
        || position.action === 'EXIT'
        || position.action === 'REVIEW_TRANSFER'
        || position.action === 'DATA_MISSING';
      if (canonicalStronger) {
        audit.skippedCanonicalStrongerAction += 1;
      } else if (!wholeShareExecutable(decision, units)) {
        audit.wholeShareBlockedReductions += 1;
      } else if (!state.reductionExecuted && !state.pendingReduction) {
        position.action = 'REDUCE';
        position.suggestedReductionPct = 25;
        position.rotationChallengerAssetId = null;
        position.rotationChallengerTicker = null;
        position.rotationAdvantageScore = null;
        position.rotationChallengerRecentStrongCount = null;
        position.rotationChallengerPersistenceLookbackSessions = null;
        position.reason = `[PHASE5_WINNER_PROTECTION_V2:REDUCE] ${decision.reason} Research-only winner branch; reducción congelada 25% una vez por episodio.`;
        // If the canonical path wanted to add to this same incumbent, the Phase 5
        // protection decision replaces that fresh-money leg for this asset only.
        result.contributions = result.contributions.filter(row => !contributionMatchesAsset(evaluationInput, row.assetId, assetId));
        state.pendingReduction = true;
        state.pendingReductionSignalDate = date;
        audit.proposedReductions += 1;
        economicOverrideApplied = true;
      }
    }

    audit.decisions.push({
      decisionDate: date,
      assetId,
      ticker,
      action: decision.action,
      winnerProtectionArmed: decision.winnerProtectionArmed,
      reclaimDetected: decision.reclaimDetected,
      currentReturnPct: health.currentReturnPct ?? null,
      mfePct: health.mfePct ?? null,
      givebackFromMfePctPoints: health.givebackFromMfePctPoints ?? null,
      protectionObservations: state.observations,
      reductionExecutedBeforeDecision: state.reductionExecuted,
      economicOverrideApplied,
      reason: decision.reason
    });
    states.set(assetId, state);
  }

  for (const assetId of [...states.keys()]) {
    if (!active.has(assetId)) states.delete(assetId);
  }
  return result;
}

export function executedPhase5WinnerProtectionSignals(result: { signals: Array<{ executed: boolean; action: string; reason: string }> }): number {
  return result.signals.filter(signal =>
    signal.executed
    && signal.action === 'REDUCE'
    && signal.reason.includes('[PHASE5_WINNER_PROTECTION_V2:REDUCE]')
  ).length;
}
