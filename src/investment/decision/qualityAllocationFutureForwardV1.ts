import type { AssetUniverseItem } from './assetUniverse';
import type { DynamicReplayExternalCashFlow } from './replayExternalCashFlows';

export const QUALITY_ALLOCATION_FUTURE_FORWARD_V1 = {
  version: 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1',
  frozenAt: '2026-09-09',
  eligibleStartDate: '2026-09-10',
  sourcePreregistrationHead: '479b1a1efa2576caf2be11790d9fc9a6cd2fb10c',
  productionArchitecture: 'CORE_ARCHITECTURE_V1',
  productionAllocationPolicy: 'LEGACY',
  candidateAllocationPolicy: 'QUALITY_ALLOCATION_BRIDGE_V1',
  candidateIsShadowResearchOnly: true,
  candidateCanPromoteDirectlyFromPhaseA: false,
  noParameterChangesAfterFreeze: true,
  noHistoricalOutcomeBackfill: true,
  preStartBarsAreFeatureWarmupOnly: true,
  currentYahooDiscoveryInEvaluation: false,
  validationHoldoutUniverseExcluded: true,
  forwardRiskIncluded: false,
  frequency: 'MONTHLY',
  initialCapitalEur: 13_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  cashBenchmarkAnnualPctFallback: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
  researchContributionFixtureEurPerMonth: 1_000,
  researchContributionFixtureIsProductionDefault: false,
  researchContributionFixtureIsUserCashFlowAssumption: false,
  monthlyDecisionCadenceCreatesImplicitCash: false,
  firstFixtureContribution: 'ONE_CALENDAR_MONTH_AFTER_ELIGIBLE_START',
  minimumForwardSessionsForEconomicEvaluation: 252,
  reachGate: {
    minimumAllocationPlanChangedDecisionGates: 3,
    minimumExecutedAcquisitionDatesChanged: 8,
    minimumAbsoluteExecutedNotionalDeltaEur: 1_000
  },
  economicGate: {
    minimumCashFlowAdjustedReturnDeltaPctPoints: 0.50,
    requirePositiveFinalValueDeltaEur: true,
    maximumAllowedDrawdownWorseningPctPoints: 1.0
  },
  phaseAPassMeaning: 'CANDIDATE_FOR_SEPARATE_FRESH_CONFIRMATION_NOT_PRODUCTION_PROMOTION',
  insufficientReachMeaning: 'INCONCLUSIVE_KEEP_LEGACY_NO_RETUNING',
  failMeaning: 'KEEP_LEGACY_NO_RETUNING',
  residualLimitation: 'FROZEN_CURRENT_CATALOG_IS_NOT_A_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

/**
 * Frozen on 2026-09-09 before any eligible forward outcome. This independent
 * snapshot prevents later additions/removals in the production catalogue from
 * retrospectively changing the candidate set used by this validation.
 * EUR_VALIDATION_HOLDOUT_UNIVERSE and future OPEN_* discoveries are excluded.
 */
export const QUALITY_ALLOCATION_FUTURE_FORWARD_V1_UNIVERSE: readonly AssetUniverseItem[] = [
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
  { assetId: 'WCOA', ticker: 'WCOA.MI', isin: 'IE00BYMLZY74', name: 'WisdomTree Enhanced Commodity UCITS ETF - USD Acc', category: 'COMMODITIES', currency: 'EUR', defensive: true },
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
] as const;

function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function qualityAllocationFutureForwardV1ResearchFlows(endDate: string): DynamicReplayExternalCashFlow[] {
  const rows: DynamicReplayExternalCashFlow[] = [];
  let index = 1;
  let date = addMonths(QUALITY_ALLOCATION_FUTURE_FORWARD_V1.eligibleStartDate, 1);
  while (date <= endDate) {
    rows.push({
      id: `quality_ff_v1_research_contribution_${date}`,
      date,
      amountEur: QUALITY_ALLOCATION_FUTURE_FORWARD_V1.researchContributionFixtureEurPerMonth,
      kind: 'CONTRIBUTION',
      label: 'QUALITY future-forward V1 research-only explicit contribution fixture'
    });
    index += 1;
    date = addMonths(QUALITY_ALLOCATION_FUTURE_FORWARD_V1.eligibleStartDate, index);
  }
  return rows;
}
