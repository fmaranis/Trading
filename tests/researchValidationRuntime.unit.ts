import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'server/researchValidationRoutes.ts'), 'utf8');
const mount = fs.readFileSync(path.resolve(process.cwd(), 'server/alertAutomationRoutes.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ResearchValidationCenter.tsx'), 'utf8');
const main = fs.readFileSync(path.resolve(process.cwd(), 'src/decisionMain.tsx'), 'utf8');

assert.match(routes, /id: 'forward-risk-v6'/);
assert.match(routes, /scripts\/forwardRiskCrossAssetV6RollingLive\.ts/);
assert.match(routes, /aiTokensUsed: false/);
assert.match(routes, /LOCAL_APP_BACKEND/);
assert.doesNotMatch(routes, /GEMINI|@google\/genai|github actions/i);
assert.match(mount, /research-validation/);
assert.match(ui, /Ejecutar sin IA/);
assert.match(ui, /\/api\/eodhd\/status/);
assert.match(ui, /\/api\/alpha-vantage\/status/);
assert.match(main, /ResearchValidationCenter/);
assert.doesNotMatch(main, /ForwardRiskResearchPanel/);

console.log('researchValidationRuntime.unit: PASS');
