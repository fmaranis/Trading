import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const VENV = path.resolve(ROOT, '.research-venv', 'timesfm3');
const TARGET = path.resolve(ROOT, '.research-python', 'timesfm3');
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
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
}

function tail(value, max = 4000) {
  const output = String(value || '').trim();
  if (!output) return null;
  return output.length <= max ? output : output.slice(-max);
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

function probePython(command, prefix = [], env = process.env) {
  const code = [
    'import json, sys',
    'print(json.dumps({',
    '  "executable": sys.executable,',
    '  "major": sys.version_info[0],',
    '  "minor": sys.version_info[1],',
    '  "version": sys.version.split()[0]',
    '}))'
  ].join('\n');
  const probe = run(command, [...prefix, '-c', code], { env });
  const stdout = String(probe.stdout || '').trim();
  let info = null;
  if (probe.status === 0 && stdout) {
    try {
      info = JSON.parse(stdout.split(/\r?\n/).at(-1));
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


function localTargetEnv() {
  const separator = process.platform === 'win32' ? ';' : ':';
  const existing = process.env.PYTHONPATH?.trim();
  return {
    ...process.env,
    PYTHONNOUSERSITE: '1',
    PYTHONPATH: existing ? `${TARGET}${separator}${existing}` : TARGET
  };
}

function packageVersion(command, prefix = [], env = process.env) {
  const check = run(
    command,
    [...prefix, '-c', "import importlib.metadata; print(importlib.metadata.version('timesfm'))"],
    { env }
  );
  return {
    status: check.status,
    version: check.status === 0 ? String(check.stdout || '').trim() : null,
    stderr: tail(check.stderr, 1500)
  };
}

function ensureTargetInstall(systemPython, venvFailure) {
  const pipProbe = run(
    systemPython.command,
    [...systemPython.prefix, '-m', 'pip', '--version']
  );
  if (pipProbe.status !== 0) {
    emitBlocked('TIMESFM_INSTALLER_UNAVAILABLE', {
      selectedPython: systemPython,
      venvFailure,
      pipExit: pipProbe.status,
      pipErrorCode: pipProbe.error?.code ?? null,
      pipStderr: tail(pipProbe.stderr, 2500)
    });
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });

  const targetEnv = localTargetEnv();
  let installed = packageVersion(systemPython.command, systemPython.prefix, targetEnv);
  if (installed.version !== EXPECTED_VERSION) {
    // Never reuse a partially populated target after a failed dependency install.
    fs.rmSync(TARGET, { recursive: true, force: true });
    fs.mkdirSync(TARGET, { recursive: true });

    console.log(`[TimesFM] stdlib venv unavailable; installing isolated research packages into ${path.relative(ROOT, TARGET)} ...`);
    const install = run(
      systemPython.command,
      [
        ...systemPython.prefix,
        '-m',
        'pip',
        'install',
        '--disable-pip-version-check',
        '--upgrade',
        '--target',
        TARGET,
        '-r',
        REQUIREMENTS
      ],
      { stdio: 'inherit' }
    );
    if (install.status !== 0) {
      emitBlocked('TIMESFM_TARGET_INSTALL_FAILED', {
        exit: install.status,
        selectedPython: systemPython,
        target: path.relative(ROOT, TARGET),
        venvFailure
      });
      process.exit(1);
    }
    installed = packageVersion(systemPython.command, systemPython.prefix, targetEnv);
  }

  if (installed.status !== 0 || installed.version !== EXPECTED_VERSION) {
    emitBlocked('TIMESFM_VERSION_NOT_PINNED_AFTER_TARGET_INSTALL', {
      selectedPython: systemPython,
      target: path.relative(ROOT, TARGET),
      detectedVersion: installed.version,
      stderr: installed.stderr,
      venvFailure
    });
    process.exit(1);
  }

  return {
    mode: 'target',
    command: systemPython.command,
    prefix: systemPython.prefix,
    env: targetEnv
  };
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
}

let runtime = null;

if (!fs.existsSync(venvPython)) {
  const created = run(systemPython.command, [...systemPython.prefix, '-m', 'venv', VENV]);
  if (created.status !== 0 || !fs.existsSync(venvPython)) {
    const venvFailure = {
      exit: created.status,
      errorCode: created.error?.code ?? null,
      stdout: tail(created.stdout, 2500),
      stderr: tail(created.stderr, 4000)
    };
    fs.rmSync(VENV, { recursive: true, force: true });
    console.log('[TimesFM] stdlib venv creation failed; trying repo-local pip target fallback.');
    runtime = ensureTargetInstall(systemPython, venvFailure);
  }
}

if (!runtime) {
  const venvProbe = probePython(venvPython);
  if (!venvProbe.supported) {
    emitBlocked('TIMESFM_VENV_PYTHON_UNSUPPORTED', venvProbe);
    process.exit(1);
  }

  const installed = packageVersion(venvPython);
  if (installed.version !== EXPECTED_VERSION) {
    console.log(`[TimesFM] Installing isolated research environment from ${path.relative(ROOT, REQUIREMENTS)} ...`);
    const install = run(
      venvPython,
      ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', REQUIREMENTS],
      { stdio: 'inherit' }
    );
    if (install.status !== 0) {
      emitBlocked('TIMESFM_DEPENDENCY_INSTALL_FAILED', `exit=${install.status}`);
      process.exit(1);
    }
  }

  const finalVersion = packageVersion(venvPython);
  if (finalVersion.status !== 0 || finalVersion.version !== EXPECTED_VERSION) {
    emitBlocked('TIMESFM_VERSION_NOT_PINNED_AFTER_INSTALL', finalVersion.stderr);
    process.exit(1);
  }

  runtime = {
    mode: 'venv',
    command: venvPython,
    prefix: [],
    env: process.env
  };
}

console.log(`[TimesFM] Isolated environment ready (${runtime.mode}). Loading the official 3.0 checkpoint; first run may download ~1.32 GB into the Hugging Face cache.`);
const smoke = run(
  runtime.command,
  [...runtime.prefix, RUNNER],
  { stdio: 'inherit', env: { ...runtime.env, PYTHONUNBUFFERED: '1' } }
);
process.exit(smoke.status ?? 1);
