import { PriceBar, BacktestConfig, BacktestResult, BacktestTrade, EquityPoint, Signal, PendingOrder, ExecutionMode } from './types';
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
    stopLossPct: 4.0,
    executionMode: 'NEXT_OPEN' // Default strict anti-lookahead
  };

  /**
   * Executes an auditable, strictly non-anticipative backtest simulation on historical price bars.
   * Execution Modes:
   * - NEXT_OPEN (Default): Signal at Bar t Close → Pending Order → Execution at Bar t+1 Open.
   * - SAME_CLOSE (Experimental/Legacy): Execution at Bar t Close.
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

    // 1. Generate Signals from Strategy (only uses historical data up to each index)
    const signals: Signal[] = strategy.generateSignals(sortedBars, strategyParams);

    // 2. Simulation & Accounting State
    let cash = config.initialCapital;
    let shares = 0;
    let inPosition = false;
    let pendingOrder: PendingOrder | null = null;

    let entryPrice = 0;
    let entryBarIndex = 0;
    let entryDate = '';
    let signalDate = '';
    let signalPrice = 0;
    let entryCommissionPaid = 0;
    let entrySlippagePaid = 0;
    let highestPriceDuringTrade = 0;

    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    // Benchmark calculation (Buy & Hold from bar 0 to N)
    const initialPrice = sortedBars[0].close;
    const finalPrice = sortedBars[sortedBars.length - 1].close;
    const benchmarkReturnPct = initialPrice > 0 ? ((finalPrice - initialPrice) / initialPrice) * 100 : 0;
    const benchmarkShares = config.initialCapital / initialPrice;

    // 3. Execution Loop across every chronological bar
    for (let i = 0; i < sortedBars.length; i++) {
      const currentBar = sortedBars[i];

      // ─── STEP A: Execute Pending Orders at Bar Open (NEXT_OPEN mode) ───
      if (config.executionMode === 'NEXT_OPEN' && pendingOrder) {
        if (pendingOrder.type === 'BUY' && !inPosition && cash >= 1.0) {
          const execPrice = currentBar.open;
          const entrySlippage = execPrice * (config.slippagePct / 100);
          const effectiveEntryPrice = execPrice + entrySlippage;
          const capitalToAllocate = cash * (config.positionSizingPct / 100);
          const entryCommission = capitalToAllocate * (config.commissionPct / 100);
          const netCapitalForShares = capitalToAllocate - entryCommission;

          if (netCapitalForShares > 0) {
            shares = netCapitalForShares / effectiveEntryPrice;
            entryPrice = effectiveEntryPrice;
            entryDate = currentBar.timestamp;
            signalDate = pendingOrder.signalTimestamp;
            signalPrice = pendingOrder.signalPrice;
            entryCommissionPaid = entryCommission;
            entrySlippagePaid = shares * entrySlippage;
            entryBarIndex = i;
            highestPriceDuringTrade = effectiveEntryPrice;
            inPosition = true;
            cash -= capitalToAllocate;
          }
          pendingOrder = null;
        } else if (pendingOrder.type === 'SELL' && inPosition) {
          const execPrice = currentBar.open;
          const exitSlippage = execPrice * (config.slippagePct / 100);
          const effectiveExitPrice = Math.max(0.001, execPrice - exitSlippage);
          const grossExitAmount = shares * effectiveExitPrice;
          const exitCommission = grossExitAmount * (config.commissionPct / 100);
          const netExitAmount = grossExitAmount - exitCommission;

          const totalInvested = shares * entryPrice;
          const pnlEur = netExitAmount - totalInvested;
          const pnlPct = totalInvested > 0 ? (pnlEur / totalInvested) * 100 : 0;

          cash += netExitAmount;

          trades.push({
            id: `trade-${trades.length + 1}`,
            signalDate,
            entryDate,
            signalPrice: Number(signalPrice.toFixed(3)),
            entryPrice: Number(entryPrice.toFixed(3)),
            exitSignalDate: pendingOrder.signalTimestamp,
            exitDate: currentBar.timestamp,
            exitSignalPrice: Number(pendingOrder.signalPrice.toFixed(3)),
            exitPrice: Number(effectiveExitPrice.toFixed(3)),
            shares: Number(shares.toFixed(4)),
            amountInvested: Number(totalInvested.toFixed(2)),
            pnlEur: Number(pnlEur.toFixed(2)),
            pnlPct: Number(pnlPct.toFixed(2)),
            returnFactor: Number((effectiveExitPrice / entryPrice).toFixed(3)),
            commissionPaid: Number((entryCommissionPaid + exitCommission).toFixed(3)),
            slippagePaid: Number((entrySlippagePaid + shares * exitSlippage).toFixed(3)),
            exitReason: pendingOrder.triggerReason || 'SIGNAL',
            holdingPeriodBars: i - entryBarIndex,
            isWin: pnlEur > 0
          });

          inPosition = false;
          shares = 0;
          entryPrice = 0;
          highestPriceDuringTrade = 0;
          pendingOrder = null;
        }
      }

      // ─── STEP B: Intra-Bar Price Tracking & Risk Thresholds ───
      let riskExitReason: BacktestTrade['exitReason'] | null = null;
      if (inPosition) {
        if (currentBar.high > highestPriceDuringTrade) {
          highestPriceDuringTrade = currentBar.high;
        }

        const dropFromPeakPct = ((highestPriceDuringTrade - currentBar.low) / highestPriceDuringTrade) * 100;
        const lossFromEntryPct = ((currentBar.low - entryPrice) / entryPrice) * 100;
        const gainFromEntryPct = ((currentBar.high - entryPrice) / entryPrice) * 100;

        if (config.trailingStopPct && dropFromPeakPct >= config.trailingStopPct) {
          riskExitReason = 'TRAILING_STOP';
        } else if (config.stopLossPct && lossFromEntryPct <= -config.stopLossPct) {
          riskExitReason = 'STOP_LOSS';
        } else if (config.takeProfitPct && gainFromEntryPct >= config.takeProfitPct) {
          riskExitReason = 'TAKE_PROFIT';
        }

        // If risk stop triggered during the bar
        if (riskExitReason) {
          if (config.executionMode === 'SAME_CLOSE') {
            // Immediate same-bar close execution
            const currentPrice = currentBar.close;
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
              signalDate: entryDate,
              entryDate,
              signalPrice: Number(entryPrice.toFixed(3)),
              entryPrice: Number(entryPrice.toFixed(3)),
              exitSignalDate: currentBar.timestamp,
              exitDate: currentBar.timestamp,
              exitSignalPrice: Number(currentPrice.toFixed(3)),
              exitPrice: Number(effectiveExitPrice.toFixed(3)),
              shares: Number(shares.toFixed(4)),
              amountInvested: Number(totalInvested.toFixed(2)),
              pnlEur: Number(pnlEur.toFixed(2)),
              pnlPct: Number(pnlPct.toFixed(2)),
              returnFactor: Number((effectiveExitPrice / entryPrice).toFixed(3)),
              commissionPaid: Number((entryCommissionPaid + exitCommission).toFixed(3)),
              slippagePaid: Number((entrySlippagePaid + shares * exitSlippage).toFixed(3)),
              exitReason: riskExitReason,
              holdingPeriodBars: i - entryBarIndex,
              isWin: pnlEur > 0
            });

            inPosition = false;
            shares = 0;
            entryPrice = 0;
            highestPriceDuringTrade = 0;
          } else {
            // Queue pending SELL order for next open
            pendingOrder = {
              type: 'SELL',
              signalTimestamp: currentBar.timestamp,
              signalPrice: currentBar.close,
              triggerReason: riskExitReason,
              reason: `Risk trigger: ${riskExitReason}`
            };
          }
        }
      }

      // ─── STEP C: End-of-Data Liquidation (Last Bar) ───
      if (inPosition && i === sortedBars.length - 1 && !riskExitReason) {
        const currentPrice = currentBar.close;
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
          signalDate: signalDate || entryDate,
          entryDate,
          signalPrice: Number(signalPrice.toFixed(3)),
          entryPrice: Number(entryPrice.toFixed(3)),
          exitSignalDate: currentBar.timestamp,
          exitDate: currentBar.timestamp,
          exitSignalPrice: Number(currentPrice.toFixed(3)),
          exitPrice: Number(effectiveExitPrice.toFixed(3)),
          shares: Number(shares.toFixed(4)),
          amountInvested: Number(totalInvested.toFixed(2)),
          pnlEur: Number(pnlEur.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
          returnFactor: Number((effectiveExitPrice / entryPrice).toFixed(3)),
          commissionPaid: Number((entryCommissionPaid + exitCommission).toFixed(3)),
          slippagePaid: Number((entrySlippagePaid + shares * exitSlippage).toFixed(3)),
          exitReason: 'END_OF_DATA',
          holdingPeriodBars: i - entryBarIndex,
          isWin: pnlEur > 0
        });

        inPosition = false;
        shares = 0;
        entryPrice = 0;
      }

      // ─── STEP D: Bar Close Accounting & Equity Curve ───
      const currentPositionVal = inPosition ? shares * currentBar.close : 0;
      const totalEquity = cash + currentPositionVal;
      const benchmarkCurrentEquity = benchmarkShares * currentBar.close;

      equityCurve.push({
        timestamp: currentBar.timestamp,
        equity: Number(totalEquity.toFixed(2)),
        cash: Number(cash.toFixed(2)),
        drawdownPct: 0,
        benchmarkEquity: Number(benchmarkCurrentEquity.toFixed(2))
      });

      // ─── STEP E: Strategy Signal Evaluation at Bar Close ───
      const signal = signals[i] || { type: 'HOLD', price: currentBar.close, timestamp: currentBar.timestamp, reason: '' };

      if (!pendingOrder && i < sortedBars.length - 1) {
        if (!inPosition && signal.type === 'BUY' && cash >= 1.0) {
          if (config.executionMode === 'NEXT_OPEN') {
            pendingOrder = {
              type: 'BUY',
              signalTimestamp: currentBar.timestamp,
              signalPrice: currentBar.close,
              triggerReason: 'SIGNAL',
              reason: signal.reason
            };
          } else {
            // SAME_CLOSE immediate execution
            const currentPrice = currentBar.close;
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
              signalDate = currentBar.timestamp;
              signalPrice = currentPrice;
              entryCommissionPaid = entryCommission;
              entrySlippagePaid = shares * entrySlippage;
              highestPriceDuringTrade = effectiveEntryPrice;
              inPosition = true;
              cash -= capitalToAllocate;
            }
          }
        } else if (inPosition && signal.type === 'SELL') {
          if (config.executionMode === 'NEXT_OPEN') {
            pendingOrder = {
              type: 'SELL',
              signalTimestamp: currentBar.timestamp,
              signalPrice: currentBar.close,
              triggerReason: 'SIGNAL',
              reason: signal.reason
            };
          } else {
            // SAME_CLOSE immediate execution
            const currentPrice = currentBar.close;
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
              signalDate: entryDate,
              entryDate,
              signalPrice: Number(entryPrice.toFixed(3)),
              entryPrice: Number(entryPrice.toFixed(3)),
              exitSignalDate: currentBar.timestamp,
              exitDate: currentBar.timestamp,
              exitSignalPrice: Number(currentPrice.toFixed(3)),
              exitPrice: Number(effectiveExitPrice.toFixed(3)),
              shares: Number(shares.toFixed(4)),
              amountInvested: Number(totalInvested.toFixed(2)),
              pnlEur: Number(pnlEur.toFixed(2)),
              pnlPct: Number(pnlPct.toFixed(2)),
              returnFactor: Number((effectiveExitPrice / entryPrice).toFixed(3)),
              commissionPaid: Number((entryCommissionPaid + exitCommission).toFixed(3)),
              slippagePaid: Number((entrySlippagePaid + shares * exitSlippage).toFixed(3)),
              exitReason: 'SIGNAL',
              holdingPeriodBars: i - entryBarIndex,
              isWin: pnlEur > 0
            });

            inPosition = false;
            shares = 0;
            entryPrice = 0;
            highestPriceDuringTrade = 0;
          }
        }
      }
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
      executionMode: config.executionMode,
      metrics,
      equityCurve,
      trades,
      signals,
      dataProvenance: resolvedProvenance
    };
  }
}
