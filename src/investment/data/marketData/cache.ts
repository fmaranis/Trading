import { HistoricalMarketDataRequest, HistoricalMarketDataResponse, MarketDataCache } from './types';

interface CacheEntry {
  response: HistoricalMarketDataResponse;
  expiresAt: number; // Unix timestamp in milliseconds
  storedAt: number;
}

export class MemoryMarketDataCache implements MarketDataCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Generates a deterministic, unique cache key based on request parameters and providerId.
   * Format: provider:symbol:startDate:endDate:timeframe:adjusted
   */
  public generateKey(request: HistoricalMarketDataRequest, providerId: string): string {
    const symbol = (request.symbol || '').trim().toUpperCase();
    const start = (request.startDate || '').trim();
    const end = (request.endDate || '').trim();
    const tf = (request.timeframe || '1d').trim();
    const adj = request.adjusted !== false ? 'true' : 'false';

    return `${providerId.toLowerCase()}:${symbol}:${start}:${end}:${tf}:${adj}`;
  }

  public async get(key: string): Promise<HistoricalMarketDataResponse | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Return a deep copy marked as cached: true
    return {
      bars: entry.response.bars.map(b => ({ ...b })),
      provenance: { ...entry.response.provenance },
      metadata: {
        ...entry.response.metadata,
        cached: true
      }
    };
  }

  public async set(key: string, value: HistoricalMarketDataResponse, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }

    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    // Store a cloned copy
    this.cache.set(key, {
      response: {
        bars: value.bars.map(b => ({ ...b })),
        provenance: { ...value.provenance },
        metadata: {
          ...value.metadata,
          cached: false
        }
      },
      expiresAt,
      storedAt: now
    });
  }

  public async clear(): Promise<void> {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
