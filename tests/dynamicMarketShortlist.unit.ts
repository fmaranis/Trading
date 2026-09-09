import assert from 'node:assert/strict';
import {
  rankDynamicMarketShortlist,
  type AssetScanCandidate
} from '../src/investment/decision/assetUniverseScanner';
import {
  DYNAMIC_MARKET_SHORTLIST_TARGET,
  FIXED_PRODUCT_UNIVERSE_FORBIDDEN,
  PRODUCT_MARKET_UNIVERSE_MODE
} from '../src/investment/decision/portfolioDiscoveryUniverse';
import {
  mergeOpenMarketAssets,
  type OpenMarketDiscoveryV1Asset
} from '../src/investment/decision/openMarketDiscoveryV1';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';

function candidate(index: number, input: {
  score?: number;
  reliability?: number;
  opportunity?: number;
  status?: 'ACCEPTED' | 'REJECTED';
  ticker?: string;
} = {}): AssetScanCandidate {
  return {
    asset: {
      assetId: `TEST_${index}`,
      ticker: input.ticker ?? `TEST${String(index).padStart(3, '0')}.DE`,
      name: `Test ${index}`,
      category: 'EUROPE_EQUITY',
      currency: 'EUR'
    },
    status: input.status ?? 'ACCEPTED',
    bars: 300,
    asOfDate: '2026-09-09',
    lastClose: 100,
    momentum20Pct: 1,
    momentum60Pct: 2,
    momentum120Pct: 3,
    annualizedVolatilityPct: 15,
    maxDrawdownPct: 10,
    reliabilityScore: input.reliability ?? 60,
    opportunityScore: input.opportunity ?? 60,
    currentDrawdownPct: -2,
    positiveRolling60Pct: 60,
    positiveRolling120Pct: 60,
    score: input.score ?? 100 - index
  };
}

function discovered(asset: AssetUniverseItem): OpenMarketDiscoveryV1Asset {
  return {
    asset,
    source: 'YAHOO_LIVE_QUERY_SWEEP',
    queryFamily: 'TEST',
    breadth: 'BROAD',
    discoveredAt: '2026-09-09T00:00:00.000Z',
    quoteType: 'ETF',
    exchange: null,
    historyBars3y: 756,
    historicalPointInTimeSafe: false
  };
}

assert.equal(PRODUCT_MARKET_UNIVERSE_MODE, 'DYNAMIC_CURRENT_DISCOVERY');
assert.equal(DYNAMIC_MARKET_SHORTLIST_TARGET, 64);
assert.equal(FIXED_PRODUCT_UNIVERSE_FORBIDDEN, true);

// Top 64 is a ranking cap, not a category whitelist: sixty-four candidates from
// the same category may remain in the discovery shortlist. Diversification is a
// later PortfolioCandidateGate / allocator responsibility.
const sameCategoryPool = Array.from({ length: 80 }, (_, index) => candidate(index));
const top64 = rankDynamicMarketShortlist(sameCategoryPool, DYNAMIC_MARKET_SHORTLIST_TARGET);
assert.equal(top64.length, 64);
assert.equal(top64[0].asset.assetId, 'TEST_0');
assert.equal(top64.at(-1)?.asset.assetId, 'TEST_63');
assert.equal(new Set(top64.map(row => row.asset.category)).size, 1);
assert.equal(top64.some(row => row.asset.assetId === 'TEST_64'), false);

// Rejected/data-invalid candidates never enter the shortlist even with a very
// high synthetic test score. Fewer than 64 valid candidates means fewer rows;
// the scanner never fills the list with lower-quality invalid instruments.
const sparse = [
  candidate(100, { score: 1000, status: 'REJECTED' }),
  candidate(101, { score: 10 }),
  candidate(102, { score: 9 })
];
const sparseRanked = rankDynamicMarketShortlist(sparse, 64);
assert.deepEqual(sparseRanked.map(row => row.asset.assetId), ['TEST_101', 'TEST_102']);

// The production scanner score remains primary so this architectural change
// does not silently promote QUALITY_V1. Reliability and Opportunity only make
// deterministic ties stable before the ticker fallback.
const tied = [
  candidate(200, { score: 5, reliability: 70, opportunity: 60, ticker: 'BBB.DE' }),
  candidate(201, { score: 5, reliability: 80, opportunity: 40, ticker: 'CCC.DE' }),
  candidate(202, { score: 5, reliability: 80, opportunity: 50, ticker: 'DDD.DE' }),
  candidate(203, { score: 5, reliability: 80, opportunity: 50, ticker: 'AAA.DE' })
];
const tiedRanked = rankDynamicMarketShortlist(tied, 64);
assert.deepEqual(tiedRanked.map(row => row.asset.ticker), ['AAA.DE', 'DDD.DE', 'CCC.DE', 'BBB.DE']);

// Caller requests cannot make the canonical shortlist larger than 64.
assert.equal(rankDynamicMarketShortlist(sameCategoryPool, 999).length, 64);

// Discovery ranks economic instruments, not duplicate exchange listings. The
// seed remains untouched, but obvious aliases of an existing product must not
// consume another Top64 slot or later receive a second allocation.
const base: AssetUniverseItem[] = [
  { assetId: 'VUSA', ticker: 'VUSA.DE', name: 'Vanguard S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'XEON', ticker: 'XEON.DE', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: 'SANTANDER', ticker: 'SAN.MC', name: 'Banco Santander', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'WORLD_DE', ticker: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' }
];
const merged = mergeOpenMarketAssets(base, [
  discovered({ assetId: 'OPEN_VUSA_AS', ticker: 'VUSA.AS', name: 'Vanguard S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' }),
  discovered({ assetId: 'OPEN_XEON_MI', ticker: 'XEON.MI', name: 'XTRACKERS II EUR OVNI RATE SWA ', category: 'MONEY_MARKET', currency: 'EUR', defensive: true }),
  discovered({ assetId: 'OPEN_IWDA_AS', ticker: 'IWDA.AS', name: 'iShares Core MSCI World UCITS E', category: 'GLOBAL_EQUITY', currency: 'EUR' }),
  discovered({ assetId: 'OPEN_SAN_PA', ticker: 'SAN.PA', name: 'Sanofi', category: 'HEALTHCARE', currency: 'EUR' }),
  discovered({ assetId: 'OPEN_NEW_AS', ticker: 'NEW.AS', name: 'Distinct New Asset', category: 'EUROPE_EQUITY', currency: 'EUR' })
]);
assert.deepEqual(merged.slice(0, base.length), base);
assert.equal(merged.some(row => row.assetId === 'OPEN_VUSA_AS'), false);
assert.equal(merged.some(row => row.assetId === 'OPEN_XEON_MI'), false);
assert.equal(merged.some(row => row.assetId === 'OPEN_IWDA_AS'), false);
// Same root is not enough to merge unrelated instruments: Santander SAN.MC and
// Sanofi SAN.PA remain separate because their names/economic identities differ.
assert.equal(merged.some(row => row.assetId === 'OPEN_SAN_PA'), true);
assert.equal(merged.some(row => row.assetId === 'OPEN_NEW_AS'), true);
assert.equal(merged.length, base.length + 2);

console.log('dynamicMarketShortlist.unit: PASS');
