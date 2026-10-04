import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

const result = {
  study: 'TIMESFM_STAGE_A_SMOKE_V1',
  status: 'PASS_STAGE_A_TECHNICAL_SMOKE',
  protocol: { dataProvenance: 'SYNTHETIC', marketPricesFetched: false, marketOutcomesOpened: false, productionAuthority: false, productionDefault: 'LEGACY', zeroCostInfrastructure: true }
};

let nextId = 0;
const events = new Map();
const server = http.createServer((req, res) => {
  const match = /^\/gradio_api\/call\/(status|run_stage_a)(?:\/([^/]+))?$/.exec(req.url || '');
  if (!match) { res.statusCode = 404; res.end('not found'); return; }
  const [, endpoint, eventId] = match;
  if (req.method === 'POST' && !eventId) {
    const id = `evt-${++nextId}`;
    events.set(id, endpoint === 'status'
      ? { jobId: 'timesfm-stage-a-smoke-v1', status: 'IDLE', output: '', result: null, error: null }
      : { jobId: 'timesfm-stage-a-smoke-v1', status: 'PASSED', output: '[ZeroGPU] complete\n', result, error: null });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ event_id: id }));
    return;
  }
  if (req.method === 'GET' && eventId) {
    const state = events.get(eventId);
    if (!state) { res.statusCode = 404; res.end('missing'); return; }
    res.setHeader('Content-Type', 'text/event-stream');
    res.end(`event: complete\ndata: ${JSON.stringify([state])}\n\n`);
    return;
  }
  res.statusCode = 405; res.end('method not allowed');
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const child = spawn(process.execPath, [path.resolve(process.cwd(), 'scripts/timesfmStageARemoteClient.mjs')], {
  cwd: process.cwd(),
  env: { ...process.env, TIMESFM_RUNNER_URL: `http://127.0.0.1:${address.port}`, TIMESFM_RUNNER_TIMEOUT_MS: '5000' }
});
let stdout = ''; let stderr = '';
child.stdout.on('data', chunk => { stdout += String(chunk); });
child.stderr.on('data', chunk => { stderr += String(chunk); });
const exitCode = await new Promise(resolve => child.on('close', code => resolve(code)));
await new Promise(resolve => server.close(resolve));

assert.equal(exitCode, 0, stderr || stdout);
assert.match(stdout, /remote status before run: IDLE/);
assert.match(stdout, /TIMESFM_STAGE_A_SMOKE_RESULT/);
assert.match(stdout, /PASS_STAGE_A_TECHNICAL_SMOKE/);
console.log('timesfmRemoteClient.unit: PASS');
