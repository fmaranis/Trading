import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const v6 = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/forwardRiskCrossAssetV6.ts'), 'utf8');
const worker = fs.readFileSync(path.resolve(process.cwd(), 'src/workers/historicalReplayAudit.worker.ts'), 'utf8');

assert.match(v6, /PAST_ONLY_CROSS_ASSET_DIVERGENCE_NO_LABEL_FIT/);
assert.match(v6, /CALIBRATION_SESSIONS = 756/);
assert.match(v6, /MIN_CALIBRATION_SESSIONS = 252/);
assert.match(v6, /DIVERGENCE_SCORE = 0\.80/);
assert.match(v6, /PRE_PEAK_LOOKBACK_SESSIONS = 63/);
assert.match(v6, /anticipationRatePct \?\? 0\) >= 50/);
assert.match(v6, /medianLeadSessionsBeforePeak \?\? 0\) >= 10/);
assert.match(v6, /falseDivergenceTimePct \?\? 100\) <= 35/);
assert.match(v6, /riskUnderperform20Share/);
assert.match(v6, /defensiveOutperform20Share/);
assert.match(v6, /riskMedianLag60/);
assert.match(v6, /defensiveMedianLead60/);
assert.doesNotMatch(v6, /fitWithRegularization|LEARNING_RATE|REGULARIZATION_MULTIPLIERS/);
assert.doesNotMatch(v6, /future20dDrop|futureDropLabel|auc20d/);
assert.doesNotMatch(v6, /runForwardRiskRegimeShiftV4|runForwardRiskVulnerabilityV5/);
assert.doesNotMatch(v6, /portfolioDecisionEngine|targetCoreExposurePct/);
assert.doesNotMatch(worker, /runForwardRiskCrossAssetV6/);

console.log('forwardRiskCrossAssetV6.unit: PASS');
