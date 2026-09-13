import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SEAL_PATH = 'docs/phase4_reentry_cash_custody_v1_r3_seal.json';

interface Seal {
  version: string;
  sampleState: string;
  expectedGitBlobSha: Record<string, string>;
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal = JSON.parse(readFileSync(SEAL_PATH, 'utf8')) as Seal;
if (seal.version !== 'PHASE4_REENTRY_CASH_CUSTODY_V1_R3_SEAL') throw new Error('PHASE4_R3_SEAL_VERSION_INVALID');
if (seal.sampleState !== 'R3_SEALED_NOT_OPENED') throw new Error('PHASE4_R3_SEAL_SAMPLE_STATE_INVALID');
if (Object.keys(seal.expectedGitBlobSha).length < 10) throw new Error('PHASE4_R3_SEAL_INCOMPLETE');

for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
  const actual = gitBlobSha(readFileSync(path, 'utf8'));
  if (actual !== expected) throw new Error(`PHASE4_R3_SEAL_MISMATCH:${path}:${expected}:${actual}`);
}

console.log(`phase4R3Seal.unit: PASS · ${Object.keys(seal.expectedGitBlobSha).length} blobs frozen`);
