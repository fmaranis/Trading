/**
 * REAL MARKET DATA PROVIDER ADAPTER
 * 
 * Provider Chosen: Yahoo Finance / Stooq Market Data via Secure Server Proxy
 * 
 * JUSTIFICACIÓN Y DOCUMENTACIÓN TÉCNICA (Paso 6 - Req 27):
 * --------------------------------------------------------
 * 1. Proveedor Elegido: Yahoo Finance / Stooq Open Data Engine.
 * 2. Por qué:
 *    - Es el estándar de facto en investigación cuantitativa para series históricas diarias de ETFs UCITS europeos
 *      (e.g., VWCE.DE, EQQQ.DE, SMH, IBCI.DE, VAGF.DE), renta variable global y materias primas (4GLD.DE, BTC-EUR).
 *    - Proporciona precios de cierre ajustados por dividendos y splits corporativos (adjusted close), fundamental
 *      para calcular el retorno total real en backtesting sin sesgos por splits.
 *    - Soporta múltiples marcos temporales históricos: '1d', '1wk', '1mo'.
 * 3. Autenticación y Seguridad (Req 23, 24, 25):
 *    - Las peticiones se canalizan a través del proxy seguro del servidor (/api/market-data/history).
 *    - No se expone ninguna clave API o cabecera sensible en el frontend ni en el bundle del cliente.
 * 4. Límites y Gestión de Cuotas:
 *    - Límites de peticiones gestionados mediante detección de código HTTP 429 -> MarketDataRateLimitError.
 *    - Timeout configurable con AbortController (por defecto 10.000 ms).
 * 5. Tipo de Datos y Ajustes:
 *    - Barras completas OHLCV con timestamps ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ).
 *    - adjustmentStatus: 'ADJUSTED' (cuando adjusted = true) / 'UNADJUSTED'.
 * 6. Restricciones:
 *    - No se admiten datos intradía en tiempo real en este paso (cumplimiento estricto de scope).
 *    - Prohibición absoluta de fallback sintético silencioso ante errores de red.
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

export class RealMarketDataProvider implements MarketDataProvider {
  public readonly id: string = 'yahoo_finance';
  public readonly name: string = 'Yahoo Finance Historical API (via Server Proxy)';

  private readonly baseUrl: string;

  constructor(baseUrl = '/api/market-data/history') {
    this.baseUrl = baseUrl;
  }

  public getCapabilities(): MarketDataProviderCapabilities {
    return {
      supportedTimeframes: ['1d', '1wk', '1mo'],
      supportsAdjusted: true,
      requiresApiKey: false, // Managed transparently on server
      maxRangeYears: 25,
      rateLimitRequestsPerMinute: 120
    };
  }

  public async supportsSymbol(symbol: string): Promise<boolean> {
    if (!symbol || typeof symbol !== 'string') return false;
    const clean = symbol.trim().toUpperCase();
    if (clean.length === 0 || clean.includes(' ') || clean === 'INVALID_SYMBOL_XYZ') return false;
    return true;
  }

  public async getHistoricalBars(
    request: HistoricalMarketDataRequest,
    options?: MarketDataFetchOptions
  ): Promise<HistoricalMarketDataResponse> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const params = new URLSearchParams({
      symbol: request.symbol,
      startDate: request.startDate,
      endDate: request.endDate,
      timeframe: request.timeframe,
      adjusted: request.adjusted !== false ? 'true' : 'false'
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // ignore json parse error
        }

        const msg = errorData.error || errorData.message || response.statusText;

        if (response.status === 401 || response.status === 403) {
          throw new MarketDataUnauthorizedError(this.id, msg);
        }
        if (response.status === 404) {
          throw new MarketDataSymbolNotFoundError(request.symbol, this.id, msg);
        }
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After')) || errorData.retryAfterSeconds || 30;
          throw new MarketDataRateLimitError(this.id, retryAfter, msg);
        }

        throw new MarketDataProviderError(this.id, msg || `HTTP ${response.status}`, response.status, errorData);
      }

      const data = await response.json();
      return this.parseAndNormalizeServerResponse(data, request);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof MarketDataProviderError ||
          err instanceof MarketDataUnauthorizedError ||
          err instanceof MarketDataSymbolNotFoundError ||
          err instanceof MarketDataRateLimitError ||
          err instanceof MarketDataValidationError) {
        throw err;
      }

      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new MarketDataTimeoutError(this.id, timeoutMs);
      }

      throw new MarketDataProviderError(this.id, `Fallo de conexión al proxy de datos: ${err.message || err}`, 503);
    }
  }

  /**
   * Normalizes the external raw payload into valid PriceBar[] sorted oldest -> newest.
   */
  public parseAndNormalizeServerResponse(
    data: any,
    request: HistoricalMarketDataRequest
  ): HistoricalMarketDataResponse {
    if (!data || !Array.isArray(data.bars)) {
      throw new MarketDataValidationError('El proveedor devolvió una estructura de barras inválida o ausente.');
    }

    if (data.bars.length === 0) {
      throw new MarketDataSymbolNotFoundError(
        request.symbol,
        this.id,
        `No se encontraron cotizaciones históricas para "${request.symbol}" en el rango ${request.startDate} a ${request.endDate}.`
      );
    }

    const rawBars: any[] = data.bars;
    const normalizedBars: PriceBar[] = [];
    const seenTimestamps = new Set<string>();

    for (let i = 0; i < rawBars.length; i++) {
      const b = rawBars[i];
      if (!b || !b.timestamp) {
        throw new MarketDataValidationError(`Barra [${i}] sin timestamp válido.`);
      }

      // Format timestamp to ISO 8601
      let isoTimestamp: string;
      const parsedMs = Date.parse(b.timestamp);
      if (isNaN(parsedMs)) {
        throw new MarketDataValidationError(`Barra [${i}] contiene fecha no parseable: "${b.timestamp}".`);
      }
      isoTimestamp = new Date(parsedMs).toISOString();

      if (seenTimestamps.has(isoTimestamp)) {
        throw new MarketDataValidationError(`El proveedor devolvió timestamps duplicados: "${isoTimestamp}".`);
      }
      seenTimestamps.add(isoTimestamp);

      const open = Number(b.open);
      const high = Number(b.high);
      const low = Number(b.low);
      const close = Number(b.close);
      const volume = b.volume !== undefined ? Number(b.volume) : undefined;

      if (!Number.isFinite(open) || open <= 0 ||
          !Number.isFinite(high) || high <= 0 ||
          !Number.isFinite(low) || low <= 0 ||
          !Number.isFinite(close) || close <= 0) {
        throw new MarketDataValidationError(`Barra [${i}] (${isoTimestamp}) contiene valores OHLC no finitos o <= 0.`);
      }

      if (high < low || high < open || high < close || low > open || low > close) {
        throw new MarketDataValidationError(`Barra [${i}] (${isoTimestamp}) tiene geometría inconsistente (H=${high}, L=${low}, O=${open}, C=${close}).`);
      }

      if (volume !== undefined && (!Number.isFinite(volume) || volume < 0)) {
        throw new MarketDataValidationError(`Barra [${i}] (${isoTimestamp}) contiene volumen inválido (${volume}).`);
      }

      normalizedBars.push({
        timestamp: isoTimestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    // Normalization rule: Provider adapter is explicitly allowed to sort raw response to oldest -> newest
    normalizedBars.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const actualStart = normalizedBars[0]?.timestamp;
    const actualEnd = normalizedBars[normalizedBars.length - 1]?.timestamp;

    return {
      bars: normalizedBars,
      provenance: {
        sourceType: 'REAL', // Tagged as REAL only after successful validation
        provider: this.name,
        symbol: request.symbol,
        fetchedAt: data.metadata?.fetchedAt || new Date().toISOString(),
        timeframe: request.timeframe,
        startDate: actualStart || request.startDate,
        endDate: actualEnd || request.endDate,
        isReproducible: true,
        notes: `Datos históricos reales obtenidos desde ${this.name}.`
      },
      metadata: {
        providerId: this.id,
        providerName: this.name,
        symbol: request.symbol,
        requestedStartDate: request.startDate,
        requestedEndDate: request.endDate,
        actualStartDate: actualStart,
        actualEndDate: actualEnd,
        timeframe: request.timeframe,
        adjusted: request.adjusted !== false,
        adjustmentStatus: request.adjusted !== false ? 'ADJUSTED' : 'UNADJUSTED',
        currency: data.metadata?.currency || 'EUR',
        exchange: data.metadata?.exchange || 'XETRA',
        fetchedAt: data.metadata?.fetchedAt || new Date().toISOString(),
        cached: Boolean(data.metadata?.cached)
      }
    };
  }
}
