import { PriceBar } from '../backtesting/types';
import {
  AlignedMultiAssetDataset,
  CalendarAlignmentPolicy,
  MultiAssetDataError,
  MultiAssetDataset,
  PortfolioDataProvenance,
  PortfolioEvidence
} from './types';

export function canonicalTradingDate(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) throw new MultiAssetDataError(`Timestamp no parseable: ${timestamp}`);
  return new Date(ms).toISOString().slice(0, 10);
}

function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const ch of text) {
    hash ^= BigInt(ch.codePointAt(0)!);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function computeAssetDatasetFingerprint(assetId: string, ticker: string, bars: PriceBar[]): string {
  const canonical = bars.map(b => `${canonicalTradingDate(b.timestamp)}|${b.open}|${b.high}|${b.low}|${b.close}|${b.volume ?? 0}`).join('\n');
  return `fp_${fnv1a64(`${assetId}|${ticker}\n${canonical}`)}`;
}

export function computePortfolioDatasetFingerprint(
  timeframe: string,
  assetFingerprints: Record<string, string>
): string {
  const payload = Object.entries(assetFingerprints)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([assetId, fp]) => `${assetId}:${fp}`)
    .join('|');
  return `pfp_${fnv1a64(`timeframe=${timeframe}|${payload}`)}`;
}

export function classifyPortfolioEvidence(dataset: MultiAssetDataset): PortfolioEvidence {
  const types = new Set(dataset.assets.map(a => a.provenance.sourceType));
  if (types.size !== 1) return 'MIXED';
  const only = [...types][0];
  if (only === 'REAL') return 'REAL_ONLY';
  if (only === 'STATIC_REFERENCE') return 'STATIC_ONLY';
  return 'SYNTHETIC_ONLY';
}

export function buildPortfolioProvenance(dataset: MultiAssetDataset): PortfolioDataProvenance {
  const evidence = classifyPortfolioEvidence(dataset);
  const assetDatasetFingerprints: Record<string, string> = {};
  const assetProvenance: Record<string, any> = {};
  for (const asset of dataset.assets) {
    assetDatasetFingerprints[asset.assetId] = computeAssetDatasetFingerprint(asset.assetId, asset.ticker, asset.bars);
    assetProvenance[asset.assetId] = asset.provenance;
  }
  return {
    sourceType: evidence === 'MIXED' ? 'MIXED' : dataset.assets[0].provenance.sourceType,
    portfolioEvidence: evidence,
    assetProvenance,
    assetDatasetFingerprints,
    portfolioDatasetFingerprint: computePortfolioDatasetFingerprint(dataset.timeframe, assetDatasetFingerprints)
  };
}

export class MultiAssetDataAligner {
  public static align(dataset: MultiAssetDataset, policy: CalendarAlignmentPolicy = 'INTERSECTION'): AlignedMultiAssetDataset {
    if (dataset.assets.length < 2) throw new MultiAssetDataError('Se requieren al menos 2 activos para un backtest multi-activo.');
    if (dataset.assets.length > 10) throw new MultiAssetDataError('La fase 9A admite un máximo de 10 activos.');

    const maps = new Map<string, Map<string, PriceBar>>();
    for (const asset of dataset.assets) {
      if (!asset.bars.length) throw new MultiAssetDataError(`Dataset vacío para ${asset.ticker}.`);
      const dateMap = new Map<string, PriceBar>();
      let previousMs = -Infinity;
      for (const bar of asset.bars) {
        const ms = Date.parse(bar.timestamp);
        if (!Number.isFinite(ms) || ms <= previousMs) {
          throw new MultiAssetDataError(`Serie desordenada o duplicada para ${asset.ticker}: ${bar.timestamp}`);
        }
        previousMs = ms;
        const date = canonicalTradingDate(bar.timestamp);
        if (dateMap.has(date)) throw new MultiAssetDataError(`Fecha de trading duplicada para ${asset.ticker}: ${date}`);
        dateMap.set(date, bar);
      }
      maps.set(asset.assetId, dateMap);
    }

    const allDateSets = dataset.assets.map(a => new Set(maps.get(a.assetId)!.keys()));
    let dates: string[];
    if (policy === 'INTERSECTION') {
      dates = [...allDateSets[0]].filter(d => allDateSets.every(set => set.has(d)));
    } else {
      dates = [...new Set(allDateSets.flatMap(s => [...s]))];
    }
    dates.sort();
    if (dates.length < 2) throw new MultiAssetDataError('No hay suficientes fechas alineadas entre los activos.');

    const rows = dates.map(tradingDate => {
      const assets: Record<string, PriceBar> = {};
      for (const asset of dataset.assets) {
        const bar = maps.get(asset.assetId)!.get(tradingDate);
        if (bar) assets[asset.assetId] = bar;
      }
      return { tradingDate, assets };
    });

    return {
      assetIds: dataset.assets.map(a => a.assetId),
      tickers: Object.fromEntries(dataset.assets.map(a => [a.assetId, a.ticker])),
      rows,
      policy
    };
  }
}
