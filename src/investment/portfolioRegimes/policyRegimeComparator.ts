import { AlignedMultiAssetDataset, PortfolioStrategyComparisonResult } from '../portfolioBacktesting';
import { DeterministicRegimeClassifier } from './deterministicRegimeClassifier';
import { RegimePerformanceAnalyzer } from './regimePerformanceAnalyzer';
import { MarketRegime, RegimeClassifierConfig } from './types';

export interface RegimePolicyRankingItem {
  strategyId: string;
  label: string;
  observations: number;
  totalReturnPct: number | null;
  sharpeZeroRf: number | null;
}

export interface RegimePolicyLeaderboard {
  regime: Exclude<MarketRegime, 'UNKNOWN'>;
  bestByReturn: string | null;
  bestBySharpe: string | null;
  ranking: RegimePolicyRankingItem[];
}

export interface RegimePolicyComparisonResult {
  portfolioDatasetFingerprint: string;
  classifierMethodology: 'EQUAL_WEIGHT_MARKET_PROXY';
  attributionRule: 'REGIME_AT_CLOSE_T_APPLIED_TO_RETURN_T_TO_T_PLUS_1';
  classifiedObservations: number;
  leaderboards: RegimePolicyLeaderboard[];
}

export class PolicyRegimeComparator {
  static compare(
    aligned: AlignedMultiAssetDataset,
    comparison: PortfolioStrategyComparisonResult,
    classifierConfig: RegimeClassifierConfig = {}
  ): RegimePolicyComparisonResult {
    const regimes = DeterministicRegimeClassifier.classify(aligned, classifierConfig);
    const performances = comparison.items.map(item => ({
      strategyId: item.strategyId,
      label: item.label,
      performance: RegimePerformanceAnalyzer.analyze(item.result, regimes)
    }));

    if (performances.some(x => x.performance.portfolioDatasetFingerprint !== comparison.portfolioDatasetFingerprint)) {
      throw new Error('Regime comparison fingerprint mismatch.');
    }

    const regimeNames: Exclude<MarketRegime, 'UNKNOWN'>[] = [
      'BULL_LOW_VOL', 'BULL_HIGH_VOL', 'BEAR_LOW_VOL', 'BEAR_HIGH_VOL', 'SIDEWAYS_LOW_VOL', 'SIDEWAYS_HIGH_VOL'
    ];

    const leaderboards = regimeNames.map(regime => {
      const ranking = performances.map(x => {
        const row = x.performance.rows.find(r => r.regime === regime)!;
        return { strategyId: x.strategyId, label: x.label, observations: row.observations, totalReturnPct: row.totalReturnPct, sharpeZeroRf: row.sharpeZeroRf };
      });
      const byReturn = ranking.filter(x => x.totalReturnPct != null).sort((a, b) => (b.totalReturnPct ?? -Infinity) - (a.totalReturnPct ?? -Infinity));
      const bySharpe = ranking.filter(x => x.sharpeZeroRf != null).sort((a, b) => (b.sharpeZeroRf ?? -Infinity) - (a.sharpeZeroRf ?? -Infinity));
      return {
        regime,
        bestByReturn: byReturn[0]?.strategyId ?? null,
        bestBySharpe: bySharpe[0]?.strategyId ?? null,
        ranking
      };
    });

    return {
      portfolioDatasetFingerprint: comparison.portfolioDatasetFingerprint,
      classifierMethodology: regimes.methodology,
      attributionRule: 'REGIME_AT_CLOSE_T_APPLIED_TO_RETURN_T_TO_T_PLUS_1',
      classifiedObservations: regimes.classifiedObservations,
      leaderboards
    };
  }
}
