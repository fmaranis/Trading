import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';

export const OPEN_MARKET_DISCOVERY_V1 = 'OPEN_MARKET_DISCOVERY_V1' as const;

export type OpenMarketDiscoveryBreadth = 'BROAD' | 'SECTOR' | 'THEMATIC' | 'DEFENSIVE' | 'UNKNOWN';

export interface OpenMarketDiscoveryQuery {
  id: string;
  query: string;
  category: AssetUniverseCategory;
  breadth: OpenMarketDiscoveryBreadth;
  defensive?: boolean;
}

/**
 * Query families are structural discovery prompts, not a hand-picked security list.
 * Yahoo remains only a CURRENT/LIVE discovery provider. These searches must never
 * be replayed retrospectively and described as a point-in-time historical universe.
 */
export const OPEN_MARKET_DISCOVERY_V1_QUERIES: readonly OpenMarketDiscoveryQuery[] = [
  { id: 'GLOBAL', query: 'UCITS ETF world global all country', category: 'GLOBAL_EQUITY', breadth: 'BROAD' },
  { id: 'US', query: 'UCITS ETF S&P 500 USA', category: 'US_EQUITY', breadth: 'BROAD' },
  { id: 'EUROPE', query: 'UCITS ETF Europe broad market', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EM', query: 'UCITS ETF emerging markets', category: 'EMERGING_EQUITY', breadth: 'BROAD' },
  { id: 'JAPAN', query: 'UCITS ETF Japan broad market', category: 'JAPAN_EQUITY', breadth: 'BROAD' },
  { id: 'SMALL_CAP', query: 'UCITS ETF world small cap', category: 'SMALL_CAP', breadth: 'BROAD' },
  { id: 'TECH', query: 'UCITS ETF technology', category: 'TECHNOLOGY', breadth: 'SECTOR' },
  { id: 'HEALTH', query: 'UCITS ETF healthcare', category: 'HEALTHCARE', breadth: 'SECTOR' },
  { id: 'ENERGY', query: 'UCITS ETF energy', category: 'ENERGY', breadth: 'SECTOR' },
  { id: 'AGG_BOND', query: 'UCITS ETF global aggregate bond EUR hedged', category: 'AGG_BONDS', breadth: 'DEFENSIVE', defensive: true },
  { id: 'MONEY_MARKET', query: 'UCITS ETF EUR overnight money market', category: 'MONEY_MARKET', breadth: 'DEFENSIVE', defensive: true },
  { id: 'GOLD', query: 'physical gold ETC EUR', category: 'GOLD', breadth: 'DEFENSIVE', defensive: true }
] as const;

export interface OpenMarketDiscoveryV1Asset {
  asset: AssetUniverseItem;
  source: 'YAHOO_LIVE_QUERY_SWEEP';
  queryFamily: string;
  breadth: OpenMarketDiscoveryBreadth;
  discoveredAt: string;
  quoteType: string;
  exchange: string | null;
  historyBars3y: number;
  historicalPointInTimeSafe: false;
}

export interface OpenMarketDiscoveryV1Snapshot {
  version: typeof OPEN_MARKET_DISCOVERY_V1;
  generatedAt: string;
  source: 'YAHOO_LIVE_QUERY_SWEEP';
  historicalPointInTimeSafe: false;
  queryCount: number;
  rawCandidates: number;
  acceptedEurCandidates: number;
  assets: OpenMarketDiscoveryV1Asset[];
  limitations: readonly string[];
}

function normalizedKey(asset: AssetUniverseItem): string {
  return String(asset.isin || asset.ticker).trim().toUpperCase();
}

export function mergeOpenMarketAssets(
  base: readonly AssetUniverseItem[],
  discovered: readonly OpenMarketDiscoveryV1Asset[]
): AssetUniverseItem[] {
  const byKey = new Map<string, AssetUniverseItem>();
  for (const asset of base) byKey.set(normalizedKey(asset), asset);
  for (const row of discovered) {
    const key = normalizedKey(row.asset);
    if (!byKey.has(key)) byKey.set(key, row.asset);
  }
  return [...byKey.values()];
}

/**
 * Historical availability boundary for a known catalogue.
 * An instrument cannot participate before enough REAL bars actually existed.
 * This removes pre-listing look-ahead, but it does NOT solve catalogue
 * survivorship. A full historical open-market claim requires a point-in-time
 * instrument master including delistings; V1 reports that limitation explicitly.
 */
export function historicallyAvailableAssetIds(
  dataset: MultiAssetDataset,
  decisionDate: string,
  minimumBars: number
): Set<string> {
  const ids = new Set<string>();
  for (const series of dataset.assets) {
    let count = 0;
    for (const bar of series.bars) {
      if (bar.timestamp.slice(0, 10) <= decisionDate && Number.isFinite(bar.close) && bar.close > 0) count++;
    }
    if (count >= minimumBars) ids.add(series.assetId);
  }
  return ids;
}

export function filterCatalogByHistoricalAvailability(
  catalog: readonly AssetUniverseItem[],
  dataset: MultiAssetDataset,
  decisionDate: string,
  minimumBars: number
): AssetUniverseItem[] {
  const available = historicallyAvailableAssetIds(dataset, decisionDate, minimumBars);
  return catalog.filter(asset => available.has(asset.assetId));
}

export const OPEN_MARKET_DISCOVERY_V1_LIMITATIONS = [
  'Yahoo query search is a current/live discovery source and is not point-in-time historical instrument-master data.',
  'Historical replay may use only a frozen catalogue plus REAL bars available by each decision date; it must not call current Yahoo search to invent the past universe.',
  'Pre-listing look-ahead is blocked by minimum historical bars at the decision date.',
  'Survivorship bias is not fully removed until a provider supplies point-in-time listings and delistings; V1 must label historical coverage accordingly.',
  'Discovery proposes candidates only. AssetUniverseScanner and PortfolioCandidateGate retain their existing authority.'
] as const;
