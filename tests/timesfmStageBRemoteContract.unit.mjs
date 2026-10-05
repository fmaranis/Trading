import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.resolve(root,p),'utf8');
const app = read('runner/timesfm/hf-space/app.py');
const client = read('scripts/timesfmStageBRemoteClient.mjs');
const live = read('scripts/timesfmStageBDiagnosticLive.mjs');
const protocol = read('scripts/timesfmStageBProtocol.mjs');

assert.match(app, /STAGE_B_STUDY = "TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1"/);
assert.match(app, /STAGE_B_CONTEXT_LENGTH = 512/);
assert.match(app, /STAGE_B_HORIZON = 60/);
assert.match(app, /STAGE_B_MAX_CASES = 256/);
assert.match(app, /STAGE_B_GPU_DURATION_SECONDS = 80/);
assert.match(app, /per_core_batch_size=16/);
assert.match(app, /@spaces\.GPU\(duration=STAGE_B_GPU_DURATION_SECONDS\)/);
assert.match(app, /api_name="stage_b_predict"/);
assert.match(app, /futureOutcomesReceived": False/);
assert.match(app, /marketDataFetchedBySpace": False/);
assert.match(app, /productionAuthority": False/);
assert.match(app, /productionDefault": "LEGACY"/);
assert.match(app, /forbidden_fragments = \("future", "outcome", "actual", "forwardreturn", "realized", "realised"\)/);
assert.match(app, /contexts=mv_contexts/);
assert.match(app, /contexts=uv_contexts/);
assert.match(app, /np\.stack\(\[asset, core\], axis=0\)/);
assert.match(app, /mvAssetPath60/);

const stageBStart = app.indexOf('def _coerce_stage_b_payload');
const stageBEnd = app.indexOf('with gr.Blocks() as demo:', stageBStart);
const stageB = app.slice(stageBStart, stageBEnd);
assert.doesNotMatch(stageB, /Yahoo|EODHD|SEC_EDGAR|PortfolioDecisionEngine|PortfolioCandidateGate/);

assert.match(client, /\/gradio_api\/call\/stage_b_predict/);
assert.match(client, /JSON\.stringify\(\{ data: \[payload\] \}\)/);
assert.doesNotMatch(client, /TIMESFM_RUNNER_TOKEN|Authorization|Bearer/);
assert.match(client, /PASS_STAGE_B_INFERENCE_BATCH/);

assert.match(live, /sourceType:'REAL'/);
assert.match(live, /includeAdjustedClose=true/);
assert.match(live, /quote\.close/);
assert.match(live, /buildStageBCases/);
assert.match(live, /callTimesFmStageB\(payload\)/);
assert.ok(
  live.indexOf('const remote=await callTimesFmStageB(payload);') <
  live.indexOf('const evaluated=evaluateStageB(series,built.cases,remote);'),
  'Forecast must return before outcomes are evaluated.'
);
assert.match(live, /payload:\{caseId,assetContext,coreContext\}/);
assert.doesNotMatch(protocol, /productionAuthority: true/);
assert.match(protocol, /productionDefault: 'LEGACY'/);

console.log('timesfmStageBRemoteContract.unit: PASS');
