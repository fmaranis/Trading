import { EUR_PORTFOLIO_DISCOVERY_UNIVERSE } from './portfolioDiscoveryUniverse';
import type { AssetUniverseItem } from './assetUniverse';

const STORAGE_KEY = 'custodia_dynamic_market_assets_v1';

type DynamicDiscoveredAsset = AssetUniverseItem & {
  currentDiscoveryQuoteType?: string;
};

function dynamicQuoteType(asset: AssetUniverseItem): string {
  const explicit = String((asset as DynamicDiscoveredAsset).currentDiscoveryQuoteType ?? '').trim().toUpperCase();
  if (explicit) return explicit;
  // Backward-compatible migration for assets persisted before quoteType was kept.
  // In this registry EUROPE_EQUITY was assigned only to Yahoo quoteType=EQUITY;
  // ETF/other listed instruments were stored as GLOBAL_EQUITY.
  if (asset.assetId.startsWith('DYNAMIC_') && asset.category === 'EUROPE_EQUITY') return 'EQUITY';
  return '';
}

function withPreservedQuoteType(asset: AssetUniverseItem): AssetUniverseItem {
  const quoteType = dynamicQuoteType(asset);
  if (quoteType) (asset as DynamicDiscoveredAsset).currentDiscoveryQuoteType = quoteType;
  return asset;
}

function dedupePush(asset: AssetUniverseItem): AssetUniverseItem {
  const normalized = withPreservedQuoteType(asset);
  const existing = EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(item =>
    item.assetId === normalized.assetId
    || item.ticker.toUpperCase() === normalized.ticker.toUpperCase()
    || Boolean(normalized.isin && item.isin?.toUpperCase() === normalized.isin.toUpperCase())
  );
  if (existing) {
    const incomingQuoteType = dynamicQuoteType(normalized);
    if (incomingQuoteType && !String((existing as DynamicDiscoveredAsset).currentDiscoveryQuoteType ?? '').trim()) {
      (existing as DynamicDiscoveredAsset).currentDiscoveryQuoteType = incomingQuoteType;
    }
    return existing;
  }
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE.push(normalized);
  return normalized;
}

function loadPersisted(): AssetUniverseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  const dynamic = EUR_PORTFOLIO_DISCOVERY_UNIVERSE.filter(item => item.assetId.startsWith('DYNAMIC_'));
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dynamic)); } catch { /* non-blocking cache */ }
}

for (const asset of loadPersisted()) {
  if (asset?.assetId && asset?.ticker && asset?.currency === 'EUR') dedupePush(withPreservedQuoteType(asset));
}

export interface LiveDiscoveredAsset {
  symbol: string;
  name: string;
  quoteType: 'ETF' | 'MUTUALFUND' | 'EQUITY' | string;
  exchange?: string | null;
  currency?: string | null;
  usableInEurEngine: boolean;
  historyBars3y: number;
  isin?: string | null;
  source: 'YAHOO_LIVE_DISCOVERY';
}

function assetIdFor(symbol: string): string {
  return `DYNAMIC_${symbol.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

export function registerLiveDiscoveredAsset(input: LiveDiscoveredAsset): AssetUniverseItem {
  if (!input.usableInEurEngine || String(input.currency).toUpperCase() !== 'EUR') {
    throw new Error(`El instrumento ${input.symbol} no cotiza en EUR y el motor actual no puede mezclar divisas sin FX explícito.`);
  }
  const quoteType = String(input.quoteType).toUpperCase();
  const identifiedFund = quoteType === 'MUTUALFUND' && Boolean(input.isin);
  const asset: DynamicDiscoveredAsset = {
    assetId: assetIdFor(input.symbol),
    ticker: input.symbol.toUpperCase(),
    isin: input.isin || undefined,
    name: input.name || input.symbol,
    category: quoteType === 'EQUITY' ? 'EUROPE_EQUITY' : 'GLOBAL_EQUITY',
    currency: 'EUR',
    instrumentType: identifiedFund ? 'MUTUAL_FUND' : 'ETF_ETC',
    marketDataProvider: identifiedFund ? 'EODHD_FUND' : 'YAHOO',
    currentDiscoveryQuoteType: quoteType
  };
  const registered = dedupePush(asset);
  persist();
  return registered;
}

export function isDynamicDiscoveredEquityIdentity(identity: string | null | undefined): boolean {
  const normalized = String(identity ?? '').trim().toUpperCase();
  if (!normalized) return false;
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.some(item =>
    item.assetId.startsWith('DYNAMIC_')
    && (item.assetId.toUpperCase() === normalized || item.ticker.toUpperCase() === normalized)
    && dynamicQuoteType(item) === 'EQUITY'
  );
}

export function getDynamicPortfolioAssets(): AssetUniverseItem[] {
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.filter(item => item.assetId.startsWith('DYNAMIC_'));
}
