import { spawnSync } from 'node:child_process';
import { loadDurableResearchValidationEvidence, saveDurableResearchValidationEvidence } from '../server/researchValidationEvidenceStore';
import { PHASE4_R3_DURABLE_JOB_ID, PHASE4_R3_SEAL_PATH } from './phase4ReentryCashCustodyV1R3Protocol';
import { readFileSync } from 'node:fs';

const JOB_NAME = 'Fase 4 · reentrada · custodia de proceeds · R3';

async function main() {
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) throw new Error('PHASE4_R3_DURABLE_GITHUB_TOKEN_REQUIRED');

  const sealGuard = spawnSync('npx', ['tsx', 'tests/phase4R3Seal.unit.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DISABLE_HMR: 'true' },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  if ((sealGuard.status ?? 1) !== 0) throw new Error('PHASE4_R3_OPEN_BLOCKED_BY_SEAL');

  const existing = await loadDurableResearchValidationEvidence(PHASE4_R3_DURABLE_JOB_ID);
  if (existing) throw new Error(`PHASE4_R3_ALREADY_CONSUMED_OR_RECORDED:${existing.evidenceKind}`);

  const seal = JSON.parse(readFileSync(PHASE4_R3_SEAL_PATH, 'utf8')) as { version: string; sampleState: string };
  const lockedAt = new Date().toISOString();
  await saveDurableResearchValidationEvidence({
    schemaVersion: 1,
    jobId: PHASE4_R3_DURABLE_JOB_ID,
    jobName: JOB_NAME,
    evidenceKind: 'OPENING_LOCK',
    recordedAt: lockedAt,
    status: 'PASSED',
    startedAt: lockedAt,
    finishedAt: null,
    result: {
      sampleState: 'R3_OPENING_LOCKED_CONSUMED',
      sealVersion: seal.version,
      lockedAt,
      note: 'Conservative durable lock written immediately before the first EQ_PH4_R3 fresh-market-data request. If execution is interrupted after this point, R3 remains consumed and must not be rerun as fresh.'
    },
    note: 'R3 opening lock. This is not an economic result; it prevents accidental rerun after the fresh sample boundary.'
  });

  const runner = spawnSync('npx', ['tsx', 'scripts/phase4ReentryCashCustodyV1R3BlindLive.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DISABLE_HMR: 'true' },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  if ((runner.status ?? 1) !== 0) throw new Error(`PHASE4_R3_RUNNER_FAILED_AFTER_OPEN:${runner.status ?? 1}`);

  const finalEvidence = await loadDurableResearchValidationEvidence(PHASE4_R3_DURABLE_JOB_ID);
  if (!finalEvidence || finalEvidence.evidenceKind !== 'ORIGINAL_VALIDATION') {
    throw new Error('PHASE4_R3_FINAL_DURABLE_EVIDENCE_NOT_CONFIRMED');
  }
}

main().catch(error => {
  console.error('PHASE4_R3_OPEN_AND_RUN_ERROR', error?.stack || error);
  process.exitCode = 1;
});
