import { createHash } from 'node:crypto';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';

export const PHASE4_R3_VERSION = 'PHASE4_REENTRY_CASH_CUSTODY_V1_R3' as const;
export const PHASE4_R3_MARKER = 'PHASE4_REENTRY_CASH_CUSTODY_V1_R3_RESULT' as const;
export const PHASE4_R3_DATA_START_DATE = '2006-12-19';
export const PHASE4_R3_REPLAY_START_DATE = '2008-03-03';
export const PHASE4_R3_END_DATE = '2010-12-31';
export const PHASE4_R3_INITIAL_CAPITAL_EUR = 13_000;
export const PHASE4_R3_MINIMUM_BARS = 252;
export const PHASE4_R3_COHORT_COUNT = 6;
export const PHASE4_R3_FRESH_PER_COHORT = 5;
export const PHASE4_R3_TARGET_FRESH_ASSETS = PHASE4_R3_COHORT_COUNT * PHASE4_R3_FRESH_PER_COHORT;
export const PHASE4_R3_MIN_VALID_FRESH_PER_COHORT = 4;
export const PHASE4_R3_SEAL_PATH = 'docs/phase4_reentry_cash_custody_v1_r3_seal.json';
export const PHASE4_R3_DURABLE_JOB_ID = 'phase4-reentry-cash-custody-v1-r3';

/**
 * R3 changes the sample/data design only, never the tested policy. DBXW is the
 * EUR Xetra listing of Xtrackers MSCI World Swap UCITS ETF 1C, launched
 * 2006-12-19 and accumulating. The isolated research identity lets the shared
 * architecture classify it as a strategic global core without adding it to
 * production discovery or core priority.
 */
export const PHASE4_R3_CORE: AssetUniverseItem = {
  assetId: 'CORE_PH4_R3_DBXW_WORLD',
  ticker: 'DBXW.DE',
  isin: 'LU0274208692',
  name: 'Xtrackers MSCI World Swap UCITS ETF 1C',
  category: 'GLOBAL_EQUITY',
  currency: 'EUR',
  instrumentType: 'ETF_ETC',
  marketDataProvider: 'YAHOO'
};

/**
 * Frozen coverage pool. No member overlaps R2 and no member is in the curated
 * production discovery catalogue at freeze time. The one-shot runner filters
 * this pool only by REAL provider coverage/causal pre-history, then takes the
 * first 30 by deterministic SHA-256 order. Price/return outcomes never enter
 * sample selection and there is no manual replacement after the one-shot opens.
 */
export const PHASE4_R3_CANDIDATE_POOL: AssetUniverseItem[] = [
  { assetId: 'EQ_PH4_R3_BAYN', ticker: 'BAYN.DE', name: 'Bayer', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_DBK', ticker: 'DBK.DE', name: 'Deutsche Bank', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_CBK', ticker: 'CBK.DE', name: 'Commerzbank', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_EOAN', ticker: 'EOAN.DE', name: 'E.ON', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_FRE', ticker: 'FRE.DE', name: 'Fresenius', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_FME', ticker: 'FME.DE', name: 'Fresenius Medical Care', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_HNR1', ticker: 'HNR1.DE', name: 'Hannover Rueck', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_PUM', ticker: 'PUM.DE', name: 'Puma', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SDF', ticker: 'SDF.DE', name: 'K+S', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_NEM', ticker: 'NEM.DE', name: 'Nemetschek', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_FRA', ticker: 'FRA.DE', name: 'Fraport', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_BC8', ticker: 'BC8.DE', name: 'Bechtle', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_BN', ticker: 'BN.PA', name: 'Danone', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_ML', ticker: 'ML.PA', name: 'Michelin', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_CA', ticker: 'CA.PA', name: 'Carrefour', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_ORA', ticker: 'ORA.PA', name: 'Orange', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SGO', ticker: 'SGO.PA', name: 'Saint-Gobain', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_VIE', ticker: 'VIE.PA', name: 'Veolia', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_PUB', ticker: 'PUB.PA', name: 'Publicis Groupe', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_ACA', ticker: 'ACA.PA', name: 'Credit Agricole', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_RMS', ticker: 'RMS.PA', name: 'Hermes International', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_DSY', ticker: 'DSY.PA', name: 'Dassault Systemes', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_BKT', ticker: 'BKT.MC', name: 'Bankinter', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SAB', ticker: 'SAB.MC', name: 'Banco Sabadell', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_ENG', ticker: 'ENG.MC', name: 'Enagas', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_CAF', ticker: 'CAF.MC', name: 'CAF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_VIS', ticker: 'VIS.MC', name: 'Viscofan', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_EBRO', ticker: 'EBRO.MC', name: 'Ebro Foods', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_CIE', ticker: 'CIE.MC', name: 'CIE Automotive', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_PHIA', ticker: 'PHIA.AS', name: 'Philips', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_INGA', ticker: 'INGA.AS', name: 'ING Groep', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_HEIA', ticker: 'HEIA.AS', name: 'Heineken', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_AKZA', ticker: 'AKZA.AS', name: 'Akzo Nobel', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_KPN', ticker: 'KPN.AS', name: 'KPN', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_WKL', ticker: 'WKL.AS', name: 'Wolters Kluwer', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_ASM', ticker: 'ASM.AS', name: 'ASM International', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_RAND', ticker: 'RAND.AS', name: 'Randstad', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_BESI', ticker: 'BESI.AS', name: 'BE Semiconductor Industries', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_UCB', ticker: 'UCB.BR', name: 'UCB', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_KBC', ticker: 'KBC.BR', name: 'KBC Group', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_GBLB', ticker: 'GBLB.BR', name: 'Groupe Bruxelles Lambert', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SOLB', ticker: 'SOLB.BR', name: 'Solvay', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_COLR', ticker: 'COLR.BR', name: 'Colruyt Group', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_UMI', ticker: 'UMI.BR', name: 'Umicore', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_NOKIA', ticker: 'NOKIA.HE', name: 'Nokia', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_KNEBV', ticker: 'KNEBV.HE', name: 'Kone', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SAMPO', ticker: 'SAMPO.HE', name: 'Sampo', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_FORTUM', ticker: 'FORTUM.HE', name: 'Fortum', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_WRT1V', ticker: 'WRT1V.HE', name: 'Wartsila', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_UPM', ticker: 'UPM.HE', name: 'UPM-Kymmene', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_METSB', ticker: 'METSB.HE', name: 'Metsa Board', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_OMV', ticker: 'OMV.VI', name: 'OMV', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_VOE', ticker: 'VOE.VI', name: 'voestalpine', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_EBS', ticker: 'EBS.VI', name: 'Erste Group Bank', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_VER', ticker: 'VER.VI', name: 'Verbund', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_EDP', ticker: 'EDP.LS', name: 'EDP', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_JMT', ticker: 'JMT.LS', name: 'Jeronimo Martins', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SEM', ticker: 'SEM.LS', name: 'Semapa', category: 'EUROPE_EQUITY', currency: 'EUR' },

  { assetId: 'EQ_PH4_R3_MB', ticker: 'MB.MI', name: 'Mediobanca', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_BMED', ticker: 'BMED.MI', name: 'Banca Mediolanum', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_BZU', ticker: 'BZU.MI', name: 'Buzzi', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_CPR', ticker: 'CPR.MI', name: 'Campari', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_SRG', ticker: 'SRG.MI', name: 'Snam', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_IP', ticker: 'IP.MI', name: 'Interpump Group', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R3_REC', ticker: 'REC.MI', name: 'Recordati', category: 'EUROPE_EQUITY', currency: 'EUR' }
];

export const PHASE4_R2_CONSUMED_TICKERS = new Set([
  'BAS.DE','BMW.DE','MUV2.DE','HEN3.DE','BEI.DE','RWE.DE','IFX.DE','VOW3.DE','MRK.DE','CON.DE',
  'DG.PA','CAP.PA','RI.PA','KER.PA','HO.PA','EN.PA','VIV.PA','CS.PA','GLE.PA','RNO.PA',
  'ACS.MC','TEF.MC','ELE.MC','ANA.MC','ACX.MC','FCC.MC','G.MI','TIT.MI','LDO.MI','STM.MI'
]);

export function phase4R3Order(asset: AssetUniverseItem): string {
  return createHash('sha256').update(`PHASE4_REENTRY_BLIND_R3:${asset.assetId}`).digest('hex');
}

export function selectPhase4R3FreshAssets(coverageEligible: readonly AssetUniverseItem[]): AssetUniverseItem[] {
  return [...coverageEligible]
    .sort((a, b) => phase4R3Order(a).localeCompare(phase4R3Order(b)) || a.assetId.localeCompare(b.assetId))
    .slice(0, PHASE4_R3_TARGET_FRESH_ASSETS);
}

export function buildPhase4R3Cohorts(selected: readonly AssetUniverseItem[]): AssetUniverseItem[][] {
  if (selected.length !== PHASE4_R3_TARGET_FRESH_ASSETS) {
    throw new Error(`PHASE4_R3_SELECTED_SAMPLE_SIZE_MISMATCH:${selected.length}`);
  }
  return Array.from({ length: PHASE4_R3_COHORT_COUNT }, (_, index) =>
    selected.slice(index * PHASE4_R3_FRESH_PER_COHORT, (index + 1) * PHASE4_R3_FRESH_PER_COHORT)
  );
}
