import { HistoricalMarketDataService } from '../data/marketData/historicalMarketDataService';
import { MultiAssetDataset } from '../portfolioBacktesting';
import { AssetUniverseItem } from './assetUniverse';

export interface AssetScanCandidate {
  asset: AssetUniverseItem;
  status: 'ACCEPTED' | 'REJECTED';
  reason?: string;
  bars: number;
  asOfDate: string | null;
  lastClose: number | null;
  momentum20Pct: number | null;
  momentum60Pct: number | null;
  momentum120Pct: number | null;
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
  score: number | null;
  response?: Awaited<ReturnType<typeof HistoricalMarketDataService.getHistoricalBars>>;
}

export interface AssetUniverseScanResult {
  scanned: number;
  accepted: number;
  rejected: number;
  selected: AssetScanCandidate[];
  candidates: AssetScanCandidate[];
  dataset: MultiAssetDataset;
  rejectionCounts: Record<string, number>;
}

function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const a = prices[prices.length - 1 - lookback];
  const b = prices[prices.length - 1];
  return a > 0 ? (b / a - 1) * 100 : null;
}

function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function maxDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  let peak = slice[0];
  let max = 0;
  for (const p of slice) {
    peak = Math.max(peak, p);
    if (peak > 0) max = Math.max(max, (peak - p) / peak * 100);
  }
  return max;
}

function scoreCandidate(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null, defensive: boolean): number {
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  const defensiveBonus = defensive ? 2.5 : 0;
  return momentum - riskPenalty + defensiveBonus;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function chooseDiversified(candidates: AssetScanCandidate[], maxSelected: number): AssetScanCandidate[] {
  const accepted = candidates.filter(c => c.status === 'ACCEPTED' && c.score != null).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  const selected: AssetScanCandidate[] = [];
  const categoryCount = new Map<string, number>();

  // Ensure at least one defensive candidate if available.
  const bestDefensive = accepted.find(c => c.asset.defensive);
  if (bestDefensive) {
    selected.push(bestDefensive);
    categoryCount.set(bestDefensive.asset.category, 1);
  }

  for (const candidate of accepted) {
    if (selected.some(s => s.asset.assetId === candidate.asset.assetId)) continue;
    if (selected.length >= maxSelected) break;
    const count = categoryCount.get(candidate.asset.category) ?? 0;
    if (count >= 2) continue;
    selected.push(candidate);
    categoryCount.set(candidate.asset.category, count + 1);
  }
  return selected;
}

export class AssetUniverseScanner {
  static async scan(
    universe: AssetUniverseItem[],
    startDate: string,
    endDate: string,
    options: { forceRefresh?: boolean; concurrency?: number; maxSelected?: number; minimumBars?: number; maxDataAgeDays?: number } = {}
  ): Promise<AssetUniverseScanResult> {
    const minimumBars = options.minimumBars ?? 252;
    const maxDataAgeDays = options.maxDataAgeDays ?? 7;

    const candidates = await mapLimit(universe, options.concurrency ?? 3, async asset => {
      try {
        const response = await HistoricalMarketDataService.getHistoricalBars({
          symbol: asset.ticker,
          startDate,
          endDate,
          timeframe: '1d',
          adjusted: true
        }, { forceRefresh: options.forceRefresh ?? false, maxRetries: 1 });

        const providerCurrency = response.metadata.currency;
        if (providerCurrency && providerCurrency !== 'EUR') return { asset, status: 'REJECTED' as const, reason: `NON_EUR:${providerCurrency}`, bars: response.bars.length, asOfDate: response.bars.at(-1)?.timestamp.slice(0, 10) ?? null, lastClose: response.bars.at(-1)?.close ?? null, momentum20Pct: null, momentum60Pct: null, momentum120Pct: null, annualizedVolatilityPct: null, maxDrawdownPct: null, score: null };
        if (response.bars.length < minimumBars) return { asset, status: 'REJECTED' as const, reason: 'INSUFFICIENT_HISTORY', bars: response.bars.length, asOfDate: response.bars.at(-1)?.timestamp.slice(0, 10) ?? null, lastClose: response.bars.at(-1)?.close ?? null, momentum20Pct: null, momentum60Pct: null, momentum120Pct: null, annualizedVolatilityPct: null, maxDrawdownPct: null, score: null };

        const asOfDate = response.bars.at(-1)!.timestamp.slice(0, 10);
        if (daysBetween(asOfDate, endDate) > maxDataAgeDays) return { asset, status: 'REJECTED' as const, reason: 'STALE_DATA', bars: response.bars.length, asOfDate, lastClose: response.bars.at(-1)!.close, momentum20Pct: null, momentum60Pct: null, momentum120Pct: null, annualizedVolatilityPct: null, maxDrawdownPct: null, score: null };

        const prices = response.bars.map(b => b.close);
        const m20 = pctReturn(prices, 20);
        const m60 = pctReturn(prices, 60);
        const m120 = pctReturn(prices, 120);
        const vol = annualizedVolatility(prices, 60);
        const dd = maxDrawdown(prices, 252);
        const score = scoreCandidate(m20, m60, m120, vol, dd, Boolean(asset.defensive));
        return { asset, status: 'ACCEPTED' as const, bars: response.bars.length, asOfDate, lastClose: prices.at(-1) ?? null, momentum20Pct: m20, momentum60Pct: m60, momentum120Pct: m120, annualizedVolatilityPct: vol, maxDrawdownPct: dd, score, response };
      } catch (error: any) {
        return { asset, status: 'REJECTED' as const, reason: error?.name || error?.message || 'LOAD_ERROR', bars: 0, asOfDate: null, lastClose: null, momentum20Pct: null, momentum60Pct: null, momentum120Pct: null, annualizedVolatilityPct: null, maxDrawdownPct: null, score: null };
      }
    });

    const selected = chooseDiversified(candidates, Math.min(options.maxSelected ?? 8, 10));
    if (selected.length < 2) throw new Error(`El escáner solo encontró ${selected.length} activos válidos; se requieren al menos 2.`);

    const dataset: MultiAssetDataset = {
      timeframe: '1d',
      assets: selected.map(c => ({
        assetId: c.asset.assetId,
        ticker: c.asset.ticker,
        name: c.asset.name,
        currency: 'EUR',
        bars: c.response!.bars,
        provenance: c.response!.provenance
      }))
    };

    const rejectionCounts: Record<string, number> = {};
    for (const c of candidates.filter(c => c.status === 'REJECTED')) rejectionCounts[c.reason ?? 'UNKNOWN'] = (rejectionCounts[c.reason ?? 'UNKNOWN'] ?? 0) + 1;

    return {
      scanned: candidates.length,
      accepted: candidates.filter(c => c.status === 'ACCEPTED').length,
      rejected: candidates.filter(c => c.status === 'REJECTED').length,
      selected,
      candidates,
      dataset,
      rejectionCounts
    };
  }
}
