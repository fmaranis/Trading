export const TIMESFM_REMOTE_JOB_ID = 'timesfm-stage-a-smoke-v1';

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
}

function runnerBase(): string {
  return String(process.env.TIMESFM_RUNNER_URL || '').trim().replace(/\/$/, '');
}

function runnerToken(): string {
  return String(process.env.TIMESFM_RUNNER_TOKEN || '').trim();
}

export function timesFmRemoteRunnerConfigured(): boolean {
  return Boolean(runnerBase() && runnerToken());
}

export async function fetchTimesFmRemoteState(): Promise<TimesFmRemoteState | null> {
  const base = runnerBase();
  const token = runnerToken();
  if (!base || !token) return null;
  const response = await fetch(`${base}/v1/jobs/${TIMESFM_REMOTE_JOB_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TIMESFM_RUNNER_STATUS_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }
  const payload = await response.json() as TimesFmRemoteState;
  if (!['IDLE', 'RUNNING', 'PASSED', 'FAILED'].includes(payload?.status)) {
    throw new Error('TIMESFM_RUNNER_STATUS_INVALID');
  }
  return payload;
}
