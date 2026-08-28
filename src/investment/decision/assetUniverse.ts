export type AssetUniverseCategory =
  | 'GLOBAL_EQUITY'
  | 'US_EQUITY'
  | 'EUROPE_EQUITY'
  | 'JAPAN_EQUITY'
  | 'EMERGING_EQUITY'
  | 'SMALL_CAP'
  | 'TECHNOLOGY'
  | 'SEMICONDUCTORS'
  | 'HEALTHCARE'
  | 'ENERGY'
  | 'DIVIDEND'
  | 'GOV_BONDS'
  | 'CORP_BONDS'
  | 'AGG_BONDS'
  | 'MONEY_MARKET'
  | 'GOLD'
  | 'COMMODITIES';

export type InvestmentInstrumentType = 'ETF_ETC' | 'MUTUAL_FUND';

export interface AssetUniverseItem {
  assetId: string;
  ticker: string;
  name: string;
  category: AssetUniverseCategory;
  currency: 'EUR';
  defensive?: boolean;
  instrumentType?: InvestmentInstrumentType;
  isin?: string;
  marketDataProvider?: 'YAHOO' | 'EODHD_FUND';
}

/**
 * Unified discovery universe. ETFs/ETCs use Yahoo/Xetra symbols while mutual
 * funds use EODHD NAV history by ISIN. Every instrument is scored with the
 * same return/volatility/drawdown rules after its REAL series is loaded.
 *
 * This is a discovery catalogue, not a recommendation cap. Runtime validation
 * rejects unavailable/stale instruments and the UI can display every accepted
 * candidate even when only a diversified subset enters the portfolio allocator.
 */
export const EUR_ASSET_UNIVERSE: AssetUniverseItem[] = [
  { assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', isin: 'IE00B03HD191', name: 'Vanguard Global Stock Index Fund EUR Acc', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_EMERGING', ticker: 'IE0031786696', isin: 'IE0031786696', name: 'Vanguard Emerging Markets Stock Index Fund EUR Acc', category: 'EMERGING_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_US500', ticker: 'IE0032126645', isin: 'IE0032126645', name: 'Vanguard U.S. 500 Stock Index Fund EUR Acc', category: 'US_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_EUROPE', ticker: 'IE0007987708', isin: 'IE0007987708', name: 'Vanguard European Stock Index Fund EUR Acc', category: 'EUROPE_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_EUROZONE', ticker: 'IE0008248803', isin: 'IE0008248803', name: 'Vanguard Eurozone Stock Index Fund EUR Acc', category: 'EUROPE_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_JAPAN', ticker: 'IE0007286036', isin: 'IE0007286036', name: 'Vanguard Japan Stock Index Fund EUR Acc', category: 'JAPAN_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_ESG_DEVELOPED', ticker: 'IE00B5456744', isin: 'IE00B5456744', name: 'Vanguard ESG Developed World All Cap Equity Index Fund EUR Acc', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'FUND_VANGUARD_ESG_EMERGING', ticker: 'IE00BKV0W243', isin: 'IE00BKV0W243', name: 'Vanguard ESG Emerging Markets All Cap Equity Index Fund EUR Acc', category: 'EMERGING_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'VWCE', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'EUNL', ticker: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'SXR8', ticker: 'SXR8.DE', name: 'iShares Core S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'VUSA', ticker: 'VUSA.DE', name: 'Vanguard S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'EQQQ', ticker: 'EQQQ.DE', name: 'Invesco EQQQ Nasdaq-100 UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'SXRV', ticker: 'SXRV.DE', name: 'iShares Nasdaq 100 UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'EXSA', ticker: 'EXSA.DE', name: 'iShares STOXX Europe 600 UCITS ETF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'MEUD', ticker: 'MEUD.DE', name: 'Amundi STOXX Europe 600 UCITS ETF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'IS3N', ticker: 'IS3N.DE', name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'EIMI', ticker: 'EIMI.DE', name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'IUSN', ticker: 'IUSN.DE', name: 'iShares MSCI World Small Cap UCITS ETF', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'ZPRV', ticker: 'ZPRV.DE', name: 'SPDR MSCI USA Small Cap Value Weighted UCITS ETF', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'VVSM', ticker: 'VVSM.DE', name: 'VanEck Semiconductor UCITS ETF', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'SEMI', ticker: 'SEMI.DE', name: 'L&G Semiconductor UCITS ETF', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'QDVE', ticker: 'QDVE.DE', name: 'iShares S&P 500 Information Technology Sector UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'XDWH', ticker: 'XDWH.DE', name: 'Xtrackers MSCI World Health Care UCITS ETF', category: 'HEALTHCARE', currency: 'EUR' },
  { assetId: 'IQQH', ticker: 'IQQH.DE', name: 'iShares Global Clean Energy UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EXH1', ticker: 'EXH1.DE', name: 'iShares STOXX Europe 600 Oil & Gas UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'ISPA', ticker: 'ISPA.DE', name: 'iShares STOXX Global Select Dividend 100 UCITS ETF', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'VHYD', ticker: 'VHYD.DE', name: 'Vanguard FTSE All-World High Dividend Yield UCITS ETF', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'VAGF', ticker: 'VAGF.DE', name: 'Vanguard Global Aggregate Bond UCITS EUR Hedged', category: 'AGG_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'EUNA', ticker: 'EUNA.DE', name: 'iShares Core Global Aggregate Bond UCITS EUR Hedged', category: 'AGG_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'IBCI', ticker: 'IBCI.DE', name: 'iShares Euro Corporate Bond UCITS ETF', category: 'CORP_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'EUN6', ticker: 'EUN6.DE', name: 'iShares Euro Government Bond 1-3yr UCITS ETF', category: 'GOV_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'DBX0AN', ticker: 'DBX0AN.DE', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: 'XEON', ticker: 'XEON.DE', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: '4GLD', ticker: '4GLD.DE', name: 'Xetra-Gold', category: 'GOLD', currency: 'EUR', defensive: true },
  { assetId: 'SGLD', ticker: 'SGLD.DE', name: 'Invesco Physical Gold ETC', category: 'GOLD', currency: 'EUR', defensive: true },
  { assetId: 'AIGC', ticker: 'AIGC.DE', name: 'WisdomTree Broad Commodities ETC', category: 'COMMODITIES', currency: 'EUR', defensive: true },
  { assetId: 'WCOA', ticker: 'WCOA.DE', name: 'WisdomTree Enhanced Commodity UCITS ETF', category: 'COMMODITIES', currency: 'EUR', defensive: true }
];
