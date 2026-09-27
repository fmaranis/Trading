import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1 as P,
  reconstructHistoricalMembers,
  selectTopDecile,
  topDecileCount,
  yahooTicker
} from '../scripts/coreOutperformanceProfitabilityPitV1Protocol.mjs';

assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);
assert.equal(P.researchOnly,true);
assert.equal(P.anchors.length,6);
assert.equal(P.stageC1Gate.requiredPeriods,5);
assert.equal(P.fundamentals.noOperatingIncomeFallback,true);
assert.equal(topDecileCount(250),25);
assert.equal(topDecileCount(251),26);
assert.equal(yahooTicker('BRK.B'),'BRK-B');
assert.equal(yahooTicker('BRKB'),'BRK-B');
assert.equal(yahooTicker('BF.B'),'BF-B');

const rows=Array.from({length:21},(_,i)=>({ticker:`T${String(i).padStart(2,'0')}`,operatingProfitability:i===19?20:i}));
const selected=selectTopDecile(rows);
assert.equal(selected.length,3);
assert.deepEqual(selected.map(x=>x.ticker),['T19','T20','T18']);

const members=reconstructHistoricalMembers(['A','B','C'],[
  {date:'2020-01-02',added:['D'],removed:['B']},
  {date:'2021-01-02',added:['E'],removed:['C']}
],'2019-12-31');
assert.deepEqual(members,['A','B','C']);

const seal=JSON.parse(readFileSync('validation-runs/preregistration/core-outperformance-profitability-pit-v1-seal.json','utf8'));
assert.equal(seal.version,'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1_SEAL');
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);
function gitBlobSha(text){const normalized=text.replace(/\r\n/g,'\n');const bytes=Buffer.from(normalized,'utf8');return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}
for(const [path,expected] of Object.entries(seal.expectedGitBlobSha)){
  assert.equal(gitBlobSha(readFileSync(path,'utf8')),expected,`seal mismatch ${path}`);
}
console.log('CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1_UNIT_PASS');
