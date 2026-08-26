import { AlignedMultiAssetDataset } from '../portfolioBacktesting/types';
import { AllocationRequest, AllocationResult, RealPortfolioAnalyticsResult } from './types';
import { RealPortfolioAnalytics } from './realPortfolioAnalytics';

const EPS = 1e-12;

function normalizePositive(raw: Record<string, number>): Record<string, number> {
  const positive = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number.isFinite(v) && v > 0 ? v : 0]));
  const sum = Object.values(positive).reduce((a, b) => a + b, 0);
  if (sum <= EPS) return Object.fromEntries(Object.keys(raw).map(k => [k, 0]));
  return Object.fromEntries(Object.entries(positive).map(([k, v]) => [k, v / sum]));
}

function portfolioVariance(weights: number[], covariance: number[][]): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) variance += weights[i] * covariance[i][j] * weights[j];
  }
  return variance;
}

function equalRiskContribution(assetIds: string[], covariance: number[][]): AllocationResult {
  const n = assetIds.length;
  let w = Array(n).fill(1 / n);
  let converged = false;
  let lastError = Number.POSITIVE_INFINITY;
  let iterations = 0;

  for (iterations = 1; iterations <= 1000; iterations++) {
    const variance = portfolioVariance(w, covariance);
    if (!(variance > EPS)) break;

    const marginal = w.map((_, i) => covariance[i].reduce((s, c, j) => s + c * w[j], 0));
    const contributions = w.map((wi, i) => wi * marginal[i]);
    const target = variance / n;
    const errors = contributions.map(rc => Math.abs(rc - target) / Math.max(Math.abs(target), EPS));
    lastError = Math.max(...errors);
    if (lastError < 1e-5) {
      converged = true;
      break;
    }

    const next = w.map((wi, i) => {
      const rc = Math.max(Math.abs(contributions[i]), EPS);
      const factor = Math.sqrt(target / rc);
      return Math.max(EPS, wi * factor);
    });
    const sum = next.reduce((a, b) => a + b, 0);
    w = next.map(x => x / sum);
  }

  return {
    method: 'RISK_PARITY_ERC',
    weights: Object.fromEntries(assetIds.map((id, i) => [id, w[i]])),
    cashWeight: 0,
    diagnostics: {
      iterations,
      converged,
      maxRiskContributionError: Number.isFinite(lastError) ? lastError : null,
      notes: ['Equal Risk Contribution long-only sobre covarianza histórica alineada.', 'Sin apalancamiento ni posiciones cortas.']
    }
  };
}

export class DeterministicPortfolioAllocator {
  static allocate(aligned: AlignedMultiAssetDataset, request: AllocationRequest): AllocationResult {
    const analytics = RealPortfolioAnalytics.calculate(aligned, request.lookbackBars ?? 60);
    return this.allocateFromAnalytics(aligned, analytics, request);
  }

  static allocateFromAnalytics(aligned: AlignedMultiAssetDataset, analytics: RealPortfolioAnalyticsResult, request: AllocationRequest): AllocationResult {
    const assetIds = analytics.correlationMatrix.assetIds;

    if (request.method === 'EQUAL_WEIGHT') {
      const weight = 1 / assetIds.length;
      return { method: request.method, weights: Object.fromEntries(assetIds.map(id => [id, weight])), cashWeight: 0, diagnostics: { notes: ['Equiponderación determinista.'] } };
    }

    if (request.method === 'INVERSE_VOLATILITY') {
      const raw = Object.fromEntries(analytics.assetStatistics.map(s => [s.assetId, s.annualizedVolatilityPct && s.annualizedVolatilityPct > 0 ? 1 / s.annualizedVolatilityPct : 0]));
      const weights = normalizePositive(raw);
      if (Object.values(weights).every(v => v === 0)) throw new Error('No se puede calcular Inverse Volatility: volatilidades insuficientes o nulas.');
      return { method: request.method, weights, cashWeight: 0, diagnostics: { notes: ['Pesos proporcionales al inverso de la volatilidad anualizada histórica.'] } };
    }

    if (request.method === 'RISK_PARITY_ERC') {
      return equalRiskContribution(assetIds, analytics.covarianceMatrix.values);
    }

    if (request.method === 'RELATIVE_MOMENTUM') {
      const topK = Math.max(1, Math.min(request.topK ?? Math.min(2, assetIds.length), assetIds.length));
      const threshold = request.minimumMomentumPct ?? 0;
      const ranked = [...analytics.assetStatistics]
        .filter(s => s.momentumReturnPct != null)
        .sort((a, b) => (b.momentumReturnPct ?? -Infinity) - (a.momentumReturnPct ?? -Infinity));
      const selected = ranked.filter(s => (s.momentumReturnPct ?? -Infinity) > threshold).slice(0, topK);
      const rejected = assetIds.filter(id => !selected.some(s => s.assetId === id));
      const weights: Record<string, number> = Object.fromEntries(assetIds.map(id => [id, 0]));
      if (selected.length > 0) {
        const w = 1 / selected.length;
        for (const item of selected) weights[item.assetId] = w;
      }
      return {
        method: request.method,
        weights,
        cashWeight: selected.length ? 0 : 1,
        diagnostics: {
          selectedAssets: selected.map(s => s.assetId),
          rejectedAssets: rejected,
          notes: [`Top-${topK} por retorno relativo del lookback; activos con momentum <= ${threshold.toFixed(2)}% se excluyen.`, selected.length ? 'Activos seleccionados equiponderados.' : 'Ningún activo supera el umbral: 100% cash.']
        }
      };
    }

    throw new Error(`Método de asignación no soportado: ${request.method}`);
  }
}
