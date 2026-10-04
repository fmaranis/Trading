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

async function callGradio(endpoint: 'status' | 'run_stage_a', timeoutMs: number): Promise<unknown> {
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
  return validateRemoteState(await callGradio('status', 30_000));
}

export async function runTimesFmRemoteStageA(): Promise<TimesFmRemoteState> {
  const timeoutMs = Math.max(30_000, Number(process.env.TIMESFM_RUNNER_TIMEOUT_MS || 180_000));
  return validateRemoteState(await callGradio('run_stage_a', timeoutMs));
}
