import { AlignedMultiAssetDataset } from '../portfolioBacktesting';
import { MarketRegime, RegimeClassifierConfig, RegimeObservation, RegimeSeriesResult } from './types';

const DEFAULT_CONFIG: Required<RegimeClassifierConfig> = {
  trendLookbackBars: 60,
  volatilityLookbackBars: 20,
  volatilityBaselineBars: 120,
  bullTrendThresholdPct: 3,
  bearTrendThresholdPct: -3,
  highVolatilityMultiplier: 1.25
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleStd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function proxyClose(row: AlignedMultiAssetDataset['rows'][number], assetIds: string[]): number {
  const relatives = assetIds.map(id => row.assets[id]?.close).filter((x): x is number => Number.isFinite(x) && x > 0);
  if (relatives.length !== assetIds.length) throw new Error(`Fila incompleta al construir market proxy: ${row.tradingDate}`);
  return relatives.reduce((a, b) => a + b, 0) / relatives.length;
}

function classifyRegime(trendPct: number, highVol: boolean, cfg: Required<RegimeClassifierConfig>): MarketRegime {
  if (trendPct >= cfg.bullTrendThresholdPct) return highVol ? 'BULL_HIGH_VOL' : 'BULL_LOW_VOL';
  if (trendPct <= cfg.bearTrendThresholdPct) return highVol ? 'BEAR_HIGH_VOL' : 'BEAR_LOW_VOL';
  return highVol ? 'SIDEWAYS_HIGH_VOL' : 'SIDEWAYS_LOW_VOL';
}

export class DeterministicRegimeClassifier {
  static classify(aligned: AlignedMultiAssetDataset, config: RegimeClassifierConfig = {}): RegimeSeriesResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    if (aligned.assetIds.length < 2) throw new Error('La clasificación de régimen multi-activo requiere al menos 2 activos.');
    if (cfg.trendLookbackBars < 2 || cfg.volatilityLookbackBars < 2 || cfg.volatilityBaselineBars < cfg.volatilityLookbackBars) {
      throw new Error('Configuración de régimen inválida.');
    }

    const closes = aligned.rows.map(row => proxyClose(row, aligned.assetIds));
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) logReturns.push(Math.log(closes[i] / closes[i - 1]));

    const rollingVols: (number | null)[] = closes.map((_, i) => {
      const endReturnIndex = i - 1;
      if (endReturnIndex < cfg.volatilityLookbackBars - 1) return null;
      const slice = logReturns.slice(endReturnIndex - cfg.volatilityLookbackBars + 1, endReturnIndex + 1);
      const sd = sampleStd(slice);
      return sd == null ? null : sd * Math.sqrt(252) * 100;
    });

    const observations: RegimeObservation[] = aligned.rows.map((row, i) => {
      if (i < cfg.trendLookbackBars || rollingVols[i] == null) {
        return {
          tradingDate: row.tradingDate,
          regime: 'UNKNOWN',
          trendReturnPct: null,
          realizedVolatilityPct: rollingVols[i],
          baselineVolatilityPct: null,
          highVolatility: null,
          informationEndDate: row.tradingDate
        };
      }

      const trendReturnPct = (closes[i] / closes[i - cfg.trendLookbackBars] - 1) * 100;
      const baselineStart = Math.max(0, i - cfg.volatilityBaselineBars + 1);
      const historicalVols = rollingVols.slice(baselineStart, i + 1).filter((x): x is number => x != null && Number.isFinite(x));
      const baselineVolatilityPct = median(historicalVols);
      if (baselineVolatilityPct == null || !(baselineVolatilityPct > 0)) {
        return {
          tradingDate: row.tradingDate,
          regime: 'UNKNOWN',
          trendReturnPct,
          realizedVolatilityPct: rollingVols[i],
          baselineVolatilityPct,
          highVolatility: null,
          informationEndDate: row.tradingDate
        };
      }
      const highVolatility = rollingVols[i]! > baselineVolatilityPct * cfg.highVolatilityMultiplier;
      return {
        tradingDate: row.tradingDate,
        regime: classifyRegime(trendReturnPct, highVolatility, cfg),
        trendReturnPct,
        realizedVolatilityPct: rollingVols[i],
        baselineVolatilityPct,
        highVolatility,
        informationEndDate: row.tradingDate
      };
    });

    const classifiedObservations = observations.filter(x => x.regime !== 'UNKNOWN').length;
    return {
      methodology: 'EQUAL_WEIGHT_MARKET_PROXY',
      config: cfg,
      observations,
      classifiedObservations,
      unknownObservations: observations.length - classifiedObservations
    };
  }
}
