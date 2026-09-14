import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  PHASE5_CONFIRMATION_COHORTS,
  PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_CONFIRMATION_REPLAY_START_DATE,
  PHASE5_CONFIRMATION_SAMPLE,
  PHASE5_CONFIRMATION_SEAL_PATH,
  PHASE5_CONFIRMATION_SELECTION_RULE
} from '../scripts/phase5WinnerProtectionV2ConfirmationProtocol';

interface Seal {
  version: string;
  sampleState: string;
  methodologySourceHead: string;
  policy: string;
  productionDefault: string;
  window: { dataStartDate: string; replayStartDate: string; endDate: string };
  selectionRule: string;
  sample: string[][];
  expectedGitBlobSha: Record<string, string>;
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal = JSON.parse(readFileSync(PHASE5_CONFIRMATION_SEAL_PATH, 'utf8')) as Seal;
assert.equal(seal.version, 'PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_SEAL_V1');
assert.equal(seal.sampleState, 'SEALED_NOT_OPENED');
assert.equal(seal.policy, 'TREND_PROTECTION_V2_WINNER_ONLY');
assert.equal(seal.productionDefault, 'LEGACY');
assert.equal(seal.window.replayStartDate, PHASE5_CONFIRMATION_REPLAY_START_DATE);
assert.equal(seal.selectionRule, PHASE5_CONFIRMATION_SELECTION_RULE);
assert.match(seal.methodologySourceHead, /^[0-9a-f]{40}$/);
assert.ok(Object.keys(seal.expectedGitBlobSha).length >= 10);

for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
  const actual = gitBlobSha(readFileSync(path, 'utf8'));
  assert.equal(actual, expected, `Phase 5 confirmation seal mismatch: ${path}`);
}

const sampleIds = PHASE5_CONFIRMATION_SAMPLE.map(row => row.assetId);
assert.deepEqual(seal.sample.flat(), sampleIds);
assert.equal(sampleIds.length, 18);
assert.equal(new Set(sampleIds).size, 18);
assert.equal(PHASE5_CONFIRMATION_COHORTS.length, 6);
assert.ok(PHASE5_CONFIRMATION_COHORTS.every(cohort => cohort.length === 3));
assert.equal(PHASE5_CONFIRMATION_CURRENT_DISCOVERY_HISTORICAL, false);

const runner = readFileSync('scripts/phase5WinnerProtectionV2ConfirmationLive.ts', 'utf8');
const verifyIndex = runner.indexOf('const seal = verifyPreOpenSeal();');
const scannerIndex = runner.indexOf('AssetUniverseScanner.scan(');
assert.ok(verifyIndex >= 0 && scannerIndex > verifyIndex, 'confirmation seal must be verified before first sealed sample request');
assert.match(runner, /ECONOMIC OPENING BOUNDARY/);
assert.match(runner, /currentOpenDiscovery: false/);
assert.match(runner, /sampleState: 'PHASE5_CONFIRMATION_OPENED_CONSUMED'/);
assert.match(runner, /winnerProtectionPolicy: PHASE5_WINNER_PROTECTION_V2/);
assert.match(runner, /execution: 'NEXT_OPEN'/);
assert.match(runner, /CONFIRMATION_PASS/);
assert.match(runner, /CONFIRMATION_FAIL_NO_PROMOTION/);
assert.match(runner, /CONFIRMATION_INCONCLUSIVE_INSUFFICIENT_REACH/);
assert.match(runner, /noRetuningFromThisOutcome: true/);
assert.match(runner, /promotionAutomatic: false/);

console.log('PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_SEAL_PASS', JSON.stringify({
  version: seal.version,
  sealedFiles: Object.keys(seal.expectedGitBlobSha).length,
  sealedAssets: sampleIds.length,
  cohorts: PHASE5_CONFIRMATION_COHORTS.length,
  methodologySourceHead: seal.methodologySourceHead
}));
