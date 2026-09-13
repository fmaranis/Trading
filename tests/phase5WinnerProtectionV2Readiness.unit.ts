import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PHASE5_ASSETS_PER_COHORT,
  PHASE5_CANDIDATE_POOL,
  PHASE5_COHORT_COUNT,
  PHASE5_CONSUMED_TICKERS,
  PHASE5_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_DATA_START_DATE,
  PHASE5_END_DATE,
  PHASE5_FREQUENCY,
  PHASE5_INITIAL_CAPITAL_EUR,
  PHASE5_MATERIALITY_CAPITAL_PCT,
  PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP,
  PHASE5_MINIMUM_CAUSAL_BARS,
  PHASE5_PASS_MIN_POSITIVE_COHORTS,
  PHASE5_REACH_MIN_COHORTS,
  PHASE5_REACH_MIN_EXECUTED_REDUCTIONS,
  PHASE5_REPLAY_START_DATE,
  PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP,
  PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL,
  PHASE5_TARGET_ASSETS,
  phase5BlindOrder
} from '../scripts/phase5WinnerProtectionV2SampleProtocol';
import {
  PHASE5_SEALED_COHORTS,
  PHASE5_SEALED_SAMPLE,
  PHASE5_SEALED_SAMPLE_STATE
} from '../scripts/phase5WinnerProtectionV2SealedSample';

function check(ok: unknown, label: string): void {
  assert.ok(ok, label);
  console.log(`✓ ${label}`);
}

const tickers = PHASE5_CANDIDATE_POOL.map(asset => asset.ticker.toUpperCase());
const assetIds = PHASE5_CANDIDATE_POOL.map(asset => asset.assetId);

check(PHASE5_DATA_START_DATE < PHASE5_REPLAY_START_DATE, 'Phase 5 data begins before replay');
check(PHASE5_REPLAY_START_DATE === '2001-01-03', 'Phase 5 replay start is explicitly refrozen after coverage-only preflight');
check(PHASE5_END_DATE === '2003-12-31', 'Phase 5 ends before consumed R2 starts');
check(PHASE5_REPLAY_START_DATE < PHASE5_END_DATE, 'Phase 5 refrozen replay window remains non-empty');
check(PHASE5_END_DATE < '2004-01-01', 'Phase 5 remains wholly before consumed R2');
check(PHASE5_END_DATE < '2009-01-05', 'Phase 5 remains before consumed R3');
check(PHASE5_END_DATE < '2011-01-01', 'Phase 5 remains before 2011+ Forward Risk research');
check(PHASE5_MINIMUM_CAUSAL_BARS === 252, 'Phase 5 preserves 252 causal pre-replay bars');
check(PHASE5_COHORT_COUNT === 6 && PHASE5_ASSETS_PER_COHORT === 3 && PHASE5_TARGET_ASSETS === 18, 'Phase 5 cohort design is frozen 6x3');
check(PHASE5_FREQUENCY === 'DAILY', 'Phase 5 uses daily review for session-based protection state');
check(PHASE5_CURRENT_DISCOVERY_HISTORICAL === false, 'Phase 5 forbids current discovery in historical replay');
check(PHASE5_CANDIDATE_POOL.length > PHASE5_TARGET_ASSETS, 'Phase 5 coverage pool is larger than final sample');
check(new Set(tickers).size === tickers.length, 'Phase 5 coverage pool tickers are unique');
check(new Set(assetIds).size === assetIds.length, 'Phase 5 coverage pool assetIds are unique');
check(assetIds.every(assetId => assetId.startsWith('EQ_PH5_')), 'Phase 5 pool uses isolated research identities');
check(tickers.every(ticker => !PHASE5_CONSUMED_TICKERS.has(ticker)), 'Phase 5 pool excludes HFG and consumed R2/R3 tickers');
check(PHASE5_CANDIDATE_POOL.every(asset => asset.currency === 'EUR'), 'Phase 5 pool remains EUR-only');
check(PHASE5_CANDIDATE_POOL.every(asset => asset.instrumentType == null || asset.instrumentType === 'ETF_ETC'), 'Phase 5 pool contains listed instruments only');

const deterministicA = [...PHASE5_CANDIDATE_POOL].sort((a, b) => phase5BlindOrder(a).localeCompare(phase5BlindOrder(b))).map(asset => asset.assetId);
const deterministicB = [...PHASE5_CANDIDATE_POOL].reverse().sort((a, b) => phase5BlindOrder(a).localeCompare(phase5BlindOrder(b))).map(asset => asset.assetId);
check(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), 'Phase 5 blind ordering is input-order independent');

check(PHASE5_SEALED_SAMPLE_STATE === 'SEALED_NOT_OPENED', 'Phase 5 sample is sealed and not economically opened');
check(PHASE5_SEALED_SAMPLE.length === PHASE5_TARGET_ASSETS, 'Phase 5 seal contains exactly 18 assets');
check(PHASE5_SEALED_COHORTS.length === PHASE5_COHORT_COUNT, 'Phase 5 seal contains exactly 6 cohorts');
check(PHASE5_SEALED_COHORTS.every(cohort => cohort.length === PHASE5_ASSETS_PER_COHORT), 'Phase 5 sealed cohorts are all 3 assets');
check(new Set(PHASE5_SEALED_SAMPLE.map(row => row.assetId)).size === PHASE5_TARGET_ASSETS, 'Phase 5 sealed assets are unique');
check(PHASE5_SEALED_SAMPLE.every(row => PHASE5_CANDIDATE_POOL.some(pool => pool.assetId === row.assetId)), 'Phase 5 sealed assets all come from frozen pool');

check(PHASE5_REACH_MIN_EXECUTED_REDUCTIONS === 6 && PHASE5_REACH_MIN_COHORTS === 4, 'Phase 5 reach stays frozen at 6 reductions across 4 cohorts');
check(PHASE5_PASS_MIN_POSITIVE_COHORTS === 4, 'Phase 5 economic sign gate stays 4/6 cohorts');
check(PHASE5_MATERIALITY_CAPITAL_PCT === 0.5, 'Phase 5 materiality floor stays 0.5% capital');
check(PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP === 0.5, 'Phase 5 median drawdown guardrail stays +0.5 pp');
check(PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL === 5, 'Phase 5 single-cohort terminal loss guardrail stays 5%');
check(PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP === 3, 'Phase 5 single-cohort drawdown guardrail stays +3 pp');
check(PHASE5_INITIAL_CAPITAL_EUR === 13_000, 'Phase 5 initial capital stays 13,000 EUR per cohort');

const policy = fs.readFileSync('src/investment/decision/trendProtectionPolicy.ts', 'utf8');
check(policy.includes("policy: 'TREND_PROTECTION_V2'"), 'TREND_PROTECTION_V2 implementation exists');
check(policy.includes('const WINNER_ARM_MFE_PCT = 8;'), 'Phase 5 freezes winner arm MFE at 8%');
check(policy.includes('const WINNER_MIN_GIVEBACK_PP = 6;'), 'Phase 5 freezes winner arm giveback at 6 pp');
check(policy.includes('const WINNER_STRONG_GIVEBACK_PP = 8;'), 'Phase 5 freezes strong giveback at 8 pp');
check(policy.includes('const V2_WINNER_CONFIRM_STREAK = 3;'), 'Phase 5 freezes winner confirmation streak at 3 sessions');
check(policy.includes('const V2_WINNER_CONFIRM_PROTECTION_OBSERVATIONS = 3;'), 'Phase 5 freezes three protected observations');
check(policy.includes('const V2_WINNER_MIN_WORSENING_AFTER_ARM_PP = 2;'), 'Phase 5 freezes 2 pp post-arm worsening');
check(policy.includes('const V2_PARTIAL_REDUCTION_PCT = 25;'), 'Phase 5 freezes one 25% partial reduction');
check(policy.includes('if (reclaimDetected)'), 'Phase 5 preserves reclaim before further selling');
check(policy.includes('if (reductionExecuted)'), 'Phase 5 preserves one-reduction-per-episode guard');

const design = fs.readFileSync('docs/phase5_winner_protection_v2_preopen_design.md', 'utf8');
check(design.includes('winner-only'), 'Phase 5 design explicitly isolates winner branch');
check(design.includes('INCONCLUSIVE_INSUFFICIENT_WINNER_PROTECTION_REACH'), 'Phase 5 reach failure state is preregistered');
check(design.includes('finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur'), 'Phase 5 terminal wealth metric is frozen');
check(design.includes('10/26') && design.includes('2001-01-03'), 'Phase 5 documents coverage-only failure and pre-open temporal refreeze');
check(design.includes('baseline/candidato económico: **NO EJECUTADO**'), 'Phase 5 design records economic holdout as unopened');
check(design.includes('eliminando la cohorte con mayor delta positivo'), 'Phase 5 dominance gate is quantified pre-open');

console.log(`phase5WinnerProtectionV2Readiness.unit: PASS · ${PHASE5_CANDIDATE_POOL.length} pool assets · ${PHASE5_COHORT_COUNT}x${PHASE5_ASSETS_PER_COHORT} sealed`);
