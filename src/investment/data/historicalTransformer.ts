import { PriceBar } from '../backtesting/types';
import { Asset } from '../../types';

export class HistoricalDataTransformer {
  /**
   * Converts existing Asset historical prices into daily/monthly synthetic OHLCV bars
   * for backtesting and quantitative simulation without external API lag.
   */
  public static assetToPriceBars(asset: Asset, numSubBars: number = 60): PriceBar[] {
    const rawHist = asset.historicalPrices || [];
    if (rawHist.length < 2) {
      // Generate synthetic historical trajectory based on current price and 1y change
      return this.generateSyntheticTrajectory(asset.currentPrice, asset.change1y, asset.volatilityAnnual, numSubBars);
    }

    const bars: PriceBar[] = [];
    const points = rawHist.map(p => ({
      date: p.date,
      price: p.price
    }));

    // Interpolate between historical monthly points to create daily bars
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const steps = Math.max(5, Math.floor(numSubBars / points.length));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const basePrice = p1.price + (p2.price - p1.price) * t;
        const noise = (Math.sin(s * 1.5) + (Math.random() - 0.5)) * (asset.volatilityAnnual / 100) * 0.15 * basePrice;
        const close = Math.max(0.1, basePrice + noise);
        const open = close * (1 + (Math.random() - 0.5) * 0.006);
        const high = Math.max(open, close) * (1 + Math.random() * 0.008);
        const low = Math.min(open, close) * (1 - Math.random() * 0.008);

        bars.push({
          timestamp: `${p1.date}-D${s + 1}`,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Math.round(10000 + Math.random() * 25000)
        });
      }
    }

    // Push final real current price bar
    bars.push({
      timestamp: '2026-08-Hoy',
      open: asset.currentPrice * (1 - (asset.change24h / 100)),
      high: Math.max(asset.currentPrice, asset.currentPrice * 1.005),
      low: Math.min(asset.currentPrice, asset.currentPrice * 0.995),
      close: asset.currentPrice,
      volume: 45000
    });

    return bars;
  }

  /**
   * Generates Brownian motion trajectory from 1y return & annualized volatility
   */
  public static generateSyntheticTrajectory(
    currentPrice: number,
    annualReturnPct: number,
    annualVolatilityPct: number,
    totalBars: number = 60
  ): PriceBar[] {
    const bars: PriceBar[] = [];
    const drift = (annualReturnPct / 100) / totalBars;
    const vol = (annualVolatilityPct / 100) / Math.sqrt(totalBars);

    const startPrice = currentPrice / (1 + (annualReturnPct / 100));
    let price = startPrice;

    for (let i = 0; i < totalBars; i++) {
      const randomShock = (Math.random() - 0.48) * 2;
      const stepReturn = drift + (vol * randomShock);
      const open = price;
      price = Math.max(0.1, price * (1 + stepReturn));
      const close = price;
      const high = Math.max(open, close) * (1 + Math.random() * 0.006);
      const low = Math.min(open, close) * (1 - Math.random() * 0.006);

      bars.push({
        timestamp: `B${i + 1}`,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.round(15000 + Math.random() * 30000)
      });
    }

    return bars;
  }
}
