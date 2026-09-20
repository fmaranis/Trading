import { createHash } from 'node:crypto';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROTOCOL as STAGE_A } from '../src/investment/decision/phase6ForwardRiskContextStageAR2Protocol';

export const PHASE6_STAGE_A_R2_PROSPECTIVE_VERSION = 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROSPECTIVE_V1' as const;
export const PHASE6_STAGE_A_R2_STATE_SCHEMA_VERSION = 1 as const;

export type Phase6StageAR2SampleState = 'NOT_OPENED' | 'OPENED_COLLECTING' | 'COLLECTION_CLOSED';
export type Phase6StageAR2ContextStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type Phase6StageAR2GateStatus = 'ELIGIBLE' | 'REJECTED';

export interface Phase6StageAR2SignalObservation {
  id: string;
  informationDate: string;
  assetId: string;
  ticker: string;
  gateStatus: Phase6StageAR2GateStatus;
  gateReason: string;
  contextStatus: Phase6StageAR2ContextStatus;
  v5VulnerabilityScorePct: number | null;
  v7OptionsScorePct: number | null;
  contextScorePct: number | null;
  highRiskContext: boolean;
  source: 'V5' | 'V7' | 'BOTH' | 'NONE';
  marketDataSourceType: 'REAL' | 'UNAVAILABLE';
  collectedAt: string;
  previousObservationHashSha256: string | null;
  observationHashSha256: string;
}

export interface Phase6StageAR2ProspectiveState {
  version: typeof PHASE6_STAGE_A_R2_PROSPECTIVE_VERSION;
  schemaVersion: typeof PHASE6_STAGE_A_R2_STATE_SCHEMA_VERSION;
  methodologyFingerprintSha256: string;
  sampleState: Phase6StageAR2SampleState;
  predictionStartDate: string;
  predictionEndDate: string;
  openedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastInformationDate: string | null;
  observationCount: number;
  observations: Phase6StageAR2SignalObservation[];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export const PHASE6_STAGE_A_R2_METHODOLOGY_FINGERPRINT_SHA256 = sha256Canonical({
  version: PHASE6_STAGE_A_R2_PROSPECTIVE_VERSION,
  stateSchemaVersion: PHASE6_STAGE_A_R2_STATE_SCHEMA_VERSION,
  stageA: STAGE_A,
  collectorSemantics: {
    marketAccessOnlyAfterDurableOpenMarker: true,
    deterministicPostFreezeCatchUp: true,
    processOldestMissingSessionFirst: true,
    candidatePrefixEndsAtInformationDate: true,
    outcomesExcludedFromSignalCollector: true,
    observationsImmutableAfterDurableCommit: true,
    durableAuthority: 'GITHUB_REPLAY_RESULTS'
  }
});

function observationPayload(input: Omit<Phase6StageAR2SignalObservation, 'previousObservationHashSha256' | 'observationHashSha256'>, previous: string | null) {
  return { ...input, previousObservationHashSha256: previous };
}

export function createEmptyPhase6StageAR2State(nowIso: string): Phase6StageAR2ProspectiveState {
  return {
    version: PHASE6_STAGE_A_R2_PROSPECTIVE_VERSION,
    schemaVersion: PHASE6_STAGE_A_R2_STATE_SCHEMA_VERSION,
    methodologyFingerprintSha256: PHASE6_STAGE_A_R2_METHODOLOGY_FINGERPRINT_SHA256,
    sampleState: 'NOT_OPENED',
    predictionStartDate: STAGE_A.sample.predictionStartDate,
    predictionEndDate: STAGE_A.sample.predictionEndDate,
    openedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastInformationDate: null,
    observationCount: 0,
    observations: []
  };
}

export function markPhase6StageAR2Opened(state: Phase6StageAR2ProspectiveState, nowIso: string): Phase6StageAR2ProspectiveState {
  verifyPhase6StageAR2State(state);
  if (state.sampleState !== 'NOT_OPENED') return state;
  return {
    ...state,
    sampleState: 'OPENED_COLLECTING',
    openedAt: nowIso,
    updatedAt: nowIso
  };
}

export function appendPhase6StageAR2Observations(
  state: Phase6StageAR2ProspectiveState,
  rows: Array<Omit<Phase6StageAR2SignalObservation, 'previousObservationHashSha256' | 'observationHashSha256'>>,
  nowIso: string
): Phase6StageAR2ProspectiveState {
  verifyPhase6StageAR2State(state);
  if (state.sampleState !== 'OPENED_COLLECTING') throw new Error('PHASE6_STAGE_A_R2_STATE_NOT_OPEN_FOR_COLLECTION');
  const existing = new Set(state.observations.map(row => row.id));
  const sorted = [...rows].sort((a, b) => a.informationDate.localeCompare(b.informationDate) || a.assetId.localeCompare(b.assetId));
  const appended = [...state.observations];
  let previous = appended.at(-1)?.observationHashSha256 ?? null;
  for (const row of sorted) {
    if (existing.has(row.id)) throw new Error(`PHASE6_STAGE_A_R2_DUPLICATE_OBSERVATION:${row.id}`);
    if (row.informationDate < STAGE_A.sample.predictionStartDate || row.informationDate > STAGE_A.sample.predictionEndDate) {
      throw new Error(`PHASE6_STAGE_A_R2_OBSERVATION_OUTSIDE_FROZEN_WINDOW:${row.id}`);
    }
    const payload = observationPayload(row, previous);
    const observationHashSha256 = sha256Canonical(payload);
    appended.push({ ...payload, observationHashSha256 });
    previous = observationHashSha256;
    existing.add(row.id);
  }
  const next: Phase6StageAR2ProspectiveState = {
    ...state,
    updatedAt: nowIso,
    lastInformationDate: appended.at(-1)?.informationDate ?? state.lastInformationDate,
    observationCount: appended.length,
    observations: appended
  };
  verifyPhase6StageAR2State(next);
  return next;
}

export function verifyPhase6StageAR2State(state: Phase6StageAR2ProspectiveState): void {
  if (state.version !== PHASE6_STAGE_A_R2_PROSPECTIVE_VERSION) throw new Error('PHASE6_STAGE_A_R2_STATE_VERSION_MISMATCH');
  if (state.schemaVersion !== PHASE6_STAGE_A_R2_STATE_SCHEMA_VERSION) throw new Error('PHASE6_STAGE_A_R2_STATE_SCHEMA_MISMATCH');
  if (state.methodologyFingerprintSha256 !== PHASE6_STAGE_A_R2_METHODOLOGY_FINGERPRINT_SHA256) throw new Error('PHASE6_STAGE_A_R2_STATE_METHODOLOGY_FINGERPRINT_MISMATCH');
  if (state.predictionStartDate !== STAGE_A.sample.predictionStartDate || state.predictionEndDate !== STAGE_A.sample.predictionEndDate) throw new Error('PHASE6_STAGE_A_R2_STATE_WINDOW_MISMATCH');
  if (state.observationCount !== state.observations.length) throw new Error('PHASE6_STAGE_A_R2_STATE_COUNT_MISMATCH');
  if (state.sampleState === 'NOT_OPENED' && (state.openedAt != null || state.observations.length > 0)) throw new Error('PHASE6_STAGE_A_R2_UNOPENED_STATE_HAS_EVIDENCE');
  if (state.sampleState !== 'NOT_OPENED' && !state.openedAt) throw new Error('PHASE6_STAGE_A_R2_OPEN_STATE_MISSING_OPENED_AT');
  let previous: string | null = null;
  const ids = new Set<string>();
  let priorKey = '';
  for (const row of state.observations) {
    if (ids.has(row.id)) throw new Error(`PHASE6_STAGE_A_R2_STATE_DUPLICATE_ID:${row.id}`);
    ids.add(row.id);
    const key = `${row.informationDate}|${row.assetId}`;
    if (priorKey && key.localeCompare(priorKey) < 0) throw new Error('PHASE6_STAGE_A_R2_STATE_OBSERVATIONS_NOT_SORTED');
    priorKey = key;
    if (row.previousObservationHashSha256 !== previous) throw new Error(`PHASE6_STAGE_A_R2_STATE_HASH_CHAIN_PREVIOUS_MISMATCH:${row.id}`);
    const { observationHashSha256, ...payload } = row;
    const expected = sha256Canonical(payload);
    if (observationHashSha256 !== expected) throw new Error(`PHASE6_STAGE_A_R2_STATE_HASH_MISMATCH:${row.id}`);
    previous = observationHashSha256;
    if (row.marketDataSourceType === 'UNAVAILABLE' && row.gateStatus === 'ELIGIBLE') throw new Error(`PHASE6_STAGE_A_R2_UNAVAILABLE_DATA_CANNOT_BE_ELIGIBLE:${row.id}`);
    if (row.marketDataSourceType !== 'REAL' && row.marketDataSourceType !== 'UNAVAILABLE') throw new Error(`PHASE6_STAGE_A_R2_INVALID_DATA_PROVENANCE:${row.id}`);
  }
  const expectedLastDate = state.observations.at(-1)?.informationDate ?? null;
  if (state.lastInformationDate !== expectedLastDate) throw new Error('PHASE6_STAGE_A_R2_STATE_LAST_DATE_MISMATCH');
}
