import { DataProvenance } from '../data/types';

export interface PriceBar {
  timestamp: string; // ISO or YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
  timestamp: string;
  type: SignalType;
  price: number;
  reason: string;
  strength?: number; // 0 to 1
  metadata?: Record<string, any>;
}

export interface BacktestConfig {
  initialCapital: number;
  commissionPct: number; // e.g. 0.1 for 0.1%
  slippagePct: number; // e.g. 0.05 for 0.05%
  riskFreeRateAnnualPct: number; // e.g. 3.0 for 3%
  positionSizingPct: number; // e.g. 100 for all-in or 30 for 30% per trade
  stopLossPct?: number; // Optional stop loss %
  takeProfitPct?: number; // Optional take profit %
  trailingStopPct?: number; // Optional trailing stop %
}

export interface BacktestTrade {
  id: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  amountInvested: number;
  pnlEur: number;
  pnlPct: number;
  returnFactor: number;
  commissionPaid: number;
  slippagePaid: number;
  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'END_OF_DATA';
  holdingPeriodBars: number;
  isWin: boolean;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  cash: number;
  drawdownPct: number;
  benchmarkEquity?: number;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  cagrPct: number;
  benchmarkTotalReturnPct: number;
  alphaPct: number;
  beta: number;
  
  // Risk & Volatility
  annualizedVolatilityPct: number;
  maxDrawdownPct: number;
  maxDrawdownDurationBars: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  lossRatePct: number;
  profitFactor: number; // Gross Profit / Gross Loss
  avgTradeReturnPct: number;
  avgWinReturnPct: number;
  avgLossReturnPct: number;
  winLossRatio: number; // Avg Win / Avg Loss
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancyEur: number;
  totalCommissionsPaidEur: number;
  
  // Exposure
  marketExposurePct: number; // % of time in market
}

export interface BacktestResult {
  strategyName: string;
  strategyDescription: string;
  assetTicker: string;
  assetName: string;
  config: BacktestConfig;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  signals: Signal[];
  dataProvenance: DataProvenance;
}

export interface StrategyComparisonItem {
  strategyId: string;
  strategyName: string;
  totalReturnPct: number;
  annualizedReturnPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPct: number;
  profitFactor: number;
  winRatePct: number;
  totalTrades: number;
  equityCurve: { timestamp: string; equity: number }[];
}

export interface WalkForwardSplit {
  splitIndex: number;
  inSampleBars: PriceBar[];
  outOfSampleBars: PriceBar[];
  inSampleResult?: BacktestResult;
  outOfSampleResult?: BacktestResult;
  efficiencyRatio?: number; // OutOfSample Sharpe / InSample Sharpe
}
