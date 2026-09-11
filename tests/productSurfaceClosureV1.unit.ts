import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
function read(path: string): string { return readFileSync(path, 'utf8'); }
function check(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const indexHtml = read('index.html');
const legacyHtml = read('legacy.html');
const decisionMain = read('src/decisionMain.tsx');
const interactive = read('src/components/InteractiveInvestmentDecisionCenter.tsx');
const guardrails = read('src/components/DecisionGuardrailsPanel.tsx');
const validationRoutes = read('server/researchValidationRoutes.ts');
const validationCenter = read('src/components/ResearchValidationCenter.tsx');
const replayJsonControls = read('src/components/HistoricalAuditJsonControls.tsx');
const jsonDownload = read('src/jsonDownload.ts');
const marketDashboard = read('src/components/MarketUtilityDashboard.tsx');
const alerts = read('src/components/CurrentOpportunityAlertsPanel.tsx');
const registration = read('src/components/RealPurchaseRegistrationPanel.tsx');
const execution = read('src/components/PortfolioExecutionPlanPanel.tsx');
const futureForwardProtocol = read('scripts/qualityAllocationDynamicFutureForwardV1Protocol.ts');

check('1001 root product starts at the canonical decision entrypoint', () => {
  assert.match(indexHtml, /src\/decisionMain\.tsx/);
  assert.doesNotMatch(indexHtml, /src\/main\.tsx/);
});
check('1002 legacy route cannot boot the old App product surface', () => {
  assert.doesNotMatch(legacyHtml, /src\/main\.tsx/);
  assert.match(legacyHtml, /window\.location\.replace\('\/'\)/);
});
check('1003 canonical shell mounts one decision center and research validation', () => {
  assert.match(decisionMain, /InteractiveInvestmentDecisionCenter/);
  assert.match(decisionMain, /ResearchValidationCenter/);
  assert.doesNotMatch(decisionMain, /GrowthTradingBot|LiveSimulationEngine|ALL_AVAILABLE_ASSETS/);
});
check('1004 canonical shell no longer links users into Legacy', () => assert.doesNotMatch(decisionMain, /legacy\.html/));
check('1005 validation results expose a native HTTP JSON attachment', () => {
  assert.match(validationRoutes, /\/jobs\/:id\/result\.json/);
  assert.match(validationRoutes, /Content-Disposition/);
  assert.match(validationRoutes, /attachment; filename=/);
});
check('1006 future-forward token is preflighted before the job is launched', () => {
  const prereq = validationRoutes.indexOf('const missing = prerequisiteError(job);');
  const run = validationRoutes.indexOf('void runJob(job);');
  assert.ok(prereq >= 0 && run >= 0 && prereq < run);
  assert.match(validationRoutes, /QUALITY_FF_DURABLE_GITHUB_TOKEN_REQUIRED/);
});
check('1007 future-forward UI explains verification/no-rewrite without requiring JSON interpretation', () => {
  assert.match(validationCenter, /ESTADO VERIFICADO · SIN REESCRIBIR/);
  assert.match(validationCenter, /NO CREÓ OBSERVACIÓN/);
  assert.match(validationCenter, /expectedObservationMonth/);
  assert.match(validationCenter, /Evidencia JSON/);
});
check('1008 validation UI uses the native result endpoint rather than Blob download code', () => {
  assert.match(validationCenter, /result\.json/);
  assert.doesNotMatch(validationCenter, /new Blob|createObjectURL|downloadResultJson/);
});
check('1009 replay export uses the dedicated browser-storage JSON helper', () => {
  assert.match(replayJsonControls, /downloadJsonFile/);
  assert.doesNotMatch(replayJsonControls, /URL\.revokeObjectURL/);
});
check('1010 browser-storage JSON helper does not revoke the Blob URL synchronously', () => {
  const click = jsonDownload.indexOf('anchor.click()');
  const timeout = jsonDownload.indexOf('window.setTimeout');
  const revoke = jsonDownload.lastIndexOf('URL.revokeObjectURL(url)');
  assert.ok(click >= 0 && timeout > click && revoke > timeout);
});
check('1011 replay export keeps transient mobile user activation until downloadJsonFile', () => {
  const start = replayJsonControls.indexOf('const exportSession = () =>');
  const download = replayJsonControls.indexOf('downloadJsonFile(', start);
  assert.ok(start >= 0 && download > start);
  const beforeDownload = replayJsonControls.slice(start, download);
  assert.doesNotMatch(beforeDownload, /\bawait\s+|requestAnimationFrame\s*\(/);
});
check('1012 actionable decision is rendered before cash and secondary technical detail', () => {
  const headline = interactive.indexOf('<MarketUtilityDashboard');
  const cash = interactive.indexOf('Papel del cash');
  assert.ok(headline >= 0 && cash > headline);
});
check('1013 actionable dashboard waits for portfolio health to finish', () => {
  assert.match(interactive, /!positionHealthLoading && positionHealth != null && <MarketUtilityDashboard/);
  assert.match(interactive, /Decisión operativa bloqueada/);
});
check('1014 real deployable capital can remain exactly zero', () => {
  assert.match(interactive, /return Math\.max\(0,/);
  assert.doesNotMatch(interactive, /return Math\.max\(1, \(p\.stagedCapitalPlan/);
  assert.match(interactive, /NO_DEPLOYABLE_CAPITAL_ANALYTICAL_WEIGHTS_ONLY/);
});
check('1015 guardrails do not launch a parallel client historical replay', () => {
  assert.doesNotMatch(guardrails, /CausalUniverseBacktestEngine|MixedInstrumentCausalReplayEngine|calculateHistorical|initialCapital:/);
  assert.match(guardrails, /La investigación histórica se hace en el replay integrado/);
});
check('1016 dashboard calculates the portfolio decision exactly once for actionable children', () => {
  assert.match(marketDashboard, /const portfolioDecision = useMemo\(\(\) => evaluatePortfolioDecision/);
  assert.match(marketDashboard, /<CurrentOpportunityAlertsPanel[\s\S]*portfolioDecision=\{portfolioDecision\}/);
  assert.doesNotMatch(alerts, /evaluatePortfolioDecision\(/);
  assert.doesNotMatch(registration, /evaluatePortfolioDecision\(/);
  assert.doesNotMatch(execution, /evaluatePortfolioDecision\(/);
});
check('1017 canonical portfolio snapshot is memoized to keep plan identity stable', () => {
  assert.match(marketDashboard, /const portfolio = useMemo\(\(\) => UserPortfolioService\.load\(\)/);
  assert.match(marketDashboard, /Date\.now\(\)-based execution-line IDs/);
});
check('1018 dashboard creates one tax-aware executable plan from the canonical decision', () => {
  assert.match(marketDashboard, /buildPortfolioExecutionPlan\(/);
  assert.match(marketDashboard, /applyTaxAwareExecutionOverlay\(/);
  assert.match(marketDashboard, /executionPlan=\{executionPlan\}/);
  assert.doesNotMatch(registration, /buildPortfolioExecutionPlan\(/);
  assert.doesNotMatch(execution, /buildPortfolioExecutionPlan\(/);
});
check('1019 headline uses executable BUY SELL TRANSFER lines rather than theoretical actions', () => {
  assert.match(alerts, /executionPlan\.lines\.filter/);
  assert.match(alerts, /line\.action === 'BUY_ETF'/);
  assert.match(alerts, /line\.action === 'SELL_ETF'/);
  assert.match(alerts, /line\.action === 'TRANSFER_FUND'/);
  assert.match(alerts, /Motor \{theoreticalBuyAmount\.toFixed\(2\)\} € · ejecutable/);
});
check('1020 theoretical movement suppressed by costs or tax is labeled REVIEW, not executable', () => {
  assert.match(alerts, /line\.action === 'REVIEW'/);
  assert.match(alerts, /no son orden ejecutable hoy/);
  assert.match(execution, /SIN ORDEN EJECUTABLE · HAY PUNTOS A REVISAR/);
});
check('1021 headline cannot call a parallel rotation or portfolio engine', () => {
  assert.doesNotMatch(alerts, /PortfolioRotationReviewEngine|PortfolioDecisionEngine|evaluatePortfolioDecision/);
  assert.match(alerts, /portfolioDecision: PortfolioDecisionResult/);
  assert.match(alerts, /executionPlan: PortfolioExecutionPlan/);
});
check('1022 registration accepts only executable purchases from the same plan', () => {
  assert.match(registration, /executionPlan\.lines\.filter/);
  assert.match(registration, /BUY_ETF/);
  assert.match(registration, /SUBSCRIBE_FUND/);
  assert.doesNotMatch(registration, /PortfolioCandidateGate|InvestmentDecisionEngine/);
});
check('1023 execution detail cannot rebuild the candidate gate or decision', () => {
  assert.doesNotMatch(execution, /PortfolioCandidateGate|evaluatePortfolioDecision|StrategyConsensusEngine/);
  assert.match(execution, /executionPlan: PortfolioExecutionPlan/);
});
check('1024 headline explains the complete canonical decision path', () => {
  for (const token of ['AssetUniverseScanner', 'Top64 dinámico', 'PortfolioCandidateGate', 'InvestmentDecisionEngine', 'evaluatePortfolioDecision', 'CORE_GATE_V1', 'CORE_ARCHITECTURE_V1']) {
    assert.ok(alerts.includes(token), `missing decision path token ${token}`);
  }
  assert.match(alerts, /Política productiva:/);
  assert.match(alerts, />LEGACY</);
});
check('1025 future-forward frozen manifest still includes runner and durable state store', () => {
  assert.match(futureForwardProtocol, /scripts\/qualityAllocationDynamicFutureForwardV1CheckpointLive\.ts/);
  assert.match(futureForwardProtocol, /scripts\/qualityAllocationDynamicFutureForwardV1StateStore\.ts/);
});
check('1026 mobile interaction baseline is explicitly present in the canonical stylesheet', () => {
  const css = read('src/index.css');
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /\.touch-target/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
check('1027 ResearchValidationCenter exposes one-click quick closure without replay or checkpoint', () => {
  const start = validationRoutes.indexOf("id: 'product-surface-closure-v1'");
  const end = validationRoutes.indexOf("id: 'quality-allocation-dynamic-future-forward-v1'", start);
  assert.ok(start >= 0 && end > start);
  const block = validationRoutes.slice(start, end);
  for (const token of ['tests/productSurfaceClosureV1.unit.ts', 'tests/productDecisionSurface.unit.ts', 'tests/portfolioExecutionPlan.unit.ts', 'tests/userPortfolio.unit.ts', 'tests/brokerAvailability.unit.ts', 'tests/taxAwareExecutionOverlay.unit.ts']) {
    assert.ok(block.includes(token), `missing quick closure step ${token}`);
  }
  assert.match(block, /args: \['run', 'lint'\]/);
  assert.doesNotMatch(block, /Checkpoint prospectivo|qualityAllocationDynamicFutureForwardV1CheckpointLive|replay-results/);
});

console.log(`Product surface closure V1: ${passed}/27 invariants passed.`);
