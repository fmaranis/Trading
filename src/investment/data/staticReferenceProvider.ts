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

    const bars: PriceBar[] = rawHist.map(p => {
      // Normalize 'YYYY-MM' to 'YYYY-MM-01' for standard ISO timestamp parsing
      const isoDate = p.date.length === 7 ? `${p.date}-01` : p.date;
      return {
        timestamp: isoDate,
        open: p.price,
        high: p.price,
        low: p.price,
        close: p.price,
        volume: 0
      };
    });

    // Include the current price snapshot as final reference point with a strictly later timestamp
    const lastBar = bars[bars.length - 1];
    const lastDateMs = lastBar ? Date.parse(lastBar.timestamp) : Date.parse('2026-08-01T00:00:00Z');
    // Ensure last snapshot is strictly after previous monthly bar
    const finalDateStr = new Date(lastDateMs + 17 * 86400000).toISOString().split('T')[0];

    bars.push({
      timestamp: finalDateStr,
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
