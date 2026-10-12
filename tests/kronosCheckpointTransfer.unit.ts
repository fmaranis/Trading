import assert from 'node:assert/strict';
import { parseKronosCheckpointDownload, parseKronosCheckpointStatusResponse } from '../src/components/kronosCheckpointTransfer';

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
const status = { available: true, completedAnchors: 1, partialAnchors: 1, completedPaths: 240,
  expectedMaximumPaths: 5580, progressPctOfMaximum: 4.3, savedAt: '2026-10-11T18:00:00.000Z' };
assert.deepEqual(parseKronosCheckpointStatusResponse(JSON.stringify(status), 'application/json', 200),status);
assert.deepEqual(parseKronosCheckpointStatusResponse('{"available":false}', 'application/json', 200),{available:false});
assert.throws(() => parseKronosCheckpointStatusResponse(
  '<!doctype html><html><title>Cookie check</title></html>', 'text/html', 200
), /autenticaci[oó]n/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  '<html>login</html>', 'application/json', 200
), /autenticaci[oó]n/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  '{"error":"RESEARCH_VALIDATION_LOCAL_ONLY"}', 'application/json', 403
), /HTTP 403/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  'not a json', 'text/plain', 200
), /JSON v[aá]lido/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  '{"status":"RUNNING"}', 'application/json', 200
), /estado del checkpoint/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  JSON.stringify({...status,completedPaths:-1}), 'application/json', 200
), /contadores/);
assert.throws(() => parseKronosCheckpointStatusResponse(
  JSON.stringify({...status,progressPctOfMaximum:101}), 'application/json', 200
), /progreso inv[aá]lidos/);
import fs from 'node:fs';
const ui=fs.readFileSync('src/components/ResearchValidationCenter.tsx','utf8');
assert.match(ui,/setCheckpointChecking\(true\)/);
assert.match(ui,/controller\.abort\(\), 12000/);
assert.match(ui,/parseKronosCheckpointStatusResponse\(raw,/);
assert.match(ui,/aria-live="polite"/);
assert.match(ui,/Consultando…/);
assert.match(ui,/No se pudo revisar el progreso/);
assert.match(ui,/no se sabe si el checkpoint sigue guardado/);
assert.doesNotMatch(ui,/Todavía no se ha detectado un checkpoint/);
console.log('kronosCheckpointTransfer.unit: PASS');
