import {
  BacktestMetrics,
  BacktestTrade,
  EquityPoint,
  DataFrequency,
  MetricsContext,
  MetricsQuality,
  MetricsDiagnostics
} from './types';
import { MathStats } from '../math/statistics';

export class FinancialMetricsCalculator {
  public static readonly ANNUAL_TRADING_DAYS = 252;

  /**
   * Automatically detects the data frequency and standard periods per year from timestamp deltas.
   */
  public static detectFrequency(equityCurve: EquityPoint[]): {
    frequency: DataFrequency;
    periodsPerYear?: number;
  } {
    if (!equityCurve || equityCurve.length < 2) {
      return { frequency: 'UNKNOWN', periodsPerYear: undefined };
    }

    const deltasMs: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const tPrev = Date.parse(equityCurve[i - 1].timestamp);
      const tCurr = Date.parse(equityCurve[i].timestamp);
      if (!isNaN(tPrev) && !isNaN(tCurr) && tCurr > tPrev) {
        deltasMs.push(tCurr - tPrev);
      }
    }

    if (deltasMs.length === 0) {
      return { frequency: 'UNKNOWN', periodsPerYear: undefined };
    }

    // Sort to compute median delta
    deltasMs.sort((a, b) => a - b);
    const medianDeltaMs = deltasMs[Math.floor(deltasMs.length / 2)];
    const medianDays = medianDeltaMs / (1000 * 60 * 60 * 24);

    if (medianDays < 0.8) {
      return { frequency: 'INTRADAY', periodsPerYear: undefined };
    } else if (medianDays >= 0.8 && medianDays <= 4.5) {
      // Standard daily market data (including 3-day weekend gaps)
      return { frequency: 'DAILY', periodsPerYear: 252 };
    } else if (medianDays > 4.5 && medianDays <= 10.0) {
      return { frequency: 'WEEKLY', periodsPerYear: 52 };
    } else if (medianDays > 20.0 && medianDays <= 35.0) {
      return { frequency: 'MONTHLY', periodsPerYear: 12 };
    } else {
      return { frequency: 'UNKNOWN', periodsPerYear: undefined };
    }
  }

  /**
   * Calculates decimal periodic returns: r_t = (equity_t / equity_{t-1}) - 1
   */
  public static calculatePeriodicReturns(equityCurve: EquityPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev > 0) {
        returns.push(curr / prev - 1);
      }
    }
    return returns;
  }

  /**
   * Extracts aligned decimal returns for strategy and benchmark series.
   */
  public static calculateAlignedReturns(
    strategyEquity: EquityPoint[],
    benchmarkEquityPoints?: EquityPoint[]
  ): { strategyReturns: number[]; benchmarkReturns: number[] } {
    const strategyReturns: number[] = [];
    const benchmarkReturns: number[] = [];

    for (let i = 1; i < strategyEquity.length; i++) {
      const stratPrev = strategyEquity[i - 1].equity;
      const stratCurr = strategyEquity[i].equity;

      let benchPrev: number | undefined = strategyEquity[i - 1].benchmarkEquity;
      let benchCurr: number | undefined = strategyEquity[i].benchmarkEquity;

      if (benchmarkEquityPoints && benchmarkEquityPoints.length === strategyEquity.length) {
        benchPrev = benchmarkEquityPoints[i - 1].equity;
        benchCurr = benchmarkEquityPoints[i].equity;
      }

      if (
        stratPrev > 0 &&
        benchPrev !== undefined &&
        benchCurr !== undefined &&
        benchPrev > 0
      ) {
        strategyReturns.push(stratCurr / stratPrev - 1);
        benchmarkReturns.push(benchCurr / benchPrev - 1);
      }
    }

    return { strategyReturns, benchmarkReturns };
  }

  /**
   * Calculates comprehensive, auditable quantitative metrics matching institutional standards.
   */
  public static calculateMetrics(
    initialCapital: number,
    finalEquity: number,
    equityCurve: EquityPoint[],
    trades: BacktestTrade[],
    benchmarkReturnPct: number = 0,
    riskFreeRateAnnualPct: number = 3.0,
    explicitContext?: Partial<MetricsContext>
  ): BacktestMetrics {
    if (initialCapital <= 0) {
      throw new Error(`Initial capital must be strictly positive (received: ${initialCapital})`);
    }

    const calculatedMetrics: string[] = [];
    const unavailableMetrics: { metric: string; reason: string }[] = [];

    // 1. Frequency and Time Context Resolution
    const detected = FinancialMetricsCalculator.detectFrequency(equityCurve);
    const frequency: DataFrequency = explicitContext?.frequency ?? detected.frequency;
    let periodsPerYear: number | undefined = explicitContext?.periodsPerYear;

    if (periodsPerYear === undefined) {
      if (frequency === 'DAILY') periodsPerYear = 252;
      else if (frequency === 'WEEKLY') periodsPerYear = 52;
      else if (frequency === 'MONTHLY') periodsPerYear = 12;
      else periodsPerYear = undefined;
    }

    // 2. Total Net Return
    const totalReturnDecimal = (finalEquity / initialCapital) - 1;
    const totalReturnPct = totalReturnDecimal * 100;
    calculatedMetrics.push('totalReturnPct');

    // 3. Real-time CAGR Calculation
    let cagrPct: number | null = null;
    if (equityCurve.length >= 2) {
      const firstTs = Date.parse(equityCurve[0].timestamp);
      const lastTs = Date.parse(equityCurve[equityCurve.length - 1].timestamp);

      let elapsedYears = 0;
      if (!isNaN(firstTs) && !isNaN(lastTs) && lastTs > firstTs) {
        const elapsedDays = (lastTs - firstTs) / (1000 * 60 * 60 * 24);
        elapsedYears = elapsedDays / 365.2425;
      } else if (periodsPerYear && periodsPerYear > 0) {
        elapsedYears = (equityCurve.length - 1) / periodsPerYear;
      }

      if (elapsedYears > 0 && finalEquity > 0) {
        const cagrDecimal = Math.pow(finalEquity / initialCapital, 1 / elapsedYears) - 1;
        cagrPct = cagrDecimal * 100;
        calculatedMetrics.push('cagrPct');
      } else {
        unavailableMetrics.push({ metric: 'cagrPct', reason: 'Elapsed time <= 0 or non-positive equity' });
      }
    } else {
      unavailableMetrics.push({ metric: 'cagrPct', reason: 'Insufficient equity points (< 2)' });
    }
    const annualizedReturnPct = cagrPct;

    // 4. Periodic Decimal Returns
    const periodicReturns = FinancialMetricsCalculator.calculatePeriodicReturns(equityCurve);

    // 5. Periodic Risk-Free Rate
    const rfAnnual = riskFreeRateAnnualPct / 100;
    const rfPeriod = periodsPerYear && periodsPerYear > 0
      ? Math.pow(1 + rfAnnual, 1 / periodsPerYear) - 1
      : 0;

    // 6. Annualized Volatility
    let annualizedVolatilityPct: number | null = null;
    if (periodicReturns.length >= 2 && periodsPerYear && periodsPerYear > 0) {
      const periodVol = MathStats.sampleStdDev(periodicReturns);
      if (periodVol !== null) {
        annualizedVolatilityPct = periodVol * Math.sqrt(periodsPerYear) * 100;
        calculatedMetrics.push('annualizedVolatilityPct');
      } else {
        unavailableMetrics.push({ metric: 'annualizedVolatilityPct', reason: 'Could not compute sample std dev' });
      }
    } else {
      unavailableMetrics.push({
        metric: 'annualizedVolatilityPct',
        reason: periodsPerYear ? 'Insufficient periodic returns (< 2)' : `Unknown periodicity frequency: ${frequency}`
      });
    }

    // 7. Sharpe Ratio (computed on periodic excess returns)
    let sharpeRatio: number | null = null;
    if (periodicReturns.length >= 2 && periodsPerYear && periodsPerYear > 0) {
      const excessReturns = periodicReturns.map(r => r - rfPeriod);
      const meanExcess = MathStats.mean(excessReturns);
      const stdExcess = MathStats.sampleStdDev(excessReturns);

      if (meanExcess !== null && stdExcess !== null && stdExcess > 0) {
        sharpeRatio = (meanExcess / stdExcess) * Math.sqrt(periodsPerYear);
        calculatedMetrics.push('sharpeRatio');
      } else {
        unavailableMetrics.push({ metric: 'sharpeRatio', reason: 'Excess returns standard deviation is 0 or null' });
      }
    } else {
      unavailableMetrics.push({
        metric: 'sharpeRatio',
        reason: periodsPerYear ? 'Insufficient returns (< 2)' : `Unknown frequency: ${frequency}`
      });
    }

    // 8. Sortino Ratio (downside deviation with MAR = periodic rf)
    let sortinoRatio: number | null = null;
    if (periodicReturns.length >= 2 && periodsPerYear && periodsPerYear > 0) {
      const excessReturns = periodicReturns.map(r => r - rfPeriod);
      const meanExcess = MathStats.mean(excessReturns);

      const mar = rfPeriod;
      const downsideSquared = periodicReturns.map(r => {
        const d = Math.min(0, r - mar);
        return d * d;
      });

      const downsideVariance = MathStats.mean(downsideSquared);
      const downsideDeviation = downsideVariance !== null && downsideVariance > 0
        ? Math.sqrt(downsideVariance)
        : 0;

      if (meanExcess !== null && downsideDeviation > 0) {
        sortinoRatio = (meanExcess / downsideDeviation) * Math.sqrt(periodsPerYear);
        calculatedMetrics.push('sortinoRatio');
      } else {
        unavailableMetrics.push({ metric: 'sortinoRatio', reason: 'Downside deviation is 0 (no returns below MAR)' });
      }
    } else {
      unavailableMetrics.push({
        metric: 'sortinoRatio',
        reason: periodsPerYear ? 'Insufficient returns (< 2)' : `Unknown frequency: ${frequency}`
      });
    }

    // 9. Max Drawdown & Detailed Drawdown Duration
    let peak = initialCapital;
    let peakTimestamp = equityCurve[0]?.timestamp || '';
    let maxDrawdownPct = 0;
    let maxDrawdownStart: string | undefined = undefined;
    let maxDrawdownTrough: string | undefined = undefined;
    let maxDrawdownRecovery: string | null = null;

    let currentDrawdownBars = 0;
    let maxDrawdownDurationBars = 0;

    let worstDrawdownPeakTs = peakTimestamp;
    let worstDrawdownTroughTs = peakTimestamp;
    let worstDrawdownPeakVal = initialCapital;
    let worstDrawdownIdx = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      const eq = equityCurve[i].equity;
      const ts = equityCurve[i].timestamp;

      if (eq >= peak) {
        peak = eq;
        peakTimestamp = ts;
        currentDrawdownBars = 0;
      } else {
        const ddPct = ((peak - eq) / peak) * 100;
        currentDrawdownBars++;
        if (currentDrawdownBars > maxDrawdownDurationBars) {
          maxDrawdownDurationBars = currentDrawdownBars;
        }

        if (ddPct > maxDrawdownPct) {
          maxDrawdownPct = ddPct;
          worstDrawdownPeakTs = peakTimestamp;
          worstDrawdownTroughTs = ts;
          worstDrawdownPeakVal = peak;
          worstDrawdownIdx = i;
        }
      }
    }

    if (maxDrawdownPct > 0) {
      maxDrawdownStart = worstDrawdownPeakTs;
      maxDrawdownTrough = worstDrawdownTroughTs;

      // Look for recovery after trough
      for (let i = worstDrawdownIdx + 1; i < equityCurve.length; i++) {
        if (equityCurve[i].equity >= worstDrawdownPeakVal) {
          maxDrawdownRecovery = equityCurve[i].timestamp;
          break;
        }
      }
    }
    calculatedMetrics.push('maxDrawdownPct');

    // Calculate max drawdown duration in calendar days if valid timestamps
    let maxDrawdownDurationDays: number | null = null;
    if (maxDrawdownStart && maxDrawdownTrough) {
      const startMs = Date.parse(maxDrawdownStart);
      const endMs = maxDrawdownRecovery
        ? Date.parse(maxDrawdownRecovery)
        : Date.parse(equityCurve[equityCurve.length - 1].timestamp);
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        maxDrawdownDurationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
      }
    }

    // 10. Calmar Ratio
    let calmarRatio: number | null = null;
    if (cagrPct !== null && maxDrawdownPct > 0) {
      calmarRatio = (cagrPct / 100) / (maxDrawdownPct / 100);
      calculatedMetrics.push('calmarRatio');
    } else {
      unavailableMetrics.push({ metric: 'calmarRatio', reason: 'CAGR is null or Max Drawdown is 0' });
    }

    // 11. Trade Statistics & Expectancy
    const totalTrades = trades.length;
    const winningTradesList = trades.filter(t => t.netPnlEur > 0);
    const losingTradesList = trades.filter(t => t.netPnlEur < 0);
    const winningTrades = winningTradesList.length;
    const losingTrades = losingTradesList.length;

    const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const lossRatePct = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;

    const grossProfitEur = winningTradesList.reduce((sum, t) => sum + t.netPnlEur, 0);
    const grossLossEur = Math.abs(losingTradesList.reduce((sum, t) => sum + t.netPnlEur, 0));

    let profitFactor: number | null = null;
    if (grossLossEur > 0) {
      profitFactor = grossProfitEur / grossLossEur;
      calculatedMetrics.push('profitFactor');
    } else {
      unavailableMetrics.push({ metric: 'profitFactor', reason: 'No losing trades (gross loss is 0)' });
    }

    const avgTradeReturnPct = totalTrades > 0
      ? trades.reduce((sum, t) => sum + t.netReturnPct, 0) / totalTrades
      : 0;

    const avgWinReturnPct = winningTrades > 0
      ? winningTradesList.reduce((sum, t) => sum + t.netReturnPct, 0) / winningTrades
      : 0;

    const avgLossReturnPct = losingTrades > 0
      ? Math.abs(losingTradesList.reduce((sum, t) => sum + t.netReturnPct, 0)) / losingTrades
      : 0;

    let winLossRatio: number | null = null;
    if (avgLossReturnPct > 0) {
      winLossRatio = avgWinReturnPct / avgLossReturnPct;
      calculatedMetrics.push('winLossRatio');
    } else {
      unavailableMetrics.push({ metric: 'winLossRatio', reason: 'No losing trades to compute loss magnitude' });
    }

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
    const expectancyEur = (winProb * avgWinEur) - (lossProb * avgLossEur);
    const expectancyPct = totalTrades > 0 ? (winProb * avgWinReturnPct) - (lossProb * avgLossReturnPct) : null;
    calculatedMetrics.push('expectancyEur');

    // 12. Detailed Trading Costs
    const totalCommissionEur = trades.reduce((sum, t) => sum + (t.totalCommission ?? t.commissionPaid ?? 0), 0);
    const totalSlippageEur = trades.reduce((sum, t) => sum + (t.totalSlippage ?? t.slippagePaid ?? 0), 0);
    const totalTradingCostsEur = trades.reduce((sum, t) => sum + (t.totalTradingCosts ?? (t.totalCommission + t.totalSlippage) ?? 0), 0);
    const tradingCostsPctOfInitialCapital = (totalTradingCostsEur / initialCapital) * 100;
    const totalCommissionsPaidEur = totalTradingCostsEur; // legacy compatibility

    // 13. Market Exposure (% bars in an active position)
    const totalBars = equityCurve.length;
    const inMarketBars = trades.reduce((sum, t) => sum + t.holdingPeriodBars, 0);
    const marketExposurePct = totalBars > 0 ? (inMarketBars / totalBars) * 100 : 0;

    // 14. Aligned Benchmark Metrics (Beta, Alpha, Correlation, R², Information Ratio)
    const { strategyReturns: alignedStrat, benchmarkReturns: alignedBench } =
      FinancialMetricsCalculator.calculateAlignedReturns(equityCurve);

    let beta: number | null = null;
    let alphaAnnualizedPct: number | null = null;
    let benchmarkCorrelation: number | null = null;
    let rSquared: number | null = null;
    let informationRatio: number | null = null;

    if (alignedStrat.length >= 2 && alignedBench.length >= 2) {
      const benchVar = MathStats.sampleVariance(alignedBench);
      const cov = MathStats.covariance(alignedStrat, alignedBench);

      if (benchVar !== null && benchVar > 0 && cov !== null) {
        beta = cov / benchVar;
        calculatedMetrics.push('beta');
      } else {
        unavailableMetrics.push({ metric: 'beta', reason: 'Benchmark return variance is 0 or null' });
      }

      benchmarkCorrelation = MathStats.correlation(alignedStrat, alignedBench);
      if (benchmarkCorrelation !== null) {
        rSquared = benchmarkCorrelation * benchmarkCorrelation;
        calculatedMetrics.push('benchmarkCorrelation', 'rSquared');
      }

      // Real CAPM Jensen's Alpha
      if (beta !== null && periodsPerYear && periodsPerYear > 0) {
        const meanStrat = MathStats.mean(alignedStrat);
        const meanBench = MathStats.mean(alignedBench);
        if (meanStrat !== null && meanBench !== null) {
          const alphaPeriod = meanStrat - (rfPeriod + beta * (meanBench - rfPeriod));
          alphaAnnualizedPct = alphaPeriod * periodsPerYear * 100;
          calculatedMetrics.push('alphaAnnualizedPct');
        }
      } else {
        unavailableMetrics.push({
          metric: 'alphaAnnualizedPct',
          reason: beta === null ? 'Beta unavailable' : `Unknown frequency: ${frequency}`
        });
      }

      // Information Ratio
      if (periodsPerYear && periodsPerYear > 0) {
        const activeReturns = alignedStrat.map((r, i) => r - alignedBench[i]);
        const trackingErrorPeriod = MathStats.sampleStdDev(activeReturns);
        const meanActiveReturn = MathStats.mean(activeReturns);

        if (trackingErrorPeriod !== null && trackingErrorPeriod > 0 && meanActiveReturn !== null) {
          const trackingErrorAnnual = trackingErrorPeriod * Math.sqrt(periodsPerYear);
          const activeReturnAnnual = meanActiveReturn * periodsPerYear;
          informationRatio = activeReturnAnnual / trackingErrorAnnual;
          calculatedMetrics.push('informationRatio');
        } else {
          unavailableMetrics.push({ metric: 'informationRatio', reason: 'Tracking error is 0 (identical to benchmark)' });
        }
      } else {
        unavailableMetrics.push({ metric: 'informationRatio', reason: `Unknown frequency: ${frequency}` });
      }
    } else {
      unavailableMetrics.push(
        { metric: 'beta', reason: 'Insufficient aligned benchmark returns (< 2)' },
        { metric: 'alphaAnnualizedPct', reason: 'Insufficient aligned benchmark returns (< 2)' },
        { metric: 'benchmarkCorrelation', reason: 'Insufficient aligned benchmark returns (< 2)' },
        { metric: 'informationRatio', reason: 'Insufficient aligned benchmark returns (< 2)' }
      );
    }

    const alphaPct = alphaAnnualizedPct; // legacy alias

    // 15. Quality Diagnostics
    let quality: MetricsQuality = 'FULL';
    if (periodicReturns.length < 3) {
      quality = 'INSUFFICIENT_DATA';
    } else if (periodicReturns.length < 10 || frequency === 'UNKNOWN' || periodsPerYear === undefined) {
      quality = 'PARTIAL';
    }

    const diagnostics: MetricsDiagnostics = {
      quality,
      frequencyDetected: frequency,
      periodsPerYearUsed: periodsPerYear,
      calculatedMetrics,
      unavailableMetrics
    };

    return {
      initialCapital,
      finalEquity,
      totalReturnPct,
      annualizedReturnPct,
      cagrPct,
      benchmarkTotalReturnPct: benchmarkReturnPct,
      alphaPct,
      alphaAnnualizedPct,
      beta,
      benchmarkCorrelation,
      rSquared,
      informationRatio,
      annualizedVolatilityPct,
      maxDrawdownPct,
      maxDrawdownDurationBars,
      maxDrawdownDurationDays,
      maxDrawdownStart,
      maxDrawdownTrough,
      maxDrawdownRecovery,
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
      expectancyPct,
      totalCommissionEur,
      totalSlippageEur,
      totalTradingCostsEur,
      tradingCostsPctOfInitialCapital,
      totalCommissionsPaidEur,
      marketExposurePct,
      diagnostics
    };
  }
}
