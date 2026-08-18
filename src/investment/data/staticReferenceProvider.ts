import { Asset } from '../../types';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { PriceBar } from '../backtesting/types';
import { DataProvenance } from './types';

export class StaticReferenceProvider {
  /**
   * Retrieves strictly the static reference points defined manually in marketData.ts.
   * Does NOT interpolate, generate noise, or invent intra-period OHLC.
   */
  public static getStaticBarsForAsset(asset: Asset): { bars: PriceBar[]; provenance: DataProvenance } {
    const rawHist = asset.historicalPrices || [];

    const bars: PriceBar[] = rawHist.map(p => ({
      timestamp: p.date,
      open: p.price,
      high: p.price,
      low: p.price,
      close: p.price,
      volume: 0
    }));

    // Include the current price snapshot as final reference point
    bars.push({
      timestamp: '2026-08-Ref',
      open: asset.currentPrice,
      high: asset.currentPrice,
      low: asset.currentPrice,
      close: asset.currentPrice,
      volume: 0
    });

    const provenance: DataProvenance = {
      sourceType: 'STATIC_REFERENCE',
      provider: 'Tabla Estática Local (marketData.ts)',
      symbol: asset.ticker,
      timeframe: 'Monthly (Puntos de referencia estáticos)',
      startDate: bars[0]?.timestamp,
      endDate: bars[bars.length - 1]?.timestamp,
      isReproducible: true,
      notes: 'Puntos de precio mensuales estáticos sin interpolación sintética ni micro-ruido.'
    };

    return { bars, provenance };
  }

  public static getStaticAssetById(assetId: string): Asset | undefined {
    return ALL_AVAILABLE_ASSETS.find(a => a.id === assetId);
  }
}
