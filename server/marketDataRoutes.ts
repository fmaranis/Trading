import express, { Request, Response } from 'express';
import { calculateDatasetFingerprint } from '../src/investment/data/marketData/fingerprint';

/**
 * TECHNICAL NOTICE:
 * Yahoo Finance chart/search endpoints are unofficial/undocumented integrations
 * from the perspective of this application. Availability and response format are not contractual.
 */
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
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
    error?: { code?: string; description?: string };
  };
}

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
}

interface YahooSearchResult {
  quotes?: YahooSearchQuote[];
}

interface ResolvedYahooSymbol {
  symbol: string;
  name?: string;
  quoteType?: string;
  exchange?: string;
  confidence: 'HIGH' | 'MEDIUM';
  source: 'YAHOO_EXACT_ISIN_SEARCH';
  resolvedAt: string;
}

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{10}$/;
const isinResolutionCache = new Map<string, ResolvedYahooSymbol>();

function candidateScore(candidate: YahooSearchQuote): number {
  const type = String(candidate.quoteType || '').toUpperCase();
  const symbol = String(candidate.symbol || '').toUpperCase();
  let score = 0;
  if (type === 'MUTUALFUND') score += 100;
  else if (type === 'ETF') score += 80;
  else return -Infinity;
  if (symbol.startsWith('0P')) score += 30;
  if (candidate.longname || candidate.shortname) score += 5;
  return score;
}

async function yahooSymbolHasHistory(symbol: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&events=history&includeAdjustedClose=true`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return false;
    const payload = await response.json() as YahooChartResult;
    return Boolean(payload.chart?.result?.[0]?.timestamp?.length);
  } catch { return false; }
  finally { clearTimeout(timeoutId); }
}

marketDataRouter.get('/resolve-symbol', async (req: Request, res: Response): Promise<void> => {
  const raw = typeof req.query.isin === 'string' ? req.query.isin.trim().toUpperCase() : '';
  if (!ISIN_PATTERN.test(raw)) {
    res.status(400).json({ error: 'ISIN inválido.' });
    return;
  }

  const cached = isinResolutionCache.get(raw);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(raw)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;

  try {
    const upstreamRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (upstreamRes.status === 429) {
      res.status(429).json({ error: 'Rate limit del proveedor al resolver ISIN.' });
      return;
    }
    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).json({ error: `Yahoo search HTTP ${upstreamRes.status}` });
      return;
    }

    const payload = await upstreamRes.json() as YahooSearchResult;
    const compatible = (payload.quotes ?? [])
      .filter(q => Boolean(q.symbol) && Number.isFinite(candidateScore(q)))
      .map(q => ({ q, score: candidateScore(q) }))
      .sort((a, b) => b.score - a.score);

    if (!compatible.length) {
      res.status(404).json({ error: `Yahoo no devolvió una equivalencia fiable para ${raw}.` });
      return;
    }

    const bestScore = compatible[0].score;
    const top = compatible.filter(item => item.score === bestScore);
    if (top.length !== 1) {
      res.status(409).json({ error: `Equivalencia ambigua para ${raw}; no se selecciona automáticamente.` });
      return;
    }

    const candidate = top[0].q;
    const symbol = String(candidate.symbol).trim();
    const hasHistory = await yahooSymbolHasHistory(symbol, timeoutMs);
    if (!hasHistory) {
      res.status(404).json({ error: `La coincidencia Yahoo ${symbol} no tiene histórico utilizable.` });
      return;
    }

    const quoteType = String(candidate.quoteType || '').toUpperCase();
    const resolved: ResolvedYahooSymbol = {
      symbol,
      name: candidate.longname || candidate.shortname,
      quoteType,
      exchange: candidate.exchDisp || candidate.exchange,
      confidence: quoteType === 'MUTUALFUND' && symbol.toUpperCase().startsWith('0P') ? 'HIGH' : 'MEDIUM',
      source: 'YAHOO_EXACT_ISIN_SEARCH',
      resolvedAt: new Date().toISOString()
    };
    isinResolutionCache.set(raw, resolved);
    res.json({ ...resolved, cached: false });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      res.status(504).json({ error: `Timeout resolviendo ISIN tras ${timeoutMs}ms.` });
      return;
    }
    res.status(502).json({ error: `Error resolviendo ISIN en Yahoo: ${err?.message || err}` });
  }
});

marketDataRouter.get('/history', async (req: Request, res: Response): Promise<void> => {
  const { symbol, startDate, endDate, timeframe = '1d', adjusted = 'true' } = req.query;
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    res.status(400).json({ error: 'El parámetro "symbol" es obligatorio.' }); return;
  }
  if (!startDate || typeof startDate !== 'string' || !endDate || typeof endDate !== 'string') {
    res.status(400).json({ error: 'Los parámetros "startDate" y "endDate" son obligatorios.' }); return;
  }
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (isNaN(startMs) || isNaN(endMs)) { res.status(400).json({ error: 'Formato de fechas inválido.' }); return; }
  if (startMs >= endMs) { res.status(400).json({ error: 'startDate debe ser anterior a endDate.' }); return; }
  const nowMs = Date.now();
  if (startMs > nowMs) { res.status(400).json({ error: 'startDate no puede ser posterior a la fecha actual.' }); return; }

  const cleanSymbol = symbol.trim();
  const isAdjusted = adjusted !== 'false';
  const effectiveEndMs = Math.min(endMs, nowMs);
  const period1 = Math.floor(startMs / 1000);
  const period2 = Math.floor(effectiveEndMs / 1000);
  let interval = '1d';
  if (timeframe === '1wk') interval = '1wk';
  if (timeframe === '1mo') interval = '1mo';
  const timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?period1=${period1}&period2=${period2}&interval=${interval}&events=history&includeAdjustedClose=true`;

  try {
    const upstreamRes = await fetch(yahooUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 Custodia/1.0',
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (upstreamRes.status === 404) { res.status(404).json({ error: `Símbolo no encontrado: ${cleanSymbol}`, provider: 'yahoo_finance' }); return; }
    if (upstreamRes.status === 429) {
      const retryHeader = upstreamRes.headers.get('retry-after');
      const parsed = retryHeader ? parseInt(retryHeader, 10) : NaN;
      res.status(429).json({ error: 'Rate limit del proveedor.', retryAfterSeconds: Number.isFinite(parsed) && parsed > 0 ? parsed : 30 }); return;
    }
    if (!upstreamRes.ok) { res.status(upstreamRes.status).json({ error: `Error proveedor HTTP ${upstreamRes.status}` }); return; }

    const payload: YahooChartResult = await upstreamRes.json();
    if (payload.chart?.error) { res.status(404).json({ error: payload.chart.error.description || 'Error del proveedor' }); return; }
    const result = payload.chart?.result?.[0];
    if (!result?.timestamp?.length) { res.status(404).json({ error: `Sin datos históricos para ${cleanSymbol}.` }); return; }
    const quotes = result.indicators?.quote?.[0];
    const adjcloses = result.indicators?.adjclose?.[0]?.adjclose;
    if (!quotes?.close) { res.status(502).json({ error: 'Estructura de precios incompleta.' }); return; }

    const bars: Array<{timestamp:string;open:number;high:number;low:number;close:number;volume:number}> = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const t = result.timestamp[i];
      const rawOpen = quotes.open?.[i]; const rawHigh = quotes.high?.[i]; const rawLow = quotes.low?.[i]; const rawClose = quotes.close?.[i];
      const rawAdjClose = adjcloses?.[i]; const rawVolume = quotes.volume?.[i];
      if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null || rawOpen <= 0 || rawHigh <= 0 || rawLow <= 0 || rawClose <= 0) continue;
      let open = rawOpen, high = rawHigh, low = rawLow, close = rawClose;
      if (isAdjusted && rawAdjClose != null && rawAdjClose > 0) {
        const factor = rawAdjClose / rawClose;
        open = rawOpen * factor; high = rawHigh * factor; low = rawLow * factor; close = rawAdjClose;
      }
      if (high < low || high < open || high < close || low > open || low > close) continue;
      bars.push({ timestamp: new Date(t * 1000).toISOString(), open, high, low, close, volume: rawVolume != null && rawVolume >= 0 ? rawVolume : 0 });
    }
    if (!bars.length) { res.status(404).json({ error: `No hay cotizaciones válidas para ${cleanSymbol}.` }); return; }
    const datasetFingerprint = calculateDatasetFingerprint(bars);
    res.json({
      bars,
      metadata: {
        providerId: 'yahoo_finance', providerName: 'Yahoo Finance',
        provider: { id: 'yahoo_finance', name: 'Yahoo Finance', endpointType: 'UNOFFICIAL_CHART_ENDPOINT' },
        symbol: cleanSymbol, requestedStartDate: startDate, requestedEndDate: endDate,
        actualStartDate: bars[0].timestamp, actualEndDate: bars[bars.length - 1].timestamp,
        timeframe: timeframe as string, adjusted: isAdjusted,
        adjustmentStatus: isAdjusted ? 'ADJUSTED_DERIVED' : 'UNADJUSTED',
        adjustmentMethod: isAdjusted ? 'PROVIDER_ADJCLOSE_RATIO' : 'NONE',
        datasetFingerprint,
        currency: result.meta?.currency || undefined,
        exchange: result.meta?.exchangeName || undefined,
        fetchedAt: new Date().toISOString(), cached: false
      }
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError' || controller.signal.aborted) { res.status(504).json({ error: `Timeout tras ${timeoutMs}ms.` }); return; }
    res.status(502).json({ error: `Error al conectar con el proveedor: ${err?.message || err}` });
  }
});
