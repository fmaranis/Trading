import express, { Request, Response } from 'express';

export const assetDiscoveryRouter = express.Router();

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
};

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{10}$/;
const ALLOWED_TYPES = new Set(['ETF', 'MUTUALFUND', 'EQUITY']);

async function inspectYahooSymbol(symbol: string): Promise<{ currency?: string; instrumentType?: string; bars: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000);
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

assetDiscoveryRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2 || query.length > 120) { res.status(400).json({ error: 'INVALID_SEARCH_QUERY' }); return; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MARKET_DATA_TIMEOUT_MS) || 10000);
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&enableFuzzyQuery=true`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Custodia/1.0', Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) { res.status(response.status).json({ error: `YAHOO_SEARCH_HTTP_${response.status}` }); return; }
    const payload = await response.json() as { quotes?: YahooQuote[] };
    const ranked = (payload.quotes ?? [])
      .map(q => ({ q, score: quoteScore(q, query) }))
      .filter(row => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const results: any[] = [];
    for (const { q } of ranked) {
      const symbol = String(q.symbol ?? '').trim();
      const inspection = await inspectYahooSymbol(symbol);
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
    clearTimeout(timeout);
    res.status(controller.signal.aborted ? 504 : 502).json({ error: controller.signal.aborted ? 'YAHOO_SEARCH_TIMEOUT' : (error?.message || String(error)) });
  }
});
