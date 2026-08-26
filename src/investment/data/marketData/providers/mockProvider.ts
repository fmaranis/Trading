import { PriceBar } from '../../../backtesting/types';
import {
  HistoricalMarketDataRequest,
  HistoricalMarketDataResponse,
  MarketDataProvider,
  MarketDataProviderCapabilities,
  MarketDataFetchOptions
} from '../types';
import {
  MarketDataProviderError,
  MarketDataRateLimitError,
  MarketDataUnauthorizedError,
  MarketDataSymbolNotFoundError,
  MarketDataTimeoutError
} from '../errors';
import { calculateDatasetFingerprint } from '../fingerprint';

export interface MockProviderOptions {
  id?: string;
  name?: string;
  simulatedDelayMs?: number;
  shouldFail?: boolean;
  failureErrorType?: '401' | '429' | '404' | '500' | 'TIMEOUT';
  rateLimitRetryAfter?: number;
  customBarsGenerator?: (request: HistoricalMarketDataRequest) => PriceBar[];
}

export class MockMarketDataProvider implements MarketDataProvider {
  public readonly id: string;
  public readonly name: string;
  private options: MockProviderOptions;
  public callCount = 0;

  constructor(options: MockProviderOptions = {}) {
    this.id = options.id || 'mock';
    this.name = options.name || 'Mock Market Data Provider (Simulated)';
    this.options = options;
  }

  public setOptions(options: Partial<MockProviderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getCapabilities(): MarketDataProviderCapabilities {
    return {
      supportedTimeframes: ['1d', '1wk', '1mo'],
      supportsAdjusted: true,
      requiresApiKey: false,
      maxRangeYears: 10,
      rateLimitRequestsPerMinute: 600
    };
  }

  public isSymbolFormatSupported(symbol: string): boolean {
    return Boolean(symbol?.trim()) && symbol.toUpperCase() !== 'INVALID_SYMBOL_XYZ';
  }

  public async supportsSymbol(symbol: string): Promise<boolean> {
    return this.isSymbolFormatSupported(symbol);
  }

  public async getHistoricalBars(
    request: HistoricalMarketDataRequest,
    options?: MarketDataFetchOptions
  ): Promise<HistoricalMarketDataResponse> {
    this.callCount++;
    const delay = this.options.simulatedDelayMs ?? 10;
    if (delay > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new MarketDataTimeoutError(this.id, options.timeoutMs ?? delay));
        });
      });
    }
    if (options?.signal?.aborted) throw new MarketDataTimeoutError(this.id, options.timeoutMs ?? 10000);

    if (this.options.shouldFail) {
      const type = this.options.failureErrorType || '500';
      if (type === '401') throw new MarketDataUnauthorizedError(this.id, 'Credenciales de mock inválidas');
      if (type === '429') throw new MarketDataRateLimitError(this.id, this.options.rateLimitRetryAfter || 30);
      if (type === '404') throw new MarketDataSymbolNotFoundError(request.symbol, this.id);
      if (type === 'TIMEOUT') throw new MarketDataTimeoutError(this.id, options?.timeoutMs || 10000);
      throw new MarketDataProviderError(this.id, 'Simulated 500 Internal Server Error', 500);
    }
    if (request.symbol.toUpperCase() === 'NOT_FOUND' || request.symbol.toUpperCase() === 'INVALID_SYMBOL_XYZ') {
      throw new MarketDataSymbolNotFoundError(request.symbol, this.id);
    }

    const bars = this.options.customBarsGenerator
      ? this.options.customBarsGenerator(request)
      : this.generateDefaultMockBars(request);
    const isAdjusted = request.adjusted !== false;
    const datasetFingerprint = calculateDatasetFingerprint(bars);

    return {
      bars,
      provenance: {
        sourceType: 'SYNTHETIC',
        provider: this.name,
        symbol: request.symbol,
        fetchedAt: new Date().toISOString(),
        timeframe: request.timeframe,
        startDate: request.startDate,
        endDate: request.endDate,
        isReproducible: true,
        datasetFingerprint,
        notes: 'Generado sintéticamente por MockMarketDataProvider para validación de arquitectura.'
      },
      metadata: {
        providerId: this.id,
        providerName: this.name,
        provider: { id: this.id, name: this.name, endpointType: 'SIMULATED_MOCK' },
        symbol: request.symbol,
        requestedStartDate: request.startDate,
        requestedEndDate: request.endDate,
        actualStartDate: bars[0]?.timestamp || request.startDate,
        actualEndDate: bars[bars.length - 1]?.timestamp || request.endDate,
        timeframe: request.timeframe,
        adjusted: isAdjusted,
        adjustmentStatus: isAdjusted ? 'ADJUSTED_DERIVED' : 'UNADJUSTED',
        adjustmentMethod: isAdjusted ? 'PROVIDER_ADJCLOSE_RATIO' : 'NONE',
        datasetFingerprint,
        currency: undefined,
        exchange: undefined,
        fetchedAt: new Date().toISOString(),
        cached: false
      }
    };
  }

  private generateDefaultMockBars(request: HistoricalMarketDataRequest): PriceBar[] {
    const bars: PriceBar[] = [];
    const startMs = Date.parse(request.startDate);
    const endMs = Date.parse(request.endDate);
    const stepMs = request.timeframe === '1mo' ? 30 * 86400000 : request.timeframe === '1wk' ? 7 * 86400000 : 86400000;
    let currentPrice = 100.0;
    let t = startMs;
    let i = 0;

    while (t <= endMs) {
      const dateStr = new Date(t).toISOString().split('T')[0];
      const dayOfWeek = new Date(t).getUTCDay();
      if (request.timeframe === '1d' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        t += stepMs;
        continue;
      }
      const drift = 0.0005;
      const shock = (Math.sin(i * 0.3) * 0.015) + (Math.cos(i * 0.7) * 0.01);
      const open = Number(currentPrice.toFixed(2));
      const close = Number((currentPrice * (1 + drift + shock)).toFixed(2));
      const high = Number((Math.max(open, close) * 1.008).toFixed(2));
      const low = Number((Math.min(open, close) * 0.992).toFixed(2));
      const volume = Math.floor(10000 + Math.abs(Math.sin(i)) * 50000);
      bars.push({ timestamp: `${dateStr}T00:00:00.000Z`, open, high, low, close, volume });
      currentPrice = close;
      t += stepMs;
      i++;
    }
    return bars;
  }
}
