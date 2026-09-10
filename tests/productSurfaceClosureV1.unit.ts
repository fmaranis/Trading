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
const validationRoutes = read('server/researchValidationRoutes.ts');
const validationCenter = read('src/components/ResearchValidationCenter.tsx');
const replayJsonControls = read('src/components/HistoricalAuditJsonControls.tsx');
const jsonDownload = read('src/jsonDownload.ts');
const marketDashboard = read('src/components/MarketUtilityDashboard.tsx');
const tracePanel = read('src/components/ProductDecisionTracePanel.tsx');
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

check('1004 canonical shell no longer links users into Legacy', () => {
  assert.doesNotMatch(decisionMain, /legacy\.html/);
});

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

check('1007 validation UI uses the native result endpoint rather than Blob download code', () => {
  assert.match(validationCenter, /result\.json/);
  assert.doesNotMatch(validationCenter, /new Blob|createObjectURL|downloadResultJson/);
});

check('1008 replay export uses the dedicated browser-storage JSON helper', () => {
  assert.match(replayJsonControls, /downloadJsonFile/);
  assert.doesNotMatch(replayJsonControls, /URL\.revokeObjectURL/);
});

check('1009 browser-storage JSON helper does not revoke the Blob URL synchronously', () => {
  const click = jsonDownload.indexOf('anchor.click()');
  const timeout = jsonDownload.indexOf('window.setTimeout');
  const revoke = jsonDownload.lastIndexOf('URL.revokeObjectURL(url)');
  assert.ok(click >= 0 && timeout > click && revoke > timeout);
});

check('1010 canonical dashboard exposes the decision trace before actionable alerts', () => {
  const trace = marketDashboard.indexOf('<ProductDecisionTracePanel');
  const alerts = marketDashboard.indexOf('<CurrentOpportunityAlertsPanel');
  assert.ok(trace >= 0 && alerts >= 0 && trace < alerts);
});

check('1011 trace panel derives amounts from evaluatePortfolioDecision', () => {
  assert.match(tracePanel, /evaluatePortfolioDecision\(/);
  assert.match(tracePanel, /recommendedNewInvestmentEur/);
  assert.match(tracePanel, /row\.amountEur/);
});

check('1012 trace panel declares current production allocation policy as LEGACY', () => {
  assert.match(tracePanel, /PRODUCCIÓN · LEGACY/);
  assert.ok(tracePanel.includes('política <b className="text-emerald-200">LEGACY</b>'));
});

check('1013 trace panel names the complete canonical decision path', () => {
  for (const token of ['AssetUniverseScanner', 'Top64 dinámico', 'PortfolioCandidateGate', 'InvestmentDecisionEngine', 'evaluatePortfolioDecision', 'CORE_GATE_V1', 'CORE_ARCHITECTURE_V1']) {
    assert.ok(tracePanel.includes(token), `missing trace token ${token}`);
  }
});

check('1014 future-forward frozen manifest still includes runner and durable state store', () => {
  assert.match(futureForwardProtocol, /scripts\/qualityAllocationDynamicFutureForwardV1CheckpointLive\.ts/);
  assert.match(futureForwardProtocol, /scripts\/qualityAllocationDynamicFutureForwardV1StateStore\.ts/);
});

check('1015 mobile interaction baseline is explicitly present in the canonical stylesheet', () => {
  const css = read('src/index.css');
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /\.touch-target/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

console.log(`Product surface closure V1: ${passed}/15 invariants passed.`);
