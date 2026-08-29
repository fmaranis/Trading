import type { AssetUniverseItem } from './assetUniverse';

export type BrokerAvailabilityStatus = 'CONFIRMED_MYINVESTOR' | 'ASSUMED_MYINVESTOR_AVAILABLE' | 'REQUIRES_INVERSIS_LOOKUP' | 'UNVERIFIED' | 'USER_CONFIRMED_UNAVAILABLE';
export type BrokerAvailabilityEvidence = 'MYINVESTOR_OFFICIAL_CURRENT' | 'MYINVESTOR_OFFICIAL_HISTORICAL' | 'USER_CONFIRMED_MYINVESTOR' | 'USER_POLICY_DEFAULT' | 'NONE';
export type ManualBrokerAvailabilityValue = 'AVAILABLE' | 'UNAVAILABLE';

export interface BrokerAvailabilityRecord {
  isinOrTicker: string;
  status: BrokerAvailabilityStatus;
  evidence: BrokerAvailabilityEvidence;
  checkedAt: string;
  note: string;
}

export interface ManualBrokerAvailabilityRecord {
  isinOrTicker: string;
  value: ManualBrokerAvailabilityValue;
  confirmedAt: string;
  note?: string;
}

const MANUAL_STORAGE_KEY = 'custodia_myinvestor_manual_availability_v1';

/**
 * Broker availability is deliberately separate from market-data validity.
 * Public/first-party evidence and user confirmations remain distinguishable.
 * The user's operating policy is permissive: if there is no explicit evidence
 * of unavailability, the app may assume the instrument can be searched/bought
 * in MyInvestor. This assumption is NEVER labelled as official confirmation.
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
    note: 'MyInvestor documents historical use of this Vanguard ESG fund but current standalone availability is not proven.'
  }
};

function normalizeKey(value: string): string { return value.trim().toUpperCase(); }

export class ManualMyInvestorAvailabilityService {
  static loadAll(): Record<string, ManualBrokerAvailabilityRecord> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(MANUAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) as Record<string, ManualBrokerAvailabilityRecord> : {};
    } catch { return {}; }
  }

  static get(isinOrTicker: string): ManualBrokerAvailabilityRecord | null {
    return this.loadAll()[normalizeKey(isinOrTicker)] ?? null;
  }

  static set(isinOrTicker: string, value: ManualBrokerAvailabilityValue, note?: string): ManualBrokerAvailabilityRecord {
    const key = normalizeKey(isinOrTicker);
    const record: ManualBrokerAvailabilityRecord = { isinOrTicker: key, value, confirmedAt: new Date().toISOString(), ...(note?.trim() ? { note: note.trim() } : {}) };
    if (typeof window !== 'undefined') {
      const all = this.loadAll();
      all[key] = record;
      window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(all));
    }
    return record;
  }

  static remove(isinOrTicker: string): void {
    if (typeof window === 'undefined') return;
    const all = this.loadAll();
    delete all[normalizeKey(isinOrTicker)];
    window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(all));
  }

  static clear(): void { if (typeof window !== 'undefined') window.localStorage.removeItem(MANUAL_STORAGE_KEY); }
}

export function getPublicMyInvestorAvailability(asset: AssetUniverseItem): BrokerAvailabilityRecord {
  const key = normalizeKey(asset.isin ?? asset.ticker);
  const explicit = MYINVESTOR_AVAILABILITY[key];
  if (explicit) return explicit;
  return {
    isinOrTicker: key,
    status: 'REQUIRES_INVERSIS_LOOKUP',
    evidence: 'NONE',
    checkedAt: '2026-08-28',
    note: 'No first-party evidence captured yet. Official availability has not been independently verified.'
  };
}

export function getMyInvestorAvailability(asset: AssetUniverseItem): BrokerAvailabilityRecord {
  const key = normalizeKey(asset.isin ?? asset.ticker);
  const manual = ManualMyInvestorAvailabilityService.get(key);
  if (manual?.value === 'AVAILABLE') return {
    isinOrTicker: key,
    status: 'CONFIRMED_MYINVESTOR',
    evidence: 'USER_CONFIRMED_MYINVESTOR',
    checkedAt: manual.confirmedAt,
    note: manual.note ? `Confirmado manualmente en MyInvestor. ${manual.note}` : 'Confirmado manualmente por el usuario tras localizar el instrumento en MyInvestor.'
  };
  if (manual?.value === 'UNAVAILABLE') return {
    isinOrTicker: key,
    status: 'USER_CONFIRMED_UNAVAILABLE',
    evidence: 'USER_CONFIRMED_MYINVESTOR',
    checkedAt: manual.confirmedAt,
    note: manual.note ? `Marcado manualmente como no disponible. ${manual.note}` : 'El usuario no encontró el instrumento disponible en MyInvestor en la fecha indicada.'
  };

  const publicEvidence = getPublicMyInvestorAvailability(asset);
  if (publicEvidence.status === 'CONFIRMED_MYINVESTOR') return publicEvidence;

  return {
    isinOrTicker: key,
    status: 'ASSUMED_MYINVESTOR_AVAILABLE',
    evidence: 'USER_POLICY_DEFAULT',
    checkedAt: new Date().toISOString(),
    note: 'Asunción operativa del usuario: tratar el instrumento como disponible en MyInvestor salvo que él indique expresamente que no puede comprarlo. No equivale a verificación oficial del broker.'
  };
}

export function summarizeMyInvestorAvailability(assets: AssetUniverseItem[]) {
  const rows = assets.map(asset => ({ asset, availability: getMyInvestorAvailability(asset) }));
  return {
    rows,
    confirmed: rows.filter(row => row.availability.status === 'CONFIRMED_MYINVESTOR').length,
    assumedAvailable: rows.filter(row => row.availability.status === 'ASSUMED_MYINVESTOR_AVAILABLE').length,
    userConfirmedUnavailable: rows.filter(row => row.availability.status === 'USER_CONFIRMED_UNAVAILABLE').length,
    requiresInversisLookup: rows.filter(row => row.availability.status === 'REQUIRES_INVERSIS_LOOKUP').length,
    unverified: rows.filter(row => row.availability.status === 'UNVERIFIED').length
  };
}
