import fs from 'node:fs';
import path from 'node:path';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL as V1 } from '../src/investment/decision/phase6ForwardRiskContextStageAProtocol';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROTOCOL as R2 } from '../src/investment/decision/phase6ForwardRiskContextStageAR2Protocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_FAIL:${label}`);
}

assert(R2.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_V1', 'R2_VERSION_CHANGED');
assert(R2.status === 'FUTURE_FORWARD_R2_FROZEN_NOT_OPENED', 'R2_NOT_FROZEN_UNOPENED');
assert(R2.productionDefault === 'LEGACY', 'PRODUCTION_NOT_LEGACY');
assert(R2.economicPolicyDefined === false, 'ECONOMIC_POLICY_DEFINED');
assert(R2.predecessor.disposition === 'CONSUMED_INVALID_FOR_PROMOTION_TECHNICAL_SIGNAL_MATERIALIZATION_FAILURE', 'V1_DISPOSITION_CHANGED');
assert(R2.predecessor.outcomesOpened === false, 'V1_OUTCOMES_MARKED_OPEN');
assert(R2.sample.predictionStartDate === '2026-09-21', 'R2_START_CHANGED');
assert(R2.sample.predictionEndDate === V1.sample.predictionEndDate, 'R2_END_CHANGED');
assert(R2.sample.assets.map(row => row.assetId).join('|') === V1.sample.assets.map(row => row.assetId).join('|'), 'ASSET_SAMPLE_CHANGED');
assert(R2.signal.highRiskThresholdPct === V1.signal.highRiskThresholdPct && R2.signal.highRiskThresholdPct === 80, 'V8_THRESHOLD_CHANGED');
assert(R2.predictiveOutcome.horizonSessions === V1.predictiveOutcome.horizonSessions && R2.predictiveOutcome.horizonSessions === 63, 'OUTCOME_HORIZON_CHANGED');
assert(R2.predictiveOutcome.materialDownsideThresholdPct === V1.predictiveOutcome.materialDownsideThresholdPct, 'DOWNSIDE_THRESHOLD_CHANGED');
assert(JSON.stringify(R2.reachGate) === JSON.stringify(V1.reachGate), 'REACH_GATES_CHANGED');
assert(JSON.stringify(R2.predictiveGate) === JSON.stringify(V1.predictiveGate), 'PREDICTIVE_GATES_CHANGED');
assert(R2.observationContinuity.firstInformationDate === '2026-09-21', 'R2_FIRST_INFORMATION_DATE_CHANGED');
assert(R2.observationContinuity.successorSessionMaterialization === 'REAL_SUCCESSOR_SESSION_MAY_BE_PRESENT_ONLY_TO_MATERIALIZE_EXECUTION_DATE', 'SUCCESSOR_MATERIALIZATION_NOT_FROZEN');
assert(R2.observationContinuity.successorSessionMayAffectSignalComponents === false, 'SUCCESSOR_CAN_AFFECT_SIGNAL');
assert(R2.observationContinuity.successorSessionMayAffectGate === false, 'SUCCESSOR_CAN_AFFECT_GATE');
assert(R2.observationContinuity.successorSessionMayAffectMacroOrOptionsCutoff === false, 'SUCCESSOR_CAN_AFFECT_MACRO_OPTIONS');

const collector = source('scripts/phase6ForwardRiskContextStageAR2CollectorLive.ts');
assert(collector.includes('const signalMaterializationEndDate = pendingSessions.at(-1)!.successorDate;'), 'SUCCESSOR_END_NOT_EXPLICIT');
assert(collector.includes('STAGE_A.sample.historyWarmupStartDate,\n      signalMaterializationEndDate,'), 'SIGNAL_ENGINE_NOT_GIVEN_SUCCESSOR');
assert(collector.includes('loadForwardRiskDiagnosticData(STAGE_A.sample.historyWarmupStartDate, lastInformationDate)'), 'DIAGNOSTIC_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes('loadForwardRiskMacroDataV5VintageSafe(STAGE_A.sample.historyWarmupStartDate, lastInformationDate)'), 'MACRO_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes('filterOptionsToDate(await loadForwardRiskOptionsDataV7(), lastInformationDate)'), 'OPTIONS_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes('STAGE_A.sample.historyWarmupStartDate,\n        informationDate,'), 'CANDIDATE_GATE_PREFIX_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes('PHASE6_STAGE_A_R2_V5_POINT_NOT_MATERIALIZED'), 'V5_MATERIALIZATION_FAIL_CLOSED_MISSING');
assert(collector.includes('PHASE6_STAGE_A_R2_V7_POINT_NOT_MATERIALIZED'), 'V7_MATERIALIZATION_FAIL_CLOSED_MISSING');
assert(!collector.includes('phase6ForwardRiskContextStageAEvaluator'), 'OUTCOME_EVALUATOR_WIRED');
assert(collector.includes('outcomeAccessed: false'), 'OUTCOME_ACCESS_GUARD_MISSING');

const routes = source('server/researchValidationRoutes.ts');
assert(routes.includes("id: 'phase6-forward-risk-context-stage-a-r2-readiness'"), 'R2_READINESS_JOB_MISSING');
const r2Start = routes.indexOf("id: 'phase6-forward-risk-context-stage-a-r2-readiness'");
const qualityStart = routes.indexOf("id: 'quality-allocation-dynamic-future-forward-v1'", r2Start);
const r2Job = routes.slice(r2Start, qualityStart);
assert(r2Job.includes('phase6ForwardRiskContextStageAR2CollectorLive.ts'), 'R2_COLLECTOR_NOT_WIRED_AFTER_SEAL');
assert(r2Job.includes('requiresGithubReplayToken: true'), 'R2_COLLECTOR_TOKEN_PREFLIGHT_MISSING');
assert(r2Job.includes("marker: 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_COLLECTOR_RESULT'"), 'R2_COLLECTOR_MARKER_MISSING');
const typeScriptStep = r2Job.indexOf("{ label: 'TypeScript'");
const collectorStep = r2Job.indexOf('phase6ForwardRiskContextStageAR2CollectorLive.ts');
assert(typeScriptStep >= 0 && collectorStep > typeScriptStep, 'R2_COLLECTOR_NOT_AFTER_TYPESCRIPT');
assert(!r2Job.includes('phase6ForwardRiskContextStageAEvaluator'), 'R2_JOB_WIRES_OUTCOME_EVALUATOR');

console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_READINESS_PASS', JSON.stringify({
  version: R2.version,
  predecessor: R2.predecessor.disposition,
  predictionWindow: `${R2.sample.predictionStartDate}->${R2.sample.predictionEndDate}`,
  assets: R2.sample.assets.length,
  thresholdPct: R2.signal.highRiskThresholdPct,
  outcomeHorizonSessions: R2.predictiveOutcome.horizonSessions,
  successorMaterialization: true,
  sampleOpened: false,
  outcomesOpened: false,
  productionDefault: R2.productionDefault
}));
