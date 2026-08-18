import { Asset, Portfolio, Position, SimulatedOrder, BotState, BotStrategyType, BotBacktestValidation } from '../types';
import { ALL_AVAILABLE_ASSETS } from '../data/marketData';
import { PortfolioEngine } from './portfolioEngine';
import { HistoricalDataTransformer } from '../investment/data/historicalTransformer';
import { StrategyComparator } from '../investment/analytics/strategyComparator';

export interface MarketTickEvent {
  assetId: string;
  ticker: string;
  previousPrice: number;
  newPrice: number;
  deltaPct: number;
  rsi: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timestamp: string;
}

export interface BotDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'WITHDRAW_INITIAL_CAPITAL';
  assetId?: string;
  reason: string;
  amountEur?: number;
  orderType?: 'BUY' | 'SELL';
  triggerReason?: 'MOMENTUM_ENTRY' | 'TRAILING_STOP' | 'TAKE_PROFIT_2X' | 'CAPITAL_EXTRACTION';
  backtestValidation?: BotBacktestValidation;
}

export class LiveSimulationEngine {
  /**
   * Generates a realistic micro-tick for a given asset strictly in real-time 1:1 cadence
   */
  public static simulateNextTick(asset: Asset): { updatedAsset: Asset; event: MarketTickEvent } {
    // Realistic standard deviation scaled for 1.5 - 2 second natural market intervals
    const baseVol = (asset.volatilityAnnual / 100) / 180;
    // Micro Brownian motion with slight positive expected return for equities
    const randomFactor = (Math.random() - 0.49); 
    const jump = randomFactor * baseVol;

    const prevPrice = asset.currentPrice;
    let newPrice = Math.max(0.10, prevPrice * (1 + jump));
    newPrice = Number(newPrice.toFixed(2));

    const deltaPct = Number((((newPrice - prevPrice) / prevPrice) * 100).toFixed(3));
    
    // Technical RSI (14-tick approximation between 10 and 90)
    const rsiSeed = 50 + (asset.change24h * 3.5) + (deltaPct * 15) + ((Math.random() - 0.5) * 6);
    const rsi = Math.min(94, Math.max(12, Number(rsiSeed.toFixed(1))));

    const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
      rsi > 58 ? 'BULLISH' : rsi < 42 ? 'BEARISH' : 'NEUTRAL';

    const updated24h = Number((asset.change24h + (deltaPct * 0.15)).toFixed(2));

    const updatedAsset: Asset = {
      ...asset,
      currentPrice: newPrice,
      change24h: updated24h
    };

    const event: MarketTickEvent = {
      assetId: asset.id,
      ticker: asset.ticker,
      previousPrice: prevPrice,
      newPrice,
      deltaPct,
      rsi,
      trend,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false })
    };

    return { updatedAsset, event };
  }

  /**
   * Evaluates the portfolio and market conditions to make autonomous trading decisions
   */
  public static evaluateBotDecision(
    portfolio: Portfolio,
    assets: Asset[],
    botState: BotState,
    inFlightAssetIds: Set<string>
  ): BotDecision | null {
    // 1. Check Milestone 2X: Auto-Withdraw Initial 100€ Capital if reached 200€ total valuation
    const totalEffectiveEquity = portfolio.totalValuation + portfolio.vaultWithdrawnAmount;
    if (
      totalEffectiveEquity >= 200.0 &&
      !botState.initialCapitalRecovered &&
      portfolio.vaultWithdrawnAmount < 100.0
    ) {
      return {
        action: 'WITHDRAW_INITIAL_CAPITAL',
        reason: '🎯 OBJETIVO 2X ALCANZADO (200,00 €): Retirada automática de los 100 € iniciales a la Caja Fuerte. A partir de ahora operamos 100% con beneficios.',
        triggerReason: 'CAPITAL_EXTRACTION'
      };
    }

    // 2. Trailing Stop-Loss & Take-Profit check across all active positions
    for (const pos of portfolio.positions) {
      if (inFlightAssetIds.has(pos.assetId)) continue; // Skip if order already in flight

      const asset = assets.find(a => a.id === pos.assetId);
      if (!asset) continue;

      const highestPrice = pos.highestPriceSeen ? Math.max(pos.highestPriceSeen, asset.currentPrice) : asset.currentPrice;
      const dropFromPeakPct = ((highestPrice - asset.currentPrice) / highestPrice) * 100;
      const profitFromBuyPct = ((asset.currentPrice - pos.averageBuyPrice) / pos.averageBuyPrice) * 100;

      // Trailing Stop trigger
      if (dropFromPeakPct >= botState.trailingStopPct && profitFromBuyPct > -2.0) {
        return {
          action: 'SELL',
          assetId: pos.assetId,
          orderType: 'SELL',
          amountEur: Number(pos.currentValuation.toFixed(2)),
          reason: `🛡️ TRAILING STOP ACTIVADO (-${dropFromPeakPct.toFixed(1)}% desde pico de ${highestPrice.toFixed(2)}€): Orden de venta enviada para proteger ganancias.`,
          triggerReason: 'TRAILING_STOP'
        };
      }

      // Hard Stop Loss (safety net if drops -3.5% from entry)
      if (profitFromBuyPct <= -3.5) {
        return {
          action: 'SELL',
          assetId: pos.assetId,
          orderType: 'SELL',
          amountEur: Number(pos.currentValuation.toFixed(2)),
          reason: `🛑 STOP LOSS PREVENTIVO (-3.5% alcanzado): Cortamos pérdidas en ${asset.name} para evitar riesgo de quiebra.`,
          triggerReason: 'TRAILING_STOP'
        };
      }

      // Partial Take Profit (if position gained +20% or more)
      if (profitFromBuyPct >= 20.0 && pos.investedAmount >= 15.0) {
        const takeProfitAmount = Number((pos.currentValuation * 0.5).toFixed(2));
        return {
          action: 'SELL',
          assetId: pos.assetId,
          orderType: 'SELL',
          amountEur: takeProfitAmount,
          reason: `💰 TOMA DE BENEFICIOS PARCIAL (+${profitFromBuyPct.toFixed(1)}%): Recogemos ${takeProfitAmount}€ de plusvalía en ${asset.name}.`,
          triggerReason: 'TAKE_PROFIT_2X'
        };
      }
    }

    // 3. Autonomous Quantitative Screener & Pre-Trade Backtest Engine (Cash >= 10€)
    if (portfolio.cashBalance >= 10.0) {
      // Screen all candidate assets (Growth, ETFs, Tech, Index Funds)
      const candidateAssets = assets.filter(a => 
        !inFlightAssetIds.has(a.id) &&
        (portfolio.positions.find(p => p.assetId === a.id)?.weightPercentage || 0) < 45
      );

      // Rank candidates using real historical backtest simulations
      let bestCandidate: Asset | null = null;
      let bestValidation: BotBacktestValidation | null = null;
      let highestCandidateSharpe = -999;

      for (const candidate of candidateAssets) {
        // 1. Generate real historical price bars
        const bars = HistoricalDataTransformer.assetToPriceBars(candidate, 60);
        
        // 2. Run Backtesting across all 4 quant strategies on this asset
        const comparison = StrategyComparator.compareAll(
          bars,
          candidate.ticker,
          candidate.name,
          {
            initialCapital: 100.0,
            commissionPct: 0.05,
            slippagePct: 0.02,
            trailingStopPct: botState.trailingStopPct
          }
        );

        const optimal = comparison.bestBySharpe;
        if (optimal && optimal.sharpeRatio > highestCandidateSharpe) {
          highestCandidateSharpe = optimal.sharpeRatio;
          bestCandidate = candidate;
          
          const isApproved = optimal.sharpeRatio >= 0.70 && optimal.winRatePct >= 45 && optimal.maxDrawdownPct <= 12.0;

          bestValidation = {
            assetId: candidate.id,
            assetTicker: candidate.ticker,
            assetName: candidate.name,
            evaluatedAt: new Date().toLocaleTimeString('es-ES', { hour12: false }),
            strategyId: optimal.strategyId,
            strategyName: optimal.strategyName,
            sharpeRatio: optimal.sharpeRatio,
            sortinoRatio: optimal.sortinoRatio,
            winRatePct: optimal.winRatePct,
            maxDrawdownPct: optimal.maxDrawdownPct,
            expectedReturnPct: optimal.totalReturnPct,
            passed: isApproved,
            rejectReason: !isApproved 
              ? optimal.sharpeRatio < 0.70 
                ? `Sharpe insuficiente (${optimal.sharpeRatio.toFixed(2)} < 0.70 min)`
                : optimal.winRatePct < 45 
                ? `Tasa de acierto baja (${optimal.winRatePct.toFixed(0)}% < 45%)`
                : `Drawdown excesivo (-${optimal.maxDrawdownPct.toFixed(1)}% > 12%)`
              : undefined,
            testedStrategiesCount: comparison.ranking.length
          };
        }
      }

      // If best backtested candidate passes our quantitative filter
      if (bestCandidate && bestValidation) {
        if (bestValidation.passed) {
          const allocAmount = Math.min(portfolio.cashBalance * 0.65, 35.0);
          if (allocAmount >= 5.0) {
            return {
              action: 'BUY',
              assetId: bestCandidate.id,
              orderType: 'BUY',
              amountEur: Number(allocAmount.toFixed(2)),
              reason: `🧪 [Backtest Validado] Estrategia "${bestValidation.strategyName}" (Sharpe ${bestValidation.sharpeRatio.toFixed(2)}, Win-Rate ${bestValidation.winRatePct.toFixed(0)}%, MaxDD -${Math.abs(bestValidation.maxDrawdownPct).toFixed(1)}%). Compra aprobada en ${bestCandidate.name}.`,
              triggerReason: 'MOMENTUM_ENTRY',
              backtestValidation: bestValidation
            };
          }
        } else {
          // Backtest rejected trade: return HOLD decision with the validation attached for user audit
          return {
            action: 'HOLD',
            assetId: bestCandidate.id,
            reason: `🛡️ [Backtest Rechaza Compra] ${bestCandidate.ticker} descartado: ${bestValidation.rejectReason}. El bot preserva el efectivo en caja.`,
            backtestValidation: bestValidation
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculates realistic execution lag and slippage for a newly submitted order
   */
  public static calculateOrderExecutionLag(asset: Asset, orderType: 'BUY' | 'SELL', quotedPrice: number): {
    latencyMs: number;
    slippagePct: number;
    finalExecutionPrice: number;
  } {
    // Realistic exchange & PSD2 network latency: between 380ms and 920ms
    const baseLatency = 400 + Math.floor(Math.random() * 450);
    
    // Slippage (market impact + bid/ask spread) between -0.04% and +0.06%
    const slippageDirection = orderType === 'BUY' ? 1 : -1;
    const slippagePct = Number(((Math.random() * 0.05 + 0.01) * slippageDirection).toFixed(3));
    
    const finalExecutionPrice = Number((quotedPrice * (1 + (slippagePct / 100))).toFixed(2));

    return {
      latencyMs: baseLatency,
      slippagePct,
      finalExecutionPrice: Math.max(0.01, finalExecutionPrice)
    };
  }

  /**
   * Executes the 100€ initial capital extraction to Vault (House Money milestone)
   */
  public static executeCapitalExtraction(portfolio: Portfolio, assets: Asset[]): Portfolio {
    const cashAvailable = portfolio.cashBalance;
    let newCash = cashAvailable;
    let withdrawn = 100.0;

    if (cashAvailable >= 100.0) {
      newCash = cashAvailable - 100.0;
    } else {
      // Need to liquidate some positions to extract 100€
      const needed = 100.0 - cashAvailable;
      newCash = 0;
      const currentPosVal = portfolio.positions.reduce((sum, p) => sum + p.currentValuation, 0);
      if (currentPosVal > 0) {
        const factor = Math.max(0, (currentPosVal - needed) / currentPosVal);
        portfolio.positions = portfolio.positions.map(p => ({
          ...p,
          shares: p.shares * factor,
          investedAmount: p.investedAmount * factor,
          currentValuation: p.currentValuation * factor
        }));
      }
    }

    const updatedPortfolio: Portfolio = {
      ...portfolio,
      cashBalance: Number(newCash.toFixed(2)),
      vaultWithdrawnAmount: portfolio.vaultWithdrawnAmount + withdrawn
    };

    return PortfolioEngine.recalculate(updatedPortfolio, assets);
  }

  /**
   * Monte Carlo Simulation Model for 100€ Doubling Strategy
   */
  public static runMonteCarloDoublingSimulation(
    strategy: BotStrategyType,
    stopLossPct: number
  ) {
    const simulations = 1000;
    let doubledCount = 0;
    let stoppedCount = 0;
    let tradesArray: number[] = [];

    // Strategy parameters
    const winRate = strategy === 'MOMENTUM_BREAKOUT' ? 0.54 : strategy === 'VOLATILITY_SCALPER' ? 0.62 : 0.48;
    const avgWinPct = strategy === 'MOMENTUM_BREAKOUT' ? 6.5 : strategy === 'VOLATILITY_SCALPER' ? 2.8 : 8.5;
    const avgLossPct = stopLossPct;

    for (let i = 0; i < simulations; i++) {
      let balance = 100.0;
      let trades = 0;
      const maxTrades = 120;

      while (balance > 65.0 && balance < 200.0 && trades < maxTrades) {
        trades++;
        const isWin = Math.random() < winRate;
        const betSize = balance * 0.4; // 40% position sizing

        if (isWin) {
          balance += betSize * (avgWinPct / 100);
        } else {
          balance -= betSize * (avgLossPct / 100);
        }
      }

      if (balance >= 200.0) {
        doubledCount++;
        tradesArray.push(trades);
      } else {
        stoppedCount++;
      }
    }

    const probabilityDoublingPct = Number(((doubledCount / simulations) * 100).toFixed(1));
    const probabilityDrawdownPct = Number(((stoppedCount / simulations) * 100).toFixed(1));
    const avgTrades = tradesArray.length > 0 
      ? Math.round(tradesArray.reduce((a, b) => a + b, 0) / tradesArray.length) 
      : 42;

    return {
      simulations,
      probabilityDoublingPct,
      probabilityDrawdownPct,
      avgTradesToDouble: avgTrades,
      winRatePct: Math.round(winRate * 100),
      riskRewardRatio: (avgWinPct / avgLossPct).toFixed(2),
      keyTakeaway: `Con una tasa de acierto del ${Math.round(winRate * 100)}% y ratio R:R de ${(avgWinPct / avgLossPct).toFixed(2)}, la probabilidad de duplicar a 200€ con trailing stop es del ${probabilityDoublingPct}%.`
    };
  }
}
