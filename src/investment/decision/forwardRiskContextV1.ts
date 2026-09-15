export const FORWARD_RISK_CONTEXT_V1 = 'FORWARD_RISK_CONTEXT_V1' as const;

/**
 * Phase 6 preserves the already validated V8 information boundary:
 * V5 vulnerability >= 80 OR V7 options stress >= 80.
 *
 * The continuous context score is the max of the two already-existing scores.
 * This does not fit coefficients, smooth thresholds or create a trading policy.
 */
export const FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT = 80;

export type ForwardRiskContextSourceV1 = 'V5' | 'V7' | 'BOTH' | 'NONE';

export interface ForwardRiskContextV1Result {
  version: typeof FORWARD_RISK_CONTEXT_V1;
  methodology: 'FROZEN_V8_MAX_SCORE_SHADOW_CONTEXT_NO_EXECUTION';
  status: 'AVAILABLE' | 'UNAVAILABLE';
  v5VulnerabilityScorePct: number | null;
  v7OptionsScorePct: number | null;
  contextScorePct: number | null;
  highRiskContext: boolean;
  source: ForwardRiskContextSourceV1;
  authority: 'SHADOW_CONTEXT_ONLY';
  canChangeEligibility: false;
  canChangeRanking: false;
  canChangeSizing: false;
  canSellOrReduce: false;
}

function normalizedScore(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Number(value)));
}

export function resolveForwardRiskContextV1(input: {
  v5VulnerabilityScorePct: number | null | undefined;
  v7OptionsScorePct: number | null | undefined;
}): ForwardRiskContextV1Result {
  const v5 = normalizedScore(input.v5VulnerabilityScorePct);
  const v7 = normalizedScore(input.v7OptionsScorePct);

  // V8 was validated as complementarity of the two information families.
  // Missing one family is therefore unavailable, never a silent one-leg fallback.
  if (v5 == null || v7 == null) {
    return {
      version: FORWARD_RISK_CONTEXT_V1,
      methodology: 'FROZEN_V8_MAX_SCORE_SHADOW_CONTEXT_NO_EXECUTION',
      status: 'UNAVAILABLE',
      v5VulnerabilityScorePct: v5,
      v7OptionsScorePct: v7,
      contextScorePct: null,
      highRiskContext: false,
      source: 'NONE',
      authority: 'SHADOW_CONTEXT_ONLY',
      canChangeEligibility: false,
      canChangeRanking: false,
      canChangeSizing: false,
      canSellOrReduce: false
    };
  }

  const contextScorePct = Math.max(v5, v7);
  const v5High = v5 >= FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT;
  const v7High = v7 >= FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT;
  const source: ForwardRiskContextSourceV1 = v5High && v7High
    ? 'BOTH'
    : v5High
      ? 'V5'
      : v7High
        ? 'V7'
        : 'NONE';

  return {
    version: FORWARD_RISK_CONTEXT_V1,
    methodology: 'FROZEN_V8_MAX_SCORE_SHADOW_CONTEXT_NO_EXECUTION',
    status: 'AVAILABLE',
    v5VulnerabilityScorePct: v5,
    v7OptionsScorePct: v7,
    contextScorePct,
    highRiskContext: contextScorePct >= FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
    source,
    authority: 'SHADOW_CONTEXT_ONLY',
    canChangeEligibility: false,
    canChangeRanking: false,
    canChangeSizing: false,
    canSellOrReduce: false
  };
}
