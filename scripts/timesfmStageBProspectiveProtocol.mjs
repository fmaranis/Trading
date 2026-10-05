import crypto from 'node:crypto';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as STAGE_B } from './timesfmStageBProtocol.mjs';

export const TIMESFM_STAGE_B_PROSPECTIVE_VERSION = 'TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1';
export const TIMESFM_STAGE_B_PROSPECTIVE_SCHEMA_VERSION = 1;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([key,child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export const TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY = Object.freeze({
  version: TIMESFM_STAGE_B_PROSPECTIVE_VERSION,
  schemaVersion: TIMESFM_STAGE_B_PROSPECTIVE_SCHEMA_VERSION,
  stageBVersion: STAGE_B.version,
  diagnosticDisposition: 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION',
  startAfter: STAGE_B.prospectiveConfirmation.startAfter,
  cadence: STAGE_B.prospectiveConfirmation.cadence,
  minimumMaturedAnchors: STAGE_B.prospectiveConfirmation.minimumMaturedAnchors,
  primaryOutcomeRequires60SessionMaturity: STAGE_B.prospectiveConfirmation.primaryOutcomeRequires60SessionMaturity,
  core: STAGE_B.core,
  assets: STAGE_B.assets,
  contextLength: STAGE_B.contextLength,
  forecastHorizon: STAGE_B.forecastHorizon,
  evaluationHorizons: STAGE_B.evaluationHorizons,
  primaryHorizons: STAGE_B.primaryHorizons,
  models: STAGE_B.models,
  baselines: STAGE_B.baselines,
  gates: STAGE_B.gates,
  normalization: STAGE_B.normalization,
  economicShadow: Object.freeze({
    version: 'TIMESFM_DIRECT_SELECTOR_V1',
    status: 'FROZEN_BEFORE_FIRST_PROSPECTIVE_ANCHOR',
    role: 'DIRECT_ASSET_SELECTOR_SHADOW',
    candidatePool: '8_STAGE_B_ASSETS_PLUS_EUNL_CORE',
    rule: 'LOWEST_MEAN_ORDINAL_RANK_20_60',
    tieBreak: 'HIGHER_MEAN_PREDICTED_RELATIVE_RETURN_THEN_ASSET_ID',
    structuralCoreRelativeForecastPct: 0,
    target: '100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET',
    comparisonArms: ['LEGACY_APP', 'EUNL_CORE_DIRECT'],
    productionAuthority: false
  }),
  collection: Object.freeze({
    provider: 'YAHOO_FINANCE',
    sourceType: 'REAL',
    sessionTimezone: 'Europe/Berlin',
    sameDayCollectionNotBeforeLocalHour: 18,
    noHistoricalCatchUp: true,
    noRetroactiveForecastAfterFirstCommonSessionPassed: true,
    requireAllFrozenTickersOnAnchor: true,
    futureOutcomeAccess: false,
    marketDataThroughInformationDateOnly: true,
    oneZeroGpuBatchPerAnchor: true,
    persistence: 'GITHUB_REPLAY_RESULTS_HASH_CHAIN'
  }),
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export const TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY_FINGERPRINT_SHA256 =
  sha256Canonical(TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY);

export function createEmptyTimesFmProspectiveState(nowIso) {
  return {
    version: TIMESFM_STAGE_B_PROSPECTIVE_VERSION,
    schemaVersion: TIMESFM_STAGE_B_PROSPECTIVE_SCHEMA_VERSION,
    methodologyFingerprintSha256: TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY_FINGERPRINT_SHA256,
    sampleState: 'NOT_OPENED',
    createdAt: nowIso,
    openedAt: null,
    updatedAt: nowIso,
    anchorCount: 0,
    lastInformationDate: null,
    anchors: []
  };
}

export function markTimesFmProspectiveOpened(state, nowIso) {
  verifyTimesFmProspectiveState(state);
  if (state.sampleState !== 'NOT_OPENED') return state;
  const next = { ...state, sampleState: 'OPENED_COLLECTING', openedAt: nowIso, updatedAt: nowIso };
  verifyTimesFmProspectiveState(next);
  return next;
}

export function appendTimesFmProspectiveAnchor(state, draft, nowIso) {
  verifyTimesFmProspectiveState(state);
  if (state.sampleState !== 'OPENED_COLLECTING') throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_NOT_OPEN');
  if (state.anchors.some(row => row.informationDate === draft.informationDate)) {
    throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_DUPLICATE_ANCHOR:' + draft.informationDate);
  }
  if (draft.informationDate <= STAGE_B.prospectiveConfirmation.startAfter) {
    throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_ANCHOR_BEFORE_START:' + draft.informationDate);
  }
  const previousObservationHashSha256 = state.anchors.at(-1)?.observationHashSha256 ?? null;
  const payload = { ...draft, previousObservationHashSha256 };
  const observationHashSha256 = sha256Canonical(payload);
  const anchors = [...state.anchors, { ...payload, observationHashSha256 }];
  const next = {
    ...state,
    updatedAt: nowIso,
    anchorCount: anchors.length,
    lastInformationDate: draft.informationDate,
    anchors
  };
  verifyTimesFmProspectiveState(next);
  return next;
}

export function verifyTimesFmProspectiveState(state) {
  if (state.version !== TIMESFM_STAGE_B_PROSPECTIVE_VERSION) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_STATE_VERSION');
  if (state.schemaVersion !== TIMESFM_STAGE_B_PROSPECTIVE_SCHEMA_VERSION) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_STATE_SCHEMA');
  if (state.methodologyFingerprintSha256 !== TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY_FINGERPRINT_SHA256) {
    throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_STATE_METHOD_FINGERPRINT');
  }
  if (state.anchorCount !== state.anchors.length) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_STATE_COUNT');
  if (state.sampleState === 'NOT_OPENED' && (state.openedAt != null || state.anchors.length > 0)) {
    throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_UNOPENED_HAS_EVIDENCE');
  }
  if (state.sampleState !== 'NOT_OPENED' && !state.openedAt) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_OPENED_AT_MISSING');
  let previous = null;
  let priorDate = '';
  const ids = new Set();
  for (const row of state.anchors) {
    if (ids.has(row.id)) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_DUPLICATE_ID:' + row.id);
    ids.add(row.id);
    if (priorDate && row.informationDate <= priorDate) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_ANCHORS_NOT_STRICTLY_SORTED');
    priorDate = row.informationDate;
    if (row.previousObservationHashSha256 !== previous) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_HASH_PREVIOUS:' + row.id);
    const { observationHashSha256, ...payload } = row;
    if (sha256Canonical(payload) !== observationHashSha256) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_HASH_MISMATCH:' + row.id);
    previous = observationHashSha256;
    if (row.dataProvenance !== 'REAL') throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_NON_REAL:' + row.id);
    if (row.outcomesOpened !== false) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_OUTCOME_OPENED:' + row.id);
    if (!Array.isArray(row.cases) || row.cases.length !== STAGE_B.assets.length) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_CASE_COUNT:' + row.id);
    if (row.directShadow?.policyVersion !== TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY.economicShadow.version) {
      throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_DIRECT_SHADOW_POLICY:' + row.id);
    }
    if (!row.directShadow?.selectedAssetId) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_DIRECT_SHADOW_SELECTION:' + row.id);
  }
  const expectedLast = state.anchors.at(-1)?.informationDate ?? null;
  if (state.lastInformationDate !== expectedLast) throw new Error('TIMESFM_STAGE_B_PROSPECTIVE_LAST_DATE');
}
