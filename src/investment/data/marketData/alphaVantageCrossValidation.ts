export type SecondaryProviderSummaryState =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'PARTIAL_QUOTA_EXHAUSTED'
  | 'QUOTA_EXHAUSTED'
  | 'UNAVAILABLE';

export interface SecondaryProviderHealth {
  provider: string;
  configured: boolean;
  nonBlocking: boolean;
  primaryProvider: string;
  primaryDataAvailable: boolean;
  summaryState: SecondaryProviderSummaryState;
  requested: number;
  checked: number;
  matched: number;
  divergent: number;
  coveragePct: number;
}

export interface AlphaVantageStatus {
  provider: 'alpha_vantage';
  configured: boolean;
  role: 'SECONDARY_CROSS_VALIDATION';
  primaryProvider: 'yahoo_finance';
  keyExposedToClient: boolean;
  nonBlocking: boolean;
  cacheTtlHours?: number;
  cachedEntries?: number;
}

export interface AlphaVantageCrossCheckItem {
  ticker: string;
  alphaSymbol?: string;
  status:
    | 'MATCH'
    | 'PRICE_DIVERGENCE'
    | 'NOT_FOUND'
    | 'NO_DATA'
    | 'QUOTA_EXHAUSTED'
    | 'SKIPPED_QUOTA_EXHAUSTED'
    | 'PROVIDER_NOTICE'
    | 'HTTP_ERROR'
    | 'INVALID_INPUT'
    | 'INVALID_ALPHA_PRICE'
    | 'TIMEOUT'
    | 'NETWORK_ERROR';
  yahooDate?: string;
  yahooClose?: number;
  alphaDate?: string;
  alphaClose?: number;
  differencePct?: number;
  tolerancePct?: number;
  message?: string;
  cached?: boolean;
}

export interface AlphaVantageCrossValidationResult extends SecondaryProviderHealth {
  provider: 'alpha_vantage';
  configured: true;
  primaryProvider: 'yahoo_finance';
  role: 'SECONDARY_CROSS_VALIDATION';
  primaryDataAvailable: true;
  failed: number;
  cacheHits: number;
  upstreamCalls: number;
  cacheTtlHours: number;
  results: AlphaVantageCrossCheckItem[];
  checkedAt: string;
}

export function secondaryProviderStatusLabel(state: SecondaryProviderSummaryState): string {
  switch (state) {
    case 'AVAILABLE': return 'Validación secundaria disponible';
    case 'PARTIAL': return 'Validación secundaria parcial';
    case 'PARTIAL_QUOTA_EXHAUSTED': return 'Validación parcial · cuota agotada';
    case 'QUOTA_EXHAUSTED': return 'Cuota diaria agotada';
    default: return 'Validación secundaria no disponible';
  }
}

export function secondaryProviderDoesNotBlock(state: SecondaryProviderSummaryState): boolean {
  return state !== 'AVAILABLE';
}

export class AlphaVantageCrossValidationService {
  static async getStatus(): Promise<AlphaVantageStatus> {
    const response = await fetch('/api/alpha-vantage/status');
    if (!response.ok) throw new Error(`Alpha Vantage status HTTP ${response.status}`);
    return response.json();
  }

  static async crossValidate(assets: Array<{ ticker: string; asOfDate: string | null; lastClose: number | null }>): Promise<AlphaVantageCrossValidationResult> {
    const payload = assets
      .filter(a => a.ticker && a.asOfDate && Number.isFinite(a.lastClose) && (a.lastClose ?? 0) > 0)
      .map(a => ({ ticker: a.ticker, asOfDate: a.asOfDate, lastClose: a.lastClose }));

    const response = await fetch('/api/alpha-vantage/cross-check', {
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
