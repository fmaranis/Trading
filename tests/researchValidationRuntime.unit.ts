import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'server/researchValidationRoutes.ts'), 'utf8');
const mount = fs.readFileSync(path.resolve(process.cwd(), 'server/alertAutomationRoutes.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ResearchValidationCenter.tsx'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/decisionMain.tsx'), 'utf8');

assert.match(routes, /id: 'sector-52w-high-leadership-v1'/);
assert.match(routes, /scripts\/sector52WeekHighLeadershipV1YahooInput\.mjs/);
assert.match(routes, /scripts\/sector52WeekHighLeadershipV1Live\.mjs/);
assert.match(routes, /scripts\/sector52WeekHighLeadershipV1YahooNavAudit\.mjs/);
assert.match(routes, /tests\/sector52WeekHighLeadershipV1YahooNavAudit\.unit\.mjs/);
assert.match(routes, /tests\/sector52WeekHighLeadershipV1YahooCorporateActions\.unit\.mjs/);
assert.match(routes, /scripts\/sector52WeekHighLeadershipV1RevisionGuard\.mjs/);
assert.match(routes, /tests\/sector52WeekHighLeadershipV1\.e2e\.unit\.mjs/);
assert.match(routes, /scripts\/sector52WeekHighLeadershipV1YahooCorporateActions\.mjs/);
assert.match(routes, /SECTOR_52W_HIGH_LEADERSHIP_V1_RESULT/);
assert.match(routes, /id: 'pead-earnings-source-audit-v1'/);
assert.match(routes, /tests\/peadEarningsSourceAuditV1\.unit\.mjs/);
assert.match(routes, /scripts\/peadEarningsSourceAuditV1\.mjs/);
assert.match(routes, /52W V1 · FAIL_DIAGNOSTIC · cerrado/);
assert.match(routes, /id: 'fundamental-quality-valuation-broad-pit-v1'/);
assert.match(routes, /scripts\/fundamentalQualityValuationBroadPitV1Live\.ts/);
assert.match(routes, /SEC_EDGAR_USER_AGENT_REQUIRED/);
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
assert.match(ui, /Ejecutar diagnóstico 52W · rev\. técnica 3/);
assert.match(ui, /SECTOR_52W_HIGH_LEADERSHIP_V1/);
assert.match(ui, /Todo se ejecuta en el backend local, sin IA ni GitHub Actions/);
assert.match(ui, /\/api\/eodhd\/status/);
assert.match(ui, /\/api\/alpha-vantage\/status/);
assert.match(ui, /SEC EDGAR PIT/);
assert.match(ui, /FALTA USER-AGENT/);
assert.match(ui, /result\.json/);

assert.match(main, /ResearchValidationCenter/);
assert.match(main, /InteractiveInvestmentDecisionCenter/);
assert.doesNotMatch(main, /ForwardRiskResearchPanel/);

console.log('researchValidationRuntime.unit: PASS');
