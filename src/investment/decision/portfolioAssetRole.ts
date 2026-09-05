import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';

export type PortfolioAssetRole =
  | 'STRATEGIC_GROWTH_CORE'
  | 'DIVERSIFIED_SLEEVE'
  | 'TACTICAL_SATELLITE';

/**
 * Canonical long-run growth core used across portfolio management policies.
 *
 * Membership is intentionally explicit and restricted to broad global / developed
 * world exposure. Regional indexes (US, Europe, Japan, Emerging) are diversified
 * sleeves/tilts, not structural substitutes for the whole global core. This keeps
 * tactical relative-strength decisions from silently turning a regional winner
 * into the user's entire long-run market exposure.
 */
export const STRATEGIC_GROWTH_CORE_ASSET_IDS = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'VWCE',
  'EUNL',
  'IWDA'
] as const;

/**
 * Preferred destination order for CORE_GATE. This is a subset/order of the
 * strategic core, not a second definition of what the core is. Mutual funds are
 * preferred where the product is available because eligible fund-to-fund changes
 * can preserve Spanish tax deferral; no performance-chasing transfer is implied.
 */
export const STRATEGIC_GROWTH_CORE_PRIORITY = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'VWCE',
  'EUNL',
  'IWDA'
] as const;

const strategicGrowthCoreSet = new Set<string>(STRATEGIC_GROWTH_CORE_ASSET_IDS);

const DIVERSIFIED_SLEEVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GLOBAL_EQUITY',
  'US_EQUITY',
  'EUROPE_EQUITY',
  'JAPAN_EQUITY',
  'EMERGING_EQUITY',
  'SMALL_CAP',
  'DIVIDEND',
  'GOV_BONDS',
  'CORP_BONDS',
  'AGG_BONDS',
  'MONEY_MARKET',
  'GOLD',
  'COMMODITIES'
]);

export function isStrategicGrowthCoreAssetId(assetId: string | null | undefined): boolean {
  return Boolean(assetId && strategicGrowthCoreSet.has(assetId.toUpperCase()));
}

export function portfolioAssetRole(input: {
  assetId?: string | null;
  category?: AssetUniverseCategory | null;
} | Pick<AssetUniverseItem, 'assetId' | 'category'>): PortfolioAssetRole {
  if (isStrategicGrowthCoreAssetId(input.assetId)) return 'STRATEGIC_GROWTH_CORE';
  if (input.category && DIVERSIFIED_SLEEVE_CATEGORIES.has(input.category)) return 'DIVERSIFIED_SLEEVE';
  return 'TACTICAL_SATELLITE';
}

export function isStrategicGrowthCoreRole(role: PortfolioAssetRole | null | undefined): boolean {
  return role === 'STRATEGIC_GROWTH_CORE';
}
