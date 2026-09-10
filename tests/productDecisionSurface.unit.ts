import { readFileSync } from 'node:fs';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}
function read(path: string): string {
  return readFileSync(path, 'utf8');
}

const growth = read('src/components/GrowthTradingBot.tsx');
const legacyDecision = read('src/components/InvestmentDecisionCenter.tsx');
const portfolioOverview = read('src/components/PortfolioOverview.tsx');
const interactive = read('src/components/InteractiveInvestmentDecisionCenter.tsx');
const dashboard = read('src/components/MarketUtilityDashboard.tsx');
const alerts = read('src/components/CurrentOpportunityAlertsPanel.tsx');
const registration = read('src/components/RealPurchaseRegistrationPanel.tsx');
const execution = read('src/components/PortfolioExecutionPlanPanel.tsx');
const core = read('src/investment/decision/portfolioCoreGatePolicy.ts');

check('product growth route delegates to canonical interactive center', growth.includes('InteractiveInvestmentDecisionCenter'));
check('legacy autonomous bot no longer invokes LiveSimulationEngine', !growth.includes('LiveSimulationEngine'));
check('legacy autonomous bot no longer consumes ALL_AVAILABLE_ASSETS', !growth.includes('ALL_AVAILABLE_ASSETS'));
check('old InvestmentDecisionCenter delegates to canonical interactive center', legacyDecision.includes('InteractiveInvestmentDecisionCenter'));
check('old InvestmentDecisionCenter no longer scans its own EUR universe', !legacyDecision.includes('AssetUniverseScanner') && !legacyDecision.includes('EUR_ASSET_UNIVERSE'));
check('portfolio overview delegates to canonical interactive center', portfolioOverview.includes('InteractiveInvestmentDecisionCenter'));
check('interactive center uses AssetUniverseScanner', interactive.includes('AssetUniverseScanner.scan'));
check('interactive center applies PortfolioCandidateGate', interactive.includes('PortfolioCandidateGate.apply'));
check('interactive center calls InvestmentDecisionEngine', interactive.includes('InvestmentDecisionEngine.decide'));
check('dashboard is the single product component that evaluates the canonical portfolio decision', dashboard.includes('evaluatePortfolioDecision('));
check('headline panel consumes portfolioDecision instead of recalculating it', alerts.includes('portfolioDecision: PortfolioDecisionResult') && !alerts.includes('evaluatePortfolioDecision('));
check('headline actions are filtered through the executable plan', alerts.includes('executionPlan: PortfolioExecutionPlan') && alerts.includes("line.action === 'BUY_ETF'") && alerts.includes("line.action === 'SELL_ETF'"));
check('headline cannot call parallel PortfolioRotationReviewEngine', !alerts.includes('PortfolioRotationReviewEngine'));
check('purchase registration consumes the same execution plan', registration.includes('executionPlan: PortfolioExecutionPlan') && !registration.includes('evaluatePortfolioDecision(') && !registration.includes('buildPortfolioExecutionPlan('));
check('execution detail consumes the same plan without rebuilding candidate gate', execution.includes('executionPlan: PortfolioExecutionPlan') && !execution.includes('evaluatePortfolioDecision(') && !execution.includes('PortfolioCandidateGate.apply'));
check('dashboard builds the execution plan once from the canonical decision', dashboard.includes('buildPortfolioExecutionPlan({') && dashboard.includes('portfolioDecision,') && dashboard.includes('applyTaxAwareExecutionOverlay({'));
check('canonical portfolio wrapper starts from PortfolioDecisionEngine', core.includes('PortfolioDecisionEngine.evaluate(normalizedInput)'));
check('canonical portfolio wrapper applies CORE_GATE_V1', core.includes('applyCoreGateV1(normalizedInput, baseline)'));
check('canonical portfolio wrapper applies CORE_ARCHITECTURE_V1', core.includes('applyCoreArchitectureV1(normalizedInput, gated)'));
check('product surface does not fabricate one euro of deployable cash', interactive.includes('return Math.max(0,') && !interactive.includes('return Math.max(1, (p.stagedCapitalPlan'));

console.log(`Canonical product decision surface: ${passed}/20 invariants passed.`);
