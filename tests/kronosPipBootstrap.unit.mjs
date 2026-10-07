import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner=fs.readFileSync('scripts/kronosStageALive.mjs','utf8');

assert.match(runner,/bootstrap\.pypa\.io\/get-pip\.py/);
assert.match(runner,/kronos-pip-bootstrap/);
assert.match(runner,/urllib\.request\.urlretrieve/);
assert.match(runner,/KRONOS_REPO_LOCAL_PIP_BOOTSTRAP_FAILED/);
assert.match(runner,/KRONOS_PIP_UNAVAILABLE_AFTER_REPO_LOCAL_BOOTSTRAP/);
assert.match(runner,/Repo-local pip ready/);
assert.match(runner,/System pip\/ensurepip unavailable; bootstrapping repo-local pip without sudo\/apt/);
assert.match(runner,/PYTHONPATH: \[TARGET, PIP_BOOTSTRAP/);
assert.doesNotMatch(runner,/run\(['"]sudo['"]/);
assert.doesNotMatch(runner,/run\(['"]apt-get['"]/);
assert.doesNotMatch(runner,/run\(['"]apt['"]/);
assert.doesNotMatch(runner,/spawnSync\(['"]sudo['"]/);
assert.doesNotMatch(runner,/spawnSync\(['"]apt-get['"]/);
assert.doesNotMatch(runner,/spawnSync\(['"]apt['"]/);

const ensureStart=runner.indexOf('function ensurePip');
const runtimeStart=runner.indexOf('function runtimeEnv',ensureStart);
const ensureBlock=runner.slice(ensureStart,runtimeStart);
assert.ok(ensureBlock.indexOf("ensurepip")>=0);
assert.ok(ensureBlock.indexOf("GET_PIP_URL")>ensureBlock.indexOf("ensurepip"));
assert.ok(!/if \(ensure\.status !== 0\) throw new Error\('KRONOS_PIP_UNAVAILABLE/.test(ensureBlock));

console.log('kronosPipBootstrap.unit: PASS');
