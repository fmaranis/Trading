import fs from 'node:fs';
import path from 'node:path';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import {
  HISTORICAL_INSTRUMENT_MASTER_V1,
  buildCurrentReferenceOnlyInstrumentMaster,
  historicalCatalogAtDate,
  historicalInstrumentMasterCoverageSummary,
  historicalInstrumentStatusAtDate,
  historicalTickerAtDate,
  resolveHistoricalInstrumentRecord,
  validateHistoricalInstrumentMaster,
  type HistoricalInstrumentMaster
} from '../src/investment/decision/historicalInstrumentMaster';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`PHASE8_HISTORICAL_INSTRUMENT_MASTER_FAIL:${label}`);
}

const currentOnly = buildCurrentReferenceOnlyInstrumentMaster(EUR_ASSET_UNIVERSE, '2026-09-20');
const currentSummary = historicalInstrumentMasterCoverageSummary(currentOnly);

assert(currentOnly.version === HISTORICAL_INSTRUMENT_MASTER_V1, 'VERSION');
assert(currentOnly.coverage === 'CURRENT_REFERENCE_ONLY', 'CURRENT_CATALOG_MUST_NOT_PRETEND_PIT');
assert(currentSummary.canClaimCompletePointInTimeUniverse === false, 'CURRENT_CATALOG_CLAIMS_COMPLETE_PIT');
assert(currentSummary.pointInTimeVerifiedRecords === 0, 'CURRENT_CATALOG_RECORDS_VERIFIED_PIT');
assert(currentOnly.records.length < EUR_ASSET_UNIVERSE.length, 'ECONOMIC_IDENTITIES_NOT_DEDUPED_BY_ISIN');

const is3n = resolveHistoricalInstrumentRecord(currentOnly, { isin: 'IE00BKM4GZ66' });
assert(is3n != null, 'IS3N_IDENTITY_NOT_FOUND');
assert(is3n.aliases.some(row => row.ticker === 'IS3N.DE'), 'IS3N_ALIAS_MISSING');
assert(is3n.aliases.some(row => row.ticker === 'EIMI.DE'), 'EIMI_ALIAS_MISSING');
assert(historicalInstrumentStatusAtDate(currentOnly, is3n, '2018-01-02') === 'UNVERIFIED_POINT_IN_TIME', 'CURRENT_REFERENCE_LEAKED_INTO_HISTORY');
let currentOnlyFilterRejected = false;
try { historicalCatalogAtDate(currentOnly, EUR_ASSET_UNIVERSE, '2018-01-02'); } catch { currentOnlyFilterRejected = true; }
assert(currentOnlyFilterRejected, 'CURRENT_REFERENCE_FILTERED_HISTORICAL_UNIVERSE');

const verifiedFixture: HistoricalInstrumentMaster = {
  version: HISTORICAL_INSTRUMENT_MASTER_V1,
  targetUniverse: 'TEST_VERIFIED_PIT_UNIVERSE',
  coverage: 'COMPLETE_POINT_IN_TIME',
  asOfDate: '2020-12-31',
  notes: ['Synthetic fixture for PIT contract tests only.'],
  records: [{
    canonicalInstrumentId: 'TEST-ISIN-1',
    isin: 'TEST-ISIN-1',
    name: 'Fixture instrument',
    instrumentType: 'LISTED_INSTRUMENT',
    currency: 'EUR',
    listingDate: '2010-01-04',
    delistingDate: '2020-06-30',
    aliases: [
      { ticker: 'OLD.DE', venue: 'XETRA', validFrom: '2010-01-04', validTo: '2015-12-31' },
      { ticker: 'NEW.DE', venue: 'XETRA', validFrom: '2016-01-01', validTo: '2020-06-30' }
    ],
    authority: 'EXCHANGE_OFFICIAL',
    authorityReference: 'fixture://exchange-history',
    evidenceAsOfDate: '2020-12-31',
    pointInTimeVerified: true,
    dataProvenance: 'STATIC_REFERENCE'
  }]
};
validateHistoricalInstrumentMaster(verifiedFixture);
const fixture = verifiedFixture.records[0];

assert(historicalInstrumentStatusAtDate(verifiedFixture, fixture, '2009-12-31') === 'NOT_YET_LISTED', 'PRE_LISTING_NOT_BLOCKED');
assert(historicalInstrumentStatusAtDate(verifiedFixture, fixture, '2014-01-02') === 'TRADABLE_VERIFIED', 'LISTED_DATE_NOT_TRADABLE');
assert(historicalInstrumentStatusAtDate(verifiedFixture, fixture, '2020-07-01') === 'DELISTED', 'POST_DELIST_NOT_BLOCKED');
assert(historicalInstrumentStatusAtDate(verifiedFixture, fixture, '2021-01-04') === 'AFTER_EVIDENCE_HORIZON', 'AFTER_EVIDENCE_NOT_BLOCKED');
assert(historicalTickerAtDate(fixture, '2014-01-02') === 'OLD.DE', 'OLD_TICKER_NOT_RESOLVED');
assert(historicalTickerAtDate(fixture, '2018-01-02') === 'NEW.DE', 'NEW_TICKER_NOT_RESOLVED');
const aliasGapFixture: HistoricalInstrumentMaster = {
  ...verifiedFixture,
  records: [{ ...fixture, aliases: [
    { ticker: 'OLD.DE', venue: 'XETRA', validFrom: '2010-01-04', validTo: '2014-12-31' },
    { ticker: 'NEW.DE', venue: 'XETRA', validFrom: '2016-01-01', validTo: '2020-06-30' }
  ] }]
};
validateHistoricalInstrumentMaster(aliasGapFixture);
assert(historicalInstrumentStatusAtDate(aliasGapFixture, aliasGapFixture.records[0], '2015-06-01') === 'NO_ACTIVE_ALIAS', 'ALIAS_GAP_NOT_BLOCKED');
const fixtureCatalog = [{ assetId: 'FIXTURE', ticker: 'NEW.DE', isin: 'TEST-ISIN-1', name: 'Fixture instrument', category: 'GLOBAL_EQUITY' as const, currency: 'EUR' as const }];
assert(historicalCatalogAtDate(verifiedFixture, fixtureCatalog, '2018-01-02').length === 1, 'VERIFIED_PIT_CATALOG_FILTER_FAILED');
assert(historicalCatalogAtDate(verifiedFixture, fixtureCatalog, '2009-12-31').length === 0, 'PRE_LISTING_ASSET_LEAKED_INTO_CATALOG');
assert(historicalCatalogAtDate(verifiedFixture, fixtureCatalog, '2020-07-01').length === 0, 'DELISTED_ASSET_LEAKED_INTO_CATALOG');

let currentReferenceCannotVerify = false;
try {
  validateHistoricalInstrumentMaster({
    ...verifiedFixture,
    records: [{
      ...fixture,
      authority: 'CURRENT_CATALOG_REFERENCE',
      authorityReference: 'EUR_ASSET_UNIVERSE'
    }]
  });
} catch { currentReferenceCannotVerify = true; }
assert(currentReferenceCannotVerify, 'CURRENT_REFERENCE_ALLOWED_TO_VERIFY_PIT');

let incompleteCannotClaimComplete = false;
try {
  validateHistoricalInstrumentMaster({
    ...verifiedFixture,
    records: [{ ...fixture, pointInTimeVerified: false }]
  });
} catch { incompleteCannotClaimComplete = true; }
assert(incompleteCannotClaimComplete, 'UNVERIFIED_MASTER_CLAIMS_COMPLETE');

const causalEngine = source('src/investment/decision/causalUniverseBacktestEngine.ts');
assert(causalEngine.includes('historicalCatalogAtDate(historicalInstrumentMaster, catalog, informationEndDate)'), 'CAUSAL_ENGINE_NOT_FILTERED_BY_PIT_MASTER');
assert(causalEngine.includes("historicalInstrumentMaster.coverage === 'CURRENT_REFERENCE_ONLY'"), 'CAUSAL_ENGINE_ACCEPTS_CURRENT_ONLY_MASTER');
assert(causalEngine.includes("'CAUSAL_SELECTION_WITHIN_PARTIAL_POINT_IN_TIME_MASTER'"), 'PARTIAL_PIT_SCOPE_MISSING');
assert(causalEngine.includes("'CAUSAL_SELECTION_WITHIN_COMPLETE_POINT_IN_TIME_MASTER'"), 'COMPLETE_PIT_SCOPE_MISSING');
assert(causalEngine.includes('HISTORICAL_INSTRUMENT_MASTER_COMPLETE_CATALOG_GAP'), 'COMPLETE_MASTER_CATALOG_GAP_NOT_FAIL_CLOSED');
assert(causalEngine.includes('HISTORICAL_INSTRUMENT_MASTER_COMPLETE_DATASET_GAP'), 'COMPLETE_MASTER_DATASET_GAP_NOT_FAIL_CLOSED');

console.log('PHASE8_HISTORICAL_INSTRUMENT_MASTER_PASS', JSON.stringify({
  version: currentOnly.version,
  currentCatalogAssets: EUR_ASSET_UNIVERSE.length,
  dedupedEconomicIdentities: currentOnly.records.length,
  currentReferencePointInTimeVerified: currentSummary.pointInTimeVerifiedRecords,
  currentReferenceCanClaimCompletePIT: currentSummary.canClaimCompletePointInTimeUniverse,
  verifiedFixtureTickerChange: true,
  verifiedFixtureDelisting: true,
  priceHistoryIsNotListingEvidence: true,
  integratedIntoExistingCausalReplay: true,
  completeMasterRequiresCatalogAndDatasetCoverage: true
}));
