import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  PHASE5_SEALED_COHORTS,
  PHASE5_SEALED_SAMPLE,
  PHASE5_SEALED_SAMPLE_STATE
} from '../scripts/phase5WinnerProtectionV2SealedSample';
import { PHASE5_SEAL_PATH } from '../scripts/phase5WinnerProtectionV2SampleProtocol';

interface Seal {
  version: string;
  sampleState: string;
  methodologySourceHead: string;
  policy: string;
  productionDefault: string;
  sample: string[][];
  expectedGitBlobSha: Record<string, string>;
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal = JSON.parse(readFileSync(PHASE5_SEAL_PATH, 'utf8')) as Seal;
assert.equal(seal.version, 'PHASE5_WINNER_PROTECTION_V2_SEAL_V1');
assert.equal(seal.sampleState, 'SEALED_NOT_OPENED');
assert.equal(PHASE5_SEALED_SAMPLE_STATE, 'SEALED_NOT_OPENED');
assert.equal(seal.policy, 'TREND_PROTECTION_V2_WINNER_ONLY');
assert.equal(seal.productionDefault, 'LEGACY');
assert.match(seal.methodologySourceHead, /^[0-9a-f]{40}$/);
assert.ok(Object.keys(seal.expectedGitBlobSha).length >= 10);

for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
  const actual = gitBlobSha(readFileSync(path, 'utf8'));
  assert.equal(actual, expected, `Phase 5 seal mismatch: ${path}`);
}

const sealedIds = PHASE5_SEALED_SAMPLE.map(row => row.assetId);
const sealIds = seal.sample.flat();
assert.deepEqual(sealIds, sealedIds);
assert.equal(sealedIds.length, 18);
assert.equal(new Set(sealedIds).size, 18);
assert.equal(PHASE5_SEALED_COHORTS.length, 6);
assert.ok(PHASE5_SEALED_COHORTS.every(cohort => cohort.length === 3));

const runner = readFileSync('scripts/phase5WinnerProtectionV2BlindLive.ts', 'utf8');
const verifyIndex = runner.indexOf('const seal = verifyPreOpenSeal();');
const scannerIndex = runner.indexOf('AssetUniverseScanner.scan(');
assert.ok(verifyIndex >= 0 && scannerIndex > verifyIndex, 'seal must be verified before first sealed sample request');
assert.match(runner, /PHASE5_CURRENT_DISCOVERY_HISTORICAL !== false/);
assert.match(runner, /currentOpenDiscovery: false/);
assert.match(runner, /sampleState: 'PHASE5_OPENED_CONSUMED'/);
assert.match(runner, /ECONOMIC OPENING BOUNDARY/);
assert.match(runner, /winnerProtectionPolicy: PHASE5_WINNER_PROTECTION_V2/);
assert.match(runner, /execution: 'NEXT_OPEN'/);
assert.match(runner, /noRetuningFromThisOutcome: true/);

console.log('PHASE5_WINNER_PROTECTION_V2_SEAL_PASS', JSON.stringify({
  version: seal.version,
  sealedFiles: Object.keys(seal.expectedGitBlobSha).length,
  sealedAssets: sealedIds.length,
  cohorts: PHASE5_SEALED_COHORTS.length,
  methodologySourceHead: seal.methodologySourceHead
}));
