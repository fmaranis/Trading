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

function isSupportedPythonVersion(major, minor) {
  return major === 3 && minor >= 10;
}

function pythonCandidates() {
  if (process.env.TIMESFM_PYTHON?.trim()) return [[process.env.TIMESFM_PYTHON.trim(), []]];

  // TimesFM 3.0.2 declares Python >=3.10. Prefer 3.12 (Google's recommended
  // baseline), then other known compatible CPython 3.x runtimes before falling
  // back to the host's generic python/python3 launcher.
  const preferred = ['3.12', '3.11', '3.10', '3.13', '3.14'];
  return process.platform === 'win32'
    ? [
        ...preferred.map(version => ['py', [`-${version}`]]),
        ['py', ['-3']],
        ['python', []],
        ['python3', []]
      ]
    : [
        ...preferred.map(version => [`python${version}`, []]),
        ['python3', []],
        ['python', []]
      ];
}

function probePython(command, prefix = []) {
  const code = [
    'import json, sys',
    'print(json.dumps({',
    '  "executable": sys.executable,',
    '  "major": sys.version_info[0],',
    '  "minor": sys.version_info[1],',
    '  "version": sys.version.split()[0]',
    '}))'
  ].join('\\n');
  const probe = run(command, [...prefix, '-c', code]);
  const stdout = String(probe.stdout || '').trim();
  let info = null;
  if (probe.status === 0 && stdout) {
    try {
      info = JSON.parse(stdout.split(/\\r?\\n/).at(-1));
    } catch {
      info = null;
    }
  }
  const supported = Boolean(info && isSupportedPythonVersion(info.major, info.minor));
  return {
    status: probe.status,
    errorCode: probe.error?.code ?? null,
    stderr: String(probe.stderr || '').trim().slice(0, 500) || null,
    executable: info?.executable ?? null,
    version: info?.version ?? null,
    supported
  };
}

function findPython() {
  const attempts = [];
  for (const [command, prefix] of pythonCandidates()) {
    const probe = probePython(command, prefix);
    attempts.push({
      command: [command, ...prefix].join(' '),
      status: probe.status,
      errorCode: probe.errorCode,
      executable: probe.executable,
      version: probe.version,
      supported: probe.supported
    });
    if (probe.supported) {
      return {
        python: { command, prefix, executable: probe.executable, version: probe.version },
        attempts
      };
    }
  }
  return { python: null, attempts };
}

const discovery = findPython();
const systemPython = discovery.python;
if (!systemPython) {
  emitBlocked('TIMESFM_PYTHON_3_10_PLUS_REQUIRED', {
    platform: process.platform,
    attemptedCandidates: discovery.attempts
  });
  process.exit(1);
}

const venvPython = process.platform === 'win32'
  ? path.join(VENV, 'Scripts', 'python.exe')
  : path.join(VENV, 'bin', 'python');

if (fs.existsSync(venvPython)) {
  const existingVenv = probePython(venvPython);
  if (!existingVenv.supported) {
    console.log(`[TimesFM] Rebuilding stale isolated environment (Python ${existingVenv.version ?? 'unreadable'}).`);
    fs.rmSync(VENV, { recursive: true, force: true });
  }
}

if (!fs.existsSync(venvPython)) {
  fs.mkdirSync(path.dirname(VENV), { recursive: true });
  const created = run(systemPython.command, [...systemPython.prefix, '-m', 'venv', VENV], { stdio: 'inherit' });
  if (created.status !== 0 || !fs.existsSync(venvPython)) {
    emitBlocked('TIMESFM_VENV_CREATE_FAILED', {
      exit: created.status,
      selectedPython: systemPython
    });
    process.exit(1);
  }
}

const venvProbe = probePython(venvPython);
if (!venvProbe.supported) {
  emitBlocked('TIMESFM_VENV_PYTHON_UNSUPPORTED', venvProbe);
  process.exit(1);
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
