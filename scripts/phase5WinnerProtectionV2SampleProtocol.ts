import { createHash } from 'node:crypto';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';

export const PHASE5_WINNER_PROTECTION_VERSION = 'PHASE5_WINNER_PROTECTION_V2' as const;
export const PHASE5_SAMPLE_PREFLIGHT_MARKER = 'PHASE5_WINNER_PROTECTION_V2_SAMPLE_PREFLIGHT_RESULT' as const;
export const PHASE5_DATA_START_DATE = '1998-01-02';
export const PHASE5_REPLAY_START_DATE = '2001-01-03';
export const PHASE5_END_DATE = '2003-12-31';
export const PHASE5_MINIMUM_CAUSAL_BARS = 252;
export const PHASE5_COHORT_COUNT = 6;
export const PHASE5_ASSETS_PER_COHORT = 3;
export const PHASE5_TARGET_ASSETS = PHASE5_COHORT_COUNT * PHASE5_ASSETS_PER_COHORT;
export const PHASE5_INITIAL_CAPITAL_EUR = 13_000;
export const PHASE5_FREQUENCY = 'DAILY' as const;
export const PHASE5_RISK_PROFILE = 'MEDIUM' as const;
export const PHASE5_HORIZON_YEARS = 3 as const;
export const PHASE5_CURRENT_DISCOVERY_HISTORICAL = false as const;

/**
 * The original pre-open window started on 2000-01-03. The first coverage-only
 * preflight returned only 10/26 eligible assets because many Yahoo EUR histories
 * begin exactly on 2000-01-03, leaving zero causal warm-up bars. No baseline,
 * candidate, return, drawdown, MFE, giveback or other economic outcome was run.
 *
 * Because the holdout remained unopened, the temporal boundary is refrozen to
 * 2001-01-03 while preserving the same pool, 252-bar minimum, 2003-12-31 end,
 * 6x3 cohort design and policy. The refreeze is based exclusively on observed
 * provider coverage/listing history and gives the already-frozen 2000-start
 * identities approximately one full causal year before the replay.
 *
 * The pool uses isolated research identities for EUR-listed equities from the
 * already-known production expansion catalogue at freeze time. Historical
 * sample selection never calls current discovery. Residual survivorship/catalog
 * bias is explicit and remains a Phase 8 limitation.
 */
export const PHASE5_CANDIDATE_POOL: AssetUniverseItem[] = [
  { assetId: 'EQ_PH5_ASML', ticker: 'ASML.AS', name: 'ASML Holding', category: 'SEMICONDUCTORS', currency: 'EUR' },
  { assetId: 'EQ_PH5_SAP', ticker: 'SAP.DE', name: 'SAP SE', category: 'TECHNOLOGY', currency: 'EUR' },
  { assetId: 'EQ_PH5_SIE', ticker: 'SIE.DE', name: 'Siemens AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_ALV', ticker: 'ALV.DE', name: 'Allianz SE', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_DTE', ticker: 'DTE.DE', name: 'Deutsche Telekom AG', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_RHM', ticker: 'RHM.DE', name: 'Rheinmetall AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_DB1', ticker: 'DB1.DE', name: 'Deutsche Boerse AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_ADS', ticker: 'ADS.DE', name: 'adidas AG', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_AIR', ticker: 'AIR.PA', name: 'Airbus SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_MC', ticker: 'MC.PA', name: 'LVMH', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_OR', ticker: 'OR.PA', name: "L'Oreal", category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_AI', ticker: 'AI.PA', name: 'Air Liquide', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_SU', ticker: 'SU.PA', name: 'Schneider Electric', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_TTE', ticker: 'TTE.PA', name: 'TotalEnergies', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_PH5_SANOFI', ticker: 'SAN.PA', name: 'Sanofi', category: 'HEALTHCARE', currency: 'EUR' },
  { assetId: 'EQ_PH5_BNP', ticker: 'BNP.PA', name: 'BNP Paribas', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_SAN', ticker: 'SAN.MC', name: 'Banco Santander', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_BBVA', ticker: 'BBVA.MC', name: 'BBVA', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_ITX', ticker: 'ITX.MC', name: 'Inditex', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_IBE', ticker: 'IBE.MC', name: 'Iberdrola', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_FER', ticker: 'FER.MC', name: 'Ferrovial SE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_REP', ticker: 'REP.MC', name: 'Repsol', category: 'ENERGY', currency: 'EUR' },
  { assetId: 'EQ_PH5_ENEL', ticker: 'ENEL.MI', name: 'Enel', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_ISP', ticker: 'ISP.MI', name: 'Intesa Sanpaolo', category: 'DIVIDEND', currency: 'EUR' },
  { assetId: 'EQ_PH5_UCG', ticker: 'UCG.MI', name: 'UniCredit', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH5_ENI', ticker: 'ENI.MI', name: 'Eni', category: 'ENERGY', currency: 'EUR' }
];

export const PHASE5_CONSUMED_TICKERS = new Set([
  'HFG.DE',
  'BAS.DE','BMW.DE','MUV2.DE','HEN3.DE','BEI.DE','RWE.DE','IFX.DE','VOW3.DE','MRK.DE','CON.DE',
  'DG.PA','CAP.PA','RI.PA','KER.PA','HO.PA','EN.PA','VIV.PA','CS.PA','GLE.PA','RNO.PA',
  'ACS.MC','TEF.MC','ELE.MC','ANA.MC','ACX.MC','FCC.MC','G.MI','TIT.MI','LDO.MI','STM.MI',
  'BAYN.DE','DBK.DE','CBK.DE','EOAN.DE','FRE.DE','FME.DE','HNR1.DE','PUM.DE','SDF.DE','NEM.DE','FRA.DE','BC8.DE',
  'BN.PA','ML.PA','CA.PA','ORA.PA','SGO.PA','VIE.PA','PUB.PA','ACA.PA','RMS.PA','DSY.PA',
  'BKT.MC','SAB.MC','ENG.MC','CAF.MC','VIS.MC','EBRO.MC','CIE.MC',
  'PHIA.AS','INGA.AS','HEIA.AS','AKZA.AS','KPN.AS','WKL.AS','ASM.AS','RAND.AS','BESI.AS',
  'UCB.BR','KBC.BR','GBLB.BR','SOLB.BR','COLR.BR','UMI.BR',
  'NOKIA.HE','KNEBV.HE','SAMPO.HE','FORTUM.HE','WRT1V.HE','UPM.HE','METSB.HE',
  'OMV.VI','VOE.VI','EBS.VI','VER.VI','EDP.LS','JMT.LS','SEM.LS',
  'MB.MI','BMED.MI','BZU.MI','CPR.MI','SRG.MI','IP.MI','REC.MI'
]);

export function phase5BlindOrder(asset: AssetUniverseItem): string {
  return createHash('sha256').update(`PHASE5_WINNER_PROTECTION_V2:${asset.assetId}`).digest('hex');
}

export function selectPhase5Assets(coverageEligible: readonly AssetUniverseItem[]): AssetUniverseItem[] {
  return [...coverageEligible]
    .sort((a, b) => phase5BlindOrder(a).localeCompare(phase5BlindOrder(b)))
    .slice(0, PHASE5_TARGET_ASSETS);
}

export function partitionPhase5Cohorts(selected: readonly AssetUniverseItem[]): AssetUniverseItem[][] {
  if (selected.length !== PHASE5_TARGET_ASSETS) throw new Error(`PHASE5_SAMPLE_SIZE_REQUIRED:${PHASE5_TARGET_ASSETS}:${selected.length}`);
  return Array.from({ length: PHASE5_COHORT_COUNT }, (_, index) =>
    selected.slice(index * PHASE5_ASSETS_PER_COHORT, (index + 1) * PHASE5_ASSETS_PER_COHORT)
  );
}
