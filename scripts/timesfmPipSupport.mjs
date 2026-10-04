import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

export function prependPythonPath(entry, env = process.env) {
  const separator = process.platform === 'win32' ? ';' : ':';
  const existing = String(env.PYTHONPATH || '').trim();
  return {
    ...env,
    PYTHONPATH: existing ? `${entry}${separator}${existing}` : entry
  };
}

function compact(result, tail) {
  return {
    exit: result.status,
    errorCode: result.error?.code ?? null,
    stdout: tail(result.stdout, 3000),
    stderr: tail(result.stderr, 5000)
  };
}

export function ensureRepoLocalPip({
  root,
  python,
  run,
  pipProbe,
  tail,
  getPipUrl = DEFAULT_GET_PIP_URL
}) {
  const bootstrapRoot = path.resolve(root, '.research-python', 'pip-bootstrap');
  const getPipPath = path.resolve(root, '.research-python', 'get-pip.py');
  const pipEnv = prependPythonPath(bootstrapRoot, process.env);

  const existing = pipProbe(python.command, python.prefix, pipEnv);
  if (existing.status === 0) {
    return {
      ok: true,
      source: 'repo-local-existing',
      target: bootstrapRoot,
      env: pipEnv,
      probe: existing
    };
  }

  fs.rmSync(bootstrapRoot, { recursive: true, force: true });
  fs.mkdirSync(bootstrapRoot, { recursive: true });
  fs.mkdirSync(path.dirname(getPipPath), { recursive: true });

  const downloadCode = [
    'import pathlib, sys, urllib.request',
    'url = sys.argv[1]',
    'dst = pathlib.Path(sys.argv[2])',
    'dst.parent.mkdir(parents=True, exist_ok=True)',
    'with urllib.request.urlopen(url, timeout=60) as response:',
    '    dst.write_bytes(response.read())',
    'print(dst)'
  ].join('\n');

  const download = run(
    python.command,
    [...python.prefix, '-c', downloadCode, getPipUrl, getPipPath],
    { env: process.env }
  );
  if (download.status !== 0) {
    return {
      ok: false,
      stage: 'download',
      source: 'repo-local-bootstrap',
      target: bootstrapRoot,
      getPipUrl,
      initialProbe: existing,
      detail: compact(download, tail)
    };
  }

  const install = run(
    python.command,
    [
      ...python.prefix,
      getPipPath,
      '--disable-pip-version-check',
      '--no-warn-script-location',
      '--target',
      bootstrapRoot
    ],
    { env: process.env }
  );
  if (install.status !== 0) {
    return {
      ok: false,
      stage: 'install',
      source: 'repo-local-bootstrap',
      target: bootstrapRoot,
      getPipUrl,
      initialProbe: existing,
      detail: compact(install, tail)
    };
  }

  const verified = pipProbe(python.command, python.prefix, pipEnv);
  if (verified.status !== 0) {
    return {
      ok: false,
      stage: 'verify',
      source: 'repo-local-bootstrap',
      target: bootstrapRoot,
      getPipUrl,
      initialProbe: existing,
      install: compact(install, tail),
      probe: verified
    };
  }

  return {
    ok: true,
    source: 'repo-local-bootstrap',
    target: bootstrapRoot,
    env: pipEnv,
    probe: verified
  };
}
