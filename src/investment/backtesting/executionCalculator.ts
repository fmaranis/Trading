import { PriceBar, BacktestConfig, IntrabarConflictPolicy } from './types';

export type FillActionType =
  | 'BUY_NEXT_OPEN'
  | 'SELL_NEXT_OPEN'
  | 'BUY_SAME_CLOSE'
  | 'SELL_SAME_CLOSE'
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'TRAILING_STOP'
  | 'END_OF_DATA';

export interface FillCalculationResult {
  action: FillActionType;
  marketPrice: number;
  effectivePrice: number;
  slippagePerShare: number;
  slippageEur: number;
  triggerReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'END_OF_DATA';
}

export interface IntrabarRiskEvaluation {
  triggered: boolean;
  reason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
  marketExecutionPrice: number;
  intrabarConflict: boolean;
  policyUsed: IntrabarConflictPolicy;
}

export class ExecutionCalculator {
  /**
   * Centralized calculation of market execution price and effective fill price after slippage.
   */
  public static calculateFill(
    action: FillActionType,
    baseMarketPrice: number,
    shares: number,
    slippagePct: number
  ): FillCalculationResult {
    const isBuy = action === 'BUY_NEXT_OPEN' || action === 'BUY_SAME_CLOSE';
    const slipRate = slippagePct / 100;
    
    let effectivePrice: number;
    let slippagePerShare: number;

    if (isBuy) {
      // Slippage increases buy price
      slippagePerShare = baseMarketPrice * slipRate;
      effectivePrice = baseMarketPrice + slippagePerShare;
    } else {
      // Slippage reduces sell price
      slippagePerShare = baseMarketPrice * slipRate;
      effectivePrice = Math.max(0.001, baseMarketPrice - slippagePerShare);
    }

    const slippageEur = shares > 0 ? shares * slippagePerShare : 0;

    let triggerReason: FillCalculationResult['triggerReason'] = 'SIGNAL';
    if (action === 'STOP_LOSS') triggerReason = 'STOP_LOSS';
    else if (action === 'TAKE_PROFIT') triggerReason = 'TAKE_PROFIT';
    else if (action === 'TRAILING_STOP') triggerReason = 'TRAILING_STOP';
    else if (action === 'END_OF_DATA') triggerReason = 'END_OF_DATA';

    return {
      action,
      marketPrice: Number(baseMarketPrice.toFixed(4)),
      effectivePrice: Number(effectivePrice.toFixed(4)),
      slippagePerShare: Number(slippagePerShare.toFixed(4)),
      slippageEur: Number(slippageEur.toFixed(4)),
      triggerReason
    };
  }

  /**
   * Evaluates intrabar stop loss, take profit, and trailing stop with gap handling and conflict policy.
   */
  public static evaluateIntrabarRisk(
    bar: PriceBar,
    entryPrice: number,
    highestPriceSoFar: number,
    config: BacktestConfig
  ): IntrabarRiskEvaluation {
    const policy = config.intrabarConflictPolicy || 'CONSERVATIVE';
    
    let slTriggered = false;
    let slPrice = 0;
    let tpTriggered = false;
    let tpPrice = 0;
    let tsTriggered = false;
    let tsPrice = 0;

    // 1. Stop Loss Evaluation
    if (config.stopLossPct && config.stopLossPct > 0) {
      const stopThreshold = entryPrice * (1 - config.stopLossPct / 100);
      if (bar.open <= stopThreshold) {
        // Gap down below stop loss -> Fill at bar open
        slTriggered = true;
        slPrice = bar.open;
      } else if (bar.low <= stopThreshold) {
        // Stop touched during the bar -> Fill at stop threshold
        slTriggered = true;
        slPrice = stopThreshold;
      }
    }

    // 2. Trailing Stop Evaluation (against peak before current bar low)
    if (config.trailingStopPct && config.trailingStopPct > 0 && highestPriceSoFar > 0) {
      const trailingThreshold = highestPriceSoFar * (1 - config.trailingStopPct / 100);
      if (bar.open <= trailingThreshold) {
        // Gap down below trailing stop -> Fill at bar open
        tsTriggered = true;
        tsPrice = bar.open;
      } else if (bar.low <= trailingThreshold) {
        tsTriggered = true;
        tsPrice = trailingThreshold;
      }
    }

    // 3. Take Profit Evaluation
    if (config.takeProfitPct && config.takeProfitPct > 0) {
      const tpThreshold = entryPrice * (1 + config.takeProfitPct / 100);
      if (bar.open >= tpThreshold) {
        // Favorable gap up above take profit -> Fill at bar open
        tpTriggered = true;
        tpPrice = bar.open;
      } else if (bar.high >= tpThreshold) {
        // Take profit reached during bar -> Fill at target threshold
        tpTriggered = true;
        tpPrice = tpThreshold;
      }
    }

    const stopHit = slTriggered || tsTriggered;
    const hasConflict = stopHit && tpTriggered;

    if (!stopHit && !tpTriggered) {
      return {
        triggered: false,
        marketExecutionPrice: 0,
        intrabarConflict: false,
        policyUsed: policy
      };
    }

    // Resolve based on conflict policy
    if (hasConflict) {
      if (policy === 'TAKE_PROFIT_FIRST') {
        return {
          triggered: true,
          reason: 'TAKE_PROFIT',
          marketExecutionPrice: tpPrice,
          intrabarConflict: true,
          policyUsed: policy
        };
      } else {
        // CONSERVATIVE or STOP_FIRST
        const finalReason = slTriggered ? 'STOP_LOSS' : 'TRAILING_STOP';
        const finalPrice = slTriggered ? slPrice : tsPrice;
        return {
          triggered: true,
          reason: finalReason,
          marketExecutionPrice: finalPrice,
          intrabarConflict: true,
          policyUsed: policy
        };
      }
    }

    if (tpTriggered) {
      return {
        triggered: true,
        reason: 'TAKE_PROFIT',
        marketExecutionPrice: tpPrice,
        intrabarConflict: false,
        policyUsed: policy
      };
    }

    if (slTriggered) {
      return {
        triggered: true,
        reason: 'STOP_LOSS',
        marketExecutionPrice: slPrice,
        intrabarConflict: false,
        policyUsed: policy
      };
    }

    return {
      triggered: true,
      reason: 'TRAILING_STOP',
      marketExecutionPrice: tsPrice,
      intrabarConflict: false,
      policyUsed: policy
    };
  }

  /**
   * Independent Buy and Hold benchmark calculation (immune to stops and strategy logic).
   */
  public static calculateBuyAndHoldBenchmark(
    bars: PriceBar[],
    initialCapital: number
  ): { benchmarkReturnPct: number; benchmarkEquityCurve: number[] } {
    if (!bars || bars.length === 0) {
      return { benchmarkReturnPct: 0, benchmarkEquityCurve: [] };
    }

    const initialPrice = bars[0].close;
    const finalPrice = bars[bars.length - 1].close;
    const benchmarkReturnPct = initialPrice > 0 ? ((finalPrice - initialPrice) / initialPrice) * 100 : 0;
    const shares = initialPrice > 0 ? initialCapital / initialPrice : 0;

    const benchmarkEquityCurve = bars.map(b => Number((shares * b.close).toFixed(2)));

    return {
      benchmarkReturnPct: Number(benchmarkReturnPct.toFixed(2)),
      benchmarkEquityCurve
    };
  }
}
