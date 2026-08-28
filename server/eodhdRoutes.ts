import express, { Request, Response } from 'express';

export const eodhdRouter = express.Router();

type EodhdBar = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  adjusted_close?: number;
  volume?: number;
};

type CachedCrossCheck = { expiresAt: number; result: any };
const crossCheckCache = new Map<string, CachedCrossCheck>();
const fundHistoryCache = new Map<string, CachedCrossCheck>();
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FUND_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function toEodhdSymbol(yahooTicker: string): string {
  const clean = yahooTicker.trim().toUpperCase();
  if (clean.endsWith('.DE')) return `${clean.slice(0, -3)}.XETRA`;
  return clean;
}

function cacheKey(symbol: string, yahooDate: string, yahooClose: number): string {
  return `${symbol}|${yahooDate}|${yahooClose.toFixed(6)}`;
}

function isQuotaMessage(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes('limit') || normalized.includes('quota') || normalized.includes('api calls');
}

function validIsin(value: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value);
}

eodhdRouter.get('/status', (_req: Request, res: Response) => {
  const configured = Boolean(process.env.EODHD_API_KEY?.trim());
  res.json({
    provider: 'eodhd',
    configured,
    role: 'SECONDARY_CROSS_VALIDATION_AND_FUND_NAV',
    primaryProvider: 'yahoo_finance',
    keyExposedToClient: false,
    nonBlocking: true,
    cacheTtlHours: DEFAULT_CACHE_TTL_MS / 3_600_000,
    cachedEntries: crossCheckCache.size,
    fundHistoryCachedEntries: fundHistoryCache.size
  });
});

eodhdRouter.get('/fund-history', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.EODHD_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ provider: 'eodhd', configured: false, error: 'EODHD_API_KEY_NOT_CONFIGURED' });
    return;
  }

  const isin = String(req.query.isin ?? '').trim().toUpperCase();
  if (!validIsin(isin)) {
    res.status(400).json({ error: 'INVALID_ISIN' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultFromDate = new Date();
  defaultFromDate.setUTCFullYear(defaultFromDate.getUTCFullYear() - 1);
  const from = String(req.query.from ?? defaultFromDate.toISOString().slice(0, 10)).slice(0, 10);
  const to = String(req.query.to ?? today).slice(0, 10);
  const symbol = `${isin}.EUFUND`;
  const key = `${symbol}|${from}|${to}`;
  const cached = fundHistoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ ...cached.result, cached: true });
    return;
  }
  if (cached) fundHistoryCache.delete(key);

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(apiKey)}&fmt=json&period=d&order=a&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const upstream = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Custodia/1.0' }, signal: controller.signal });
    clearTimeout(timeout);
    const text = await upstream.text();
    if (!upstream.ok) {
      if (upstream.status === 429 || isQuotaMessage(text)) {
        res.status(429).json({ provider: 'eodhd', error: 'QUOTA_EXHAUSTED' });
      } else if (upstream.status === 401 || upstream.status === 403) {
        res.status(502).json({ provider: 'eodhd', error: 'AUTH_ERROR' });
      } else if (upstream.status === 404) {
        res.status(404).json({ provider: 'eodhd', error: 'FUND_NOT_FOUND', isin, symbol });
      } else {
        res.status(502).json({ provider: 'eodhd', error: 'UPSTREAM_HTTP_ERROR', httpStatus: upstream.status });
      }
      return;
    }

    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = null; }
    if (!Array.isArray(payload)) {
      res.status(502).json({ provider: 'eodhd', error: 'INVALID_UPSTREAM_PAYLOAD' });
      return;
    }

    const points = (payload as EodhdBar[])
      .map(bar => ({ date: String(bar.date ?? ''), nav: Number(bar.adjusted_close ?? bar.close) }))
      .filter(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.nav) && point.nav > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!points.length) {
      res.status(404).json({ provider: 'eodhd', error: 'NO_FUND_HISTORY', isin, symbol });
      return;
    }

    const latest = points.at(-1)!;
    const result = {
      provider: 'eodhd',
      isin,
      symbol,
      currency: 'EUR',
      points,
      latestDate: latest.date,
      latestNav: latest.nav,
      fetchedAt: new Date().toISOString(),
      cached: false
    };
    fundHistoryCache.set(key, { expiresAt: Date.now() + FUND_CACHE_TTL_MS, result });
    res.json(result);
  } catch {
    clearTimeout(timeout);
    res.status(controller.signal.aborted ? 504 : 502).json({ provider: 'eodhd', error: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR' });
  }
});

eodhdRouter.post('/cross-check', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.EODHD_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ provider: 'eodhd', configured: false, error: 'EODHD_API_KEY_NOT_CONFIGURED' });
    return;
  }

  const inputs = Array.isArray(req.body?.assets) ? req.body.assets : [];
  if (!inputs.length || inputs.length > 10) {
    res.status(400).json({ error: 'assets debe contener entre 1 y 10 elementos.' });
    return;
  }

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const results: any[] = [];
  let upstreamCalls = 0;
  let cacheHits = 0;
  let quotaExhausted = false;

  for (const item of inputs) {
    const yahooTicker = String(item?.ticker ?? '').trim();
    const yahooDate = String(item?.asOfDate ?? '').slice(0, 10);
    const yahooClose = Number(item?.lastClose);
    if (!yahooTicker || !Number.isFinite(yahooClose) || yahooClose <= 0) {
      results.push({ ticker: yahooTicker || 'UNKNOWN', status: 'INVALID_INPUT' });
      continue;
    }

    const eodhdSymbol = toEodhdSymbol(yahooTicker);
    if (quotaExhausted) {
      results.push({ ticker: yahooTicker, eodhdSymbol, status: 'SKIPPED_QUOTA_EXHAUSTED', cached: false });
      continue;
    }

    const key = cacheKey(eodhdSymbol, yahooDate, yahooClose);
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
      const from = yahooDate || new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const url = `https://eodhd.com/api/eod/${encodeURIComponent(eodhdSymbol)}?api_token=${encodeURIComponent(apiKey)}&fmt=json&period=d&order=d&from=${encodeURIComponent(from)}&to=${encodeURIComponent(yahooDate || from)}`;
      const upstream = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Custodia/1.0' }, signal: controller.signal });
      clearTimeout(timeout);

      const text = await upstream.text();
      if (!upstream.ok) {
        if (upstream.status === 429 || isQuotaMessage(text)) {
          quotaExhausted = true;
          result = { ticker: yahooTicker, eodhdSymbol, status: 'QUOTA_EXHAUSTED', message: 'EODHD ha alcanzado su cuota disponible. Yahoo Finance continúa activo como proveedor principal.' };
        } else if (upstream.status === 401 || upstream.status === 403) {
          result = { ticker: yahooTicker, eodhdSymbol, status: 'AUTH_ERROR', message: 'EODHD rechazó la autenticación del backend.' };
        } else if (upstream.status === 404) {
          result = { ticker: yahooTicker, eodhdSymbol, status: 'NOT_FOUND' };
        } else {
          result = { ticker: yahooTicker, eodhdSymbol, status: 'HTTP_ERROR', httpStatus: upstream.status };
        }
      } else {
        let payload: unknown;
        try { payload = JSON.parse(text); } catch { payload = null; }
        if (!Array.isArray(payload) || !payload.length) {
          result = { ticker: yahooTicker, eodhdSymbol, status: 'NO_DATA' };
        } else {
          const bars = payload as EodhdBar[];
          const bar = [...bars].reverse().find(b => b.date && (!yahooDate || b.date <= yahooDate));
          const eodhdClose = Number(bar?.adjusted_close ?? bar?.close);
          if (!bar?.date || !Number.isFinite(eodhdClose) || eodhdClose <= 0) {
            result = { ticker: yahooTicker, eodhdSymbol, status: 'INVALID_EODHD_PRICE' };
          } else {
            const differencePct = Math.abs(eodhdClose / yahooClose - 1) * 100;
            result = {
              ticker: yahooTicker,
              eodhdSymbol,
              status: differencePct <= 1 ? 'MATCH' : 'PRICE_DIVERGENCE',
              yahooDate,
              yahooClose,
              eodhdDate: bar.date,
              eodhdClose,
              differencePct,
              tolerancePct: 1
            };
          }
        }
      }
    } catch {
      clearTimeout(timeout);
      result = {
        ticker: yahooTicker,
        eodhdSymbol,
        status: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: controller.signal.aborted ? 'Timeout del proveedor secundario.' : 'EODHD temporalmente no disponible.'
      };
    }

    results.push({ ...result, cached: false });
    if (!['QUOTA_EXHAUSTED', 'TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR', 'AUTH_ERROR'].includes(result.status)) {
      crossCheckCache.set(key, { expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS, result });
    }
  }

  const matched = results.filter(r => r.status === 'MATCH').length;
  const divergent = results.filter(r => r.status === 'PRICE_DIVERGENCE').length;
  const checked = matched + divergent;
  const summaryState = quotaExhausted
    ? (checked > 0 ? 'PARTIAL_QUOTA_EXHAUSTED' : 'QUOTA_EXHAUSTED')
    : checked === inputs.length ? 'AVAILABLE' : checked > 0 ? 'PARTIAL' : 'UNAVAILABLE';

  res.json({
    provider: 'eodhd',
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
    coveragePct: inputs.length ? checked / inputs.length * 100 : 0,
    cacheHits,
    upstreamCalls,
    cacheTtlHours: DEFAULT_CACHE_TTL_MS / 3_600_000,
    results,
    checkedAt: new Date().toISOString()
  });
});
