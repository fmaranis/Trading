import type { AssetUniverseItem } from './assetUniverse';

export type BrokerAvailabilityStatus = 'CONFIRMED_MYINVESTOR' | 'REQUIRES_INVERSIS_LOOKUP' | 'UNVERIFIED';
export type BrokerAvailabilityEvidence = 'MYINVESTOR_OFFICIAL_CURRENT' | 'MYINVESTOR_OFFICIAL_HISTORICAL' | 'NONE';

export interface BrokerAvailabilityRecord {
  isinOrTicker: string;
  status: BrokerAvailabilityStatus;
  evidence: BrokerAvailabilityEvidence;
  checkedAt: string;
  note: string;
}

/**
 * Broker availability is deliberately separate from market-data validity.
 * Only first-party MyInvestor evidence can promote an instrument to
 * CONFIRMED_MYINVESTOR. Absence from a public page is never treated as proof
 * that the instrument is unavailable because MyInvestor explicitly states
 * that additional instruments can be available through Inversis.
 */
export const MYINVESTOR_AVAILABILITY: Record<string, BrokerAvailabilityRecord> = {
  IE0032126645: {
    isinOrTicker: 'IE0032126645',
    status: 'CONFIRMED_MYINVESTOR',
    evidence: 'MYINVESTOR_OFFICIAL_CURRENT',
    checkedAt: '2026-08-28',
    note: 'MyInvestor currently names Vanguard U.S. 500 Stock Index Fund (IE0032126645) in its own investment content.'
  },
  IE00B03HD191: {
    isinOrTicker: 'IE00B03HD191',
    status: 'CONFIRMED_MYINVESTOR',
    evidence: 'MYINVESTOR_OFFICIAL_CURRENT',
    checkedAt: '2026-08-28',
    note: 'MyInvestor currently names Vanguard Global Stock Index Fund (IE00B03HD191) among funds used by its investors.'
  },
  IE0031786696: {
    isinOrTicker: 'IE0031786696',
    status: 'CONFIRMED_MYINVESTOR',
    evidence: 'MYINVESTOR_OFFICIAL_CURRENT',
    checkedAt: '2026-08-28',
    note: 'MyInvestor currently names Vanguard Emerging Markets Stock Index Fund (IE0031786696) among index-fund options used by its investors.'
  },
  IE00B5456744: {
    isinOrTicker: 'IE00B5456744',
    status: 'REQUIRES_INVERSIS_LOOKUP',
    evidence: 'MYINVESTOR_OFFICIAL_HISTORICAL',
    checkedAt: '2026-08-28',
    note: 'MyInvestor documents historical use of this Vanguard ESG fund but also documents its removal from an indexed portfolio in 2021; current standalone availability is not proven.'
  }
};

export function getMyInvestorAvailability(asset: AssetUniverseItem): BrokerAvailabilityRecord {
  const key = asset.isin ?? asset.ticker;
  const explicit = MYINVESTOR_AVAILABILITY[key];
  if (explicit) return explicit;

  return {
    isinOrTicker: key,
    status: asset.instrumentType === 'MUTUAL_FUND' ? 'REQUIRES_INVERSIS_LOOKUP' : 'REQUIRES_INVERSIS_LOOKUP',
    evidence: 'NONE',
    checkedAt: '2026-08-28',
    note: 'No first-party evidence captured yet. MyInvestor states that instruments absent from its public/app catalogue may still be available through Inversis, so availability must be checked there by ISIN/ticker.'
  };
}

export function summarizeMyInvestorAvailability(assets: AssetUniverseItem[]) {
  const rows = assets.map(asset => ({ asset, availability: getMyInvestorAvailability(asset) }));
  return {
    rows,
    confirmed: rows.filter(row => row.availability.status === 'CONFIRMED_MYINVESTOR').length,
    requiresInversisLookup: rows.filter(row => row.availability.status === 'REQUIRES_INVERSIS_LOOKUP').length,
    unverified: rows.filter(row => row.availability.status === 'UNVERIFIED').length
  };
}
