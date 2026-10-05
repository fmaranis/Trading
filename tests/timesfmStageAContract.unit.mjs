import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.resolve(root, p), 'utf8');

const requirements = read('backend/requirements-timesfm.txt');
const runner = read('backend/scripts/timesfm_stage_a_smoke.py');
const routes = read('server/researchValidationRoutes.ts');
const ui = read('src/components/ResearchValidationCenter.tsx');
const zeroGpu = read('runner/timesfm/hf-space/app.py');

assert.match(requirements, /timesfm==3\.0\.2/);
assert.match(runner, /TIMESFM_STAGE_A_SMOKE_V1/);
assert.match(runner, /google\/timesfm-3\.0-pytorch/);
assert.match(runner, /24701cec1b1ea47232c0766e888855c9976ef62b/);
assert.match(runner, /a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da/);
assert.match(runner, /hf_hub_download/);
assert.match(runner, /model\.safetensors/);
assert.match(runner, /_sha256_file\(weight_path\)/);
assert.match(runner, /TIMESFM_WEIGHT_SHA256_MISMATCH/);
assert.match(runner, /checkpointWeightSha256Matches/);
assert.match(runner, /dataProvenance": "SYNTHETIC"/);
assert.match(runner, /marketPricesFetched": False/);
assert.match(runner, /marketOutcomesOpened": False/);
assert.match(runner, /economicPolicyOpened": False/);
assert.match(runner, /productionAuthority": False/);
assert.match(runner, /productionDefault": "LEGACY"/);
assert.match(runner, /full_with_future\[:, :information_cutoff\]/);
assert.match(runner, /use_symmetric_averaging=False/);
assert.match(runner, /sort_quantiles=True/);
assert.doesNotMatch(runner, /Yahoo|EODHD|SEC_EDGAR|PortfolioDecisionEngine|PortfolioCandidateGate/);
assert.match(zeroGpu, /TIMESFM_STAGE_A_SMOKE_V1/);
assert.match(zeroGpu, /full_with_future\\\[:, :information_cutoff\\\]/);
assert.match(zeroGpu, /productionDefault\": \"LEGACY\"/);
assert.match(zeroGpu, /@spaces\\.GPU/);

assert.match(ui, /function downloadJobEvidence\(job: ValidationJob\)/);
assert.match(ui, /result\.json/);

const start = routes.indexOf("id: 'timesfm-stage-a-smoke-v1'");
assert.ok(start >= 0, 'TimesFM Stage A job must exist');
const end = routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'", start);
const block = routes.slice(start, end > start ? end : undefined);
assert.match(block, /visibility: 'CURRENT'/);
assert.match(block, /requiresTimesFmRunner: true/);
assert.match(block, /tests\/timesfmRemoteClient\.unit\.mjs/);
assert.match(block, /tests\/timesfmRemoteRunnerContract\.unit\.mjs/);
assert.match(block, /tests\/timesfmStateReconciliation\.unit\.ts/);
assert.match(block, /tests\/timesfmStageAContract\.unit\.mjs/);
assert.match(block, /tests\/researchValidationRuntime\.unit\.ts/);
assert.match(block, /tests\/coreArchitectureV1\.unit\.ts/);
assert.match(block, /npm', args: \['run', 'lint'\]/);
assert.match(block, /scripts\/timesfmStageARemoteClient\.mjs/);
assert.doesNotMatch(block, /timesfmStageABootstrap\.mjs|timesfmPipBootstrap\.unit\.mjs/);

const order = [
  'tests/timesfmRemoteClient.unit.mjs',
  'tests/timesfmRemoteRunnerContract.unit.mjs',
  'tests/timesfmStateReconciliation.unit.ts',
  'tests/timesfmStageAContract.unit.mjs',
  'tests/researchValidationRuntime.unit.ts',
  'tests/coreArchitectureV1.unit.ts',
  "npm', args: ['run', 'lint']",
  'scripts/timesfmStageARemoteClient.mjs'
].map(token => block.indexOf(token));
assert.ok(order.every(index => index >= 0), 'All remote TimesFM Stage A steps must exist');
assert.deepEqual(order, [...order].sort((a, b) => a - b), 'Guards/TypeScript must run before remote TimesFM execution');

console.log('timesfmStageAContract.unit: PASS');
