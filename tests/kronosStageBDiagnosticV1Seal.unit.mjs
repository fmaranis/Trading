import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
const seal=JSON.parse(fs.readFileSync('validation-runs/preregistration/kronos-stage-b-diagnostic-v1-seal.json','utf8'));
function sha(text){const b=Buffer.from(text.replace(/\r\n/g,'\n'),'utf8');return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');}
assert.equal(seal.study,'KRONOS_STAGE_B_DIAGNOSTIC_V1');
assert.equal(seal.sealRevision,3);
assert.equal(seal.previousSealRevision,2);
assert.equal(seal.technicalReseal.guardOnly,true);
assert.equal(seal.technicalReseal.methodologyChanged,false);
assert.equal(seal.technicalReseal.resourceOnly,true);
assert.equal(seal.technicalReseal.finalKronosMetricsObservedBeforeChange,false);
assert.equal(seal.status,'FROZEN_PRE_RUN_DIAGNOSTIC_ONLY');
assert.equal(seal.stageADisposition,'PASS_STAGE_A_TECHNICAL_SMOKE');
assert.equal(seal.sample.alreadyConsumed,true);
assert.equal(seal.sample.expectedAnchors,31);
assert.equal(seal.sample.expectedMaximumCases,248);
assert.equal(seal.model.contextLength,512);
assert.equal(seal.model.forecastHorizon,60);
assert.equal(seal.model.pathsPerAssetAnchor,20);
assert.deepEqual(seal.primaryHorizons,[20,60]);
assert.equal(seal.pretrainingCutoffKnown,false);
assert.equal(seal.historicalPromotionAllowed,false);
assert.equal(seal.authority.productionDefault,'LEGACY');
assert.equal(seal.authority.productionAuthority,false);
for(const [p,e] of Object.entries(seal.expectedGitBlobSha)){
  assert.equal(fs.existsSync(p),true,`missing ${p}`);
  assert.equal(sha(fs.readFileSync(p,'utf8')),e,`KRONOS_STAGE_B_SEAL_MISMATCH:${p}`);
}
console.log('kronosStageBDiagnosticV1Seal.unit: PASS');
