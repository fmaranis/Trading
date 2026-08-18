import {
  PriceBar,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  Signal,
  PendingOrder,
  BacktestAccountingError
} from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { FinancialMetricsCalculator } from './metrics';
import { DataValidator } from '../data/validators';
import { ExecutionCalculator } from './executionCalculator';
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
    executionMode: 'NEXT_OPEN', // Default strict anti-lookahead
    intrabarConflictPolicy: 'CONSERVATIVE' // Default conservative
  };

  /**
   * Executes an auditable, strictly non-anticipative backtest simulation on historical price bars.
   * Input bars are validated without silent sorting (throws DataValidationError if unordered).
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

    // 1. Strict Validation - NEVER auto-sort silently
    DataValidator.assertValidPriceBars(bars);

    if (bars.length < 2) {
      throw new Error('El motor de backtest requiere al menos 2 barras de precios cronológicas.');
    }

    // 2. Generate Signals from Strategy (strictly historical up to bar t)
    const signals: Signal[] = strategy.generateSignals(bars, strategyParams);

    // 3. Independent Benchmark Calculation (immune to stops, take profits, or strategy logic)
    const benchmarkData = ExecutionCalculator.calculateBuyAndHoldBenchmark(bars, config.initialCapital);

    // 4. Simulation & Accounting State
    let cash = config.initialCapital;
    let shares = 0;
    let inPosition = false;
    let pendingOrder: PendingOrder | null = null;
    const unfilledOrders: PendingOrder[] = [];

    let entryPrice = 0; // Effective fill price after slippage
    let marketEntryPrice = 0; // Base market price
    let entryBarIndex = 0;
    let entryDate = '';
    let signalDate = '';
    let signalPrice = 0;
    let entryCommissionPaid = 0;
    let entrySlippageEur = 0;
    let highestPriceDuringTrade = 0;

    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    // 5. Main Execution Loop across every chronological bar
    for (let i = 0; i < bars.length; i++) {
      const currentBar = bars[i];

      // ─── STEP A: Execute Pending Signal Orders at Bar Open (NEXT_OPEN mode) ───
      if (config.executionMode === 'NEXT_OPEN' && pendingOrder) {
        if (pendingOrder.type === 'BUY' && !inPosition && cash >= 1.0) {
          const capitalToAllocate = cash * (config.positionSizingPct / 100);
          const commRate = config.commissionPct / 100;
          const entryCommission = capitalToAllocate * commRate;
          const netCapital = capitalToAllocate - entryCommission;

          const fill = ExecutionCalculator.calculateFill('BUY_NEXT_OPEN', currentBar.open, 1, config.slippagePct);
          const purchasedShares = netCapital / fill.effectivePrice;
          const calculatedSlippageEur = purchasedShares * fill.slippagePerShare;

          cash -= capitalToAllocate;
          if (cash < -0.001) {
            throw new BacktestAccountingError(`Cash negativo tras compra: ${cash.toFixed(4)}€`);
          }

          shares = purchasedShares;
          entryPrice = fill.effectivePrice;
          marketEntryPrice = currentBar.open;
          entryDate = currentBar.timestamp;
          signalDate = pendingOrder.signalTimestamp;
          signalPrice = pendingOrder.signalPrice;
          entryCommissionPaid = entryCommission;
          entrySlippageEur = calculatedSlippageEur;
          entryBarIndex = i;
          highestPriceDuringTrade = currentBar.open;
          inPosition = true;
          pendingOrder = null;
        } else if (pendingOrder.type === 'SELL' && inPosition) {
          const fill = ExecutionCalculator.calculateFill('SELL_NEXT_OPEN', currentBar.open, shares, config.slippagePct);
          const grossExitAmount = shares * fill.effectivePrice;
          const exitCommission = grossExitAmount * (config.commissionPct / 100);
          const netExitAmount = grossExitAmount - exitCommission;

          const marketEntryVal = shares * marketEntryPrice;
          const marketExitVal = shares * fill.marketPrice;
          const grossPnlEur = marketExitVal - marketEntryVal;
          const totalCommission = entryCommissionPaid + exitCommission;
          const exitSlippageEur = fill.slippageEur;
          const totalSlippage = entrySlippageEur + exitSlippageEur;
          const totalTradingCosts = totalCommission + totalSlippage;
          const netPnlEur = grossPnlEur - totalTradingCosts;
          const totalInvestedCash = shares * entryPrice + entryCommissionPaid;
          const netReturnPct = totalInvestedCash > 0 ? (netPnlEur / totalInvestedCash) * 100 : 0;
          const grossReturnPct = marketEntryVal > 0 ? (grossPnlEur / marketEntryVal) * 100 : 0;

          cash += netExitAmount;
          if (cash < -0.001) {
            throw new BacktestAccountingError(`Cash negativo tras venta: ${cash.toFixed(4)}€`);
          }

          trades.push({
            id: `trade-${trades.length + 1}`,
            signalDate,
            entryDate,
            signalPrice: Number(signalPrice.toFixed(3)),
            entryPrice: Number(entryPrice.toFixed(3)),
            marketEntryPrice: Number(marketEntryPrice.toFixed(3)),
            exitSignalDate: pendingOrder.signalTimestamp,
            exitDate: currentBar.timestamp,
            exitSignalPrice: Number(pendingOrder.signalPrice.toFixed(3)),
            exitPrice: Number(fill.effectivePrice.toFixed(3)),
            marketExitPrice: Number(fill.marketPrice.toFixed(3)),
            shares: Number(shares.toFixed(4)),
            amountInvested: Number(totalInvestedCash.toFixed(2)),

            entryCommission: Number(entryCommissionPaid.toFixed(3)),
            exitCommission: Number(exitCommission.toFixed(3)),
            entrySlippageEur: Number(entrySlippageEur.toFixed(3)),
            exitSlippageEur: Number(exitSlippageEur.toFixed(3)),
            totalCommission: Number(totalCommission.toFixed(3)),
            totalSlippage: Number(totalSlippage.toFixed(3)),
            totalTradingCosts: Number(totalTradingCosts.toFixed(3)),

            grossPnlEur: Number(grossPnlEur.toFixed(2)),
            netPnlEur: Number(netPnlEur.toFixed(2)),
            grossReturnPct: Number(grossReturnPct.toFixed(2)),
            netReturnPct: Number(netReturnPct.toFixed(2)),

            pnlEur: Number(netPnlEur.toFixed(2)),
            pnlPct: Number(netReturnPct.toFixed(2)),
            commissionPaid: Number(totalCommission.toFixed(3)),
            slippagePaid: Number(totalSlippage.toFixed(3)),
            returnFactor: Number((fill.effectivePrice / entryPrice).toFixed(3)),

            exitReason: pendingOrder.triggerReason || 'SIGNAL',
            holdingPeriodBars: i - entryBarIndex,
            isWin: netPnlEur > 0,
            intrabarConflict: false,
            intrabarConflictPolicyUsed: config.intrabarConflictPolicy
          });

          inPosition = false;
          shares = 0;
          entryPrice = 0;
          highestPriceDuringTrade = 0;
          pendingOrder = null;
        }
      }

      // ─── STEP B: Intrabar Active Risk Orders (Stop Loss / Take Profit / Trailing Stop) ───
      // Risk stops execute IN THIS SAME BAR at trigger/gap price
      if (inPosition) {
        const riskEval = ExecutionCalculator.evaluateIntrabarRisk(
          currentBar,
          entryPrice,
          highestPriceDuringTrade,
          config
        );

        if (riskEval.triggered && riskEval.reason) {
          const fill = ExecutionCalculator.calculateFill(
            riskEval.reason,
            riskEval.marketExecutionPrice,
            shares,
            config.slippagePct
          );

          const grossExitAmount = shares * fill.effectivePrice;
          const exitCommission = grossExitAmount * (config.commissionPct / 100);
          const netExitAmount = grossExitAmount - exitCommission;

          const marketEntryVal = shares * marketEntryPrice;
          const marketExitVal = shares * fill.marketPrice;
          const grossPnlEur = marketExitVal - marketEntryVal;
          const totalCommission = entryCommissionPaid + exitCommission;
          const exitSlippageEur = fill.slippageEur;
          const totalSlippage = entrySlippageEur + exitSlippageEur;
          const totalTradingCosts = totalCommission + totalSlippage;
          const netPnlEur = grossPnlEur - totalTradingCosts;
          const totalInvestedCash = shares * entryPrice + entryCommissionPaid;
          const netReturnPct = totalInvestedCash > 0 ? (netPnlEur / totalInvestedCash) * 100 : 0;
          const grossReturnPct = marketEntryVal > 0 ? (grossPnlEur / marketEntryVal) * 100 : 0;

          cash += netExitAmount;
          if (cash < -0.001) {
            throw new BacktestAccountingError(`Cash negativo tras ejecución de stop: ${cash.toFixed(4)}€`);
          }

          trades.push({
            id: `trade-${trades.length + 1}`,
            signalDate: entryDate,
            entryDate,
            signalPrice: Number(marketEntryPrice.toFixed(3)),
            entryPrice: Number(entryPrice.toFixed(3)),
            marketEntryPrice: Number(marketEntryPrice.toFixed(3)),
            exitSignalDate: currentBar.timestamp,
            exitDate: currentBar.timestamp,
            exitSignalPrice: Number(riskEval.marketExecutionPrice.toFixed(3)),
            exitPrice: Number(fill.effectivePrice.toFixed(3)),
            marketExitPrice: Number(fill.marketPrice.toFixed(3)),
            shares: Number(shares.toFixed(4)),
            amountInvested: Number(totalInvestedCash.toFixed(2)),

            entryCommission: Number(entryCommissionPaid.toFixed(3)),
            exitCommission: Number(exitCommission.toFixed(3)),
            entrySlippageEur: Number(entrySlippageEur.toFixed(3)),
            exitSlippageEur: Number(exitSlippageEur.toFixed(3)),
            totalCommission: Number(totalCommission.toFixed(3)),
            totalSlippage: Number(totalSlippage.toFixed(3)),
            totalTradingCosts: Number(totalTradingCosts.toFixed(3)),

            grossPnlEur: Number(grossPnlEur.toFixed(2)),
            netPnlEur: Number(netPnlEur.toFixed(2)),
            grossReturnPct: Number(grossReturnPct.toFixed(2)),
            netReturnPct: Number(netReturnPct.toFixed(2)),

            pnlEur: Number(netPnlEur.toFixed(2)),
            pnlPct: Number(netReturnPct.toFixed(2)),
            commissionPaid: Number(totalCommission.toFixed(3)),
            slippagePaid: Number(totalSlippage.toFixed(3)),
            returnFactor: Number((fill.effectivePrice / entryPrice).toFixed(3)),

            exitReason: riskEval.reason,
            holdingPeriodBars: i - entryBarIndex,
            isWin: netPnlEur > 0,
            intrabarConflict: riskEval.intrabarConflict,
            intrabarConflictPolicyUsed: riskEval.policyUsed
          });

          inPosition = false;
          shares = 0;
          entryPrice = 0;
          highestPriceDuringTrade = 0;
          pendingOrder = null;
        } else {
          // Update peak price reached during position for trailing stops
          if (currentBar.high > highestPriceDuringTrade) {
            highestPriceDuringTrade = currentBar.high;
          }
        }
      }

      // ─── STEP C: End-of-Data Liquidation (Last Bar) ───
      if (inPosition && i === bars.length - 1) {
        const fill = ExecutionCalculator.calculateFill('END_OF_DATA', currentBar.close, shares, config.slippagePct);
        const grossExitAmount = shares * fill.effectivePrice;
        const exitCommission = grossExitAmount * (config.commissionPct / 100);
        const netExitAmount = grossExitAmount - exitCommission;

        const marketEntryVal = shares * marketEntryPrice;
        const marketExitVal = shares * fill.marketPrice;
        const grossPnlEur = marketExitVal - marketEntryVal;
        const totalCommission = entryCommissionPaid + exitCommission;
        const exitSlippageEur = fill.slippageEur;
        const totalSlippage = entrySlippageEur + exitSlippageEur;
        const totalTradingCosts = totalCommission + totalSlippage;
        const netPnlEur = grossPnlEur - totalTradingCosts;
        const totalInvestedCash = shares * entryPrice + entryCommissionPaid;
        const netReturnPct = totalInvestedCash > 0 ? (netPnlEur / totalInvestedCash) * 100 : 0;
        const grossReturnPct = marketEntryVal > 0 ? (grossPnlEur / marketEntryVal) * 100 : 0;

        cash += netExitAmount;
        if (cash < -0.001) {
          throw new BacktestAccountingError(`Cash negativo tras liquidación fin de datos: ${cash.toFixed(4)}€`);
        }

        trades.push({
          id: `trade-${trades.length + 1}`,
          signalDate: signalDate || entryDate,
          entryDate,
          signalPrice: Number(signalPrice.toFixed(3)),
          entryPrice: Number(entryPrice.toFixed(3)),
          marketEntryPrice: Number(marketEntryPrice.toFixed(3)),
          exitSignalDate: currentBar.timestamp,
          exitDate: currentBar.timestamp,
          exitSignalPrice: Number(currentBar.close.toFixed(3)),
          exitPrice: Number(fill.effectivePrice.toFixed(3)),
          marketExitPrice: Number(fill.marketPrice.toFixed(3)),
          shares: Number(shares.toFixed(4)),
          amountInvested: Number(totalInvestedCash.toFixed(2)),

          entryCommission: Number(entryCommissionPaid.toFixed(3)),
          exitCommission: Number(exitCommission.toFixed(3)),
          entrySlippageEur: Number(entrySlippageEur.toFixed(3)),
          exitSlippageEur: Number(exitSlippageEur.toFixed(3)),
          totalCommission: Number(totalCommission.toFixed(3)),
          totalSlippage: Number(totalSlippage.toFixed(3)),
          totalTradingCosts: Number(totalTradingCosts.toFixed(3)),

          grossPnlEur: Number(grossPnlEur.toFixed(2)),
          netPnlEur: Number(netPnlEur.toFixed(2)),
          grossReturnPct: Number(grossReturnPct.toFixed(2)),
          netReturnPct: Number(netReturnPct.toFixed(2)),

          pnlEur: Number(netPnlEur.toFixed(2)),
          pnlPct: Number(netReturnPct.toFixed(2)),
          commissionPaid: Number(totalCommission.toFixed(3)),
          slippagePaid: Number(totalSlippage.toFixed(3)),
          returnFactor: Number((fill.effectivePrice / entryPrice).toFixed(3)),

          exitReason: 'END_OF_DATA',
          holdingPeriodBars: i - entryBarIndex,
          isWin: netPnlEur > 0,
          intrabarConflict: false,
          intrabarConflictPolicyUsed: config.intrabarConflictPolicy
        });

        inPosition = false;
        shares = 0;
        entryPrice = 0;
        highestPriceDuringTrade = 0;
      }

      // ─── STEP D: Bar Close Accounting & Equity Curve Integrity ───
      const positionMarketValue = inPosition ? shares * currentBar.close : 0;
      const totalEquity = cash + positionMarketValue;

      // Assert Cash & Equity Integrity
      if (cash < -0.001) {
        throw new BacktestAccountingError(`Incoherencia contable: cash negativo detectado (${cash.toFixed(4)}€)`);
      }
      if (Math.abs(totalEquity - (cash + positionMarketValue)) > 0.01) {
        throw new BacktestAccountingError('Fallo de integridad patrimonial: equity !== cash + positionMarketValue');
      }

      const currentBenchmarkEquity = benchmarkData.benchmarkEquityCurve[i] ?? config.initialCapital;

      equityCurve.push({
        timestamp: currentBar.timestamp,
        equity: Number(totalEquity.toFixed(2)),
        cash: Number(cash.toFixed(2)),
        positionMarketValue: Number(positionMarketValue.toFixed(2)),
        drawdownPct: 0,
        benchmarkEquity: Number(currentBenchmarkEquity.toFixed(2))
      });

      // ─── STEP E: Strategy Signal Evaluation at Bar Close ───
      const signal = signals[i] || { type: 'HOLD', price: currentBar.close, timestamp: currentBar.timestamp, reason: '' };

      if (!pendingOrder && i < bars.length - 1) {
        if (!inPosition && signal.type === 'BUY' && cash >= 1.0) {
          if (config.executionMode === 'NEXT_OPEN') {
            pendingOrder = {
              type: 'BUY',
              signalTimestamp: currentBar.timestamp,
              signalPrice: currentBar.close,
              signalReason: signal.reason || 'Strategy BUY signal',
              generatedAtBarIndex: i,
              triggerReason: 'SIGNAL'
            };
          } else {
            // SAME_CLOSE immediate execution
            const capitalToAllocate = cash * (config.positionSizingPct / 100);
            const commRate = config.commissionPct / 100;
            const entryCommission = capitalToAllocate * commRate;
            const netCapital = capitalToAllocate - entryCommission;

            const fill = ExecutionCalculator.calculateFill('BUY_SAME_CLOSE', currentBar.close, 1, config.slippagePct);
            const purchasedShares = netCapital / fill.effectivePrice;
            const calculatedSlippageEur = purchasedShares * fill.slippagePerShare;

            cash -= capitalToAllocate;
            shares = purchasedShares;
            entryPrice = fill.effectivePrice;
            marketEntryPrice = currentBar.close;
            entryDate = currentBar.timestamp;
            signalDate = currentBar.timestamp;
            signalPrice = currentBar.close;
            entryCommissionPaid = entryCommission;
            entrySlippageEur = calculatedSlippageEur;
            entryBarIndex = i;
            highestPriceDuringTrade = fill.effectivePrice;
            inPosition = true;
          }
        } else if (inPosition && signal.type === 'SELL') {
          if (config.executionMode === 'NEXT_OPEN') {
            pendingOrder = {
              type: 'SELL',
              signalTimestamp: currentBar.timestamp,
              signalPrice: currentBar.close,
              signalReason: signal.reason || 'Strategy SELL signal',
              generatedAtBarIndex: i,
              triggerReason: 'SIGNAL'
            };
          } else {
            // SAME_CLOSE immediate execution
            const fill = ExecutionCalculator.calculateFill('SELL_SAME_CLOSE', currentBar.close, shares, config.slippagePct);
            const grossExitAmount = shares * fill.effectivePrice;
            const exitCommission = grossExitAmount * (config.commissionPct / 100);
            const netExitAmount = grossExitAmount - exitCommission;

            const marketEntryVal = shares * marketEntryPrice;
            const marketExitVal = shares * fill.marketPrice;
            const grossPnlEur = marketExitVal - marketEntryVal;
            const totalCommission = entryCommissionPaid + exitCommission;
            const exitSlippageEur = fill.slippageEur;
            const totalSlippage = entrySlippageEur + exitSlippageEur;
            const totalTradingCosts = totalCommission + totalSlippage;
            const netPnlEur = grossPnlEur - totalTradingCosts;
            const totalInvestedCash = shares * entryPrice + entryCommissionPaid;
            const netReturnPct = totalInvestedCash > 0 ? (netPnlEur / totalInvestedCash) * 100 : 0;
            const grossReturnPct = marketEntryVal > 0 ? (grossPnlEur / marketEntryVal) * 100 : 0;

            cash += netExitAmount;

            trades.push({
              id: `trade-${trades.length + 1}`,
              signalDate: entryDate,
              entryDate,
              signalPrice: Number(marketEntryPrice.toFixed(3)),
              entryPrice: Number(entryPrice.toFixed(3)),
              marketEntryPrice: Number(marketEntryPrice.toFixed(3)),
              exitSignalDate: currentBar.timestamp,
              exitDate: currentBar.timestamp,
              exitSignalPrice: Number(currentBar.close.toFixed(3)),
              exitPrice: Number(fill.effectivePrice.toFixed(3)),
              marketExitPrice: Number(fill.marketPrice.toFixed(3)),
              shares: Number(shares.toFixed(4)),
              amountInvested: Number(totalInvestedCash.toFixed(2)),

              entryCommission: Number(entryCommissionPaid.toFixed(3)),
              exitCommission: Number(exitCommission.toFixed(3)),
              entrySlippageEur: Number(entrySlippageEur.toFixed(3)),
              exitSlippageEur: Number(exitSlippageEur.toFixed(3)),
              totalCommission: Number(totalCommission.toFixed(3)),
              totalSlippage: Number(totalSlippage.toFixed(3)),
              totalTradingCosts: Number(totalTradingCosts.toFixed(3)),

              grossPnlEur: Number(grossPnlEur.toFixed(2)),
              netPnlEur: Number(netPnlEur.toFixed(2)),
              grossReturnPct: Number(grossReturnPct.toFixed(2)),
              netReturnPct: Number(netReturnPct.toFixed(2)),

              pnlEur: Number(netPnlEur.toFixed(2)),
              pnlPct: Number(netReturnPct.toFixed(2)),
              commissionPaid: Number(totalCommission.toFixed(3)),
              slippagePaid: Number(totalSlippage.toFixed(3)),
              returnFactor: Number((fill.effectivePrice / entryPrice).toFixed(3)),

              exitReason: 'SIGNAL',
              holdingPeriodBars: i - entryBarIndex,
              isWin: netPnlEur > 0,
              intrabarConflict: false,
              intrabarConflictPolicyUsed: config.intrabarConflictPolicy
            });

            inPosition = false;
            shares = 0;
            entryPrice = 0;
            highestPriceDuringTrade = 0;
          }
        }
      } else if (i === bars.length - 1) {
        // Last bar: any signal produced cannot be filled because there is no bar t+1
        if (!inPosition && signal.type === 'BUY' && cash >= 1.0) {
          unfilledOrders.push({
            type: 'BUY',
            signalTimestamp: currentBar.timestamp,
            signalPrice: currentBar.close,
            signalReason: signal.reason || 'Signal emitted on final bar (no t+1 bar available)',
            generatedAtBarIndex: i,
            triggerReason: 'SIGNAL'
          });
        } else if (inPosition && signal.type === 'SELL') {
          unfilledOrders.push({
            type: 'SELL',
            signalTimestamp: currentBar.timestamp,
            signalPrice: currentBar.close,
            signalReason: signal.reason || 'Signal emitted on final bar (no t+1 bar available)',
            generatedAtBarIndex: i,
            triggerReason: 'SIGNAL'
          });
        }
      }
    }

    if (pendingOrder) {
      unfilledOrders.push(pendingOrder);
      pendingOrder = null;
    }

    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || config.initialCapital;

    // 6. Calculate Complete Statistical Metrics
    const metrics = FinancialMetricsCalculator.calculateMetrics(
      config.initialCapital,
      finalEquity,
      equityCurve,
      trades,
      benchmarkData.benchmarkReturnPct,
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
      unfilledOrders,
      dataProvenance: resolvedProvenance,
      benchmarkIncludesCosts: false
    };
  }
}
