import type { AssetUniverseItem } from './assetUniverse';

export const HISTORICAL_INSTRUMENT_MASTER_V1 = 'HISTORICAL_INSTRUMENT_MASTER_V1' as const;

export type HistoricalInstrumentMasterCoverage =
  | 'CURRENT_REFERENCE_ONLY'
  | 'PARTIAL_POINT_IN_TIME'
  | 'COMPLETE_POINT_IN_TIME';

export type HistoricalReferenceAuthority =
  | 'EXCHANGE_OFFICIAL'
  | 'ISSUER_OFFICIAL'
  | 'REGULATORY'
  | 'VENDOR_REFERENCE'
  | 'CURRENT_CATALOG_REFERENCE';

export interface HistoricalInstrumentAlias {
  ticker: string;
  venue: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface HistoricalInstrumentRecord {
  canonicalInstrumentId: string;
  isin: string | null;
  name: string;
  instrumentType: AssetUniverseItem['instrumentType'] | 'LISTED_INSTRUMENT';
  currency: 'EUR';
  listingDate: string | null;
  delistingDate: string | null;
  aliases: HistoricalInstrumentAlias[];
  authority: HistoricalReferenceAuthority;
  authorityReference: string;
  evidenceAsOfDate: string;
  pointInTimeVerified: boolean;
  dataProvenance: 'STATIC_REFERENCE';
}

export interface HistoricalInstrumentMaster {
  version: typeof HISTORICAL_INSTRUMENT_MASTER_V1;
  targetUniverse: string;
  coverage: HistoricalInstrumentMasterCoverage;
  asOfDate: string;
  records: HistoricalInstrumentRecord[];
  notes: string[];
}

export type HistoricalInstrumentDateStatus =
  | 'TRADABLE_VERIFIED'
  | 'NOT_YET_LISTED'
  | 'DELISTED'
  | 'AFTER_EVIDENCE_HORIZON'
  | 'NO_ACTIVE_ALIAS'
  | 'UNVERIFIED_POINT_IN_TIME'
  | 'IDENTITY_NOT_FOUND';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string | null, label: string): void {
  if (value != null && !ISO_DATE.test(value)) throw new Error(`HISTORICAL_INSTRUMENT_MASTER_INVALID_DATE:${label}:${value}`);
}

function intervalsOverlap(a: HistoricalInstrumentAlias, b: HistoricalInstrumentAlias): boolean {
  const aStart = a.validFrom ?? '0000-01-01';
  const aEnd = a.validTo ?? '9999-12-31';
  const bStart = b.validFrom ?? '0000-01-01';
  const bEnd = b.validTo ?? '9999-12-31';
  return aStart <= bEnd && bStart <= aEnd;
}

export function validateHistoricalInstrumentMaster(master: HistoricalInstrumentMaster): void {
  if (master.version !== HISTORICAL_INSTRUMENT_MASTER_V1) throw new Error('HISTORICAL_INSTRUMENT_MASTER_VERSION_MISMATCH');
  assertIsoDate(master.asOfDate, 'MASTER_AS_OF');
  if (!master.targetUniverse.trim()) throw new Error('HISTORICAL_INSTRUMENT_MASTER_TARGET_UNIVERSE_REQUIRED');

  const ids = new Set<string>();
  for (const record of master.records) {
    if (!record.canonicalInstrumentId.trim()) throw new Error('HISTORICAL_INSTRUMENT_MASTER_CANONICAL_ID_REQUIRED');
    if (ids.has(record.canonicalInstrumentId)) throw new Error(`HISTORICAL_INSTRUMENT_MASTER_DUPLICATE_ID:${record.canonicalInstrumentId}`);
    ids.add(record.canonicalInstrumentId);

    assertIsoDate(record.listingDate, `${record.canonicalInstrumentId}:LISTING`);
    assertIsoDate(record.delistingDate, `${record.canonicalInstrumentId}:DELISTING`);
    assertIsoDate(record.evidenceAsOfDate, `${record.canonicalInstrumentId}:EVIDENCE_AS_OF`);
    if (record.listingDate && record.delistingDate && record.delistingDate < record.listingDate) {
      throw new Error(`HISTORICAL_INSTRUMENT_MASTER_DELIST_BEFORE_LIST:${record.canonicalInstrumentId}`);
    }
    if (record.evidenceAsOfDate > master.asOfDate) {
      throw new Error(`HISTORICAL_INSTRUMENT_MASTER_RECORD_AFTER_MASTER_AS_OF:${record.canonicalInstrumentId}`);
    }
    if (!record.aliases.length) throw new Error(`HISTORICAL_INSTRUMENT_MASTER_ALIAS_REQUIRED:${record.canonicalInstrumentId}`);

    for (const alias of record.aliases) {
      if (!alias.ticker.trim()) throw new Error(`HISTORICAL_INSTRUMENT_MASTER_EMPTY_TICKER:${record.canonicalInstrumentId}`);
      assertIsoDate(alias.validFrom, `${record.canonicalInstrumentId}:${alias.ticker}:FROM`);
      assertIsoDate(alias.validTo, `${record.canonicalInstrumentId}:${alias.ticker}:TO`);
      if (alias.validFrom && alias.validTo && alias.validTo < alias.validFrom) {
        throw new Error(`HISTORICAL_INSTRUMENT_MASTER_ALIAS_INVALID_RANGE:${record.canonicalInstrumentId}:${alias.ticker}`);
      }
    }

    for (let i = 0; i < record.aliases.length; i++) {
      for (let j = i + 1; j < record.aliases.length; j++) {
        const a = record.aliases[i];
        const b = record.aliases[j];
        if (a.ticker === b.ticker && a.venue === b.venue && intervalsOverlap(a, b)) {
          throw new Error(`HISTORICAL_INSTRUMENT_MASTER_OVERLAPPING_ALIAS:${record.canonicalInstrumentId}:${a.ticker}`);
        }
      }
    }

    if (record.pointInTimeVerified) {
      if (!record.listingDate) throw new Error(`HISTORICAL_INSTRUMENT_MASTER_VERIFIED_WITHOUT_LISTING:${record.canonicalInstrumentId}`);
      if (record.authority === 'CURRENT_CATALOG_REFERENCE') {
        throw new Error(`HISTORICAL_INSTRUMENT_MASTER_CURRENT_REFERENCE_CANNOT_VERIFY_PIT:${record.canonicalInstrumentId}`);
      }
      if (record.aliases.some(alias => !alias.validFrom)) {
        throw new Error(`HISTORICAL_INSTRUMENT_MASTER_VERIFIED_ALIAS_WITHOUT_START:${record.canonicalInstrumentId}`);
      }
    }
  }

  if (master.coverage === 'COMPLETE_POINT_IN_TIME') {
    if (!master.records.length || master.records.some(record => !record.pointInTimeVerified)) {
      throw new Error('HISTORICAL_INSTRUMENT_MASTER_COMPLETE_COVERAGE_REQUIRES_ALL_VERIFIED');
    }
  }
  if (master.coverage === 'CURRENT_REFERENCE_ONLY' && master.records.some(record => record.pointInTimeVerified)) {
    throw new Error('HISTORICAL_INSTRUMENT_MASTER_CURRENT_ONLY_CANNOT_CONTAIN_VERIFIED_PIT');
  }
}

export function resolveHistoricalInstrumentRecord(
  master: HistoricalInstrumentMaster,
  identity: { assetId?: string | null; isin?: string | null; ticker?: string | null }
): HistoricalInstrumentRecord | null {
  const assetId = identity.assetId?.trim() || null;
  const isin = identity.isin?.trim().toUpperCase() || null;
  const ticker = identity.ticker?.trim().toUpperCase() || null;
  return master.records.find(record =>
    (assetId != null && record.canonicalInstrumentId === assetId)
    || (isin != null && record.isin?.toUpperCase() === isin)
    || (ticker != null && record.aliases.some(alias => alias.ticker.toUpperCase() === ticker))
  ) ?? null;
}

export function historicalInstrumentStatusAtDate(
  master: HistoricalInstrumentMaster,
  record: HistoricalInstrumentRecord | null,
  date: string
): HistoricalInstrumentDateStatus {
  assertIsoDate(date, 'QUERY_DATE');
  if (!record) return 'IDENTITY_NOT_FOUND';
  if (!record.pointInTimeVerified) return 'UNVERIFIED_POINT_IN_TIME';
  if (date > record.evidenceAsOfDate) return 'AFTER_EVIDENCE_HORIZON';
  if (record.listingDate && date < record.listingDate) return 'NOT_YET_LISTED';
  if (record.delistingDate && date > record.delistingDate) return 'DELISTED';
  if (historicalTickerAtDate(record, date) == null) return 'NO_ACTIVE_ALIAS';
  return 'TRADABLE_VERIFIED';
}

export function historicalTickerAtDate(record: HistoricalInstrumentRecord, date: string): string | null {
  assertIsoDate(date, 'TICKER_QUERY_DATE');
  const alias = record.aliases.find(candidate => {
    const afterStart = candidate.validFrom == null || candidate.validFrom <= date;
    const beforeEnd = candidate.validTo == null || date <= candidate.validTo;
    return afterStart && beforeEnd;
  });
  return alias?.ticker ?? null;
}

export function buildCurrentReferenceOnlyInstrumentMaster(
  catalog: AssetUniverseItem[],
  asOfDate: string
): HistoricalInstrumentMaster {
  assertIsoDate(asOfDate, 'CURRENT_REFERENCE_AS_OF');
  const grouped = new Map<string, AssetUniverseItem[]>();
  for (const item of catalog) {
    const key = item.isin?.trim().toUpperCase() || `ASSET:${item.assetId}`;
    const rows = grouped.get(key) ?? [];
    rows.push(item);
    grouped.set(key, rows);
  }

  const records: HistoricalInstrumentRecord[] = Array.from(grouped.entries()).map(([key, rows]) => {
    const first = rows[0];
    return {
      canonicalInstrumentId: first.isin?.trim().toUpperCase() || first.assetId,
      isin: first.isin?.trim().toUpperCase() || null,
      name: first.name,
      instrumentType: first.instrumentType ?? 'LISTED_INSTRUMENT',
      currency: 'EUR',
      listingDate: null,
      delistingDate: null,
      aliases: rows.map(row => ({ ticker: row.ticker, venue: null, validFrom: null, validTo: null })),
      authority: 'CURRENT_CATALOG_REFERENCE',
      authorityReference: 'EUR_ASSET_UNIVERSE',
      evidenceAsOfDate: asOfDate,
      pointInTimeVerified: false,
      dataProvenance: 'STATIC_REFERENCE'
    };
  });

  const master: HistoricalInstrumentMaster = {
    version: HISTORICAL_INSTRUMENT_MASTER_V1,
    targetUniverse: 'EUR_ENGINE_CURRENT_CATALOG_REFERENCE',
    coverage: 'CURRENT_REFERENCE_ONLY',
    asOfDate,
    records,
    notes: [
      'This snapshot deduplicates current catalogue identities but does not reconstruct historical listings or delistings.',
      'CURRENT_REFERENCE_ONLY records are forbidden from authorizing point-in-time historical universe claims.',
      'Historical price availability is not treated as evidence that an instrument was listed/eligible at that historical date.'
    ]
  };
  validateHistoricalInstrumentMaster(master);
  return master;
}

export function historicalInstrumentMasterCoverageSummary(master: HistoricalInstrumentMaster) {
  validateHistoricalInstrumentMaster(master);
  const verified = master.records.filter(record => record.pointInTimeVerified).length;
  return {
    coverage: master.coverage,
    records: master.records.length,
    pointInTimeVerifiedRecords: verified,
    unverifiedRecords: master.records.length - verified,
    canClaimCompletePointInTimeUniverse: master.coverage === 'COMPLETE_POINT_IN_TIME'
  };
}


export function historicalCatalogAtDate(
  master: HistoricalInstrumentMaster,
  catalog: AssetUniverseItem[],
  date: string
): AssetUniverseItem[] {
  validateHistoricalInstrumentMaster(master);
  if (master.coverage === 'CURRENT_REFERENCE_ONLY') {
    throw new Error('HISTORICAL_INSTRUMENT_MASTER_CURRENT_REFERENCE_CANNOT_FILTER_HISTORICAL_UNIVERSE');
  }
  return catalog.filter(item => {
    const record = resolveHistoricalInstrumentRecord(master, {
      assetId: item.assetId,
      isin: item.isin ?? null,
      ticker: item.ticker
    });
    return historicalInstrumentStatusAtDate(master, record, date) === 'TRADABLE_VERIFIED';
  });
}


export function historicalTradableRecordsAtDate(
  master: HistoricalInstrumentMaster,
  date: string
): HistoricalInstrumentRecord[] {
  validateHistoricalInstrumentMaster(master);
  if (master.coverage === 'CURRENT_REFERENCE_ONLY') {
    throw new Error('HISTORICAL_INSTRUMENT_MASTER_CURRENT_REFERENCE_HAS_NO_HISTORICAL_TRADABLE_SET');
  }
  return master.records.filter(record => historicalInstrumentStatusAtDate(master, record, date) === 'TRADABLE_VERIFIED');
}

export function historicalMasterMissingFromCatalogAtDate(
  master: HistoricalInstrumentMaster,
  catalog: AssetUniverseItem[],
  date: string
): string[] {
  const tradable = historicalTradableRecordsAtDate(master, date);
  return tradable
    .filter(record => !catalog.some(item => resolveHistoricalInstrumentRecord(master, {
      assetId: item.assetId,
      isin: item.isin ?? null,
      ticker: item.ticker
    })?.canonicalInstrumentId === record.canonicalInstrumentId))
    .map(record => record.canonicalInstrumentId)
    .sort();
}
