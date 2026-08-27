export type SecondaryProviderSummaryState = 'AVAILABLE' | 'PARTIAL' | 'PARTIAL_QUOTA_EXHAUSTED' | 'QUOTA_EXHAUSTED' | 'UNAVAILABLE';

export interface EodhdStatus {
  provider: 'eodhd';
  configured: boolean;
  role: 'SECONDARY_CROSS_VALIDATION';
  primaryProvider: 'yahoo_finance';
  keyExposedToClient: boolean;
  nonBlocking: boolean;
  cacheTtlHours: number;
  cachedEntries: number;
}

export interface EodhdCrossCheckItem {
  ticker: string;
  eodhdSymbol?: string;
  status: 'MATCH' | 'PRICE_DIVERGENCE' | 'NOT_FOUND' | 'NO_DATA' | 'QUOTA_EXHAUSTED' | 'SKIPPED_QUOTA_EXHAUSTED' | 'AUTH_ERROR' | 'HTTP_ERROR' | 'INVALID_INPUT' | 'INVALID_EODHD_PRICE' | 'TIMEOUT' | 'NETWORK_ERROR';
  yahooDate?: string;
  yahooClose?: number;
  eodhdDate?: string;
  eodhdClose?: number;
  differencePct?: number;
  tolerancePct?: number;
  cached?: boolean;
  message?: string;
}

export interface EodhdCrossValidationResult {
  provider: 'eodhd';
  configured: boolean;
  primaryProvider: 'yahoo_finance';
  role: 'SECONDARY_CROSS_VALIDATION';
  nonBlocking: boolean;
  primaryDataAvailable: boolean;
  summaryState: SecondaryProviderSummaryState;
  requested: number;
  checked: number;
  matched: number;
  divergent: number;
  coveragePct: number;
  cacheHits: number;
  upstreamCalls: number;
  results: EodhdCrossCheckItem[];
  checkedAt: string;
}

export class EodhdCrossValidationService {
  static async getStatus(): Promise<EodhdStatus> {
    const response = await fetch('/api/eodhd/status');
    if (!response.ok) throw new Error(`EODHD status HTTP ${response.status}`);
    return response.json();
  }

  static async crossValidate(assets: Array<{ ticker: string; asOfDate: string | null; lastClose: number | null }>): Promise<EodhdCrossValidationResult> {
    const payload = assets
      .filter(a => a.ticker && a.asOfDate && Number.isFinite(a.lastClose) && (a.lastClose ?? 0) > 0)
      .map(a => ({ ticker: a.ticker, asOfDate: a.asOfDate, lastClose: a.lastClose }));

    const response = await fetch('/api/eodhd/cross-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: payload })
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { detail = (await response.json())?.error ?? detail; } catch { /* ignore */ }
      throw new Error(detail);
    }
    return response.json();
  }
}
