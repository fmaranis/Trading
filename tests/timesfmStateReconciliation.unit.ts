import assert from 'node:assert/strict';
import { reconcileTimesFmState } from '../server/timesfmRemoteRunner';

const make = (status: 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED', patch: Record<string, unknown> = {}) => ({
  jobId: 'timesfm-stage-a-smoke-v1',
  status,
  startedAt: status === 'IDLE' ? null : '2026-10-05T08:00:00.000Z',
  finishedAt: status === 'PASSED' || status === 'FAILED' ? '2026-10-05T08:01:00.000Z' : null,
  currentStep: status === 'RUNNING' ? 'Guard contrato TimesFM Stage A' : null,
  exitCode: status === 'PASSED' ? 0 : status === 'FAILED' ? 1 : null,
  output: status === 'FAILED' ? 'REAL_LOCAL_ERROR' : '',
  result: null,
  error: status === 'FAILED' ? 'Falló: Guard contrato TimesFM Stage A' : null,
  ...patch
});

assert.equal(reconcileTimesFmState(make('RUNNING'), make('IDLE')).status, 'RUNNING');
assert.equal(reconcileTimesFmState(make('FAILED'), make('IDLE')).status, 'FAILED');
assert.equal(reconcileTimesFmState(make('FAILED'), make('IDLE')).error, 'Falló: Guard contrato TimesFM Stage A');
assert.equal(reconcileTimesFmState(make('PASSED'), make('IDLE')).status, 'PASSED');
assert.equal(reconcileTimesFmState(make('IDLE'), make('RUNNING')).status, 'RUNNING');
assert.equal(reconcileTimesFmState(make('IDLE'), make('FAILED')).status, 'FAILED');
assert.equal(reconcileTimesFmState(make('RUNNING'), make('FAILED')).status, 'FAILED');

console.log('timesfmStateReconciliation.unit: PASS');
