import { PriceBar } from '../backtesting/types';
import { Asset } from '../../types';

export interface AssetQuantScore {
  assetId: string;
  ticker: string;
  name: string;
  compositeScore: number; // 0 to 100
  rating: 'EXCELENTE' | 'BUENO' | 'NEUTRAL' | 'RIESGOSO';
  factors: {
    momentumScore: number; // 0 - 100
    volatilityRiskScore: number; // 0 - 100 (100 = safe/low vol)
    costEfficiencyScore: number; // 0 - 100 (100 = ultra low TER)
    trendConsistencyScore: number; // 0 - 100
  };
  recommendedWeightPct: number;
  reasoning: string;
}

export class AssetScorer {
  /**
   * Evaluates an asset based on multi-factor quantitative scores (inspired by FinRL factor ranking)
   */
  public static scoreAsset(asset: Asset, bars?: PriceBar[]): AssetQuantScore {
    // 1. Cost Efficiency (TER): Lower is better (0.05% TER = 100 pts, 2.0% TER = 0 pts)
    const ter = asset.ter || 0.20;
    const costEfficiencyScore = Math.max(0, Math.min(100, Math.round(100 - (ter / 1.5) * 100)));

    // 2. Volatility Risk Score (Low volatility = higher score for defensive capital)
    const vol = asset.volatilityAnnual || 15;
    const volatilityRiskScore = Math.max(0, Math.min(100, Math.round(100 - (vol / 60) * 100)));

    // 3. Momentum Score (24h + 1y return)
    const ret1y = asset.change1y || 0;
    const ret24h = asset.change24h || 0;
    const momentumScore = Math.max(0, Math.min(100, Math.round(50 + (ret1y * 0.8) + (ret24h * 5))));

    // 4. Trend Consistency Score
    let trendConsistencyScore = 60;
    if (bars && bars.length > 5) {
      const first = bars[0].close;
      const last = bars[bars.length - 1].close;
      const trendPct = ((last - first) / first) * 100;
      trendConsistencyScore = Math.max(10, Math.min(95, Math.round(50 + trendPct)));
    } else {
      trendConsistencyScore = ret1y > 0 ? 75 : 40;
    }

    // Composite Weighted Score
    const compositeScore = Math.round(
      (momentumScore * 0.35) +
      (volatilityRiskScore * 0.25) +
      (costEfficiencyScore * 0.20) +
      (trendConsistencyScore * 0.20)
    );

    let rating: AssetQuantScore['rating'] = 'NEUTRAL';
    if (compositeScore >= 75) rating = 'EXCELENTE';
    else if (compositeScore >= 60) rating = 'BUENO';
    else if (compositeScore < 40) rating = 'RIESGOSO';

    // Recommended Position Sizing based on risk level and score
    let recommendedWeightPct = 15;
    if (compositeScore >= 80) recommendedWeightPct = 30;
    else if (compositeScore >= 65) recommendedWeightPct = 20;
    else if (compositeScore <= 40) recommendedWeightPct = 5;

    let reasoning = '';
    if (asset.isIndexFund) {
      reasoning = `Fondo indexado traspasable (TER: ${ter}%). Calificación óptima en eficiencia de costes e interés compuesto diferido.`;
    } else {
      reasoning = `Instrumento cotizado (Vol: ${vol}%). Adecuado para momentum táctico y seguimiento de tendencia con stops activos.`;
    }

    return {
      assetId: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      compositeScore,
      rating,
      factors: {
        momentumScore,
        volatilityRiskScore,
        costEfficiencyScore,
        trendConsistencyScore
      },
      recommendedWeightPct,
      reasoning
    };
  }
}
