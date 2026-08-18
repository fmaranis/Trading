export type AssetCategory = 'monetario' | 'renta_fija' | 'renta_variable' | 'materias_primas' | 'liquidez' | 'megatrend' | 'crypto_etp' | 'semiconductores';

export interface Asset {
  id: string;
  isin: string;
  name: string;
  ticker: string;
  category: AssetCategory;
  categoryLabel: string;
  description: string;
  currentPrice: number;
  change24h: number;
  change1y: number;
  ter: number; // Total Expense Ratio in %
  riskLevel: number; // 1 to 7 (CNMV standard)
  volatilityAnnual: number; // in %
  historicalPrices: { date: string; price: number }[];
  currency: string;
  minInvestment: number;
  isIndexFund: boolean; // Traspasable en España
  taxAdvantageNote: string;
  isHighGrowth?: boolean;
}

export interface Position {
  assetId: string;
  shares: number;
  averageBuyPrice: number;
  currentPrice: number;
  investedAmount: number;
  currentValuation: number;
  pnlAmount: number;
  pnlPercentage: number;
  weightPercentage: number;
  highestPriceSeen?: number; // Para trailing stop
}

export interface Portfolio {
  initialCapital: number;
  cashBalance: number;
  positions: Position[];
  totalValuation: number;
  totalPnlAmount: number;
  totalPnlPercentage: number;
  maxDrawdown: number;
  portfolioRiskScore: number; // 1 - 7
  weightedTer: number;
  cashReservePercentage: number;
  vaultWithdrawnAmount: number; // Beneficios / Capital asegurado en bóveda (House Money)
  history: { date: string; totalValue: number; cash: number; invested: number }[];
}

export type OrderType = 'BUY' | 'SELL';
export type OrderStatus = 'SUBMITTING' | 'ROUTING' | 'MATCHING' | 'EXECUTED' | 'REJECTED';

export interface SimulatedOrder {
  id: string;
  timestamp: string;
  assetId: string;
  assetName: string;
  orderType: OrderType;
  amountEur: number;
  shares: number;
  quotedPrice: number; // Precio al momento de emitir la orden
  executionPrice: number; // Precio final tras slippage y lag
  slippagePct?: number; // Desviación de precio por latencia / liquidez
  latencyMs?: number; // Tiempo total desde emisión hasta ejecución real
  status: OrderStatus;
  riskValidationPassed: boolean;
  validationErrors: string[];
  userConfirmed: boolean;
  notes?: string;
  triggerReason?: 'MOMENTUM_ENTRY' | 'TRAILING_STOP' | 'TAKE_PROFIT_2X' | 'MANUAL' | 'CAPITAL_EXTRACTION';
  pnlRealized?: number;
  submittedAtMs?: number;
  executedAtMs?: number;
}

export interface RiskRule {
  id: string;
  title: string;
  description: string;
  limitValue: number;
  currentValue: number;
  unit: string;
  status: 'safe' | 'warning' | 'breached';
  category: 'exposure' | 'cash_reserve' | 'diversification' | 'drawdown';
}

export interface AlertRule {
  id: string;
  assetId?: string;
  assetName?: string;
  type: 'PRICE_DROP' | 'PRICE_RISE' | 'MAX_DRAWDOWN' | 'REBALANCE_NEEDED' | 'DCA_REMINDER' | 'VOLATILITY_SPIKE';
  threshold: number;
  comparison: 'ABOVE' | 'BELOW';
  message: string;
  active: boolean;
  createdAt: string;
  triggeredAt?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface EducationalPill {
  id: string;
  title: string;
  tag: 'Fiscalidad' | 'Gestión de Riesgo' | 'Costes (TER)' | 'Psicología' | 'Diversificación';
  readTime: string;
  summary: string;
  content: string;
  keyTakeaway: string;
  riskNote: string;
}

export type ActiveTab = 'dashboard' | 'growth_bot' | 'backtest_lab' | 'market' | 'trade' | 'risk_center' | 'education' | 'alerts' | 'architecture_docs';

export type BotStrategyType = 'MOMENTUM_BREAKOUT' | 'VOLATILITY_SCALPER' | 'TREND_FOLLOWING';
export type BotExecutionMode = 'AUTOMATIC' | 'MYINVESTOR_ASSISTED';

export interface MyInvestorTicket {
  id: string;
  orderId: string;
  timestamp: string;
  assetId: string;
  assetName: string;
  isin: string;
  ticker: string;
  operationType: 'SUSCRIPCION' | 'REEMBOLSO' | 'TRASPASO';
  amountEur: number;
  estimatedShares: number;
  quotedPrice: number;
  triggerReason: 'MOMENTUM_ENTRY' | 'TRAILING_STOP' | 'TAKE_PROFIT_2X' | 'MANUAL' | 'CAPITAL_EXTRACTION';
  botNote: string;
  otpCode: string;
  status: 'PENDING_SIGNATURE' | 'SIGNED' | 'REJECTED' | 'EXECUTED';
  ter: number;
  isIndexFund: boolean;
}

export interface BotBacktestValidation {
  assetId: string;
  assetTicker: string;
  assetName: string;
  evaluatedAt: string;
  strategyId: string;
  strategyName: string;
  sharpeRatio: number;
  sortinoRatio: number;
  winRatePct: number;
  maxDrawdownPct: number;
  expectedReturnPct: number;
  passed: boolean;
  rejectReason?: string;
  testedStrategiesCount: number;
}

export interface BotState {
  isRunning: boolean;
  executionMode: BotExecutionMode; // AUTOMATIC vs MYINVESTOR_ASSISTED
  strategy: BotStrategyType;
  trailingStopPct: number; // e.g. 3%
  takeProfitTargetPct: number; // e.g. 100% (Duplicar)
  initialCapitalRecovered: boolean;
  totalTradesExecuted: number;
  winningTrades: number;
  losingTrades: number;
  totalProfitRealized: number;
  lastActionNote: string;
  averageLatencyMs: number;
  networkStatus: 'ONLINE_CONNECTED' | 'SYNCHRONIZING' | 'PAUSED';
  lastBacktestValidation?: BotBacktestValidation;
}
