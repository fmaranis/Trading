import { MarketRegime } from '../portfolioRegimes';

export type InvestorRiskProfile = 'LOW' | 'MEDIUM' | 'HIGH';
export type InvestmentHorizonYears = 1 | 3 | 5;
export type DecisionConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type AssetDecisionAction = 'PRIORITIZE' | 'SECONDARY' | 'NO_ALLOCATION';

export interface DecisionAssetInput {
  assetId: string;
  ticker: string;
  name: string;
  currency: string;
}

export interface InvestmentDecisionRequest {
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

export interface AssetDecisionScore {
  assetId: string;
  ticker: string;
  name: string;
  weight: number;
  amountEur: number;
  action: AssetDecisionAction;
  score: number;
  momentumPct: number | null;
  annualizedVolatilityPct: number | null;
  rationale: string[];
}

export interface InvestmentDecisionResult {
  generatedAt: string;
  asOfDate: string;
  dataAgeDays: number;
  currency: 'EUR';
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  marketRegime: MarketRegime;
  regimeTrendPct: number | null;
  regimeVolatilityPct: number | null;
  confidence: DecisionConfidence;
  confidenceScore: number;
  recommendedMethod: 'INVERSE_VOLATILITY' | 'RISK_PARITY_ERC' | 'RELATIVE_MOMENTUM';
  cashWeight: number;
  cashAmountEur: number;
  assets: AssetDecisionScore[];
  portfolioDatasetFingerprint: string;
  evidence: 'REAL_ONLY';
  warnings: string[];
  summary: string;
  methodology: string[];
}

export interface ExecutableAssetDecision extends AssetDecisionScore {
  lastPriceEur: number | null;
  estimatedShares: number | null;
  requiresFractionalShares: boolean;
  wholeShareAffordable: boolean;
}

export interface DecisionHistoryEntry {
  id: string;
  savedAt: string;
  asOfDate: string;
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  marketRegime: MarketRegime;
  confidence: DecisionConfidence;
  confidenceScore: number;
  cashWeight: number;
  portfolioDatasetFingerprint: string;
  recommendedMethod: InvestmentDecisionResult['recommendedMethod'];
  allocations: Array<{ assetId: string; ticker: string; weight: number; amountEur: number }>;
}

export type DecisionAlertType = 'REGIME_CHANGE' | 'METHOD_CHANGE' | 'WEIGHT_SHIFT' | 'CASH_SHIFT' | 'CONFIDENCE_DROP';

export interface DecisionAlert {
  id: string;
  createdAt: string;
  type: DecisionAlertType;
  severity: 'INFO' | 'WARNING' | 'MATERIAL';
  message: string;
}

export interface DecisionBacktestConfig {
  initialCapital: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  commissionPct: number;
  slippagePct: number;
  rebalanceFrequency: 'MONTHLY';
  warmupBars?: number;
}

export interface DecisionBacktestPoint {
  timestamp: string;
  equity: number;
  cash: number;
  regime: MarketRegime;
  method: InvestmentDecisionResult['recommendedMethod'] | 'WARMUP_CASH';
}

export interface DecisionBacktestResult {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  totalCommissionEur: number;
  totalSlippageEur: number;
  totalTradingCostsEur: number;
  rebalanceCount: number;
  equityCurve: DecisionBacktestPoint[];
  portfolioDatasetFingerprint: string;
  notes: string[];
}
