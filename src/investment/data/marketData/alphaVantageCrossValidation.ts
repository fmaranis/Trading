export interface AlphaVantageStatus {
  provider: 'alpha_vantage';
  configured: boolean;
  role: 'SECONDARY_CROSS_VALIDATION';
  primaryProvider: 'yahoo_finance';
  keyExposedToClient: boolean;
}

export interface AlphaVantageCrossCheckItem {
  ticker: string;
  alphaSymbol?: string;
  status: 'MATCH' | 'PRICE_DIVERGENCE' | 'NOT_FOUND' | 'NO_DATA' | 'RATE_LIMIT_OR_NOTICE' | 'HTTP_ERROR' | 'INVALID_INPUT' | 'INVALID_ALPHA_PRICE' | 'TIMEOUT' | 'NETWORK_ERROR';
  yahooDate?: string;
  yahooClose?: number;
  alphaDate?: string;
  alphaClose?: number;
  differencePct?: number;
  tolerancePct?: number;
  message?: string;
}

export interface AlphaVantageCrossValidationResult {
  provider: 'alpha_vantage';
  configured: boolean;
  primaryProvider: 'yahoo_finance';
  role: 'SECONDARY_CROSS_VALIDATION';
  requested: number;
  checked: number;
  matched: number;
  divergent: number;
  coveragePct: number;
  results: AlphaVantageCrossCheckItem[];
  checkedAt: string;
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
