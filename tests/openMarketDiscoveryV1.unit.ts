import assert from 'node:assert/strict';
import {
  OPEN_MARKET_DISCOVERY_V1,
  OPEN_MARKET_DISCOVERY_V1_LIMITATIONS,
  OPEN_MARKET_DISCOVERY_V1_QUERIES,
  filterCatalogByHistoricalAvailability,
  mergeOpenMarketAssets,
  type OpenMarketDiscoveryV1Asset
} from '../src/investment/decision/openMarketDiscoveryV1';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';

assert.equal(OPEN_MARKET_DISCOVERY_V1, 'OPEN_MARKET_DISCOVERY_V1');
assert.ok(OPEN_MARKET_DISCOVERY_V1_QUERIES.length >= 10, 'Discovery must sweep structural market families, not one hand-picked query.');
for (const row of OPEN_MARKET_DISCOVERY_V1_QUERIES) {
  assert.ok(row.query.length >= 4);
  assert.doesNotMatch(row.query, /\b[A-Z0-9]{2,8}\.(DE|PA|AS|MI|MC)\b/i, 'Structural discovery query must not hard-code a listed ticker.');
  assert.doesNotMatch(row.query, /^[A-Z]{2}[A-Z0-9]{10}$/i, 'Structural discovery query must not hard-code an ISIN.');
}
assert.ok(OPEN_MARKET_DISCOVERY_V1_LIMITATIONS.some(note => /point-in-time/i.test(note)));
assert.ok(OPEN_MARKET_DISCOVERY_V1_LIMITATIONS.some(note => /survivorship/i.test(note)));
assert.ok(OPEN_MARKET_DISCOVERY_V1_LIMITATIONS.some(note => /must not call current Yahoo search/i.test(note)));

// The established catalogue may intentionally contain multiple exchange aliases
// for the same ISIN. Discovery must never shrink or rewrite that base catalogue.
const base: AssetUniverseItem[] = [
  { assetId: 'BASE_A', ticker: 'AAA.DE', isin: 'IE0000000001', name: 'Base A', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'BASE_B', ticker: 'AAA.MI', isin: 'IE0000000001', name: 'Base B alias', category: 'GLOBAL_EQUITY', currency: 'EUR' }
];
const discovered: OpenMarketDiscoveryV1Asset[] = [
  {
    asset: { assetId: 'OPEN_DUP', ticker: 'AAA2.DE', isin: 'IE0000000001', name: 'Duplicate ISIN', category: 'GLOBAL_EQUITY', currency: 'EUR' },
    source: 'YAHOO_LIVE_QUERY_SWEEP', queryFamily: 'GLOBAL', breadth: 'BROAD', discoveredAt: '2026-09-07T00:00:00Z', quoteType: 'ETF', exchange: 'XETRA', historyBars3y: 756, historicalPointInTimeSafe: false
  },
  {
    asset: { assetId: 'OPEN_NEW', ticker: 'BBB.DE', name: 'New', category: 'US_EQUITY', currency: 'EUR' },
    source: 'YAHOO_LIVE_QUERY_SWEEP', queryFamily: 'US', breadth: 'BROAD', discoveredAt: '2026-09-07T00:00:00Z', quoteType: 'ETF', exchange: 'XETRA', historyBars3y: 756, historicalPointInTimeSafe: false
  },
  {
    asset: { assetId: 'OPEN_NEW_DUP', ticker: 'BBB.DE', name: 'Repeated new', category: 'US_EQUITY', currency: 'EUR' },
    source: 'YAHOO_LIVE_QUERY_SWEEP', queryFamily: 'US', breadth: 'BROAD', discoveredAt: '2026-09-07T00:00:00Z', quoteType: 'ETF', exchange: 'XETRA', historyBars3y: 756, historicalPointInTimeSafe: false
  }
];
const merged = mergeOpenMarketAssets(base, discovered);
assert.deepEqual(merged.map(row => row.assetId), ['BASE_A', 'BASE_B', 'OPEN_NEW']);
assert.equal(merged.length, base.length + 1, 'Open discovery must be strictly additive to the existing catalogue.');
assert.deepEqual(merged.slice(0, base.length), base, 'Base catalogue order/content must remain unchanged.');

const catalog: AssetUniverseItem[] = [
  { assetId: 'OLD', ticker: 'OLD.DE', name: 'Old', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'NEW', ticker: 'NEW.DE', name: 'New', category: 'GLOBAL_EQUITY', currency: 'EUR' }
];
const dataset: any = {
  timeframe: '1d',
  assets: [
    { assetId: 'OLD', ticker: 'OLD.DE', name: 'Old', currency: 'EUR', provenance: { sourceType: 'REAL' }, bars: [
      { timestamp: '2020-01-01T00:00:00Z', close: 1 },
      { timestamp: '2020-01-02T00:00:00Z', close: 1 },
      { timestamp: '2020-01-03T00:00:00Z', close: 1 },
      { timestamp: '2020-01-06T00:00:00Z', close: 1 },
      { timestamp: '2020-01-07T00:00:00Z', close: 1 }
    ] },
    { assetId: 'NEW', ticker: 'NEW.DE', name: 'New', currency: 'EUR', provenance: { sourceType: 'REAL' }, bars: [
      { timestamp: '2020-01-06T00:00:00Z', close: 1 },
      { timestamp: '2020-01-07T00:00:00Z', close: 1 }
    ] }
  ]
};
assert.deepEqual(filterCatalogByHistoricalAvailability(catalog, dataset, '2020-01-07', 5).map(row => row.assetId), ['OLD']);
assert.deepEqual(filterCatalogByHistoricalAvailability(catalog, dataset, '2020-01-02', 2).map(row => row.assetId), ['OLD']);

console.log('openMarketDiscoveryV1.unit: PASS');
