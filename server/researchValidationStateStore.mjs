import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DIR = path.resolve(process.cwd(), '.runtime', 'research-validation-state');

function safeId(value) {
  return String(value).replace(/[^0-9A-Za-z._-]/g, '_').slice(0, 180) || 'job';
}

function statePath(jobId, runtimeDir = DEFAULT_DIR) {
  return path.join(runtimeDir, `${safeId(jobId)}.json`);
}

export function saveDurableJobState(jobId, state, runtimeDir = DEFAULT_DIR) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const target = statePath(jobId, runtimeDir);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
  return target;
}

export function loadDurableJobState(jobId, runtimeDir = DEFAULT_DIR) {
  const target = statePath(jobId, runtimeDir);
  if (!fs.existsSync(target)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function reconcileLoadedJobState(state, now = () => new Date().toISOString(), processAlive = isProcessAlive) {
  if (!state || state.status !== 'RUNNING') return { state, changed: false };
  if (processAlive(state.processId)) return { state, changed: false };

  return {
    changed: true,
    state: {
      ...state,
      status: 'FAILED',
      finishedAt: state.finishedAt ?? now(),
      currentStep: null,
      processId: null,
      exitCode: state.exitCode ?? 1,
      error: 'VALIDATION_INTERRUPTED_BACKEND_RESTART_OR_PARENT_LOSS'
    }
  };
}
