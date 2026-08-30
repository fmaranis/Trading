export interface FundNavPoint {
  date: string;
  nav: number;
}

export interface FundMarketDataResult {
  provider: 'eodhd' | 'yahoo_finance_fund_alias';
  isin: string;
  symbol: string;
  currency: string;
  points: FundNavPoint[];
  latestDate: string | null;
  latestNav: number | null;
  fetchedAt: string;
  cached: boolean;
}

/**
 * Explicitly verified Yahoo Finance aliases for funds whose public identity is an ISIN
 * but whose Yahoo REAL series is published under a provider-specific 0P... symbol.
 * Keep this registry curated: never guess aliases for arbitrary ISINs.
 */
export const VERIFIED_YAHOO_FUND_ALIASES: Record<string, string> = {
  IE00B03HD191: '0P00000WLG.F',
  IE0031786696: '0P00012I6A.F',
  ES0174115065: '0P0001PBAK.F'
};

function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return String(process.env.ALERT_INTERNAL_BASE_URL || process.env.MARKET_DATA_INTERNAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

function oneYearAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string { return new Date().toISOString().slice(0, 10); }

async function yahooAliasHistory(isin: string, symbol: string, from?: string, to?: string): Promise<FundMarketDataResult> {
  const startDate = from || oneYearAgo();
  const endDate = to || today();
  const params = new URLSearchParams({ symbol, startDate, endDate, timeframe: '1d', adjusted: 'true' });
  const response = await fetch(`${apiBase()}/api/market-data/history?${params.toString()}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `YAHOO_FUND_ALIAS_HTTP_${response.status}`);
  const points: FundNavPoint[] = (payload?.bars ?? [])
    .map((bar: any) => ({ date: String(bar?.timestamp ?? '').slice(0, 10), nav: Number(bar?.close) }))
    .filter((point: FundNavPoint) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.nav) && point.nav > 0)
    .sort((a: FundNavPoint, b: FundNavPoint) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error(`NO_YAHOO_FUND_ALIAS_HISTORY:${isin}`);
  const latest = points.at(-1)!;
  return {
    provider: 'yahoo_finance_fund_alias',
    isin,
    symbol,
    currency: payload?.metadata?.currency || 'EUR',
    points,
    latestDate: latest.date,
    latestNav: latest.nav,
    fetchedAt: payload?.metadata?.fetchedAt || new Date().toISOString(),
    cached: Boolean(payload?.metadata?.cached)
  };
}

export class FundMarketDataService {
  static async history(isin: string, from?: string, to?: string): Promise<FundMarketDataResult> {
    const normalizedIsin = isin.trim().toUpperCase();
    const verifiedAlias = VERIFIED_YAHOO_FUND_ALIASES[normalizedIsin];

    // For explicitly verified aliases prefer the primary REAL Yahoo route so the
    // fund remains searchable by its normal ISIN even when Yahoo uses another symbol.
    if (verifiedAlias) {
      try { return await yahooAliasHistory(normalizedIsin, verifiedAlias, from, to); }
      catch { /* fall through to EODHD */ }
    }

    const params = new URLSearchParams({ isin: normalizedIsin });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const response = await fetch(`${apiBase()}/api/eodhd/fund-history?${params.toString()}`);
    const payload = await response.json().catch(() => null);
    if (response.ok) return payload as FundMarketDataResult;

    // Only verified mappings are allowed as fallback; arbitrary ISINs remain explicit DATA_MISSING.
    if (verifiedAlias) return yahooAliasHistory(normalizedIsin, verifiedAlias, from, to);
    throw new Error(payload?.error || `FUND_MARKET_DATA_HTTP_${response.status}`);
  }
}
