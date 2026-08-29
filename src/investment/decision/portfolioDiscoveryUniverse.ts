import { EUR_ASSET_UNIVERSE, type AssetUniverseItem } from './assetUniverse';

/**
 * Production discovery expansion for portfolio candidates.
 *
 * This list is deliberately separate from EUR_VALIDATION_HOLDOUT_UNIVERSE so
 * the external robustness set remains genuinely outside production decisions.
 * All symbols below are EUR-quoted listed equities so the current
 * single-currency portfolio engine can compare them without inventing FX data.
 * Verified ISINs are retained on the catalogue item so operational surfaces
 * can show the broker-search code directly.
 *
 * The legacy execution type still groups listed whole-share instruments under
 * ETF_ETC. `isPortfolioEquityTicker` preserves the correct user-facing asset
 * class without a risky cross-cutting type migration.
 */
export const EUR_PORTFOLIO_EXPANSION_UNIVERSE: AssetUniverseItem[] = [
  { assetId: 'EQ_ASML', ticker: 'ASML.AS', isin: 'NL0010273215', name: 'ASML Holding', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'EQ_SAP', ticker: 'SAP.DE', isin: 'DE0007164600', name: 'SAP SE', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'EQ_SIEMENS', ticker: 'SIE.DE', isin: 'DE0007236101', name: 'Siemens AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ALLIANZ', ticker: 'ALV.DE', isin: 'DE0008404005', name: 'Allianz SE', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_DTE', ticker: 'DTE.DE', isin: 'DE0005557508', name: 'Deutsche Telekom AG', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_RHEINMETALL', ticker: 'RHM.DE', isin: 'DE0007030009', name: 'Rheinmetall AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_DB1', ticker: 'DB1.DE', isin: 'DE0005810055', name: 'Deutsche Boerse AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ADIDAS', ticker: 'ADS.DE', isin: 'DE000A1EWWW0', name: 'adidas AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_AIRBUS', ticker: 'AIR.PA', isin: 'NL0000235190', name: 'Airbus SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_LVMH', ticker: 'MC.PA', isin: 'FR0000121014', name: 'LVMH', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_LOREAL', ticker: 'OR.PA', isin: 'FR0000120321', name: "L'Oreal", category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_AIRLIQUIDE', ticker: 'AI.PA', isin: 'FR0000120073', name: 'Air Liquide', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_SCHNEIDER', ticker: 'SU.PA', isin: 'FR0000121972', name: 'Schneider Electric', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_TOTAL', ticker: 'TTE.PA', isin: 'FR0000120271', name: 'TotalEnergies', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_SANOFI', ticker: 'SAN.PA', isin: 'FR0000120578', name: 'Sanofi', category: 'HEALTHCARE', currency: 'EUR' },
  { assetId: 'EQ_BNP', ticker: 'BNP.PA', isin: 'FR0000131104', name: 'BNP Paribas', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_SANTANDER', ticker: 'SAN.MC', isin: 'ES0113900J37', name: 'Banco Santander', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_BBVA', ticker: 'BBVA.MC', isin: 'ES0113211835', name: 'BBVA', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_INDITEX', ticker: 'ITX.MC', isin: 'ES0148396007', name: 'Inditex', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_IBERDROLA', ticker: 'IBE.MC', isin: 'ES0144580Y14', name: 'Iberdrola', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_FERROVIAL', ticker: 'FER.MC', isin: 'NL0015001FS8', name: 'Ferrovial SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_REPSOL', ticker: 'REP.MC', isin: 'ES0173516115', name: 'Repsol', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_ENEL', ticker: 'ENEL.MI', isin: 'IT0003128367', name: 'Enel', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_INTESA', ticker: 'ISP.MI', isin: 'IT0000072618', name: 'Intesa Sanpaolo', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_UNICREDIT', ticker: 'UCG.MI', isin: 'IT0005239360', name: 'UniCredit', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_ENI', ticker: 'ENI.MI', isin: 'IT0003132476', name: 'Eni', category: 'ENERGY', currency: 'EUR' }
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