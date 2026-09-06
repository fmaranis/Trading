import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';

export type PortfolioAssetRole =
  | 'STRATEGIC_GROWTH_CORE'
  | 'DIVERSIFIED_SLEEVE'
  | 'TACTICAL_SATELLITE';

/**
 * Canonical long-run growth-core membership used across portfolio policies.
 *
 * Membership is intentionally explicit and restricted to broad global / developed
 * world exposure. Regional indexes (US, Europe, Japan, Emerging) are diversified
 * sleeves/tilts, not structural substitutes for the whole global core.
 *
 * IMPORTANT: being a member of this set does NOT make a product the preferred
 * production core. Production allocation is selected causally by
 * DYNAMIC_CORE_SELECTOR_V1.
 */
export const STRATEGIC_GROWTH_CORE_ASSET_IDS = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'VWCE',
  'EUNL',
  'IWDA'
] as const;

/**
 * Deterministic reference order retained only for research/diagnostic modules
 * that need one broad-market series when no portfolio decision state exists.
 *
 * @deprecated Production portfolio allocation MUST NOT use this array. The live
 * and replay decision path uses DYNAMIC_CORE_SELECTOR_V1 instead.
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
