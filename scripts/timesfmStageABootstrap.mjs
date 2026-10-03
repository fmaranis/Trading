import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const VENV = path.resolve(ROOT, '.research-venv', 'timesfm3');
const REQUIREMENTS = path.resolve(ROOT, 'backend', 'requirements-timesfm.txt');
const RUNNER = path.resolve(ROOT, 'backend', 'scripts', 'timesfm_stage_a_smoke.py');
const EXPECTED_VERSION = '3.0.2';
const MARKER = 'TIMESFM_STAGE_A_SMOKE_RESULT';

function emitBlocked(error, detail = null) {
  console.log(MARKER);
  console.log(JSON.stringify({
    study: 'TIMESFM_STAGE_A_SMOKE_V1',
    status: 'BLOCKED_ENVIRONMENT',
    error,
    detail,
    protocol: {
      stage: 'A_SMOKE_TECHNICAL',
      dataProvenance: 'SYNTHETIC',
      marketPricesFetched: false,
      marketOutcomesOpened: false,
      economicPolicyOpened: false,
      productionAuthority: false,
      productionDefault: 'LEGACY'
    }
  }, null, 2));
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    ...options
  });
}

function pythonCandidates() {
  if (process.env.TIMESFM_PYTHON?.trim()) return [[process.env.TIMESFM_PYTHON.trim(), []]];
  return process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];
}

function findPython() {
  for (const [command, prefix] of pythonCandidates()) {
    const probe = run(command, [...prefix, '-c', 'import sys; print(sys.executable); print(sys.version_info[:2])']);
    if (probe.status !== 0) continue;
    const versionProbe = run(command, [...prefix, '-c', 'import sys; raise SystemExit(0 if (3,11) <= sys.version_info[:2] < (3,15) else 2)']);
    if (versionProbe.status === 0) return { command, prefix };
  }
  return null;
}

const systemPython = findPython();
if (!systemPython) {
  emitBlocked('TIMESFM_PYTHON_3_11_TO_3_14_REQUIRED');
  process.exit(1);
}

const venvPython = process.platform === 'win32'
  ? path.join(VENV, 'Scripts', 'python.exe')
  : path.join(VENV, 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  fs.mkdirSync(path.dirname(VENV), { recursive: true });
  const created = run(systemPython.command, [...systemPython.prefix, '-m', 'venv', VENV], { stdio: 'inherit' });
  if (created.status !== 0 || !fs.existsSync(venvPython)) {
    emitBlocked('TIMESFM_VENV_CREATE_FAILED', `exit=${created.status}`);
    process.exit(1);
  }
}

const versionCheck = run(venvPython, ['-c', "import importlib.metadata; print(importlib.metadata.version('timesfm'))"]);
const installedVersion = versionCheck.status === 0 ? String(versionCheck.stdout).trim() : null;

if (installedVersion !== EXPECTED_VERSION) {
  console.log(`[TimesFM] Installing isolated research environment from ${path.relative(ROOT, REQUIREMENTS)} ...`);
  const install = run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', REQUIREMENTS], { stdio: 'inherit' });
  if (install.status !== 0) {
    emitBlocked('TIMESFM_DEPENDENCY_INSTALL_FAILED', `exit=${install.status}`);
    process.exit(1);
  }
}

const finalVersion = run(venvPython, ['-c', "import importlib.metadata; print(importlib.metadata.version('timesfm'))"]);
if (finalVersion.status !== 0 || String(finalVersion.stdout).trim() !== EXPECTED_VERSION) {
  emitBlocked('TIMESFM_VERSION_NOT_PINNED_AFTER_INSTALL', String(finalVersion.stderr || finalVersion.stdout).slice(0, 1000));
  process.exit(1);
}

console.log('[TimesFM] Isolated environment ready. Loading the official 3.0 checkpoint; first run may download ~1.32 GB into the Hugging Face cache.');
const smoke = run(venvPython, [RUNNER], { stdio: 'inherit', env: { ...process.env, PYTHONUNBUFFERED: '1' } });
process.exit(smoke.status ?? 1);
