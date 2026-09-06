import express, { Request, Response } from 'express';
import { spawn } from 'node:child_process';

export const researchValidationRouter = express.Router();

type JobStatus = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
interface Step { label: string; command: string; args: string[]; }
interface JobDefinition { id: string; name: string; description: string; steps: Step[]; marker?: string; }
interface JobState {
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  exitCode: number | null;
  output: string;
  result: unknown | null;
  error: string | null;
}

const MAX_OUTPUT_CHARS = 1_500_000;
const JOBS: JobDefinition[] = [
  {
    id: 'forward-risk-v8-transfer',
    name: 'Forward Risk V8 · confirmación en benchmarks holdout',
    description: 'Transfiere la señal congelada V5>=80 OR V7>=80 a seis benchmarks global-equity HOLDOUT que no generan la señal. No reajusta thresholds, no usa Gemini y no usa GitHub Actions.',
    marker: 'FORWARD_RISK_V8_BENCHMARK_TRANSFER_RESULT',
    steps: [
      { label: 'Guard transferencia V8', command: 'npx', args: ['tsx', 'tests/forwardRiskV8BenchmarkTransfer.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Transferencia V8 a benchmarks holdout', command: 'npx', args: ['tsx', 'scripts/forwardRiskV8BenchmarkTransferLive.ts'] }
    ]
  }
];

const states = new Map<string, JobState>();
function initialState(): JobState {
  return { status: 'IDLE', startedAt: null, finishedAt: null, currentStep: null, exitCode: null, output: '', result: null, error: null };
}
function stateFor(id: string): JobState {
  const current = states.get(id) ?? initialState();
  if (!states.has(id)) states.set(id, current);
  return current;
}
function appendOutput(state: JobState, text: string): void {
  state.output = `${state.output}${text}`.slice(-MAX_OUTPUT_CHARS);
}
function extractJsonAfterMarker(output: string, marker?: string): unknown | null {
  if (!marker) return null;
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const after = output.slice(markerIndex + marker.length);
  const start = after.indexOf('{');
  if (start < 0) return null;
  const text = after.slice(start);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(0, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function runStep(step: Step, state: JobState): Promise<number> {
  return new Promise(resolve => {
    state.currentStep = step.label;
    appendOutput(state, `\n\n=== ${step.label} ===\n`);
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', data => appendOutput(state, String(data)));
    child.stderr.on('data', data => appendOutput(state, String(data)));
    child.on('error', error => { appendOutput(state, `\nPROCESS_ERROR: ${error.message}\n`); resolve(1); });
    child.on('close', code => resolve(code ?? 1));
  });
}

async function runJob(job: JobDefinition): Promise<void> {
  const state = stateFor(job.id);
  state.status = 'RUNNING';
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.currentStep = null;
  state.exitCode = null;
  state.output = '';
  state.result = null;
  state.error = null;
  try {
    for (const step of job.steps) {
      const code = await runStep(step, state);
      if (code !== 0) {
        state.exitCode = code;
        state.status = 'FAILED';
        state.error = `Falló: ${step.label}`;
        return;
      }
    }
    state.exitCode = 0;
    state.result = extractJsonAfterMarker(state.output, job.marker);
    state.status = 'PASSED';
  } catch (error: any) {
    state.status = 'FAILED';
    state.exitCode = 1;
    state.error = error?.message || String(error);
  } finally {
    state.currentStep = null;
    state.finishedAt = new Date().toISOString();
  }
}

function publicJob(job: JobDefinition) {
  return { id: job.id, name: job.name, description: job.description, ...stateFor(job.id) };
}

researchValidationRouter.get('/jobs', (_req: Request, res: Response) => {
  res.json({ aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', jobs: JOBS.map(publicJob) });
});

researchValidationRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  res.json({ aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', job: publicJob(job) });
});

researchValidationRouter.post('/jobs/:id/run', (req: Request, res: Response) => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  const state = stateFor(job.id);
  if (state.status === 'RUNNING') { res.status(409).json({ error: 'VALIDATION_ALREADY_RUNNING', job: publicJob(job) }); return; }
  void runJob(job);
  res.status(202).json({ ok: true, aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', job: publicJob(job) });
});
