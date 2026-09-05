import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`DECISION_ARCHITECTURE_PARITY_FAIL:${label}`);
}

function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`DECISION_ARCHITECTURE_PARITY_FAIL:${label}`);
}

const indexHtml = source('index.html');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const replayRotation = source('src/investment/decision/replayRotationPolicyExperiment.ts');
const sharedCoreGate = source('src/investment/decision/portfolioCoreGatePolicy.ts');
const coreAlphaOverlay = source('src/investment/decision/coreAlphaOverlay.ts');
const forwardRisk = source('src/investment/decision/forwardRiskForecast.ts');
const assetRoles = source('src/investment/decision/portfolioAssetRole.ts');
const strategicCore = source('src/investment/decision/strategicCorePolicy.ts');
const replayCore = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const replayPublic = source('src/investment/decision/dynamicHistoricalReplay.ts');
const health = source('src/investment/decision/portfolioPositionHealth.ts');
const currentAlerts = source('src/investment/decision/currentOpportunityAlerts.ts');
const decisionCenter = source('src/components/InteractiveInvestmentDecisionCenter.tsx');
const currentDecisionSummary = source('src/components/CurrentOpportunityAlertsPanel.tsx');
const realPortfolio = source('src/components/UserPortfolioPanel.tsx');
const executionPlan = source('src/components/PortfolioExecutionPlanPanel.tsx');
const purchaseRegistration = source('src/components/RealPurchaseRegistrationPanel.tsx');
const pilotOperations = source('src/components/PilotOperationsPanel.tsx');
const alertAutomation = source('server/alertAutomation.ts');
const portfolioManagementAlerts = source('server/portfolioManagementAlerts.ts');

requireText(indexHtml, '/src/decisionMain.tsx', 'ROOT_MUST_USE_DECISION_MAIN');
forbidText(indexHtml, '/src/main.tsx', 'ROOT_MUST_NOT_USE_LEGACY_MAIN');

requireText(decisionCenter, 'AssetUniverseScanner.scan(', 'LIVE_MUST_USE_SHARED_SCANNER');
requireText(decisionCenter, 'PortfolioCandidateGate.apply(', 'LIVE_MUST_USE_CANDIDATE_GATE');
requireText(decisionCenter, 'InvestmentDecisionEngine.decide(', 'LIVE_MUST_USE_INVESTMENT_DECISION_ENGINE');
requireText(decisionCenter, 'PortfolioPositionHealthService.evaluate(', 'LIVE_MUST_USE_POSITION_HEALTH_SERVICE');
requireText(replayCore, 'PortfolioCandidateGate.apply(', 'REPLAY_MUST_USE_CANDIDATE_GATE');
requireText(replayCore, 'InvestmentDecisionEngine.decide(', 'REPLAY_MUST_USE_INVESTMENT_DECISION_ENGINE');

requireText(currentAlerts, 'PortfolioCandidateGate.apply(', 'ALERTS_MUST_USE_CANDIDATE_GATE');
requireText(currentAlerts, 'StrategyConsensusEngine.assess(', 'ALERTS_MUST_USE_SHARED_CONSENSUS');
requireText(currentAlerts, 'EntryTimingEngine.assess(', 'ALERTS_MUST_USE_SHARED_ENTRY_TIMING');

// CORE_ALPHA_V2 failed its economic replay. Normal audited replay returns to the
// closed V1 architecture. Forward risk is an independent final counterfactual,
// never a replacement for the productive engine before validation.
requireText(worker, "const REPLAY_ROTATION_EXPERIMENT = 'CORE_ARCHITECTURE_V1'", 'REPLAY_MUST_RETURN_TO_CORE_ARCHITECTURE_V1');
requireText(worker, 'runForwardRiskForecastV1({', 'REPLAY_MUST_RUN_FORWARD_RISK_COUNTERFACTUAL');
requireText(worker, "forwardRiskForecastV1: forwardRiskForecast", 'FORWARD_RISK_MUST_BE_AUDITED');
forbidText(worker, 'runDynamicReplayWithTrendProtectionV2Experiment', 'NORMAL_REPLAY_MUST_NOT_AUTO_RUN_TREND_V2');
forbidText(worker, 'runDynamicReplayWithTrendProtectionV2MediumTermWinnerConfirmExperiment', 'NORMAL_REPLAY_MUST_NOT_AUTO_RUN_TREND_V2_CONFIRM');

requireText(sharedCoreGate, 'export function applyCoreGateV1', 'SHARED_CORE_GATE_FUNCTION_MISSING');
requireText(sharedCoreGate, 'export function applyCoreArchitectureV1', 'SHARED_CORE_ARCHITECTURE_FUNCTION_MISSING');
requireText(sharedCoreGate, 'export function evaluatePortfolioDecision', 'PRODUCTION_PORTFOLIO_ENTRY_MISSING');
requireText(sharedCoreGate, 'return applyCoreArchitectureV1(normalizedInput, gated);', 'PRODUCTION_MUST_REMAIN_V1_UNTIL_PREDICTOR_VALIDATED');
requireText(replayRotation, "from './portfolioCoreGatePolicy'", 'REPLAY_MUST_IMPORT_SHARED_CORE_POLICY');
requireText(replayRotation, 'const gated = applyCoreGateV1(evaluationInput, baseline, gateCounters);', 'REPLAY_MUST_CALL_SHARED_CORE_GATE');
requireText(replayRotation, 'applyCoreArchitectureV1(evaluationInput, gated, architectureCounters)', 'REPLAY_MUST_CALL_SHARED_CORE_ARCHITECTURE');
forbidText(replayRotation, 'const CORE_PRIORITY =', 'REPLAY_MUST_NOT_DUPLICATE_CORE_POLICY');

// Failed V2 remains available only for attribution/research; it must not silently
// become the live shared entry point.
requireText(coreAlphaOverlay, "export const CORE_ALPHA_V2 = 'CORE_ALPHA_V2'", 'FAILED_ALPHA_EXPERIMENT_MUST_REMAIN_VERSIONED');
requireText(replayRotation, 'applyCoreAlphaV2(evaluationInput, architecture, alphaCounters)', 'FAILED_ALPHA_EXPERIMENT_MUST_REMAIN_REPRODUCIBLE');

// Forward prediction must be truly causal and economically isolated.
requireText(forwardRisk, "methodology: 'STRICT_WALK_FORWARD_NEXT_OPEN'", 'FORWARD_RISK_METHODOLOGY_MISSING');
requireText(forwardRisk, 'candidate.labelEndIndexes[labelIndex] < row.index', 'FORWARD_RISK_LABEL_LEAKAGE_GUARD_MISSING');
requireText(forwardRisk, 'executionIndex: row.index + 1', 'FORWARD_RISK_MUST_EXECUTE_NEXT_OPEN');
requireText(forwardRisk, 'economicPassRealistic', 'FORWARD_RISK_REALISTIC_ACCEPTANCE_MISSING');
forbidText(forwardRisk, "from './portfolioDecisionEngine'", 'FORWARD_RISK_MUST_NOT_IMPORT_PORTFOLIO_ENGINE');
forbidText(forwardRisk, 'PortfolioDecisionEngine.', 'FORWARD_RISK_MUST_NOT_CALL_PORTFOLIO_ENGINE');

for (const [file, label] of [
  [currentDecisionSummary, 'CURRENT_SUMMARY'],
  [realPortfolio, 'REAL_PORTFOLIO'],
  [executionPlan, 'EXECUTION_PLAN'],
  [purchaseRegistration, 'PURCHASE_REGISTRATION'],
  [pilotOperations, 'V1_PILOT']
] as const) {
  requireText(file, 'evaluatePortfolioDecision({', `${label}_MUST_USE_SHARED_DECISION_ENTRY`);
  forbidText(file, 'PortfolioDecisionEngine.evaluate({', `${label}_MUST_NOT_BYPASS_SHARED_CORE_POLICY`);
}

requireText(assetRoles, "'FUND_VANGUARD_GLOBAL'", 'GLOBAL_FUND_MUST_BE_STRUCTURAL_CORE');
forbidText(assetRoles, "'FUND_VANGUARD_US500',", 'US500_MUST_NOT_BE_STRUCTURAL_CORE');
forbidText(assetRoles, "'SXR8',", 'SP500_ETF_MUST_NOT_BE_STRUCTURAL_CORE');
requireText(strategicCore, "export const STRATEGIC_CORE_POLICY = 'STRATEGIC_CORE_HOLD_V1'", 'STRATEGIC_CORE_HOLD_POLICY_MISSING');
requireText(portfolioManagementAlerts, 'applyStrategicCoreShortTermProtection', 'BACKEND_ALERTS_MUST_PROTECT_STRUCTURAL_CORE');

requireText(replayPublic, 'structuralCoreBenchmarkFinalEur', 'STRUCTURAL_CORE_BENCHMARK_MISSING');
requireText(replayPublic, 'excessReturnVsStructuralCorePctPoints', 'STRUCTURAL_CORE_EXCESS_RETURN_MISSING');
requireText(replayPublic, 'beatsStructuralCoreBenchmark', 'STRUCTURAL_CORE_VERDICT_MISSING');
requireText(replayPublic, 'MAX_CORE_BENCHMARK_EDGE_LAG_DAYS', 'STRUCTURAL_CORE_BENCHMARK_COVERAGE_GUARD_MISSING');

requireText(health, 'export function classifyPositionHealth', 'SHARED_HEALTH_CLASSIFIER_MISSING');
requireText(replayCore, 'const classification = classifyPositionHealth(assessment, cash.excessVsCashPctPoints, context);', 'REPLAY_MUST_USE_SHARED_HEALTH_CLASSIFIER');
requireText(health, 'const classification = classifyPositionHealth(input.assessment, cash.excessVsCashPctPoints, context);', 'LIVE_MUST_USE_SHARED_HEALTH_CLASSIFIER');

requireText(health, 'TaxLotLedgerService.lots(input.ticker)', 'LIVE_LISTED_HEALTH_MUST_USE_TRACKED_LOTS');
requireText(health, 'PortfolioExecutionHistoryService.load()', 'LIVE_HEALTH_MUST_REBASE_FROM_EXECUTION_HISTORY');
requireText(health, 'POSITION_COST_BASIS_INCOMPLETE', 'MISSING_COST_BASIS_MUST_BE_EXPLICIT');

requireText(alertAutomation, 'function newOpportunityEvents(', 'ALERT_EVENT_DIFF_MISSING');
requireText(alertAutomation, "kind: 'CURRENT_ENTRY_OPPORTUNITY_EVENTS'", 'ALERT_EVENT_PAYLOAD_MISSING');
requireText(alertAutomation, 'levelRank(alert.level) > levelRank(previousNotified[alert.assetId])', 'ALERT_ESCALATION_RULE_MISSING');
requireText(alertAutomation, 'if (events.length > 0)', 'ALERTS_MUST_ONLY_NOTIFY_NEW_EVENTS');
requireText(alertAutomation, 'const deliveredEvents = notificationSent ? events : [];', 'FAILED_WEBHOOK_MUST_NOT_MARK_EVENT_DELIVERED');
requireText(alertAutomation, 'lastNotifiedActionableLevels: nextNotifiedLevels(', 'ALERT_DEDUPE_STATE_MUST_TRACK_DELIVERED_EVENTS');

console.log('DECISION_ARCHITECTURE_PARITY_PASS');