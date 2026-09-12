import express, { Request, Response } from 'express';
import { spawn } from 'node:child_process';
import { loadDurableResearchValidationEvidence } from './researchValidationEvidenceStore';

export const researchValidationRecoveryRouter = express.Router();

type RecoveryStatus = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';

const JOB_ID = 'phase4-reentry-cash-custody-v1';
const RECOVERY_SCRIPT = 'scripts/phase4ReentryCashCustodyV1RecoverLostEvidence.ts';
const MAX_OUTPUT_CHARS = 1_500_000;

interface RecoveryState {
  status: RecoveryStatus;
  startedAt: string | null;
  finishedAt: string | null;
  output: string;
  error: string | null;
}

const state: RecoveryState = {
  status: 'IDLE',
  startedAt: null,
  finishedAt: null,
  output: '',
  error: null
};

function appendOutput(text: string): void {
  state.output = `${state.output}${text}`.slice(-MAX_OUTPUT_CHARS);
}

async function durableEvidenceAvailable(): Promise<boolean> {
  try {
    return (await loadDurableResearchValidationEvidence(JOB_ID)) != null;
  } catch {
    return false;
  }
}

function runRecovery(): Promise<void> {
  return new Promise(resolve => {
    state.status = 'RUNNING';
    state.startedAt = new Date().toISOString();
    state.finishedAt = null;
    state.output = '';
    state.error = null;

    const child = spawn('npx', ['tsx', RECOVERY_SCRIPT], {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', chunk => appendOutput(String(chunk)));
    child.stderr.on('data', chunk => appendOutput(String(chunk)));
    child.on('error', error => {
      appendOutput(`\nPROCESS_ERROR:${error.message}\n`);
      state.status = 'FAILED';
      state.error = error.message;
      state.finishedAt = new Date().toISOString();
      resolve();
    });
    child.on('close', async code => {
      if (state.status === 'FAILED') { resolve(); return; }
      if ((code ?? 1) !== 0) {
        state.status = 'FAILED';
        state.error = `PHASE4_EVIDENCE_RECOVERY_FAILED:${code ?? 1}`;
      } else if (!(await durableEvidenceAvailable())) {
        state.status = 'FAILED';
        state.error = 'PHASE4_EVIDENCE_RECOVERY_DURABLE_WRITE_NOT_CONFIRMED';
      } else {
        state.status = 'PASSED';
      }
      state.finishedAt = new Date().toISOString();
      resolve();
    });
  });
}

researchValidationRecoveryRouter.get('/phase4-recovery', async (_req: Request, res: Response) => {
  const evidenceAvailable = await durableEvidenceAvailable();
  res.json({
    jobId: JOB_ID,
    evidenceAvailable,
    recoveryAllowed: !evidenceAvailable && state.status !== 'RUNNING' && Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
    tokenConfigured: Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
    ...state
  });
});

researchValidationRecoveryRouter.get('/phase4-recovery/result.json', async (_req: Request, res: Response) => {
  try {
    const evidence = await loadDurableResearchValidationEvidence(JOB_ID);
    if (!evidence) { res.status(404).json({ error: 'PHASE4_DURABLE_EVIDENCE_NOT_AVAILABLE' }); return; }
    res.setHeader('Content-Disposition', 'attachment; filename="phase4-reentry-cash-custody-v1-reconstructed-evidence.json"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(evidence);
  } catch (error: any) {
    res.status(503).json({ error: 'PHASE4_DURABLE_EVIDENCE_READ_FAILED', detail: error?.message || String(error) });
  }
});

researchValidationRecoveryRouter.post('/phase4-recovery/run', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'RESEARCH_VALIDATION_LOCAL_ONLY', execution: 'LOCAL_APP_BACKEND' });
    return;
  }
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) {
    res.status(412).json({ error: 'PHASE4_RECOVERY_DURABLE_GITHUB_TOKEN_REQUIRED' });
    return;
  }
  if (await durableEvidenceAvailable()) {
    res.status(409).json({ error: 'PHASE4_DURABLE_EVIDENCE_ALREADY_AVAILABLE' });
    return;
  }
  if (state.status === 'RUNNING') {
    res.status(409).json({ error: 'PHASE4_EVIDENCE_RECOVERY_ALREADY_RUNNING' });
    return;
  }
  void runRecovery();
  res.status(202).json({ ok: true, execution: 'LOCAL_APP_BACKEND', state });
});
