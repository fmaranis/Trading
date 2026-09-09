import express, { Request, Response } from 'express';
import {
  OPEN_MARKET_DISCOVERY_V1,
  OPEN_MARKET_DISCOVERY_V1_LIMITATIONS,
  OPEN_MARKET_DISCOVERY_V1_QUERIES,
  type OpenMarketDiscoveryV1Asset,
  type OpenMarketDiscoveryQuery
} from '../src/investment/decision/openMarketDiscoveryV1';

export const assetDiscoveryRouter = express.Router();

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
  currency?: string;
};

type YahooLookupDocument = {
  symbol?: string;
  name?: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  typeDisp?: string;
  exchange?: string;
  exchangeDisplay?: string;
  currency?: string;
};

type YahooInspection = { currency?: string; instrumentType?: string; bars: number };
type DiscoveryMechanism = 'SEARCH' | 'LOOKUP';
type DiscoveryFamily = Pick<OpenMarketDiscoveryQuery, 'id' | 'category' | 'breadth' | 'defensive'>;
type RawDiscoveryRow = { family: DiscoveryFamily; quote: YahooQuote; mechanism: DiscoveryMechanism };

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{10}$/;
const ALLOWED_TYPES = new Set(['ETF', 'MUTUALFUND', 'EQUITY']);
const OPEN_SWEEP_TYPES = new Set(['ETF', 'EQUITY']);
const OPEN_SWEEP_CACHE_MS = 6 * 60 * 60 * 1000;
const OPEN_SWEEP_QUOTES_PER_QUERY = 16;
const OPEN_SWEEP_ROWS_PER_QUERY = 6;

// Primary EUR listings only. Secondary Frankfurt/Stuttgart/etc. aliases are
// intentionally excluded from open enumeration to reduce duplicate companies.
const EUR_PRIMARY_LISTING_SUFFIXES = ['.DE', '.PA', '.MC', '.MI', '.AS', '.BR', '.VI', '.HE', '.LS', '.IR'] as const;
const EUR_PRIMARY_LISTING_SUFFIX_SET = new Set<string>(EUR_PRIMARY_LISTING_SUFFIXES);
const LOOKUP_SUFFIX_COUNT = 500;
const LOOKUP_ROWS_PER_SUFFIX = 24;
const LOOKUP_MIN_RAW_CANDIDATES = 96;
const LOOKUP_MAX_RAW_CANDIDATES = 192;
const LOOKUP_PREFIX_COUNT = 300;
const LOOKUP_PREFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

/**
 * Yahoo Lookup is the current symbol-enumeration endpoint also used by yfinance.
 * It is current/live only. We first try suffix wildcards for primary EUR listings;
 * if Yahoo returns too little, an alphabetic prefix fallback broadens recall and
 * we still keep only explicit primary EUR listing suffixes before history checks.
 */
async function yahooLookup(query: string, count: number): Promise<YahooQuote[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const params = new URLSearchParams({
      query,
      type: 'all',
      start: '0',
      count: String(count),
      formatted: 'false',
      fetchPricingData: 'true',
      lang: 'en-US',
      region: 'US'
    });
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/lookup?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`YAHOO_LOOKUP_HTTP_${response.status}`);
    const payload = await response.json() as { finance?: { result?: Array<{ documents?: YahooLookupDocument[] }>; error?: unknown } };
    if (payload.finance?.error) throw new Error('YAHOO_LOOKUP_PAYLOAD_ERROR');
    const documents = payload.finance?.result?.[0]?.documents;
    if (!Array.isArray(documents)) return [];
    return documents.map(document => ({
      symbol: document.symbol,
      longname: document.longName || document.name || document.shortName,
      shortname: document.shortName || document.name,
      quoteType: document.quoteType || document.typeDisp,
      exchange: document.exchange,
      exchDisp: document.exchangeDisplay,
      currency: document.currency
    }));
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

function primaryEurSuffix(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  for (const suffix of EUR_PRIMARY_LISTING_SUFFIXES) if (upper.endsWith(suffix)) return suffix;
  return null;
}

function classifyOpenEtf(name: string): { category: OpenMarketDiscoveryV1Asset['asset']['category']; defensive: boolean } {
  const text = name.toUpperCase();
  if (text.includes('SEMICONDUCT')) return { category: 'SEMICONDUCTORS', defensive: false };
  if (text.includes('HEALTH')) return { category: 'HEALTHCARE', defensive: false };
  if (text.includes('ENERGY') || text.includes('OIL') || text.includes('CLEAN ENERGY')) return { category: 'ENERGY', defensive: false };
  if (text.includes('SMALL CAP')) return { category: 'SMALL_CAP', defensive: false };
  if (text.includes('EMERGING')) return { category: 'EMERGING_EQUITY', defensive: false };
  if (text.includes('JAPAN')) return { category: 'JAPAN_EQUITY', defensive: false };
  if (text.includes('DIVIDEND')) return { category: 'DIVIDEND', defensive: false };
  if (text.includes('TECH') || text.includes('NASDAQ')) return { category: 'TECHNOLOGY', defensive: false };
  if (text.includes('GOLD')) return { category: 'GOLD', defensive: true };
  if (text.includes('COMMODIT')) return { category: 'COMMODITIES', defensive: true };
  if (text.includes('OVERNIGHT') || text.includes('MONEY MARKET') || text.includes('€STR') || text.includes('ESTR')) return { category: 'MONEY_MARKET', defensive: true };
  if (text.includes('BOND') || text.includes('TREASUR') || text.includes('GOVERNMENT')) return { category: 'AGG_BONDS', defensive: true };
  if (text.includes('EUROPE') || text.includes('EURO STOXX') || text.includes('STOXX EUROPE')) return { category: 'EUROPE_EQUITY', defensive: false };
  if (text.includes('S&P 500') || text.includes('USA') || text.includes('US EQUITY')) return { category: 'US_EQUITY', defensive: false };
  return { category: 'GLOBAL_EQUITY', defensive: false };
}

async function buildLookupRows(): Promise<{
  rows: RawDiscoveryRow[];
  queries: number;
  fallbackQueries: number;
  failures: Array<{ id: string; error: string }>;
}> {
  const family: DiscoveryFamily = { id: 'LOOKUP_EUR_PRIMARY', category: 'EUROPE_EQUITY', breadth: 'BROAD' };
  const failures: Array<{ id: string; error: string }> = [];
  let queries = 0;
  let fallbackQueries = 0;
  const rows: RawDiscoveryRow[] = [];

  const suffixResults = await mapLimit(EUR_PRIMARY_LISTING_SUFFIXES, 4, async suffix => {
    queries++;
    try {
      const quotes = await yahooLookup(`*${suffix}`, LOOKUP_SUFFIX_COUNT);
      return { suffix, quotes, error: null as string | null };
    } catch (error: any) {
      return { suffix, quotes: [] as YahooQuote[], error: error?.message || String(error) };
    }
  });
  for (const result of suffixResults) {
    if (result.error) failures.push({ id: `LOOKUP_SUFFIX_${result.suffix}`, error: result.error });
    const filtered = result.quotes.filter(quote => String(quote.symbol ?? '').toUpperCase().endsWith(result.suffix));
    for (const quote of filtered.slice(0, LOOKUP_ROWS_PER_SUFFIX)) rows.push({ family, quote, mechanism: 'LOOKUP' });
  }

  const uniquePrimary = new Set(rows.map(row => String(row.quote.symbol ?? '').toUpperCase()).filter(Boolean));
  if (uniquePrimary.size < LOOKUP_MIN_RAW_CANDIDATES) {
    const prefixResults = await mapLimit(LOOKUP_PREFIXES, 4, async prefix => {
      queries++;
      fallbackQueries++;
      try {
        const quotes = await yahooLookup(`${prefix}*`, LOOKUP_PREFIX_COUNT);
        return { prefix, quotes, error: null as string | null };
      } catch (error: any) {
        return { prefix, quotes: [] as YahooQuote[], error: error?.message || String(error) };
      }
    });
    for (const result of prefixResults) {
      if (result.error) failures.push({ id: `LOOKUP_PREFIX_${result.prefix}`, error: result.error });
      for (const quote of result.quotes) {
        const symbol = String(quote.symbol ?? '').trim().toUpperCase();
        if (!symbol || !primaryEurSuffix(symbol) || uniquePrimary.has(symbol)) continue;
        rows.push({ family, quote: { ...quote, symbol }, mechanism: 'LOOKUP' });
        uniquePrimary.add(symbol);
        if (uniquePrimary.size >= LOOKUP_MAX_RAW_CANDIDATES) break;
      }
      if (uniquePrimary.size >= LOOKUP_MAX_RAW_CANDIDATES) break;
    }
  }

  return { rows, queries, fallbackQueries, failures };
}

async function buildOpenSweep() {
  const generatedAt = new Date().toISOString();
  const queryResults = await mapLimit(OPEN_MARKET_DISCOVERY_V1_QUERIES, 3, async family => {
    try {
      const quotes = await yahooSearch(family.query, OPEN_SWEEP_QUOTES_PER_QUERY);
      return { family, quotes, error: null as string | null };
    } catch (error: any) {
      return { family, quotes: [] as YahooQuote[], error: error?.message || String(error) };
    }
  });

  // Search remains a thematic/category-aware complement. Yahoo Lookup supplies
  // broad current symbol enumeration so product discovery is not constrained by
  // the semantic quality of a handful of natural-language search phrases.
  const searchRaw: RawDiscoveryRow[] = queryResults.flatMap(({ family, quotes }) => quotes
    .filter(q => q.symbol && OPEN_SWEEP_TYPES.has(String(q.quoteType ?? '').toUpperCase()))
    .slice(0, OPEN_SWEEP_ROWS_PER_QUERY)
    .map(q => ({ family, quote: q, mechanism: 'SEARCH' as const })));
  const lookup = await buildLookupRows();
  const raw = [...searchRaw, ...lookup.rows];

  // Search rows come first so a more specific thematic category wins when the
  // same ticker is also found by broad Lookup enumeration.
  const unique = new Map<string, RawDiscoveryRow>();
  for (const row of raw) {
    const symbol = String(row.quote.symbol ?? '').toUpperCase();
    if (symbol && !unique.has(symbol)) unique.set(symbol, row);
  }

  const prefiltered = [...unique.values()].filter(row => {
    const symbol = String(row.quote.symbol ?? '').toUpperCase();
    const currency = String(row.quote.currency ?? '').toUpperCase();
    if (row.mechanism === 'LOOKUP' && !primaryEurSuffix(symbol)) return false;
    return !currency || currency === 'EUR';
  });
  const inspected = await mapLimit(prefiltered, 6, async row => ({
    ...row,
    inspection: await inspectYahooSymbol(String(row.quote.symbol))
  }));

  const assets: OpenMarketDiscoveryV1Asset[] = [];
  for (const row of inspected) {
    const symbol = String(row.quote.symbol ?? '').trim().toUpperCase();
    const type = String(row.inspection?.instrumentType ?? row.quote.quoteType ?? '').toUpperCase();
    const currency = String(row.inspection?.currency ?? row.quote.currency ?? '').toUpperCase();
    if (!symbol || currency !== 'EUR' || !row.inspection || row.inspection.bars < 252 || !OPEN_SWEEP_TYPES.has(type)) continue;
    const isEquity = type === 'EQUITY';
    const name = row.quote.longname || row.quote.shortname || symbol;
    const classified = row.mechanism === 'LOOKUP' && !isEquity
      ? classifyOpenEtf(name)
      : { category: row.family.category, defensive: isEquity ? false : Boolean(row.family.defensive) };
    assets.push({
      asset: {
        assetId: openAssetId(symbol),
        ticker: symbol,
        name,
        category: isEquity ? 'EUROPE_EQUITY' : classified.category,
        currency: 'EUR',
        defensive: isEquity ? false : classified.defensive,
        // Existing execution semantics group EUR-listed whole-share instruments
        // under ETF_ETC. This is not a claim that an EQUITY is economically an ETF.
        instrumentType: 'ETF_ETC',
        marketDataProvider: 'YAHOO'
      },
      source: 'YAHOO_LIVE_QUERY_SWEEP',
      queryFamily: row.mechanism === 'LOOKUP' ? `LOOKUP:${primaryEurSuffix(symbol) ?? 'EUR'}` : row.family.id,
      breadth: row.mechanism === 'LOOKUP' ? 'BROAD' : row.family.breadth,
      discoveredAt: generatedAt,
      quoteType: type,
      exchange: row.quote.exchDisp || row.quote.exchange || null,
      historyBars3y: row.inspection.bars,
      historicalPointInTimeSafe: false
    });
  }

  const mechanismCounts = assets.reduce<Record<DiscoveryMechanism, number>>((acc, row) => {
    const mechanism: DiscoveryMechanism = row.queryFamily.startsWith('LOOKUP:') ? 'LOOKUP' : 'SEARCH';
    acc[mechanism] = (acc[mechanism] ?? 0) + 1;
    return acc;
  }, { SEARCH: 0, LOOKUP: 0 });

  return {
    version: OPEN_MARKET_DISCOVERY_V1,
    generatedAt,
    source: 'YAHOO_LIVE_QUERY_SWEEP' as const,
    historicalPointInTimeSafe: false as const,
    queryCount: OPEN_MARKET_DISCOVERY_V1_QUERIES.length,
    lookupQueryCount: lookup.queries,
    lookupFallbackQueryCount: lookup.fallbackQueries,
    rawCandidates: unique.size,
    searchRawCandidates: searchRaw.length,
    lookupRawCandidates: new Set(lookup.rows.map(row => String(row.quote.symbol ?? '').toUpperCase()).filter(Boolean)).size,
    acceptedEurCandidates: assets.length,
    discoveryMechanismCounts: mechanismCounts,
    assets,
    queryFailures: queryResults.filter(row => row.error).map(row => ({ id: row.family.id, error: row.error })),
    lookupFailures: lookup.failures,
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
