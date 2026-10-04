const JOB_ID = 'timesfm-stage-a-smoke-v1';
const MARKER = 'TIMESFM_STAGE_A_SMOKE_RESULT';
const base = String(process.env.TIMESFM_RUNNER_URL || 'https://fmaranis-timesfm-stage-a.hf.space').trim().replace(/\/$/, '');
const timeoutMs = Math.max(30_000, Number(process.env.TIMESFM_RUNNER_TIMEOUT_MS || 180_000));

function parseSseComplete(payload) {
  for (const block of payload.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (event === 'error') throw new Error(`TIMESFM_ZEROGPU_EVENT_ERROR:${data || 'unknown'}`);
    if (event === 'complete') {
      const decoded = JSON.parse(data || 'null');
      return Array.isArray(decoded) ? decoded[0] : decoded;
    }
  }
  throw new Error('TIMESFM_ZEROGPU_COMPLETE_EVENT_MISSING');
}

async function call(endpoint, timeout) {
  const submit = await fetch(`${base}/gradio_api/call/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [] }),
    signal: AbortSignal.timeout(Math.min(timeout, 30_000))
  });
  if (!submit.ok) throw new Error(`TIMESFM_ZEROGPU_SUBMIT_FAILED:${submit.status}:${(await submit.text()).slice(0, 500)}`);
  const accepted = await submit.json();
  if (!accepted?.event_id) throw new Error('TIMESFM_ZEROGPU_EVENT_ID_MISSING');

  const response = await fetch(`${base}/gradio_api/call/${endpoint}/${encodeURIComponent(accepted.event_id)}`, {
    headers: { Accept: 'text/event-stream' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`TIMESFM_ZEROGPU_RESULT_FAILED:${response.status}:${(await response.text()).slice(0, 500)}`);
  return parseSseComplete(await response.text());
}

function validate(state) {
  if (!state || state.jobId !== JOB_ID) throw new Error('TIMESFM_ZEROGPU_STATE_JOB_ID_INVALID');
  if (!['IDLE', 'RUNNING', 'PASSED', 'FAILED'].includes(state.status)) throw new Error('TIMESFM_ZEROGPU_STATUS_INVALID');
  return state;
}

let state = validate(await call('status', 30_000));
console.log(`[TimesFM ZeroGPU] remote status before run: ${state.status}`);

if (state.status !== 'RUNNING') {
  state = validate(await call('run_stage_a', timeoutMs));
} else {
  const started = Date.now();
  while (state.status === 'RUNNING') {
    if (Date.now() - started > timeoutMs) throw new Error('TIMESFM_ZEROGPU_POLL_TIMEOUT');
    await new Promise(resolve => setTimeout(resolve, 2000));
    state = validate(await call('status', 30_000));
  }
}

if (state.result) {
  console.log(MARKER);
  console.log(JSON.stringify(state.result, null, 2));
}

if (state.status !== 'PASSED') throw new Error(state.error || 'TIMESFM_ZEROGPU_STAGE_A_FAILED');
console.log('[TimesFM ZeroGPU] PASS_STAGE_A_TECHNICAL_SMOKE');
