import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

const token = 'test-token';
let getCount = 0;
const result = {
  study: 'TIMESFM_STAGE_A_SMOKE_V1',
  status: 'PASS_STAGE_A_TECHNICAL_SMOKE',
  protocol: {
    dataProvenance: 'SYNTHETIC',
    marketPricesFetched: false,
    marketOutcomesOpened: false,
    productionAuthority: false,
    productionDefault: 'LEGACY'
  }
};

const server = http.createServer((req, res) => {
  assert.equal(req.headers.authorization, `Bearer ${token}`);
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST') {
    res.statusCode = 202;
    res.end(JSON.stringify({ jobId: 'timesfm-stage-a-smoke-v1', status: 'RUNNING', output: '' }));
    return;
  }
  getCount += 1;
  if (getCount < 2) {
    res.end(JSON.stringify({
      jobId: 'timesfm-stage-a-smoke-v1',
      status: 'RUNNING',
      output: '[runner] downloading checkpoint\n'
    }));
    return;
  }
  res.end(JSON.stringify({
    jobId: 'timesfm-stage-a-smoke-v1',
    status: 'PASSED',
    output: '[runner] downloading checkpoint\n[runner] inference complete\n',
    result,
    error: null
  }));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');

const child = spawn(
  process.execPath,
  [path.resolve(process.cwd(), 'scripts/timesfmStageARemoteClient.mjs')],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TIMESFM_RUNNER_URL: `http://127.0.0.1:${address.port}`,
      TIMESFM_RUNNER_TOKEN: token,
      TIMESFM_RUNNER_POLL_MS: '10',
      TIMESFM_RUNNER_TIMEOUT_MS: '3000'
    }
  }
);
let stdout = '';
let stderr = '';
child.stdout.on('data', chunk => { stdout += String(chunk); });
child.stderr.on('data', chunk => { stderr += String(chunk); });
const exitCode = await new Promise(resolve => child.on('close', code => resolve(code)));
await new Promise(resolve => server.close(resolve));

assert.equal(exitCode, 0, stderr || stdout);
assert.match(stdout, /runner accepted job: RUNNING/);
assert.match(stdout, /downloading checkpoint/);
assert.match(stdout, /inference complete/);
assert.match(stdout, /TIMESFM_STAGE_A_SMOKE_RESULT/);
assert.match(stdout, /PASS_STAGE_A_TECHNICAL_SMOKE/);
console.log('timesfmRemoteClient.unit: PASS');
