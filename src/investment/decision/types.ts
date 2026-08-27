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
