import express, { Request, Response } from 'express';

export const alphaVantageRouter = express.Router();

interface AlphaDailyPayload {
  'Meta Data'?: Record<string, string>;
  'Time Series (Daily)'?: Record<string, {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  }>;
  'Error Message'?: string;
  Note?: string;
  Information?: string;
}

type CachedCrossCheck = { expiresAt: number; result: any };
const crossCheckCache = new Map<string, CachedCrossCheck>();
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function toAlphaSymbol(yahooTicker: string): string {
  const clean = yahooTicker.trim().toUpperCase();
  if (clean.endsWith('.DE')) return `${clean.slice(0, -3)}.DEX`;
  return clean;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cacheKey(alphaSymbol: string, yahooDate: string, yahooClose: number): string {
  return `${alphaSymbol}|${yahooDate}|${yahooClose.toFixed(6)}`;
}

function classifyNotice(payload: AlphaDailyPayload): 'QUOTA_EXHAUSTED' | 'PROVIDER_NOTICE' | null {
  const text = `${payload.Note ?? ''} ${payload.Information ?? ''}`.toLowerCase();
  if (!text.trim()) return null;
  if (text.includes('rate limit') || text.includes('requests per day') || text.includes('premium plans')) return 'QUOTA_EXHAUSTED';
  return 'PROVIDER_NOTICE';
}

alphaVantageRouter.get('/status', (_req: Request, res: Response) => {
  const configured = Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim());
  res.json({
    provider: 'alpha_vantage',
    configured,
    role: 'SECONDARY_CROSS_VALIDATION',
    primaryProvider: 'yahoo_finance',
    keyExposedToClient: false,
    nonBlocking: true,
    cacheTtlHours: DEFAULT_CACHE_TTL_MS / 3_600_000,
    cachedEntries: crossCheckCache.size
  });
});

alphaVantageRouter.post('/cross-check', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ provider: 'alpha_vantage', configured: false, error: 'ALPHA_VANTAGE_API_KEY_NOT_CONFIGURED' });
    return;
  }

  const inputs = Array.isArray(req.body?.assets) ? req.body.assets : [];
  if (!inputs.length || inputs.length > 10) {
    res.status(400).json({ error: 'assets debe contener entre 1 y 10 elementos.' });
    return;
  }

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const results: any[] = [];
  let cacheHits = 0;
  let upstreamCalls = 0;
  let quotaExhausted = false;

  for (let index = 0; index < inputs.length; index++) {
    const item = inputs[index];
    const yahooTicker = String(item?.ticker ?? '').trim();
    const yahooDate = String(item?.asOfDate ?? '').slice(0, 10);
    const yahooClose = Number(item?.lastClose);

    if (!yahooTicker || !Number.isFinite(yahooClose) || yahooClose <= 0) {
      results.push({ ticker: yahooTicker || 'UNKNOWN', status: 'INVALID_INPUT' });
      continue;
    }

    const alphaSymbol = toAlphaSymbol(yahooTicker);
    if (quotaExhausted) {
      results.push({ ticker: yahooTicker, alphaSymbol, status: 'SKIPPED_QUOTA_EXHAUSTED', cached: false });
      continue;
    }

    const key = cacheKey(alphaSymbol, yahooDate, yahooClose);
    const cached = crossCheckCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      cacheHits++;
      results.push({ ...cached.result, cached: true });
      continue;
    }
    if (cached) crossCheckCache.delete(key);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let result: any;
    try {
      upstreamCalls++;
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(alphaSymbol)}&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Custodia/1.0' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        result = { ticker: yahooTicker, alphaSymbol, status: 'HTTP_ERROR', httpStatus: upstream.status };
      } else {
        const payload: AlphaDailyPayload = await upstream.json();
        const notice = classifyNotice(payload);
        if (notice === 'QUOTA_EXHAUSTED') {
          quotaExhausted = true;
          result = {
            ticker: yahooTicker,
            alphaSymbol,
            status: 'QUOTA_EXHAUSTED',
            message: 'Alpha Vantage ha alcanzado su cuota disponible. Yahoo Finance continúa activo como proveedor principal.'
          };
        } else if (notice === 'PROVIDER_NOTICE') {
          result = { ticker: yahooTicker, alphaSymbol, status: 'PROVIDER_NOTICE', message: 'Alpha Vantage devolvió un aviso del proveedor.' };
        } else if (payload['Error Message']) {
          result = { ticker: yahooTicker, alphaSymbol, status: 'NOT_FOUND' };
        } else {
          const series = payload['Time Series (Daily)'];
          if (!series || !Object.keys(series).length) {
            result = { ticker: yahooTicker, alphaSymbol, status: 'NO_DATA' };
          } else {
            const dates = Object.keys(series).sort().reverse();
            const comparableDate = dates.find(d => !yahooDate || d <= yahooDate) ?? dates[0];
            const alphaClose = Number(series[comparableDate]?.['4. close']);
            if (!Number.isFinite(alphaClose) || alphaClose <= 0) {
              result = { ticker: yahooTicker, alphaSymbol, status: 'INVALID_ALPHA_PRICE' };
            } else {
              const differencePct = Math.abs(alphaClose / yahooClose - 1) * 100;
              result = {
                ticker: yahooTicker,
                alphaSymbol,
                status: differencePct <= 1 ? 'MATCH' : 'PRICE_DIVERGENCE',
                yahooDate,
                yahooClose,
                alphaDate: comparableDate,
                alphaClose,
                differencePct,
                tolerancePct: 1
              };
            }
          }
        }
      }
    } catch (error: any) {
      clearTimeout(timeout);
      result = {
        ticker: yahooTicker,
        alphaSymbol,
        status: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: controller.signal.aborted ? 'Timeout del proveedor secundario.' : 'Proveedor secundario temporalmente no disponible.'
      };
    }

    results.push({ ...result, cached: false });
    if (!['QUOTA_EXHAUSTED', 'PROVIDER_NOTICE', 'TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR'].includes(result.status)) {
      crossCheckCache.set(key, { expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS, result });
    }

    if (index < inputs.length - 1 && !quotaExhausted) await sleep(250);
  }

  const matched = results.filter(r => r.status === 'MATCH').length;
  const divergent = results.filter(r => r.status === 'PRICE_DIVERGENCE').length;
  const checked = matched + divergent;
  const failed = results.filter(r => !['MATCH', 'PRICE_DIVERGENCE', 'SKIPPED_QUOTA_EXHAUSTED'].includes(r.status)).length;
  const summaryState = quotaExhausted
    ? (checked > 0 ? 'PARTIAL_QUOTA_EXHAUSTED' : 'QUOTA_EXHAUSTED')
    : checked === inputs.length
      ? 'AVAILABLE'
      : checked > 0
        ? 'PARTIAL'
        : 'UNAVAILABLE';

  res.json({
    provider: 'alpha_vantage',
    configured: true,
    primaryProvider: 'yahoo_finance',
    role: 'SECONDARY_CROSS_VALIDATION',
    nonBlocking: true,
    primaryDataAvailable: true,
    summaryState,
    requested: inputs.length,
    checked,
    matched,
    divergent,
    failed,
    coveragePct: inputs.length ? checked / inputs.length * 100 : 0,
    cacheHits,
    upstreamCalls,
    cacheTtlHours: DEFAULT_CACHE_TTL_MS / 3_600_000,
    results,
    checkedAt: new Date().toISOString()
  });
});
