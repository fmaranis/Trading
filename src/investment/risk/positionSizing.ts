import { Asset, Portfolio } from '../../types';
import { PriceBar } from '../backtesting/types';

export interface PositionSizingInput {
  portfolioValuation: number;
  availableCash: number;
  asset: Asset;
  winRatePct: number; // e.g. 55%
  winLossRatio: number; // e.g. 1.8 (Avg Win / Avg Loss)
  targetPortfolioVolPct?: number; // e.g. 10% target annualized vol
  maxSinglePositionPct?: number; // Default 35% guard
  riskPerTradePct?: number; // e.g. 1% or 2% max risk of total capital
  stopLossDistancePct?: number; // e.g. 3.5%
}

export interface PositionSizingResult {
  method: 'FRACTIONAL_KELLY' | 'VOLATILITY_TARGETING' | 'FIXED_RISK_PERCENT' | 'CONSERVATIVE_CNMV';
  recommendedAmountEur: number;
  recommendedWeightPct: number;
  leverageFactor: number; // usually 1.0 (no margin)
  rationale: string;
  riskMetrics: {
    maxLossEurAtStop: number;
    portfolioLossImpactPct: number;
    kellyFullFractionPct: number;
    appliedKellyFractionPct: number;
  };
}

export class PositionSizingEngine {
  public static readonly DEFAULT_MAX_POSITION_PCT = 35.0; // Max 35% concentration limit
  public static readonly DEFAULT_RISK_PER_TRADE_PCT = 1.5; // Max 1.5% capital risked per trade

  /**
   * Method 1: Fractional Kelly Criterion (Half-Kelly / Quarter-Kelly)
   * Formula: K% = W - (1 - W) / R, scaled by fraction (e.g. 0.25 for conservative Quarter-Kelly)
   */
  public static calculateKellySizing(input: PositionSizingInput, kellyFraction: number = 0.35): PositionSizingResult {
    const W = Math.max(0.01, Math.min(0.99, input.winRatePct / 100));
    const R = Math.max(0.1, input.winLossRatio);

    // Full Kelly fraction
    const fullKelly = W - ((1 - W) / R);
    const safeFullKelly = Math.max(0, fullKelly);
    const appliedKelly = safeFullKelly * kellyFraction;

    const maxAllowedWeight = (input.maxSinglePositionPct || this.DEFAULT_MAX_POSITION_PCT) / 100;
    const finalWeight = Math.min(appliedKelly, maxAllowedWeight);

    const recommendedAmount = Math.min(
      input.portfolioValuation * finalWeight,
      input.availableCash
    );

    const stopDistance = (input.stopLossDistancePct || 3.5) / 100;
    const maxLossEur = recommendedAmount * stopDistance;
    const portfolioLossPct = input.portfolioValuation > 0 ? (maxLossEur / input.portfolioValuation) * 100 : 0;

    return {
      method: 'FRACTIONAL_KELLY',
      recommendedAmountEur: Number(Math.max(0, recommendedAmount).toFixed(2)),
      recommendedWeightPct: Number((finalWeight * 100).toFixed(1)),
      leverageFactor: 1.0,
      rationale: `Quarter-Kelly (${(kellyFraction * 100).toFixed(0)}% de f* Kelly). Edge estadístico con WinRate ${input.winRatePct}% y Payoff ${R.toFixed(2)}.`,
      riskMetrics: {
        maxLossEurAtStop: Number(maxLossEur.toFixed(2)),
        portfolioLossImpactPct: Number(portfolioLossPct.toFixed(2)),
        kellyFullFractionPct: Number((safeFullKelly * 100).toFixed(1)),
        appliedKellyFractionPct: Number((appliedKelly * 100).toFixed(1))
      }
    };
  }

  /**
   * Method 2: Volatility Targeting (FinRL / Risk Parity Style)
   * Formula: Weight = TargetVol / AssetVol
   */
  public static calculateVolatilityTargetSizing(
    input: PositionSizingInput,
    targetAnnualVolPct: number = 10.0
  ): PositionSizingResult {
    const assetVol = Math.max(0.5, input.asset.volatilityAnnual);
    const rawWeight = targetAnnualVolPct / assetVol;

    const maxAllowedWeight = (input.maxSinglePositionPct || this.DEFAULT_MAX_POSITION_PCT) / 100;
    const finalWeight = Math.min(rawWeight, maxAllowedWeight);

    const recommendedAmount = Math.min(
      input.portfolioValuation * finalWeight,
      input.availableCash
    );

    const stopDistance = (input.stopLossDistancePct || (assetVol * 0.15)) / 100;
    const maxLossEur = recommendedAmount * stopDistance;
    const portfolioLossPct = input.portfolioValuation > 0 ? (maxLossEur / input.portfolioValuation) * 100 : 0;

    return {
      method: 'VOLATILITY_TARGETING',
      recommendedAmountEur: Number(Math.max(0, recommendedAmount).toFixed(2)),
      recommendedWeightPct: Number((finalWeight * 100).toFixed(1)),
      leverageFactor: 1.0,
      rationale: `Objetivo de Volatilidad Anual del ${targetAnnualVolPct}% (Vol del activo: ${assetVol}%). Reduce tamaño automáticamente en activos volátiles.`,
      riskMetrics: {
        maxLossEurAtStop: Number(maxLossEur.toFixed(2)),
        portfolioLossImpactPct: Number(portfolioLossPct.toFixed(2)),
        kellyFullFractionPct: 0,
        appliedKellyFractionPct: 0
      }
    };
  }

  /**
   * Method 3: Fixed Capital at Risk (2% Rule)
   * Formula: Position Size = (Total Capital * Risk%) / Stop Loss %
   */
  public static calculateFixedRiskSizing(
    input: PositionSizingInput,
    riskPctOfCapital: number = 1.5,
    stopLossDistancePct: number = 3.5
  ): PositionSizingResult {
    const maxRiskEur = input.portfolioValuation * (riskPctOfCapital / 100);
    const stopDistanceDecimal = Math.max(0.005, stopLossDistancePct / 100);

    const calculatedSizeEur = maxRiskEur / stopDistanceDecimal;
    const maxAllowedEur = input.portfolioValuation * ((input.maxSinglePositionPct || this.DEFAULT_MAX_POSITION_PCT) / 100);

    const finalAmount = Math.min(calculatedSizeEur, maxAllowedEur, input.availableCash);
    const finalWeightPct = input.portfolioValuation > 0 ? (finalAmount / input.portfolioValuation) * 100 : 0;

    return {
      method: 'FIXED_RISK_PERCENT',
      recommendedAmountEur: Number(Math.max(0, finalAmount).toFixed(2)),
      recommendedWeightPct: Number(finalWeightPct.toFixed(1)),
      leverageFactor: 1.0,
      rationale: `Regla de Riesgo Fijo del ${riskPctOfCapital}%: Si salta el Stop Loss (-${stopLossDistancePct}%), la pérdida máxima es de exactamente ${maxRiskEur.toFixed(2)} €.`,
      riskMetrics: {
        maxLossEurAtStop: Number(maxRiskEur.toFixed(2)),
        portfolioLossImpactPct: riskPctOfCapital,
        kellyFullFractionPct: 0,
        appliedKellyFractionPct: 0
      }
    };
  }
}
