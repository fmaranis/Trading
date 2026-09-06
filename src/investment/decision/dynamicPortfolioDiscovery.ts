import { EUR_PORTFOLIO_DISCOVERY_UNIVERSE } from './portfolioDiscoveryUniverse';
import type { AssetUniverseItem } from './assetUniverse';

const STORAGE_KEY = 'custodia_dynamic_market_assets_v1';

function dedupePush(asset: AssetUniverseItem): AssetUniverseItem {
  const existing = EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(item =>
    item.assetId === asset.assetId
    || item.ticker.toUpperCase() === asset.ticker.toUpperCase()
    || Boolean(asset.isin && item.isin?.toUpperCase() === asset.isin.toUpperCase())
  );
  if (existing) return existing;
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE.push(asset);
  return asset;
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
  if (asset?.assetId && asset?.ticker && asset?.currency === 'EUR') dedupePush(asset);
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
  const asset: AssetUniverseItem = {
    assetId: assetIdFor(input.symbol),
    ticker: input.symbol.toUpperCase(),
    isin: input.isin || undefined,
    name: input.name || input.symbol,
    category: quoteType === 'EQUITY' ? 'EUROPE_EQUITY' : 'GLOBAL_EQUITY',
    currency: 'EUR',
    instrumentType: quoteType === 'MUTUALFUND' ? 'MUTUAL_FUND' : 'ETF_ETC',
    marketDataProvider: quoteType === 'MUTUALFUND' ? 'EODHD_FUND' : 'YAHOO'
  };
  const registered = dedupePush(asset);
  persist();
  return registered;
}

export function getDynamicPortfolioAssets(): AssetUniverseItem[] {
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.filter(item => item.assetId.startsWith('DYNAMIC_'));
}
