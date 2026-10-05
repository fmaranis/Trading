import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sealPath=path.resolve(root,'validation-runs/preregistration/timesfm-stage-b-predictive-benchmark-v1-seal.json');
const seal=JSON.parse(fs.readFileSync(sealPath,'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.study,'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1');
assert.equal(seal.sealedBeforeEconomicOutcomes,true);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);
assert.equal(seal.prospectiveConfirmation?.noRetuneAfterDiagnostic,true);
assert.ok(seal.blobs && typeof seal.blobs==='object');

for(const [relative,expected] of Object.entries(seal.blobs)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  const actual=gitBlobSha(fs.readFileSync(absolute,'utf8'));
  assert.equal(actual,expected,`Sealed blob changed: ${relative}`);
}

console.log('timesfmStageBSeal.unit: PASS');
