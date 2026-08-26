/**
 * REAL MARKET DATA PROVIDER ADAPTER
 * Provider: Yahoo Finance via the server proxy.
 * The Yahoo chart endpoint is unofficial/non-contractual from the application's perspective.
 */
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
  MarketDataTimeoutError,
  MarketDataValidationError
} from '../errors';
import { calculateDatasetFingerprint } from '../fingerprint';

export class RealMarketDataProvider implements MarketDataProvider {
  public readonly id = 'yahoo_finance';
  public readonly name = 'Yahoo Finance';
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/market-data/history') {
    this.baseUrl = baseUrl;
  }

  public getCapabilities(): MarketDataProviderCapabilities {
    return {
      supportedTimeframes: ['1d', '1wk', '1mo'],
      supportsAdjusted: true,
      requiresApiKey: false,
      maxRangeYears: 25,
      rateLimitRequestsPerMinute: 120
    };
  }

  public isSymbolFormatSupported(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    const clean = symbol.trim().toUpperCase();
    return clean.length > 0 && !clean.includes(' ') && clean !== 'INVALID_SYMBOL_XYZ';
  }

  public async supportsSymbol(symbol: string): Promise<boolean> {
    return this.isSymbolFormatSupported(symbol);
  }

  public async getHistoricalBars(
    request: HistoricalMarketDataRequest,
    options?: MarketDataFetchOptions
  ): Promise<HistoricalMarketDataResponse> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    options?.signal?.addEventListener('abort', () => controller.abort());

    const params = new URLSearchParams({
      symbol: request.symbol,
      startDate: request.startDate,
      endDate: request.endDate,
      timeframe: request.timeframe,
      adjusted: request.adjusted !== false ? 'true' : 'false'
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: any = {};
        try { errorData = await response.json(); } catch { /* ignore */ }
        const msg = errorData.error || errorData.message || response.statusText;
        if (response.status === 401 || response.status === 403) throw new MarketDataUnauthorizedError(this.id, msg);
        if (response.status === 404) throw new MarketDataSymbolNotFoundError(request.symbol, this.id, msg);
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After')) || errorData.retryAfterSeconds || 30;
          throw new MarketDataRateLimitError(this.id, retryAfter, msg);
        }
        throw new MarketDataProviderError(this.id, msg || `HTTP ${response.status}`, response.status, errorData);
      }

      return this.parseAndNormalizeServerResponse(await response.json(), request);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (
        err instanceof MarketDataProviderError ||
        err instanceof MarketDataUnauthorizedError ||
        err instanceof MarketDataSymbolNotFoundError ||
        err instanceof MarketDataRateLimitError ||
        err instanceof MarketDataValidationError
      ) throw err;
      if (err?.name === 'AbortError' || controller.signal.aborted) throw new MarketDataTimeoutError(this.id, timeoutMs);
      throw new MarketDataProviderError(this.id, `Fallo de conexión al proxy de datos: ${err?.message || err}`, 503);
    }
  }

  public parseAndNormalizeServerResponse(
    data: any,
    request: HistoricalMarketDataRequest
  ): HistoricalMarketDataResponse {
    if (!data || !Array.isArray(data.bars)) {
      throw new MarketDataValidationError('El proveedor devolvió una estructura de barras inválida o ausente.');
    }
    if (data.bars.length === 0) {
      throw new MarketDataSymbolNotFoundError(request.symbol, this.id, `No se encontraron cotizaciones para ${request.symbol}.`);
    }

    const seen = new Set<string>();
    const normalizedBars: PriceBar[] = data.bars.map((b: any, i: number) => {
      const ms = Date.parse(b.timestamp);
      if (!Number.isFinite(ms)) throw new MarketDataValidationError(`Barra [${i}] contiene fecha no parseable.`);
      const timestamp = new Date(ms).toISOString();
      if (seen.has(timestamp)) throw new MarketDataValidationError(`Timestamp duplicado: ${timestamp}`);
      seen.add(timestamp);
      const open = Number(b.open), high = Number(b.high), low = Number(b.low), close = Number(b.close);
      const volume = b.volume === undefined ? undefined : Number(b.volume);
      if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0)) {
        throw new MarketDataValidationError(`Barra [${i}] contiene OHLC inválido.`);
      }
      if (high < low || high < open || high < close || low > open || low > close) {
        throw new MarketDataValidationError(`Barra [${i}] tiene geometría OHLC inconsistente.`);
      }
      if (volume !== undefined && (!Number.isFinite(volume) || volume < 0)) {
        throw new MarketDataValidationError(`Barra [${i}] contiene volumen inválido.`);
      }
      return { timestamp, open, high, low, close, volume };
    });

    normalizedBars.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const actualStart = normalizedBars[0].timestamp;
    const actualEnd = normalizedBars[normalizedBars.length - 1].timestamp;
    const isAdjusted = request.adjusted !== false;
    const datasetFingerprint = calculateDatasetFingerprint(normalizedBars);

    return {
      bars: normalizedBars,
      provenance: {
        sourceType: 'REAL',
        provider: this.name,
        symbol: request.symbol,
        fetchedAt: data.metadata?.fetchedAt || new Date().toISOString(),
        timeframe: request.timeframe,
        startDate: actualStart,
        endDate: actualEnd,
        isReproducible: false,
        datasetFingerprint,
        notes: 'Datos reales Yahoo Finance. OHLC ajustado, cuando se solicita, derivado con adjClose/rawClose.'
      },
      metadata: {
        providerId: this.id,
        providerName: this.name,
        provider: { id: this.id, name: this.name, endpointType: 'UNOFFICIAL_CHART_ENDPOINT' },
        symbol: request.symbol,
        requestedStartDate: request.startDate,
        requestedEndDate: request.endDate,
        actualStartDate: actualStart,
        actualEndDate: actualEnd,
        timeframe: request.timeframe,
        adjusted: isAdjusted,
        adjustmentStatus: isAdjusted ? 'ADJUSTED_DERIVED' : 'UNADJUSTED',
        adjustmentMethod: isAdjusted ? 'PROVIDER_ADJCLOSE_RATIO' : 'NONE',
        datasetFingerprint,
        currency: data.metadata?.currency || undefined,
        exchange: data.metadata?.exchange || undefined,
        fetchedAt: data.metadata?.fetchedAt || new Date().toISOString(),
        cached: Boolean(data.metadata?.cached)
      }
    };
  }
}
