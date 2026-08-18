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

export type ExecutionMode = 'NEXT_OPEN' | 'SAME_CLOSE';

export type IntrabarConflictPolicy =
  | 'CONSERVATIVE'
  | 'STOP_FIRST'
  | 'TAKE_PROFIT_FIRST';

export interface PendingOrder {
  type: 'BUY' | 'SELL';
  signalTimestamp: string;
  signalPrice: number;
  signalReason: string;
  generatedAtBarIndex: number;
  triggerReason:
    | 'SIGNAL'
    | 'STOP_LOSS'
    | 'TAKE_PROFIT'
    | 'TRAILING_STOP';
}

export interface BacktestConfig {
  initialCapital: number;
  commissionPct: number; // e.g. 0.05 for 0.05%
  slippagePct: number; // e.g. 0.02 for 0.02%
  riskFreeRateAnnualPct: number; // e.g. 3.0 for 3%
  positionSizingPct: number; // e.g. 100 for all-in or 30 for 30% per trade
  stopLossPct?: number; // Optional stop loss %
  takeProfitPct?: number; // Optional take profit %
  trailingStopPct?: number; // Optional trailing stop %
  executionMode: ExecutionMode;
  intrabarConflictPolicy: IntrabarConflictPolicy;
}

export interface BacktestTrade {
  id: string;
  signalDate?: string;
  entryDate: string;
  signalPrice?: number;
  entryPrice: number; // Effective fill price after slippage
  marketEntryPrice?: number; // Pre-slippage price
  exitSignalDate?: string;
  exitDate: string;
  exitSignalPrice?: number;
  exitPrice: number; // Effective fill price after slippage
  marketExitPrice?: number; // Pre-slippage price
  shares: number;
  amountInvested: number;
  
  // Cost breakdown
  entryCommission: number;
  exitCommission: number;
  entrySlippageEur: number;
  exitSlippageEur: number;
  totalCommission: number;
  totalSlippage: number;
  totalTradingCosts: number;

  // PnL breakdown
  grossPnlEur: number;
  netPnlEur: number;
  grossReturnPct: number;
  netReturnPct: number;

  // Legacy aliases (mapped directly to net / total)
  pnlEur: number; // = netPnlEur
  pnlPct: number; // = netReturnPct
  commissionPaid: number; // = totalCommission
  slippagePaid: number; // = totalSlippage
  returnFactor: number;

  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'END_OF_DATA';
  holdingPeriodBars: number;
  isWin: boolean;
  intrabarConflict: boolean;
  intrabarConflictPolicyUsed?: IntrabarConflictPolicy;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  cash: number;
  positionMarketValue: number;
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
  executionMode: ExecutionMode;
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  signals: Signal[];
  unfilledOrders: PendingOrder[];
  dataProvenance: DataProvenance;
  benchmarkIncludesCosts: false;
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

export class BacktestAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacktestAccountingError';
  }
}
