import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'server/researchValidationRoutes.ts'), 'utf8');
const durableState = fs.readFileSync(path.resolve(process.cwd(), 'server/researchValidationStateStore.mjs'), 'utf8');
const timesfmRemote = fs.readFileSync(path.resolve(process.cwd(), 'server/timesfmRemoteRunner.ts'), 'utf8');
const mount = fs.readFileSync(path.resolve(process.cwd(), 'server/alertAutomationRoutes.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ResearchValidationCenter.tsx'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/decisionMain.tsx'), 'utf8');

assert.match(routes, /'sector-52w-high-leadership-v1'/);
assert.match(routes, /SECTOR_52W_HIGH_LEADERSHIP_V1_RESULT/);
assert.match(routes, /52W V1 · FAIL_DIAGNOSTIC · cerrado/);
assert.match(routes, /id: 'pead-earnings-source-audit-v1'/);
const peadStart = routes.indexOf("id: 'pead-earnings-source-audit-v1'");
const peadEnd = routes.indexOf("archivedJob(", peadStart);
const peadBlock = routes.slice(peadStart, peadEnd > peadStart ? peadEnd : undefined);
assert.match(peadBlock, /visibility: 'ARCHIVED'/);
assert.match(routes, /id: 'pead-analyst-surprise-v1'/);
const peadSignalStart = routes.indexOf("id: 'pead-analyst-surprise-v1'");
const peadSignalEnd = routes.indexOf("archivedJob(", peadSignalStart);
const peadSignalBlock = routes.slice(peadSignalStart, peadSignalEnd > peadSignalStart ? peadSignalEnd : undefined);
assert.match(peadSignalBlock, /visibility: 'PARKED'/);
assert.match(peadSignalBlock, /tests\/peadSignalDiagnosticV1Seal\.unit\.mjs/);
assert.match(peadSignalBlock, /tests\/peadSignalDiagnosticV1\.unit\.mjs/);
assert.match(peadSignalBlock, /scripts\/peadSignalDiagnosticV1\.mjs/);
assert.match(peadSignalBlock, /Yahoo REAL · diagnóstico PEAD 60 sesiones/);
const currentVisibilityCount = (routes.match(/visibility: 'CURRENT'/g) ?? []).length;
assert.equal(currentVisibilityCount, 1, 'Exactly one research line should be visible as CURRENT');
const parkedVisibilityCount = (routes.match(/visibility: 'PARKED'/g) ?? []).length;
assert.ok(parkedVisibilityCount >= 3, 'Parallel research lines should remain parked, not visible');
assert.match(routes, /tests\/peadEarningsSourceAuditV1\.unit\.mjs/);
assert.match(routes, /tests\/peadEarningsSourceAuditV1\.integration\.mjs/);
assert.match(routes, /scripts\/peadEarningsSourceAuditV1\.mjs/);
assert.match(peadBlock, /Fuente estática pinneada · auditar causalidad PEAD/);
assert.doesNotMatch(peadBlock, /requiresEodhdApiKey: true/);
assert.doesNotMatch(peadBlock, /EODHD REAL/);
assert.match(routes, /'pead-yahoo-calendar-source-audit-r2'/);
assert.match(routes, /PEAD source R2 · INCONCLUSIVE timing unavailable · cerrado/);
assert.match(routes, /id: 'pead-yahoo-calendar-source-audit-r3'/);
const peadR3Start = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'");
const peadR3End = routes.indexOf("id: 'pead-analyst-surprise-v1'", peadR3Start);
const peadR3Block = routes.slice(peadR3Start, peadR3End > peadR3Start ? peadR3End : undefined);
assert.match(peadR3Block, /visibility: 'CURRENT'/);
assert.match(peadR3Block, /tests\/peadYahooCalendarSourceAuditR3Seal\.unit\.mjs/);
assert.match(peadR3Block, /tests\/peadYahooCalendarSourceAuditR3\.unit\.mjs/);
assert.match(peadR3Block, /tests\/peadYahooCalendarSourceAuditR2\.integration\.mjs/);
assert.match(peadR3Block, /scripts\/peadYahooCalendarSourceAuditR3\.mjs/);
assert.match(peadR3Block, /Yahoo REAL · auditar PEAD R3 next-session/);
assert.doesNotMatch(peadR3Block, /requiresEodhdApiKey: true/);
assert.match(peadSignalBlock, /tests\/peadSignalSourceR3Readiness\.unit\.mjs/);
assert.match(routes, /id: 'timesfm-stage-a-smoke-v1'/);
const timesfmStart = routes.indexOf("id: 'timesfm-stage-a-smoke-v1'");
const timesfmEnd = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'", timesfmStart);
const timesfmBlock = routes.slice(timesfmStart, timesfmEnd > timesfmStart ? timesfmEnd : undefined);
assert.match(timesfmBlock, /visibility: 'ARCHIVED'/);
assert.match(timesfmBlock, /requiresTimesFmRunner: true/);
assert.match(timesfmBlock, /tests\/timesfmRemoteClient\.unit\.mjs/);
assert.match(timesfmBlock, /tests\/timesfmRemoteRunnerContract\.unit\.mjs/);
assert.match(timesfmBlock, /tests\/timesfmStageAContract\.unit\.mjs/);
assert.match(timesfmBlock, /scripts\/timesfmStageARemoteClient\.mjs/);
assert.doesNotMatch(timesfmBlock, /timesfmStageABootstrap\.mjs/);
assert.match(timesfmRemote, /fetchTimesFmRemoteState/);
assert.match(timesfmRemote, /DEFAULT_TIMESFM_ZERO_GPU_URL/);
assert.doesNotMatch(timesfmRemote, /TIMESFM_RUNNER_TOKEN/);
assert.match(timesfmBlock, /TIMESFM_STAGE_A_SMOKE_RESULT/);
assert.match(routes, /state\.result = extractJsonAfterMarker\(stepRun\.output, job\.marker\)/);
assert.match(routes, /saveDurableJobState/);
assert.match(routes, /reconcileLoadedJobState/);
assert.match(routes, /state\.processId = child\.pid/);
assert.match(durableState, /VALIDATION_INTERRUPTED_BACKEND_RESTART_OR_PARENT_LOSS/);
assert.match(routes, /exitCode: state\.exitCode/);
assert.match(routes, /error: state\.error/);
assert.doesNotMatch(routes, /state\.result = extractJsonAfterMarker\(state\.output, job\.marker\);\s*state\.status = 'FAILED'/);
assert.match(routes, /id: 'core-outperformance-profitability-pit-v1'/);
const profitabilityPitV1Start = routes.indexOf("id: 'core-outperformance-profitability-pit-v1'");
const profitabilityPitR2Start = routes.indexOf("id: 'core-outperformance-profitability-pit-r2'", profitabilityPitV1Start);
const profitabilityPitV1Block = routes.slice(profitabilityPitV1Start, profitabilityPitR2Start);
assert.match(profitabilityPitV1Block, /visibility: 'ARCHIVED'/);
assert.match(profitabilityPitV1Block, /INCONCLUSIVE coverage 114\/250/);
assert.match(profitabilityPitV1Block, /tests\/coreOutperformanceProfitabilityPitV1\.unit\.mjs/);
assert.match(profitabilityPitV1Block, /scripts\/coreOutperformanceProfitabilityPitV1Live\.mjs/);

assert.match(routes, /id: 'core-outperformance-profitability-pit-r2'/);
const profitabilityPitR2End = routes.indexOf("id: 'fundamental-quality-valuation-broad-pit-v1'", profitabilityPitR2Start);
const profitabilityPitR2Block = routes.slice(profitabilityPitR2Start, profitabilityPitR2End);
assert.match(profitabilityPitR2Block, /visibility: 'ARCHIVED'/);
assert.match(profitabilityPitR2Block, /requiresSecEdgarUserAgent: true/);
assert.match(profitabilityPitR2Block, /tests\/coreOutperformanceProfitabilityPitR2Seal\.unit\.mjs/);
assert.match(profitabilityPitR2Block, /tests\/coreOutperformanceProfitabilityPitR2\.unit\.mjs/);
assert.match(profitabilityPitR2Block, /tests\/coreOutperformanceProfitabilityPitR2Contract\.unit\.mjs/);
assert.match(profitabilityPitR2Block, /scripts\/coreOutperformanceProfitabilityPitR2Live\.mjs/);
assert.match(routes, /id: 'fundamental-quality-valuation-broad-pit-v1'/);
assert.match(routes, /scripts\/fundamentalQualityValuationBroadPitV1Live\.ts/);
assert.match(routes, /SEC_EDGAR_USER_AGENT_REQUIRED/);
assert.match(routes, /SEC_EDGAR_USER_AGENT_INVALID/);
assert.match(routes, /\\S\+@\\S\+\\.\\S\+/);
assert.match(routes, /id: 'phase6-forward-risk-context-stage-a-r2-readiness'/);
assert.match(routes, /scripts\/phase6ForwardRiskContextStageAR2CollectorLive\.ts/);
assert.match(routes, /id: 'quality-allocation-dynamic-future-forward-v1'/);
assert.match(routes, /scripts\/qualityAllocationDynamicFutureForwardV1CheckpointLive\.ts/);
assert.match(routes, /'phase9-end-to-end-preclose-v1'/);
assert.match(routes, /Fase 9 · pre-cierre técnico V1 PASS · cerrado/);

assert.match(routes, /aiTokensUsed: false/);
assert.match(routes, /LOCAL_APP_BACKEND/);
assert.doesNotMatch(routes, /GEMINI|@google\/genai|github actions/i);

assert.match(mount, /research-validation/);
assert.match(ui, /Validación de investigación/);
assert.match(ui, /Ejecutar smoke TimesFM 3\.0/);
assert.match(ui, /Ejecutar benchmark TimesFM Stage B/);
assert.match(ui, /Registrar forecast semanal TimesFM/);
assert.match(ui, /Ejecutar diagnóstico económico TimesFM/);
assert.match(ui, /Ejecutar bridge económico TimesFM/);
assert.match(ui, /Comparar TimesFM directo vs app vs core/);
assert.match(ui, /Ejecutar TimesFM multivariante V1/);
assert.match(ui, /TIMESFM_MULTIVARIATE_CONTEXT_V1/);
assert.match(ui, /VALIDATION_ARCHIVED_READ_ONLY/);
assert.match(ui, /TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1/);
assert.match(ui, /Elecciones TimesFM/);
assert.match(ui, /TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1/);
assert.match(ui, /TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1/);
assert.match(ui, /Mediana extra vs LEGACY/);
assert.match(ui, /TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1/);
assert.match(ui, /Semana perdida: no se permite backfill retrospectivo/);
assert.match(ui, /TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1/);
assert.match(ui, /Rank IC 20\/60/);
assert.match(ui, /Lift vs LEGACY/);
assert.match(ui, /Dirección vs core/);
assert.match(ui, /Ejecutar Operating Profitability PIT R2/);
assert.match(ui, /CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2/);
assert.match(routes, /id: 'timesfm-stage-b-predictive-benchmark-v1'/);
assert.match(routes, /Yahoo REAL \+ TimesFM ZeroGPU · benchmark predictivo/);
assert.match(routes, /tests\/timesfmStageBSeal\.unit\.mjs/);
assert.match(routes, /id: 'timesfm-stage-b-prospective-confirmation-v1'/);
assert.match(routes, /id: 'timesfm-relative-rank-economic-diagnostic-v1'/);
assert.match(routes, /id: 'timesfm-allocation-bridge-posthoc-v1'/);
assert.match(routes, /id: 'timesfm-direct-selector-historical-diagnostic-v1'/);
assert.match(routes, /id: 'timesfm-multivariate-context-v1'/);
const mvV1Start = routes.indexOf("id: 'timesfm-multivariate-context-v1'");
const mvV1End = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'", mvV1Start);
const mvV1Block = routes.slice(mvV1Start, mvV1End);
assert.match(mvV1Block, /visibility: 'ARCHIVED'/);
assert.match(mvV1Block, /PANEL_SIGNAL_NO_COVARIATE_LIFT/);
const timesfmProspectiveStart = routes.indexOf("id: 'timesfm-stage-b-prospective-confirmation-v1'");
const timesfmProspectiveEnd = routes.indexOf("id: 'timesfm-relative-rank-economic-diagnostic-v1'", timesfmProspectiveStart);
const timesfmProspectiveBlock = routes.slice(timesfmProspectiveStart, timesfmProspectiveEnd);
assert.match(timesfmProspectiveBlock, /visibility: 'PARKED'/);
assert.match(timesfmProspectiveBlock, /requiresTimesFmAuth: true/);
assert.match(timesfmProspectiveBlock, /los dos brazos multivariantes ya congelados/);
assert.match(routes, /tests\/timesfmMultivariateContextV1Seal\.unit\.mjs/);
assert.match(routes, /id: 'timesfm-panel-sticky-oos-v1'/);
const stickyStart = routes.indexOf("id: 'timesfm-panel-sticky-oos-v1'");
const stickyEnd = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'", stickyStart);
const stickyBlock = routes.slice(stickyStart, stickyEnd);
assert.match(stickyBlock, /visibility: 'ARCHIVED'/);
assert.match(stickyBlock, /requiresTimesFmAuth: true/);
assert.match(stickyBlock, /tests\/timesfmPanelStickyOosV1Seal\.unit\.mjs/);
assert.match(stickyBlock, /scripts\/timesfmPanelStickyOosV1Live\.ts/);
assert.match(routes, /id: 'timesfm-panel-sticky-oos-v1-postmortem'/);
const stickyPostmortemStart = routes.indexOf("id: 'timesfm-panel-sticky-oos-v1-postmortem'");
const stickyPostmortemEnd = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'", stickyPostmortemStart);
const stickyPostmortemBlock = routes.slice(stickyPostmortemStart, stickyPostmortemEnd);
assert.match(stickyPostmortemBlock, /visibility: 'ARCHIVED'/);
assert.doesNotMatch(stickyPostmortemBlock, /requiresTimesFmRunner: true/);
assert.match(stickyPostmortemBlock, /scripts\/timesfmPanelStickyOosV1Postmortem\.ts/);
assert.match(stickyPostmortemBlock, /tests\/timesfmPanelStickyOosV1Postmortem\.unit\.ts/);
assert.match(stickyPostmortemBlock, /tests\/timesfmPanelStickyOosV1PostmortemContract\.unit\.mjs/);
assert.match(routes, /tests\/timesfmMultivariateContextV1\.unit\.mjs/);
assert.match(routes, /tests\/timesfmMultivariateContextV1Contract\.unit\.mjs/);
assert.match(routes, /runner\/timesfm\/hf-space\/app\.py/);
assert.match(routes, /scripts\/timesfmMultivariateContextV1RunnerReadiness\.mjs/);
assert.match(routes, /scripts\/timesfmMultivariateContextV1DiagnosticLive\.mjs/);
assert.match(routes, /tests\/timesfmDirectSelectorHistoricalDiagnosticV1Seal\.unit\.mjs/);
assert.match(routes, /scripts\/timesfmDirectSelectorHistoricalDiagnosticV1\.ts/);
assert.match(routes, /tests\/timesfmAllocationBridgePosthocV1Seal\.unit\.mjs/);
assert.match(routes, /scripts\/timesfmAllocationBridgePosthocV1\.ts/);
assert.match(routes, /tests\/timesfmRelativeRankEconomicDiagnosticV1Seal\.unit\.mjs/);
assert.match(routes, /scripts\/timesfmRelativeRankEconomicDiagnosticV1\.ts/);
assert.match(routes, /tests\/timesfmStageBProspectiveSeal\.unit\.mjs/);
assert.match(routes, /tests\/timesFmDirectSelectorV1\.unit\.ts/);
assert.match(routes, /tests\/timesFmDirectSelectorV1Contract\.unit\.mjs/);
assert.match(routes, /tests\/timesFmDirectSelectorProspectiveParity\.unit\.ts/);
assert.match(routes, /scripts\/timesfmStageBProspectiveCollectorLive\.mjs/);
assert.match(routes, /requiresGithubReplayToken: true/);
assert.match(ui, /Ejecutar audit Yahoo REAL PEAD R3/);
assert.match(ui, /Ejecutar diagnóstico 52W · rev\. técnica 3/);
assert.match(ui, /SECTOR_52W_HIGH_LEADERSHIP_V1/);
assert.match(ui, /TimesFM se delega a su runner separado/);
assert.match(ui, /TimesFM runner/);
assert.match(ui, /TIMESFM_REMOTE_RUNNER_REQUIRED/);
assert.match(ui, /\/api\/eodhd\/status/);
assert.match(ui, /\/api\/alpha-vantage\/status/);
assert.match(ui, /SEC EDGAR PIT/);
assert.match(ui, /FALTA USER-AGENT/);
assert.match(ui, /result\.json/);

assert.match(main, /ResearchValidationCenter/);
assert.match(main, /InteractiveInvestmentDecisionCenter/);
assert.doesNotMatch(main, /ForwardRiskResearchPanel/);



// production TimesFM exception: only jobs explicitly marked as using the remote
// TimesFM runner may pass the production-local validation gate.
assert.match(routes, /function isRemoteTimesFmValidationJob\(job: JobDefinition\)/);
assert.match(routes, /return job\.requiresTimesFmRunner === true/);
assert.match(routes, /process\.env\.NODE_ENV === 'production' && !isRemoteTimesFmValidationJob\(job\)/);
assert.ok(
  routes.indexOf("const job = JOBS.find(item => item.id === req.params.id)") <
  routes.indexOf("process.env.NODE_ENV === 'production' && !isRemoteTimesFmValidationJob(job)"),
  'TimesFM production exception must resolve the job before applying the local-only gate'
);


// optimistic TimesFM acceptance: the POST must return local RUNNING/currentStep state
// without awaiting a remote status call, so the UI reacts immediately even if ZeroGPU is slow.
const runRouteStart = routes.indexOf("researchValidationRouter.post('/jobs/:id/run'");
const runRouteEnd = routes.indexOf("\n});", runRouteStart);
const runRouteBlock = routes.slice(runRouteStart, runRouteEnd);
const acceptedRunStart = runRouteBlock.indexOf('void runJob(job);');
assert.ok(acceptedRunStart >= 0, 'Accepted run path must dispatch runJob');
const acceptedRunBlock = runRouteBlock.slice(acceptedRunStart);
assert.match(acceptedRunBlock, /const acceptedState = stateFor\(job\.id\)/);
assert.doesNotMatch(acceptedRunBlock, /await publicJob\(job\)/);
assert.match(acceptedRunBlock, /\.\.\.acceptedState/);
assert.match(ui, /setJobs\(current => current\.map\(job => job\.id === id \? \{ \.\.\.job, \.\.\.payload\.job \} : job\)\)/);
assert.match(timesfmRemote, /callGradio\('status', 4_000\)/);
assert.match(timesfmRemote, /checkTimesFmRemoteEndpoint/);
assert.match(timesfmRemote, /fetchTimesFmMultivariateRunnerStatus/);
assert.match(timesfmRemote, /multivariate_context_status/);
assert.match(timesfmRemote, /\/gradio_api\/info/);
assert.match(routes, /async function asyncPrerequisiteError\(job: JobDefinition\)/);
assert.match(routes, /TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED/);
assert.match(routes, /TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED/);
assert.match(routes, /TIMESFM_PROSPECTIVE_JOB_ID/);
assert.match(routes, /job\.id === TIMESFM_MULTIVARIATE_CONTEXT_JOB_ID \|\| job\.id === TIMESFM_PROSPECTIVE_JOB_ID/);
assert.match(routes, /minimumQuota = job\.id === TIMESFM_MULTIVARIATE_CONTEXT_JOB_ID \? 270 : job\.id === TIMESFM_PANEL_STICKY_OOS_JOB_ID \? 160 : 120/);
assert.match(routes, /TIMESFM_HF_TOKEN_REQUIRED/);
assert.match(routes, /TIMESFM_HF_TOKEN_QUOTA_PERMISSION_REQUIRED/);
assert.match(routes, /TIMESFM_ZERO_GPU_QUOTA_INSUFFICIENT/);
assert.match(routes, /fetchTimesFmZeroGpuQuota/);
assert.match(timesfmRemote, /timesFmHfTokenConfigured/);
assert.match(timesfmRemote, /\/api\/spaces\/zero-gpu\/quota/);
assert.match(timesfmRemote, /Authorization/);
assert.match(routes, /remote\.apiVersion !== 3/);
assert.match(routes, /remote\.maxAnchorsPerCall !== 8/);
assert.match(routes, /remote\.gpuDurationSeconds !== 45/);
assert.match(routes, /tests\/timesfmMultivariateContextV1RunnerReadiness\.unit\.mjs/);
assert.match(routes, /await asyncPrerequisiteError\(job\)/);
assert.ok(
  routes.indexOf("const missing = await asyncPrerequisiteError(job);", routes.indexOf("researchValidationRouter.post('/jobs/:id/run'")) <
  routes.indexOf('void runJob(job);', routes.indexOf("researchValidationRouter.post('/jobs/:id/run'")),
  'Remote multivariate readiness must block before runJob dispatch'
);


// Immediate click feedback must be visible before the POST/remote runner responds.
assert.match(ui, /const \[launchingJobId, setLaunchingJobId\] = useState<string \| null>\(null\)/);
assert.match(ui, /setLaunchingJobId\(id\)/);
assert.match(ui, /Solicitando ejecución al backend…/);
assert.match(ui, /Arrancando…/);

console.log('researchValidationRuntime.unit: PASS');
