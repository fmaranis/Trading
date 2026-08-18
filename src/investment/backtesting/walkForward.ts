import {
  PriceBar,
  BacktestResult,
  WalkForwardSplit,
  BacktestConfig,
  OptimizationMetric,
  ParameterRange,
  WalkForwardConfig,
  WalkForwardWindowResult,
  WalkForwardOptimizationResult,
  HoldoutValidationResult,
  EquityPoint,
  BacktestTrade,
  BacktestMetrics
} from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { BacktestEngine } from './engine';
import { FinancialMetricsCalculator } from './metrics';

export class WalkForwardEngine {
  /**
   * Generates cartesian product of all parameter ranges in the grid.
   */
  public static generateParameterCombinations(
    grid: ParameterRange[]
  ): Record<string, number>[] {
    if (!grid || grid.length === 0) return [{}];

    let combinations: Record<string, number>[] = [{}];

    for (const param of grid) {
      const nextCombinations: Record<string, number>[] = [];
      const values = param.values && param.values.length > 0 ? param.values : [0];

      for (const existing of combinations) {
        for (const val of values) {
          nextCombinations.push({
            ...existing,
            [param.name]: val
          });
        }
      }
      combinations = nextCombinations;
    }

    return combinations;
  }

  /**
   * Evaluates the objective score for a given backtest metrics result.
   */
  public static calculateOptimizationScore(
    metrics: BacktestMetrics,
    metricType: OptimizationMetric,
    minimumTrades: number = 1
  ): number {
    // If trade count requirement is not satisfied, heavily penalize to prevent zero-trade overfitting
    if (metrics.totalTrades < minimumTrades) {
      return -Infinity;
    }

    switch (metricType) {
      case 'SHARPE': {
        return metrics.sharpeRatio !== null ? metrics.sharpeRatio : -Infinity;
      }
      case 'SORTINO': {
        return metrics.sortinoRatio !== null ? metrics.sortinoRatio : -Infinity;
      }
      case 'CALMAR': {
        return metrics.calmarRatio !== null ? metrics.calmarRatio : -Infinity;
      }
      case 'TOTAL_RETURN': {
        return metrics.totalReturnPct;
      }
      case 'MAX_DRAWDOWN_ADJUSTED': {
        // Total return penalized by Max Drawdown (MAR-like)
        const dd = Math.max(0.5, metrics.maxDrawdownPct);
        return metrics.totalReturnPct / dd;
      }
      default:
        return metrics.sharpeRatio !== null ? metrics.sharpeRatio : -Infinity;
    }
  }

  /**
   * Partitions historical data into a single In-Sample (training) and Out-Of-Sample (holdout test) split.
   * Useful for initial validation, but distinct from rolling Walk-Forward Optimization.
   */
  public static runHoldoutValidation(
    strategy: IStrategy,
    bars: PriceBar[],
    trainRatio: number = 0.70, // 70% In-Sample, 30% Out-of-Sample
    config: Partial<BacktestConfig> = {},
    strategyParams?: Record<string, any>
  ): HoldoutValidationResult {
    if (bars.length < 10) {
      throw new Error('Se requieren al menos 10 barras para análisis Holdout Validation.');
    }

    const splitIndex = Math.floor(bars.length * trainRatio);
    const inSampleBars = bars.slice(0, splitIndex);
    const outOfSampleBars = bars.slice(splitIndex);

    // Run In-Sample Backtest
    const inSampleResult = BacktestEngine.runBacktest(
      strategy,
      inSampleBars,
      'IN-SAMPLE',
      'Entrenamiento (In-Sample Holdout)',
      config,
      strategyParams,
      {
        sourceType: 'SYNTHETIC',
        provider: 'Holdout Validation In-Sample',
        isReproducible: true,
        startDate: inSampleBars[0]?.timestamp,
        endDate: inSampleBars[inSampleBars.length - 1]?.timestamp,
        notes: `Partición In-Sample (${inSampleBars.length} barras, ratio ${Math.round(trainRatio * 100)}%)`
      }
    );

    // Run Out-Of-Sample Backtest (Strictly unseen data)
    const outOfSampleResult = BacktestEngine.runBacktest(
      strategy,
      outOfSampleBars,
      'OUT-OF-SAMPLE',
      'Validación Ciega (Out-of-Sample Holdout)',
      config,
      strategyParams,
      {
        sourceType: 'SYNTHETIC',
        provider: 'Holdout Validation Out-of-Sample',
        isReproducible: true,
        startDate: outOfSampleBars[0]?.timestamp,
        endDate: outOfSampleBars[outOfSampleBars.length - 1]?.timestamp,
        notes: `Partición Out-of-Sample ciega (${outOfSampleBars.length} barras)`
      }
    );

    const inSharpe = inSampleResult.metrics.sharpeRatio !== null ? Math.max(0.01, inSampleResult.metrics.sharpeRatio) : 0.01;
    const outSharpe = outOfSampleResult.metrics.sharpeRatio !== null ? outOfSampleResult.metrics.sharpeRatio : 0;
    const efficiencyRatio = Number((outSharpe / inSharpe).toFixed(2));

    const isRobust = efficiencyRatio >= 0.50 && outOfSampleResult.metrics.totalReturnPct > -5.0;

    let diagnosis = '';
    if (efficiencyRatio >= 0.75) {
      diagnosis = 'Estrategia de Alta Robustez: El rendimiento se mantiene consistente en el periodo ciego.';
    } else if (efficiencyRatio >= 0.50) {
      diagnosis = 'Estrategia Aceptable: Ligera degradación esperada fuera de muestra pero conserva edge cuantitativo.';
    } else {
      diagnosis = 'Alerta de Sobreajuste (Overfitting): El rendimiento se desplomó en el periodo ciego.';
    }

    return {
      inSampleResult,
      outOfSampleResult,
      efficiencyRatio,
      isRobust,
      diagnosis
    };
  }

  /**
   * Backwards-compatible alias for runHoldoutValidation.
   */
  public static runWalkForwardValidation(
    strategy: IStrategy,
    bars: PriceBar[],
    trainRatio: number = 0.70,
    config: Partial<BacktestConfig> = {},
    strategyParams?: Record<string, any>
  ): HoldoutValidationResult {
    return WalkForwardEngine.runHoldoutValidation(strategy, bars, trainRatio, config, strategyParams);
  }

  /**
   * Executes a quantitative Walk-Forward Optimization (WFO) across rolling or expanding windows.
   * 
   * Process:
   * 1. Window i TRAIN: Optimize parameters strictly using training window bars.
   * 2. Window i TEST: Freeze optimal parameters and evaluate exclusively on out-of-sample test bars.
   * 3. Advance window by stepBars and repeat.
   * 4. Stitch out-of-sample equity & trades into a master continuous out-of-sample track record.
   * 5. Quantify Walk-Forward Efficiency and parameter stability.
   */
  public static runWalkForwardOptimization(
    strategy: IStrategy,
    bars: PriceBar[],
    wfoConfig: WalkForwardConfig,
    backtestConfig: Partial<BacktestConfig> = {}
  ): WalkForwardOptimizationResult {
    const {
      trainWindowBars,
      testWindowBars,
      stepBars,
      optimizationMetric,
      minimumTrades = 1,
      parameterGrid,
      isExpandingWindow = false
    } = wfoConfig;

    if (bars.length < trainWindowBars + testWindowBars) {
      throw new Error(
        `Muestra de barras insuficiente (${bars.length}). Se requieren al menos ${trainWindowBars + testWindowBars} barras para Train (${trainWindowBars}) + Test (${testWindowBars}).`
      );
    }

    if (stepBars <= 0) {
      throw new Error(`stepBars debe ser estrictamente positivo (recibido: ${stepBars}).`);
    }

    const paramCombinations = WalkForwardEngine.generateParameterCombinations(parameterGrid);
    if (paramCombinations.length === 0) {
      throw new Error('La rejilla de parámetros (parameterGrid) no contiene combinaciones válidas.');
    }

    const windowResults: WalkForwardWindowResult[] = [];
    let trainStartIdx = 0;
    let trainEndIdx = trainWindowBars;
    let windowCounter = 1;

    while (trainEndIdx + testWindowBars <= bars.length) {
      const actualTrainStartIdx = isExpandingWindow ? 0 : trainStartIdx;
      const trainBars = bars.slice(actualTrainStartIdx, trainEndIdx);
      const testBars = bars.slice(trainEndIdx, trainEndIdx + testWindowBars);

      // --- PHASE 1: TRAIN OPTIMIZATION (In-Sample) ---
      let bestParams = paramCombinations[0];
      let bestScore = -Infinity;
      let bestTrainResult: BacktestResult | null = null;

      for (const params of paramCombinations) {
        const trainResult = BacktestEngine.runBacktest(
          strategy,
          trainBars,
          'WFO-TRAIN',
          `WFO Ventana ${windowCounter} (Train)`,
          backtestConfig,
          params,
          {
            sourceType: 'SYNTHETIC',
            provider: `WFO Window ${windowCounter} Train`,
            isReproducible: true,
            startDate: trainBars[0]?.timestamp,
            endDate: trainBars[trainBars.length - 1]?.timestamp,
            notes: `Optimización In-Sample ventana ${windowCounter}`
          }
        );

        const score = WalkForwardEngine.calculateOptimizationScore(
          trainResult.metrics,
          optimizationMetric,
          minimumTrades
        );

        if (score > bestScore || bestTrainResult === null) {
          bestScore = score;
          bestParams = params;
          bestTrainResult = trainResult;
        }
      }

      if (!bestTrainResult) {
        throw new Error(`Fallo al optimizar en ventana de entrenamiento ${windowCounter}.`);
      }

      // --- PHASE 2: TEST EVALUATION (Strictly Out-of-Sample with frozen parameters) ---
      const testResult = BacktestEngine.runBacktest(
        strategy,
        testBars,
        'WFO-TEST',
        `WFO Ventana ${windowCounter} (Test OOS)`,
        backtestConfig,
        bestParams,
        {
          sourceType: 'SYNTHETIC',
          provider: `WFO Window ${windowCounter} Test OOS`,
          isReproducible: true,
          startDate: testBars[0]?.timestamp,
          endDate: testBars[testBars.length - 1]?.timestamp,
          notes: `Validación Out-of-Sample ventana ${windowCounter} con parámetros congelados`
        }
      );

      // Efficiency calculation for this window
      const trainMetricScore = WalkForwardEngine.calculateOptimizationScore(bestTrainResult.metrics, optimizationMetric, 0);
      const testMetricScore = WalkForwardEngine.calculateOptimizationScore(testResult.metrics, optimizationMetric, 0);

      let efficiencyRatio = 0;
      if (optimizationMetric === 'SHARPE') {
        const trSharpe = bestTrainResult.metrics.sharpeRatio !== null ? Math.max(0.01, bestTrainResult.metrics.sharpeRatio) : 0.01;
        const tsSharpe = testResult.metrics.sharpeRatio !== null ? testResult.metrics.sharpeRatio : 0;
        efficiencyRatio = Number((tsSharpe / trSharpe).toFixed(2));
      } else {
        const denom = trainMetricScore !== 0 && !isNaN(trainMetricScore) ? Math.abs(trainMetricScore) : 1;
        efficiencyRatio = Number((testMetricScore / denom).toFixed(2));
      }

      windowResults.push({
        windowIndex: windowCounter,
        trainStart: trainBars[0]?.timestamp || '',
        trainEnd: trainBars[trainBars.length - 1]?.timestamp || '',
        testStart: testBars[0]?.timestamp || '',
        testEnd: testBars[testBars.length - 1]?.timestamp || '',
        trainBarsCount: trainBars.length,
        testBarsCount: testBars.length,
        selectedParameters: bestParams,
        trainMetrics: bestTrainResult.metrics,
        testMetrics: testResult.metrics,
        trainResult: bestTrainResult,
        testResult,
        efficiencyRatio,
        parameterEvaluationsCount: paramCombinations.length
      });

      // Advance sliding window
      trainStartIdx += stepBars;
      trainEndIdx += stepBars;
      windowCounter++;
    }

    if (windowResults.length === 0) {
      throw new Error('No se pudo generar ninguna ventana de Walk-Forward válida con la configuración provista.');
    }

    // --- PHASE 3: STITCHING OUT-OF-SAMPLE EQUITY CURVE & TRADES ---
    const initialCapital = backtestConfig.initialCapital ?? 10000;
    let runningEquity = initialCapital;
    const combinedOutOfSampleEquity: EquityPoint[] = [];
    const combinedOutOfSampleTrades: BacktestTrade[] = [];

    // Track baseline benchmark equity chaining as well
    let runningBenchmarkEquity = initialCapital;

    for (let w = 0; w < windowResults.length; w++) {
      const win = windowResults[w];
      const winEqCurve = win.testResult.equityCurve;
      const winInitialCap = win.testResult.metrics.initialCapital;

      // Add trades from this test window
      for (const t of win.testResult.trades) {
        combinedOutOfSampleTrades.push({
          ...t,
          id: `WFO-W${win.windowIndex}-${t.id}`
        });
      }

      if (winEqCurve.length > 0) {
        const startWindowEq = runningEquity;
        const startBenchmarkEq = runningBenchmarkEquity;
        const firstPoint = winEqCurve[0];
        const benchInitial = firstPoint.benchmarkEquity ?? winInitialCap;

        for (let i = 0; i < winEqCurve.length; i++) {
          const pt = winEqCurve[i];
          const returnFactor = winInitialCap > 0 ? pt.equity / winInitialCap : 1;
          const currentPointEquity = startWindowEq * returnFactor;

          const benchFactor = benchInitial > 0 && pt.benchmarkEquity ? pt.benchmarkEquity / benchInitial : 1;
          const currentPointBenchEquity = startBenchmarkEq * benchFactor;

          combinedOutOfSampleEquity.push({
            timestamp: pt.timestamp,
            equity: Number(currentPointEquity.toFixed(2)),
            cash: Number((pt.cash * (startWindowEq / winInitialCap)).toFixed(2)),
            positionMarketValue: Number((pt.positionMarketValue * (startWindowEq / winInitialCap)).toFixed(2)),
            drawdownPct: 0, // Recalculated by metrics calculator
            benchmarkEquity: Number(currentPointBenchEquity.toFixed(2))
          });
        }

        // Update running capital to end of this window
        const lastPt = winEqCurve[winEqCurve.length - 1];
        runningEquity = startWindowEq * (lastPt.equity / winInitialCap);
        if (lastPt.benchmarkEquity && benchInitial > 0) {
          runningBenchmarkEquity = startBenchmarkEq * (lastPt.benchmarkEquity / benchInitial);
        }
      }
    }

    // Benchmark total return %
    const benchmarkTotalReturnPct = ((runningBenchmarkEquity - initialCapital) / initialCapital) * 100;

    // Calculate institutional out-of-sample metrics on stitched curve
    const combinedOutOfSampleMetrics = FinancialMetricsCalculator.calculateMetrics(
      initialCapital,
      runningEquity,
      combinedOutOfSampleEquity,
      combinedOutOfSampleTrades,
      benchmarkTotalReturnPct,
      backtestConfig.riskFreeRateAnnualPct ?? 3.0
    );

    // --- PHASE 4: PARAMETER STABILITY ANALYSIS ---
    const parameterStability: Record<string, {
      values: number[];
      distinctValuesCount: number;
      mostFrequentValue: number;
      stabilityPct: number;
    }> = {};

    for (const pRange of parameterGrid) {
      const pName = pRange.name;
      const chosenValues = windowResults.map(w => w.selectedParameters[pName]);
      const freqMap: Record<number, number> = {};

      for (const v of chosenValues) {
        freqMap[v] = (freqMap[v] || 0) + 1;
      }

      let maxCount = 0;
      let mostFreqVal = chosenValues[0] ?? 0;
      for (const [valStr, count] of Object.entries(freqMap)) {
        if (count > maxCount) {
          maxCount = count;
          mostFreqVal = Number(valStr);
        }
      }

      const stabilityPct = chosenValues.length > 0 ? (maxCount / chosenValues.length) * 100 : 100;

      parameterStability[pName] = {
        values: chosenValues,
        distinctValuesCount: Object.keys(freqMap).length,
        mostFrequentValue: mostFreqVal,
        stabilityPct: Number(stabilityPct.toFixed(1))
      };
    }

    // --- PHASE 5: SUMMARY AND QUANTITATIVE ROBUSTNESS SCORE ---
    const avgEfficiency = windowResults.reduce((sum, w) => sum + w.efficiencyRatio, 0) / windowResults.length;
    const profitableWindows = windowResults.filter(w => w.testMetrics.totalReturnPct > 0).length;
    const profitableWindowsPct = (profitableWindows / windowResults.length) * 100;

    // Robustness Score (0 - 100)
    let score = 0;
    // 1. Out-of-sample return > 0 (up to 30 pts)
    if (combinedOutOfSampleMetrics.totalReturnPct > 0) {
      score += Math.min(30, combinedOutOfSampleMetrics.totalReturnPct * 2);
    }
    // 2. Average efficiency ratio >= 0.50 (up to 30 pts)
    if (avgEfficiency >= 0.70) score += 30;
    else if (avgEfficiency >= 0.50) score += 20;
    else if (avgEfficiency >= 0.30) score += 10;

    // 3. Profitable windows % (up to 25 pts)
    score += (profitableWindowsPct / 100) * 25;

    // 4. Parameter stability (up to 15 pts)
    const avgStability = Object.values(parameterStability).reduce((sum, p) => sum + p.stabilityPct, 0) / (Object.keys(parameterStability).length || 1);
    score += (avgStability / 100) * 15;

    const robustnessScore = Math.min(100, Math.max(0, Math.round(score)));
    const isRobust = robustnessScore >= 60 && combinedOutOfSampleMetrics.totalReturnPct > 0;

    let diagnosis = '';
    if (robustnessScore >= 75) {
      diagnosis = 'Excelente Robustez Cuantitativa: La estrategia supera pruebas ciegas continuas sin curve-fitting.';
    } else if (robustnessScore >= 50) {
      diagnosis = 'Robustez Moderada: Comportamiento fuera de muestra aceptable, con ligera sensibilidad a regímenes de mercado.';
    } else {
      diagnosis = 'Vulnerabilidad por Sobreajuste: Los parámetros optimizados en Train fallan al generalizar en Test ciego.';
    }

    return {
      strategyName: strategy.name,
      config: wfoConfig,
      windows: windowResults,
      combinedOutOfSampleEquity,
      combinedOutOfSampleMetrics,
      combinedOutOfSampleTrades,
      averageEfficiencyRatio: Number(avgEfficiency.toFixed(2)),
      robustnessScore,
      profitableWindowsPct: Number(profitableWindowsPct.toFixed(1)),
      isRobust,
      diagnosis,
      parameterStability
    };
  }

  /**
   * Generates rolling walk-forward splits for continuous validation
   */
  public static generateRollingSplits(
    bars: PriceBar[],
    numSplits: number = 3,
    inSampleWindowBars: number = 30,
    outOfSampleWindowBars: number = 15
  ): WalkForwardSplit[] {
    const splits: WalkForwardSplit[] = [];
    let startIdx = 0;

    for (let i = 0; i < numSplits; i++) {
      const inEnd = startIdx + inSampleWindowBars;
      const outEnd = inEnd + outOfSampleWindowBars;

      if (outEnd > bars.length) break;

      splits.push({
        splitIndex: i + 1,
        inSampleBars: bars.slice(startIdx, inEnd),
        outOfSampleBars: bars.slice(inEnd, outEnd)
      });

      startIdx += outOfSampleWindowBars;
    }

    return splits;
  }
}
