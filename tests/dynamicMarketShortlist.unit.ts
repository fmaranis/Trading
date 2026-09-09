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

console.log('dynamicMarketShortlist.unit: PASS');
