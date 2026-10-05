import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-allocation-bridge-posthoc-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1_SEAL');
assert.equal(seal.role,'POSTHOC_ARCHITECTURE_DIAGNOSTIC_ONLY');
assert.equal(seal.lineage.stageBSignal,'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION');
assert.equal(seal.lineage.relativeRankV1Economic,'NO_ECONOMIC_REACH');
assert.equal(seal.lineage.sameHistoricalSampleConsumed,true);
assert.equal(seal.bridgeOutcomesOpened,false);
assert.equal(seal.intervention.policy,'TIMESFM_ALLOCATION_BRIDGE_V1');
assert.equal(seal.intervention.queueOrderOnly,true);
assert.equal(seal.intervention.sizingFormula,'LEGACY_UNCHANGED');
assert.equal(seal.intervention.gateAuthority,false);
assert.equal(seal.intervention.cashAuthority,false);
assert.equal(seal.intervention.sizingAuthority,false);
assert.equal(seal.intervention.capAuthority,false);
assert.equal(seal.intervention.timingAuthority,false);
assert.equal(seal.matrix.scenarios,15);
assert.deepEqual(seal.matrix.capitals,[250,500,2500,10000,30000]);
assert.deepEqual(seal.matrix.riskProfiles,['LOW','MEDIUM','HIGH']);
assert.equal(seal.matrix.architecture,'CORE_ARCHITECTURE_V1');
assert.equal(seal.matrix.execution,'NEXT_OPEN');
assert.equal(seal.promotionAuthority,false);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

console.log('timesfmAllocationBridgePosthocV1Seal.unit: PASS');
