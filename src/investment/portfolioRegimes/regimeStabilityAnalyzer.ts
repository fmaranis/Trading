import { AlignedMultiAssetDataset, PortfolioStrategyComparisonResult } from '../portfolioBacktesting';
import { DeterministicRegimeClassifier } from './deterministicRegimeClassifier';
import { MarketRegime, RegimeClassifierConfig } from './types';

export interface RegimeWindowWinner {
  windowIndex: number;
  startDate: string;
  endDate: string;
  regime: Exclude<MarketRegime, 'UNKNOWN'>;
  observations: number;
  winnerStrategyId: string | null;
  winnerReturnPct: number | null;
  strategyReturnsPct: Record<string, number | null>;
}

export interface RegimeStabilityRow {
  regime: Exclude<MarketRegime, 'UNKNOWN'>;
  windowsWithEvidence: number;
  dominantStrategyId: string | null;
  dominancePct: number | null;
  winnerCounts: Record<string, number>;
}

export interface RegimeStabilityResult {
  portfolioDatasetFingerprint: string;
  blockBars: number;
  windows: RegimeWindowWinner[];
  stability: RegimeStabilityRow[];
  note: string;
}

const REGIMES: Exclude<MarketRegime, 'UNKNOWN'>[] = [
  'BULL_LOW_VOL', 'BULL_HIGH_VOL', 'BEAR_LOW_VOL', 'BEAR_HIGH_VOL', 'SIDEWAYS_LOW_VOL', 'SIDEWAYS_HIGH_VOL'
];

export class RegimeStabilityAnalyzer {
  static analyze(
    aligned: AlignedMultiAssetDataset,
    comparison: PortfolioStrategyComparisonResult,
    blockBars = 63,
    classifierConfig: RegimeClassifierConfig = {}
  ): RegimeStabilityResult {
    if (blockBars < 10) throw new Error('blockBars debe ser >= 10.');
    const regimes = DeterministicRegimeClassifier.classify(aligned, classifierConfig);
    const regimeByDate = new Map(regimes.observations.map(x => [x.tradingDate, x.regime]));
    const baseDates = comparison.items[0]?.result.equityCurve.map(x => x.timestamp) ?? [];
    if (!baseDates.length) throw new Error('Comparación sin equity curve.');
    for (const item of comparison.items) {
      if (item.result.provenance.portfolioDatasetFingerprint !== comparison.portfolioDatasetFingerprint) throw new Error('Fingerprint inconsistente en stability analysis.');
      if (item.result.equityCurve.length !== baseDates.length) throw new Error('Equity curves no alineadas entre políticas.');
    }

    const windows: RegimeWindowWinner[] = [];
    let windowIndex = 0;
    for (let start = 0; start < baseDates.length - 1; start += blockBars) {
      const end = Math.min(baseDates.length - 1, start + blockBars);
      for (const regime of REGIMES) {
        const returnsByStrategy: Record<string, number[]> = Object.fromEntries(comparison.items.map(x => [x.strategyId, []]));
        let observations = 0;
        for (let i = start; i < end; i++) {
          if (regimeByDate.get(baseDates[i]) !== regime) continue;
          observations++;
          for (const item of comparison.items) {
            const curve = item.result.equityCurve;
            const current = curve[i].equity;
            const next = curve[i + 1].equity;
            if (current > 0 && Number.isFinite(next)) returnsByStrategy[item.strategyId].push(next / current - 1);
          }
        }
        const strategyReturnsPct: Record<string, number | null> = {};
        for (const item of comparison.items) {
          const rs = returnsByStrategy[item.strategyId];
          strategyReturnsPct[item.strategyId] = rs.length ? (rs.reduce((acc, r) => acc * (1 + r), 1) - 1) * 100 : null;
        }
        const ranked = Object.entries(strategyReturnsPct).filter((x): x is [string, number] => x[1] != null).sort((a, b) => b[1] - a[1]);
        windows.push({
          windowIndex,
          startDate: baseDates[start],
          endDate: baseDates[end],
          regime,
          observations,
          winnerStrategyId: ranked[0]?.[0] ?? null,
          winnerReturnPct: ranked[0]?.[1] ?? null,
          strategyReturnsPct
        });
      }
      windowIndex++;
    }

    const stability = REGIMES.map(regime => {
      const evidence = windows.filter(x => x.regime === regime && x.observations > 0 && x.winnerStrategyId != null);
      const winnerCounts: Record<string, number> = {};
      for (const row of evidence) winnerCounts[row.winnerStrategyId!] = (winnerCounts[row.winnerStrategyId!] ?? 0) + 1;
      const ranked = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1]);
      const dominantStrategyId = ranked[0]?.[0] ?? null;
      return {
        regime,
        windowsWithEvidence: evidence.length,
        dominantStrategyId,
        dominancePct: evidence.length && dominantStrategyId ? winnerCounts[dominantStrategyId] / evidence.length * 100 : null,
        winnerCounts
      };
    });

    return {
      portfolioDatasetFingerprint: comparison.portfolioDatasetFingerprint,
      blockBars,
      windows,
      stability,
      note: 'Diagnóstico ex-post por bloques temporales. No se utiliza para seleccionar una estrategia dentro del mismo periodo evaluado.'
    };
  }
}
