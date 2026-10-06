const DEFAULT_TIMESFM_ZERO_GPU_URL = 'https://fmaranis-timesfm-stage-a.hf.space';
export const TIMESFM_STAGE_B_STUDY = 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1';

function hfToken() {
  const value = String(
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HUGGING_FACE_HUB_TOKEN ||
    ''
  ).trim();
  return value || null;
}

function authHeaders(extra = {}) {
  const token = hfToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function parseGradioSseComplete(payload) {
  for (const block of String(payload).split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (event === 'error') throw new Error(`TIMESFM_STAGE_B_ZEROGPU_EVENT_ERROR:${data || 'unknown'}`);
    if (event === 'complete') {
      const decoded = JSON.parse(data || 'null');
      return Array.isArray(decoded) ? decoded[0] : decoded;
    }
  }
  throw new Error('TIMESFM_STAGE_B_ZEROGPU_COMPLETE_EVENT_MISSING');
}

export async function callTimesFmStageB(payload, options = {}) {
  const base = String(options.baseUrl || process.env.TIMESFM_RUNNER_URL || DEFAULT_TIMESFM_ZERO_GPU_URL).trim().replace(/\/$/, '');
  const timeoutMs = Math.max(30_000, Number(options.timeoutMs || process.env.TIMESFM_RUNNER_TIMEOUT_MS || 180_000));
  if (!hfToken()) throw new Error('TIMESFM_HF_TOKEN_REQUIRED');
  if (!payload || payload.study !== TIMESFM_STAGE_B_STUDY || !Array.isArray(payload.cases) || payload.cases.length === 0) {
    throw new Error('TIMESFM_STAGE_B_PAYLOAD_INVALID');
  }

  const submit = await fetch(`${base}/gradio_api/call/stage_b_predict`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data: [payload] }),
    signal: AbortSignal.timeout(Math.min(timeoutMs, 30_000))
  });
  if (!submit.ok) {
    const detail = await submit.text();
    throw new Error(`TIMESFM_STAGE_B_ZEROGPU_SUBMIT_FAILED:${submit.status}:${detail.slice(0, 500)}`);
  }
  const accepted = await submit.json();
  if (!accepted?.event_id) throw new Error('TIMESFM_STAGE_B_ZEROGPU_EVENT_ID_MISSING');

  const response = await fetch(
    `${base}/gradio_api/call/stage_b_predict/${encodeURIComponent(accepted.event_id)}`,
    {
      headers: authHeaders({ Accept: 'text/event-stream' }),
      signal: AbortSignal.timeout(timeoutMs)
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TIMESFM_STAGE_B_ZEROGPU_RESULT_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  const result = parseGradioSseComplete(await response.text());
  if (!result || result.study !== TIMESFM_STAGE_B_STUDY || result.status !== 'PASS_STAGE_B_INFERENCE_BATCH') {
    throw new Error('TIMESFM_STAGE_B_ZEROGPU_RESPONSE_INVALID');
  }
  if (!Array.isArray(result.cases) || result.cases.length !== payload.cases.length) {
    throw new Error('TIMESFM_STAGE_B_ZEROGPU_CASE_COUNT_MISMATCH');
  }
  return result;
}
