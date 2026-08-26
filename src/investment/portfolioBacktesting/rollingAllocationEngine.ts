import { DeterministicPortfolioAllocator } from '../portfolioAnalytics';
import { AlignedMultiAssetDataset, DynamicAllocationPolicy } from './types';

export interface RollingAllocationDecision {
  informationEndDate: string;
  historyBarsUsed: number;
  weights: Record<string, number>;
  cashWeight: number;
}

export class RollingAllocationEngine {
  static decide(
    aligned: AlignedMultiAssetDataset,
    executionIndex: number,
    policy: DynamicAllocationPolicy
  ): RollingAllocationDecision | null {
    if (executionIndex <= 0) return null;

    const lookback = Math.max(3, policy.lookbackBars ?? 60);
    const minHistory = Math.max(3, policy.minimumHistoryBars ?? lookback);
    const availableHistory = executionIndex;
    if (availableHistory < minHistory) return null;

    const start = Math.max(0, executionIndex - lookback - 1);
    const historyRows = aligned.rows.slice(start, executionIndex);
    if (historyRows.length < 3) return null;

    const historicalAligned: AlignedMultiAssetDataset = {
      assetIds: aligned.assetIds,
      tickers: aligned.tickers,
      policy: aligned.policy,
      rows: historyRows
    };

    const allocation = DeterministicPortfolioAllocator.allocate(historicalAligned, {
      method: policy.method,
      lookbackBars: Math.min(lookback, historyRows.length - 1),
      topK: policy.topK,
      minimumMomentumPct: policy.minimumMomentumPct
    });

    return {
      informationEndDate: historyRows[historyRows.length - 1].tradingDate,
      historyBarsUsed: historyRows.length,
      weights: allocation.weights,
      cashWeight: allocation.cashWeight
    };
  }
}
