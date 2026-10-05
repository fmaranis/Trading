export const TIMESFM_REMOTE_JOB_ID = 'timesfm-stage-a-smoke-v1';
export const DEFAULT_TIMESFM_ZERO_GPU_URL = 'https://fmaranis-timesfm-stage-a.hf.space';

export interface TimesFmRemoteState {
  jobId: string;
  status: 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  exitCode: number | null;
  output: string;
  result: unknown | null;
  error: string | null;
  execution?: string;
}

function runnerBase(): string {
  return String(process.env.TIMESFM_RUNNER_URL || DEFAULT_TIMESFM_ZERO_GPU_URL).trim().replace(/\/$/, '');
}

export function timesFmRemoteRunnerConfigured(): boolean {
  return Boolean(runnerBase());
}

export async function checkTimesFmRemoteEndpoint(apiName: string, timeoutMs = 8_000): Promise<boolean> {
  const name = String(apiName || '').trim();
  if (!name) throw new Error('TIMESFM_REMOTE_ENDPOINT_NAME_REQUIRED');
  const base = runnerBase();
  const response = await fetch(`${base}/gradio_api/info`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`TIMESFM_ZEROGPU_INFO_FAILED:${response.status}:${text.slice(0, 500)}`);
  }
  let payload: unknown;
  try { payload = JSON.parse(text); }
  catch { throw new Error('TIMESFM_ZEROGPU_INFO_INVALID_JSON'); }
  return JSON.stringify(payload).includes(name);
}

function parseSseComplete(payload: string): unknown {
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

async function callGradio(endpoint: 'status' | 'run_stage_a' | 'multivariate_context_status', timeoutMs: number): Promise<unknown> {
  const base = runnerBase();
  const submit = await fetch(`${base}/gradio_api/call/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [] }),
    signal: AbortSignal.timeout(Math.min(timeoutMs, 30_000))
  });
  if (!submit.ok) {
    const detail = await submit.text();
    throw new Error(`TIMESFM_ZEROGPU_SUBMIT_FAILED:${submit.status}:${detail.slice(0, 500)}`);
  }
  const accepted = await submit.json() as { event_id?: string };
  if (!accepted.event_id) throw new Error('TIMESFM_ZEROGPU_EVENT_ID_MISSING');

  const result = await fetch(`${base}/gradio_api/call/${endpoint}/${encodeURIComponent(accepted.event_id)}`, {
    headers: { Accept: 'text/event-stream' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error(`TIMESFM_ZEROGPU_RESULT_FAILED:${result.status}:${detail.slice(0, 500)}`);
  }
  return parseSseComplete(await result.text());
}

function validateRemoteState(value: unknown): TimesFmRemoteState {
  const payload = value as TimesFmRemoteState;
  if (!payload || payload.jobId !== TIMESFM_REMOTE_JOB_ID) throw new Error('TIMESFM_ZEROGPU_STATE_JOB_ID_INVALID');
  if (!['IDLE', 'RUNNING', 'PASSED', 'FAILED'].includes(payload.status)) throw new Error('TIMESFM_ZEROGPU_STATUS_INVALID');
  return payload;
}

export async function fetchTimesFmRemoteState(): Promise<TimesFmRemoteState> {
  return validateRemoteState(await callGradio('status', 4_000));
}

export async function runTimesFmRemoteStageA(): Promise<TimesFmRemoteState> {
  const timeoutMs = Math.max(30_000, Number(process.env.TIMESFM_RUNNER_TIMEOUT_MS || 180_000));
  return validateRemoteState(await callGradio('run_stage_a', timeoutMs));
}


export interface TimesFmMultivariateRunnerStatus {
  study: 'TIMESFM_MULTIVARIATE_CONTEXT_V1';
  status: 'READY_TIMESFM_MULTIVARIATE_CONTEXT_V1';
  apiVersion: number;
  maxAnchorsPerCall: number;
  gpuDurationSeconds: number;
  targetCount: number;
  pastOnlyCovariateCount: number;
  contextLength: number;
  forecastHorizon: number;
  productionAuthority: boolean;
  productionDefault: 'LEGACY';
}

function validateTimesFmMultivariateRunnerStatus(value: unknown): TimesFmMultivariateRunnerStatus {
  const payload = value as TimesFmMultivariateRunnerStatus;
  if (!payload || payload.study !== 'TIMESFM_MULTIVARIATE_CONTEXT_V1') {
    throw new Error('TIMESFM_MULTIVARIATE_STATUS_STUDY_INVALID');
  }
  if (payload.status !== 'READY_TIMESFM_MULTIVARIATE_CONTEXT_V1') {
    throw new Error('TIMESFM_MULTIVARIATE_STATUS_INVALID');
  }
  return payload;
}

export async function fetchTimesFmMultivariateRunnerStatus(): Promise<TimesFmMultivariateRunnerStatus> {
  return validateTimesFmMultivariateRunnerStatus(await callGradio('multivariate_context_status', 8_000));
}


export function reconcileTimesFmState(local: TimesFmRemoteState, remote: TimesFmRemoteState): TimesFmRemoteState {
  // Local terminal state belongs to the run just executed by this backend and must
  // never be erased by a remote IDLE/stale state. This preserves guard/client errors.
  if (local.status === 'PASSED' || local.status === 'FAILED') return local;

  // While local guards are running, ZeroGPU can legitimately still be IDLE.
  if (local.status === 'RUNNING' && remote.status === 'IDLE') return local;

  // An IDLE local backend normally means a fresh/restarted AI Studio container:
  // in that case the remote Space is the durable authority.
  return remote;
}
