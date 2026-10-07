import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const TARGET = path.resolve(ROOT, '.research-python', 'kronos-v1');
const REQUIREMENTS = path.resolve(ROOT, 'backend', 'requirements-kronos.txt');
const RUNNER = path.resolve(ROOT, 'backend', 'scripts', 'kronos_stage_a_smoke.py');
const PIP_BOOTSTRAP = path.resolve(ROOT, '.research-python', 'kronos-pip-bootstrap');
const GET_PIP = path.resolve(ROOT, '.runtime', 'kronos-bootstrap', 'get-pip.py');
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    timeout: options.timeout ?? 600_000,
    env: options.env ?? process.env
  });
}

function findPython() {
  const candidates = [process.env.KRONOS_PYTHON_BIN, 'python3', 'python'].filter(Boolean);
  for (const candidate of candidates) {
    const probe = run(candidate, ['--version'], { timeout: 10_000 });
    if (probe.status === 0) return candidate;
  }
  throw new Error('KRONOS_PYTHON_NOT_FOUND');
}

function pipEnv() {
  return {
    ...process.env,
    PYTHONPATH: [PIP_BOOTSTRAP, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    PYTHONNOUSERSITE: '1'
  };
}

function ensurePip(python) {
  let probe = run(python, ['-m', 'pip', '--version'], { timeout: 20_000, env: pipEnv() });
  if (probe.status === 0) return;

  const ensure = run(python, ['-m', 'ensurepip', '--upgrade'], { timeout: 120_000, env: pipEnv() });
  if (ensure.status === 0) {
    probe = run(python, ['-m', 'pip', '--version'], { timeout: 20_000, env: pipEnv() });
    if (probe.status === 0) return;
  }

  console.log('[Kronos] System pip/ensurepip unavailable; bootstrapping repo-local pip without sudo/apt.');
  fs.mkdirSync(path.dirname(GET_PIP), { recursive: true });
  fs.mkdirSync(PIP_BOOTSTRAP, { recursive: true });

  if (!fs.existsSync(GET_PIP)) {
    const download = run(python, [
      '-c',
      'import urllib.request,sys; urllib.request.urlretrieve(sys.argv[1], sys.argv[2])',
      GET_PIP_URL,
      GET_PIP
    ], { timeout: 120_000, env: process.env });
    if (download.status !== 0) {
      throw new Error('KRONOS_GET_PIP_DOWNLOAD_FAILED:' + (download.stderr || download.stdout || '').slice(-1000));
    }
  }

  const bootstrap = run(python, [
    GET_PIP,
    '--disable-pip-version-check',
    '--no-warn-script-location',
    '--target', PIP_BOOTSTRAP
  ], { inherit: true, timeout: 300_000, env: process.env });
  if (bootstrap.status !== 0) throw new Error('KRONOS_REPO_LOCAL_PIP_BOOTSTRAP_FAILED');

  probe = run(python, ['-m', 'pip', '--version'], { timeout: 20_000, env: pipEnv() });
  if (probe.status !== 0) {
    throw new Error('KRONOS_PIP_UNAVAILABLE_AFTER_REPO_LOCAL_BOOTSTRAP:' + (probe.stderr || probe.stdout || '').slice(-1000));
  }
  console.log('[Kronos] Repo-local pip ready.');
}

function runtimeEnv() {
  return {
    ...process.env,
    PYTHONPATH: [TARGET, PIP_BOOTSTRAP, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    PYTHONNOUSERSITE: '1'
  };
}

function runtimeReady(python) {
  const code = [
    "import importlib.metadata as m",
    "import torch,numpy,pandas,einops,huggingface_hub,safetensors,tqdm",
    "assert torch.__version__.split('+')[0] == '2.8.0'",
    "assert m.version('pandas') == '2.2.2'",
    "assert m.version('einops') == '0.8.1'",
    "assert m.version('huggingface_hub') == '0.33.1'",
    "assert m.version('safetensors') == '0.6.2'",
    "assert m.version('tqdm') == '4.67.1'"
  ].join(';');
  return run(python, ['-c', code], { timeout: 30_000, env: runtimeEnv() }).status === 0;
}

function installRuntime(python) {
  fs.mkdirSync(TARGET, { recursive: true });
  ensurePip(python);

  console.log('[Kronos] Installing isolated CPU torch runtime...');
  const torch = run(python, [
    '-m','pip','install','--disable-pip-version-check','--upgrade',
    '--target', TARGET,
    '--index-url','https://download.pytorch.org/whl/cpu',
    'torch==2.8.0'
  ], { inherit: true, timeout: 900_000, env: pipEnv() });
  if (torch.status !== 0) throw new Error('KRONOS_TORCH_INSTALL_FAILED');

  console.log('[Kronos] Installing pinned research dependencies...');
  const deps = run(python, [
    '-m','pip','install','--disable-pip-version-check','--upgrade',
    '--target', TARGET,
    '-r', REQUIREMENTS
  ], { inherit: true, timeout: 600_000, env: pipEnv() });
  if (deps.status !== 0) throw new Error('KRONOS_DEPENDENCIES_INSTALL_FAILED');
}

const python = findPython();
console.log('[Kronos] Python:', python);

if (!runtimeReady(python)) {
  installRuntime(python);
  if (!runtimeReady(python)) throw new Error('KRONOS_ISOLATED_RUNTIME_NOT_READY_AFTER_INSTALL');
} else {
  console.log('[Kronos] Isolated runtime already ready.');
}

const result = run(python, [RUNNER], { inherit: true, timeout: 900_000, env: runtimeEnv() });
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
