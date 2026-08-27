import { AlignedMultiAssetDataset, isRebalanceDate, PortfolioStrategyComparisonResult, PortfolioStrategyId, RebalanceFrequency } from '../portfolioBacktesting';
import { DeterministicRegimeClassifier } from './deterministicRegimeClassifier';
import { MarketRegime, RegimeClassifierConfig } from './types';

export type RegimeSelectionMetric = 'TOTAL_RETURN' | 'SHARPE';

export interface CausalRegimePolicySelectorConfig {
  rebalanceFrequency: Exclude<RebalanceFrequency, 'NONE'>;
  learningLookbackBars?: number;
  minimumRegimeObservations?: number;
  metric?: RegimeSelectionMetric;
  fallbackPolicy?: PortfolioStrategyId;
  classifier?: RegimeClassifierConfig;
}

export interface CausalRegimePolicyDecision {
  decisionDate: string;
  executionDate: string;
  regimeAtDecision: MarketRegime;
  selectedPolicy: PortfolioStrategyId;
  fallbackUsed: boolean;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  regimeObservations: number;
  scores: Record<string, number | null>;
}

export interface CausalRegimePolicySelectorResult {
  portfolioDatasetFingerprint: string;
  metric: RegimeSelectionMetric;
  learningLookbackBars: number;
  minimumRegimeObservations: number;
  fallbackPolicy: PortfolioStrategyId;
  decisions: CausalRegimePolicyDecision[];
  note: string;
}

function scoreReturns(returns: number[], metric: RegimeSelectionMetric): number | null {
  if (!returns.length) return null;
  if (metric === 'TOTAL_RETURN') return (returns.reduce((acc, r) => acc * (1 + r), 1) - 1) * 100;
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, x) => s + (x - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  return sd > 0 ? (mean / sd) * Math.sqrt(252) : null;
}

export class CausalRegimePolicySelector {
  static select(
    aligned: AlignedMultiAssetDataset,
    comparison: PortfolioStrategyComparisonResult,
    config: CausalRegimePolicySelectorConfig
  ): CausalRegimePolicySelectorResult {
    const learningLookbackBars = Math.max(20, config.learningLookbackBars ?? 252);
    const minimumRegimeObservations = Math.max(3, config.minimumRegimeObservations ?? 10);
    const metric = config.metric ?? 'SHARPE';
    const fallbackPolicy = config.fallbackPolicy ?? 'EQUAL_WEIGHT_STATIC';
    const regimes = DeterministicRegimeClassifier.classify(aligned, config.classifier ?? {});
    const regimeByDate = new Map(regimes.observations.map(x => [x.tradingDate, x.regime]));
    const baseCurve = comparison.items[0]?.result.equityCurve ?? [];
    if (baseCurve.length < 3) throw new Error('No hay suficiente equity history para selector causal.');
    if (comparison.items.some(x => x.result.provenance.portfolioDatasetFingerprint !== comparison.portfolioDatasetFingerprint)) throw new Error('Fingerprint inconsistente en selector causal.');

    const decisions: CausalRegimePolicyDecision[] = [];
    for (let i = 1; i < baseCurve.length; i++) {
      if (!isRebalanceDate(baseCurve[i - 1].timestamp, baseCurve[i].timestamp, config.rebalanceFrequency)) continue;
      const decisionDate = baseCurve[i - 1].timestamp;
      const executionDate = baseCurve[i].timestamp;
      const currentRegime = regimeByDate.get(decisionDate) ?? 'UNKNOWN';
      const trainingStartIndex = Math.max(0, i - learningLookbackBars);
      const trainingEndReturnIndex = i - 2;
      const scores: Record<string, number | null> = {};
      let regimeObservations = 0;

      for (const item of comparison.items) {
        const returns: number[] = [];
        const curve = item.result.equityCurve;
        for (let j = trainingStartIndex; j <= trainingEndReturnIndex; j++) {
          if (j < 0 || j + 1 >= curve.length) continue;
          if (regimeByDate.get(curve[j].timestamp) !== currentRegime || currentRegime === 'UNKNOWN') continue;
          const a = curve[j].equity;
          const b = curve[j + 1].equity;
          if (a > 0 && Number.isFinite(b)) returns.push(b / a - 1);
        }
        if (item === comparison.items[0]) regimeObservations = returns.length;
        scores[item.strategyId] = returns.length >= minimumRegimeObservations ? scoreReturns(returns, metric) : null;
      }

      const ranked = Object.entries(scores)
        .filter((x): x is [PortfolioStrategyId, number] => x[1] != null && Number.isFinite(x[1]))
        .sort((a, b) => b[1] - a[1]);
      const selectedPolicy = ranked[0]?.[0] ?? fallbackPolicy;
      decisions.push({
        decisionDate,
        executionDate,
        regimeAtDecision: currentRegime,
        selectedPolicy,
        fallbackUsed: ranked.length === 0,
        trainingStartDate: baseCurve[trainingStartIndex]?.timestamp ?? null,
        trainingEndDate: trainingEndReturnIndex >= trainingStartIndex ? baseCurve[trainingEndReturnIndex + 1]?.timestamp ?? null : null,
        regimeObservations,
        scores
      });
    }

    return {
      portfolioDatasetFingerprint: comparison.portfolioDatasetFingerprint,
      metric,
      learningLookbackBars,
      minimumRegimeObservations,
      fallbackPolicy,
      decisions,
      note: 'Selector causal diagnóstico: cada decisión usa únicamente retornos observados antes de executionDate. No ejecuta órdenes por sí mismo.'
    };
  }
}
