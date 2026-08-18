import { PriceBar } from '../backtesting/types';
import { Asset } from '../../types';
import { SyntheticDataGenerator } from './syntheticDataGenerator';

/**
 * HistoricalDataTransformer maintains backward compatibility while delegating
 * to the new deterministic SyntheticDataGenerator.
 */
export class HistoricalDataTransformer {
  /**
   * Converts existing Asset historical prices into daily synthetic OHLCV bars
   * using a deterministic PRNG seed for perfect reproducibility.
   */
  public static assetToPriceBars(asset: Asset, numSubBars: number = 60, seed?: number): PriceBar[] {
    const { bars } = SyntheticDataGenerator.generateFromAsset(asset, {
      totalBars: numSubBars,
      seed
    });
    return bars;
  }

  /**
   * Generates Brownian motion trajectory from 1y return & annualized volatility
   */
  public static generateSyntheticTrajectory(
    currentPrice: number,
    annualReturnPct: number,
    annualVolatilityPct: number,
    totalBars: number = 60,
    seed?: number
  ): PriceBar[] {
    const { bars } = SyntheticDataGenerator.generateGeometricBrownianTrajectory(
      currentPrice,
      annualReturnPct,
      annualVolatilityPct,
      { totalBars, seed }
    );
    return bars;
  }
}

