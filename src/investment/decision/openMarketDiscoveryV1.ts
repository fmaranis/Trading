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
 * Structural CURRENT/LIVE discovery prompts, never a hand-picked security list.
 * The sweep deliberately includes both collective instruments and listed equity
 * families so the operational candidate pool can change with the market.
 *
 * Yahoo Search/Lookup is not a complete instrument master. These rules broaden
 * the current candidate pool but must never be described as an exhaustive census
 * of every investable security, nor replayed retrospectively as a historical universe.
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
  { id: 'GOLD', query: 'physical gold ETC EUR', category: 'GOLD', breadth: 'DEFENSIVE', defensive: true },
  { id: 'EQ_EUROPE_LARGE', query: 'Europe large cap stock EUR', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_GERMANY', query: 'Germany DAX stock Xetra', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_FRANCE', query: 'France CAC 40 stock Euronext Paris', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_SPAIN', query: 'Spain IBEX 35 stock Madrid', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_ITALY', query: 'Italy FTSE MIB stock Milan', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_NETHERLANDS', query: 'Netherlands AEX stock Amsterdam', category: 'EUROPE_EQUITY', breadth: 'BROAD' },
  { id: 'EQ_TECH', query: 'European technology stock EUR', category: 'TECHNOLOGY', breadth: 'SECTOR' },
  { id: 'EQ_SEMICONDUCTORS', query: 'European semiconductor stock EUR', category: 'SEMICONDUCTORS', breadth: 'SECTOR' },
  { id: 'EQ_HEALTH', query: 'European healthcare stock EUR', category: 'HEALTHCARE', breadth: 'SECTOR' },
  { id: 'EQ_ENERGY', query: 'European energy stock EUR', category: 'ENERGY', breadth: 'SECTOR' },
  { id: 'EQ_DIVIDEND', query: 'European dividend stock EUR', category: 'DIVIDEND', breadth: 'SECTOR' },
  { id: 'EQ_US_EUR_LISTING', query: 'US mega cap stock EUR Germany', category: 'US_EQUITY', breadth: 'BROAD' }
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

function normalizedTicker(asset: AssetUniverseItem): string {
  return String(asset.ticker).trim().toUpperCase();
}
function normalizedIsin(asset: AssetUniverseItem): string | null {
  const value = String(asset.isin ?? '').trim().toUpperCase();
  return value || null;
}
function normalizedName(asset: AssetUniverseItem): string {
  return String(asset.name ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}
function tickerRoot(asset: AssetUniverseItem): string {
  const ticker = normalizedTicker(asset);
  const dot = ticker.lastIndexOf('.');
  return dot > 0 ? ticker.slice(0, dot) : ticker;
}
function nearSameProductName(a: AssetUniverseItem, b: AssetUniverseItem): boolean {
  const left = normalizedName(a);
  const right = normalizedName(b);
  if (left.length < 12 || right.length < 12) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 20 && longer.length - shorter.length <= 4 && longer.startsWith(shorter);
}
function sameEconomicListing(a: AssetUniverseItem, b: AssetUniverseItem): boolean {
  if (normalizedTicker(a) === normalizedTicker(b)) return true;
  const aIsin = normalizedIsin(a);
  const bIsin = normalizedIsin(b);
  if (aIsin && bIsin && aIsin === bIsin) return true;
  if (nearSameProductName(a, b)) return true;
  return tickerRoot(a) === tickerRoot(b)
    && normalizedName(a).slice(0, 12) === normalizedName(b).slice(0, 12)
    && normalizedName(a).length >= 12
    && normalizedName(b).length >= 12;
}

/**
 * Discovery is additive to the validated seed, but the operational pool must
 * represent economic instruments rather than multiple exchange aliases of the
 * same product. The base itself is preserved exactly for backward compatibility;
 * newly discovered rows are rejected when they duplicate an existing ticker,
 * ISIN, clearly identical product name, or a same-root cross-listing with the
 * same issuer/product-name prefix. This prevents e.g. VUSA.DE + VUSA.AS or
 * XEON.DE + XEON.MI from consuming two Top64 slots or receiving double allocation.
 */
export function mergeOpenMarketAssets(
  base: readonly AssetUniverseItem[],
  discovered: readonly OpenMarketDiscoveryV1Asset[]
): AssetUniverseItem[] {
  const merged = [...base];

  for (const row of discovered) {
    if (merged.some(existing => sameEconomicListing(existing, row.asset))) continue;
    merged.push(row.asset);
  }
  return merged;
}

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
  'Yahoo Search/Lookup is a current/live discovery source and is not point-in-time historical instrument-master data.',
  'The sweep is broad but not exhaustive; Top 64 means the best ranked candidates in the current discovered EUR-compatible pool, not a claim to have enumerated every global security.',
  'Current discovery deduplicates obvious cross-listed representations of the same economic instrument before ranking; provider-wide ISIN coverage is still incomplete.',
  'Historical replay may use only a frozen catalogue plus REAL bars available by each decision date; it must not call current Yahoo discovery to invent the past universe.',
  'Pre-listing look-ahead is blocked by minimum historical bars at the decision date.',
  'Survivorship bias is not fully removed until a provider supplies point-in-time listings and delistings; V1 must label historical coverage accordingly.',
  'Discovery proposes candidates only. AssetUniverseScanner and PortfolioCandidateGate retain their existing authority.'
] as const;
