import './phase6ForwardRiskContextStageASeal.unit';
import fs from 'node:fs';
import path from 'node:path';
import { FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT, resolveForwardRiskContextV1 } from '../src/investment/decision/forwardRiskContextV1';
import { PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL } from '../src/investment/decision/phase6ForwardRiskContextProtocol';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL } from '../src/investment/decision/phase6ForwardRiskContextStageAProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_READINESS_FAIL:${label}`);
}
function approx(actual: number | null, expected: number, label: string): void {
  assert(actual != null && Math.abs(actual - expected) < 1e-9, label);
}

assert(FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT === 80, 'V8_THRESHOLD_CHANGED');

const calm = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 35, v7OptionsScorePct: 42 });
assert(calm.status === 'AVAILABLE', 'CALM_CONTEXT_UNAVAILABLE');
approx(calm.contextScorePct, 42, 'CONTEXT_IS_NOT_MAX_SCORE');
assert(calm.highRiskContext === false && calm.source === 'NONE', 'CALM_CONTEXT_MISCLASSIFIED');

const v5High = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 86, v7OptionsScorePct: 55 });
assert(v5High.highRiskContext === true && v5High.source === 'V5', 'V5_OR_RULE_CHANGED');

const v7High = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 60, v7OptionsScorePct: 91 });
assert(v7High.highRiskContext === true && v7High.source === 'V7', 'V7_OR_RULE_CHANGED');

const missing = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: null, v7OptionsScorePct: 90 });
assert(missing.status === 'UNAVAILABLE', 'MISSING_LEG_MUST_NOT_FALL_BACK');

const invalid = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: 101, v7OptionsScorePct: 90 });
assert(invalid.status === 'UNAVAILABLE', 'OUT_OF_RANGE_SCORE_MUST_FAIL_CLOSED');

for (const row of [calm, v5High, v7High, missing, invalid]) {
  assert(row.authority === 'SHADOW_CONTEXT_ONLY', 'CONTEXT_GAINED_AUTHORITY');
  assert(row.canChangeEligibility === false, 'CONTEXT_CAN_CHANGE_ELIGIBILITY');
  assert(row.canChangeRanking === false, 'CONTEXT_CAN_CHANGE_RANKING');
  assert(row.canChangeSizing === false, 'CONTEXT_CAN_CHANGE_SIZING');
  assert(row.canSellOrReduce === false, 'CONTEXT_CAN_SELL_OR_REDUCE');
}

const protocol = PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL;
const stageA = PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL;

assert(protocol.status === 'CONTEXT_PREREGISTERED_STAGE_A_SAMPLE_FROZEN_NOT_OPENED', 'PROTOCOL_STATE_CHANGED');
assert(protocol.productionDefault === 'LEGACY', 'PRODUCTION_NOT_LEGACY');
assert(protocol.productionPromotionAllowed === false, 'PRODUCTION_PROMOTION_ENABLED');
assert(protocol.stageA.economicOrdersAllowed === false, 'STAGE_A_CAN_TRADE');
assert(protocol.stageA.economicPolicyDefined === false, 'ECONOMIC_POLICY_PREMATURELY_DEFINED');
assert(protocol.validationSample.status === 'FUTURE_FORWARD_FROZEN_NOT_OPENED', 'SAMPLE_NOT_FROZEN_UNOPENED');
assert(protocol.validationSample.outcomeInspectionAllowedNow === false, 'OUTCOME_INSPECTION_ENABLED');
assert(protocol.nextFreezeBeforeOpening.marketDataAccessBeforeRunnerSealAllowed === false, 'MARKET_ACCESS_ALLOWED_BEFORE_RUNNER_SEAL');
assert(protocol.integrationBoundary.directDailyOnOffAuthority === false, 'DAILY_ON_OFF_REINTRODUCED');
assert(protocol.predecessorDisposition.v9 === 'RETIRED_AS_TESTED', 'V9_REACTIVATED');
assert(protocol.predecessorDisposition.v10 === 'RETIRED_AS_TESTED', 'V10_REACTIVATED');
assert(protocol.predecessorDisposition.v11 === 'RETIRED_AS_TESTED', 'V11_REACTIVATED');

assert(stageA.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_V1', 'STAGE_A_VERSION_CHANGED');
assert(stageA.status === 'FUTURE_FORWARD_SAMPLE_FROZEN_NOT_OPENED', 'STAGE_A_STATUS_CHANGED');
assert(stageA.sample.mode === 'FUTURE_FORWARD', 'STAGE_A_NOT_FUTURE_FORWARD');
assert(stageA.sample.predictionStartDate === '2026-09-16', 'PREDICTION_START_CHANGED');
assert(stageA.sample.predictionEndDate === '2027-03-31', 'PREDICTION_END_CHANGED');
assert(stageA.sample.historyWarmupStartDate === '2022-01-03', 'WARMUP_START_CHANGED');
assert(stageA.sample.decisionCadence === 'DAILY', 'CADENCE_CHANGED');
assert(stageA.sample.historicalOrPreFreezeBackfillAllowed === false, 'PRE_FREEZE_BACKFILL_ALLOWED');
assert(stageA.sample.deterministicPostFreezeCausalCatchUpAllowed === true, 'POST_FREEZE_CAUSAL_CATCHUP_DISABLED');
assert(stageA.sample.replacementAfterOpeningAllowed === false, 'ASSET_REPLACEMENT_ALLOWED');
assert(stageA.sample.minimumValidAssets === 8, 'MINIMUM_VALID_ASSETS_CHANGED');
assert(stageA.sample.minimumCandidateHistoryBarsAtInformationDate === 252, 'CANDIDATE_HISTORY_CHANGED');
assert(stageA.sample.minimumSignalCalibrationBarsBeforePredictionWindow === 756, 'SIGNAL_CALIBRATION_HISTORY_CHANGED');

assert(stageA.observationContinuity.mode === 'DETERMINISTIC_POST_FREEZE_CAUSAL_CATCH_UP', 'CONTINUITY_MODE_CHANGED');
assert(stageA.observationContinuity.firstInformationDate === '2026-09-16', 'FIRST_INFORMATION_DATE_CHANGED');
assert(stageA.observationContinuity.allCompletedAnchorSessionsRequired === true, 'ALL_COMPLETED_SESSIONS_NOT_REQUIRED');
assert(stageA.observationContinuity.processOldestMissingSessionFirst === true, 'OLDEST_MISSING_NOT_FIRST');
assert(stageA.observationContinuity.preFreezeSessionAllowed === false, 'PRE_FREEZE_SESSION_ALLOWED');
assert(stageA.observationContinuity.dateOmissionOrSelectionByOutcomeAllowed === false, 'OUTCOME_BASED_DATE_SELECTION_ALLOWED');
assert(stageA.observationContinuity.causalCandidatePrefixMustEndAtInformationDate === true, 'CAUSAL_PREFIX_BOUNDARY_WEAKENED');
assert(stageA.observationContinuity.signalPointMayUseOnlyInformationAvailableAtOrBeforeInformationDate === true, 'SIGNAL_LOOKAHEAD_ALLOWED');
assert(stageA.observationContinuity.outcomeReadDuringSignalCollectionAllowed === false, 'SIGNAL_COLLECTION_CAN_READ_OUTCOME');
assert(stageA.observationContinuity.durableAuthority === 'GITHUB_REPLAY_RESULTS', 'DURABLE_AUTHORITY_CHANGED');
assert(stageA.observationContinuity.localCacheAuthoritative === false, 'LOCAL_CACHE_BECAME_AUTHORITATIVE');

const expectedIds = ['EUNL','SXR8','EXSA','IS3N','IUSN','QDVE','VVSM','XDWH','EXH1','ISPA'];
assert(stageA.sample.assets.length === expectedIds.length, 'ASSET_COUNT_CHANGED');
assert(stageA.sample.assets.map(row => row.assetId).join('|') === expectedIds.join('|'), 'EXACT_ASSET_SAMPLE_CHANGED');
assert(new Set(stageA.sample.assets.map(row => row.assetId)).size === stageA.sample.assets.length, 'DUPLICATE_ASSET_IDS');
assert(new Set(stageA.sample.assets.map(row => row.ticker)).size === stageA.sample.assets.length, 'DUPLICATE_TICKERS');

assert(stageA.signal.highRiskThresholdPct === 80, 'STAGE_A_THRESHOLD_CHANGED');
assert(stageA.signal.bothLegsRequired === true, 'ONE_LEG_FALLBACK_ENABLED');
assert(stageA.signal.thresholdRetuned === false, 'THRESHOLD_RETUNED');
assert(stageA.predictiveOutcome.reference === 'NEXT_OPEN_AFTER_INFORMATION_DATE', 'OUTCOME_REFERENCE_CHANGED');
assert(stageA.predictiveOutcome.horizonSessions === 63, 'OUTCOME_HORIZON_CHANGED');
assert(stageA.predictiveOutcome.materialDownsideThresholdPct === 5, 'DOWNSIDE_THRESHOLD_CHANGED');
assert(stageA.predictiveOutcome.outcomeMayBeReadBeforeMaturity === false, 'PREMATURE_OUTCOME_READ_ALLOWED');
assert(stageA.predictiveOutcome.finalVerdictRequiresAllFrozenWindowObservationsMature === true, 'FINAL_VERDICT_CAN_OPEN_EARLY');

assert(stageA.reachGate.minimumEvaluableEligibleObservations === 200, 'REACH_TOTAL_CHANGED');
assert(stageA.reachGate.minimumHighRiskEligibleObservations === 30, 'REACH_HIGH_CHANGED');
assert(stageA.reachGate.minimumNormalRiskEligibleObservations === 100, 'REACH_NORMAL_CHANGED');
assert(stageA.reachGate.minimumAssetsWithHighRiskEligibleObservations === 4, 'REACH_ASSETS_CHANGED');
assert(stageA.reachGate.minimumDistinctCalendarWeeksWithHighRiskEligibleObservations === 6, 'REACH_WEEKS_CHANGED');
assert(stageA.reachGate.maximumSingleAssetShareOfHighRiskEligiblePct === 35, 'DOMINANCE_GUARD_CHANGED');

assert(stageA.predictiveGate.minimumAbsoluteMaterialDownsideRateLiftPctPoints === 10, 'ABSOLUTE_LIFT_CHANGED');
assert(stageA.predictiveGate.minimumMaterialDownsideRiskRatio === 1.5, 'RISK_RATIO_CHANGED');
assert(stageA.predictiveGate.minimumMedianMaxDrawdownSeverityLiftPctPoints === 1, 'SEVERITY_LIFT_CHANGED');
assert(stageA.predictiveGate.thresholdsDerivedFromOpenedStageAOutcomes === false, 'OUTCOME_DERIVED_THRESHOLDS');

assert(stageA.dataContract.prices === 'REAL_ONLY', 'NON_REAL_PRICES_ALLOWED');
assert(stageA.dataContract.v5 === 'REAL_VINTAGE_SAFE_POINT_IN_TIME_MACRO_REQUIRED', 'V5_VINTAGE_SAFETY_WEAKENED');
assert(stageA.dataContract.v7 === 'REAL_CBOE_OBSERVED_OPTIONS_INDEX_DATA_REQUIRED', 'V7_REAL_DATA_WEAKENED');
assert(stageA.dataContract.syntheticFallbackAllowed === false, 'SYNTHETIC_FALLBACK_ENABLED');
assert(stageA.dataContract.preFreezeBackfill === 'FORBIDDEN', 'PRE_FREEZE_BACKFILL_CONTRACT_CHANGED');
assert(stageA.interpretation.passDoesNotPromoteProduction === true, 'PASS_CAN_PROMOTE_PRODUCTION');
assert(stageA.interpretation.noEconomicPolicyMayBeEvaluatedOnThisSample === true, 'STAGE_A_CAN_EVALUATE_ECONOMIC_POLICY');

const v8Source = source('src/investment/decision/forwardRiskComplementarityV8.ts');
assert(v8Source.includes('const V5_VULNERABLE_SCORE_PCT = 80;'), 'V8_V5_THRESHOLD_SOURCE_CHANGED');
assert(v8Source.includes('const V7_SIGNAL_SCORE_PCT = 80;'), 'V8_V7_THRESHOLD_SOURCE_CHANGED');

const candidateGateSource = source('src/investment/decision/portfolioCandidateGate.ts');
assert(!candidateGateSource.includes('FORWARD_RISK_CONTEXT_V1'), 'PHASE6_SHADOW_WIRED_INTO_PRODUCT_GATE');

const validationRoutesSource = source('server/researchValidationRoutes.ts');
const phase6Start = validationRoutesSource.indexOf("id: 'phase6-forward-risk-context-readiness'");
const phase6End = validationRoutesSource.indexOf("id: 'quality-allocation-dynamic-future-forward-v1'", phase6Start);
assert(phase6Start >= 0 && phase6End > phase6Start, 'PHASE6_JOB_MISSING');
const phase6Job = validationRoutesSource.slice(phase6Start, phase6End);
assert(phase6Job.includes("name: 'Fase 6 · Forward Risk V8 como contexto · collector Stage A'"), 'PHASE6_COLLECTOR_LABEL_MISSING');
assert(phase6Job.includes('scripts/phase6ForwardRiskContextStageACollectorLive.ts'), 'PHASE6_LIVE_COLLECTOR_NOT_WIRED_AFTER_STATIC_PASS');
assert(phase6Job.includes('requiresGithubReplayToken: true'), 'PHASE6_LIVE_COLLECTOR_TOKEN_PREFLIGHT_MISSING');

console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_FREEZE_PASS', JSON.stringify({
  contextVersion: calm.version,
  thresholdPct: FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT,
  protocolStatus: protocol.status,
  sampleStatus: protocol.validationSample.status,
  stageAVersion: stageA.version,
  predictionWindow: `${stageA.sample.predictionStartDate}->${stageA.sample.predictionEndDate}`,
  assets: stageA.sample.assets.length,
  outcomeHorizonSessions: stageA.predictiveOutcome.horizonSessions,
  continuityMode: stageA.observationContinuity.mode,
  collectorWired: true,
  productionDefault: protocol.productionDefault,
  economicPolicyDefined: protocol.stageA.economicPolicyDefined,
  marketOpened: false
}));
