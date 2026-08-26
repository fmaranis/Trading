import { PortfolioBacktestEngine, createEqualWeights } from './portfolioBacktestEngine';
import { MultiAssetDataset, PortfolioBacktestConfig, PortfolioBacktestResult } from './types';

export type PortfolioStrategyId = 'EQUAL_WEIGHT_STATIC' | 'INVERSE_VOLATILITY_ROLLING' | 'RISK_PARITY_ERC_ROLLING' | 'RELATIVE_MOMENTUM_ROLLING';

export interface PortfolioStrategyComparisonItem {
  strategyId: PortfolioStrategyId;
  label: string;
  result: PortfolioBacktestResult;
}

export interface PortfolioStrategyComparisonResult {
  portfolioDatasetFingerprint: string;
  items: PortfolioStrategyComparisonItem[];
  bestByTotalReturn: PortfolioStrategyId | null;
  bestBySharpe: PortfolioStrategyId | null;
  lowestMaxDrawdown: PortfolioStrategyId | null;
}

export class PortfolioStrategyComparator {
  static compare(dataset: MultiAssetDataset, baseConfig: Omit<PortfolioBacktestConfig, 'targetWeights' | 'dynamicAllocation'>, lookbackBars = 60): PortfolioStrategyComparisonResult {
    const assetIds = dataset.assets.map(a => a.assetId);
    const configs: Array<{ strategyId: PortfolioStrategyId; label: string; config: PortfolioBacktestConfig }> = [
      {
        strategyId: 'EQUAL_WEIGHT_STATIC',
        label: 'Equal Weight · Static',
        config: { ...baseConfig, targetWeights: createEqualWeights(assetIds) }
      },
      {
        strategyId: 'INVERSE_VOLATILITY_ROLLING',
        label: 'Inverse Volatility · Rolling',
        config: { ...baseConfig, targetWeights: {}, dynamicAllocation: { method: 'INVERSE_VOLATILITY', lookbackBars, minimumHistoryBars: lookbackBars + 1 } }
      },
      {
        strategyId: 'RISK_PARITY_ERC_ROLLING',
        label: 'Risk Parity ERC · Rolling',
        config: { ...baseConfig, targetWeights: {}, dynamicAllocation: { method: 'RISK_PARITY_ERC', lookbackBars, minimumHistoryBars: lookbackBars + 1 } }
      },
      {
        strategyId: 'RELATIVE_MOMENTUM_ROLLING',
        label: 'Momentum Relativo · Rolling',
        config: { ...baseConfig, targetWeights: {}, dynamicAllocation: { method: 'RELATIVE_MOMENTUM', lookbackBars, minimumHistoryBars: lookbackBars + 1, topK: Math.min(2, assetIds.length), minimumMomentumPct: 0 } }
      }
    ];

    const items = configs.map(x => ({ strategyId: x.strategyId, label: x.label, result: PortfolioBacktestEngine.run(dataset, x.config) }));
    const fingerprint = items[0]?.result.provenance.portfolioDatasetFingerprint ?? '';
    if (items.some(x => x.result.provenance.portfolioDatasetFingerprint !== fingerprint)) throw new Error('Los motores de comparación no utilizaron el mismo portfolioDatasetFingerprint.');

    const byReturn = [...items].sort((a, b) => b.result.metrics.financial.totalReturnPct - a.result.metrics.financial.totalReturnPct);
    const validSharpe = items.filter(x => x.result.metrics.financial.sharpeRatio != null).sort((a, b) => (b.result.metrics.financial.sharpeRatio ?? -Infinity) - (a.result.metrics.financial.sharpeRatio ?? -Infinity));
    const byDrawdown = [...items].sort((a, b) => a.result.metrics.financial.maxDrawdownPct - b.result.metrics.financial.maxDrawdownPct);

    return {
      portfolioDatasetFingerprint: fingerprint,
      items,
      bestByTotalReturn: byReturn[0]?.strategyId ?? null,
      bestBySharpe: validSharpe[0]?.strategyId ?? null,
      lowestMaxDrawdown: byDrawdown[0]?.strategyId ?? null
    };
  }
}
