import { AlignedMultiAssetDataset } from '../portfolioBacktesting/types';
import { RealPortfolioAnalyticsResult } from './types';

const ANNUALIZATION = 252;

function sampleMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleCovariance(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const ma = sampleMean(a)!;
  const mb = sampleMean(b)!;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - ma) * (b[i] - mb);
  return sum / (a.length - 1);
}

function sampleStd(values: number[]): number | null {
  const v = sampleCovariance(values, values);
  return v == null || v < 0 ? null : Math.sqrt(v);
}

export class RealPortfolioAnalytics {
  static calculate(aligned: AlignedMultiAssetDataset, momentumLookbackBars = 60): RealPortfolioAnalyticsResult {
    if (aligned.rows.length < 3) throw new Error('Se requieren al menos 3 barras alineadas para analítica de cartera.');

    const assetIds = [...aligned.assetIds];
    const returns: Record<string, number[]> = Object.fromEntries(assetIds.map(id => [id, []]));

    for (let i = 1; i < aligned.rows.length; i++) {
      for (const id of assetIds) {
        const prev = aligned.rows[i - 1].assets[id]?.close;
        const curr = aligned.rows[i].assets[id]?.close;
        if (!(prev > 0) || !(curr > 0)) throw new Error(`Precio inválido para ${id} en serie alineada.`);
        returns[id].push(Math.log(curr / prev));
      }
    }

    const covarianceValues = assetIds.map(a => assetIds.map(b => sampleCovariance(returns[a], returns[b]) ?? 0));
    const correlationValues = assetIds.map((a, i) => assetIds.map((b, j) => {
      if (i === j) return 1;
      const cov = sampleCovariance(returns[a], returns[b]);
      const sa = sampleStd(returns[a]);
      const sb = sampleStd(returns[b]);
      if (cov == null || sa == null || sb == null || sa === 0 || sb === 0) return 0;
      return Math.max(-1, Math.min(1, cov / (sa * sb)));
    }));

    const pairwise: number[] = [];
    for (let i = 0; i < assetIds.length; i++) {
      for (let j = i + 1; j < assetIds.length; j++) pairwise.push(correlationValues[i][j]);
    }

    const assetStatistics = assetIds.map(id => {
      const series = returns[id];
      const std = sampleStd(series);
      const lookback = Math.min(momentumLookbackBars, aligned.rows.length - 1);
      const startIndex = aligned.rows.length - 1 - lookback;
      const startClose = aligned.rows[startIndex].assets[id].close;
      const endClose = aligned.rows[aligned.rows.length - 1].assets[id].close;
      return {
        assetId: id,
        ticker: aligned.tickers[id] ?? id,
        observations: series.length,
        meanDailyReturn: sampleMean(series),
        annualizedVolatilityPct: std == null ? null : std * Math.sqrt(ANNUALIZATION) * 100,
        momentumReturnPct: startClose > 0 ? (endClose / startClose - 1) * 100 : null
      };
    });

    return {
      observations: aligned.rows.length - 1,
      returnType: 'LOG',
      annualizationFactor: ANNUALIZATION,
      covarianceMatrix: { assetIds, values: covarianceValues },
      correlationMatrix: { assetIds, values: correlationValues },
      assetStatistics,
      averagePairwiseCorrelation: pairwise.length ? pairwise.reduce((a, b) => a + b, 0) / pairwise.length : null,
      minPairwiseCorrelation: pairwise.length ? Math.min(...pairwise) : null,
      maxPairwiseCorrelation: pairwise.length ? Math.max(...pairwise) : null
    };
  }
}
