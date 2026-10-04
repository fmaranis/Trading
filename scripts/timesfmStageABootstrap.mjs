import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureRepoLocalPip, prependPythonPath } from './timesfmPipSupport.mjs';

const ROOT = process.cwd();
const VENV = path.resolve(ROOT, '.research-venv', 'timesfm3');
const TARGET = path.resolve(ROOT, '.research-python', 'timesfm3');
const REQUIREMENTS = path.resolve(ROOT, 'backend', 'requirements-timesfm.txt');
const RUNNER = path.resolve(ROOT, 'backend', 'scripts', 'timesfm_stage_a_smoke.py');
const EXPECTED_VERSION = '3.0.2';
const PYTORCH_CPU_INDEX = 'https://download.pytorch.org/whl/cpu';
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


function localTargetEnv(baseEnv = process.env) {
  return prependPythonPath(TARGET, {
    ...baseEnv,
    PYTHONNOUSERSITE: '1'
  });
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

function pipProbe(command, prefix = [], env = process.env) {
  const probe = run(command, [...prefix, '-m', 'pip', '--version'], { env });
  return {
    status: probe.status,
    errorCode: probe.error?.code ?? null,
    stdout: tail(probe.stdout, 1500),
    stderr: tail(probe.stderr, 2500)
  };
}

function torchProbe(command, prefix = [], env = process.env) {
  const probe = run(
    command,
    [...prefix, '-c', "import torch; print(getattr(torch, '__version__', 'unknown'))"],
    { env }
  );
  return {
    status: probe.status,
    version: probe.status === 0 ? String(probe.stdout || '').trim() : null,
    errorCode: probe.error?.code ?? null,
    stderr: tail(probe.stderr, 2500)
  };
}

function installDetail(install, extra = {}) {
  return {
    ...extra,
    exit: install.status,
    errorCode: install.error?.code ?? null,
    stdout: tail(install.stdout, 4000),
    stderr: tail(install.stderr, 6000)
  };
}

function installCpuTorch(command, prefix = [], env = process.env, target = null) {
  const args = [
    ...prefix,
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '--prefer-binary',
    '--index-url',
    PYTORCH_CPU_INDEX
  ];
  if (target) args.push('--upgrade', '--target', target);
  args.push('torch>=2.0.0');
  return run(command, args, { env });
}

function installTimesFmRequirements(command, prefix = [], env = process.env, target = null) {
  const args = [
    ...prefix,
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '--prefer-binary'
  ];
  if (target) args.push('--upgrade', '--target', target);
  args.push('-r', REQUIREMENTS);
  return run(command, args, { env });
}

function ensureTargetInstall(systemPython, venvFailure) {
  const systemPip = pipProbe(systemPython.command, systemPython.prefix);
  let pipRuntime = {
    ok: true,
    source: 'system',
    target: null,
    env: process.env,
    probe: systemPip
  };

  if (systemPip.status !== 0) {
    console.log('[TimesFM] System pip unavailable; bootstrapping repo-local pip without sudo/apt.');
    pipRuntime = ensureRepoLocalPip({
      root: ROOT,
      python: systemPython,
      run,
      pipProbe,
      tail
    });
    if (!pipRuntime.ok) {
      emitBlocked('TIMESFM_INSTALLER_UNAVAILABLE', {
        selectedPython: systemPython,
        venvFailure,
        pip: systemPip,
        pipBootstrap: pipRuntime
      });
      process.exit(1);
    }
    console.log(`[TimesFM] Repo-local pip ready (${pipRuntime.source}).`);
  }

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });

  const targetEnv = localTargetEnv(pipRuntime.env);
  let installed = packageVersion(systemPython.command, systemPython.prefix, targetEnv);
  let torch = torchProbe(systemPython.command, systemPython.prefix, targetEnv);
  if (installed.version !== EXPECTED_VERSION || torch.status !== 0) {
    // Never reuse a partially populated target after a failed dependency install.
    fs.rmSync(TARGET, { recursive: true, force: true });
    fs.mkdirSync(TARGET, { recursive: true });

    console.log(`[TimesFM] stdlib venv unavailable; installing isolated CPU research packages into ${path.relative(ROOT, TARGET)} ...`);
    const torchInstall = installCpuTorch(systemPython.command, systemPython.prefix, pipRuntime.env, TARGET);
    if (torchInstall.status !== 0) {
      emitBlocked('TIMESFM_TARGET_TORCH_CPU_INSTALL_FAILED', installDetail(torchInstall, {
        selectedPython: systemPython,
        target: path.relative(ROOT, TARGET),
        pytorchIndex: PYTORCH_CPU_INDEX,
        pipSource: pipRuntime.source,
        venvFailure
      }));
      process.exit(1);
    }

    const install = installTimesFmRequirements(systemPython.command, systemPython.prefix, targetEnv, TARGET);
    if (install.status !== 0) {
      emitBlocked('TIMESFM_TARGET_DEPENDENCY_INSTALL_FAILED', installDetail(install, {
        selectedPython: systemPython,
        target: path.relative(ROOT, TARGET),
        pipSource: pipRuntime.source,
        venvFailure
      }));
      process.exit(1);
    }
    installed = packageVersion(systemPython.command, systemPython.prefix, targetEnv);
    torch = torchProbe(systemPython.command, systemPython.prefix, targetEnv);
  }

  if (installed.status !== 0 || installed.version !== EXPECTED_VERSION || torch.status !== 0) {
    emitBlocked('TIMESFM_VERSION_NOT_PINNED_AFTER_TARGET_INSTALL', {
      selectedPython: systemPython,
      target: path.relative(ROOT, TARGET),
      pipSource: pipRuntime.source,
      detectedVersion: installed.version,
      timesfmStderr: installed.stderr,
      torchVersion: torch.version,
      torchStderr: torch.stderr,
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

let staleVenvFailure = null;
if (fs.existsSync(venvPython)) {
  const existingVenv = probePython(venvPython);
  if (!existingVenv.supported) {
    staleVenvFailure = {
      kind: 'EXISTING_VENV_PYTHON_UNSUPPORTED',
      python: existingVenv
    };
    console.log(`[TimesFM] Rebuilding stale isolated environment (Python ${existingVenv.version ?? 'unreadable'}).`);
    fs.rmSync(VENV, { recursive: true, force: true });
  } else {
    const existingPip = pipProbe(venvPython);
    if (existingPip.status !== 0) {
      staleVenvFailure = {
        kind: 'EXISTING_VENV_PIP_UNAVAILABLE',
        python: existingVenv,
        pip: existingPip
      };
      console.log('[TimesFM] Removing incomplete isolated environment: Python exists but pip is unavailable.');
      fs.rmSync(VENV, { recursive: true, force: true });
    }
  }
}

if (!fs.existsSync(venvPython)) {
  fs.mkdirSync(path.dirname(VENV), { recursive: true });
}

let runtime = null;

if (!fs.existsSync(venvPython)) {
  const created = run(systemPython.command, [...systemPython.prefix, '-m', 'venv', VENV]);
  const createdPip = created.status === 0 && fs.existsSync(venvPython)
    ? pipProbe(venvPython)
    : null;
  if (
    created.status !== 0 ||
    !fs.existsSync(venvPython) ||
    !createdPip ||
    createdPip.status !== 0
  ) {
    const venvFailure = {
      kind: created.status !== 0 ? 'VENV_CREATE_FAILED' : 'VENV_CREATED_WITHOUT_WORKING_PIP',
      exit: created.status,
      errorCode: created.error?.code ?? null,
      stdout: tail(created.stdout, 2500),
      stderr: tail(created.stderr, 4000),
      pip: createdPip,
      previousPartialVenv: staleVenvFailure
    };
    fs.rmSync(VENV, { recursive: true, force: true });
    console.log('[TimesFM] stdlib venv is unavailable/incomplete; trying repo-local pip target fallback.');
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
  const installedTorch = torchProbe(venvPython);
  if (installed.version !== EXPECTED_VERSION || installedTorch.status !== 0) {
    console.log(`[TimesFM] Installing isolated CPU research environment from ${path.relative(ROOT, REQUIREMENTS)} ...`);
    const torchInstall = installCpuTorch(venvPython);
    if (torchInstall.status !== 0) {
      emitBlocked('TIMESFM_TORCH_CPU_INSTALL_FAILED', installDetail(torchInstall, {
        selectedPython: systemPython,
        installMode: 'venv',
        pytorchIndex: PYTORCH_CPU_INDEX
      }));
      process.exit(1);
    }

    const install = installTimesFmRequirements(venvPython);
    if (install.status !== 0) {
      emitBlocked('TIMESFM_DEPENDENCY_INSTALL_FAILED', installDetail(install, {
        selectedPython: systemPython,
        installMode: 'venv'
      }));
      process.exit(1);
    }
  }

  const finalVersion = packageVersion(venvPython);
  const finalTorch = torchProbe(venvPython);
  if (finalVersion.status !== 0 || finalVersion.version !== EXPECTED_VERSION || finalTorch.status !== 0) {
    emitBlocked('TIMESFM_VERSION_NOT_PINNED_AFTER_INSTALL', {
      detectedVersion: finalVersion.version,
      timesfmStderr: finalVersion.stderr,
      torchVersion: finalTorch.version,
      torchStderr: finalTorch.stderr
    });
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
