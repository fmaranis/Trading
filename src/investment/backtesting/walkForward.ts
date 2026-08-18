import { PriceBar, BacktestResult, WalkForwardSplit, BacktestConfig } from '../backtesting/types';
import { IStrategy } from '../strategies/baseStrategy';
import { BacktestEngine } from '../backtesting/engine';

export class WalkForwardEngine {
  /**
   * Partitions historical data into In-Sample (training/calibration) and Out-Of-Sample (testing/validation)
   * to strictly test against curve-fitting / overfitting.
   */
  public static runWalkForwardValidation(
    strategy: IStrategy,
    bars: PriceBar[],
    trainRatio: number = 0.70, // 70% In-Sample, 30% Out-of-Sample
    config: Partial<BacktestConfig> = {},
    strategyParams?: Record<string, any>
  ): {
    inSampleResult: BacktestResult;
    outOfSampleResult: BacktestResult;
    efficiencyRatio: number; // Out-of-Sample Sharpe / In-Sample Sharpe
    isRobust: boolean;
    diagnosis: string;
  } {
    if (bars.length < 10) {
      throw new Error('Se requieren al menos 10 barras para análisis Walk-Forward.');
    }

    const splitIndex = Math.floor(bars.length * trainRatio);
    const inSampleBars = bars.slice(0, splitIndex);
    const outOfSampleBars = bars.slice(splitIndex);

    // Run In-Sample Backtest
    const inSampleResult = BacktestEngine.runBacktest(
      strategy,
      inSampleBars,
      'IN-SAMPLE',
      'Entrenamiento (In-Sample)',
      config,
      strategyParams,
      {
        sourceType: 'SYNTHETIC',
        provider: 'Walk-Forward In-Sample Split',
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
      'Validación Ciega (Out-of-Sample)',
      config,
      strategyParams,
      {
        sourceType: 'SYNTHETIC',
        provider: 'Walk-Forward Out-of-Sample Split',
        isReproducible: true,
        startDate: outOfSampleBars[0]?.timestamp,
        endDate: outOfSampleBars[outOfSampleBars.length - 1]?.timestamp,
        notes: `Partición Out-of-Sample ciega (${outOfSampleBars.length} barras)`
      }
    );

    const inSharpe = Math.max(0.01, inSampleResult.metrics.sharpeRatio);
    const outSharpe = outOfSampleResult.metrics.sharpeRatio;
    const efficiencyRatio = Number((outSharpe / inSharpe).toFixed(2));

    const isRobust = efficiencyRatio >= 0.50 && outOfSampleResult.metrics.totalReturnPct > -5.0;

    let diagnosis = '';
    if (efficiencyRatio >= 0.75) {
      diagnosis = 'Estrategia de Alta Robustez: El rendimiento se mantiene consistente en datos ciegos no vistos.';
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
