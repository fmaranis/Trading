export interface FundNavPoint {
  date: string;
  nav: number;
}

export interface FundMarketDataResult {
  provider: 'eodhd';
  isin: string;
  symbol: string;
  currency: string;
  points: FundNavPoint[];
  latestDate: string | null;
  latestNav: number | null;
  fetchedAt: string;
  cached: boolean;
}

function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return String(process.env.ALERT_INTERNAL_BASE_URL || process.env.MARKET_DATA_INTERNAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

export class FundMarketDataService {
  static async history(isin: string, from?: string, to?: string): Promise<FundMarketDataResult> {
    const params = new URLSearchParams({ isin: isin.trim().toUpperCase() });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const response = await fetch(`${apiBase()}/api/eodhd/fund-history?${params.toString()}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `FUND_MARKET_DATA_HTTP_${response.status}`);
    return payload as FundMarketDataResult;
  }
}
