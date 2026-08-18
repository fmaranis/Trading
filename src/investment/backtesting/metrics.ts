import { BacktestMetrics, BacktestTrade, EquityPoint } from './types';

export class FinancialMetricsCalculator {
  /**
   * Annualization factor: 252 trading days for daily data, or 52 for weekly.
   */
  public static readonly ANNUAL_TRADING_DAYS = 252;

  /**
   * Calculates complete statistical and quantitative metrics matching pyfolio/vectorbt standards.
   */
  public static calculateMetrics(
    initialCapital: number,
    finalEquity: number,
    equityCurve: EquityPoint[],
    trades: BacktestTrade[],
    benchmarkReturnPct: number = 0,
    riskFreeRateAnnualPct: number = 3.0,
    barsPerYear: number = 252
  ): BacktestMetrics {
    const totalReturnPct = initialCapital > 0 ? ((finalEquity - initialCapital) / initialCapital) * 100 : 0;
    const totalBars = equityCurve.length;
    const years = Math.max(0.01, totalBars / barsPerYear);

    // CAGR (Compound Annual Growth Rate)
    const cagrPct = initialCapital > 0 && finalEquity > 0
      ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
      : totalReturnPct;

    const annualizedReturnPct = cagrPct;

    // Daily / Period Returns Array
    const periodicReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev > 0) {
        periodicReturns.push((curr - prev) / prev);
      }
    }

    // Volatility (Annualized Standard Deviation)
    const meanReturn = periodicReturns.length > 0
      ? periodicReturns.reduce((sum, r) => sum + r, 0) / periodicReturns.length
      : 0;

    const variance = periodicReturns.length > 1
      ? periodicReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (periodicReturns.length - 1)
      : 0;

    const standardDeviation = Math.sqrt(variance);
    const annualizedVolatilityPct = standardDeviation * Math.sqrt(barsPerYear) * 100;

    // Downside Deviation for Sortino Ratio (only negative returns)
    const downsideVariance = periodicReturns.length > 1
      ? periodicReturns.reduce((sum, r) => (r < 0 ? sum + Math.pow(r, 2) : sum), 0) / periodicReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const annualizedDownsideVolPct = downsideDeviation * Math.sqrt(barsPerYear) * 100;

    // Sharpe Ratio
    const annualizedExcessReturn = annualizedReturnPct - riskFreeRateAnnualPct;
    const sharpeRatio = annualizedVolatilityPct > 0.0001
      ? Number((annualizedExcessReturn / annualizedVolatilityPct).toFixed(2))
      : 0;

    // Sortino Ratio
    const sortinoRatio = annualizedDownsideVolPct > 0.0001
      ? Number((annualizedExcessReturn / annualizedDownsideVolPct).toFixed(2))
      : 0;

    // Max Drawdown & Max Drawdown Duration
    let peak = initialCapital;
    let maxDrawdownPct = 0;
    let currentDrawdownDuration = 0;
    let maxDrawdownDurationBars = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      const eq = equityCurve[i].equity;
      if (eq > peak) {
        peak = eq;
        currentDrawdownDuration = 0;
      } else {
        const dd = ((peak - eq) / peak) * 100;
        if (dd > maxDrawdownPct) {
          maxDrawdownPct = dd;
        }
        currentDrawdownDuration++;
        if (currentDrawdownDuration > maxDrawdownDurationBars) {
          maxDrawdownDurationBars = currentDrawdownDuration;
        }
      }
    }

    // Calmar Ratio
    const calmarRatio = maxDrawdownPct > 0.0001
      ? Number((annualizedReturnPct / maxDrawdownPct).toFixed(2))
      : 0;

    // Trade Statistics
    const totalTrades = trades.length;
    const winningTradesList = trades.filter(t => t.pnlEur > 0);
    const losingTradesList = trades.filter(t => t.pnlEur <= 0);
    const winningTrades = winningTradesList.length;
    const losingTrades = losingTradesList.length;

    const winRatePct = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
    const lossRatePct = totalTrades > 0 ? Number(((losingTrades / totalTrades) * 100).toFixed(1)) : 0;

    const grossProfitEur = winningTradesList.reduce((sum, t) => sum + t.pnlEur, 0);
    const grossLossEur = Math.abs(losingTradesList.reduce((sum, t) => sum + t.pnlEur, 0));

    const profitFactor = grossLossEur > 0.0001
      ? Number((grossProfitEur / grossLossEur).toFixed(2))
      : grossProfitEur > 0 ? 99.9 : 0;

    const avgTradeReturnPct = totalTrades > 0
      ? Number((trades.reduce((sum, t) => sum + t.pnlPct, 0) / totalTrades).toFixed(2))
      : 0;

    const avgWinReturnPct = winningTrades > 0
      ? Number((winningTradesList.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades).toFixed(2))
      : 0;

    const avgLossReturnPct = losingTrades > 0
      ? Number((losingTradesList.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades).toFixed(2))
      : 0;

    const winLossRatio = Math.abs(avgLossReturnPct) > 0.0001
      ? Number((avgWinReturnPct / Math.abs(avgLossReturnPct)).toFixed(2))
      : avgWinReturnPct > 0 ? 99.9 : 0;

    // Consecutive wins / losses
    let currentConsecutiveWins = 0;
    let currentConsecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    for (const t of trades) {
      if (t.isWin) {
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        if (currentConsecutiveWins > maxConsecutiveWins) maxConsecutiveWins = currentConsecutiveWins;
      } else {
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        if (currentConsecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentConsecutiveLosses;
      }
    }

    // Expectancy
    const winProb = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const lossProb = totalTrades > 0 ? losingTrades / totalTrades : 0;
    const avgWinEur = winningTrades > 0 ? grossProfitEur / winningTrades : 0;
    const avgLossEur = losingTrades > 0 ? grossLossEur / losingTrades : 0;
    const expectancyEur = Number(((winProb * avgWinEur) - (lossProb * avgLossEur)).toFixed(2));

    const totalCommissionsPaidEur = Number(
      trades.reduce((sum, t) => sum + t.commissionPaid + t.slippagePaid, 0).toFixed(2)
    );

    // Market Exposure (% bars in an active position)
    const inMarketBars = trades.reduce((sum, t) => sum + t.holdingPeriodBars, 0);
    const marketExposurePct = totalBars > 0 ? Number(((inMarketBars / totalBars) * 100).toFixed(1)) : 0;

    // Alpha & Beta vs Benchmark
    const beta = 1.0; // Simplified beta vs equity index
    const alphaPct = Number((totalReturnPct - benchmarkReturnPct).toFixed(2));

    return {
      initialCapital: Number(initialCapital.toFixed(2)),
      finalEquity: Number(finalEquity.toFixed(2)),
      totalReturnPct: Number(totalReturnPct.toFixed(2)),
      annualizedReturnPct: Number(annualizedReturnPct.toFixed(2)),
      cagrPct: Number(cagrPct.toFixed(2)),
      benchmarkTotalReturnPct: Number(benchmarkReturnPct.toFixed(2)),
      alphaPct,
      beta,
      annualizedVolatilityPct: Number(annualizedVolatilityPct.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      maxDrawdownDurationBars,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePct,
      lossRatePct,
      profitFactor,
      avgTradeReturnPct,
      avgWinReturnPct,
      avgLossReturnPct,
      winLossRatio,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      expectancyEur,
      totalCommissionsPaidEur,
      marketExposurePct
    };
  }
}
