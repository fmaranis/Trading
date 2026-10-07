import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const seal=JSON.parse(fs.readFileSync('validation-runs/preregistration/kronos-stage-a-smoke-v1-seal.json','utf8'));
function gitBlobSha(text){
  const normalized=text.replace(/\r\n/g,'\n');
  const bytes=Buffer.from(normalized,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
}

assert.equal(seal.study,'KRONOS_STAGE_A_SMOKE_V1');
assert.equal(seal.sealRevision,7);
assert.equal(seal.previousSealRevision,6);
assert.equal(seal.technicalReseal.marketPricesFetched,false);
assert.equal(seal.technicalReseal.methodologyChanged,false);
assert.equal(seal.technicalReseal.runtimeOnly,true);
assert.equal(seal.technicalReseal.guardOnly,true);
assert.equal(seal.protocol,'KRONOS_MARKET_CONTEXT_V1');
assert.equal(seal.source.repository,'shiyu-coder/Kronos');
assert.equal(seal.source.license,'MIT');
assert.equal(seal.model.repoId,'NeoQuasar/Kronos-small');
assert.equal(seal.smoke.dataProvenance,'SYNTHETIC');
assert.equal(seal.smoke.individualPathsPreserved,true);
assert.equal(seal.pretrainingCutoff.known,false);
assert.equal(seal.pretrainingCutoff.historicalPromotionAllowed,false);
assert.equal(seal.outcomes.marketPricesFetched,false);
assert.equal(seal.outcomes.marketOutcomesOpened,false);
assert.equal(seal.outcomes.economicPolicyOpened,false);
assert.equal(seal.authority.productionDefault,'LEGACY');
assert.equal(seal.authority.productionAuthority,false);

for(const [path,expected] of Object.entries(seal.expectedGitBlobSha)){
  assert.equal(fs.existsSync(path),true,`missing sealed file ${path}`);
  assert.equal(gitBlobSha(fs.readFileSync(path,'utf8')),expected,`Kronos seal mismatch: ${path}`);
}

console.log('kronosStageASeal.unit: PASS');
