import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const collector=read('scripts/timesfmStageBProspectiveCollectorLive.mjs');
const protocol=read('scripts/timesfmStageBProspectiveProtocol.mjs');
const store=read('scripts/timesfmStageBProspectiveStateStore.mjs');

assert.match(protocol,/noHistoricalCatchUp: true/);
assert.match(protocol,/noRetroactiveForecastAfterFirstCommonSessionPassed: true/);
assert.match(protocol,/futureOutcomeAccess: false/);
assert.match(protocol,/minimumMaturedAnchors: STAGE_B\.prospectiveConfirmation\.minimumMaturedAnchors/);
assert.match(protocol,/productionDefault: 'LEGACY'/);
assert.match(protocol,/productionAuthority: false/);
assert.match(protocol,/version: 'TIMESFM_RELATIVE_RANK_V1'/);
assert.match(protocol,/MEAN_ORDINAL_RANK_ACROSS_20_60_AMONG_ALREADY_ELIGIBLE_CANDIDATES/);
assert.match(protocol,/allEligibleForecastCoverageRequired: true/);

assert.match(collector,/MISSED_WEEK_NO_RETROACTIVE_FORECAST/);
assert.match(collector,/berlin\.date <= M\.startAfter/);
assert.match(collector,/payloadFingerprintSha256/);
assert.match(collector,/outcomesOpened:false/);
assert.match(collector,/economicShadowPolicyVersion:M\.economicShadow\.version/);
assert.match(collector,/callTimesFmStageB\(payload\)/);
assert.match(collector,/saveTimesFmProspectiveDurableState/);
assert.ok(collector.indexOf('const remote=await callTimesFmStageB(payload);') < collector.indexOf('state=appendTimesFmProspectiveAnchor'));
assert.doesNotMatch(collector,/actualReturn|futureReturn|realizedReturn|realisedReturn/);
assert.doesNotMatch(collector,/evaluateStageB|StageBEvaluator/);

assert.match(store,/DEFAULT_BRANCH = 'replay-results'/);
assert.match(store,/GITHUB_REPLAY_SYNC_TOKEN/);
assert.match(store,/validation-runs\/timesfm-stage-b-prospective-confirmation-v1-state\.json/);
assert.match(store,/verifyTimesFmProspectiveState/);

console.log('timesfmStageBProspectiveContract.unit: PASS');
