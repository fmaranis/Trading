import { createHash } from 'node:crypto';

export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 = 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1' as const;
export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_MARKER = 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_RESULT' as const;

export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL = {
  version: QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1,
  frozenAt: '2026-09-09',
  phase: 'A_PROSPECTIVE_ALLOCATION_SHOTS',
  purpose: 'COMPARE_FROZEN_LEGACY_VS_QUALITY_ALLOCATION_ON_FRESH_DYNAMIC_MARKET_SNAPSHOTS',
  architecture: 'CORE_ARCHITECTURE_V1',
  productionPolicy: 'LEGACY',
  candidatePolicy: 'QUALITY_ALLOCATION_BRIDGE_V1',
  gateSelectionPolicy: 'LEGACY_UNCHANGED',
  bridgeFormula: 'clamp(1 + candidateQualityAdjustment(reliability, opportunity)/100, 0.85, 1.15)',
  dynamicMarketMode: 'DYNAMIC_CURRENT_DISCOVERY',
  dynamicShortlistTarget: 64,
  currentDiscoveryMinimumPromotedAssets: 64,
  currentYahooDiscoveryRequired: true,
  realOnly: true,
  minimumBars: 252,
  maxDataAgeDays: 7,
  checkpointCadence: 'MONTHLY',
  firstEligibleCalendarMonth: '2026-09',
  maximumCheckpoints: 12,
  researchAllocationNotionalEur: 13_000,
  researchNotionalSemantics: 'INDEPENDENT_ALLOCATION_PROBE_NOT_RECURRING_CONTRIBUTION',
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  forwardOutcomeSessions: [20, 60] as const,
  executionAnchor: 'FIRST_REAL_OPEN_STRICTLY_AFTER_CHECKPOINT_RUN_DATE',
  outcomeMark: 'CLOSE_AFTER_N_SUBSEQUENT_SESSIONS_FROM_EXECUTION_SESSION',
  brokerExecution: 'ETF_ETC_INTEGER_UNITS_WITH_EXISTING_BROKER_COMMISSION_MUTUAL_FUNDS_FRACTIONAL',
  residualCashTreatment: 'COMPOUND_AT_FROZEN_2_5_PCT_ANNUAL_252_SESSIONS',
  observationIdentityPolicy: 'ONE_IMMUTABLE_OBSERVATION_PER_CALENDAR_MONTH',
  observationContinuityPolicy: 'HASH_CHAIN_NO_REWRITE_NO_BACKFILL',
  historicalReplayUsed: false,
  historicalYahooReconstructionAllowed: false,
  productionPromotionAllowedFromPhaseA: false,
  parameterRetuningAllowedAfterObservation: false,
  phaseAInterpretation: {
    minimumResolvedChangedPlan60SessionObservationsForDirectionalRead: 6,
    directionalPositiveRequiresMedianDeltaPctPointsAbove: 0,
    directionalPositiveRequiresWinRatePctAtLeast: 60,
    directProductionPromotion: false
  }
} as const;

export type QualityAllocationProspectivePolicy = 'LEGACY' | 'QUALITY_ALLOCATION_BRIDGE_V1';
export type QualityAllocationForwardHorizon = 20 | 60;

export interface QualityAllocationCandidateSnapshotRow {
  assetId: string;
  ticker: string;
  category: string;
  status: 'ACCEPTED' | 'REJECTED';
  reason: string | null;
  score: number | null;
  reliabilityScore: number | null;
  opportunityScore: number | null;
  asOfDate: string | null;
  provenance: string | null;
  openDiscovered: boolean;
}

export interface QualityAllocationPlanRow {
  assetId: string;
  ticker: string;
  category: string;
  instrumentType: string;
  amountEur: number;
  priorityScore: number | null;
  qualityAllocationMultiplier: number;
  opportunityLevel: string | null;
  timingState: string | null;
  suggestedInitialFraction: number | null;
}

export interface QualityAllocationArmSnapshot {
  policy: QualityAllocationProspectivePolicy;
  recommendedNewInvestmentEur: number;
  residualPlannedCashEur: number;
  targetCashEur: number;
  deployableToAssetsEur: number;
  contributionCount: number;
  contributions: QualityAllocationPlanRow[];
  planHashSha256: string;
}

export interface QualityAllocationObservationBody {
  id: string;
  calendarMonth: string;
  checkpointRunAt: string;
  checkpointRunDate: string;
  marketAsOfDate: string;
  researchFixture: {
    capitalEur: number;
    riskProfile: string;
    horizonYears: number;
    cashBenchmarkAnnualPct: number;
    noUserPortfolioData: true;
    notRecurringContribution: true;
  };
  discovery: {
    attempted: boolean;
    promotedAssets: number;
    generatedAt: string | null;
    error: string | null;
  };
  scanner: {
    scanned: number;
    accepted: number;
    rejected: number;
    rejectionCounts: Record<string, number>;
    shortlistSize: number;
    rankingVersion: string;
    candidatePool: QualityAllocationCandidateSnapshotRow[];
    shortlistAssetIds: string[];
    shortlistHashSha256: string;
  };
  gate: {
    selectionPolicy: string;
    eligibleCount: number;
    rejectedCount: number;
    selectedCount: number;
    eligibleAssetIds: string[];
  };
  decision: {
    asOfDate: string;
    marketRegime: string;
    cashWeight: number;
    recommendedMethod: string;
    confidence: string;
    confidenceScore: number;
    assets: Array<{ assetId: string; ticker: string; weight: number }>;
    decisionHashSha256: string;
  };
  arms: {
    legacy: QualityAllocationArmSnapshot;
    quality: QualityAllocationArmSnapshot;
    planChanged: boolean;
    absolutePlannedNotionalDeltaEur: number;
  };
}

export interface QualityAllocationObservation extends QualityAllocationObservationBody {
  previousChainHashSha256: string | null;
  observationHashSha256: string;
  chainHashSha256: string;
}

export interface QualityAllocationArmOutcome {
  policy: QualityAllocationProspectivePolicy;
  finalValueEur: number;
  returnPct: number;
  investedAtEntryEur: number;
  entryFeesEur: number;
  residualCashAtStartEur: number;
  evaluatedAssets: number;
}

export interface QualityAllocationOutcomeBody {
  observationId: string;
  calendarMonth: string;
  horizonSessions: QualityAllocationForwardHorizon;
  resolvedAt: string;
  status: 'RESOLVED';
  legacy: QualityAllocationArmOutcome;
  quality: QualityAllocationArmOutcome;
  qualityMinusLegacyPctPoints: number;
  qualityMinusLegacyFinalEur: number;
}

export interface QualityAllocationOutcome extends QualityAllocationOutcomeBody {
  outcomeHashSha256: string;
}

export interface QualityAllocationProspectiveState {
  version: typeof QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1;
  protocolFingerprintSha256: string;
  createdAt: string;
  observations: QualityAllocationObservation[];
  outcomes: QualityAllocationOutcome[];
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function protocolFingerprintSha256(): string {
  return sha256Canonical(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL);
}

export function createEmptyProspectiveState(createdAt: string): QualityAllocationProspectiveState {
  return {
    version: QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1,
    protocolFingerprintSha256: protocolFingerprintSha256(),
    createdAt,
    observations: [],
    outcomes: []
  };
}

export function addImmutableObservation(
  state: QualityAllocationProspectiveState,
  body: QualityAllocationObservationBody
): QualityAllocationObservation {
  verifyProspectiveState(state);
  const existing = state.observations.find(row => row.calendarMonth === body.calendarMonth);
  if (existing) {
    if (existing.id !== body.id) throw new Error(`QUALITY_FF_DUPLICATE_MONTH_CONFLICT:${body.calendarMonth}`);
    return existing;
  }
  if (state.observations.length >= QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.maximumCheckpoints) {
    throw new Error('QUALITY_FF_MAX_CHECKPOINTS_REACHED');
  }
  const previousChainHashSha256 = state.observations.at(-1)?.chainHashSha256 ?? null;
  const observationHashSha256 = sha256Canonical(body);
  const chainHashSha256 = sha256Canonical({ previousChainHashSha256, observationHashSha256 });
  const observation: QualityAllocationObservation = {
    ...body,
    previousChainHashSha256,
    observationHashSha256,
    chainHashSha256
  };
  state.observations.push(observation);
  verifyProspectiveState(state);
  return observation;
}

export function addImmutableOutcome(
  state: QualityAllocationProspectiveState,
  body: QualityAllocationOutcomeBody
): QualityAllocationOutcome {
  verifyProspectiveState(state);
  if (!state.observations.some(row => row.id === body.observationId)) {
    throw new Error(`QUALITY_FF_UNKNOWN_OBSERVATION:${body.observationId}`);
  }
  const existing = state.outcomes.find(row => row.observationId === body.observationId && row.horizonSessions === body.horizonSessions);
  const hash = sha256Canonical(body);
  if (existing) {
    if (existing.outcomeHashSha256 !== hash) throw new Error(`QUALITY_FF_OUTCOME_REWRITE_FORBIDDEN:${body.observationId}:${body.horizonSessions}`);
    return existing;
  }
  const outcome: QualityAllocationOutcome = { ...body, outcomeHashSha256: hash };
  state.outcomes.push(outcome);
  state.outcomes.sort((a, b) => a.observationId.localeCompare(b.observationId) || a.horizonSessions - b.horizonSessions);
  verifyProspectiveState(state);
  return outcome;
}

export function verifyProspectiveState(state: QualityAllocationProspectiveState): void {
  if (state.version !== QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1) throw new Error('QUALITY_FF_STATE_VERSION_MISMATCH');
  if (state.protocolFingerprintSha256 !== protocolFingerprintSha256()) throw new Error('QUALITY_FF_PROTOCOL_FINGERPRINT_MISMATCH');
  const months = new Set<string>();
  let previous: string | null = null;
  for (const observation of state.observations) {
    if (months.has(observation.calendarMonth)) throw new Error(`QUALITY_FF_DUPLICATE_MONTH:${observation.calendarMonth}`);
    months.add(observation.calendarMonth);
    if (observation.previousChainHashSha256 !== previous) throw new Error(`QUALITY_FF_CHAIN_PREVIOUS_MISMATCH:${observation.id}`);
    const { previousChainHashSha256, observationHashSha256, chainHashSha256, ...body } = observation;
    const expectedObservationHash = sha256Canonical(body);
    if (expectedObservationHash !== observationHashSha256) throw new Error(`QUALITY_FF_OBSERVATION_HASH_MISMATCH:${observation.id}`);
    const expectedChainHash = sha256Canonical({ previousChainHashSha256, observationHashSha256 });
    if (expectedChainHash !== chainHashSha256) throw new Error(`QUALITY_FF_CHAIN_HASH_MISMATCH:${observation.id}`);
    previous = chainHashSha256;
  }
  const outcomeKeys = new Set<string>();
  for (const outcome of state.outcomes) {
    const key = `${outcome.observationId}:${outcome.horizonSessions}`;
    if (outcomeKeys.has(key)) throw new Error(`QUALITY_FF_DUPLICATE_OUTCOME:${key}`);
    outcomeKeys.add(key);
    if (!state.observations.some(row => row.id === outcome.observationId)) throw new Error(`QUALITY_FF_ORPHAN_OUTCOME:${key}`);
    const { outcomeHashSha256, ...body } = outcome;
    if (sha256Canonical(body) !== outcomeHashSha256) throw new Error(`QUALITY_FF_OUTCOME_HASH_MISMATCH:${key}`);
  }
}

export function calendarMonthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function cashGrowthFactor(horizonSessions: number): number {
  const annual = QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.cashBenchmarkAnnualPct / 100;
  return Math.pow(1 + annual, horizonSessions / 252);
}

export function absolutePlanDeltaEur(a: QualityAllocationPlanRow[], b: QualityAllocationPlanRow[]): number {
  const aa = new Map(a.map(row => [row.assetId, row.amountEur]));
  const bb = new Map(b.map(row => [row.assetId, row.amountEur]));
  const ids = new Set([...aa.keys(), ...bb.keys()]);
  let total = 0;
  for (const id of ids) total += Math.abs((aa.get(id) ?? 0) - (bb.get(id) ?? 0));
  return total;
}

export function prospectivePhaseSummary(state: QualityAllocationProspectiveState) {
  verifyProspectiveState(state);
  const sixty = state.outcomes.filter(row => row.horizonSessions === 60);
  const changedObservationIds = new Set(state.observations.filter(row => row.arms.planChanged).map(row => row.id));
  const changedSixty = sixty.filter(row => changedObservationIds.has(row.observationId));
  const deltas = changedSixty.map(row => row.qualityMinusLegacyPctPoints).sort((a, b) => a - b);
  const median = deltas.length
    ? deltas.length % 2 ? deltas[Math.floor(deltas.length / 2)] : (deltas[deltas.length / 2 - 1] + deltas[deltas.length / 2]) / 2
    : null;
  const wins = deltas.filter(value => value > 0).length;
  const winRatePct = deltas.length ? wins / deltas.length * 100 : null;
  const gate = QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.phaseAInterpretation;
  let status = 'COLLECTING';
  if (changedSixty.length >= gate.minimumResolvedChangedPlan60SessionObservationsForDirectionalRead) {
    status = (median ?? -Infinity) > gate.directionalPositiveRequiresMedianDeltaPctPointsAbove
      && (winRatePct ?? 0) >= gate.directionalPositiveRequiresWinRatePctAtLeast
      ? 'DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B'
      : 'NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B';
  } else if (state.observations.length >= QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.maximumCheckpoints
    && changedSixty.length < gate.minimumResolvedChangedPlan60SessionObservationsForDirectionalRead) {
    status = 'INSUFFICIENT_REACH';
  }
  return {
    status,
    observations: state.observations.length,
    planChangedObservations: changedObservationIds.size,
    resolved20SessionOutcomes: state.outcomes.filter(row => row.horizonSessions === 20).length,
    resolved60SessionOutcomes: sixty.length,
    resolvedChangedPlan60SessionOutcomes: changedSixty.length,
    medianQualityMinusLegacy60PctPoints: median,
    winRateQualityVsLegacy60Pct: winRatePct,
    productionPolicyRemains: 'LEGACY',
    productionPromotionAllowed: false
  };
}
