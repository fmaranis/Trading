import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'server/researchValidationRoutes.ts'), 'utf8');
const mount = fs.readFileSync(path.resolve(process.cwd(), 'server/alertAutomationRoutes.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ResearchValidationCenter.tsx'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/decisionMain.tsx'), 'utf8');

assert.match(routes, /id: 'phase6-forward-risk-context-stage-a-r2-readiness'/);
assert.match(routes, /scripts\/phase6ForwardRiskContextStageAR2CollectorLive\.ts/);
assert.match(routes, /id: 'quality-allocation-dynamic-future-forward-v1'/);
assert.match(routes, /scripts\/qualityAllocationDynamicFutureForwardV1CheckpointLive\.ts/);
assert.match(routes, /id: 'phase9-end-to-end-preclose-v1'/);
assert.match(routes, /tests\/phase9EndToEndPreclose\.unit\.ts/);

assert.match(routes, /aiTokensUsed: false/);
assert.match(routes, /LOCAL_APP_BACKEND/);
assert.doesNotMatch(routes, /GEMINI|@google\/genai|github actions/i);

assert.match(mount, /research-validation/);
assert.match(ui, /Validación de investigación/);
assert.match(ui, /Todo se ejecuta en el backend local, sin IA ni GitHub Actions/);
assert.match(ui, /\/api\/eodhd\/status/);
assert.match(ui, /\/api\/alpha-vantage\/status/);
assert.match(ui, /result\.json/);

assert.match(main, /ResearchValidationCenter/);
assert.match(main, /InteractiveInvestmentDecisionCenter/);
assert.doesNotMatch(main, /ForwardRiskResearchPanel/);

console.log('researchValidationRuntime.unit: PASS');
