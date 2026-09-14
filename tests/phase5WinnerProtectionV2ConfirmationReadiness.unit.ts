import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASE5_CONFIRMATION_ASSETS_PER_COHORT,
  PHASE5_CONFIRMATION_COHORT_COUNT,
  PHASE5_CONFIRMATION_COHORTS,
  PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_CONFIRMATION_DATA_START_DATE,
  PHASE5_CONFIRMATION_END_DATE,
  PHASE5_CONFIRMATION_FREQUENCY,
  PHASE5_CONFIRMATION_HORIZON_YEARS,
  PHASE5_CONFIRMATION_INITIAL_CAPITAL_EUR,
  PHASE5_CONFIRMATION_MATERIALITY_CAPITAL_PCT,
  PHASE5_CONFIRMATION_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP,
  PHASE5_CONFIRMATION_MINIMUM_CAUSAL_BARS,
  PHASE5_CONFIRMATION_PASS_MIN_POSITIVE_COHORTS,
  PHASE5_CONFIRMATION_REACH_MIN_COHORTS,
  PHASE5_CONFIRMATION_REACH_MIN_EXECUTED_REDUCTIONS,
  PHASE5_CONFIRMATION_REPLAY_START_DATE,
  PHASE5_CONFIRMATION_RISK_PROFILE,
  PHASE5_CONFIRMATION_SAMPLE,
  PHASE5_CONFIRMATION_SELECTION_RULE,
  PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP,
  PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL,
  PHASE5_CONFIRMATION_TARGET_ASSETS
} from '../scripts/phase5WinnerProtectionV2ConfirmationProtocol';
import {
  PHASE5_ASSETS_PER_COHORT,
  PHASE5_COHORT_COUNT,
  PHASE5_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_END_DATE,
  PHASE5_FREQUENCY,
  PHASE5_HORIZON_YEARS,
  PHASE5_INITIAL_CAPITAL_EUR,
  PHASE5_MATERIALITY_CAPITAL_PCT,
  PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP,
  PHASE5_MINIMUM_CAUSAL_BARS,
  PHASE5_PASS_MIN_POSITIVE_COHORTS,
  PHASE5_REACH_MIN_COHORTS,
  PHASE5_REACH_MIN_EXECUTED_REDUCTIONS,
  PHASE5_RISK_PROFILE,
  PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP,
  PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL,
  PHASE5_TARGET_ASSETS
} from '../scripts/phase5WinnerProtectionV2SampleProtocol';
import {
  PHASE5_SEALED_COHORTS,
  PHASE5_SEALED_SAMPLE
} from '../scripts/phase5WinnerProtectionV2SealedSample';

function check(ok: unknown, label: string): void {
  assert.ok(ok, label);
  console.log(`✓ ${label}`);
}

check(PHASE5_CONFIRMATION_DATA_START_DATE === '2004-01-02', 'Confirmation warm-up starts on the first clean post-blind year');
check(PHASE5_CONFIRMATION_DATA_START_DATE > PHASE5_END_DATE, 'Confirmation data request does not overlap consumed 2001-2003 blind');
check(PHASE5_CONFIRMATION_REPLAY_START_DATE === '2005-01-03', 'Confirmation scoring begins 2005-01-03');
check(PHASE5_CONFIRMATION_END_DATE === '2007-12-31', 'Confirmation scoring ends 2007-12-31');
check(PHASE5_CONFIRMATION_DATA_START_DATE < PHASE5_CONFIRMATION_REPLAY_START_DATE, 'Confirmation has a dedicated non-scored warm-up year');
check(PHASE5_CONFIRMATION_REPLAY_START_DATE < PHASE5_CONFIRMATION_END_DATE, 'Confirmation replay window is non-empty');
check(PHASE5_CONFIRMATION_END_DATE < '2009-01-05', 'Confirmation ends before consumed Phase 4 R3');
check(PHASE5_CONFIRMATION_END_DATE < '2011-01-01', 'Confirmation ends before Forward Risk evaluation windows');

check(PHASE5_CONFIRMATION_MINIMUM_CAUSAL_BARS === PHASE5_MINIMUM_CAUSAL_BARS && PHASE5_CONFIRMATION_MINIMUM_CAUSAL_BARS === 252, 'Confirmation preserves 252 causal warm-up bars');
check(PHASE5_CONFIRMATION_COHORT_COUNT === PHASE5_COHORT_COUNT && PHASE5_CONFIRMATION_COHORT_COUNT === 6, 'Confirmation preserves six cohorts');
check(PHASE5_CONFIRMATION_ASSETS_PER_COHORT === PHASE5_ASSETS_PER_COHORT && PHASE5_CONFIRMATION_ASSETS_PER_COHORT === 3, 'Confirmation preserves three assets per cohort');
check(PHASE5_CONFIRMATION_TARGET_ASSETS === PHASE5_TARGET_ASSETS && PHASE5_CONFIRMATION_TARGET_ASSETS === 18, 'Confirmation preserves 18 exact identities');
check(PHASE5_CONFIRMATION_INITIAL_CAPITAL_EUR === PHASE5_INITIAL_CAPITAL_EUR && PHASE5_CONFIRMATION_INITIAL_CAPITAL_EUR === 13_000, 'Confirmation preserves 13,000 EUR per cohort');
check(PHASE5_CONFIRMATION_FREQUENCY === PHASE5_FREQUENCY && PHASE5_CONFIRMATION_FREQUENCY === 'DAILY', 'Confirmation preserves DAILY review');
check(PHASE5_CONFIRMATION_RISK_PROFILE === PHASE5_RISK_PROFILE && PHASE5_CONFIRMATION_RISK_PROFILE === 'MEDIUM', 'Confirmation preserves MEDIUM risk');
check(PHASE5_CONFIRMATION_HORIZON_YEARS === PHASE5_HORIZON_YEARS && PHASE5_CONFIRMATION_HORIZON_YEARS === 3, 'Confirmation preserves three-year horizon');
check(PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL === PHASE5_CURRENT_DISCOVERY_HISTORICAL && PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL === false, 'Confirmation keeps current discovery historical OFF');

check(JSON.stringify(PHASE5_CONFIRMATION_SAMPLE.map(row => row.assetId)) === JSON.stringify(PHASE5_SEALED_SAMPLE.map(row => row.assetId)), 'Confirmation reuses exact first-blind asset identities without re-selection');
check(JSON.stringify(PHASE5_CONFIRMATION_COHORTS.map(cohort => cohort.map(row => row.assetId))) === JSON.stringify(PHASE5_SEALED_COHORTS.map(cohort => cohort.map(row => row.assetId))), 'Confirmation reuses exact first-blind cohort grouping');
check(PHASE5_CONFIRMATION_SELECTION_RULE === 'SAME_18_SEALED_IDENTITIES_AND_COHORTS_TEMPORAL_REPLICATION_NO_RESELECTION', 'Confirmation selection rule forbids cross-sectional re-selection');

check(PHASE5_CONFIRMATION_REACH_MIN_EXECUTED_REDUCTIONS === PHASE5_REACH_MIN_EXECUTED_REDUCTIONS && PHASE5_CONFIRMATION_REACH_MIN_EXECUTED_REDUCTIONS === 6, 'Confirmation preserves minimum six executed reductions');
check(PHASE5_CONFIRMATION_REACH_MIN_COHORTS === PHASE5_REACH_MIN_COHORTS && PHASE5_CONFIRMATION_REACH_MIN_COHORTS === 4, 'Confirmation preserves minimum four reached cohorts');
check(PHASE5_CONFIRMATION_PASS_MIN_POSITIVE_COHORTS === PHASE5_PASS_MIN_POSITIVE_COHORTS && PHASE5_CONFIRMATION_PASS_MIN_POSITIVE_COHORTS === 4, 'Confirmation preserves 4/6 positive cohort gate');
check(PHASE5_CONFIRMATION_MATERIALITY_CAPITAL_PCT === PHASE5_MATERIALITY_CAPITAL_PCT && PHASE5_CONFIRMATION_MATERIALITY_CAPITAL_PCT === 0.5, 'Confirmation preserves 0.5% materiality floor');
check(PHASE5_CONFIRMATION_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP === PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP && PHASE5_CONFIRMATION_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP === 0.5, 'Confirmation preserves median drawdown guardrail');
check(PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL === PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL && PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL === 5, 'Confirmation preserves single-cohort terminal damage guardrail');
check(PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP === PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP && PHASE5_CONFIRMATION_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP === 3, 'Confirmation preserves single-cohort drawdown guardrail');

const policy = fs.readFileSync('src/investment/decision/trendProtectionPolicy.ts', 'utf8');
check(policy.includes('const WINNER_ARM_MFE_PCT = 8;'), 'Confirmation preserves winner arm MFE 8%');
check(policy.includes('const WINNER_MIN_GIVEBACK_PP = 6;'), 'Confirmation preserves winner giveback 6 pp');
check(policy.includes('const WINNER_STRONG_GIVEBACK_PP = 8;'), 'Confirmation preserves strong giveback 8 pp');
check(policy.includes('const V2_WINNER_CONFIRM_STREAK = 3;'), 'Confirmation preserves streak 3');
check(policy.includes('const V2_WINNER_CONFIRM_PROTECTION_OBSERVATIONS = 3;'), 'Confirmation preserves three protection observations');
check(policy.includes('const V2_WINNER_MIN_WORSENING_AFTER_ARM_PP = 2;'), 'Confirmation preserves 2 pp worsening');
check(policy.includes('const V2_PARTIAL_REDUCTION_PCT = 25;'), 'Confirmation preserves one 25% reduction');

const preflight = fs.readFileSync('scripts/phase5WinnerProtectionV2ConfirmationPreflight.ts', 'utf8');
check(!preflight.includes('selectPhase5Assets') && !preflight.includes('phase5BlindOrder'), 'Confirmation preflight cannot re-select or re-rank assets');
check(!preflight.includes('runDynamicReplayWithRotationExperiment'), 'Confirmation preflight cannot execute the economic replay');
check(!preflight.includes('finalValueDeltaEur') && !preflight.includes('givebackFromMfePctPoints'), 'Confirmation preflight cannot inspect economic outcome diagnostics');

const firstOutcome = fs.readFileSync('docs/phase5_winner_protection_v2_final_outcome.md', 'utf8');
check(firstOutcome.includes('PASS_CANDIDATE_FOR_CONFIRMATION'), 'First Phase 5 blind is the PASS prerequisite for confirmation');

const prereg = fs.readFileSync('docs/phase5_winner_protection_v2_confirmation_preregistration.md', 'utf8');
check(prereg.includes('CONFIRMATION NOT OPENED'), 'Confirmation preregistration records holdout as unopened');
check(prereg.includes('2005-01-03') && prereg.includes('2007-12-31'), 'Confirmation preregistration freezes 2005-2007 scored window');
check(prereg.includes('2004-01-02') && prereg.includes('warm-up'), 'Confirmation preregistration freezes non-scored 2004 warm-up');
check(prereg.includes('mismos 18 activos') && prereg.includes('mismas 6 cohortes'), 'Confirmation preregistration freezes exact first-blind cross-section');
check(prereg.includes('sin retuning') && prereg.includes('sin reselección'), 'Confirmation preregistration explicitly forbids tuning and re-selection');
check(prereg.includes('Producción permanece `LEGACY`'), 'Confirmation preregistration keeps production LEGACY');
check(prereg.includes('baseline/candidato económico: **NO EJECUTADO**'), 'Confirmation preregistration records no economic outcome as opened');

console.log('PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_READINESS_PASS', JSON.stringify({
  sampleAssets: PHASE5_CONFIRMATION_SAMPLE.length,
  cohorts: PHASE5_CONFIRMATION_COHORTS.length,
  replayStartDate: PHASE5_CONFIRMATION_REPLAY_START_DATE,
  endDate: PHASE5_CONFIRMATION_END_DATE,
  selectionRule: PHASE5_CONFIRMATION_SELECTION_RULE
}));
