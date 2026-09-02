import type { StrategyConsensusAssessment } from './strategyConsensusEngine';
import {
  classifyTrendProtectionV2,
  type TrendProtectionContext,
  type TrendProtectionV2Decision
} from './trendProtectionPolicy';

/**
 * Experimental wrapper around TREND_PROTECTION_V2.
 *
 * It never changes loser-failure or hard-exit behavior. It only intercepts a
 * winner-protection REDUCE when the medium-term trend and consensus are still
 * constructive, keeping the position in PROTECT instead of selling 25%.
 *
 * This is causal: every input comes from the assessment available at the
 * decision date. No ex-post outcome-audit data is used here.
 */
export function classifyTrendProtectionV2WithMediumTermWinnerConfirm(
  assessment: StrategyConsensusAssessment | null,
  context: TrendProtectionContext
): TrendProtectionV2Decision {
  const base = classifyTrendProtectionV2(assessment, context);
  if (!assessment) return base;
  if (base.action !== 'REDUCE' || !base.winnerProtectionArmed || base.loserFailureArmed) return base;

  const slope60 = assessment.trendStructure.regressionSlope60AnnualizedPct;
  const mediumTermDeteriorated = slope60 != null && Number.isFinite(slope60) && slope60 <= 0;
  const consensusDeteriorated = assessment.consensusScore <= 0 || assessment.unfavorableVotes >= 2;

  if (mediumTermDeteriorated || consensusDeteriorated) return base;

  return {
    ...base,
    action: 'PROTECT',
    suggestedReductionPct: null,
    confirmationStage: 'ARMED',
    reason: `${base.reason} [MEDIUM_TERM_WINNER_CONFIRM] Se bloquea temporalmente REDUCE: la pendiente 60d sigue positiva (${slope60 == null ? 'N/D' : `${slope60.toFixed(1)}% anualizada`}) y el consenso sigue constructivo (${assessment.consensusScore}, ${assessment.unfavorableVotes} votos adversos). Mantener PROTECT hasta deterioro de horizonte medio/consenso o reclaim.`
  };
}
