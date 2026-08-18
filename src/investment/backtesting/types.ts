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

export type DataFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'INTRADAY'
  | 'UNKNOWN';

export interface MetricsContext {
  frequency: DataFrequency;
  periodsPerYear?: number;
  riskFreeRateAnnualPct: number;
}

export type MetricsQuality =
  | 'FULL'
  | 'PARTIAL'
  | 'INSUFFICIENT_DATA';

export interface MetricsDiagnostics {
  quality: MetricsQuality;
  frequencyDetected: DataFrequency;
  periodsPerYearUsed?: number;
  calculatedMetrics: string[];
  unavailableMetrics: {
    metric: string;
    reason: string;
  }[];
}

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
  annualizedReturnPct: number | null;
  cagrPct: number | null;
  benchmarkTotalReturnPct: number;
  
  // CAPM / Benchmark Relative
  alphaPct: number | null; // Legacy alias for alphaAnnualizedPct
  alphaAnnualizedPct: number | null;
  beta: number | null;
  benchmarkCorrelation: number | null;
  rSquared: number | null;
  informationRatio: number | null;
  
  // Risk & Volatility
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number;
  maxDrawdownDurationBars: number;
  maxDrawdownDurationDays: number | null;
  maxDrawdownStart?: string;
  maxDrawdownTrough?: string;
  maxDrawdownRecovery?: string | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  
  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  lossRatePct: number;
  profitFactor: number | null; // Gross Profit / Gross Loss (null if no losing trades)
  avgTradeReturnPct: number;
  avgWinReturnPct: number;
  avgLossReturnPct: number;
  winLossRatio: number | null; // Avg Win / Avg Loss (null if no losing trades)
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancyEur: number;
  expectancyPct: number | null;
  
  // Cost breakdown
  totalCommissionEur: number;
  totalSlippageEur: number;
  totalTradingCostsEur: number;
  tradingCostsPctOfInitialCapital: number;
  totalCommissionsPaidEur: number; // Legacy alias for totalTradingCostsEur
  
  // Exposure
  marketExposurePct: number; // % of time in market

  // Quality Diagnostics
  diagnostics: MetricsDiagnostics;
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
  annualizedReturnPct: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdownPct: number;
  profitFactor: number | null;
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
  efficiencyRatio?: number | null; // OutOfSample Sharpe / InSample Sharpe
}

export type OptimizationMetric =
  | 'SHARPE'
  | 'SORTINO'
  | 'CALMAR'
  | 'TOTAL_RETURN'
  | 'MAX_DRAWDOWN_ADJUSTED';

export interface ParameterRange {
  name: string;
  values: number[];
}

export interface OptimizationEvaluation {
  score: number | null;
  valid: boolean;
  rejectionReason?: string;
}

export interface WalkForwardConfig {
  trainWindowBars: number;
  testWindowBars: number;
  stepBars: number;
  optimizationMetric: OptimizationMetric;
  minimumTrades?: number; // default: 3
  minimumTrainBars?: number;
  maxParameterCombinations?: number; // default: 500
  parameterGrid: ParameterRange[];
  isExpandingWindow?: boolean;
}

export interface ParameterStabilityReport {
  parameterStats: {
    parameter: string;
    selections: number[];
    mean: number | null;
    stdDev: number | null;
    min: number | null;
    max: number | null;
    uniqueValues: number;
    stabilityScore: number | null;
  }[];
  stabilityScore: number | null;
}

export interface WalkForwardWindowResult {
  windowIndex: number;
  status: 'SUCCESS' | 'NO_VALID_PARAMETERS';
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainBarsCount: number;
  testBarsCount: number;
  selectedParameters: Record<string, number> | null;
  testedCombinations: number;
  rejectedCombinations: number;
  minimumTradesFilterRejections: number;
  trainMetrics: BacktestMetrics | null;
  testMetrics: BacktestMetrics | null;
  trainResult: BacktestResult | null;
  testResult: BacktestResult | null;
  trainScore: number | null;
  testScore: number | null;
  efficiencyRatio: number | null;
  degradationPct: number | null;
  bestTrainScore: number | null;
  medianTrainScore: number | null;
  worstTrainScore: number | null;
  parameterSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
}

export interface WalkForwardOptimizationResult {
  strategyName: string;
  config: WalkForwardConfig;
  validationEvidence: 'SYNTHETIC_ONLY' | 'STATIC_REFERENCE_ONLY' | 'REAL_MARKET_DATA';
  estimatedBacktests: number;
  executedBacktests: number;
  windows: WalkForwardWindowResult[];
  combinedOutOfSampleEquity: EquityPoint[];
  combinedOutOfSampleMetrics: BacktestMetrics;
  combinedOutOfSampleTrades: BacktestTrade[];
  averageEfficiencyRatio: number | null;
  robustnessScore: number | null; // 0-100
  robustnessComponents: {
    oosPerformance: number | null;
    degradation: number | null;
    parameterStability: number | null;
    consistency: number | null;
  };
  profitableWindowsPct: number;
  positiveScoreWindowsPct: number | null;
  isRobust: boolean;
  diagnosis: string;
  parameterStability: ParameterStabilityReport;
}

export interface HoldoutValidationResult {
  inSampleResult: BacktestResult;
  outOfSampleResult: BacktestResult;
  efficiencyRatio: number | null;
  isRobust: boolean;
  diagnosis: string;
}

export class BacktestAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacktestAccountingError';
  }
}

export class InvalidWalkForwardConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWalkForwardConfigurationError';
  }
}

export class ParameterGridTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParameterGridTooLargeError';
  }
}
