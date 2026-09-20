import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROTOCOL as R2 } from '../src/investment/decision/phase6ForwardRiskContextStageAR2Protocol';

function text(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function gitBlobSha1(relativePath: string): string {
  const bytes = fs.readFileSync(path.resolve(process.cwd(), relativePath));
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_SEAL_FAIL:${label}`);
}

const sealPath = 'validation-runs/preregistration/phase6-forward-risk-context-stage-a-r2-seal.json';
const seal = JSON.parse(text(sealPath)) as any;

assert(seal.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_SEAL_V1', 'SEAL_VERSION_CHANGED');
assert(seal.methodologySourceHead === 'fd3902c8b3c5f14897245e700e36f3b04a9b3173', 'METHODOLOGY_SOURCE_HEAD_CHANGED');
assert(seal.sampleOpened === false, 'SEAL_RECORDS_SAMPLE_OPENED');
assert(seal.marketOutcomesOpened === false, 'SEAL_RECORDS_OUTCOMES_OPENED');
assert(seal.productionDefault === 'LEGACY', 'PRODUCTION_NOT_LEGACY');
assert(seal.economicPolicyDefined === false, 'ECONOMIC_POLICY_DEFINED');
assert(seal.predecessor.disposition === 'CONSUMED_INVALID_FOR_PROMOTION_TECHNICAL_SIGNAL_MATERIALIZATION_FAILURE', 'V1_DISPOSITION_CHANGED');
assert(seal.predecessor.observationsPreserved === 20, 'V1_OBSERVATION_COUNT_CHANGED');
assert(seal.predecessor.outcomesOpened === false, 'V1_OUTCOMES_MARKED_OPEN');

assert(R2.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_V1', 'R2_VERSION_CHANGED');
assert(R2.status === 'FUTURE_FORWARD_R2_FROZEN_NOT_OPENED', 'R2_NOT_FROZEN_UNOPENED');
assert(seal.sample.predictionStartDate === R2.sample.predictionStartDate && R2.sample.predictionStartDate === '2026-09-21', 'R2_START_MISMATCH');
assert(seal.sample.predictionEndDate === R2.sample.predictionEndDate, 'R2_END_MISMATCH');
assert(seal.sample.assets.join('|') === R2.sample.assets.map(row => row.assetId).join('|'), 'R2_ASSETS_MISMATCH');
assert(seal.signal.highRiskThresholdPct === R2.signal.highRiskThresholdPct && R2.signal.highRiskThresholdPct === 80, 'R2_THRESHOLD_MISMATCH');
assert(seal.predictiveOutcome.horizonSessions === R2.predictiveOutcome.horizonSessions && R2.predictiveOutcome.horizonSessions === 63, 'R2_OUTCOME_HORIZON_MISMATCH');
assert(seal.predictiveOutcome.materialDownsideThresholdPct === R2.predictiveOutcome.materialDownsideThresholdPct, 'R2_DOWNSIDE_THRESHOLD_MISMATCH');
assert(JSON.stringify(seal.reachGate) === JSON.stringify(R2.reachGate), 'R2_REACH_GATES_MISMATCH');
assert(JSON.stringify(seal.predictiveGate) === JSON.stringify(R2.predictiveGate), 'R2_PREDICTIVE_GATES_MISMATCH');

assert(seal.successorMaterialization.rule === R2.observationContinuity.successorSessionMaterialization, 'SUCCESSOR_RULE_MISMATCH');
assert(seal.successorMaterialization.mayAffectSignalComponents === false, 'SUCCESSOR_CAN_AFFECT_SIGNAL');
assert(seal.successorMaterialization.mayAffectGate === false, 'SUCCESSOR_CAN_AFFECT_GATE');
assert(seal.successorMaterialization.mayAffectMacroOrOptionsCutoff === false, 'SUCCESSOR_CAN_AFFECT_MACRO_OPTIONS');

const manifest = seal.manifestGitBlobSha1 as Record<string, string>;
const manifestEntries = Object.entries(manifest);
assert(manifestEntries.length === 18, 'SEALED_FILE_COUNT_CHANGED');
for (const [relativePath, expectedSha] of manifestEntries) {
  assert(fs.existsSync(path.resolve(process.cwd(), relativePath)), `SEALED_FILE_MISSING:${relativePath}`);
  const actualSha = gitBlobSha1(relativePath);
  assert(actualSha === expectedSha, `SEALED_FILE_CHANGED:${relativePath}:${actualSha}:${expectedSha}`);
}

const collector = text('scripts/phase6ForwardRiskContextStageAR2CollectorLive.ts');
assert(collector.includes("const signalMaterializationEndDate = pendingSessions.at(-1)!.successorDate;"), 'SUCCESSOR_MATERIALIZATION_END_MISSING');
assert(collector.includes("STAGE_A.sample.historyWarmupStartDate,\n      signalMaterializationEndDate,"), 'SIGNAL_DATASET_NOT_EXTENDED_TO_SUCCESSOR');
assert(collector.includes("loadForwardRiskDiagnosticData(STAGE_A.sample.historyWarmupStartDate, lastInformationDate)"), 'DIAGNOSTIC_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes("loadForwardRiskMacroDataV5VintageSafe(STAGE_A.sample.historyWarmupStartDate, lastInformationDate)"), 'MACRO_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes("filterOptionsToDate(await loadForwardRiskOptionsDataV7(), lastInformationDate)"), 'OPTIONS_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes("STAGE_A.sample.historyWarmupStartDate,\n        informationDate,"), 'CANDIDATE_GATE_PREFIX_NOT_CUT_AT_INFORMATION_DATE');
assert(collector.includes('PHASE6_STAGE_A_R2_V5_POINT_NOT_MATERIALIZED'), 'V5_EXACT_POINT_GUARD_MISSING');
assert(collector.includes('PHASE6_STAGE_A_R2_V7_POINT_NOT_MATERIALIZED'), 'V7_EXACT_POINT_GUARD_MISSING');
assert(collector.includes('outcomeAccessed: false'), 'OUTCOME_ACCESS_GUARD_MISSING');
assert(!collector.includes('phase6ForwardRiskContextStageAEvaluator'), 'OUTCOME_EVALUATOR_WIRED');

const v5 = text('src/investment/decision/forwardRiskVulnerabilityV5.ts');
const v7 = text('src/investment/decision/forwardRiskOptionsV7.ts');
const v4 = text('src/investment/decision/forwardRiskRegimeShiftV4.ts');
assert(v5.includes('i < dates.length - 1'), 'V5_SUCCESSOR_EXECUTION_SEMANTICS_CHANGED');
assert(v7.includes('i < dates.length - 1'), 'V7_SUCCESSOR_EXECUTION_SEMANTICS_CHANGED');
assert(v4.includes('i < dates.length - 1'), 'V4_SUCCESSOR_EXECUTION_SEMANTICS_CHANGED');

const routes = text('server/researchValidationRoutes.ts');
const r2Start = routes.indexOf("id: 'phase6-forward-risk-context-stage-a-r2-readiness'");
const qualityStart = routes.indexOf("id: 'quality-allocation-dynamic-future-forward-v1'", r2Start);
assert(r2Start >= 0 && qualityStart > r2Start, 'R2_READINESS_JOB_MISSING');
const r2Job = routes.slice(r2Start, qualityStart);
assert(!r2Job.includes('phase6ForwardRiskContextStageAR2CollectorLive.ts'), 'R2_COLLECTOR_WIRED_DURING_SEAL');
assert(!r2Job.includes('requiresGithubReplayToken: true'), 'R2_READINESS_REQUIRES_TOKEN_PREMATURELY');

console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_SEAL_PASS', JSON.stringify({
  version: seal.version,
  methodologySourceHead: seal.methodologySourceHead,
  sealedFiles: manifestEntries.length,
  predecessor: seal.predecessor.disposition,
  predictionWindow: `${R2.sample.predictionStartDate}->${R2.sample.predictionEndDate}`,
  assets: R2.sample.assets.length,
  thresholdPct: R2.signal.highRiskThresholdPct,
  outcomeHorizonSessions: R2.predictiveOutcome.horizonSessions,
  successorMaterialization: true,
  sampleOpened: seal.sampleOpened,
  outcomesOpened: seal.marketOutcomesOpened,
  liveCollectorWired: false,
  productionDefault: R2.productionDefault
}));
