import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-relative-rank-economic-diagnostic-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1_SEAL');
assert.equal(seal.stageBHistoricalSample,'CONSUMED');
assert.equal(seal.stageBObservedResult,'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION');
assert.equal(seal.economicOutcomesOpened,false);
assert.equal(seal.protocol.scenarios,15);
assert.deepEqual(seal.protocol.capitals,[250,500,2500,10000,30000]);
assert.deepEqual(seal.protocol.riskProfiles,['LOW','MEDIUM','HIGH']);
assert.equal(seal.protocol.decisionDates,'EXACT_STAGE_B_INFORMATION_DATES');
assert.equal(seal.protocol.baseline,'CORE_ARCHITECTURE_V1 + LEGACY_SELECTION');
assert.equal(seal.protocol.candidate,'CORE_ARCHITECTURE_V1 + TIMESFM_RELATIVE_RANK_V1');
assert.equal(seal.protocol.allocation,'LEGACY');
assert.equal(seal.interpretation.diagnosticOnly,true);
assert.equal(seal.interpretation.promotionAuthority,false);
assert.equal(seal.interpretation.prospectiveConfirmationStillRequired,true);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

console.log('timesfmRelativeRankEconomicDiagnosticV1Seal.unit: PASS');
