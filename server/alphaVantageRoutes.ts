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

function toAlphaSymbol(yahooTicker: string): string {
  const clean = yahooTicker.trim().toUpperCase();
  if (clean.endsWith('.DE')) return `${clean.slice(0, -3)}.DEX`;
  return clean;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

alphaVantageRouter.get('/status', (_req: Request, res: Response) => {
  const configured = Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim());
  res.json({
    provider: 'alpha_vantage',
    configured,
    role: 'SECONDARY_CROSS_VALIDATION',
    primaryProvider: 'yahoo_finance',
    keyExposedToClient: false
  });
});

alphaVantageRouter.post('/cross-check', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      provider: 'alpha_vantage',
      configured: false,
      error: 'ALPHA_VANTAGE_API_KEY_NOT_CONFIGURED'
    });
    return;
  }

  const inputs = Array.isArray(req.body?.assets) ? req.body.assets : [];
  if (!inputs.length || inputs.length > 10) {
    res.status(400).json({ error: 'assets debe contener entre 1 y 10 elementos.' });
    return;
  }

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const results: any[] = [];

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(alphaSymbol)}&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Custodia/1.0' }, signal: controller.signal });
      clearTimeout(timeout);
      if (!upstream.ok) {
        results.push({ ticker: yahooTicker, alphaSymbol, status: 'HTTP_ERROR', httpStatus: upstream.status });
        continue;
      }
      const payload: AlphaDailyPayload = await upstream.json();
      if (payload.Note || payload.Information) {
        results.push({ ticker: yahooTicker, alphaSymbol, status: 'RATE_LIMIT_OR_NOTICE', message: payload.Note || payload.Information });
        continue;
      }
      if (payload['Error Message']) {
        results.push({ ticker: yahooTicker, alphaSymbol, status: 'NOT_FOUND', message: payload['Error Message'] });
        continue;
      }
      const series = payload['Time Series (Daily)'];
      if (!series || !Object.keys(series).length) {
        results.push({ ticker: yahooTicker, alphaSymbol, status: 'NO_DATA' });
        continue;
      }

      const dates = Object.keys(series).sort().reverse();
      const comparableDate = dates.find(d => !yahooDate || d <= yahooDate) ?? dates[0];
      const alphaClose = Number(series[comparableDate]?.['4. close']);
      if (!Number.isFinite(alphaClose) || alphaClose <= 0) {
        results.push({ ticker: yahooTicker, alphaSymbol, status: 'INVALID_ALPHA_PRICE' });
        continue;
      }
      const differencePct = Math.abs(alphaClose / yahooClose - 1) * 100;
      results.push({
        ticker: yahooTicker,
        alphaSymbol,
        status: differencePct <= 1 ? 'MATCH' : 'PRICE_DIVERGENCE',
        yahooDate,
        yahooClose,
        alphaDate: comparableDate,
        alphaClose,
        differencePct,
        tolerancePct: 1
      });
    } catch (error: any) {
      clearTimeout(timeout);
      results.push({ ticker: yahooTicker, alphaSymbol, status: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', message: error?.message || String(error) });
    }

    // Keep requests serialized and slightly spaced to be polite with the free API tier.
    if (index < inputs.length - 1) await sleep(250);
  }

  const matched = results.filter(r => r.status === 'MATCH').length;
  const divergent = results.filter(r => r.status === 'PRICE_DIVERGENCE').length;
  const checked = results.filter(r => ['MATCH', 'PRICE_DIVERGENCE'].includes(r.status)).length;
  res.json({
    provider: 'alpha_vantage',
    configured: true,
    primaryProvider: 'yahoo_finance',
    role: 'SECONDARY_CROSS_VALIDATION',
    requested: inputs.length,
    checked,
    matched,
    divergent,
    coveragePct: inputs.length ? checked / inputs.length * 100 : 0,
    results,
    checkedAt: new Date().toISOString()
  });
});
