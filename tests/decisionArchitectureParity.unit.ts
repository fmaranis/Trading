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
const replayCore = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const health = source('src/investment/decision/portfolioPositionHealth.ts');
const currentAlerts = source('src/investment/decision/currentOpportunityAlerts.ts');
const decisionCenter = source('src/components/InteractiveInvestmentDecisionCenter.tsx');
const realPortfolio = source('src/components/UserPortfolioPanel.tsx');
const executionPlan = source('src/components/PortfolioExecutionPlanPanel.tsx');

// Production entry point must remain the integrated decision center, not legacy App.tsx.
requireText(indexHtml, '/src/decisionMain.tsx', 'ROOT_MUST_USE_DECISION_MAIN');
forbidText(indexHtml, '/src/main.tsx', 'ROOT_MUST_NOT_USE_LEGACY_MAIN');

// Live study and historical replay must share the same scanner/gate/allocation chain.
requireText(decisionCenter, 'AssetUniverseScanner.scan(', 'LIVE_MUST_USE_SHARED_SCANNER');
requireText(decisionCenter, 'PortfolioCandidateGate.apply(', 'LIVE_MUST_USE_CANDIDATE_GATE');
requireText(decisionCenter, 'InvestmentDecisionEngine.decide(', 'LIVE_MUST_USE_INVESTMENT_DECISION_ENGINE');
requireText(decisionCenter, 'PortfolioPositionHealthService.evaluate(', 'LIVE_MUST_USE_POSITION_HEALTH_SERVICE');
requireText(replayCore, 'PortfolioCandidateGate.apply(', 'REPLAY_MUST_USE_CANDIDATE_GATE');
requireText(replayCore, 'InvestmentDecisionEngine.decide(', 'REPLAY_MUST_USE_INVESTMENT_DECISION_ENGINE');

// Current alerts are a view over the shared eligibility/consensus/timing chain, not an independent trading engine.
requireText(currentAlerts, 'PortfolioCandidateGate.apply(', 'ALERTS_MUST_USE_CANDIDATE_GATE');
requireText(currentAlerts, 'StrategyConsensusEngine.assess(', 'ALERTS_MUST_USE_SHARED_CONSENSUS');
requireText(currentAlerts, 'EntryTimingEngine.assess(', 'ALERTS_MUST_USE_SHARED_ENTRY_TIMING');

// Normal audited replay uses current CORE_GATE policy and must not silently run V2/counterfactual batteries.
requireText(worker, "const REPLAY_ROTATION_EXPERIMENT = 'CORE_GATE_V1'", 'REPLAY_MUST_USE_CORE_GATE_V1');
forbidText(worker, 'runDynamicReplayWithTrendProtectionV2Experiment', 'NORMAL_REPLAY_MUST_NOT_AUTO_RUN_V2');
forbidText(worker, 'runDynamicReplayWithTrendProtectionV2MediumTermWinnerConfirmExperiment', 'NORMAL_REPLAY_MUST_NOT_AUTO_RUN_V2_CONFIRM');

// CORE_GATE_V1 must have one implementation shared by replay and production portfolio paths.
requireText(sharedCoreGate, 'export function applyCoreGateV1', 'SHARED_CORE_GATE_FUNCTION_MISSING');
requireText(sharedCoreGate, 'export function evaluatePortfolioDecision', 'PRODUCTION_PORTFOLIO_ENTRY_MISSING');
requireText(replayRotation, "from './portfolioCoreGatePolicy'", 'REPLAY_MUST_IMPORT_SHARED_CORE_GATE');
requireText(replayRotation, 'return applyCoreGateV1(evaluationInput, baseline, counters);', 'REPLAY_MUST_CALL_SHARED_CORE_GATE');
forbidText(replayRotation, 'const CORE_PRIORITY =', 'REPLAY_MUST_NOT_DUPLICATE_CORE_GATE_POLICY');
requireText(realPortfolio, 'evaluatePortfolioDecision({', 'REAL_PORTFOLIO_MUST_USE_SHARED_DECISION_ENTRY');
requireText(executionPlan, 'evaluatePortfolioDecision({', 'EXECUTION_PLAN_MUST_USE_SHARED_DECISION_ENTRY');
forbidText(realPortfolio, 'PortfolioDecisionEngine.evaluate({', 'REAL_PORTFOLIO_MUST_NOT_BYPASS_SHARED_CORE_GATE');
forbidText(executionPlan, 'PortfolioDecisionEngine.evaluate({', 'EXECUTION_PLAN_MUST_NOT_BYPASS_SHARED_CORE_GATE');

// Replay and live monitoring must share the same operative health classifier.
requireText(health, 'export function classifyPositionHealth', 'SHARED_HEALTH_CLASSIFIER_MISSING');
requireText(replayCore, 'const classification = classifyPositionHealth(assessment, cash.excessVsCashPctPoints, context);', 'REPLAY_MUST_USE_SHARED_HEALTH_CLASSIFIER');
requireText(health, 'const classification = classifyPositionHealth(input.assessment, cash.excessVsCashPctPoints, context);', 'LIVE_MUST_USE_SHARED_HEALTH_CLASSIFIER');

// Live listed positions must not drop MFE/giveback context when tracked cost basis exists.
requireText(health, 'TaxLotLedgerService.lots(input.ticker)', 'LIVE_LISTED_HEALTH_MUST_USE_TRACKED_LOTS');
requireText(health, 'PortfolioExecutionHistoryService.load()', 'LIVE_HEALTH_MUST_REBASE_FROM_EXECUTION_HISTORY');
requireText(health, 'POSITION_COST_BASIS_INCOMPLETE', 'MISSING_COST_BASIS_MUST_BE_EXPLICIT');

console.log('DECISION_ARCHITECTURE_PARITY_PASS');
