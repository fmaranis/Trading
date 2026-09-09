import assert from 'node:assert/strict';
import {
  QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1,
  QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS,
  QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL as PROTOCOL,
  absolutePlanDeltaEur,
  addImmutableObservation,
  addImmutableOutcome,
  assessMonthlyCheckpointWindow,
  cashGrowthFactor,
  createEmptyProspectiveState,
  implementationFingerprintSha256,
  prospectivePhaseSummary,
  protocolFingerprintSha256,
  sha256Canonical,
  verifyFrozenImplementationSources,
  verifyProspectiveState,
  type QualityAllocationObservationBody,
  type QualityAllocationPlanRow,
  type QualityAllocationProspectiveState
} from '../scripts/qualityAllocationDynamicFutureForwardV1Protocol';
import { qualityAllocationMultiplierV1 } from '../src/investment/decision/portfolioDecisionEngine';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

function plan(assetId: string, amountEur: number, multiplier = 1): QualityAllocationPlanRow {
  return {
    assetId,
    ticker: `${assetId}.DE`,
    category: 'EUROPE_EQUITY',
    instrumentType: 'ETF_ETC',
    amountEur,
    priorityScore: 1,
    qualityAllocationMultiplier: multiplier,
    opportunityLevel: 'GOOD_ENTRY',
    timingState: 'ENTRY_READY',
    suggestedInitialFraction: 0.5
  };
}

function monthAt(offset: number): string {
  const d = new Date(Date.UTC(2026, 8 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function observationBody(
  month: string,
  legacy = [plan('A', 1000)],
  quality = [plan('A', 1000, 1.05)]
): QualityAllocationObservationBody {
  const delta = absolutePlanDeltaEur(legacy, quality);
  return {
    id: `QUALITY_FF_${month}`,
    calendarMonth: month,
    checkpointRunAt: `${month}-09T20:45:00.000Z`,
    checkpointRunDate: `${month}-09`,
    marketAsOfDate: `${month}-09`,
    implementation: {
      fingerprintSha256: implementationFingerprintSha256(),
      frozenSourceCount: Object.keys(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS).length
    },
    researchFixture: {
      capitalEur: PROTOCOL.researchAllocationNotionalEur,
      riskProfile: PROTOCOL.riskProfile,
      horizonYears: PROTOCOL.horizonYears,
      cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPct,
      noUserPortfolioData: true,
      notRecurringContribution: true
    },
    discovery: { attempted: true, promotedAssets: 98, generatedAt: `${month}-09T20:40:00Z`, error: null },
    scanner: {
      scanned: 160,
      accepted: 155,
      rejected: 5,
      rejectionCounts: { TEST: 5 },
      shortlistSize: 64,
      rankingVersion: 'MARKET_SHORTLIST_LEGACY_SCORE_V1',
      candidatePool: [{
        assetId: 'A', ticker: 'A.DE', category: 'EUROPE_EQUITY', status: 'ACCEPTED', reason: null,
        score: 10, reliabilityScore: 70, opportunityScore: 80, asOfDate: `${month}-09`, provenance: 'REAL', openDiscovered: true
      }],
      shortlistAssetIds: ['A'],
      shortlistHashSha256: sha256Canonical(['A'])
    },
    gate: { selectionPolicy: 'LEGACY', eligibleCount: 1, rejectedCount: 0, selectedCount: 1, eligibleAssetIds: ['A'] },
    decision: {
      asOfDate: `${month}-09`, marketRegime: 'BULL_LOW_VOL', cashWeight: 0.2, recommendedMethod: 'RISK_PARITY_ERC',
      confidence: 'MEDIUM', confidenceScore: 80, assets: [{ assetId: 'A', ticker: 'A.DE', weight: 0.8 }],
      decisionHashSha256: sha256Canonical({ assetId: 'A', weight: 0.8 })
    },
    arms: {
      legacy: {
        policy: 'LEGACY', recommendedNewInvestmentEur: legacy.reduce((s, x) => s + x.amountEur, 0), residualPlannedCashEur: 12000,
        targetCashEur: 2600, deployableToAssetsEur: 10400, contributionCount: legacy.length, contributions: legacy,
        planHashSha256: sha256Canonical(legacy)
      },
      quality: {
        policy: 'QUALITY_ALLOCATION_BRIDGE_V1', recommendedNewInvestmentEur: quality.reduce((s, x) => s + x.amountEur, 0), residualPlannedCashEur: 12000,
        targetCashEur: 2600, deployableToAssetsEur: 10400, contributionCount: quality.length, contributions: quality,
        planHashSha256: sha256Canonical(quality)
      },
      planChanged: delta > 0.01,
      absolutePlannedNotionalDeltaEur: delta
    }
  };
}

function addPositive60Outcome(state: QualityAllocationProspectiveState, observationId: string, calendarMonth: string): void {
  addImmutableOutcome(state, {
    observationId,
    calendarMonth,
    horizonSessions: 60,
    resolvedAt: '2028-01-01T20:00:00Z',
    status: 'RESOLVED',
    legacy: {
      policy: 'LEGACY', finalValueEur: 13100, returnPct: 0.7692, investedAtEntryEur: 1000,
      entryFeesEur: 2, residualCashAtStartEur: 12000, evaluatedAssets: 1
    },
    quality: {
      policy: 'QUALITY_ALLOCATION_BRIDGE_V1', finalValueEur: 13200, returnPct: 1.5385, investedAtEntryEur: 1000,
      entryFeesEur: 2, residualCashAtStartEur: 12000, evaluatedAssets: 1
    },
    qualityMinusLegacyPctPoints: 0.7693,
    qualityMinusLegacyFinalEur: 100
  });
}

check('901 protocol version and architecture are frozen', () => {
  assert.equal(PROTOCOL.version, QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1);
  assert.equal(PROTOCOL.architecture, 'CORE_ARCHITECTURE_V1');
  assert.equal(PROTOCOL.productionPolicy, 'LEGACY');
  assert.equal(PROTOCOL.candidatePolicy, 'QUALITY_ALLOCATION_BRIDGE_V1');
});
check('902 protocol freezes dynamic rules rather than asset identities', () => {
  assert.equal(PROTOCOL.dynamicMarketMode, 'DYNAMIC_CURRENT_DISCOVERY');
  assert.equal(PROTOCOL.dynamicShortlistTarget, 64);
  assert.equal(PROTOCOL.currentYahooDiscoveryRequired, true);
  assert.equal('fixedAssetIds' in PROTOCOL, false);
});
check('903 research capital is an independent probe and not a recurring contribution', () => {
  assert.equal(PROTOCOL.researchAllocationNotionalEur, 13_000);
  assert.equal(PROTOCOL.researchNotionalSemantics, 'INDEPENDENT_ALLOCATION_PROBE_NOT_RECURRING_CONTRIBUTION');
  assert.equal(PROTOCOL.checkpointCadence, 'MONTHLY');
});
check('904 bridge formula remains the pre-existing frozen bounded multiplier', () => {
  assert.equal(qualityAllocationMultiplierV1(100, 100), 1.15);
  assert.equal(qualityAllocationMultiplierV1(0, 0), 0.85);
  assert.equal(qualityAllocationMultiplierV1(50, 50), 1);
});
check('905 Phase A cannot promote production or retune after observation', () => {
  assert.equal(PROTOCOL.productionPromotionAllowedFromPhaseA, false);
  assert.equal(PROTOCOL.parameterRetuningAllowedAfterObservation, false);
  assert.equal(PROTOCOL.phaseAInterpretation.directProductionPromotion, false);
});
check('906 protocol and implementation fingerprints are deterministic', () => {
  assert.equal(protocolFingerprintSha256(), protocolFingerprintSha256());
  assert.equal(protocolFingerprintSha256().length, 64);
  assert.equal(implementationFingerprintSha256().length, 64);
  assert.ok(Object.keys(QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS).length >= 25);
});
check('907 all methodology-critical source blobs still match the frozen manifest', () => {
  verifyFrozenImplementationSources();
});
check('908 monthly checkpoint window is frozen after European close and before midnight', () => {
  assert.equal(assessMonthlyCheckpointWindow({ localDate: '2026-09-09', localHour: 22, localMinute: 29 }), 'BEFORE_WINDOW');
  assert.equal(assessMonthlyCheckpointWindow({ localDate: '2026-09-09', localHour: 22, localMinute: 30 }), 'OPEN');
  assert.equal(assessMonthlyCheckpointWindow({ localDate: '2026-09-09', localHour: 23, localMinute: 59 }), 'OPEN');
  assert.equal(assessMonthlyCheckpointWindow({ localDate: '2026-09-10', localHour: 0, localMinute: 0 }), 'AFTER_WINDOW');
});
check('909 durable GitHub state is authoritative and local runtime is cache only', () => {
  assert.equal(PROTOCOL.durableStateAuthority, 'GITHUB_REPLAY_RESULTS');
  assert.equal(PROTOCOL.durableStatePath, 'validation-runs/quality-allocation-dynamic-future-forward-v1-state.json');
  assert.equal(PROTOCOL.localRuntimeStateIsAuthoritative, false);
});
check('910 first observation is hash-chained and state verifies', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  const observation = addImmutableObservation(state, observationBody('2026-09'));
  assert.equal(observation.previousChainHashSha256, null);
  assert.equal(observation.observationHashSha256.length, 64);
  assert.equal(observation.chainHashSha256.length, 64);
  verifyProspectiveState(state);
});
check('911 duplicate month cannot overwrite the observed snapshot', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  const first = addImmutableObservation(state, observationBody('2026-09'));
  const altered = observationBody('2026-09', [plan('A', 1000)], [plan('B', 2000)]);
  const second = addImmutableObservation(state, altered);
  assert.equal(second.observationHashSha256, first.observationHashSha256);
  assert.equal(state.observations.length, 1);
});
check('912 tampering with an observed snapshot is detected', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  addImmutableObservation(state, observationBody('2026-09'));
  state.observations[0].scanner.accepted = 999;
  assert.throws(() => verifyProspectiveState(state), /QUALITY_FF_OBSERVATION_HASH_MISMATCH/);
});
check('913 observation chain detects deletion or reordering discontinuity', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  addImmutableObservation(state, observationBody('2026-09'));
  addImmutableObservation(state, observationBody('2026-10'));
  state.observations.shift();
  assert.throws(() => verifyProspectiveState(state), /QUALITY_FF_NON_CONSECUTIVE_STATE_MONTH|QUALITY_FF_CHAIN_PREVIOUS_MISMATCH/);
});
check('914 skipped calendar months are forbidden rather than silently selected away', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  addImmutableObservation(state, observationBody('2026-09'));
  assert.throws(() => addImmutableObservation(state, observationBody('2026-11')), /QUALITY_FF_NON_CONSECUTIVE_OBSERVATION_MONTH:2026-10:2026-11/);
});
check('915 outcomes are append-only and a rewrite is rejected', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  const observation = addImmutableObservation(state, observationBody('2026-09', [plan('A', 1000)], [plan('B', 1000)]));
  addPositive60Outcome(state, observation.id, observation.calendarMonth);
  assert.throws(() => addImmutableOutcome(state, {
    observationId: observation.id,
    calendarMonth: observation.calendarMonth,
    horizonSessions: 60,
    resolvedAt: '2028-01-01T20:00:00Z',
    status: 'RESOLVED',
    legacy: { policy: 'LEGACY', finalValueEur: 13100, returnPct: 0.7692, investedAtEntryEur: 1000, entryFeesEur: 2, residualCashAtStartEur: 12000, evaluatedAssets: 1 },
    quality: { policy: 'QUALITY_ALLOCATION_BRIDGE_V1', finalValueEur: 13200, returnPct: 1.5385, investedAtEntryEur: 1000, entryFeesEur: 2, residualCashAtStartEur: 12000, evaluatedAssets: 1 },
    qualityMinusLegacyPctPoints: 0.7693,
    qualityMinusLegacyFinalEur: 101
  }), /QUALITY_FF_OUTCOME_REWRITE_FORBIDDEN/);
});
check('916 frozen cash treatment grows but never creates a monthly contribution', () => {
  assert.ok(cashGrowthFactor(60) > 1);
  assert.ok(cashGrowthFactor(60) < 1.02);
});
check('917 absolute plan delta separates allocation reach from economic outcome', () => {
  assert.equal(absolutePlanDeltaEur([plan('A', 1000)], [plan('A', 800), plan('B', 200)]), 400);
  assert.equal(absolutePlanDeltaEur([plan('A', 1000)], [plan('A', 1000)]), 0);
});
check('918 Phase A does not issue an economic verdict before all 12 checkpoints', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  for (let i = 0; i < 6; i++) {
    const month = monthAt(i);
    const observation = addImmutableObservation(state, observationBody(month, [plan('A', 1000)], [plan('A', 900), plan('B', 100)]));
    addPositive60Outcome(state, observation.id, month);
  }
  assert.equal(prospectivePhaseSummary(state).status, 'COLLECTING');
});
check('919 after 12 checkpoints fewer than six changed plans means insufficient reach', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  for (let i = 0; i < 12; i++) {
    const month = monthAt(i);
    const changed = i < 5;
    addImmutableObservation(state, observationBody(
      month,
      [plan('A', 1000)],
      changed ? [plan('A', 900), plan('B', 100)] : [plan('A', 1000, 1.05)]
    ));
  }
  assert.equal(prospectivePhaseSummary(state).status, 'INSUFFICIENT_REACH');
});
check('920 after 12 checkpoints sufficient reach waits for all changed-plan 60-session outcomes', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  for (let i = 0; i < 12; i++) {
    const month = monthAt(i);
    const changed = i < 6;
    addImmutableObservation(state, observationBody(
      month,
      [plan('A', 1000)],
      changed ? [plan('A', 900), plan('B', 100)] : [plan('A', 1000, 1.05)]
    ));
  }
  const summary = prospectivePhaseSummary(state);
  assert.equal(summary.status, 'AWAITING_60_SESSION_MATURITY');
  assert.equal(summary.unresolvedChangedPlan60SessionOutcomes, 6);
});
check('921 final directional read uses all changed-plan outcomes only after full collection and maturity', () => {
  const state = createEmptyProspectiveState('2026-09-09T20:45:00Z');
  for (let i = 0; i < 12; i++) {
    const month = monthAt(i);
    const changed = i < 6;
    const observation = addImmutableObservation(state, observationBody(
      month,
      [plan('A', 1000)],
      changed ? [plan('A', 900), plan('B', 100)] : [plan('A', 1000, 1.05)]
    ));
    if (changed) addPositive60Outcome(state, observation.id, month);
  }
  const summary = prospectivePhaseSummary(state);
  assert.equal(summary.status, 'DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B');
  assert.equal(summary.resolvedChangedPlan60SessionOutcomes, 6);
  assert.equal(summary.productionPolicyRemains, 'LEGACY');
  assert.equal(summary.productionPromotionAllowed, false);
});

console.log(`QUALITY allocation dynamic future-forward V1: ${passed}/21 invariants passed.`);
