import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { saveDurableResearchValidationEvidence } from '../server/researchValidationEvidenceStore';

const SEAL_PATH = 'docs/phase4_reentry_cash_custody_v1_seal.json';
const SERVER_ROUTE_PATH = 'server/researchValidationRoutes.ts';
const ORIGINAL_RUNNER = 'scripts/phase4ReentryCashCustodyV1BlindLive.ts';
const ORIGINAL_MARKER = 'PHASE4_REENTRY_CASH_CUSTODY_V1_RESULT';
const RECOVERY_MARKER = 'PHASE4_REENTRY_CASH_CUSTODY_V1_RECOVERY_RESULT';
const REPOSITORY = 'fmaranis/Trading';
const JOB_ID = 'phase4-reentry-cash-custody-v1';
const JOB_NAME = 'Fase 4 · reentrada · custodia de proceeds';

interface Phase4Seal {
  version: string;
  expectedGitBlobSha: Record<string, string>;
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'User-Agent': 'fmaranis-trading-phase4-evidence-recovery',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function fetchBlobText(blobSha: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/blobs/${blobSha}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PHASE4_RECOVERY_SEALED_BLOB_FETCH_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }
  const body = await response.json() as any;
  if (typeof body?.content !== 'string' || body?.encoding !== 'base64') {
    throw new Error('PHASE4_RECOVERY_SEALED_BLOB_INVALID');
  }
  const text = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
  if (gitBlobSha(text) !== blobSha) throw new Error('PHASE4_RECOVERY_SEALED_BLOB_HASH_MISMATCH');
  return text;
}

function extractJsonAfterMarker(output: string, marker: string): unknown {
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error(`PHASE4_RECOVERY_MARKER_NOT_FOUND:${marker}`);
  const after = output.slice(markerIndex + marker.length);
  const start = after.indexOf('{');
  if (start < 0) throw new Error('PHASE4_RECOVERY_JSON_START_NOT_FOUND');
  const text = after.slice(start);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
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
      if (depth === 0) return JSON.parse(text.slice(0, index + 1));
    }
  }
  throw new Error('PHASE4_RECOVERY_JSON_INCOMPLETE');
}

function runSealedRunner(): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    let output = '';
    const child = spawn('npx', ['tsx', ORIGINAL_RUNNER], {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', chunk => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', chunk => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });
    child.on('error', error => {
      output += `\nPROCESS_ERROR:${error.message}\n`;
      resolve({ code: 1, output });
    });
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) throw new Error('PHASE4_RECOVERY_DURABLE_GITHUB_TOKEN_REQUIRED');

  const seal = JSON.parse(readFileSync(SEAL_PATH, 'utf8')) as Phase4Seal;
  if (seal.version !== 'PHASE4_REENTRY_CASH_CUSTODY_V1_R2_SEAL') throw new Error('PHASE4_RECOVERY_SEAL_VERSION_INVALID');
  const expectedServerBlob = seal.expectedGitBlobSha[SERVER_ROUTE_PATH];
  if (!expectedServerBlob) throw new Error('PHASE4_RECOVERY_SEALED_SERVER_ROUTE_MISSING');

  const currentServerRoute = readFileSync(SERVER_ROUTE_PATH, 'utf8');
  const currentServerBlob = gitBlobSha(currentServerRoute);
  const sealedServerRoute = currentServerBlob === expectedServerBlob
    ? currentServerRoute
    : await fetchBlobText(expectedServerBlob);

  // The original blind runner verifies the pre-open seal, which included the
  // then-current ResearchValidationCenter route. That route later changed only
  // to archive UI jobs. For reconstruction we temporarily materialize the exact
  // sealed route bytes so the original runner itself remains untouched.
  writeFileSync(SERVER_ROUTE_PATH, sealedServerRoute, 'utf8');
  if (gitBlobSha(readFileSync(SERVER_ROUTE_PATH, 'utf8')) !== expectedServerBlob) {
    writeFileSync(SERVER_ROUTE_PATH, currentServerRoute, 'utf8');
    throw new Error('PHASE4_RECOVERY_TEMPORARY_SEALED_ROUTE_FAILED');
  }

  let execution: { code: number; output: string };
  try {
    execution = await runSealedRunner();
  } finally {
    writeFileSync(SERVER_ROUTE_PATH, currentServerRoute, 'utf8');
    const restored = gitBlobSha(readFileSync(SERVER_ROUTE_PATH, 'utf8'));
    if (restored !== currentServerBlob) throw new Error('PHASE4_RECOVERY_SERVER_ROUTE_RESTORE_FAILED');
  }

  if (execution.code !== 0) throw new Error(`PHASE4_RECOVERY_SEALED_RUNNER_FAILED:${execution.code}`);
  const replayResult = extractJsonAfterMarker(execution.output, ORIGINAL_MARKER) as any;
  const reconstructedAt = new Date().toISOString();

  const recovery = {
    version: 'PHASE4_REENTRY_CASH_CUSTODY_V1_AUDIT_RECONSTRUCTION_V1',
    evidenceKind: 'AUDIT_RECONSTRUCTION_AFTER_ORIGINAL_RESULT_LOSS',
    reconstructedAt,
    originalExecution: {
      sampleState: 'R2_OPENED_CONSUMED',
      technicalStatusObservedBeforeBackendReset: 'PASSED',
      originalVerdictDurablyRecovered: false
    },
    methodologicalUse: 'DIAGNOSTIC_ONLY_NOT_FRESH_NOT_PROMOTION_EVIDENCE',
    reconstructionMethod: 'RERUN_EXACT_SEALED_PHASE4_RUNNER_WITH_SEALED_SERVER_ROUTE_BYTES_TEMPORARILY_MATERIALIZED',
    sealVersion: seal.version,
    sealedServerRouteBlob: expectedServerBlob,
    currentServerRouteBlobBeforeReconstruction: currentServerBlob,
    reproductionVerdict: replayResult?.verdict ?? null,
    reproductionResult: replayResult
  };

  const durable = await saveDurableResearchValidationEvidence({
    schemaVersion: 1,
    jobId: JOB_ID,
    jobName: JOB_NAME,
    evidenceKind: 'AUDIT_RECONSTRUCTION',
    recordedAt: reconstructedAt,
    status: 'PASSED',
    startedAt: null,
    finishedAt: reconstructedAt,
    result: recovery,
    note: 'Reconstruction diagnostic of a blind R2 execution whose in-memory JSON was lost after backend restart. It is not fresh/OOS evidence and cannot promote production.'
  });

  console.log(RECOVERY_MARKER, JSON.stringify({ ...recovery, durable }));
}

main().catch(error => {
  console.error('PHASE4_REENTRY_CASH_CUSTODY_V1_RECOVERY_ERROR', error?.stack || error);
  process.exitCode = 1;
});
