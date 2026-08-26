import { PriceBar, BacktestMetrics } from '../backtesting/types';
import { DataProvenance } from '../data/types';

export type CalendarAlignmentPolicy = 'INTERSECTION' | 'UNION_NO_FILL';
export type RebalanceFrequency = 'NONE' | 'MONTHLY' | 'QUARTERLY';
export type PortfolioEvidence = 'REAL_ONLY' | 'STATIC_ONLY' | 'SYNTHETIC_ONLY' | 'MIXED';
export type DynamicAllocationMethod = 'INVERSE_VOLATILITY' | 'RISK_PARITY_ERC' | 'RELATIVE_MOMENTUM';

export interface MultiAssetDatasetItem {
  assetId: string;
  ticker: string;
  name: string;
  currency?: string;
  bars: PriceBar[];
  provenance: DataProvenance;
}

export interface MultiAssetDataset {
  assets: MultiAssetDatasetItem[];
  timeframe: string;
}

export interface AlignedAssetBar {
  assetId: string;
  ticker: string;
  bar: PriceBar;
}

export interface AlignedPortfolioBar {
  tradingDate: string;
  assets: Record<string, PriceBar>;
}

export interface AlignedMultiAssetDataset {
  assetIds: string[];
  tickers: Record<string, string>;
  rows: AlignedPortfolioBar[];
  policy: CalendarAlignmentPolicy;
}

export interface DynamicAllocationPolicy {
  method: DynamicAllocationMethod;
  lookbackBars?: number;
  topK?: number;
  minimumMomentumPct?: number;
  minimumHistoryBars?: number;
}

export interface PortfolioBacktestConfig {
  initialCapital: number;
  commissionPct: number;
  slippagePct: number;
  rebalanceFrequency: RebalanceFrequency;
  executionMode: 'NEXT_OPEN';
  targetWeights: Record<string, number>;
  dynamicAllocation?: DynamicAllocationPolicy;
  minimumCashPct?: number;
  rebalanceTolerancePct?: number;
  alignmentPolicy?: CalendarAlignmentPolicy;
}

export interface PortfolioPositionState {
  assetId: string;
  ticker: string;
  shares: number;
  marketPrice: number;
  marketValue: number;
  portfolioWeight: number;
}

export interface PortfolioEquityPoint {
  timestamp: string;
  cash: number;
  positionsValue: number;
  equity: number;
  positions: PortfolioPositionState[];
  benchmarkEquity?: number;
}

export interface PortfolioTrade {
  id: string;
  timestamp: string;
  assetId: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  shares: number;
  marketPrice: number;
  fillPrice: number;
  notionalEur: number;
  commissionEur: number;
  slippageEur: number;
  reason: 'INITIAL_ALLOCATION' | 'MONTHLY_REBALANCE' | 'QUARTERLY_REBALANCE';
}

export interface RebalanceOrder extends PortfolioTrade {}

export interface PortfolioAssetSummary {
  assetId: string;
  ticker: string;
  targetWeight: number;
  finalWeight: number;
  finalValue: number;
  contributionToReturnPct: number;
  totalCommissionEur: number;
  totalSlippageEur: number;
}

export interface PortfolioDataProvenance {
  sourceType: 'REAL' | 'STATIC_REFERENCE' | 'SYNTHETIC' | 'MIXED';
  portfolioEvidence: PortfolioEvidence;
  assetProvenance: Record<string, DataProvenance>;
  assetDatasetFingerprints: Record<string, string>;
  portfolioDatasetFingerprint: string;
}

export interface PortfolioMetrics {
  financial: BacktestMetrics;
  averageCashPct: number;
  averageNumberOfPositions: number;
  maxSingleAssetWeightPct: number;
  annualizedTurnoverPct: number | null;
  totalCommissionEur: number;
  totalSlippageEur: number;
  totalTradingCostsEur: number;
}

export interface AllocationHistoryPoint {
  executionDate: string;
  informationEndDate: string;
  method: 'STATIC' | DynamicAllocationMethod;
  weights: Record<string, number>;
  cashWeight: number;
  historyBarsUsed: number;
}

export interface PortfolioBacktestResult {
  config: PortfolioBacktestConfig;
  provenance: PortfolioDataProvenance;
  alignedBarsCount: number;
  equityCurve: PortfolioEquityPoint[];
  benchmarkEquityCurve: { timestamp: string; equity: number }[];
  trades: PortfolioTrade[];
  metrics: PortfolioMetrics;
  assetSummaries: PortfolioAssetSummary[];
  allocationHistory: AllocationHistoryPoint[];
}

export class MultiAssetDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiAssetDataError';
  }
}

export class MultiAssetAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiAssetAccountingError';
  }
}

export class UnsupportedMultiCurrencyPortfolioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMultiCurrencyPortfolioError';
  }
}
