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
 * Unified discovery universe. Listed instruments use exchange-specific EUR
 * symbols while mutual funds use direct NAV history by ISIN. Operational ISINs
 * are stored on the catalogue item whenever verified so every recommendation
 * can expose a broker-search identifier instead of relying on ticker alone.
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
  { assetId: 'VWCE', ticker: 'VWCE.DE', isin: 'IE00BK5BQT80', name: 'Vanguard FTSE All-World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'EUNL', ticker: 'EUNL.DE', isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'SXR8', ticker: 'SXR8.DE', isin: 'IE00B5BMR087', name: 'iShares Core S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'VUSA', ticker: 'VUSA.DE', isin: 'IE00B3XXRP09', name: 'Vanguard S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'EQQQ', ticker: 'EQQQ.DE', isin: 'IE0032077012', name: 'Invesco EQQQ Nasdaq-100 UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'SXRV', ticker: 'SXRV.DE', isin: 'IE00B53SZB19', name: 'iShares Nasdaq 100 UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'EXSA', ticker: 'EXSA.DE', isin: 'DE0002635307', name: 'iShares STOXX Europe 600 UCITS ETF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'MEUD', ticker: 'LYP6.DE', isin: 'LU0908500753', name: 'Amundi Core STOXX Europe 600 UCITS ETF Acc', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'IS3N', ticker: 'IS3N.DE', isin: 'IE00BKM4GZ66', name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'EIMI', ticker: 'EIMI.DE', isin: 'IE00BKM4GZ66', name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'IUSN', ticker: 'IUSN.DE', isin: 'IE00BF4RFH31', name: 'iShares MSCI World Small Cap UCITS ETF', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'ZPRV', ticker: 'ZPRV.DE', isin: 'IE00BSPLC413', name: 'SPDR MSCI USA Small Cap Value Weighted UCITS ETF', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'VVSM', ticker: 'VVSM.DE', isin: 'IE00BMC38736', name: 'VanEck Semiconductor UCITS ETF', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'SEMI', ticker: 'SEC0.DE', isin: 'IE000I8KRLL9', name: 'iShares MSCI Global Semiconductors UCITS ETF', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'QDVE', ticker: 'QDVE.DE', isin: 'IE00B3WJKG14', name: 'iShares S&P 500 Information Technology Sector UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'XDWH', ticker: 'XDWH.DE', isin: 'IE00BM67HK77', name: 'Xtrackers MSCI World Health Care UCITS ETF', category: 'HEALTHCARE', currency: 'EUR' },
  { assetId: 'IQQH', ticker: 'IQQH.DE', isin: 'IE00B1XNHC34', name: 'iShares Global Clean Energy UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EXH1', ticker: 'EXH1.DE', isin: 'DE000A0H08M3', name: 'iShares STOXX Europe 600 Oil & Gas UCITS ETF (DE)', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'ISPA', ticker: 'ISPA.DE', isin: 'DE000A0F5UH1', name: 'iShares STOXX Global Select Dividend 100 UCITS ETF (DE)', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'VHYD', ticker: 'VHYD.DE', isin: 'IE00B8GKDB10', name: 'Vanguard FTSE All-World High Dividend Yield UCITS ETF', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'VAGF', ticker: 'VAGF.DE', isin: 'IE00BG47KH54', name: 'Vanguard Global Aggregate Bond UCITS EUR Hedged', category: 'AGG_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'EUNA', ticker: 'EUNA.DE', isin: 'IE00BDBRDM35', name: 'iShares Core Global Aggregate Bond UCITS EUR Hedged', category: 'AGG_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'IBCI', ticker: 'IBCI.DE', isin: 'IE00B0M62X26', name: 'iShares € Inflation Linked Govt Bond UCITS ETF', category: 'GOV_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'EUN6', ticker: 'EUN6.DE', isin: 'IE00B3FH7618', name: 'iShares € Govt Bond 0-1yr UCITS ETF', category: 'GOV_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'DBX0AN', ticker: 'DBX0AN.DE', isin: 'LU0290358497', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: 'XEON', ticker: 'XEON.DE', isin: 'LU0290358497', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: '4GLD', ticker: '4GLD.DE', isin: 'DE000A0S9GB0', name: 'Xetra-Gold', category: 'GOLD', currency: 'EUR', defensive: true },
  { assetId: 'SGLD', ticker: 'SGLD.DE', isin: 'IE00B579F325', name: 'Invesco Physical Gold ETC', category: 'GOLD', currency: 'EUR', defensive: true },
  { assetId: 'AIGC', ticker: 'AIGC.MI', isin: 'GB00B15KY989', name: 'WisdomTree Broad Commodities', category: 'COMMODITIES', currency: 'EUR', defensive: true },
  { assetId: 'WCOA', ticker: 'WCOA.MI', isin: 'IE00BYMLZY74', name: 'WisdomTree Enhanced Commodity UCITS ETF - USD Acc', category: 'COMMODITIES', currency: 'EUR', defensive: true }
];

/**
 * REAL holdout catalogue used only by integrated live robustness validation.
 * These instruments are deliberately excluded from EUR_ASSET_UNIVERSE so they
 * cannot influence production recommendations. Validation samples them with a
 * recorded pseudo-random seed and also builds adverse-path cohorts afterwards.
 * Outcome-based cohorts are diagnostic stress tests only: never tune strategy
 * thresholds on them or report them as unbiased OOS performance evidence.
 */
export const EUR_VALIDATION_HOLDOUT_UNIVERSE: AssetUniverseItem[] = [
  { assetId: 'HOLDOUT_XDEM', ticker: 'XDEM.DE', name: 'Xtrackers MSCI World Momentum Factor UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_XDEV', ticker: 'XDEV.DE', name: 'Xtrackers MSCI World Value UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_XDEQ', ticker: 'XDEQ.DE', name: 'Xtrackers MSCI World Quality Factor UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_XDEB', ticker: 'XDEB.DE', name: 'Xtrackers MSCI World Minimum Volatility UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_IS3R', ticker: 'IS3R.DE', name: 'iShares Edge MSCI World Momentum Factor UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_IS3S', ticker: 'IS3S.DE', name: 'iShares Edge MSCI World Value Factor UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_QDVA', ticker: 'QDVA.DE', name: 'iShares Edge MSCI USA Momentum Factor UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_QDVI', ticker: 'QDVI.DE', name: 'iShares Edge MSCI USA Value UCITS ETF', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_ZPRX', ticker: 'ZPRX.DE', name: 'SPDR MSCI Europe Small Cap Value Weighted UCITS ETF', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'HOLDOUT_2B76', ticker: '2B76.DE', name: 'iShares Automation & Robotics UCITS ETF', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'HOLDOUT_G1CE', ticker: 'G1CE.DE', name: 'Invesco Global Clean Energy UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'HOLDOUT_XUEN', ticker: 'XUEN.DE', name: 'Xtrackers MSCI USA Energy UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'HOLDOUT_QDVF', ticker: 'QDVF.DE', name: 'iShares S&P 500 Energy Sector UCITS ETF', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'HOLDOUT_EXI5', ticker: 'EXI5.DE', name: 'iShares STOXX Europe 600 Real Estate UCITS ETF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_TRET', ticker: 'TRET.DE', name: 'VanEck Global Real Estate UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'HOLDOUT_EXX5', ticker: 'EXX5.DE', name: 'iShares Dow Jones U.S. Select Dividend UCITS ETF', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'HOLDOUT_AMUNDI_WORLD', ticker: 'LU0996182563', isin: 'LU0996182563', name: 'Amundi Index MSCI World AE', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'HOLDOUT_AMUNDI_SP500', ticker: 'LU0996179007', isin: 'LU0996179007', name: 'Amundi S&P 500 Screened Index AE', category: 'US_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  { assetId: 'HOLDOUT_FIDELITY_TECH', ticker: 'LU0099574567', isin: 'LU0099574567', name: 'Fidelity Funds Global Technology A EUR', category: 'TECHNOLOGY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' }
];
