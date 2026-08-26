import { PriceBar } from '../../backtesting/types';
import { DataProvenance } from '../types';

export type MarketTimeframe = '1d' | '1wk' | '1mo';

export type AdjustmentMethod = 'NONE' | 'PROVIDER_ADJCLOSE_RATIO';

export type AdjustmentStatus =
  | 'UNADJUSTED'
  | 'ADJUSTED_DERIVED'
  | 'ADJUSTED_PROVIDER'
  | 'UNKNOWN';

export type DataLoadStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

export interface HistoricalMarketDataRequest {
  symbol: string;
  startDate: string;
  endDate: string;
  timeframe: MarketTimeframe;
  adjusted?: boolean;
}

export interface ProviderEndpointInfo {
  id: string;
  name: string;
  endpointType: string;
}

export interface MarketDataMetadata {
  providerId: string;
  providerName: string;
  provider?: ProviderEndpointInfo;
  symbol: string;
  requestedStartDate: string;
  requestedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  timeframe: MarketTimeframe;
  adjusted: boolean;
  adjustmentStatus: AdjustmentStatus;
  adjustmentMethod: AdjustmentMethod;
  datasetFingerprint: string;
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
  isSymbolFormatSupported?(symbol: string): boolean;
  supportsSymbol(symbol: string): Promise<boolean>;
  getCapabilities(): MarketDataProviderCapabilities;
}

export interface MarketDataCache {
  get(key: string): Promise<HistoricalMarketDataResponse | null>;
  set(key: string, value: HistoricalMarketDataResponse, ttlSeconds: number): Promise<void>;
  clear?(): Promise<void>;
  generateKey?(request: HistoricalMarketDataRequest, providerId: string): string;
}
