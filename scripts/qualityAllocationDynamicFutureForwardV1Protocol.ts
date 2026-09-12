import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 = 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1' as const;
export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_MARKER = 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_RESULT' as const;

/**
 * Methodology-critical implementation files are frozen by their Git blob SHA-1.
 * The experiment may continue while unrelated UI/product code evolves, but if
 * one of these files changes the existing Phase A must stop rather than silently
 * mixing a new implementation into the same prospective sample.
 *
 * The protocol file itself is protected by protocolFingerprintSha256(), so it is
 * deliberately not self-listed here. The runner/state-store can be listed without
 * a circular dependency because changing this protocol does not change their blobs.
 */
export const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS = {
  'server/assetDiscoveryRoutes.ts': '0879aa660c12d2f962bbb6d564f057e42a616642',
  'server/marketDataRoutes.ts': '125547bc9f6de117918c2e4ed951edcaf52ee9d9',
  'src/investment/data/marketData/historicalMarketDataService.ts': '76eec06e4ea9ed3604492887c4e80c75f58f1887',
  'src/investment/data/marketData/providers/realMarketDataProvider.ts': 'dc99dd4193f018f56aea91eb5ad772f37e44c44b',
  'src/investment/decision/assetUniverseScanner.ts': '6a8d09f136909bf7a15acbf4b40ed40dfc1115b4',
  'src/investment/decision/assetSelectionQuality.ts': '75bc51cb673cfc6b975e79130dc637d0ffd9503e',
  'src/investment/decision/openMarketDiscoveryV1.ts': 'dfa6b8a92f1fb05da67ba530b81d2773ea726369',
  'src/investment/decision/portfolioDiscoveryUniverse.ts': 'f34772dc64daac5a947d50ad55037f69edd5c78c',
  'src/investment/decision/portfolioCandidateGate.ts': 'adb8b18b48b4d3188c0d235d901982d9d5c93a88',
  'src/investment/decision/strategyConsensusEngine.ts': '1562f219a073d31f4ff107cbab33f43aa4a4a25d',
  'src/investment/decision/entryTiming.ts': 'dd99821d797da27861f9e64956a2c840c3dc1beb',
  'src/investment/decision/currentOpportunityAlerts.ts': '85f654df9862c8f15149612c33f415fef6eac9ef',
  'src/investment/decision/investmentDecisionEngine.ts': 'bc7bcf5fb5a31fd3c1189f87fa13cca9572a8ee3',
  'src/investment/decision/portfolioDecisionEngine.ts': 'c7e81633db4fac5278784262f72c0e5d7fb05c8b',
  'src/investment/decision/adaptiveExecutionPolicy.ts': '0d0ca2da99ac7ff26b2752b4f2d557664c6ba5a0',
  'src/investment/decision/costAwareExecutionPolicy.ts': 'f6bde7b63d104d12a63737dfb8e1c9bc59042bf5',
  'src/investment/decision/brokerExecution.ts': 'dbe4fd3dc1ff39d44533f65b2670b04445d9a829',
  'src/investment/decision/cashBenchmark.ts': 'baa6d0ebc9e6bc4b5225e36572fd085b1d39844f',
  'src/investment/portfolioAnalytics/allocationStrategies.ts': 'dc3b165099112c615be356eef9ee705765ac08ad',
  'src/investment/portfolioAnalytics/realPortfolioAnalytics.ts': '84a6f3c77e3f1cc2e89fd8adedde058340dee3fe',
  'src/investment/portfolioAnalytics/portfolioRisk.ts': '864ba2734f62b27906954951f43b62ac8ee35cee',
  'src/investment/portfolioRegimes/deterministicRegimeClassifier.ts': 'fffe0f922f4727a5d52f3c7994c831cb23225bb4',
  'src/investment/portfolioBacktesting/multiAssetDataAligner.ts': '3960f5a697b92e8fcd02926b2a971b4abe50b9ef',
  'scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts': 'b55ebc611b95e91060d7c7e8aacb0fef00c6839c',
  'scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts': '162e001ca4c5ae0ab7549a1cfbac8ef2853bf0a7'
} as const;

/**
 * Audited compatibility exception, frozen after observation 1/12 already existed.
 * Commit 644526b only extended the ECB DFR lookup table with 1999-2011 points so
 * older causal replays do not backfill the 2011 rate. QUALITY Future Forward does
 * not use historical ECB mode: its candidate gate, portfolio arms and residual
 * cash all use the protocol-fixed 2.5% rate on current/future snapshots. The
 * original manifest remains untouched so the protocol fingerprint and existing
 * hash-chained observation stay identical. Only this exact reviewed replacement
 * blob is accepted; any later cashBenchmark.ts change still fails closed.
 */
const QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_COMPATIBLE_GIT_BLOB_DRIFTS: Readonly<Record<string, readonly string[]>> = {
  'src/investment/decision/cashBenchmark.ts': ['7116e98b8df2621f63328f2224fc6b5528b5d076']
};

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
  checkpointWindow: {
    timeZone: 'Europe/Madrid',
    startDayOfMonth: 9,
    startHourLocal: 22,
    startMinuteLocal: 30,
    durationMinutes: 90,
    rule: 'DAY_9_AFTER_EUROPEAN_CLOSE_UNTIL_MIDNIGHT_ONLY_NO_BACKFILL'
  },
  maximumCheckpoints: 12,
  requiredConsecutiveCalendarMonths: true,
  researchAllocationNotionalEur: 13_000,
  researchNotionalSemantics: 'INDEPENDENT_ALLOCATION_PROBE_NOT_RECURRING_CONTRIBUTION',
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  forwardOutcomeSessions: [20, 60] as const,
  executionAnchor: 'FIRST_REAL_OPEN_STRICTLY_AFTER_CHECKPOINT_RUN_DATE_FIXED_AFTER_CLOSE_WINDOW',
  outcomeMark: 'CLOSE_AFTER_N_SUBSEQUENT_SESSIONS_FROM_EXECUTION_SESSION',
  brokerExecution: 'ETF_ETC_INTEGER_UNITS_WITH_EXISTING_BROKER_COMMISSION_MUTUAL_FUNDS_FRACTIONAL',
  outcomePriceTreatment: 'RAW_NEXT_OPEN_FOR_UNIT_SIZING_PLUS_ADJUSTED_TOTAL_RETURN_FACTOR_TO_MARK',
  residualCashTreatment: 'COMPOUND_AT_FROZEN_2_5_PCT_ANNUAL_252_SESSIONS',
  observationIdentityPolicy: 'ONE_IMMUTABLE_OBSERVATION_PER_CALENDAR_MONTH',
  observationContinuityPolicy: 'HASH_CHAIN_NO_REWRITE_NO_BACKFILL_NO_SKIPPED_MONTHS',
  implementationContinuityPolicy: 'FROZEN_METHODOLOGY_CRITICAL_GIT_BLOB_MANIFEST',
  durableStateAuthority: 'GITHUB_REPLAY_RESULTS',
  durableStatePath: 'validation-runs/quality-allocation-dynamic-future-forward-v1-state.json',
  localRuntimeStateIsAuthoritative: false,
  historicalReplayUsed: false,
  historicalYahooReconstructionAllowed: false,
  productionPromotionAllowedFromPhaseA: false,
  parameterRetuningAllowedAfterObservation: false,
  phaseAInterpretation: {
    minimumChangedPlanObservationsForEconomicRead: 6,
    finalEconomicReadRequiresMaximumCheckpoints: true,
    finalEconomicReadRequiresAllChangedPlan60SessionOutcomesResolved: true,
    directionalPositiveRequiresMedianDeltaPctPointsAbove: 0,
    directionalPositiveRequiresWinRatePctAtLeast: 60,
    directProductionPromotion: false
  }
} as const;

export type QualityAllocationProspectivePolicy = 'LEGACY' | 'QUALITY_ALLOCATION_BRIDGE_V1';
export type QualityAllocationForwardHorizon = 20 | 60;
export type QualityAllocationCheckpointWindowStatus = 'OPEN' | 'BEFORE_WINDOW' | 'AFTER_WINDOW';

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
  implementation: {
    fingerprintSha256: string;
    frozenSourceCount: number;
  };
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
  return sha256Canonical({
    protocol: QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL,
    frozenGitBlobs: QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS
  });
}

function gitBlobSha1(buffer: Buffer): string {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

export function currentImplementationGitBlobShas(): Record<string, string> {
  return Object.fromEntries(Object.keys(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS).map(filePath => {
    const absolute = path.resolve(process.cwd(), filePath);
    return [filePath, gitBlobSha1(readFileSync(absolute))];
  }));
}

export function implementationFingerprintSha256(): string {
  return sha256Canonical(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS);
}

export function verifyFrozenImplementationSources(): void {
  const current = currentImplementationGitBlobShas();
  for (const [filePath, expected] of Object.entries(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS)) {
    const actual = current[filePath];
    if (actual === expected) continue;
    const compatible = actual != null
      && (QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_COMPATIBLE_GIT_BLOB_DRIFTS[filePath]?.includes(actual) ?? false);
    if (compatible) continue;
    throw new Error(`QUALITY_FF_FROZEN_IMPLEMENTATION_CHANGED:${filePath}:${expected}:${actual}`);
  }
}

export function assessMonthlyCheckpointWindow(input: {
  localDate: string;
  localHour: number;
  localMinute: number;
}): QualityAllocationCheckpointWindowStatus {
  const day = Number(input.localDate.slice(8, 10));
  const minuteIndex = (day - 1) * 1440 + input.localHour * 60 + input.localMinute;
  const window = QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.checkpointWindow;
  const start = (window.startDayOfMonth - 1) * 1440 + window.startHourLocal * 60 + window.startMinuteLocal;
  const end = start + window.durationMinutes;
  if (minuteIndex < start) return 'BEFORE_WINDOW';
  if (minuteIndex >= end) return 'AFTER_WINDOW';
  return 'OPEN';
}

function nextCalendarMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, monthNumber, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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
  const priorMonth = state.observations.at(-1)?.calendarMonth ?? null;
  const expectedMonth = priorMonth ? nextCalendarMonth(priorMonth) : QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.firstEligibleCalendarMonth;
  if (body.calendarMonth !== expectedMonth) {
    throw new Error(`QUALITY_FF_NON_CONSECUTIVE_OBSERVATION_MONTH:${expectedMonth}:${body.calendarMonth}`);
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
  let priorMonth: string | null = null;
  for (const observation of state.observations) {
    if (months.has(observation.calendarMonth)) throw new Error(`QUALITY_FF_DUPLICATE_MONTH:${observation.calendarMonth}`);
    const expectedMonth = priorMonth ? nextCalendarMonth(priorMonth) : QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.firstEligibleCalendarMonth;
    if (observation.calendarMonth !== expectedMonth) throw new Error(`QUALITY_FF_NON_CONSECUTIVE_STATE_MONTH:${expectedMonth}:${observation.calendarMonth}`);
    months.add(observation.calendarMonth);
    if (observation.previousChainHashSha256 !== previous) throw new Error(`QUALITY_FF_CHAIN_PREVIOUS_MISMATCH:${observation.id}`);
    const { previousChainHashSha256, observationHashSha256, chainHashSha256, ...body } = observation;
    const expectedObservationHash = sha256Canonical(body);
    if (expectedObservationHash !== observationHashSha256) throw new Error(`QUALITY_FF_OBSERVATION_HASH_MISMATCH:${observation.id}`);
    const expectedChainHash = sha256Canonical({ previousChainHashSha256, observationHashSha256 });
    if (expectedChainHash !== chainHashSha256) throw new Error(`QUALITY_FF_CHAIN_HASH_MISMATCH:${observation.id}`);
    previous = chainHashSha256;
    priorMonth = observation.calendarMonth;
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
  const resolvedChangedIds = new Set(changedSixty.map(row => row.observationId));
  const unresolvedChangedPlan60SessionOutcomes = [...changedObservationIds].filter(id => !resolvedChangedIds.has(id)).length;
  const deltas = changedSixty.map(row => row.qualityMinusLegacyPctPoints).sort((a, b) => a - b);
  const median = deltas.length
    ? deltas.length % 2 ? deltas[Math.floor(deltas.length / 2)] : (deltas[deltas.length / 2 - 1] + deltas[deltas.length / 2]) / 2
    : null;
  const wins = deltas.filter(value => value > 0).length;
  const winRatePct = deltas.length ? wins / deltas.length * 100 : null;
  const gate = QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.phaseAInterpretation;
  const reachedMaximumCheckpoints = state.observations.length >= QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL.maximumCheckpoints;
  let status = 'COLLECTING';
  if (reachedMaximumCheckpoints) {
    if (changedObservationIds.size < gate.minimumChangedPlanObservationsForEconomicRead) {
      status = 'INSUFFICIENT_REACH';
    } else if (unresolvedChangedPlan60SessionOutcomes > 0) {
      status = 'AWAITING_60_SESSION_MATURITY';
    } else {
      status = (median ?? -Infinity) > gate.directionalPositiveRequiresMedianDeltaPctPointsAbove
        && (winRatePct ?? 0) >= gate.directionalPositiveRequiresWinRatePctAtLeast
        ? 'DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B'
        : 'NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B';
    }
  }
  return {
    status,
    observations: state.observations.length,
    planChangedObservations: changedObservationIds.size,
    resolved20SessionOutcomes: state.outcomes.filter(row => row.horizonSessions === 20).length,
    resolved60SessionOutcomes: sixty.length,
    resolvedChangedPlan60SessionOutcomes: changedSixty.length,
    unresolvedChangedPlan60SessionOutcomes,
    medianQualityMinusLegacy60PctPoints: median,
    winRateQualityVsLegacy60Pct: winRatePct,
    productionPolicyRemains: 'LEGACY',
    productionPromotionAllowed: false
  };
}
