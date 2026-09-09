import assert from 'node:assert/strict';
import {
  mergeOpenMarketAssets,
  type OpenMarketDiscoveryV1Asset
} from '../src/investment/decision/openMarketDiscoveryV1';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';

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

// Existing seed is preserved exactly; obvious cross-listings do not create new
// Top64 candidates, even when Yahoo uses another exchange suffix or truncates the
// product name.
assert.deepEqual(merged.slice(0, base.length), base);
assert.equal(merged.some(row => row.assetId === 'OPEN_VUSA_AS'), false);
assert.equal(merged.some(row => row.assetId === 'OPEN_XEON_MI'), false);
assert.equal(merged.some(row => row.assetId === 'OPEN_IWDA_AS'), false);

// Same ticker root on different exchanges is NOT sufficient by itself: SAN.MC
// (Santander) and SAN.PA (Sanofi) are distinct economic instruments.
assert.equal(merged.some(row => row.assetId === 'OPEN_SAN_PA'), true);
assert.equal(merged.some(row => row.assetId === 'OPEN_NEW_AS'), true);
assert.equal(merged.length, base.length + 2);

console.log('openMarketDiscoveryEconomicIdentity.unit: PASS');
