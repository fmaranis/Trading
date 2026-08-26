import { PriceBar } from '../backtesting/types';

/**
 * Explicit data source categories:
 * - REAL: Data downloaded directly from a verifiable external market provider.
 * - STATIC_REFERENCE: Manually compiled reference points from marketData.ts without intraday interpolation.
 * - SYNTHETIC: Generated, simulated, Brownian motion or interpolated data points.
 */
export type DataSourceType = 'REAL' | 'STATIC_REFERENCE' | 'SYNTHETIC';

export interface DataProvenance {
  sourceType: DataSourceType;
  provider?: string;
  symbol?: string;
  fetchedAt?: string;
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  isReproducible: boolean;
  notes?: string;
  seed?: number;
  datasetFingerprint?: string;
}

export interface SyntheticGenerationConfig {
  seed: number;
  totalBars?: number;
  subBarsPerMonth?: number;
  noiseFactor?: number;
}

export interface HistoricalDataRequest {
  assetId?: string;
  ticker?: string;
  symbol?: string;
  mode?: DataSourceType;
  startDate?: string;
  endDate?: string;
  timeframe?: string;
  adjusted?: boolean;
  providerId?: string;
  forceRefresh?: boolean;
  syntheticConfig?: Partial<SyntheticGenerationConfig>;
}

export interface HistoricalDataResponse {
  bars: PriceBar[];
  provenance: DataProvenance;
  metadata?: Record<string, any>;
}
