import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/forwardRiskCrossAssetV6RollingLive.ts'), 'utf8');

assert.match(script, /START_YEAR = 2011/);
assert.match(script, /END_YEAR = 2026/);
assert.match(script, /runForwardRiskCrossAssetV6/);
assert.match(script, /RISK_SENSITIVE_CATEGORIES/);
assert.match(script, /DEFENSIVE_CATEGORIES/);
assert.match(script, /anticipation >= 50% AND median lead >= 10 sessions AND false divergence time <= 35%/);
assert.match(script, /V6_CANDIDATE_FOR_COMPLEMENTARITY_GATE/);
assert.match(script, /RETIRE_V6_CROSS_ASSET_ARCHITECTURE/);
assert.match(script, /FORWARD_RISK_V6_CROSS_ASSET_RESULT/);
assert.doesNotMatch(script, /COVID_2020|BEAR_2022|Q4_2018/);
assert.doesNotMatch(script, /runForwardRiskRegimeShiftV4|runForwardRiskVulnerabilityV5/);
assert.doesNotMatch(script, /RANDOM_SEED|PRE_PERIOD_WORST/);
assert.doesNotMatch(script, /portfolioDecisionEngine|targetCoreExposurePct/);

console.log('forwardRiskCrossAssetV6Rolling.unit: PASS');
