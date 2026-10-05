import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-stage-b-prospective-confirmation-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1_SEAL');
assert.equal(seal.historicalDiagnostic.observedResult,'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION');
assert.equal(seal.historicalDiagnostic.consumed,true);
assert.equal(seal.prospective.sampleOpened,false);
assert.equal(seal.prospective.marketAccessed,false);
assert.equal(seal.prospective.outcomesOpened,false);
assert.equal(seal.prospective.noHistoricalCatchUp,true);
assert.equal(seal.prospective.noRetroactiveForecastAfterMissedAnchor,true);
assert.equal(seal.prospective.minimumMaturedAnchors,26);
assert.equal(seal.prospective.noRetuneAfterDiagnostic,true);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

const routes=fs.readFileSync(path.resolve(root,'server/researchValidationRoutes.ts'),'utf8');
const start=routes.indexOf("id: 'timesfm-stage-b-prospective-confirmation-v1'");
const end=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'",start);
assert.ok(start>=0 && end>start,'Prospective job missing');
const block=routes.slice(start,end);
assert.match(block,/visibility: 'CURRENT'/);
assert.match(block,/requiresTimesFmRunner: true/);
assert.match(block,/requiresGithubReplayToken: true/);
assert.ok(block.indexOf('tests/timesfmStageBProspectiveSeal.unit.mjs') < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));
assert.ok(block.indexOf("npm', args: ['run', 'lint']") < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));

const historicalStart=routes.indexOf("id: 'timesfm-stage-b-predictive-benchmark-v1'");
const historicalEnd=routes.indexOf("id: 'timesfm-stage-b-prospective-confirmation-v1'",historicalStart);
const historical=routes.slice(historicalStart,historicalEnd);
assert.match(historical,/visibility: 'ARCHIVED'/);
assert.match(historical,/PASS diagnóstico señal/);

console.log('timesfmStageBProspectiveSeal.unit: PASS');
