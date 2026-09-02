import type { StrategyConsensusAssessment, TrendStructureState } from './strategyConsensusEngine';

export type TrendProtectionAction = 'HOLD' | 'WATCH' | 'REDUCE' | 'EXIT';
export type TrendProtectionV2Action = 'HOLD' | 'WATCH' | 'PROTECT' | 'REDUCE' | 'EXIT';
export type TrendProtectionV2Stage = 'NONE' | 'ARMED' | 'CONFIRMED' | 'PERSISTENT';

export interface TrendProtectionContext {
  currentReturnPct: number | null;
  mfePct: number | null;
  givebackFromMfePctPoints: number | null;
  isDiversifiedCore: boolean;
  deteriorationStreakSessions?: number | null;
  momentum20Pct?: number | null;
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

export interface TrendProtectionV2Decision {
  policy: 'TREND_PROTECTION_V2';
  action: TrendProtectionV2Action;
  suggestedReductionPct: number | null;
  reason: string;
  winnerProtectionArmed: boolean;
  loserFailureArmed: boolean;
  confirmationStage: TrendProtectionV2Stage;
  reclaimDetected: boolean;
  trendState: TrendStructureState;
}

const WINNER_ARM_MFE_PCT = 8;
const WINNER_MIN_GIVEBACK_PP = 6;
const WINNER_STRONG_GIVEBACK_PP = 8;
const SATELLITE_FAILURE_RETURN_PCT = -8;
const CORE_FAILURE_RETURN_PCT = -12;
const SATELLITE_HARD_FAILURE_RETURN_PCT = -15;

// V2 deliberately keeps the same basic economic hypotheses as V1 but separates
// detection from execution. A first break arms protection; persistence is required
// before reduction and a much stronger persistent failure is required before EXIT.
const V2_WINNER_CONFIRM_STREAK = 3;
const V2_LOSER_CONFIRM_STREAK = 5;
const V2_HARD_EXIT_STREAK = 10;
const V2_SATELLITE_HARD_EXIT_RETURN_PCT = -18;
const V2_PARTIAL_REDUCTION_PCT = 25;

function negativeOrZero(value: number | null): boolean {
  return value != null && value <= 0;
}

function positive(value: number | null): boolean {
  return value != null && value > 0;
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

export function classifyTrendProtectionV2(
  assessment: StrategyConsensusAssessment | null,
  context: TrendProtectionContext
): TrendProtectionV2Decision {
  const missing: TrendProtectionV2Decision = {
    policy: 'TREND_PROTECTION_V2',
    action: 'HOLD',
    suggestedReductionPct: null,
    reason: 'Sin diagnóstico causal suficiente para aplicar TREND_PROTECTION_V2.',
    winnerProtectionArmed: false,
    loserFailureArmed: false,
    confirmationStage: 'NONE',
    reclaimDetected: false,
    trendState: 'NEUTRAL'
  };
  if (!assessment) return missing;

  const trend = assessment.trendStructure;
  const currentReturn = context.currentReturnPct;
  const mfe = context.mfePct;
  const giveback = context.givebackFromMfePctPoints;
  const streak = Math.max(0, context.deteriorationStreakSessions ?? 0);
  const weakening = trend.state === 'WEAKENING_UPTREND' || trend.state === 'BREAKDOWN_RISK' || trend.state === 'DOWNTREND';
  const confirmedBreak = trend.breakdown20 || trend.state === 'BREAKDOWN_RISK' || trend.state === 'DOWNTREND';
  const shortTrendNegative = negativeOrZero(trend.regressionSlope20AnnualizedPct) && negativeOrZero(trend.sma20Slope20AnnualizedPct);
  const reclaimDetected = !trend.breakdown20
    && trend.state === 'HEALTHY_UPTREND'
    && positive(trend.regressionSlope20AnnualizedPct)
    && positive(trend.sma20Slope20AnnualizedPct);

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
    && assessment.unfavorableVotes >= 2
    && assessment.consensusScore <= -1;

  if (reclaimDetected) {
    return {
      policy: 'TREND_PROTECTION_V2',
      action: 'HOLD',
      suggestedReductionPct: null,
      reason: 'Reclaim de tendencia corta confirmado: pendiente 20d y SMA20 vuelven a positivo sin breakdown20. Se desarma la protección para evitar vender una recuperación.',
      winnerProtectionArmed: false,
      loserFailureArmed: false,
      confirmationStage: 'NONE',
      reclaimDetected: true,
      trendState: trend.state
    };
  }

  if (!context.isDiversifiedCore
      && currentReturn != null
      && currentReturn <= V2_SATELLITE_HARD_EXIT_RETURN_PCT
      && trend.state === 'DOWNTREND'
      && streak >= V2_HARD_EXIT_STREAK
      && assessment.unfavorableVotes >= 4
      && assessment.consensusScore <= -3) {
    return {
      policy: 'TREND_PROTECTION_V2',
      action: 'EXIT',
      suggestedReductionPct: 100,
      reason: `Fallo satélite persistente confirmado: retorno ${currentReturn.toFixed(1)}%, ${streak} sesiones de deterioro, downtrend y consenso ${assessment.consensusScore}. EXIT queda reservado para deterioro profundo y sostenido.`,
      winnerProtectionArmed,
      loserFailureArmed: true,
      confirmationStage: 'PERSISTENT',
      reclaimDetected: false,
      trendState: trend.state
    };
  }

  if (loserFailureArmed) {
    if (streak >= V2_LOSER_CONFIRM_STREAK) {
      return {
        policy: 'TREND_PROTECTION_V2',
        action: 'REDUCE',
        suggestedReductionPct: V2_PARTIAL_REDUCTION_PCT,
        reason: `Tesis fallida confirmada pero no terminal: retorno ${currentReturn!.toFixed(1)}%, ruptura corta y ${streak} sesiones de deterioro. Reducir ${V2_PARTIAL_REDUCTION_PCT}% y exigir nueva confirmación antes de una salida mayor.`,
        winnerProtectionArmed,
        loserFailureArmed: true,
        confirmationStage: streak >= V2_HARD_EXIT_STREAK ? 'PERSISTENT' : 'CONFIRMED',
        reclaimDetected: false,
        trendState: trend.state
      };
    }
    return {
      policy: 'TREND_PROTECTION_V2',
      action: 'PROTECT',
      suggestedReductionPct: null,
      reason: `Tesis fallida armada en ${currentReturn!.toFixed(1)}% con ruptura corta, pero sólo ${streak} sesiones de deterioro. No cristalizar la pérdida todavía; exigir persistencia o permitir reclaim.`,
      winnerProtectionArmed,
      loserFailureArmed: true,
      confirmationStage: 'ARMED',
      reclaimDetected: false,
      trendState: trend.state
    };
  }

  if (winnerProtectionArmed) {
    if (confirmedBreak && giveback != null && giveback >= WINNER_STRONG_GIVEBACK_PP) {
      if (streak >= V2_WINNER_CONFIRM_STREAK) {
        return {
          policy: 'TREND_PROTECTION_V2',
          action: 'REDUCE',
          suggestedReductionPct: V2_PARTIAL_REDUCTION_PCT,
          reason: `Protección de beneficio confirmada: MFE ${mfe!.toFixed(1)}%, devolución ${giveback.toFixed(1)} pp, ruptura y ${streak} sesiones de deterioro. Reducir sólo ${V2_PARTIAL_REDUCTION_PCT}% para conservar participación si la tendencia se recupera.`,
          winnerProtectionArmed: true,
          loserFailureArmed,
          confirmationStage: streak >= V2_HARD_EXIT_STREAK ? 'PERSISTENT' : 'CONFIRMED',
          reclaimDetected: false,
          trendState: trend.state
        };
      }
      return {
        policy: 'TREND_PROTECTION_V2',
        action: 'PROTECT',
        suggestedReductionPct: null,
        reason: `Ganador con ruptura reciente: MFE ${mfe!.toFixed(1)}% y devolución ${giveback.toFixed(1)} pp, pero la debilidad aún no persiste ${V2_WINNER_CONFIRM_STREAK} sesiones. Armar protección sin vender todavía.`,
        winnerProtectionArmed: true,
        loserFailureArmed,
        confirmationStage: 'ARMED',
        reclaimDetected: false,
        trendState: trend.state
      };
    }
    return {
      policy: 'TREND_PROTECTION_V2',
      action: 'WATCH',
      suggestedReductionPct: null,
      reason: `Ganador debilitándose: MFE ${mfe!.toFixed(1)}%, devolución ${giveback!.toFixed(1)} pp y pendiente corta negativa, pero sin ruptura/persistencia suficiente.`,
      winnerProtectionArmed: true,
      loserFailureArmed,
      confirmationStage: 'ARMED',
      reclaimDetected: false,
      trendState: trend.state
    };
  }

  return {
    policy: 'TREND_PROTECTION_V2',
    action: 'HOLD',
    suggestedReductionPct: null,
    reason: 'TREND_PROTECTION_V2 no detecta deterioro suficiente para armar protección.',
    winnerProtectionArmed,
    loserFailureArmed,
    confirmationStage: 'NONE',
    reclaimDetected: false,
    trendState: trend.state
  };
}

export function profitCaptureRatioPct(realizedReturnPct: number | null, mfePct: number | null): number | null {
  if (realizedReturnPct == null || mfePct == null || mfePct <= 0 || realizedReturnPct <= 0) return null;
  return Math.max(0, Math.min(100, realizedReturnPct / mfePct * 100));
}
