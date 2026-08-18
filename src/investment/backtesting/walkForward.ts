import {
  PriceBar,
  BacktestResult,
  WalkForwardSplit,
  BacktestConfig,
  OptimizationMetric,
  ParameterRange,
  OptimizationEvaluation,
  WalkForwardConfig,
  WalkForwardWindowResult,
  WalkForwardOptimizationResult,
  HoldoutValidationResult,
  EquityPoint,
  BacktestTrade,
  BacktestMetrics,
  InvalidWalkForwardConfigurationError,
  ParameterGridTooLargeError
} from './types';
import { DataProvenance } from '../data/types';
import { IStrategy } from '../strategies/baseStrategy';
import { BacktestEngine } from './engine';
import { FinancialMetricsCalculator } from './metrics';
import { MathStats } from '../math/statistics';

export class WalkForwardEngine {
  /**
   * Calculates the total cartesian combination count without instantiating objects.
   */
  public static calculateGridSize(grid: ParameterRange[]): number {
    if (!grid || grid.length === 0) return 0;
    return grid.reduce((acc, param) => {
      const len = param.values && param.values.length > 0 ? param.values.length : 1;
      return acc * len;
    }, 1);
  }

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
   * Validates parameters against strategy-specific structural constraints before execution.
   */
  public static validateStrategyParameters(
    strategyId: string,
    params: Record<string, any>
  ): { valid: boolean; reason?: string } {
    if (!params) return { valid: true };

    // General risk / stop parameters
    if (params.trailingStopPct !== undefined && params.trailingStopPct <= 0) {
      return { valid: false, reason: 'trailingStopPct debe ser estrictamente mayor que 0' };
    }
    if (params.stopLossPct !== undefined && params.stopLossPct <= 0) {
      return { valid: false, reason: 'stopLossPct debe ser estrictamente mayor que 0' };
    }

    // SMA / Trend Crossover
    if (strategyId === 'sma_crossover' || strategyId.includes('sma') || strategyId.includes('crossover')) {
      const fast = params.fastPeriod;
      const slow = params.slowPeriod;
      if (fast !== undefined && fast <= 0) {
        return { valid: false, reason: 'fastPeriod debe ser estrictamente mayor que 0' };
      }
      if (slow !== undefined && slow <= 0) {
        return { valid: false, reason: 'slowPeriod debe ser estrictamente mayor que 0' };
      }
      if (fast !== undefined && slow !== undefined && fast >= slow) {
        return { valid: false, reason: `fastPeriod (${fast}) debe ser estrictamente menor que slowPeriod (${slow})` };
      }
    }

    // RSI Mean Reversion
    if (strategyId === 'rsi_mean_reversion' || strategyId.includes('rsi')) {
      const period = params.period;
      const oversold = params.oversoldThreshold ?? params.oversold;
      const overbought = params.overboughtThreshold ?? params.overbought;

      if (period !== undefined && period <= 0) {
        return { valid: false, reason: 'period de RSI debe ser estrictamente mayor que 0' };
      }
      if (oversold !== undefined && oversold <= 0) {
        return { valid: false, reason: 'oversold debe ser estrictamente mayor que 0' };
      }
      if (overbought !== undefined && overbought >= 100) {
        return { valid: false, reason: 'overbought debe ser estrictamente menor que 100' };
      }
      if (oversold !== undefined && overbought !== undefined && oversold >= overbought) {
        return { valid: false, reason: `RSI oversold (${oversold}) debe ser menor que overbought (${overbought})` };
      }
    }

    // Momentum Breakout
    if (strategyId === 'momentum_breakout' || strategyId.includes('momentum')) {
      const lookback = params.lookbackPeriod ?? params.lookback;
      if (lookback !== undefined && lookback <= 1) {
        return { valid: false, reason: 'lookbackPeriod debe ser estrictamente mayor que 1' };
      }
    }

    return { valid: true };
  }

  /**
   * Evaluates the objective score for a given backtest metrics result.
   * Returns a serializable OptimizationEvaluation object without -Infinity sentinels.
   */
  public static evaluateOptimizationScore(
    metrics: BacktestMetrics,
    metricType: OptimizationMetric,
    minimumTrades: number = 3
  ): OptimizationEvaluation {
    if (metrics.totalTrades < minimumTrades) {
      return {
        score: null,
        valid: false,
        rejectionReason: `MINIMUM_TRADES_NOT_MET (Trades ejecutados: ${metrics.totalTrades}, Mínimo requerido: ${minimumTrades})`
      };
    }

    switch (metricType) {
      case 'SHARPE': {
        if (metrics.sharpeRatio === null || isNaN(metrics.sharpeRatio)) {
          return { score: null, valid: false, rejectionReason: 'SHARPE_RATIO_NULL' };
        }
        return { score: Number(metrics.sharpeRatio.toFixed(4)), valid: true };
      }
      case 'SORTINO': {
        if (metrics.sortinoRatio === null || isNaN(metrics.sortinoRatio)) {
          return { score: null, valid: false, rejectionReason: 'SORTINO_RATIO_NULL' };
        }
        return { score: Number(metrics.sortinoRatio.toFixed(4)), valid: true };
      }
      case 'CALMAR': {
        if (metrics.calmarRatio === null || isNaN(metrics.calmarRatio)) {
          return { score: null, valid: false, rejectionReason: 'CALMAR_RATIO_NULL' };
        }
        return { score: Number(metrics.calmarRatio.toFixed(4)), valid: true };
      }
      case 'TOTAL_RETURN': {
        if (metrics.totalReturnPct === null || isNaN(metrics.totalReturnPct)) {
          return { score: null, valid: false, rejectionReason: 'TOTAL_RETURN_NULL' };
        }
        return { score: Number(metrics.totalReturnPct.toFixed(4)), valid: true };
      }
      case 'MAX_DRAWDOWN_ADJUSTED': {
        const dd = Math.max(0.5, metrics.maxDrawdownPct);
        const score = metrics.totalReturnPct / dd;
        if (isNaN(score)) {
          return { score: null, valid: false, rejectionReason: 'MAX_DRAWDOWN_ADJUSTED_NAN' };
        }
        return { score: Number(score.toFixed(4)), valid: true };
      }
      default: {
        if (metrics.sharpeRatio === null || isNaN(metrics.sharpeRatio)) {
          return { score: null, valid: false, rejectionReason: 'SHARPE_RATIO_NULL' };
        }
        return { score: Number(metrics.sharpeRatio.toFixed(4)), valid: true };
      }
    }
  }

  /**
   * Helper for internal score comparisons (delegates to evaluateOptimizationScore).
   */
  public static calculateOptimizationScore(
    metrics: BacktestMetrics,
    metricType: OptimizationMetric,
    minimumTrades: number = 3
  ): number {
    const evaluation = WalkForwardEngine.evaluateOptimizationScore(metrics, metricType, minimumTrades);
    return evaluation.valid && evaluation.score !== null ? evaluation.score : -Infinity;
  }

  /**
   * Calculates comprehensive parameter stability metrics using MathStats.
   */
  public static calculateParameterStabilityReport(
    parameterGrid: ParameterRange[],
    windows: WalkForwardWindowResult[]
  ): WalkForwardOptimizationResult['parameterStability'] {
    const successWindows = windows.filter(w => w.status === 'SUCCESS' && w.selectedParameters !== null);

    if (successWindows.length === 0 || parameterGrid.length === 0) {
      return {
        parameterStats: parameterGrid.map(p => ({
          parameter: p.name,
          selections: [],
          mean: null,
          stdDev: null,
          min: null,
          max: null,
          uniqueValues: 0,
          stabilityScore: null
        })),
        stabilityScore: null
      };
    }

    const parameterStats: WalkForwardOptimizationResult['parameterStability']['parameterStats'] = [];
    const stabilityScores: number[] = [];

    for (const pRange of parameterGrid) {
      const pName = pRange.name;
      const selections = successWindows
        .map(w => w.selectedParameters![pName])
        .filter((v): v is number => v !== undefined && !isNaN(v));

      if (selections.length === 0) {
        parameterStats.push({
          parameter: pName,
          selections: [],
          mean: null,
          stdDev: null,
          min: null,
          max: null,
          uniqueValues: 0,
          stabilityScore: null
        });
        continue;
      }

      const mean = MathStats.mean(selections);
      const stdDev = selections.length > 1 ? MathStats.sampleStdDev(selections) ?? 0 : 0;
      const minVal = MathStats.min(selections);
      const maxVal = MathStats.max(selections);

      const freqMap: Record<number, number> = {};
      for (const v of selections) {
        freqMap[v] = (freqMap[v] || 0) + 1;
      }
      const uniqueValues = Object.keys(freqMap).length;
      const maxCount = Math.max(...Object.values(freqMap));
      const modeFrequencyPct = (maxCount / selections.length) * 100;

      let paramStability: number;
      if (uniqueValues === 1) {
        paramStability = 100;
      } else {
        // Coefficient of Variation: CV = stdDev / |mean|
        const cv = mean !== null && Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 1;
        const cvStability = Math.max(0, Math.min(100, (1 - Math.min(1, cv)) * 100));
        // Blended: 50% mode frequency + 50% CV stability
        paramStability = Number((0.5 * modeFrequencyPct + 0.5 * cvStability).toFixed(1));
      }

      stabilityScores.push(paramStability);

      parameterStats.push({
        parameter: pName,
        selections,
        mean: mean !== null ? Number(mean.toFixed(2)) : null,
        stdDev: Number(stdDev.toFixed(2)),
        min: minVal !== null ? Number(minVal.toFixed(2)) : null,
        max: maxVal !== null ? Number(maxVal.toFixed(2)) : null,
        uniqueValues,
        stabilityScore: paramStability
      });
    }

    const overallStability = MathStats.mean(stabilityScores);

    return {
      parameterStats,
      stabilityScore: overallStability !== null ? Number(overallStability.toFixed(1)) : null
    };
  }

  /**
   * Partitions historical data into a single In-Sample (training) and Out-Of-Sample (holdout test) split.
   */
  public static runHoldoutValidation(
    strategy: IStrategy,
    bars: PriceBar[],
    trainRatio: number = 0.70, // 70% In-Sample, 30% Out-of-Sample
    config: Partial<BacktestConfig> = {},
    strategyParams?: Record<string, any>,
    dataProvenance?: DataProvenance
  ): HoldoutValidationResult {
    if (bars.length < 10) {
      throw new InvalidWalkForwardConfigurationError('Se requieren al menos 10 barras para análisis Holdout Validation.');
    }

    const splitIndex = Math.floor(bars.length * trainRatio);
    const inSampleBars = bars.slice(0, splitIndex);
    const outOfSampleBars = bars.slice(splitIndex);

    const baseProvenance: DataProvenance = dataProvenance ?? {
      sourceType: 'STATIC_REFERENCE',
      provider: 'Holdout Validation Dataset',
      isReproducible: true
    };

    // Run In-Sample Backtest
    const inSampleResult = BacktestEngine.runBacktest(
      strategy,
      inSampleBars,
      'IN-SAMPLE',
      'Entrenamiento (In-Sample Holdout)',
      config,
      strategyParams,
      {
        ...baseProvenance,
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
        ...baseProvenance,
        startDate: outOfSampleBars[0]?.timestamp,
        endDate: outOfSampleBars[outOfSampleBars.length - 1]?.timestamp,
        notes: `Partición Out-of-Sample ciega (${outOfSampleBars.length} barras)`
      }
    );

    const inSharpe = inSampleResult.metrics.sharpeRatio;
    const outSharpe = outOfSampleResult.metrics.sharpeRatio;

    let efficiencyRatio: number | null = null;
    if (inSharpe !== null && outSharpe !== null && inSharpe !== 0) {
      efficiencyRatio = Number((outSharpe / inSharpe).toFixed(2));
    }

    const isRobust = (efficiencyRatio !== null && efficiencyRatio >= 0.50) && outOfSampleResult.metrics.totalReturnPct > -5.0;

    let diagnosis = '';
    if (efficiencyRatio !== null && efficiencyRatio >= 0.75) {
      diagnosis = 'Estrategia de Alta Robustez: El rendimiento se mantiene consistente en el periodo ciego.';
    } else if (efficiencyRatio !== null && efficiencyRatio >= 0.50) {
      diagnosis = 'Estrategia Aceptable: Ligera degradación esperada fuera de muestra pero conserva edge cuantitativo.';
    } else {
      diagnosis = 'Alerta de Sobreajuste (Overfitting): El rendimiento se desplomó en el periodo ciego o es insuficiente.';
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
    strategyParams?: Record<string, any>,
    dataProvenance?: DataProvenance
  ): HoldoutValidationResult {
    return WalkForwardEngine.runHoldoutValidation(strategy, bars, trainRatio, config, strategyParams, dataProvenance);
  }

  /**
   * Executes a quantitative Walk-Forward Optimization (WFO) across rolling or expanding windows.
   */
  public static runWalkForwardOptimization(
    strategy: IStrategy,
    bars: PriceBar[],
    wfoConfig: WalkForwardConfig,
    backtestConfig: Partial<BacktestConfig> = {},
    dataProvenance?: DataProvenance
  ): WalkForwardOptimizationResult {
    const {
      trainWindowBars,
      testWindowBars,
      stepBars,
      optimizationMetric,
      minimumTrades = 3,
      minimumTrainBars,
      maxParameterCombinations = 500,
      parameterGrid,
      isExpandingWindow = false
    } = wfoConfig;

    // --- STEP 1 & 2: CONFIGURATION VALIDATIONS ---
    if (trainWindowBars <= 0) {
      throw new InvalidWalkForwardConfigurationError(`trainWindowBars debe ser estrictamente positivo (recibido: ${trainWindowBars}).`);
    }
    if (testWindowBars <= 0) {
      throw new InvalidWalkForwardConfigurationError(`testWindowBars debe ser estrictamente positivo (recibido: ${testWindowBars}).`);
    }
    if (stepBars <= 0) {
      throw new InvalidWalkForwardConfigurationError(`stepBars debe ser estrictamente positivo (recibido: ${stepBars}).`);
    }
    if (minimumTrainBars !== undefined && trainWindowBars < minimumTrainBars) {
      throw new InvalidWalkForwardConfigurationError(
        `trainWindowBars (${trainWindowBars}) es menor que minimumTrainBars requerido (${minimumTrainBars}).`
      );
    }
    if (bars.length < trainWindowBars + testWindowBars) {
      throw new InvalidWalkForwardConfigurationError(
        `Muestra de barras insuficiente (${bars.length}). Se requieren al menos ${trainWindowBars + testWindowBars} barras para Train (${trainWindowBars}) + Test (${testWindowBars}).`
      );
    }
    if (stepBars < testWindowBars) {
      throw new InvalidWalkForwardConfigurationError(
        `Configuración de Walk-Forward inválida: stepBars (${stepBars}) debe ser mayor o igual a testWindowBars (${testWindowBars}) para evitar solapamiento de ventanas Out-of-Sample en el track record.`
      );
    }

    // --- STEP 3: PARAMETER GRID LIMIT CHECK ---
    const totalCombinationsCount = WalkForwardEngine.calculateGridSize(parameterGrid);
    if (totalCombinationsCount > maxParameterCombinations) {
      throw new ParameterGridTooLargeError(
        `El espacio de parámetros (${totalCombinationsCount}) excede el límite máximo permitido de ${maxParameterCombinations} combinaciones.`
      );
    }

    const allParamCombinations = WalkForwardEngine.generateParameterCombinations(parameterGrid);
    if (allParamCombinations.length === 0) {
      throw new InvalidWalkForwardConfigurationError('La rejilla de parámetros (parameterGrid) no contiene combinaciones válidas.');
    }

    // Pre-calculate valid combinations for work estimation
    const validParamsForStrategy = allParamCombinations.filter(
      p => WalkForwardEngine.validateStrategyParameters(strategy.id, p).valid
    );

    // Calculate number of windows
    let testIdx = trainWindowBars;
    let numberOfWindows = 0;
    while (testIdx + testWindowBars <= bars.length) {
      numberOfWindows++;
      testIdx += stepBars;
    }

    // --- STEP 4: WORK ESTIMATION ---
    const estimatedBacktests = numberOfWindows * validParamsForStrategy.length + numberOfWindows;
    let executedBacktests = 0;

    // --- STEP 9 & 10: DATA PROVENANCE & EVIDENCE ---
    const baseProvenance: DataProvenance = dataProvenance ?? {
      sourceType: 'STATIC_REFERENCE',
      provider: 'Sistema Cuantitativo',
      isReproducible: true
    };

    const validationEvidence: WalkForwardOptimizationResult['validationEvidence'] =
      baseProvenance.sourceType === 'REAL'
        ? 'REAL_MARKET_DATA'
        : baseProvenance.sourceType === 'SYNTHETIC'
        ? 'SYNTHETIC_ONLY'
        : 'STATIC_REFERENCE_ONLY';

    const windowResults: WalkForwardWindowResult[] = [];
    let trainStartIdx = 0;
    let trainEndIdx = trainWindowBars;
    let windowCounter = 1;

    // Fixed normalized capital for TRAIN optimization (avoids parameter bias from changing wealth)
    const trainNormalizedCapital = 10000;

    // Compounded capital for Out-of-Sample TEST execution
    const initialCapital = backtestConfig.initialCapital ?? 10000;
    let runningOosCapital = initialCapital;
    let runningBenchmarkCapital = initialCapital;

    const combinedOutOfSampleEquity: EquityPoint[] = [];
    const combinedOutOfSampleTrades: BacktestTrade[] = [];

    // --- STEP 11 & 12: WFO WINDOW LOOP ---
    while (trainEndIdx + testWindowBars <= bars.length) {
      const actualTrainStartIdx = isExpandingWindow ? 0 : trainStartIdx;
      const trainBars = bars.slice(actualTrainStartIdx, trainEndIdx);
      const testBars = bars.slice(trainEndIdx, trainEndIdx + testWindowBars);

      let testedCombinations = 0;
      let rejectedCombinations = 0;
      let minimumTradesFilterRejections = 0;

      const validTrainScores: number[] = [];
      let bestParams: Record<string, number> | null = null;
      let bestTrainScore = -Infinity;
      let bestTrainResult: BacktestResult | null = null;

      // Phase 1: Train Optimization
      for (const params of allParamCombinations) {
        // Step 5: Parameter validator per strategy
        const validation = WalkForwardEngine.validateStrategyParameters(strategy.id, params);
        if (!validation.valid) {
          rejectedCombinations++;
          continue;
        }

        testedCombinations++;

        const trainResult = BacktestEngine.runBacktest(
          strategy,
          trainBars,
          'WFO-TRAIN',
          `WFO Ventana ${windowCounter} (Train)`,
          {
            ...backtestConfig,
            initialCapital: trainNormalizedCapital
          },
          params,
          {
            ...baseProvenance,
            startDate: trainBars[0]?.timestamp,
            endDate: trainBars[trainBars.length - 1]?.timestamp,
            notes: `Optimización In-Sample ventana ${windowCounter}`
          }
        );
        executedBacktests++;

        // Step 6 & 7: Optimization evaluation with minimumTrades
        const evalResult = WalkForwardEngine.evaluateOptimizationScore(
          trainResult.metrics,
          optimizationMetric,
          minimumTrades
        );

        if (!evalResult.valid || evalResult.score === null) {
          if (evalResult.rejectionReason?.includes('MINIMUM_TRADES')) {
            minimumTradesFilterRejections++;
          }
          continue;
        }

        validTrainScores.push(evalResult.score);

        if (evalResult.score > bestTrainScore || bestTrainResult === null) {
          bestTrainScore = evalResult.score;
          bestParams = params;
          bestTrainResult = trainResult;
        }
      }

      // Step 17: Parameter Sensitivity from TRAIN scores only
      let bestTrainScoreNum: number | null = null;
      let medianTrainScoreNum: number | null = null;
      let worstTrainScoreNum: number | null = null;
      let parameterSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' = 'UNKNOWN';

      if (validTrainScores.length > 0) {
        bestTrainScoreNum = MathStats.max(validTrainScores);
        medianTrainScoreNum = MathStats.median(validTrainScores);
        worstTrainScoreNum = MathStats.min(validTrainScores);

        if (validTrainScores.length >= 2 && bestTrainScoreNum !== null && worstTrainScoreNum !== null) {
          const range = bestTrainScoreNum - worstTrainScoreNum;
          const denom = medianTrainScoreNum !== null && Math.abs(medianTrainScoreNum) > 0.01
            ? Math.abs(medianTrainScoreNum)
            : 1;
          const relativeSpread = range / denom;

          if (relativeSpread < 0.35) {
            parameterSensitivity = 'LOW';
          } else if (relativeSpread <= 0.85) {
            parameterSensitivity = 'MEDIUM';
          } else {
            parameterSensitivity = 'HIGH';
          }
        }
      }

      // Step 8: If no valid parameters found in TRAIN
      if (bestTrainResult === null || bestParams === null) {
        windowResults.push({
          windowIndex: windowCounter,
          status: 'NO_VALID_PARAMETERS',
          trainStart: trainBars[0]?.timestamp || '',
          trainEnd: trainBars[trainBars.length - 1]?.timestamp || '',
          testStart: testBars[0]?.timestamp || '',
          testEnd: testBars[testBars.length - 1]?.timestamp || '',
          trainBarsCount: trainBars.length,
          testBarsCount: testBars.length,
          selectedParameters: null,
          testedCombinations,
          rejectedCombinations,
          minimumTradesFilterRejections,
          trainMetrics: null,
          testMetrics: null,
          trainResult: null,
          testResult: null,
          trainScore: null,
          testScore: null,
          efficiencyRatio: null,
          degradationPct: null,
          bestTrainScore: bestTrainScoreNum,
          medianTrainScore: medianTrainScoreNum,
          worstTrainScore: worstTrainScoreNum,
          parameterSensitivity
        });

        // Advance sliding window
        trainStartIdx += stepBars;
        trainEndIdx += stepBars;
        windowCounter++;
        continue;
      }

      // Phase 2: TEST execution strictly with running compounded capital
      const testResult = BacktestEngine.runBacktest(
        strategy,
        testBars,
        'WFO-TEST',
        `WFO Ventana ${windowCounter} (Test OOS)`,
        {
          ...backtestConfig,
          initialCapital: runningOosCapital
        },
        bestParams,
        {
          ...baseProvenance,
          startDate: testBars[0]?.timestamp,
          endDate: testBars[testBars.length - 1]?.timestamp,
          notes: `Validación Out-of-Sample ventana ${windowCounter} con parámetros congelados`
        }
      );
      executedBacktests++;

      // Evaluate TEST score (using minimumTrades = 0 to get score regardless of trade count in short window)
      const testEval = WalkForwardEngine.evaluateOptimizationScore(testResult.metrics, optimizationMetric, 0);
      const testScoreNum = testEval.score;
      const finalTrainScore = bestTrainScore !== -Infinity ? Number(bestTrainScore.toFixed(4)) : null;

      // Step 15: Exact WFE without denominator clamping
      let efficiencyRatio: number | null = null;
      if (finalTrainScore !== null && testScoreNum !== null && finalTrainScore !== 0) {
        efficiencyRatio = Number((testScoreNum / finalTrainScore).toFixed(2));
      }

      // Step 14: Degradation formula: (testScore - trainScore) / |trainScore| * 100
      let degradationPct: number | null = null;
      if (finalTrainScore !== null && testScoreNum !== null && finalTrainScore !== 0) {
        degradationPct = Number((((testScoreNum - finalTrainScore) / Math.abs(finalTrainScore)) * 100).toFixed(2));
      }

      windowResults.push({
        windowIndex: windowCounter,
        status: 'SUCCESS',
        trainStart: trainBars[0]?.timestamp || '',
        trainEnd: trainBars[trainBars.length - 1]?.timestamp || '',
        testStart: testBars[0]?.timestamp || '',
        testEnd: testBars[testBars.length - 1]?.timestamp || '',
        trainBarsCount: trainBars.length,
        testBarsCount: testBars.length,
        selectedParameters: bestParams,
        testedCombinations,
        rejectedCombinations,
        minimumTradesFilterRejections,
        trainMetrics: bestTrainResult.metrics,
        testMetrics: testResult.metrics,
        trainResult: bestTrainResult,
        testResult,
        trainScore: finalTrainScore,
        testScore: testScoreNum,
        efficiencyRatio,
        degradationPct,
        bestTrainScore: bestTrainScoreNum,
        medianTrainScore: medianTrainScoreNum,
        worstTrainScore: worstTrainScoreNum,
        parameterSensitivity
      });

      // Step 11 & 13: Continuous compounding of trades & benchmark equity
      for (const t of testResult.trades) {
        combinedOutOfSampleTrades.push({
          ...t,
          id: `WFO-W${windowCounter}-${t.id}`
        });
      }

      const winEqCurve = testResult.equityCurve;
      if (winEqCurve.length > 0) {
        const startBenchmarkEq = runningBenchmarkCapital;
        const firstBarClose = testBars[0]?.close || 1;
        const lastBarClose = testBars[testBars.length - 1]?.close || firstBarClose;

        for (let i = 0; i < winEqCurve.length; i++) {
          const pt = winEqCurve[i];
          const currentBarClose = testBars[i]?.close || firstBarClose;
          const currentBenchEquity = startBenchmarkEq * (firstBarClose > 0 ? currentBarClose / firstBarClose : 1);

          combinedOutOfSampleEquity.push({
            timestamp: pt.timestamp,
            equity: pt.equity,
            cash: pt.cash,
            positionMarketValue: pt.positionMarketValue,
            drawdownPct: 0, // Recalculated by FinancialMetricsCalculator
            benchmarkEquity: Number(currentBenchEquity.toFixed(2))
          });
        }

        // Update running capitals for next window
        runningOosCapital = testResult.metrics.finalEquity;
        runningBenchmarkCapital = startBenchmarkEq * (firstBarClose > 0 ? lastBarClose / firstBarClose : 1);
      }

      // Advance sliding window
      trainStartIdx += stepBars;
      trainEndIdx += stepBars;
      windowCounter++;
    }

    if (windowResults.length === 0) {
      throw new InvalidWalkForwardConfigurationError('No se pudo generar ninguna ventana de Walk-Forward válida con la configuración provista.');
    }

    // Benchmark total return %
    const benchmarkTotalReturnPct = initialCapital > 0
      ? ((runningBenchmarkCapital - initialCapital) / initialCapital) * 100
      : 0;

    // Calculate institutional out-of-sample metrics on stitched curve
    const combinedOutOfSampleMetrics = FinancialMetricsCalculator.calculateMetrics(
      initialCapital,
      runningOosCapital,
      combinedOutOfSampleEquity,
      combinedOutOfSampleTrades,
      benchmarkTotalReturnPct,
      backtestConfig.riskFreeRateAnnualPct ?? 3.0
    );

    // --- STEP 16: PARAMETER STABILITY REPORT ---
    const parameterStability = WalkForwardEngine.calculateParameterStabilityReport(parameterGrid, windowResults);

    // --- STEP 18: OUT-OF-SAMPLE CONSISTENCY ---
    const validSuccessWindows = windowResults.filter(w => w.status === 'SUCCESS' && w.testMetrics !== null);
    const profitableWindowsCount = validSuccessWindows.filter(w => w.testMetrics!.totalReturnPct > 0).length;
    const profitableWindowsPct = validSuccessWindows.length > 0
      ? Number(((profitableWindowsCount / validSuccessWindows.length) * 100).toFixed(1))
      : 0;

    const positiveScoreCount = validSuccessWindows.filter(w => w.testScore !== null && w.testScore > 0).length;
    const positiveScoreWindowsPct = validSuccessWindows.length > 0
      ? Number(((positiveScoreCount / validSuccessWindows.length) * 100).toFixed(1))
      : null;

    // --- STEP 15: GLOBAL WALK-FORWARD EFFICIENCY (WFE) ---
    const validScorePairs = validSuccessWindows.filter(w => w.trainScore !== null && w.testScore !== null);
    const meanTrainScore = MathStats.mean(validScorePairs.map(w => w.trainScore!));
    const meanTestScore = MathStats.mean(validScorePairs.map(w => w.testScore!));

    let averageEfficiencyRatio: number | null = null;
    if (meanTrainScore !== null && meanTestScore !== null && meanTrainScore !== 0) {
      averageEfficiencyRatio = Number((meanTestScore / meanTrainScore).toFixed(2));
    }

    // --- STEP 19: ROBUSTNESS SCORE WITH EXPLICIT 40/25/20/15 WEIGHTS ---
    // 1. OOS Performance (40% weight, 0-100 normalized)
    let oosPerformanceScore: number | null = null;
    const oosSharpe = combinedOutOfSampleMetrics.sharpeRatio;
    const oosReturn = combinedOutOfSampleMetrics.totalReturnPct;

    if (oosSharpe !== null) {
      const sharpeNorm = Math.max(0, Math.min(100, (oosSharpe / 1.5) * 80 + (oosReturn > 0 ? 20 : 0)));
      oosPerformanceScore = Number(sharpeNorm.toFixed(1));
    } else {
      oosPerformanceScore = Math.max(0, Math.min(100, (oosReturn + 10) * 3));
    }

    // 2. Degradation (25% weight, 0-100 normalized)
    let degradationScore: number | null = null;
    if (averageEfficiencyRatio !== null) {
      if (averageEfficiencyRatio >= 0.80) {
        degradationScore = 100;
      } else if (averageEfficiencyRatio > 0) {
        degradationScore = Number(((averageEfficiencyRatio / 0.80) * 100).toFixed(1));
      } else {
        degradationScore = 0;
      }
    }

    // 3. Parameter Stability (20% weight, 0-100 normalized)
    const paramStabilityScore = parameterStability.stabilityScore;

    // 4. Consistency (15% weight, 0-100 normalized)
    const consistencyScore = profitableWindowsPct;

    let robustnessScore: number | null = null;
    let isRobust = false;

    if (
      oosPerformanceScore !== null &&
      degradationScore !== null &&
      paramStabilityScore !== null
    ) {
      const weightedSum =
        0.40 * oosPerformanceScore +
        0.25 * degradationScore +
        0.20 * paramStabilityScore +
        0.15 * consistencyScore;

      robustnessScore = Math.min(100, Math.max(0, Math.round(weightedSum)));
      isRobust = robustnessScore >= 60 && combinedOutOfSampleMetrics.totalReturnPct > 0;
    }

    let diagnosis = '';
    if (robustnessScore !== null) {
      if (robustnessScore >= 75) {
        diagnosis = 'Excelente Robustez Cuantitativa: La estrategia supera pruebas ciegas continuas sin indicios de sobreajuste.';
      } else if (robustnessScore >= 50) {
        diagnosis = 'Robustez Moderada: Comportamiento fuera de muestra aceptable, con ligera degradación o sensibilidad temporal.';
      } else {
        diagnosis = 'Vulnerabilidad por Sobreajuste (Curve Fitting): Los parámetros optimizados en Train fallan al generalizar en Test ciego.';
      }
    } else {
      diagnosis = 'Diagnóstico No Disponible: Datos o ventanas válidas insuficientes para evaluar robustez.';
    }

    return {
      strategyName: strategy.name,
      config: wfoConfig,
      validationEvidence,
      estimatedBacktests,
      executedBacktests,
      windows: windowResults,
      combinedOutOfSampleEquity,
      combinedOutOfSampleMetrics,
      combinedOutOfSampleTrades,
      averageEfficiencyRatio,
      robustnessScore,
      robustnessComponents: {
        oosPerformance: oosPerformanceScore,
        degradation: degradationScore,
        parameterStability: paramStabilityScore,
        consistency: consistencyScore
      },
      profitableWindowsPct,
      positiveScoreWindowsPct,
      isRobust,
      diagnosis,
      parameterStability
    };
  }

  /**
   * Generates rolling walk-forward splits for continuous validation.
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
