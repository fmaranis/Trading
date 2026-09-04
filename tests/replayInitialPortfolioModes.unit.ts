import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const requireText = (text: string, fragment: string, error: string) => {
  if (!text.includes(fragment)) throw new Error(error);
};
const forbidText = (text: string, fragment: string, error: string) => {
  if (text.includes(fragment)) throw new Error(error);
};

const core = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const wrapper = source('src/investment/decision/dynamicHistoricalReplay.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const panel = source('src/components/HistoricalReplayProgressivePanel.tsx');
const controls = source('src/components/ReplayInitialPortfolioControls.tsx');

// Backwards compatibility: old replay remains the default path.
requireText(core, "const simulationMode = input.simulationMode ?? 'CUSTODIA_ENGINE'", 'DEFAULT_REPLAY_MUST_REMAIN_CUSTODIA_ENGINE');
requireText(core, "const initialPortfolioSource: DynamicReplayInitialPortfolioSource = input.initialPortfolio?.source ?? 'ZERO'", 'DEFAULT_REPLAY_MUST_START_FROM_ZERO');
requireText(core, "if (!input.initialPortfolio) return { holdings, cashEur: input.initialCapitalEur, signals: [] }", 'ZERO_MODE_MUST_PRESERVE_OLD_EMPTY_PORTFOLIO_START');

// Initial allocations are state, not a second strategy or fabricated recommendation.
requireText(core, 'seedInitialPortfolio', 'INITIAL_PORTFOLIO_MUST_BE_SEEDED_IN_CANONICAL_CORE');
requireText(core, 'isInitialAllocation: true', 'INITIAL_ALLOCATIONS_MUST_BE_MARKED_EXPLICITLY');
requireText(core, 'Posición de partida definida por el usuario. Es estado inicial del replay, no una compra decidida por Custodia.', 'INITIAL_STATE_SEMANTICS_MISSING');
requireText(core, 'const portfolioDecision = PortfolioDecisionEngine.evaluate({', 'CUSTODIA_MODE_MUST_KEEP_EXISTING_PORTFOLIO_DECISION_ENGINE');
requireText(core, 'PortfolioCandidateGate.apply', 'CUSTODIA_MODE_MUST_KEEP_EXISTING_CANDIDATE_GATE');

// HOLD_ONLY is a mode of the same replay core: no decisions, same remunerated cash helpers.
requireText(core, "if (simulationMode === 'HOLD_ONLY')", 'HOLD_ONLY_BRANCH_MISSING');
requireText(core, 'accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, input.startDate, endDate)', 'HOLD_ONLY_MUST_USE_EXISTING_REMUNERATED_CASH');
requireText(core, "operationalParity: 'HOLD_ONLY_NO_DECISIONS'", 'HOLD_ONLY_MUST_DECLARE_NO_DECISIONS');
requireText(core, 'decisions: 0', 'HOLD_ONLY_MUST_NOT_RUN_DECISIONS');

// Public wrapper and worker must pass the new options into the SAME DynamicHistoricalReplayEngine.
requireText(wrapper, 'DynamicReplaySimulationMode', 'PUBLIC_REPLAY_MUST_EXPORT_SIMULATION_MODE');
requireText(wrapper, 'DynamicReplayInitialPortfolio', 'PUBLIC_REPLAY_MUST_EXPORT_INITIAL_PORTFOLIO');
requireText(worker, "simulationMode: configuration.simulationMode ?? 'CUSTODIA_ENGINE'", 'WORKER_MUST_FORWARD_SIMULATION_MODE');
requireText(worker, 'initialPortfolio: configuration.initialPortfolio', 'WORKER_MUST_FORWARD_INITIAL_PORTFOLIO');
requireText(worker, 'runDynamicReplayWithRotationExperiment(input, REPLAY_ROTATION_EXPERIMENT)', 'WORKER_MUST_KEEP_EXISTING_CORE_GATE_REPLAY_PATH');

// The feature must live in the existing replay UI, using the existing universe and private portfolio service.
requireText(panel, '<ReplayInitialPortfolioControls', 'INITIAL_PORTFOLIO_CONTROLS_MUST_BE_INSIDE_EXISTING_REPLAY_PANEL');
requireText(panel, "simulationMode: scenario.simulationMode", 'EXISTING_REPLAY_PANEL_MUST_SEND_SIMULATION_MODE');
requireText(panel, 'initialPortfolio: scenarioPortfolio', 'EXISTING_REPLAY_PANEL_MUST_SEND_INITIAL_PORTFOLIO');
requireText(controls, 'EUR_PORTFOLIO_DISCOVERY_UNIVERSE', 'MANUAL_PORTFOLIO_MUST_USE_EXISTING_ASSET_UNIVERSE');
requireText(controls, 'UserPortfolioService.load()', 'CURRENT_PORTFOLIO_MODE_MUST_USE_PRIVATE_CURRENT_PORTFOLIO');
requireText(controls, "<option value=\"ZERO\">", 'ZERO_SOURCE_UI_MISSING');
requireText(controls, "<option value=\"MANUAL\">", 'MANUAL_SOURCE_UI_MISSING');
requireText(controls, "<option value=\"CURRENT_PORTFOLIO\">", 'CURRENT_PORTFOLIO_SOURCE_UI_MISSING');
requireText(controls, "<option value=\"CUSTODIA_ENGINE\">", 'CUSTODIA_ENGINE_UI_MISSING');
requireText(controls, "<option value=\"HOLD_ONLY\">", 'HOLD_ONLY_UI_MISSING');

// Prevent an obvious future architecture regression: no independent replay engine in the controls.
forbidText(controls, 'class Replay', 'CONTROLS_MUST_NOT_DEFINE_A_SECOND_REPLAY_ENGINE');
forbidText(controls, 'PortfolioDecisionEngine.evaluate', 'CONTROLS_MUST_NOT_IMPLEMENT_FINANCIAL_POLICY');

console.log('PASS replayInitialPortfolioModes.unit');
