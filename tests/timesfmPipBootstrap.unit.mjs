import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ensureRepoLocalPip } from '../scripts/timesfmPipSupport.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timesfm-pip-bootstrap-'));
const fakeGetPip = path.join(root, 'fake-get-pip.py');

fs.writeFileSync(fakeGetPip, `import pathlib, sys
args = sys.argv[1:]
target = pathlib.Path(args[args.index('--target') + 1])
pkg = target / 'pip'
pkg.mkdir(parents=True, exist_ok=True)
(pkg / '__init__.py').write_text("__version__ = 'test-local'\\n", encoding='utf-8')
(pkg / '__main__.py').write_text("print('pip test-local from repo bootstrap')\\n", encoding='utf-8')
`, 'utf8');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    ...options
  });
}

function tail(value, max = 4000) {
  const output = String(value || '').trim();
  if (!output) return null;
  return output.length <= max ? output : output.slice(-max);
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

const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const noSitePrefix = ['-S'];
const before = pipProbe(pythonCommand, noSitePrefix, { ...process.env, PYTHONPATH: '' });
assert.notEqual(before.status, 0, 'test prerequisite: python -S must not expose system pip');

const result = ensureRepoLocalPip({
  root,
  python: { command: pythonCommand, prefix: noSitePrefix },
  run,
  pipProbe,
  tail,
  getPipUrl: pathToFileURL(fakeGetPip).href
});

assert.equal(result.ok, true, JSON.stringify(result, null, 2));
assert.equal(result.source, 'repo-local-bootstrap');
assert.match(result.env.PYTHONPATH, /pip-bootstrap/);
assert.equal(result.probe.status, 0);
assert.match(String(result.probe.stdout), /pip test-local from repo bootstrap/);

const reused = ensureRepoLocalPip({
  root,
  python: { command: pythonCommand, prefix: noSitePrefix },
  run,
  pipProbe,
  tail,
  getPipUrl: 'file:///definitely-not-used.py'
});
assert.equal(reused.ok, true);
assert.equal(reused.source, 'repo-local-existing');

fs.rmSync(root, { recursive: true, force: true });
console.log('timesfmPipBootstrap.unit: PASS');
