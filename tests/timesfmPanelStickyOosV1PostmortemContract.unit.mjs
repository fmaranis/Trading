import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const script=fs.readFileSync(path.resolve(root,'scripts/timesfmPanelStickyOosV1Postmortem.ts'),'utf8');

assert.match(script,/TIMESFM_PANEL_STICKY_OOS_V1_POSTMORTEM/);
assert.match(script,/CONSUMED_HOLDOUT_SIGNAL_DIAGNOSTIC_ONLY/);
assert.match(script,/CONSUMED_AFTER_OOS_POLICY_TEST_NO_PROMOTION/);
assert.match(script,/mayRetuneOnThisHoldout:false/);
assert.match(script,/mayPromoteProduction:false/);
assert.match(script,/productionDefault:'LEGACY'/);
assert.match(script,/productionAuthority:false/);
assert.match(script,/rawCachePath/);
assert.match(script,/rawSha256/);
assert.match(script,/rankIc60/);
assert.match(script,/directionalAccuracyPct60/);
assert.match(script,/top1InActualTop3/);
assert.match(script,/selectedActualRelativeReturn60Pct/);
assert.doesNotMatch(script,/callTimesFm|fetch\(.*yahoo|HUGGING_FACE|ZeroGPU/);

console.log('timesfmPanelStickyOosV1PostmortemContract.unit: PASS');
