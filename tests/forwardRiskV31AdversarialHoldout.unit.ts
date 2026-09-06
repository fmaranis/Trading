import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/forwardRiskV31AdversarialHoldoutLive.ts'), 'utf8');
const baselineBatch = fs.readFileSync(path.resolve(process.cwd(), 'scripts/forwardRiskV31ValidationBatchLive.ts'), 'utf8');

assert.match(script, /EUR_VALIDATION_HOLDOUT_UNIVERSE/);
assert.match(script, /RANDOM_SEED = 31082026/);
assert.match(script, /PRE_PERIOD_WORST_12M/);
assert.match(script, /WORST_TRAILING_252_BEFORE_PERIOD_START_NO_FUTURE_OUTCOME/);
assert.match(script, /RETIRE_V3_1_ARCHITECTURE/);
assert.match(script, /RESEARCH_SIGNAL_EXISTS_BUT_NOT_ACTIONABLE/);
assert.match(script, /productionPromotionAllowed: false/);
assert.match(script, /runForwardRiskForecastV31/);
assert.doesNotMatch(script, /portfolioDecisionEngine/);
assert.doesNotMatch(script, /runDynamicReplayWithRotationExperiment/);

for (const oldId of ['Q4_2018_CORRECTION', 'PRE_COVID_CALM', 'COVID_2020', 'BEAR_2022', 'CALM_RECOVERY_2023']) {
  assert.ok(baselineBatch.includes(oldId), `Expected old batch to contain ${oldId}`);
  assert.ok(!script.includes(oldId), `Adversarial holdout must not reuse ${oldId}`);
}

for (const newId of ['CHINA_OIL_2015_16', 'CALM_2017', 'POST_TRAIN_2024', 'POST_TRAIN_2025', 'POST_TRAIN_2026_YTD']) {
  assert.ok(script.includes(newId), `Missing unseen period ${newId}`);
}

const scanCalls = script.match(/AssetUniverseScanner\.scan\(/g) ?? [];
const diagnosticCalls = script.match(/loadForwardRiskDiagnosticData\(/g) ?? [];
assert.equal(scanCalls.length, 1, 'Adversarial holdout must scan research data once.');
assert.equal(diagnosticCalls.length, 1, 'Adversarial holdout must load diagnostics once.');

console.log('forwardRiskV31AdversarialHoldout.unit: PASS');
