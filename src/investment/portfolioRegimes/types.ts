export type MarketRegime = 'BULL_LOW_VOL' | 'BULL_HIGH_VOL' | 'BEAR_LOW_VOL' | 'BEAR_HIGH_VOL' | 'SIDEWAYS_LOW_VOL' | 'SIDEWAYS_HIGH_VOL' | 'UNKNOWN';

export interface RegimeClassifierConfig {
  trendLookbackBars?: number;
  volatilityLookbackBars?: number;
  volatilityBaselineBars?: number;
  bullTrendThresholdPct?: number;
  bearTrendThresholdPct?: number;
  highVolatilityMultiplier?: number;
}

export interface RegimeObservation {
  tradingDate: string;
  regime: MarketRegime;
  trendReturnPct: number | null;
  realizedVolatilityPct: number | null;
  baselineVolatilityPct: number | null;
  highVolatility: boolean | null;
  informationEndDate: string;
}

export interface RegimeSeriesResult {
  methodology: 'EQUAL_WEIGHT_MARKET_PROXY';
  config: Required<RegimeClassifierConfig>;
  observations: RegimeObservation[];
  classifiedObservations: number;
  unknownObservations: number;
}

export interface RegimePerformanceRow {
  regime: Exclude<MarketRegime, 'UNKNOWN'>;
  observations: number;
  totalReturnPct: number | null;
  meanDailyReturnPct: number | null;
  annualizedVolatilityPct: number | null;
  sharpeZeroRf: number | null;
  positiveDaysPct: number | null;
}

export interface PortfolioRegimePerformance {
  portfolioDatasetFingerprint: string;
  attributionRule: 'REGIME_AT_CLOSE_T_APPLIED_TO_RETURN_T_TO_T_PLUS_1';
  rows: RegimePerformanceRow[];
  classifiedReturnObservations: number;
}
