import { PriceBar } from '../../backtesting/types';
import { DataProvenance } from '../types';

export type MarketTimeframe = '1d' | '1wk' | '1mo';

export type AdjustmentStatus = 'ADJUSTED' | 'UNADJUSTED' | 'UNKNOWN';

export type DataLoadStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

export interface HistoricalMarketDataRequest {
  symbol: string;
  startDate: string; // ISO 8601 string (e.g., '2023-01-01' or '2023-01-01T00:00:00.000Z')
  endDate: string;
  timeframe: MarketTimeframe;
  adjusted?: boolean; // Default true for backtesting
}

export interface MarketDataMetadata {
  providerId: string;
  providerName: string;
  symbol: string;
  requestedStartDate: string;
  requestedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  timeframe: MarketTimeframe;
  adjusted: boolean;
  adjustmentStatus: AdjustmentStatus;
  currency?: string;
  exchange?: string;
  fetchedAt: string;
  cached: boolean;
}

export interface HistoricalMarketDataResponse {
  bars: PriceBar[];
  provenance: DataProvenance;
  metadata: MarketDataMetadata;
}

export interface MarketDataProviderCapabilities {
  supportedTimeframes: MarketTimeframe[];
  supportsAdjusted: boolean;
  requiresApiKey: boolean;
  maxRangeYears?: number;
  rateLimitRequestsPerMinute?: number;
}

export interface MarketDataFetchOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  providerId?: string;
  signal?: AbortSignal;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  getHistoricalBars(request: HistoricalMarketDataRequest, options?: MarketDataFetchOptions): Promise<HistoricalMarketDataResponse>;
  supportsSymbol(symbol: string): Promise<boolean>;
  getCapabilities(): MarketDataProviderCapabilities;
}

export interface MarketDataCache {
  get(key: string): Promise<HistoricalMarketDataResponse | null>;
  set(key: string, value: HistoricalMarketDataResponse, ttlSeconds: number): Promise<void>;
  clear?(): Promise<void>;
  generateKey?(request: HistoricalMarketDataRequest, providerId: string): string;
}
