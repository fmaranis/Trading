import assert from 'node:assert/strict';
import fs from 'node:fs';
const routes=fs.readFileSync('server/researchValidationRoutes.ts','utf8');
const ui=fs.readFileSync('src/components/ResearchValidationCenter.tsx','utf8');
const py=fs.readFileSync('backend/scripts/kronos_stage_b_diagnostic.py','utf8');
const live=fs.readFileSync('scripts/kronosStageBDiagnosticLive.mjs','utf8');
for (const endpoint of [
  "/kronos-stage-b/checkpoint/status",
  "/kronos-stage-b/checkpoint/download",
  "/kronos-stage-b/checkpoint/restore"
]) assert.ok(routes.includes(endpoint),`Missing ${endpoint}`);
assert.match(routes,/KRONOS_STAGE_B_EXISTING_CHECKPOINT_PROTECTED/);
assert.match(routes,/KRONOS_STAGE_B_RUNNING_RESTORE_FORBIDDEN/);
assert.match(routes,/validateKronosCheckpointData/);
assert.match(routes,/saveDurableJobState/);
assert.match(routes,/progressPctOfMaximum/);
assert.match(ui,/Revisar progreso/);
assert.match(ui,/Guardar copia JSON/);
assert.match(ui,/Restaurar copia JSON/);
assert.match(ui,/checkpointBusy/);
assert.match(py,/os\.fsync\(file\.fileno\(\)\)/);
assert.match(py,/KRONOS_STAGE_B_CHECKPOINT_CORRUPT_RESTORE_BACKUP/);
assert.match(py,/resuming saved RNG stream/);
assert.match(live,/inherit:true,timeout:0/);
assert.doesNotMatch(live,/timeout:7200000/);
const store=fs.readFileSync('scripts/kronosStageBDurableStore.mjs','utf8');
assert.match(routes,/requiresGithubReplayToken: true/);
assert.match(routes,/Preflight checkpoint remoto Kronos Stage B/);
assert.match(routes,/kronosStageBDurableStore\.unit\.mjs/);
assert.match(routes,/readRemoteKronosCheckpoint/);
assert.match(ui,/Respaldo GitHub replay-results/);
assert.match(py,/def sync_durable/);
assert.match(py,/sync_durable\(\)/);
assert.match(py,/completed and saved remotely/);
assert.match(live,/KRONOS_STAGE_B_DURABLE_CHECKPOINT_PREFLIGHT_FAILED/);
assert.match(store,/GITHUB_REPLAY_SYNC_TOKEN/);
assert.match(store,/GITHUB_REPLAY_SYNC_BRANCH/);
assert.match(store,/assertKronosMonotone/);
assert.match(store,/KRONOS_DURABLE_REMOTE_VERIFY_FAILED/);
assert.match(store,/KRONOS_DURABLE_UNSAFE_BRANCH/);
console.log('kronosStageBCheckpointSurface.unit: PASS');
