import { PortfolioBacktestResult } from '../portfolioBacktesting';
import { MarketRegime, PortfolioRegimePerformance, RegimePerformanceRow, RegimeSeriesResult } from './types';

const REGIMES: Exclude<MarketRegime, 'UNKNOWN'>[] = [
  'BULL_LOW_VOL',
  'BULL_HIGH_VOL',
  'BEAR_LOW_VOL',
  'BEAR_HIGH_VOL',
  'SIDEWAYS_LOW_VOL',
  'SIDEWAYS_HIGH_VOL'
];

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function sampleStd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1));
}

export class RegimePerformanceAnalyzer {
  static analyze(result: PortfolioBacktestResult, regimes: RegimeSeriesResult): PortfolioRegimePerformance {
    const regimeByDate = new Map(regimes.observations.map(x => [x.tradingDate, x.regime]));
    const returnsByRegime = new Map<Exclude<MarketRegime, 'UNKNOWN'>, number[]>();
    for (const regime of REGIMES) returnsByRegime.set(regime, []);

    for (let i = 0; i < result.equityCurve.length - 1; i++) {
      const current = result.equityCurve[i];
      const next = result.equityCurve[i + 1];
      const regime = regimeByDate.get(current.timestamp);
      if (!regime || regime === 'UNKNOWN') continue;
      if (!(current.equity > 0) || !Number.isFinite(next.equity)) continue;
      returnsByRegime.get(regime)!.push(next.equity / current.equity - 1);
    }

    const rows: RegimePerformanceRow[] = REGIMES.map(regime => {
      const rs = returnsByRegime.get(regime)!;
      if (!rs.length) {
        return { regime, observations: 0, totalReturnPct: null, meanDailyReturnPct: null, annualizedVolatilityPct: null, sharpeZeroRf: null, positiveDaysPct: null };
      }
      const totalReturnPct = (rs.reduce((acc, r) => acc * (1 + r), 1) - 1) * 100;
      const avg = mean(rs)!;
      const sd = sampleStd(rs);
      return {
        regime,
        observations: rs.length,
        totalReturnPct,
        meanDailyReturnPct: avg * 100,
        annualizedVolatilityPct: sd == null ? null : sd * Math.sqrt(252) * 100,
        sharpeZeroRf: sd == null || sd === 0 ? null : (avg / sd) * Math.sqrt(252),
        positiveDaysPct: rs.filter(r => r > 0).length / rs.length * 100
      };
    });

    return {
      portfolioDatasetFingerprint: result.provenance.portfolioDatasetFingerprint,
      attributionRule: 'REGIME_AT_CLOSE_T_APPLIED_TO_RETURN_T_TO_T_PLUS_1',
      rows,
      classifiedReturnObservations: rows.reduce((s, x) => s + x.observations, 0)
    };
  }
}
