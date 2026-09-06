import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/forwardRiskRegimeShiftV4RollingHoldoutLive.ts'), 'utf8');

assert.match(script, /LABEL_FREE_REGIME_SHIFT_ROLLING_ANNUAL_HOLDOUT_2011_2026/);
assert.match(script, /START_YEAR = 2011/);
assert.match(script, /END_YEAR = 2026/);
assert.match(script, /HOLDOUT_ALL/);
assert.match(script, /HOLDOUT_A/);
assert.match(script, /HOLDOUT_B/);
assert.match(script, /runForwardRiskRegimeShiftV4/);
assert.match(script, /productionPromotionAllowed: false/);
assert.match(script, /RETIRE_V4_ARCHITECTURE/);
assert.match(script, /V4_CANDIDATE_FOR_ECONOMIC_GATE/);
assert.doesNotMatch(script, /runForwardRiskForecastV31/);
assert.doesNotMatch(script, /PRE_PERIOD_WORST_12M/);
assert.doesNotMatch(script, /COVID_2020/);
assert.doesNotMatch(script, /BEAR_2022/);
assert.doesNotMatch(script, /Q4_2018_CORRECTION/);

const scanCalls = script.match(/AssetUniverseScanner\.scan\(/g) ?? [];
const diagnosticCalls = script.match(/loadForwardRiskDiagnosticData\(/g) ?? [];
assert.equal(scanCalls.length, 1, 'V4 rolling gate must share a single expensive market-data scan.');
assert.equal(diagnosticCalls.length, 1, 'V4 rolling gate must share a single diagnostic-data load.');

console.log('forwardRiskRegimeShiftV4RollingHoldout.unit: PASS');
