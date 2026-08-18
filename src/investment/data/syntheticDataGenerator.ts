import { Asset } from '../../types';
import { PriceBar } from '../backtesting/types';
import { DataProvenance, SyntheticGenerationConfig } from './types';

/**
 * Fast 32-bit pseudo-random number generator (Mulberry32)
 * Guarantees 100% deterministic reproducibility given the same seed across any platform/render.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export function generateDeterministicSeed(inputString: string): number {
  let hash = 0;
  for (let i = 0; i < inputString.length; i++) {
    const char = inputString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) || 424242;
}

export class SyntheticDataGenerator {
  /**
   * Generates a synthetic daily OHLCV series by interpolating between static reference points
   * using a deterministic PRNG seed.
   */
  public static generateFromAsset(
    asset: Asset,
    config: Partial<SyntheticGenerationConfig> = {}
  ): { bars: PriceBar[]; provenance: DataProvenance } {
    const seed = config.seed ?? generateDeterministicSeed(`${asset.id}-${asset.ticker}`);
    const prng = new SeededPRNG(seed);
    const numSubBars = config.totalBars ?? 60;
    const rawHist = asset.historicalPrices || [];

    if (rawHist.length < 2) {
      return this.generateGeometricBrownianTrajectory(
        asset.currentPrice,
        asset.change1y,
        asset.volatilityAnnual,
        { ...config, seed }
      );
    }

    const bars: PriceBar[] = [];
    const points = rawHist.map(p => ({
      date: p.date,
      price: p.price
    }));

    // Interpolate between monthly points with deterministic pseudo-random noise
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const steps = Math.max(5, Math.floor(numSubBars / points.length));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const basePrice = p1.price + (p2.price - p1.price) * t;
        const randVal = prng.next() - 0.5;
        const noise = (Math.sin(s * 1.5) + randVal) * (asset.volatilityAnnual / 100) * 0.15 * basePrice;
        
        const close = Math.max(0.1, Number((basePrice + noise).toFixed(2)));
        const openSpread = (prng.next() - 0.5) * 0.006;
        const open = Math.max(0.1, Number((close * (1 + openSpread)).toFixed(2)));
        
        const maxOC = Math.max(open, close);
        const minOC = Math.min(open, close);
        const high = Number((maxOC * (1 + prng.next() * 0.008)).toFixed(2));
        const low = Number((minOC * (1 - prng.next() * 0.008)).toFixed(2));
        const volume = Math.round(10000 + prng.next() * 25000);

        bars.push({
          timestamp: `${p1.date}-D${s + 1}`,
          open,
          high,
          low,
          close,
          volume
        });
      }
    }

    // Append current price bar snapshot
    const lastOpen = Number((asset.currentPrice * (1 - (asset.change24h / 100))).toFixed(2));
    const lastClose = Number(asset.currentPrice.toFixed(2));
    const lastMaxOC = Math.max(lastOpen, lastClose);
    const lastMinOC = Math.min(lastOpen, lastClose);

    bars.push({
      timestamp: '2026-08-Hoy',
      open: lastOpen,
      high: Number((lastMaxOC * 1.005).toFixed(2)),
      low: Number((lastMinOC * 0.995).toFixed(2)),
      close: lastClose,
      volume: 45000
    });

    const provenance: DataProvenance = {
      sourceType: 'SYNTHETIC',
      provider: 'Generador Sintético PRNG (Mulberry32)',
      symbol: asset.ticker,
      timeframe: 'Daily (Interpolado con ruido pseudoaleatorio)',
      startDate: bars[0]?.timestamp,
      endDate: bars[bars.length - 1]?.timestamp,
      isReproducible: true,
      seed,
      notes: `Serie sintética reproducible generada para ${asset.ticker} con seed determinista #${seed}.`
    };

    return { bars, provenance };
  }

  /**
   * Generates a pure Geometric Brownian Motion trajectory with drift and volatility
   */
  public static generateGeometricBrownianTrajectory(
    currentPrice: number,
    annualReturnPct: number,
    annualVolatilityPct: number,
    config: Partial<SyntheticGenerationConfig> = {}
  ): { bars: PriceBar[]; provenance: DataProvenance } {
    const seed = config.seed ?? 42;
    const prng = new SeededPRNG(seed);
    const totalBars = config.totalBars ?? 60;
    const bars: PriceBar[] = [];

    const drift = (annualReturnPct / 100) / totalBars;
    const vol = (annualVolatilityPct / 100) / Math.sqrt(totalBars);

    const startPrice = currentPrice / (1 + (annualReturnPct / 100));
    let price = startPrice;

    for (let i = 0; i < totalBars; i++) {
      const randomShock = (prng.next() - 0.48) * 2;
      const stepReturn = drift + (vol * randomShock);
      const open = Number(price.toFixed(2));
      price = Math.max(0.1, price * (1 + stepReturn));
      const close = Number(price.toFixed(2));

      const maxOC = Math.max(open, close);
      const minOC = Math.min(open, close);
      const high = Number((maxOC * (1 + prng.next() * 0.006)).toFixed(2));
      const low = Number((minOC * (1 - prng.next() * 0.006)).toFixed(2));
      const volume = Math.round(15000 + prng.next() * 30000);

      bars.push({
        timestamp: `B${i + 1}`,
        open,
        high,
        low,
        close,
        volume
      });
    }

    const provenance: DataProvenance = {
      sourceType: 'SYNTHETIC',
      provider: 'Generador de Movimiento Browniano Sintético',
      timeframe: 'Daily (Simulado)',
      isReproducible: true,
      seed,
      notes: `Trayectoria sintética de ${totalBars} barras (drift=${drift.toFixed(4)}, vol=${vol.toFixed(4)}, seed=${seed}).`
    };

    return { bars, provenance };
  }
}
