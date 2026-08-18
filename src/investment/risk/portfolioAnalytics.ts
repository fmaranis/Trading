import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { Asset, Portfolio } from '../../types';

export interface CorrelationPair {
  assetA: string;
  tickerA: string;
  assetB: string;
  tickerB: string;
  correlation: number; // -1.0 to 1.0
  relationship: 'ALTA_CORRELACION' | 'MODERADA' | 'DESCORRELACIONADA' | 'INVERSA';
}

export interface RebalanceSuggestion {
  assetId: string;
  ticker: string;
  name: string;
  currentWeightPct: number;
  targetWeightPct: number;
  diffWeightPct: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  amountEur: number;
  urgency: 'ALTA' | 'MEDIA' | 'BAJA';
  reason: string;
}

export interface PortfolioStressTest {
  scenarioName: string;
  description: string;
  marketShockPct: number;
  estimatedPortfolioImpactPct: number;
  estimatedLossEur: number;
  resilienceScore: 'ALTA' | 'MEDIA' | 'CRITICA';
  protectiveBufferEur: number;
}

export class PortfolioAnalyticsEngine {
  /**
   * Generates a correlation matrix across all assets in portfolio or market
   */
  public static calculateCorrelationMatrix(assets: Asset[] = ALL_AVAILABLE_ASSETS): CorrelationPair[] {
    const pairs: CorrelationPair[] = [];

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const a = assets[i];
        const b = assets[j];

        let corr = 0.5;

        // Domain-specific correlation heuristics based on asset class
        if (a.category === b.category) {
          if (a.category === 'renta_variable' || a.category === 'megatrend') corr = 0.82;
          else if (a.category === 'crypto_etp') corr = 0.78;
          else if (a.category === 'monetario' || a.category === 'renta_fija') corr = 0.65;
          else corr = 0.75;
        } else if (
          ((a.category === 'monetario' || a.category === 'renta_fija' || a.category === 'materias_primas') && b.category === 'crypto_etp') ||
          ((b.category === 'monetario' || b.category === 'renta_fija' || b.category === 'materias_primas') && a.category === 'crypto_etp')
        ) {
          corr = -0.15; // Low / negative correlation with defensive
        } else if (
          ((a.category === 'monetario' || a.category === 'renta_fija' || a.category === 'materias_primas') && (b.category === 'renta_variable' || b.category === 'megatrend')) ||
          ((b.category === 'monetario' || b.category === 'renta_fija' || b.category === 'materias_primas') && (a.category === 'renta_variable' || a.category === 'megatrend'))
        ) {
          corr = 0.12; // Very low correlation between Gold/Bonds/Monetario and Global equities
        } else if (
          (a.category === 'semiconductores' && b.category === 'renta_variable') ||
          (b.category === 'semiconductores' && a.category === 'renta_variable')
        ) {
          corr = 0.75;
        }

        let relationship: CorrelationPair['relationship'] = 'MODERADA';
        if (corr >= 0.7) relationship = 'ALTA_CORRELACION';
        else if (corr <= -0.1) relationship = 'INVERSA';
        else if (corr < 0.3) relationship = 'DESCORRELACIONADA';

        pairs.push({
          assetA: a.id,
          tickerA: a.ticker,
          assetB: b.id,
          tickerB: b.ticker,
          correlation: Number(corr.toFixed(2)),
          relationship
        });
      }
    }

    return pairs;
  }

  /**
   * Generates Smart Rebalancing suggestions based on target weights
   */
  public static generateRebalancePlan(portfolio: Portfolio): RebalanceSuggestion[] {
    const totalValuation = portfolio.totalValuation;
    if (totalValuation <= 0 || !portfolio.positions) return [];

    return portfolio.positions.map(h => {
      const asset = ALL_AVAILABLE_ASSETS.find(a => a.id === h.assetId);
      const currentVal = h.currentValuation || (h.shares * h.currentPrice);
      const currentWeight = (currentVal / totalValuation) * 100;
      const targetWeight = h.weightPercentage || 10;
      const diff = targetWeight - currentWeight;
      const diffAmount = (Math.abs(diff) / 100) * totalValuation;

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let urgency: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';

      if (Math.abs(diff) >= 5.0) {
        action = diff > 0 ? 'BUY' : 'SELL';
        urgency = 'ALTA';
      } else if (Math.abs(diff) >= 2.0) {
        action = diff > 0 ? 'BUY' : 'SELL';
        urgency = 'MEDIA';
      }

      return {
        assetId: h.assetId,
        ticker: asset?.ticker || h.assetId,
        name: asset?.name || h.assetId,
        currentWeightPct: Number(currentWeight.toFixed(1)),
        targetWeightPct: Number(targetWeight.toFixed(1)),
        diffWeightPct: Number(diff.toFixed(1)),
        action,
        amountEur: Number(diffAmount.toFixed(2)),
        urgency,
        reason: action === 'HOLD'
          ? 'Posición dentro del umbral de tolerancia (<2%).'
          : action === 'BUY'
          ? `Infraponderada en un ${Math.abs(diff).toFixed(1)}%. Comprar para rebalancear.`
          : `Sobreponderada en un ${Math.abs(diff).toFixed(1)}%. Realizar beneficios para recortar riesgo.`
      };
    });
  }

  /**
   * Runs Macro Stress Test Scenarios on Portfolio
   */
  public static runStressTests(portfolio: Portfolio): PortfolioStressTest[] {
    const totalVal = portfolio.totalValuation;
    const cash = portfolio.cashBalance ?? 0;
    const cashRatio = totalVal > 0 ? cash / totalVal : 1;

    return [
      {
        scenarioName: 'Crash Tecnológico Global (-25%)',
        description: 'Caída sincronizada en mega-caps tecnológicas y activos de alto crecimiento.',
        marketShockPct: -25.0,
        estimatedPortfolioImpactPct: Number((-25.0 * (1 - cashRatio * 0.8) * 0.85).toFixed(1)),
        estimatedLossEur: Number((totalVal * 0.25 * (1 - cashRatio * 0.8) * 0.85).toFixed(2)),
        resilienceScore: cashRatio > 0.3 ? 'ALTA' : 'MEDIA',
        protectiveBufferEur: Number(cash.toFixed(2))
      },
      {
        scenarioName: 'Shock de Tipos & Inflación (-15%)',
        description: 'Aumento inesperado de tipos de interés de los bancos centrales con caída de múltiplos.',
        marketShockPct: -15.0,
        estimatedPortfolioImpactPct: Number((-15.0 * (1 - cashRatio * 0.9) * 0.7).toFixed(1)),
        estimatedLossEur: Number((totalVal * 0.15 * (1 - cashRatio * 0.9) * 0.7).toFixed(2)),
        resilienceScore: 'ALTA',
        protectiveBufferEur: Number(cash.toFixed(2))
      },
      {
        scenarioName: 'Cripto Invierno (-50%)',
        description: 'Capitulación en el mercado de activos digitales y volatilidad extrema.',
        marketShockPct: -50.0,
        estimatedPortfolioImpactPct: Number((-50.0 * 0.12).toFixed(1)), // Assuming ~12% crypto exposure
        estimatedLossEur: Number((totalVal * 0.06).toFixed(2)),
        resilienceScore: 'ALTA',
        protectiveBufferEur: Number(cash.toFixed(2))
      },
      {
        scenarioName: 'Recesión Prolongada Stagflation (-30%)',
        description: 'Contracción económica severa de 18 meses con márgenes corporativos a la baja.',
        marketShockPct: -30.0,
        estimatedPortfolioImpactPct: Number((-30.0 * (1 - cashRatio) * 0.9).toFixed(1)),
        estimatedLossEur: Number((totalVal * 0.30 * (1 - cashRatio) * 0.9).toFixed(2)),
        resilienceScore: cashRatio > 0.4 ? 'MEDIA' : 'CRITICA',
        protectiveBufferEur: Number(cash.toFixed(2))
      }
    ];
  }
}
