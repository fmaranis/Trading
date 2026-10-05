import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const protocol=fs.readFileSync(path.resolve(root,'scripts/timesfmMultivariateContextV1Protocol.mjs'),'utf8');
const diagnostic=fs.readFileSync(path.resolve(root,'scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'),'utf8');
const client=fs.readFileSync(path.resolve(root,'scripts/timesfmMultivariateContextV1RemoteClient.mjs'),'utf8');
const endpoint=fs.readFileSync(path.resolve(root,'runner/timesfm/hf-space/app.py'),'utf8');

assert.match(protocol,/maxVariates: 32/);
assert.match(protocol,/pastOnlyCovariates: 23/);
assert.match(protocol,/futureKnownCovariates: Object\.freeze\(\[\]\)/);
assert.match(protocol,/EVERY_VALUE_MUST_BE_DERIVED_FROM_DATA_AT_OR_BEFORE_INFORMATION_DATE/);
assert.match(diagnostic,/targetContext:a\.targetContext,pastOnlyCovariates:a\.pastOnlyCovariates/);
assert.doesNotMatch(diagnostic,/pastFutureCovariates/);
assert.match(diagnostic,/const remote=await callTimesFmMultivariateContextV1\(payload\);const remoteByAnchor/);
assert.ok(
  diagnostic.indexOf('callTimesFmMultivariateContextV1(payload)') <
  diagnostic.indexOf("evaluateArm('TARGETS_ONLY'"),
  'Forecast must be obtained before outcomes are evaluated'
);
assert.doesNotMatch(diagnostic,/DynamicHistoricalReplay|PortfolioDecisionEngine|OpportunityAllocationPolicy/);
assert.match(client,/multivariate_context_predict/);
assert.match(client,/TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED/);

assert.match(endpoint,/TimesFM3Evaluator/);
assert.match(endpoint,/def multivariate_context_predict/);
assert.match(endpoint,/contexts=contexts/);
assert.match(endpoint,/past_only_covariates=past_only_covariates/);
assert.match(endpoint,/past_future_covariates=None/);
assert.match(endpoint,/return_quantiles=True/);
assert.match(endpoint,/"targetContext"/);
assert.match(endpoint,/"pastOnlyCovariates"/);
assert.match(endpoint,/MV_TARGET_COUNT = 9/);
assert.match(endpoint,/MV_PAST_ONLY_COVARIATE_COUNT = 23/);
assert.match(endpoint,/api_name="multivariate_context_predict"/);
assert.match(endpoint,/@spaces\.GPU/);
assert.match(endpoint,/stage_b_predict/);
assert.match(endpoint,/run_stage_a/);

console.log('timesfmMultivariateContextV1Contract.unit: PASS');
