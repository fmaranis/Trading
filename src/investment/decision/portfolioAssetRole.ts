import type { AssetUniverseCategory, AssetUniverseItem } from './assetUniverse';

export type PortfolioAssetRole =
  | 'STRATEGIC_GROWTH_CORE'
  | 'DIVERSIFIED_SLEEVE'
  | 'TACTICAL_SATELLITE';

/**
 * Canonical long-run growth core used across portfolio management policies.
 *
 * Membership is intentionally explicit rather than inferred from a broad
 * category. A GLOBAL_EQUITY or US_EQUITY label alone is not enough to make an
 * instrument untouchable: factor, thematic and holdout products can share the
 * same category while serving a different portfolio role.
 */
export const STRATEGIC_GROWTH_CORE_ASSET_IDS = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'FUND_VANGUARD_US500',
  'VWCE',
  'EUNL',
  'IWDA',
  'SXR8',
  'VUSA'
] as const;

/**
 * Preferred destination order for CORE_GATE. This is a subset/order of the
 * strategic core, not a second definition of what the core is.
 */
export const STRATEGIC_GROWTH_CORE_PRIORITY = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'EUNL',
  'IWDA',
  'SXR8',
  'VUSA'
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
