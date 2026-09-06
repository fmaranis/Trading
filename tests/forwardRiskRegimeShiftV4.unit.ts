import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const v4 = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/forwardRiskRegimeShiftV4.ts'), 'utf8');
const worker = fs.readFileSync(path.resolve(process.cwd(), 'src/workers/historicalReplayAudit.worker.ts'), 'utf8');

assert.match(v4, /PAST_ONLY_UNSUPERVISED_REGIME_SHIFT_NO_LABEL_FIT/);
assert.match(v4, /CALIBRATION_SESSIONS = 756/);
assert.match(v4, /MIN_CALIBRATION_SESSIONS = 252/);
assert.match(v4, /HIGH_RISK_SCORE = 0\.80/);
assert.match(v4, /Future 20-session drawdown labels are used only after scoring for audit metrics/);
assert.doesNotMatch(v4, /fitWithRegularization/);
assert.doesNotMatch(v4, /REGULARIZATION_MULTIPLIERS/);
assert.doesNotMatch(v4, /LEARNING_RATE/);
assert.doesNotMatch(v4, /portfolioDecisionEngine/);
assert.doesNotMatch(v4, /targetCoreExposurePct/);

assert.doesNotMatch(worker, /runForwardRiskForecastV31/);
assert.doesNotMatch(worker, /runForwardRiskForecastV3\(/);
assert.doesNotMatch(worker, /runForwardRiskForecastV2/);
assert.doesNotMatch(worker, /runForwardRiskForecastV1/);
assert.match(worker, /RETIRED_FROM_REPLAY_V3_1_ADVERSARIAL_HOLDOUT_FAILED/);

console.log('forwardRiskRegimeShiftV4.unit: PASS');
