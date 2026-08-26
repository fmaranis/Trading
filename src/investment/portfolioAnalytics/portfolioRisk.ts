import { RealPortfolioAnalyticsResult } from './types';

export interface AssetRiskContribution {
  assetId: string;
  weight: number;
  marginalRisk: number | null;
  riskContributionPct: number | null;
}

export interface PortfolioRiskAnalysis {
  portfolioAnnualizedVolatilityPct: number | null;
  weightedAverageAssetVolatilityPct: number | null;
  diversificationRatio: number | null;
  effectiveNumberOfAssets: number | null;
  contributions: AssetRiskContribution[];
}

export class PortfolioRiskAnalyzer {
  static analyze(analytics: RealPortfolioAnalyticsResult, weightsByAsset: Record<string, number>): PortfolioRiskAnalysis {
    const ids = analytics.covarianceMatrix.assetIds;
    const w = ids.map(id => Math.max(0, weightsByAsset[id] ?? 0));
    const invested = w.reduce((a, b) => a + b, 0);
    if (invested <= 0) {
      return {
        portfolioAnnualizedVolatilityPct: 0,
        weightedAverageAssetVolatilityPct: 0,
        diversificationRatio: null,
        effectiveNumberOfAssets: null,
        contributions: ids.map(id => ({ assetId: id, weight: 0, marginalRisk: null, riskContributionPct: null }))
      };
    }

    const covariance = analytics.covarianceMatrix.values;
    const marginalVariance = w.map((_, i) => covariance[i].reduce((sum, c, j) => sum + c * w[j], 0));
    let varianceDaily = 0;
    for (let i = 0; i < w.length; i++) varianceDaily += w[i] * marginalVariance[i];
    const sigmaDaily = varianceDaily > 0 ? Math.sqrt(varianceDaily) : 0;
    const sigmaAnnualPct = sigmaDaily * Math.sqrt(analytics.annualizationFactor) * 100;

    const weightedAverageVolPct = analytics.assetStatistics.reduce((sum, stat) => {
      const i = ids.indexOf(stat.assetId);
      return sum + (i >= 0 ? w[i] * (stat.annualizedVolatilityPct ?? 0) : 0);
    }, 0);

    const contributions = ids.map((id, i) => {
      const componentVariance = w[i] * marginalVariance[i];
      return {
        assetId: id,
        weight: w[i],
        marginalRisk: sigmaDaily > 0 ? marginalVariance[i] / sigmaDaily : null,
        riskContributionPct: varianceDaily > 0 ? componentVariance / varianceDaily * 100 : null
      };
    });

    const normalized = w.map(x => x / invested);
    const hhi = normalized.reduce((sum, x) => sum + x * x, 0);

    return {
      portfolioAnnualizedVolatilityPct: sigmaAnnualPct,
      weightedAverageAssetVolatilityPct: weightedAverageVolPct,
      diversificationRatio: sigmaAnnualPct > 0 ? weightedAverageVolPct / sigmaAnnualPct : null,
      effectiveNumberOfAssets: hhi > 0 ? 1 / hhi : null,
      contributions
    };
  }
}
