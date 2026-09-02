import type { StrategyConsensusAssessment, TrendStructureState } from './strategyConsensusEngine';

export type TrendProtectionAction = 'HOLD' | 'WATCH' | 'REDUCE' | 'EXIT';

export interface TrendProtectionContext {
  currentReturnPct: number | null;
  mfePct: number | null;
  givebackFromMfePctPoints: number | null;
  isDiversifiedCore: boolean;
}

export interface TrendProtectionDecision {
  policy: 'TREND_PROTECTION_V1';
  action: TrendProtectionAction;
  suggestedReductionPct: number | null;
  reason: string;
  winnerProtectionArmed: boolean;
  loserFailureArmed: boolean;
  trendState: TrendStructureState;
}

const WINNER_ARM_MFE_PCT = 8;
const WINNER_MIN_GIVEBACK_PP = 6;
const WINNER_STRONG_GIVEBACK_PP = 8;
const SATELLITE_FAILURE_RETURN_PCT = -8;
const CORE_FAILURE_RETURN_PCT = -12;
const SATELLITE_HARD_FAILURE_RETURN_PCT = -15;

function negativeOrZero(value: number | null): boolean {
  return value != null && value <= 0;
}

export function classifyTrendProtectionV1(
  assessment: StrategyConsensusAssessment | null,
  context: TrendProtectionContext
): TrendProtectionDecision {
  const missing: TrendProtectionDecision = {
    policy: 'TREND_PROTECTION_V1',
    action: 'HOLD',
    suggestedReductionPct: null,
    reason: 'Sin diagnóstico causal suficiente para aplicar TREND_PROTECTION_V1.',
    winnerProtectionArmed: false,
    loserFailureArmed: false,
    trendState: 'NEUTRAL'
  };
  if (!assessment) return missing;

  const trend = assessment.trendStructure;
  const currentReturn = context.currentReturnPct;
  const mfe = context.mfePct;
  const giveback = context.givebackFromMfePctPoints;
  const weakening = trend.state === 'WEAKENING_UPTREND' || trend.state === 'BREAKDOWN_RISK' || trend.state === 'DOWNTREND';
  const confirmedBreak = trend.breakdown20 || trend.state === 'BREAKDOWN_RISK' || trend.state === 'DOWNTREND';
  const shortTrendNegative = negativeOrZero(trend.regressionSlope20AnnualizedPct) && negativeOrZero(trend.sma20Slope20AnnualizedPct);

  const winnerProtectionArmed = mfe != null
    && mfe >= WINNER_ARM_MFE_PCT
    && giveback != null
    && giveback >= WINNER_MIN_GIVEBACK_PP
    && weakening
    && shortTrendNegative;

  const failureThreshold = context.isDiversifiedCore ? CORE_FAILURE_RETURN_PCT : SATELLITE_FAILURE_RETURN_PCT;
  const loserFailureArmed = currentReturn != null
    && currentReturn <= failureThreshold
    && confirmedBreak
    && shortTrendNegative
    && (assessment.unfavorableVotes >= 2 || assessment.consensusScore <= -1);

  if (!context.isDiversifiedCore
      && currentReturn != null
      && currentReturn <= SATELLITE_HARD_FAILURE_RETURN_PCT
      && trend.state === 'DOWNTREND'
      && assessment.unfavorableVotes >= 3) {
    return {
      policy: 'TREND_PROTECTION_V1',
      action: 'EXIT',
      suggestedReductionPct: 100,
      reason: `Fallo de tesis satélite: retorno ${currentReturn.toFixed(1)}%, tendencia bajista en 20/60 sesiones y ${assessment.unfavorableVotes} señales adversas.`,
      winnerProtectionArmed,
      loserFailureArmed: true,
      trendState: trend.state
    };
  }

  if (loserFailureArmed) {
    return {
      policy: 'TREND_PROTECTION_V1',
      action: context.isDiversifiedCore ? 'REDUCE' : 'EXIT',
      suggestedReductionPct: context.isDiversifiedCore ? 50 : 100,
      reason: `Protección por tesis fallida: retorno ${currentReturn!.toFixed(1)}% con ruptura confirmada y pendiente corta negativa; no depende de haber alcanzado MFE positivo.`,
      winnerProtectionArmed,
      loserFailureArmed: true,
      trendState: trend.state
    };
  }

  if (winnerProtectionArmed && giveback != null && giveback >= WINNER_STRONG_GIVEBACK_PP && confirmedBreak) {
    const reduction = context.isDiversifiedCore ? 25 : 50;
    return {
      policy: 'TREND_PROTECTION_V1',
      action: 'REDUCE',
      suggestedReductionPct: reduction,
      reason: `Protección de ganador: MFE ${mfe!.toFixed(1)}%, devolución ${giveback.toFixed(1)} pp y ruptura de tendencia corta. Reducir ${reduction}% sin imponer take-profit fijo.`,
      winnerProtectionArmed: true,
      loserFailureArmed,
      trendState: trend.state
    };
  }

  if (winnerProtectionArmed) {
    return {
      policy: 'TREND_PROTECTION_V1',
      action: 'WATCH',
      suggestedReductionPct: null,
      reason: `Ganador en deterioro: MFE ${mfe!.toFixed(1)}%, devolución ${giveback!.toFixed(1)} pp y pendiente corta negativa; vigilar antes de devolver más beneficio.`,
      winnerProtectionArmed: true,
      loserFailureArmed,
      trendState: trend.state
    };
  }

  return {
    policy: 'TREND_PROTECTION_V1',
    action: 'HOLD',
    suggestedReductionPct: null,
    reason: 'TREND_PROTECTION_V1 no detecta ruptura suficiente para proteger beneficio ni tesis fallida.',
    winnerProtectionArmed,
    loserFailureArmed,
    trendState: trend.state
  };
}

export function profitCaptureRatioPct(realizedReturnPct: number | null, mfePct: number | null): number | null {
  if (realizedReturnPct == null || mfePct == null || mfePct <= 0 || realizedReturnPct <= 0) return null;
  return Math.max(0, Math.min(100, realizedReturnPct / mfePct * 100));
}
