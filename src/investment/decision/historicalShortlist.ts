import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';

function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const a = prices[prices.length - 1 - lookback], b = prices.at(-1)!;
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
  let peak = slice[0], max = 0;
  for (const p of slice) { peak = Math.max(peak, p); if (peak > 0) max = Math.max(max, (peak - p) / peak * 100); }
  return max;
}
function score(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null, defensive: boolean): number {
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  return momentum - riskPenalty + (defensive ? 2.5 : 0);
}

export interface HistoricalShortlistResult {
  dataset: MultiAssetDataset;
  eligibleAssetIds: string[];
  selectedAssetIds: string[];
}

export function buildHistoricalShortlist(input: { dataset: MultiAssetDataset; catalog: AssetUniverseItem[]; requestedDate: string; minimumBars?: number; maxSelected?: number }): HistoricalShortlistResult {
  const minimumBars = input.minimumBars ?? 252;
  const catalogById = new Map(input.catalog.map(a => [a.assetId, a]));
  const eligible = input.dataset.assets.map(asset => ({ ...asset, bars: asset.bars.filter(bar => bar.timestamp.slice(0, 10) <= input.requestedDate) })).filter(asset => asset.bars.length >= minimumBars);
  const ranked = eligible.map(asset => {
    const prices = asset.bars.map(b => b.close);
    const catalog = catalogById.get(asset.assetId);
    return { asset, category: catalog?.category ?? `UNKNOWN_${asset.assetId}`, defensive: Boolean(catalog?.defensive), score: score(pctReturn(prices, 20), pctReturn(prices, 60), pctReturn(prices, 120), annualizedVolatility(prices), maxDrawdown(prices), Boolean(catalog?.defensive)) };
  }).sort((a, b) => b.score - a.score);

  const selected: typeof ranked = [];
  const usedCategories = new Set<string>();
  const bestDefensive = ranked.find(x => x.defensive);
  if (bestDefensive) { selected.push(bestDefensive); usedCategories.add(bestDefensive.category); }
  for (const row of ranked) {
    if (selected.length >= Math.min(input.maxSelected ?? 8, 10)) break;
    if (selected.some(x => x.asset.assetId === row.asset.assetId) || usedCategories.has(row.category)) continue;
    selected.push(row); usedCategories.add(row.category);
  }
  return {
    dataset: { ...input.dataset, assets: selected.map(x => x.asset) },
    eligibleAssetIds: eligible.map(x => x.assetId),
    selectedAssetIds: selected.map(x => x.asset.assetId)
  };
}
