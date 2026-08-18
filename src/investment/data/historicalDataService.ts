import { Asset } from '../../types';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { HistoricalDataRequest, HistoricalDataResponse } from './types';
import { StaticReferenceProvider } from './staticReferenceProvider';
import { SyntheticDataGenerator } from './syntheticDataGenerator';
import { DataValidator } from './validators';

export class HistoricalDataService {
  /**
   * Main facade to retrieve historical data for backtesting, analytics, or UI charts.
   * Explicitly validates the dataset using DataValidator before returning.
   * If the dataset contains any invalid prices, unordered/duplicate timestamps, or invalid volumes,
   * it throws a DataValidationError without silent correction.
   */
  public static getHistoricalData(
    asset: Asset,
    request: Partial<HistoricalDataRequest> = {}
  ): HistoricalDataResponse {
    const mode = request.mode ?? 'SYNTHETIC';

    let response: HistoricalDataResponse;

    if (mode === 'STATIC_REFERENCE') {
      response = StaticReferenceProvider.getStaticBarsForAsset(asset);
    } else {
      // Default to SYNTHETIC with deterministic seeded PRNG
      response = SyntheticDataGenerator.generateFromAsset(asset, request.syntheticConfig);
    }

    // Strict validation before returning dataset
    DataValidator.assertValidPriceBars(response.bars);

    return response;
  }

  public static getHistoricalDataById(
    assetId: string,
    request: Partial<HistoricalDataRequest> = {}
  ): HistoricalDataResponse {
    const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === assetId) || ALL_AVAILABLE_ASSETS[0];
    return this.getHistoricalData(asset, request);
  }
}
