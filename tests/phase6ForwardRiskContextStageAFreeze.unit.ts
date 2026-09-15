import fs from 'node:fs';
import path from 'node:path';
import { FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT } from '../src/investment/decision/forwardRiskContextV1';
import { PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL } from '../src/investment/decision/phase6ForwardRiskContextProtocol';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL } from '../src/investment/decision/phase6ForwardRiskContextStageAProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_FREEZE_FAIL:${label}`);
}

const phase6 = PHASE6_FORWARD_RISK_CONTEXT_PROTOCOL;
const stageA = PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL;

assert(FORWARD_RISK_CONTEXT_HIGH_SCORE_PCT === 80, 'V8_THRESHOLD_CHANGED');
assert(phase6.status === 'CONTEXT_PREREGISTERED_STAGE_A_SAMPLE_FROZEN_NOT_OPENED', 'PHASE6_STATUS_NOT_FROZEN_UNOPENED');
assert(phase6.productionDefault === 'LEGACY', 'PRODUCTION_NOT_LEGACY');
assert(phase6.productionPromotionAllowed === false, 'PRODUCTION_PROMOTION_ENABLED');
assert(phase6.stageA.economicOrdersAllowed === false, 'STAGE_A_CAN_TRADE');
assert(phase6.stageA.economicPolicyDefined === false, 'ECONOMIC_POLICY_DEFINED');
assert(phase6.validationSample.status === 'FUTURE_FORWARD_FROZEN_NOT_OPENED', 'STAGE_A_SAMPLE_NOT_FROZEN_UNOPENED');
assert(phase6.validationSample.outcomeInspectionAllowedNow === false, 'OUTCOME_INSPECTION_ENABLED');
assert(phase6.nextFreezeBeforeOpening.marketDataAccessBeforeRunnerSealAllowed === false, 'MARKET_ACCESS_ALLOWED_BEFORE_RUNNER_SEAL');
assert(phase6.integrationBoundary.directDailyOnOffAuthority === false, 'DAILY_ON_OFF_REINTRODUCED');
assert(phase6.predecessorDisposition.v9 === 'RETIRED_AS_TESTED', 'V9_REACTIVATED');
assert(phase6.predecessorDisposition.v10 === 'RETIRED_AS_TESTED', 'V10_REACTIVATED');
assert(phase6.predecessorDisposition.v11 === 'RETIRED_AS_TESTED', 'V11_REACTIVATED');

assert(stageA.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_V1', 'STAGE_A_VERSION_CHANGED');
assert(stageA.status === 'FUTURE_FORWARD_SAMPLE_FROZEN_NOT_OPENED', 'STAGE_A_STATUS_CHANGED');
assert(stageA.sample.mode === 'FUTURE_FORWARD', 'STAGE_A_NOT_FUTURE_FORWARD');
assert(stageA.sample.predictionStartDate === '2026-09-16', 'PREDICTION_START_CHANGED');
assert(stageA.sample.predictionEndDate === '2027-03-31', 'PREDICTION_END_CHANGED');
assert(stageA.sample.historyWarmupStartDate === '2022-01-03', 'WARMUP_START_CHANGED');
assert(stageA.sample.decisionCadence === 'DAILY', 'CADENCE_CHANGED');
assert(stageA.sample.backfillAllowed === false, 'BACKFILL_ALLOWED');
assert(stageA.sample.replacementAfterOpeningAllowed === false, 'ASSET_REPLACEMENT_ALLOWED');
assert(stageA.sample.minimumValidAssets === 8, 'MINIMUM_VALID_ASSETS_CHANGED');
assert(stageA.sample.minimumCandidateHistoryBarsAtInformationDate === 252, 'CANDIDATE_HISTORY_CHANGED');
assert(stageA.sample.minimumSignalCalibrationBarsBeforePredictionWindow === 756, 'SIGNAL_CALIBRATION_HISTORY_CHANGED');

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
assert(stageA.interpretation.passDoesNotPromoteProduction === true, 'PASS_CAN_PROMOTE_PRODUCTION');
assert(stageA.interpretation.noEconomicPolicyMayBeEvaluatedOnThisSample === true, 'STAGE_A_CAN_EVALUATE_ECONOMIC_POLICY');

const candidateGateSource = source('src/investment/decision/portfolioCandidateGate.ts');
assert(!candidateGateSource.includes('FORWARD_RISK_CONTEXT_V1'), 'FORWARD_RISK_WIRED_INTO_PRODUCT_GATE');

const routes = source('server/researchValidationRoutes.ts');
assert(routes.includes("id: 'phase6-forward-risk-context-stage-a-freeze'"), 'STAGE_A_FREEZE_JOB_MISSING');
assert(routes.includes("archivedJob(\n    'phase6-forward-risk-context-readiness'"), 'READINESS_NOT_ARCHIVED');

console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_FREEZE_PASS', JSON.stringify({
  version: stageA.version,
  status: stageA.status,
  predictionWindow: `${stageA.sample.predictionStartDate}->${stageA.sample.predictionEndDate}`,
  assets: stageA.sample.assets.length,
  outcomeHorizonSessions: stageA.predictiveOutcome.horizonSessions,
  highRiskThresholdPct: stageA.signal.highRiskThresholdPct,
  materialDownsideThresholdPct: stageA.predictiveOutcome.materialDownsideThresholdPct,
  productionDefault: stageA.productionDefault,
  economicPolicyDefined: stageA.economicPolicyDefined,
  marketOpened: false
}));
