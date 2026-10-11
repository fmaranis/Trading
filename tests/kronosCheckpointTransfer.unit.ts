import assert from 'node:assert/strict';
import { parseKronosCheckpointDownload } from '../src/components/kronosCheckpointTransfer';

const checkpoint = {
  version: 'KRONOS_STAGE_B_DIAGNOSTIC_V1',
  completed: { '2018Q1': [] },
  partial: { '2018Q2': { forecasts: {} } }
};
const valid = parseKronosCheckpointDownload(JSON.stringify(checkpoint), 'application/json');
assert.deepEqual(JSON.parse(valid), checkpoint);
assert.match(valid, /KRONOS_STAGE_B_DIAGNOSTIC_V1/);
assert.throws(
  () => parseKronosCheckpointDownload('<!doctype html><title>Cookie check</title>', 'text/html'),
  /autenticaci[oó]n/
);
assert.throws(
  () => parseKronosCheckpointDownload('<html>Cookie check</html>', 'application/json'),
  /autenticaci[oó]n/
);
assert.throws(
  () => parseKronosCheckpointDownload('invalid-json', 'application/json'),
  /JSON v[aá]lido/
);
assert.throws(
  () => parseKronosCheckpointDownload(JSON.stringify({ status: 'RUNNING' }), 'application/json'),
  /no es un checkpoint/
);
assert.throws(
  () => parseKronosCheckpointDownload(JSON.stringify({ ...checkpoint, version: 'SOMETHING_ELSE' }), 'application/json'),
  /no es un checkpoint/
);
console.log('kronosCheckpointTransfer.unit: PASS');
