import { Asset } from '../../types';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { DataProvenance, HistoricalDataRequest, HistoricalDataResponse } from './types';
import { StaticReferenceProvider } from './staticReferenceProvider';
import { SyntheticDataGenerator } from './syntheticDataGenerator';

export class HistoricalDataService {
  /**
   * Main facade to retrieve historical data for backtesting, analytics, or UI charts.
   * Explicitly separates STATIC_REFERENCE and SYNTHETIC data modes.
   */
  public static getHistoricalData(
    asset: Asset,
    request: Partial<HistoricalDataRequest> = {}
  ): HistoricalDataResponse {
    const mode = request.mode ?? 'SYNTHETIC';

    if (mode === 'STATIC_REFERENCE') {
      return StaticReferenceProvider.getStaticBarsForAsset(asset);
    }

    // Default to SYNTHETIC with deterministic seeded PRNG
    return SyntheticDataGenerator.generateFromAsset(asset, request.syntheticConfig);
  }

  public static getHistoricalDataById(
    assetId: string,
    request: Partial<HistoricalDataRequest> = {}
  ): HistoricalDataResponse {
    const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === assetId) || ALL_AVAILABLE_ASSETS[0];
    return this.getHistoricalData(asset, request);
  }
}
