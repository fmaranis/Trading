export type PortfolioAllocationMethod = 'CUSTOM' | 'EQUAL_WEIGHT' | 'INVERSE_VOLATILITY' | 'RISK_PARITY_ERC' | 'RELATIVE_MOMENTUM';

export interface MatrixResult {
  assetIds: string[];
  values: number[][];
}

export interface AssetRiskStatistic {
  assetId: string;
  ticker: string;
  observations: number;
  meanDailyReturn: number | null;
  annualizedVolatilityPct: number | null;
  momentumReturnPct: number | null;
}

export interface RealPortfolioAnalyticsResult {
  observations: number;
  returnType: 'LOG';
  annualizationFactor: number;
  covarianceMatrix: MatrixResult;
  correlationMatrix: MatrixResult;
  assetStatistics: AssetRiskStatistic[];
  averagePairwiseCorrelation: number | null;
  minPairwiseCorrelation: number | null;
  maxPairwiseCorrelation: number | null;
}

export interface AllocationRequest {
  method: Exclude<PortfolioAllocationMethod, 'CUSTOM'>;
  lookbackBars?: number;
  topK?: number;
  minimumMomentumPct?: number;
}

export interface AllocationResult {
  method: Exclude<PortfolioAllocationMethod, 'CUSTOM'>;
  weights: Record<string, number>;
  cashWeight: number;
  diagnostics: {
    iterations?: number;
    converged?: boolean;
    maxRiskContributionError?: number | null;
    selectedAssets?: string[];
    rejectedAssets?: string[];
    notes: string[];
  };
}
