import express, { Request, Response } from 'express';
import {
  OPEN_MARKET_DISCOVERY_V1,
  OPEN_MARKET_DISCOVERY_V1_LIMITATIONS,
  OPEN_MARKET_DISCOVERY_V1_QUERIES,
  type OpenMarketDiscoveryV1Asset
} from '../src/investment/decision/openMarketDiscoveryV1';

export const assetDiscoveryRouter = express.Router();

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
};

type YahooInspection = { currency?: string; instrumentType?: string; bars: number };

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{10}$/;
const ALLOWED_TYPES = new Set(['ETF', 'MUTUALFUND', 'EQUITY']);
const OPEN_SWEEP_TYPES = new Set(['ETF', 'EQUITY']);
const OPEN_SWEEP_CACHE_MS = 6 * 60 * 60 * 1000;
let openSweepCache: { at: number; payload: unknown } | null = null;

function timeoutMs(): number { return Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000; }

async function yahooSearch(query: string, quotesCount = 20): Promise<YahooQuote[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${quotesCount}&newsCount=0&enableFuzzyQuery=true`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`YAHOO_SEARCH_HTTP_${response.status}`);
    const payload = await response.json() as { quotes?: YahooQuote[] };
    return Array.isArray(payload.quotes) ? payload.quotes : [];
  } finally { clearTimeout(timeout); }
}

async function inspectYahooSymbol(symbol: string): Promise<YahooInspection | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3y&interval=1d&events=history&includeAdjustedClose=true`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json() as any;
    const result = payload?.chart?.result?.[0];
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
    if (!timestamps.length) return null;
    return { currency: result?.meta?.currency, instrumentType: result?.meta?.instrumentType, bars: timestamps.length };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function quoteScore(q: YahooQuote, query: string): number {
  const type = String(q.quoteType ?? '').toUpperCase();
  if (!ALLOWED_TYPES.has(type) || !q.symbol) return -Infinity;
  const normalized = query.toUpperCase();
  let score = type === 'ETF' ? 60 : type === 'MUTUALFUND' ? 55 : 50;
  if (String(q.symbol).toUpperCase() === normalized) score += 100;
  if (`${q.longname ?? ''} ${q.shortname ?? ''}`.toUpperCase().includes(normalized)) score += 20;
  if (type === 'MUTUALFUND' && String(q.symbol).toUpperCase().startsWith('0P')) score += 10;
  return score;
}

function openAssetId(symbol: string): string {
  return `OPEN_${symbol.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

async function buildOpenSweep() {
  const generatedAt = new Date().toISOString();
  const queryResults = await mapLimit(OPEN_MARKET_DISCOVERY_V1_QUERIES, 3, async family => {
    try {
      const quotes = await yahooSearch(family.query, 12);
      return { family, quotes, error: null as string | null };
    } catch (error: any) {
      return { family, quotes: [] as YahooQuote[], error: error?.message || String(error) };
    }
  });

  const raw = queryResults.flatMap(({ family, quotes }) => quotes
    .filter(q => q.symbol && OPEN_SWEEP_TYPES.has(String(q.quoteType ?? '').toUpperCase()))
    .slice(0, 8)
    .map(q => ({ family, quote: q })));

  const unique = new Map<string, (typeof raw)[number]>();
  for (const row of raw) {
    const symbol = String(row.quote.symbol ?? '').toUpperCase();
    if (symbol && !unique.has(symbol)) unique.set(symbol, row);
  }

  const inspected = await mapLimit([...unique.values()], 4, async row => ({
    ...row,
    inspection: await inspectYahooSymbol(String(row.quote.symbol))
  }));

  const assets: OpenMarketDiscoveryV1Asset[] = [];
  for (const row of inspected) {
    const symbol = String(row.quote.symbol ?? '').trim().toUpperCase();
    const type = String(row.quote.quoteType ?? row.inspection?.instrumentType ?? '').toUpperCase();
    const currency = String(row.inspection?.currency ?? '').toUpperCase();
    if (!symbol || currency !== 'EUR' || !row.inspection || row.inspection.bars < 252) continue;
    const isEquity = type === 'EQUITY';
    assets.push({
      asset: {
        assetId: openAssetId(symbol),
        ticker: symbol,
        name: row.quote.longname || row.quote.shortname || symbol,
        category: isEquity ? 'EUROPE_EQUITY' : row.family.category,
        currency: 'EUR',
        defensive: isEquity ? false : row.family.defensive,
        instrumentType: 'ETF_ETC',
        marketDataProvider: 'YAHOO'
      },
      source: 'YAHOO_LIVE_QUERY_SWEEP',
      queryFamily: row.family.id,
      breadth: isEquity ? 'UNKNOWN' : row.family.breadth,
      discoveredAt: generatedAt,
      quoteType: type,
      exchange: row.quote.exchDisp || row.quote.exchange || null,
      historyBars3y: row.inspection.bars,
      historicalPointInTimeSafe: false
    });
  }

  return {
    version: OPEN_MARKET_DISCOVERY_V1,
    generatedAt,
    source: 'YAHOO_LIVE_QUERY_SWEEP' as const,
    historicalPointInTimeSafe: false as const,
    queryCount: OPEN_MARKET_DISCOVERY_V1_QUERIES.length,
    rawCandidates: raw.length,
    acceptedEurCandidates: assets.length,
    assets,
    queryFailures: queryResults.filter(row => row.error).map(row => ({ id: row.family.id, error: row.error })),
    limitations: OPEN_MARKET_DISCOVERY_V1_LIMITATIONS
  };
}

assetDiscoveryRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2 || query.length > 120) { res.status(400).json({ error: 'INVALID_SEARCH_QUERY' }); return; }
  try {
    const quotes = await yahooSearch(query, 20);
    const ranked = quotes
      .map(q => ({ q, score: quoteScore(q, query) }))
      .filter(row => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const inspected = await mapLimit(ranked, 4, async row => ({ row, inspection: await inspectYahooSymbol(String(row.q.symbol ?? '')) }));
    const results: any[] = [];
    for (const { row: { q }, inspection } of inspected) {
      const symbol = String(q.symbol ?? '').trim();
      if (!inspection || inspection.bars < 60) continue;
      const currency = String(inspection.currency ?? '').toUpperCase();
      results.push({
        symbol,
        name: q.longname || q.shortname || symbol,
        quoteType: String(q.quoteType ?? inspection.instrumentType ?? '').toUpperCase(),
        exchange: q.exchDisp || q.exchange || null,
        currency: currency || null,
        usableInEurEngine: currency === 'EUR',
        historyBars3y: inspection.bars,
        isin: ISIN_PATTERN.test(query.toUpperCase()) ? query.toUpperCase() : null,
        source: 'YAHOO_LIVE_DISCOVERY'
      });
    }
    res.json({ query, provider: 'yahoo_finance', openDiscovery: true, results });
  } catch (error: any) {
    res.status(String(error?.name) === 'AbortError' ? 504 : 502).json({ error: error?.message || String(error) });
  }
});

assetDiscoveryRouter.get('/open-universe', async (req: Request, res: Response): Promise<void> => {
  const refresh = String(req.query.refresh ?? '') === '1';
  try {
    if (!refresh && openSweepCache && Date.now() - openSweepCache.at < OPEN_SWEEP_CACHE_MS) {
      res.json({ ...(openSweepCache.payload as object), cached: true });
      return;
    }
    const payload = await buildOpenSweep();
    openSweepCache = { at: Date.now(), payload };
    res.json({ ...payload, cached: false });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || String(error), version: OPEN_MARKET_DISCOVERY_V1 });
  }
});
