import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL as STAGE_A } from '../src/investment/decision/phase6ForwardRiskContextStageAProtocol';
import {
  computePhase6StageAForwardMaxDrawdownPct,
  evaluatePhase6ForwardRiskContextStageA
} from '../src/investment/decision/phase6ForwardRiskContextStageAEvaluator';
import {
  appendPhase6StageAObservations,
  createEmptyPhase6StageAState,
  markPhase6StageAOpened,
  verifyPhase6StageAState
} from '../scripts/phase6ForwardRiskContextStageAProspectiveProtocol';

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_FAIL:${label}`);
}
function text(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function gitBlobSha1(relativePath: string): string {
  const bytes = fs.readFileSync(path.resolve(process.cwd(), relativePath));
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

const sealPath = 'validation-runs/preregistration/phase6-forward-risk-context-stage-a-seal.json';
const seal = JSON.parse(text(sealPath)) as any;
assert(seal.version === 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_V1', 'SEAL_VERSION_CHANGED');
assert(seal.methodologySourceHead === '09b267e8291ce4ac06862c0ce49d47ecc41f36da', 'METHODOLOGY_SOURCE_HEAD_CHANGED');
assert(seal.sampleOpened === false, 'SEAL_RECORDS_SAMPLE_OPENED');
assert(seal.marketOutcomesOpened === false, 'SEAL_RECORDS_OUTCOMES_OPENED');
assert(seal.productionDefault === 'LEGACY', 'SEAL_PRODUCTION_NOT_LEGACY');
assert(seal.economicPolicyDefined === false, 'SEAL_ECONOMIC_POLICY_DEFINED');
assert(seal.sample.predictionStartDate === STAGE_A.sample.predictionStartDate, 'SEALED_START_MISMATCH');
assert(seal.sample.predictionEndDate === STAGE_A.sample.predictionEndDate, 'SEALED_END_MISMATCH');
assert(seal.sample.assets.join('|') === STAGE_A.sample.assets.map(row => row.assetId).join('|'), 'SEALED_ASSET_SAMPLE_MISMATCH');
assert(seal.signal.highRiskThresholdPct === STAGE_A.signal.highRiskThresholdPct, 'SEALED_SIGNAL_THRESHOLD_MISMATCH');
assert(seal.predictiveOutcome.horizonSessions === STAGE_A.predictiveOutcome.horizonSessions, 'SEALED_OUTCOME_HORIZON_MISMATCH');
assert(seal.predictiveOutcome.materialDownsideThresholdPct === STAGE_A.predictiveOutcome.materialDownsideThresholdPct, 'SEALED_DOWNSIDE_THRESHOLD_MISMATCH');
assert(seal.reachGate.minimumEvaluableEligibleObservations === STAGE_A.reachGate.minimumEvaluableEligibleObservations, 'SEALED_REACH_MISMATCH');
assert(seal.predictiveGate.minimumMaterialDownsideRiskRatio === STAGE_A.predictiveGate.minimumMaterialDownsideRiskRatio, 'SEALED_PREDICTIVE_GATE_MISMATCH');
assert(seal.continuity.mode === STAGE_A.observationContinuity.mode, 'SEALED_CONTINUITY_MODE_MISMATCH');
assert(seal.continuity.preFreezeBackfillAllowed === false, 'PRE_FREEZE_BACKFILL_ENABLED');
assert(seal.continuity.processOldestMissingSessionFirst === true, 'OLDEST_MISSING_FIRST_NOT_SEALED');
assert(seal.continuity.dateSelectionByOutcomeAllowed === false, 'OUTCOME_DATE_SELECTION_ENABLED');
assert(seal.continuity.outcomeReadDuringSignalCollectionAllowed === false, 'SIGNAL_COLLECTOR_CAN_READ_OUTCOME');
assert(seal.continuity.durableOpenMarkerBeforeMarketAccess === true, 'DURABLE_OPEN_MARKER_NOT_REQUIRED');

const manifest = seal.manifestGitBlobSha1 as Record<string, string>;
const manifestEntries = Object.entries(manifest);
assert(manifestEntries.length >= 20, 'SEALED_FILE_SET_TOO_SMALL');
for (const [relativePath, expectedSha] of manifestEntries) {
  assert(fs.existsSync(path.resolve(process.cwd(), relativePath)), `SEALED_FILE_MISSING:${relativePath}`);
  const actualSha = gitBlobSha1(relativePath);
  assert(actualSha === expectedSha, `SEALED_FILE_CHANGED:${relativePath}:${actualSha}:${expectedSha}`);
}

const collector = text('scripts/phase6ForwardRiskContextStageACollectorLive.ts');
const firstDurableSave = collector.indexOf('savePhase6StageADurableState(state, remoteBlobSha)');
const firstMarketScan = collector.indexOf('AssetUniverseScanner.scan(');
assert(firstDurableSave >= 0 && firstMarketScan >= 0 && firstDurableSave < firstMarketScan, 'OPEN_MARKER_NOT_DURABLE_BEFORE_FIRST_MARKET_SCAN');
assert(collector.includes('outcomeAccessed: false'), 'COLLECTOR_OUTCOME_ACCESS_GUARD_MISSING');
assert(!collector.includes('phase6ForwardRiskContextStageAEvaluator'), 'COLLECTOR_IMPORTS_OUTCOME_EVALUATOR');
assert(collector.includes('currentOpenDiscovery: false'), 'CURRENT_DISCOVERY_NOT_DISABLED');
assert(collector.includes("const lastInformationDate = pendingDates.at(-1)!;\n    const signalScan = await AssetUniverseScanner.scan("), 'SIGNAL_SCAN_BOUNDARY_CHANGED');
assert(collector.includes("STAGE_A.sample.historyWarmupStartDate,\n      lastInformationDate,"), 'SIGNAL_SCAN_DOES_NOT_END_AT_INFORMATION_DATE');
assert(collector.includes('datesWithSuccessor = anchorDates.slice(0, -1)'), 'COMPLETED_SESSION_PROOF_MISSING');
assert(collector.includes('filterOptionsToDate(await loadForwardRiskOptionsDataV7(), lastInformationDate)'), 'V7_NOT_CUT_AT_INFORMATION_DATE');

const stateStore = text('scripts/phase6ForwardRiskContextStageAStateStore.ts');
assert(stateStore.includes("const DEFAULT_BRANCH = 'replay-results';"), 'DURABLE_BRANCH_CHANGED');
assert(stateStore.includes("const REMOTE_PATH = 'validation-runs/phase6-forward-risk-context-stage-a-state.json';"), 'DURABLE_PATH_CHANGED');
assert(stateStore.includes('GITHUB_REPLAY_SYNC_TOKEN'), 'DURABLE_TOKEN_REQUIREMENT_MISSING');
assert(stateStore.includes('LOCAL_CACHE_FILE'), 'LOCAL_RECOVERY_CACHE_MISSING');

const createdAt = '2026-09-16T12:00:00.000Z';
const empty = createEmptyPhase6StageAState(createdAt);
assert(empty.sampleState === 'NOT_OPENED' && empty.observationCount === 0, 'EMPTY_STATE_NOT_UNOPENED');
const opened = markPhase6StageAOpened(empty, '2026-09-16T12:01:00.000Z');
assert(opened.sampleState === 'OPENED_COLLECTING' && opened.openedAt != null, 'OPEN_MARKER_STATE_FAILED');
const rows = [
  {
    id: '2026-09-16:EUNL', informationDate: '2026-09-16', assetId: 'EUNL', ticker: 'EUNL.DE',
    gateStatus: 'ELIGIBLE' as const, gateReason: 'Meets frozen gate', contextStatus: 'AVAILABLE' as const,
    v5VulnerabilityScorePct: 82, v7OptionsScorePct: 55, contextScorePct: 82, highRiskContext: true,
    source: 'V5' as const, marketDataSourceType: 'REAL' as const, collectedAt: '2026-09-17T08:00:00.000Z'
  },
  {
    id: '2026-09-16:SXR8', informationDate: '2026-09-16', assetId: 'SXR8', ticker: 'SXR8.DE',
    gateStatus: 'REJECTED' as const, gateReason: 'Below frozen opportunity hurdle', contextStatus: 'AVAILABLE' as const,
    v5VulnerabilityScorePct: 82, v7OptionsScorePct: 55, contextScorePct: 82, highRiskContext: true,
    source: 'V5' as const, marketDataSourceType: 'REAL' as const, collectedAt: '2026-09-17T08:00:00.000Z'
  }
];
const appended = appendPhase6StageAObservations(opened, rows, '2026-09-17T08:00:00.000Z');
verifyPhase6StageAState(appended);
assert(appended.observationCount === 2, 'HASH_CHAIN_APPEND_COUNT_WRONG');
assert(appended.observations[0].previousObservationHashSha256 === null, 'FIRST_HASH_PREVIOUS_NOT_NULL');
assert(appended.observations[1].previousObservationHashSha256 === appended.observations[0].observationHashSha256, 'HASH_CHAIN_NOT_LINKED');
let duplicateRejected = false;
try { appendPhase6StageAObservations(appended, [rows[0]], '2026-09-17T08:01:00.000Z'); } catch { duplicateRejected = true; }
assert(duplicateRejected, 'DUPLICATE_OBSERVATION_NOT_REJECTED');

const benign = Array.from({ length: 63 }, () => ({ open: 100, close: 100 }));
const downside = Array.from({ length: 63 }, (_, index) => ({ open: 100, close: 100 - index * 0.2 }));
const benignDd = computePhase6StageAForwardMaxDrawdownPct(100, benign);
const downsideDd = computePhase6StageAForwardMaxDrawdownPct(100, downside);
assert(benignDd === 0, 'FORWARD_DRAWDOWN_ZERO_PATH_WRONG');
assert(downsideDd != null && downsideDd > 10, 'FORWARD_DRAWDOWN_DOWNSIDE_PATH_WRONG');
const evaluatorPreview = evaluatePhase6ForwardRiskContextStageA({
  frozenWindowCollectionComplete: false,
  rows: [{ informationDate: '2026-09-16', assetId: 'EUNL', gateStatus: 'ELIGIBLE', contextStatus: 'AVAILABLE', highRiskContext: true, nextOpen: 100, forwardBars: downside }]
});
assert(evaluatorPreview.verdict === STAGE_A.verdicts.immature, 'EVALUATOR_CAN_VERDICT_BEFORE_COLLECTION_COMPLETE');
assert(evaluatorPreview.economicPolicyDefined === false && evaluatorPreview.productionDefault === 'LEGACY', 'EVALUATOR_GAINED_PRODUCT_AUTHORITY');

const routes = text('server/researchValidationRoutes.ts');
assert(!routes.includes("scripts/phase6ForwardRiskContextStageACollectorLive.ts"), 'LIVE_COLLECTOR_ALREADY_WIRED_PREOPEN');

console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_PASS', JSON.stringify({
  version: seal.version,
  sealedFiles: manifestEntries.length,
  assets: STAGE_A.sample.assets.length,
  sampleOpened: seal.sampleOpened,
  marketOutcomesOpened: seal.marketOutcomesOpened,
  methodologySourceHead: seal.methodologySourceHead,
  continuityMode: STAGE_A.observationContinuity.mode,
  liveCollectorWired: false,
  productionDefault: STAGE_A.productionDefault
}));
