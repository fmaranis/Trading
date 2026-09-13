import express, { Request, Response } from 'express';
import { spawn } from 'node:child_process';
import { loadDurableResearchValidationEvidence } from './researchValidationEvidenceStore';

export const researchValidationRecoveryRouter = express.Router();

type RecoveryStatus = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
interface Step { label: string; command: string; args: string[]; }

const JOB_ID = 'phase4-reentry-cash-custody-v1';
const R3_JOB_ID = 'phase4-reentry-cash-custody-v1-r3';
const RECOVERY_SCRIPT = 'scripts/phase4ReentryCashCustodyV1RecoverLostEvidence.ts';
const MAX_OUTPUT_CHARS = 1_500_000;

const R3_STEPS: Step[] = [
  { label: 'Guard R3 preregistro y muestra', command: 'npx', args: ['tsx', 'tests/phase4R3Readiness.unit.ts'] },
  { label: 'Guard R3 seal pre-open', command: 'npx', args: ['tsx', 'tests/phase4R3Seal.unit.ts'] },
  { label: 'Guard política de custodia', command: 'npx', args: ['tsx', 'tests/reentryCashCustodyPolicy.unit.ts'] },
  { label: 'Guard integración Fase 4', command: 'npx', args: ['tsx', 'tests/phase4ReentryCustodyIntegration.unit.ts'] },
  { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
  { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
  { label: 'Guard paridad replay/producto', command: 'npx', args: ['tsx', 'tests/decisionArchitectureParity.unit.ts'] },
  { label: 'Guard superficie productiva', command: 'npx', args: ['tsx', 'tests/productSurfaceClosureV1.unit.ts'] },
  { label: 'Guard cash histórico BCE', command: 'npx', args: ['tsx', 'tests/cashRemuneration.unit.ts'] },
  { label: 'Guard future-forward congelado', command: 'npx', args: ['tsx', 'tests/qualityAllocationDynamicFutureForwardV1.unit.ts'] },
  { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
  { label: 'Preflight REAL sólo del core R3', command: 'npx', args: ['tsx', 'scripts/phase4ReentryCashCustodyV1R3CorePreflight.ts'] },
  { label: 'Blind R3 REAL one-shot', command: 'npx', args: ['tsx', 'scripts/phase4ReentryCashCustodyV1R3OpenAndRun.ts'] }
];

interface RecoveryState {
  status: RecoveryStatus;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  output: string;
  error: string | null;
}

function emptyState(): RecoveryState {
  return { status: 'IDLE', startedAt: null, finishedAt: null, currentStep: null, output: '', error: null };
}

const state = emptyState();
const r3State = emptyState();

function appendOutput(target: RecoveryState, text: string): void {
  target.output = `${target.output}${text}`.slice(-MAX_OUTPUT_CHARS);
}

async function durableEvidence(jobId: string) {
  try { return await loadDurableResearchValidationEvidence(jobId); }
  catch { return null; }
}

async function durableEvidenceAvailable(jobId: string): Promise<boolean> {
  return (await durableEvidence(jobId)) != null;
}

function runCommand(step: Step, target: RecoveryState): Promise<number> {
  return new Promise(resolve => {
    target.currentStep = step.label;
    appendOutput(target, `\n\n=== ${step.label} ===\n`);
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', chunk => appendOutput(target, String(chunk)));
    child.stderr.on('data', chunk => appendOutput(target, String(chunk)));
    child.on('error', error => {
      appendOutput(target, `\nPROCESS_ERROR:${error.message}\n`);
      resolve(1);
    });
    child.on('close', code => resolve(code ?? 1));
  });
}

function runRecovery(): Promise<void> {
  return new Promise(resolve => {
    Object.assign(state, emptyState(), { status: 'RUNNING', startedAt: new Date().toISOString() });
    const child = spawn('npx', ['tsx', RECOVERY_SCRIPT], {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', chunk => appendOutput(state, String(chunk)));
    child.stderr.on('data', chunk => appendOutput(state, String(chunk)));
    child.on('error', error => {
      appendOutput(state, `\nPROCESS_ERROR:${error.message}\n`);
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
      } else if (!(await durableEvidenceAvailable(JOB_ID))) {
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

async function runR3(): Promise<void> {
  Object.assign(r3State, emptyState(), { status: 'RUNNING', startedAt: new Date().toISOString() });
  try {
    for (const step of R3_STEPS) {
      const code = await runCommand(step, r3State);
      if (code !== 0) {
        r3State.status = 'FAILED';
        r3State.error = `Falló: ${step.label}`;
        return;
      }
    }
    const evidence = await durableEvidence(R3_JOB_ID);
    if (!evidence || evidence.evidenceKind !== 'ORIGINAL_VALIDATION') {
      r3State.status = 'FAILED';
      r3State.error = 'PHASE4_R3_FINAL_DURABLE_EVIDENCE_NOT_CONFIRMED';
      return;
    }
    r3State.status = 'PASSED';
  } catch (error: any) {
    r3State.status = 'FAILED';
    r3State.error = error?.message || String(error);
  } finally {
    r3State.currentStep = null;
    r3State.finishedAt = new Date().toISOString();
  }
}

researchValidationRecoveryRouter.get('/phase4-recovery', async (_req: Request, res: Response) => {
  const evidenceAvailable = await durableEvidenceAvailable(JOB_ID);
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
    const evidence = await durableEvidence(JOB_ID);
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
  if (await durableEvidenceAvailable(JOB_ID)) {
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

researchValidationRecoveryRouter.get('/phase4-r3', async (_req: Request, res: Response) => {
  const r2Evidence = await durableEvidence(JOB_ID);
  const r3Evidence = await durableEvidence(R3_JOB_ID);
  const reproductionVerdict = (r2Evidence?.result as any)?.reproductionVerdict ?? null;
  const r3IsFinal = r3Evidence?.evidenceKind === 'ORIGINAL_VALIDATION';
  const r3OpeningLocked = r3Evidence?.evidenceKind === 'OPENING_LOCK';
  const r3Verdict = r3IsFinal ? (r3Evidence?.result as any)?.verdict ?? null : null;
  const tokenConfigured = Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim());
  res.json({
    jobId: R3_JOB_ID,
    r2EvidenceAvailable: Boolean(r2Evidence),
    r2ReproductionVerdict: reproductionVerdict,
    evidenceAvailable: r3IsFinal,
    evidenceKind: r3Evidence?.evidenceKind ?? null,
    openingLocked: r3OpeningLocked,
    verdict: r3Verdict,
    readyToRun: Boolean(r2Evidence) && reproductionVerdict === 'INCONCLUSIVE_INVALID_DATA' && !r3Evidence && r3State.status !== 'RUNNING' && tokenConfigured,
    tokenConfigured,
    ...r3State
  });
});

researchValidationRecoveryRouter.get('/phase4-r3/result.json', async (_req: Request, res: Response) => {
  try {
    const evidence = await durableEvidence(R3_JOB_ID);
    if (!evidence || evidence.evidenceKind !== 'ORIGINAL_VALIDATION') {
      res.status(404).json({ error: 'PHASE4_R3_FINAL_DURABLE_EVIDENCE_NOT_AVAILABLE', evidenceKind: evidence?.evidenceKind ?? null });
      return;
    }
    res.setHeader('Content-Disposition', 'attachment; filename="phase4-reentry-cash-custody-v1-r3-evidence.json"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(evidence);
  } catch (error: any) {
    res.status(503).json({ error: 'PHASE4_R3_DURABLE_EVIDENCE_READ_FAILED', detail: error?.message || String(error) });
  }
});

researchValidationRecoveryRouter.post('/phase4-r3/run', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'RESEARCH_VALIDATION_LOCAL_ONLY', execution: 'LOCAL_APP_BACKEND' });
    return;
  }
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) {
    res.status(412).json({ error: 'PHASE4_R3_DURABLE_GITHUB_TOKEN_REQUIRED' });
    return;
  }
  const r2Evidence = await durableEvidence(JOB_ID);
  const reproductionVerdict = (r2Evidence?.result as any)?.reproductionVerdict ?? null;
  if (!r2Evidence || reproductionVerdict !== 'INCONCLUSIVE_INVALID_DATA') {
    res.status(412).json({ error: 'PHASE4_R3_REQUIRES_DURABLE_R2_INCONCLUSIVE_EVIDENCE' });
    return;
  }
  const existingR3 = await durableEvidence(R3_JOB_ID);
  if (existingR3) {
    res.status(409).json({
      error: existingR3.evidenceKind === 'OPENING_LOCK'
        ? 'PHASE4_R3_OPENING_LOCK_PRESENT_SAMPLE_CONSUMED'
        : 'PHASE4_R3_DURABLE_EVIDENCE_ALREADY_AVAILABLE',
      evidenceKind: existingR3.evidenceKind
    });
    return;
  }
  if (r3State.status === 'RUNNING') {
    res.status(409).json({ error: 'PHASE4_R3_ALREADY_RUNNING' });
    return;
  }
  void runR3();
  res.status(202).json({ ok: true, execution: 'LOCAL_APP_BACKEND', state: r3State });
});
