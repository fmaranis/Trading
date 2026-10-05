import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-multivariate-context-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_MULTIVARIATE_CONTEXT_V1_SEAL');
assert.equal(seal.sealRevision,8);
assert.equal(seal.study.version,'TIMESFM_MULTIVARIATE_CONTEXT_V1');
assert.equal(seal.study.historicalSample,'CONSUMED_2018Q1_2025Q3_DIAGNOSTIC_ONLY');
assert.equal(seal.study.diagnosticRunOpened,true);
assert.equal(seal.study.promotionAuthority,false);
assert.equal(seal.study.economicPolicy,false);
assert.equal(seal.frozenDesign.targets,9);
assert.equal(seal.frozenDesign.contextLength,512);
assert.equal(seal.frozenDesign.forecastHorizon,60);
assert.deepEqual(seal.frozenDesign.primaryHorizons,[20,60]);
assert.equal(seal.frozenDesign.pastOnlyCovariates,23);
assert.equal(seal.frozenDesign.totalVariatesArmB,32);
assert.equal(seal.frozenDesign.pastFutureCovariates,0);
assert.equal(seal.frozenDesign.syntheticFallback,false);
assert.equal(seal.prospective.bothArmsFrozenBeforeFirstAnchor,true);
assert.equal(seal.prospective.firstEligibleIsoWeek,'2026-W42');
assert.equal(seal.prospective.sampleOpened,false);
assert.equal(seal.prospective.marketAccessed,false);
assert.equal(seal.prospective.outcomesOpened,false);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);
assert.equal(seal.runtimeTransport.apiVersion,2);
assert.equal(seal.runtimeTransport.maxAnchorsPerRemoteCall,8);
assert.equal(seal.runtimeTransport.zeroGpuDurationSecondsPerBatch,120);
assert.equal(seal.runtimeTransport.statusEndpoint,'multivariate_context_status');
assert.equal(seal.runtimeTransport.changesModelInputs,false);
assert.equal(seal.runtimeTransport.changesForecastRule,false);
assert.equal(seal.runtimeTransport.changesEvaluationRule,false);
assert.equal(seal.historicalExecution.historicalYahooDataAccessed,true);
assert.equal(seal.historicalExecution.historicalForecastsReturned,false);
assert.equal(seal.historicalExecution.historicalMetricsEvaluated,false);
assert.equal(seal.historicalExecution.freshSampleOpened,false);
assert.equal(seal.historicalExecution.freshOutcomesOpened,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

const routes=fs.readFileSync(path.resolve(root,'server/researchValidationRoutes.ts'),'utf8');
const start=routes.indexOf("id: 'timesfm-multivariate-context-v1'");
const end=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'",start);
assert.ok(start>=0&&end>start,'TimesFM multivariate V1 job missing');
const block=routes.slice(start,end);
assert.match(block,/visibility: 'CURRENT'/);
assert.match(block,/requiresTimesFmRunner: true/);
assert.ok(block.indexOf('tests/timesfmMultivariateContextV1Seal.unit.mjs')<block.indexOf('scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'));
assert.ok(block.indexOf('tests/timesfmMultivariateContextV1.unit.mjs')<block.indexOf('scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'));
assert.ok(block.indexOf('tests/timesfmMultivariateContextV1Contract.unit.mjs')<block.indexOf('scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'));
assert.ok(block.indexOf("npm', args: ['run', 'lint']")<block.indexOf('scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'));

const directStart=routes.indexOf("id: 'timesfm-direct-selector-historical-diagnostic-v1'");
const directEnd=routes.indexOf("id: 'timesfm-multivariate-context-v1'",directStart);
const direct=routes.slice(directStart,directEnd);
assert.match(direct,/visibility: 'ARCHIVED'/);
assert.match(direct,/BEATS_NEITHER/);

console.log('timesfmMultivariateContextV1Seal.unit: PASS');
