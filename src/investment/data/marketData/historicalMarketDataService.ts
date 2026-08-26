import {
  HistoricalMarketDataRequest,
  HistoricalMarketDataResponse,
  MarketDataCache,
  MarketDataFetchOptions,
  MarketDataProvider
} from './types';
import { MarketDataProviderRegistry } from './registry';
import { MemoryMarketDataCache } from './cache';
import { MarketDataRequestValidator } from './requestValidator';
import { DataValidator } from '../validators';
import {
  MarketDataError,
  MarketDataProviderError,
  MarketDataValidationError,
  MarketDataRateLimitError,
  MarketDataUnauthorizedError,
  MarketDataSymbolNotFoundError,
  MarketDataTimeoutError
} from './errors';
import { MockMarketDataProvider } from './providers/mockProvider';
import { RealMarketDataProvider } from './providers/realMarketDataProvider';

export class HistoricalMarketDataService {
  private static registry: MarketDataProviderRegistry = new MarketDataProviderRegistry();
  private static cache: MarketDataCache = new MemoryMarketDataCache();
  private static defaultTtlSeconds = 6 * 3600; // 6 hours for daily bars

  // Initialize standard default providers
  static {
    this.registry.register(new RealMarketDataProvider());
    this.registry.register(new MockMarketDataProvider());
    this.registry.setDefaultProvider('yahoo_finance');
  }

  public static getRegistry(): MarketDataProviderRegistry {
    return this.registry;
  }

  public static setRegistry(customRegistry: MarketDataProviderRegistry): void {
    this.registry = customRegistry;
  }

  public static getCache(): MarketDataCache {
    return this.cache;
  }

  public static setCache(customCache: MarketDataCache): void {
    this.cache = customCache;
  }

  public static setDefaultTtl(ttlSeconds: number): void {
    this.defaultTtlSeconds = ttlSeconds;
  }

  /**
   * Main entry point to fetch historical market data.
   * Pipeline:
   * 1. Validate request
   * 2. Select provider from registry
   * 3. Consult cache (if !forceRefresh)
   * 4. Call provider with retry/backoff on temporary errors
   * 5. Strictly validate bars (DataValidator & duplicates)
   * 6. PROHIBIT silent synthetic fallback on failure
   * 7. Cache response
   * 8. Return response
   */
  public static async getHistoricalBars(
    request: HistoricalMarketDataRequest,
    options: MarketDataFetchOptions = {}
  ): Promise<HistoricalMarketDataResponse> {
    // 1. Validate request
    MarketDataRequestValidator.validate(request);

    // 2. Select provider
    const providerId = options.providerId || this.registry.getDefaultProvider().id;
    const provider: MarketDataProvider = this.registry.getProvider(providerId);

    // 3. Consult cache
    const cacheKey = this.cache.generateKey
      ? this.cache.generateKey(request, provider.id)
      : `${provider.id}:${request.symbol}:${request.startDate}:${request.endDate}:${request.timeframe}:${request.adjusted !== false}`;

    if (!options.forceRefresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 4. Consult provider with controlled retry & backoff
    const maxRetries = options.maxRetries ?? 2;
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      try {
        const response = await provider.getHistoricalBars(request, options);

        // 5. Normalization and strict integrity validation
        if (!response || !Array.isArray(response.bars) || response.bars.length === 0) {
          throw new MarketDataSymbolNotFoundError(
            request.symbol,
            provider.id,
            `No se obtuvieron barras de cotización válidas para "${request.symbol}".`
          );
        }

        // Assert valid OHLCV and strictly ascending dates with DataValidator
        try {
          DataValidator.assertValidPriceBars(response.bars);
        } catch (valErr: any) {
          throw new MarketDataValidationError(valErr.message, valErr.errors || [valErr.message]);
        }

        // Additional uniqueness check
        const seen = new Set<string>();
        for (const b of response.bars) {
          if (seen.has(b.timestamp)) {
            throw new MarketDataValidationError(`Timestamp duplicado encontrado: "${b.timestamp}".`);
          }
          seen.add(b.timestamp);
        }

        // 6. Save to cache
        await this.cache.set(cacheKey, response, this.defaultTtlSeconds);

        return response;
      } catch (err: any) {
        lastError = err;

        // Categorize non-retryable errors (401, 403, 404, validation errors)
        const isNonRetryable =
          err instanceof MarketDataUnauthorizedError ||
          err instanceof MarketDataSymbolNotFoundError ||
          err instanceof MarketDataValidationError ||
          (err instanceof MarketDataProviderError && (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404));

        if (isNonRetryable || attempt >= maxRetries) {
          break;
        }

        // Exponential backoff for temporary errors (timeout, 5xx, network)
        attempt++;
        const backoffMs = attempt * 100;
        await new Promise(res => setTimeout(res, backoffMs));
      }
    }

    // 7. STRICT PROHIBITION OF SILENT SYNTHETIC FALLBACK
    // If the provider fails, we MUST throw the error explicitly.
    if (lastError instanceof MarketDataError) {
      throw lastError;
    }

    throw new MarketDataProviderError(
      provider.id,
      `Error irrecuperable al obtener datos de mercado: ${lastError?.message || lastError}`
    );
  }
}
