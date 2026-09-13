import { PHASE5_CANDIDATE_POOL, PHASE5_COHORT_COUNT, PHASE5_ASSETS_PER_COHORT } from './phase5WinnerProtectionV2SampleProtocol';

export const PHASE5_SEALED_SAMPLE_STATE = 'SEALED_NOT_OPENED' as const;
export const PHASE5_SEALED_AFTER_PREFLIGHT_HEAD = '2e1e7b0a68819b28e0e4ccebaf4d1559ede14082' as const;

export const PHASE5_SEALED_SAMPLE_ASSET_IDS = [
  'EQ_PH5_FER',
  'EQ_PH5_RHM',
  'EQ_PH5_ENEL',
  'EQ_PH5_UCG',
  'EQ_PH5_OR',
  'EQ_PH5_ASML',
  'EQ_PH5_REP',
  'EQ_PH5_DTE',
  'EQ_PH5_SANOFI',
  'EQ_PH5_ENI',
  'EQ_PH5_SAP',
  'EQ_PH5_SU',
  'EQ_PH5_ADS',
  'EQ_PH5_BBVA',
  'EQ_PH5_TTE',
  'EQ_PH5_AI',
  'EQ_PH5_BNP',
  'EQ_PH5_ISP'
] as const;

const poolById = new Map(PHASE5_CANDIDATE_POOL.map(asset => [asset.assetId, asset]));

export const PHASE5_SEALED_SAMPLE = PHASE5_SEALED_SAMPLE_ASSET_IDS.map(assetId => {
  const asset = poolById.get(assetId);
  if (!asset) throw new Error(`PHASE5_SEALED_ASSET_NOT_IN_POOL:${assetId}`);
  return asset;
});

if (PHASE5_SEALED_SAMPLE.length !== PHASE5_COHORT_COUNT * PHASE5_ASSETS_PER_COHORT) {
  throw new Error(`PHASE5_SEALED_SAMPLE_SIZE_INVALID:${PHASE5_SEALED_SAMPLE.length}`);
}

export const PHASE5_SEALED_COHORTS = Array.from({ length: PHASE5_COHORT_COUNT }, (_, index) =>
  PHASE5_SEALED_SAMPLE.slice(index * PHASE5_ASSETS_PER_COHORT, (index + 1) * PHASE5_ASSETS_PER_COHORT)
);
