import process from 'node:process';

const JOB_ID = 'timesfm-stage-a-smoke-v1';
const MARKER = 'TIMESFM_STAGE_A_SMOKE_RESULT';
const base = String(process.env.TIMESFM_RUNNER_URL || '').trim().replace(/\/$/, '');
const token = String(process.env.TIMESFM_RUNNER_TOKEN || '').trim();
const pollMs = Math.max(10, Number(process.env.TIMESFM_RUNNER_POLL_MS || 2000));
const timeoutMs = Math.max(1000, Number(process.env.TIMESFM_RUNNER_TIMEOUT_MS || 45 * 60 * 1000));

if (!base) throw new Error('TIMESFM_RUNNER_URL_REQUIRED');
if (!token) throw new Error('TIMESFM_RUNNER_TOKEN_REQUIRED');

const endpoint = `${base}/v1/jobs/${JOB_ID}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function request(method) {
  const response = await fetch(endpoint, {
    method,
    headers,
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !(method === 'POST' && response.status === 409 && payload?.status === 'RUNNING')) {
    throw new Error(`TIMESFM_REMOTE_${method}_FAILED:${response.status}:${JSON.stringify(payload).slice(0, 1000)}`);
  }
  return payload;
}

let state = await request('POST');
console.log(`[TimesFM remote] runner accepted job: ${state.status}`);

let printed = '';
const started = Date.now();
while (true) {
  state = await request('GET');
  const output = String(state.output || '');
  if (output.startsWith(printed)) {
    const delta = output.slice(printed.length);
    if (delta) process.stdout.write(delta);
  } else if (output !== printed) {
    process.stdout.write('\n[TimesFM remote] runner log was compacted/replaced; showing current tail:\n');
    process.stdout.write(output);
  }
  printed = output;

  if (state.status === 'PASSED' || state.status === 'FAILED') break;
  if (Date.now() - started > timeoutMs) throw new Error('TIMESFM_REMOTE_POLL_TIMEOUT');
  await new Promise(resolve => setTimeout(resolve, pollMs));
}

if (state.result) {
  console.log(MARKER);
  console.log(JSON.stringify(state.result, null, 2));
}

if (state.status !== 'PASSED') {
  throw new Error(state.error || 'TIMESFM_REMOTE_STAGE_A_FAILED');
}

console.log('[TimesFM remote] PASS_STAGE_A_TECHNICAL_SMOKE');
