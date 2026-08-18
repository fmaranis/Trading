import { PriceBar, BacktestConfig, BacktestResult, BacktestTrade, EquityPoint, Signal } from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { FinancialMetricsCalculator } from './metrics';
import { DataProvenance } from '../data/types';

export class BacktestEngine {
  public static readonly DEFAULT_CONFIG: BacktestConfig = {
    initialCapital: 100.0,
    commissionPct: 0.05, // 0.05%
    slippagePct: 0.02, // 0.02%
    riskFreeRateAnnualPct: 3.0,
    positionSizingPct: 100.0, // 100% of available cash per entry
    trailingStopPct: 3.5,
    stopLossPct: 4.0
  };

  /**
   * Executes a vectorized backtest simulation on historical price bars.
   * Ensures STRICT compliance:
   * 1. No look-ahead bias (orders executed on bar close or next open).
   * 2. Commissions & realistic slippage deducted on both entry and exit.
   * 3. Exact capital and share tracking with zero NaNs.
   */
  public static runBacktest(
    strategy: IStrategy,
    bars: PriceBar[],
    assetTicker: string = 'ASSET',
    assetName: string = 'Activo de Inversión',
    customConfig: Partial<BacktestConfig> = {},
    strategyParams?: Record<string, any>,
    dataProvenance?: DataProvenance
  ): BacktestResult {
    const config: BacktestConfig = { ...this.DEFAULT_CONFIG, ...customConfig };

    if (!bars || bars.length < 2) {
      throw new Error('El motor de backtest requiere al menos 2 barras de precios cronológicas.');
    }

    // Sort bars to guarantee time monotonicity
    const sortedBars = [...bars].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 1. Generate Signals from Strategy
    const signals: Signal[] = strategy.generateSignals(sortedBars, strategyParams);

    // 2. Simulation State
    let cash = config.initialCapital;
    let shares = 0;
    let entryPrice = 0;
    let entryBarIndex = 0;
    let entryDate = '';
    let highestPriceDuringTrade = 0;
    let inPosition = false;

    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    // Calculate benchmark (Buy & Hold from bar 0 to N)
    const initialPrice = sortedBars[0].close;
    const finalPrice = sortedBars[sortedBars.length - 1].close;
    const benchmarkReturnPct = initialPrice > 0 ? ((finalPrice - initialPrice) / initialPrice) * 100 : 0;
    const benchmarkShares = config.initialCapital / initialPrice;

    // 3. Main Backtesting Execution Loop
    for (let i = 0; i < sortedBars.length; i++) {
      const currentBar = sortedBars[i];
      const signal = signals[i] || { type: 'HOLD', price: currentBar.close, timestamp: currentBar.timestamp, reason: '' };

      const currentPrice = currentBar.close;
      let exitReason: BacktestTrade['exitReason'] | null = null;

      // In Position: Check Dynamic Risk Exits (Trailing Stop / Stop Loss)
      if (inPosition) {
        if (currentPrice > highestPriceDuringTrade) {
          highestPriceDuringTrade = currentPrice;
        }

        const dropFromPeakPct = ((highestPriceDuringTrade - currentPrice) / highestPriceDuringTrade) * 100;
        const lossFromEntryPct = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Dynamic Trailing Stop
        if (config.trailingStopPct && dropFromPeakPct >= config.trailingStopPct) {
          exitReason = 'TRAILING_STOP';
        } else if (config.stopLossPct && lossFromEntryPct <= -config.stopLossPct) {
          exitReason = 'STOP_LOSS';
        } else if (config.takeProfitPct && lossFromEntryPct >= config.takeProfitPct) {
          exitReason = 'TAKE_PROFIT';
        } else if (signal.type === 'SELL') {
          exitReason = 'SIGNAL';
        }
      }

      // Check End of Data forced liquidation
      if (inPosition && i === sortedBars.length - 1 && !exitReason) {
        exitReason = 'END_OF_DATA';
      }

      // EXECUTE EXIT
      if (inPosition && exitReason) {
        // Slippage & Commission on exit
        const exitSlippage = currentPrice * (config.slippagePct / 100);
        const effectiveExitPrice = Math.max(0.001, currentPrice - exitSlippage);
        const grossExitAmount = shares * effectiveExitPrice;
        const exitCommission = grossExitAmount * (config.commissionPct / 100);
        const netExitAmount = grossExitAmount - exitCommission;

        const totalInvested = shares * entryPrice;
        const pnlEur = netExitAmount - totalInvested;
        const pnlPct = totalInvested > 0 ? (pnlEur / totalInvested) * 100 : 0;

        cash += netExitAmount;

        trades.push({
          id: `trade-${trades.length + 1}`,
          entryDate,
          exitDate: currentBar.timestamp,
          entryPrice: Number(entryPrice.toFixed(3)),
          exitPrice: Number(effectiveExitPrice.toFixed(3)),
          shares: Number(shares.toFixed(4)),
          amountInvested: Number(totalInvested.toFixed(2)),
          pnlEur: Number(pnlEur.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
          returnFactor: Number((effectiveExitPrice / entryPrice).toFixed(3)),
          commissionPaid: Number(exitCommission.toFixed(3)),
          slippagePaid: Number((shares * exitSlippage).toFixed(3)),
          exitReason,
          holdingPeriodBars: i - entryBarIndex,
          isWin: pnlEur > 0
        });

        // Reset position
        inPosition = false;
        shares = 0;
        entryPrice = 0;
        highestPriceDuringTrade = 0;
      }

      // EXECUTE ENTRY (if not in position and BUY signal triggered)
      if (!inPosition && signal.type === 'BUY' && cash >= 1.0 && i < sortedBars.length - 1) {
        const capitalToAllocate = cash * (config.positionSizingPct / 100);
        const entrySlippage = currentPrice * (config.slippagePct / 100);
        const effectiveEntryPrice = currentPrice + entrySlippage;
        const entryCommission = capitalToAllocate * (config.commissionPct / 100);
        const netCapitalForShares = capitalToAllocate - entryCommission;

        if (netCapitalForShares > 0) {
          shares = netCapitalForShares / effectiveEntryPrice;
          entryPrice = effectiveEntryPrice;
          entryBarIndex = i;
          entryDate = currentBar.timestamp;
          highestPriceDuringTrade = effectiveEntryPrice;
          inPosition = true;
          cash -= capitalToAllocate;
        }
      }

      // Mark current equity point
      const currentPositionVal = inPosition ? shares * currentPrice : 0;
      const totalEquity = cash + currentPositionVal;
      const benchmarkCurrentEquity = benchmarkShares * currentPrice;

      equityCurve.push({
        timestamp: currentBar.timestamp,
        equity: Number(totalEquity.toFixed(2)),
        cash: Number(cash.toFixed(2)),
        drawdownPct: 0, // Calculated in metrics engine
        benchmarkEquity: Number(benchmarkCurrentEquity.toFixed(2))
      });
    }

    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || config.initialCapital;

    // 4. Calculate Complete Statistical Metrics
    const metrics = FinancialMetricsCalculator.calculateMetrics(
      config.initialCapital,
      finalEquity,
      equityCurve,
      trades,
      benchmarkReturnPct,
      config.riskFreeRateAnnualPct
    );

    // Update drawdown on equity curve points
    let peak = config.initialCapital;
    for (const pt of equityCurve) {
      if (pt.equity > peak) peak = pt.equity;
      pt.drawdownPct = peak > 0 ? Number((((peak - pt.equity) / peak) * 100).toFixed(2)) : 0;
    }

    const resolvedProvenance: DataProvenance = dataProvenance ?? {
      sourceType: 'STATIC_REFERENCE',
      provider: 'Legacy/Internal Dataset',
      isReproducible: true,
      notes: 'Procedencia heredada pendiente de migración'
    };

    return {
      strategyName: strategy.name,
      strategyDescription: strategy.description,
      assetTicker,
      assetName,
      config,
      metrics,
      equityCurve,
      trades,
      signals,
      dataProvenance: resolvedProvenance
    };
  }
}
