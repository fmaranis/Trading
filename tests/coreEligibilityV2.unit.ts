import assert from 'node:assert/strict';
import {
  CORE_ELIGIBILITY_V2,
  CORE_ELIGIBILITY_V2_POLICY,
  assessCoreEligibilityV2,
  auditCoreEligibilityV2
} from '../src/investment/decision/coreEligibilityV2';
import type { AssetScanCandidate } from '../src/investment/decision/assetUniverseScanner';
import type { OpenMarketDiscoveryV1Asset } from '../src/investment/decision/openMarketDiscoveryV1';

function series(assetId: string, volume = 10_000): any {
  return {
    assetId,
    ticker: `${assetId}.DE`,
    name: assetId,
    currency: 'EUR',
    provenance: { sourceType: 'REAL', provider: 'test', isReproducible: true },
    bars: Array.from({ length: 60 }, (_, index) => ({ timestamp: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`, open: 100, high: 101, low: 99, close: 100, volume }))
  };
}

function candidate(assetId: string, category: any = 'GLOBAL_EQUITY', overrides: Partial<AssetScanCandidate> = {}): AssetScanCandidate {
  return {
    asset: { assetId, ticker: `${assetId}.DE`, name: assetId, category, currency: 'EUR' },
    status: 'ACCEPTED',
    bars: 900,
    asOfDate: '2026-09-01',
    lastClose: 100,
    momentum20Pct: 1,
    momentum60Pct: 2,
    momentum120Pct: 3,
    annualizedVolatilityPct: 15,
    maxDrawdownPct: 12,
    score: 1,
    response: { bars: [], provenance: { sourceType: 'REAL', isReproducible: true }, metadata: { currency: 'EUR' } },
    ...overrides
  } as AssetScanCandidate;
}

assert.equal(CORE_ELIGIBILITY_V2, 'CORE_ELIGIBILITY_V2');
assert.equal(CORE_ELIGIBILITY_V2_POLICY.minimumHistoryBars, 756);
assert.equal(CORE_ELIGIBILITY_V2_POLICY.requiredProvenance, 'REAL');

const broad = assessCoreEligibilityV2({ candidate: candidate('CORE'), series: series('CORE') });
assert.equal(broad.status, 'CORE_ELIGIBLE');
assert.equal(broad.scope, 'GLOBAL_BROAD');
assert.equal(broad.liquidityEvidence, 'PASS');

const single = assessCoreEligibilityV2({ candidate: candidate('EQ_SINGLE'), series: series('EQ_SINGLE') });
assert.equal(single.status, 'REJECTED');
assert.ok(single.reasons.includes('SINGLE_EQUITY_NOT_CORE'));

const sector = assessCoreEligibilityV2({ candidate: candidate('SECTOR', 'TECHNOLOGY'), series: series('SECTOR') });
assert.equal(sector.status, 'REJECTED');
assert.ok(sector.reasons.includes('NOT_BROAD_CORE_CATEGORY'));

const shortHistory = assessCoreEligibilityV2({ candidate: candidate('SHORT', 'GLOBAL_EQUITY', { bars: 500 }), series: series('SHORT') });
assert.equal(shortHistory.status, 'REJECTED');
assert.ok(shortHistory.reasons.includes('INSUFFICIENT_3Y_HISTORY'));

const unknownOpen = assessCoreEligibilityV2({ candidate: candidate('OPEN_UNKNOWN'), series: series('OPEN_UNKNOWN') });
assert.equal(unknownOpen.status, 'REVIEW_REQUIRED');
assert.ok(unknownOpen.reasons.includes('DISCOVERED_STRUCTURE_METADATA_MISSING'));

const discoveredBroad: OpenMarketDiscoveryV1Asset = {
  asset: candidate('OPEN_BROAD').asset,
  source: 'YAHOO_LIVE_QUERY_SWEEP',
  queryFamily: 'GLOBAL',
  breadth: 'BROAD',
  discoveredAt: '2026-09-07T00:00:00Z',
  quoteType: 'ETF',
  exchange: 'XETRA',
  historyBars3y: 900,
  historicalPointInTimeSafe: false
};
const openBroad = assessCoreEligibilityV2({ candidate: candidate('OPEN_BROAD'), series: series('OPEN_BROAD'), discovery: discoveredBroad });
assert.equal(openBroad.status, 'CORE_ELIGIBLE');

const discoveredSector: OpenMarketDiscoveryV1Asset = { ...discoveredBroad, asset: candidate('OPEN_TECH', 'TECHNOLOGY').asset, breadth: 'SECTOR', queryFamily: 'TECH' };
const openSector = assessCoreEligibilityV2({ candidate: candidate('OPEN_TECH', 'TECHNOLOGY'), series: series('OPEN_TECH'), discovery: discoveredSector });
assert.equal(openSector.status, 'REJECTED');

const illiquid = assessCoreEligibilityV2({ candidate: candidate('ILLIQUID'), series: series('ILLIQUID', 0) });
assert.equal(illiquid.status, 'REJECTED');
assert.equal(illiquid.liquidityEvidence, 'FAIL');

const fundCandidate = candidate('FUND', 'GLOBAL_EQUITY', { asset: { assetId: 'FUND', ticker: 'IE0000000002', isin: 'IE0000000002', name: 'Fund', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' } });
const fund = assessCoreEligibilityV2({ candidate: fundCandidate, series: { ...series('FUND', 0), ticker: 'IE0000000002' } });
assert.equal(fund.status, 'CORE_ELIGIBLE');
assert.equal(fund.liquidityEvidence, 'FUND_NAV_NOT_EXCHANGE_VOLUME');

const report = auditCoreEligibilityV2({ candidates: [candidate('CORE'), candidate('EQ_SINGLE')], dataset: { timeframe: '1d', assets: [series('CORE'), series('EQ_SINGLE')] } as any });
assert.equal(report.mode, 'SHADOW_AUDIT_NOT_PRODUCTION_GATE');
assert.equal(report.eligible, 1);
assert.equal(report.rejected, 1);

console.log('coreEligibilityV2.unit: PASS');
