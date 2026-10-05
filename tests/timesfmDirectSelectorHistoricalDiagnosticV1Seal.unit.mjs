import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-direct-selector-historical-diagnostic-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1_SEAL');
assert.equal(seal.lineage.stageBSignal,'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION');
assert.equal(seal.lineage.relativeRankV1,'NO_ECONOMIC_REACH');
assert.equal(seal.lineage.allocationBridgeV1,'POSTHOC_NO_REACH');
assert.equal(seal.lineage.historicalSampleConsumed,true);
assert.equal(seal.selector.version,'TIMESFM_DIRECT_SELECTOR_V1');
assert.equal(seal.selector.pool,'8_STAGE_B_ASSETS_PLUS_EUNL_CORE');
assert.deepEqual(seal.selector.horizons,[20,60]);
assert.equal(seal.selector.legacyScoreAuthority,false);
assert.equal(seal.selector.consensusAuthority,false);
assert.equal(seal.selector.timingAuthority,false);
assert.equal(seal.replay.execution,'NEXT_OPEN');
assert.equal(seal.comparison.informationDates,31);
assert.equal(seal.comparison.scenarios,15);
assert.equal(seal.outcomesOpened,false);
assert.equal(seal.promotionAuthority,false);
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

console.log('timesfmDirectSelectorHistoricalDiagnosticV1Seal.unit: PASS');
