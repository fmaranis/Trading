import { PriceBar, BacktestResult, StrategyComparisonItem, BacktestConfig } from '../backtesting/types';
import { IStrategy } from '../strategies/baseStrategy';
import { ALL_QUANT_STRATEGIES } from '../strategies/standardStrategies';
import { BacktestEngine } from '../backtesting/engine';

export class StrategyComparator {
  /**
   * Runs all available quantitative strategies on the same asset dataset and generates a standardized comparison matrix.
   */
  public static compareAll(
    bars: PriceBar[],
    assetTicker: string = 'ASSET',
    assetName: string = 'Activo de Inversión',
    config: Partial<BacktestConfig> = {},
    strategies: IStrategy[] = ALL_QUANT_STRATEGIES
  ): {
    ranking: StrategyComparisonItem[];
    detailedResults: Record<string, BacktestResult>;
    bestBySharpe: StrategyComparisonItem;
    bestByReturn: StrategyComparisonItem;
    safestByDrawdown: StrategyComparisonItem;
  } {
    const detailedResults: Record<string, BacktestResult> = {};
    const comparisonItems: StrategyComparisonItem[] = [];

    for (const strat of strategies) {
      const res = BacktestEngine.runBacktest(strat, bars, assetTicker, assetName, config);
      detailedResults[strat.id] = res;

      comparisonItems.push({
        strategyId: strat.id,
        strategyName: strat.name,
        totalReturnPct: res.metrics.totalReturnPct,
        annualizedReturnPct: res.metrics.annualizedReturnPct,
        sharpeRatio: res.metrics.sharpeRatio,
        sortinoRatio: res.metrics.sortinoRatio,
        maxDrawdownPct: res.metrics.maxDrawdownPct,
        profitFactor: res.metrics.profitFactor,
        winRatePct: res.metrics.winRatePct,
        totalTrades: res.metrics.totalTrades,
        equityCurve: res.equityCurve.map(pt => ({ timestamp: pt.timestamp, equity: pt.equity }))
      });
    }

    // Rank by Sharpe Ratio descending
    const ranking = [...comparisonItems].sort((a, b) => b.sharpeRatio - a.sharpeRatio);

    const bestBySharpe = [...comparisonItems].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0];
    const bestByReturn = [...comparisonItems].sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];
    const safestByDrawdown = [...comparisonItems].sort((a, b) => a.maxDrawdownPct - b.maxDrawdownPct)[0];

    return {
      ranking,
      detailedResults,
      bestBySharpe,
      bestByReturn,
      safestByDrawdown
    };
  }
}
