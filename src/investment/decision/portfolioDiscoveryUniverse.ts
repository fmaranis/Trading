import { EUR_ASSET_UNIVERSE, type AssetUniverseItem } from './assetUniverse';

/**
 * Production discovery expansion for portfolio candidates.
 *
 * This list is deliberately separate from EUR_VALIDATION_HOLDOUT_UNIVERSE so
 * the external robustness set remains genuinely outside production decisions.
 * All symbols below are EUR-quoted listed equities so the current
 * single-currency portfolio engine can compare them without inventing FX data.
 *
 * The legacy execution type still groups listed whole-share instruments under
 * ETF_ETC. `isPortfolioEquityTicker` preserves the correct user-facing asset
 * class without a risky cross-cutting type migration.
 */
export const EUR_PORTFOLIO_EXPANSION_UNIVERSE: AssetUniverseItem[] = [
  { assetId: 'EQ_ASML', ticker: 'ASML.AS', name: 'ASML Holding', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'EQ_SAP', ticker: 'SAP.DE', name: 'SAP SE', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'EQ_SIEMENS', ticker: 'SIE.DE', name: 'Siemens AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ALLIANZ', ticker: 'ALV.DE', name: 'Allianz SE', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_DTE', ticker: 'DTE.DE', name: 'Deutsche Telekom AG', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_RHEINMETALL', ticker: 'RHM.DE', name: 'Rheinmetall AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_DB1', ticker: 'DB1.DE', name: 'Deutsche Boerse AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ADIDAS', ticker: 'ADS.DE', name: 'adidas AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_AIRBUS', ticker: 'AIR.PA', name: 'Airbus SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_LVMH', ticker: 'MC.PA', name: 'LVMH', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_LOREAL', ticker: 'OR.PA', name: "L'Oreal", category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_AIRLIQUIDE', ticker: 'AI.PA', name: 'Air Liquide', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_SCHNEIDER', ticker: 'SU.PA', name: 'Schneider Electric', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_TOTAL', ticker: 'TTE.PA', name: 'TotalEnergies', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_SANOFI', ticker: 'SAN.PA', name: 'Sanofi', category: 'HEALTHCARE', currency: 'EUR' },
  { assetId: 'EQ_BNP', ticker: 'BNP.PA', name: 'BNP Paribas', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_SANTANDER', ticker: 'SAN.MC', name: 'Banco Santander', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_BBVA', ticker: 'BBVA.MC', name: 'BBVA', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_INDITEX', ticker: 'ITX.MC', name: 'Inditex', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_IBERDROLA', ticker: 'IBE.MC', name: 'Iberdrola', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_FERROVIAL', ticker: 'FER.MC', name: 'Ferrovial SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_REPSOL', ticker: 'REP.MC', name: 'Repsol', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_ENEL', ticker: 'ENEL.MI', name: 'Enel', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_INTESA', ticker: 'ISP.MI', name: 'Intesa Sanpaolo', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_UNICREDIT', ticker: 'UCG.MI', name: 'UniCredit', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ENI', ticker: 'ENI.MI', name: 'Eni', category: 'ENERGY', currency: 'EUR' }
];

const EQUITY_TICKERS = new Set(EUR_PORTFOLIO_EXPANSION_UNIVERSE.map(item => item.ticker.toUpperCase()));
export function isPortfolioEquityTicker(ticker: string | null | undefined): boolean {
  return Boolean(ticker && EQUITY_TICKERS.has(ticker.toUpperCase()));
}

function dedupe(items: AssetUniverseItem[]): AssetUniverseItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.ticker.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Candidate universe used by the live portfolio decision path. It is broader
 * than the original ETF/fund set but remains independent from the validation
 * holdout universe.
 */
export const EUR_PORTFOLIO_DISCOVERY_UNIVERSE: AssetUniverseItem[] = dedupe([
  ...EUR_ASSET_UNIVERSE,
  ...EUR_PORTFOLIO_EXPANSION_UNIVERSE
]);