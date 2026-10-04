import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadDurableJobState,
  reconcileLoadedJobState,
  saveDurableJobState
} from '../server/researchValidationStateStore.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-validation-state-'));
const id = 'timesfm-stage-a-smoke-v1';
const base = {
  status: 'RUNNING',
  startedAt: '2026-10-04T12:00:00.000Z',
  finishedAt: null,
  currentStep: 'TimesFM 3.0 · bootstrap aislado + smoke',
  processId: process.pid,
  exitCode: null,
  output: 'downloading',
  result: null,
  error: null
};

saveDurableJobState(id, base, dir);
assert.deepEqual(loadDurableJobState(id, dir), base);

const live = reconcileLoadedJobState(base, () => 'NEVER', pid => pid === process.pid);
assert.equal(live.changed, false);
assert.equal(live.state.status, 'RUNNING');

const stale = reconcileLoadedJobState(
  { ...base, processId: 999999999 },
  () => '2026-10-04T12:05:00.000Z',
  () => false
);
assert.equal(stale.changed, true);
assert.equal(stale.state.status, 'FAILED');
assert.equal(stale.state.finishedAt, '2026-10-04T12:05:00.000Z');
assert.equal(stale.state.processId, null);
assert.equal(stale.state.exitCode, 1);
assert.equal(stale.state.error, 'VALIDATION_INTERRUPTED_BACKEND_RESTART_OR_PARENT_LOSS');

const passed = reconcileLoadedJobState({ ...base, status: 'PASSED', processId: null });
assert.equal(passed.changed, false);
assert.equal(passed.state.status, 'PASSED');

fs.rmSync(dir, { recursive: true, force: true });
console.log('researchValidationStatePersistence.unit: PASS');
