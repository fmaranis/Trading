import express, { Request, Response } from 'express';

export const marketDataRouter = express.Router();

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        exchangeName?: string;
        instrumentType?: string;
        firstTradeDate?: number;
        regularMarketTime?: number;
        gmtoffset?: number;
        timezone?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    };
  };
}

/**
 * GET /api/market-data/history
 * Query parameters:
 *  - symbol (required)
 *  - startDate (required, e.g. 2024-01-01)
 *  - endDate (required, e.g. 2026-08-01)
 *  - timeframe (optional: '1d' | '1wk' | '1mo', default '1d')
 *  - adjusted (optional: 'true' | 'false', default 'true')
 */
marketDataRouter.get('/history', async (req: Request, res: Response): Promise<void> => {
  const { symbol, startDate, endDate, timeframe = '1d', adjusted = 'true' } = req.query;

  // 1. Parameter validation
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    res.status(400).json({ error: 'El parámetro "symbol" es obligatorio.' });
    return;
  }

  if (!startDate || typeof startDate !== 'string' || !endDate || typeof endDate !== 'string') {
    res.status(400).json({ error: 'Los parámetros "startDate" y "endDate" son obligatorios.' });
    return;
  }

  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);

  if (isNaN(startMs) || isNaN(endMs)) {
    res.status(400).json({ error: 'Las fechas "startDate" o "endDate" no tienen un formato válido.' });
    return;
  }

  if (startMs >= endMs) {
    res.status(400).json({ error: 'startDate debe ser anterior a endDate.' });
    return;
  }

  const cleanSymbol = symbol.trim();
  const isAdjusted = adjusted !== 'false';
  const period1 = Math.floor(startMs / 1000);
  const period2 = Math.floor(endMs / 1000);

  // Map timeframe to Yahoo interval
  let interval = '1d';
  if (timeframe === '1wk') interval = '1wk';
  if (timeframe === '1mo') interval = '1mo';

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    cleanSymbol
  )}?period1=${period1}&period2=${period2}&interval=${interval}&events=history&includeAdjustedClose=true`;

  try {
    const upstreamRes = await fetch(yahooUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Custodia/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (upstreamRes.status === 404) {
      res.status(404).json({
        error: `Símbolo no encontrado en el proveedor: "${cleanSymbol}".`,
        provider: 'yahoo_finance',
        symbol: cleanSymbol
      });
      return;
    }

    if (upstreamRes.status === 429) {
      res.status(429).json({
        error: 'Límite de peticiones de proveedor excedido (Rate Limit).',
        retryAfterSeconds: 30
      });
      return;
    }

    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).json({
        error: `Error de proveedor externo (HTTP ${upstreamRes.status}): ${upstreamRes.statusText}`
      });
      return;
    }

    const payload: YahooChartResult = await upstreamRes.json();

    if (payload.chart?.error) {
      res.status(404).json({
        error: payload.chart.error.description || `Error devuelto por proveedor para "${cleanSymbol}"`,
        code: payload.chart.error.code
      });
      return;
    }

    const result = payload.chart?.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      res.status(404).json({
        error: `No se encontraron datos históricos para "${cleanSymbol}" en el intervalo solicitado.`
      });
      return;
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    const adjcloses = result.indicators?.adjclose?.[0]?.adjclose;

    if (!quotes || !quotes.close) {
      res.status(502).json({
        error: 'Estructura de precios incompleta devuelta por el proveedor.'
      });
      return;
    }

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      const rawOpen = quotes.open?.[i];
      const rawHigh = quotes.high?.[i];
      const rawLow = quotes.low?.[i];
      const rawClose = quotes.close?.[i];
      const rawAdjClose = adjcloses?.[i];
      const rawVolume = quotes.volume?.[i];

      // Skip null/undefined points (market holidays / missing ticks)
      if (rawOpen === null || rawOpen === undefined ||
          rawHigh === null || rawHigh === undefined ||
          rawLow === null || rawLow === undefined ||
          rawClose === null || rawClose === undefined ||
          rawOpen <= 0 || rawHigh <= 0 || rawLow <= 0 || rawClose <= 0) {
        continue;
      }

      // If adjusted prices requested and adjclose is available, scale OHLC proportionally
      let open = rawOpen;
      let high = rawHigh;
      let low = rawLow;
      let close = rawClose;

      if (isAdjusted && rawAdjClose && rawAdjClose > 0 && rawClose > 0) {
        const factor = rawAdjClose / rawClose;
        open = Number((rawOpen * factor).toFixed(4));
        high = Number((rawHigh * factor).toFixed(4));
        low = Number((rawLow * factor).toFixed(4));
        close = Number((rawAdjClose).toFixed(4));
      } else {
        open = Number(open.toFixed(4));
        high = Number(high.toFixed(4));
        low = Number(low.toFixed(4));
        close = Number(close.toFixed(4));
      }

      // Ensure geometric consistency if rounding caused subtle distortion
      high = Math.max(high, open, close);
      low = Math.min(low, open, close);

      const isoDate = new Date(t * 1000).toISOString();

      bars.push({
        timestamp: isoDate,
        open,
        high,
        low,
        close,
        volume: rawVolume !== null && rawVolume !== undefined && rawVolume >= 0 ? rawVolume : 0
      });
    }

    if (bars.length === 0) {
      res.status(404).json({
        error: `No hay cotizaciones válidas para "${cleanSymbol}" en las fechas seleccionadas.`
      });
      return;
    }

    res.json({
      bars,
      metadata: {
        providerId: 'yahoo_finance',
        providerName: 'Yahoo Finance Historical API (via Server Proxy)',
        symbol: cleanSymbol,
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        actualStartDate: bars[0].timestamp,
        actualEndDate: bars[bars.length - 1].timestamp,
        timeframe: timeframe as string,
        adjusted: isAdjusted,
        currency: result.meta?.currency || 'EUR',
        exchange: result.meta?.exchangeName || 'XETRA',
        fetchedAt: new Date().toISOString(),
        cached: false
      }
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || controller.signal.aborted) {
      res.status(504).json({
        error: `Timeout al consultar el proveedor externo tras ${timeoutMs}ms.`
      });
      return;
    }

    res.status(502).json({
      error: `Error al conectar con el proveedor de mercado: ${err.message || err}`
    });
  }
});
