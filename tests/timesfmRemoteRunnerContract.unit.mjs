import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = p => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
const docker = read('runner/timesfm/Dockerfile');
const server = read('runner/timesfm/server.py');
const client = read('scripts/timesfmStageARemoteClient.mjs');
const routes = read('server/researchValidationRoutes.ts');
const remote = read('server/timesfmRemoteRunner.ts');

assert.match(docker, /python:3\.11-slim/);
assert.match(docker, /download\.pytorch\.org\/whl\/cpu/);
assert.match(docker, /timesfm/);
assert.match(docker, /snapshot_download/);
assert.match(docker, /24701cec1b1ea47232c0766e888855c9976ef62b/);
assert.match(docker, /a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da/);
assert.match(docker, /HF_HUB_OFFLINE=1/);

assert.match(server, /JOB_ID = "timesfm-stage-a-smoke-v1"/);
assert.match(server, /TIMESFM_RUNNER_TOKEN/);
assert.match(server, /HF_HUB_OFFLINE/);
assert.match(server, /TIMESFM_RUNNER_RESTARTED_DURING_JOB/);
assert.match(server, /ThreadingHTTPServer/);
assert.doesNotMatch(server, /shell=True|os\.system|eval\(|exec\(/);

assert.match(client, /TIMESFM_RUNNER_URL_REQUIRED/);
assert.match(client, /TIMESFM_RUNNER_TOKEN_REQUIRED/);
assert.match(client, /\/v1\/jobs\//);
assert.match(client, /PASS_STAGE_A_TECHNICAL_SMOKE/);
assert.match(remote, /fetchTimesFmRemoteState/);
assert.match(routes, /requiresTimesFmRunner: true/);
assert.match(routes, /scripts\/timesfmStageARemoteClient\.mjs/);
assert.doesNotMatch(
  routes.slice(routes.indexOf("id: 'timesfm-stage-a-smoke-v1'"), routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'")),
  /timesfmStageABootstrap\.mjs/
);

console.log('timesfmRemoteRunnerContract.unit: PASS');
