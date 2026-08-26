import { Asset } from '../../types';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { HistoricalDataRequest, HistoricalDataResponse } from './types';
import { StaticReferenceProvider } from './staticReferenceProvider';
import { SyntheticDataGenerator } from './syntheticDataGenerator';
import { DataValidator } from './validators';
import { HistoricalMarketDataService } from './marketData/historicalMarketDataService';
import { SymbolMappingService } from './marketData/symbolMapping';
import { MarketDataSymbolNotFoundError } from './marketData/errors';
import { MarketTimeframe } from './marketData/types';

export class HistoricalDataService {
  /**
   * Main asynchronous facade to retrieve historical data for backtesting, analytics, or UI charts.
   * Supports:
   * - REAL -> HistoricalMarketDataService (with Provider / Cache / Validations)
   * - STATIC_REFERENCE -> StaticReferenceProvider
   * - SYNTHETIC -> SyntheticDataGenerator
   */
  public static async getHistoricalData(
    asset: Asset,
    request: Partial<HistoricalDataRequest> = {}
  ): Promise<HistoricalDataResponse> {
    const mode = request.mode ?? 'SYNTHETIC';

    let response: HistoricalDataResponse;

    if (mode === 'REAL') {
      const providerId = request.providerId || 'yahoo_finance';
      const resolvedSymbol =
        request.symbol ||
        SymbolMappingService.resolveProviderSymbol(asset.id, providerId) ||
        SymbolMappingService.resolveProviderSymbol(asset.ticker, providerId);

      if (!resolvedSymbol) {
        throw new MarketDataSymbolNotFoundError(
          asset.ticker || asset.name,
          providerId,
          `Datos históricos reales no disponibles para este activo (${asset.name}).`
        );
      }

      // Default to last 2 years if no dates specified
      const endDate = request.endDate || new Date().toISOString().split('T')[0];
      const startDate = request.startDate || new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0];
      const timeframe = (request.timeframe as MarketTimeframe) || '1d';

      const marketResponse = await HistoricalMarketDataService.getHistoricalBars(
        {
          symbol: resolvedSymbol,
          startDate,
          endDate,
          timeframe,
          adjusted: request.adjusted !== false
        },
        {
          forceRefresh: request.forceRefresh,
          providerId
        }
      );

      response = {
        bars: marketResponse.bars,
        provenance: marketResponse.provenance,
        metadata: marketResponse.metadata
      };
    } else if (mode === 'STATIC_REFERENCE') {
      response = StaticReferenceProvider.getStaticBarsForAsset(asset);
    } else {
      // Default to SYNTHETIC with deterministic seeded PRNG
      response = SyntheticDataGenerator.generateFromAsset(asset, request.syntheticConfig);
    }

    // Strict validation before returning dataset
    DataValidator.assertValidPriceBars(response.bars);

    return response;
  }

  public static async getHistoricalDataById(
    assetId: string,
    request: Partial<HistoricalDataRequest> = {}
  ): Promise<HistoricalDataResponse> {
    const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === assetId) || ALL_AVAILABLE_ASSETS[0];
    return this.getHistoricalData(asset, request);
  }

  /**
   * Synchronous accessor for SYNTHETIC and STATIC_REFERENCE modes.
   * Throws error if REAL mode is requested synchronously.
   */
  public static getHistoricalDataSync(
    asset: Asset,
    request: Partial<HistoricalDataRequest> = {}
  ): HistoricalDataResponse {
    const mode = request.mode ?? 'SYNTHETIC';

    if (mode === 'REAL') {
      throw new Error('La carga de datos reales (REAL) es asíncrona. Utilice getHistoricalData() con await.');
    }

    let response: HistoricalDataResponse;

    if (mode === 'STATIC_REFERENCE') {
      response = StaticReferenceProvider.getStaticBarsForAsset(asset);
    } else {
      response = SyntheticDataGenerator.generateFromAsset(asset, request.syntheticConfig);
    }

    DataValidator.assertValidPriceBars(response.bars);
    return response;
  }
}
