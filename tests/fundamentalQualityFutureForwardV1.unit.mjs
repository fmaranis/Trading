import assert from 'node:assert/strict';
import {
  FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1 as P,
  quantileLinear,winsorize,populationZ,qualityScoreFromZ,capWeights
} from '../scripts/fundamentalQualityFutureForwardV1Protocol.mjs';

assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);
assert.equal(P.selectedCount,100);
assert.equal(P.issuerCap,0.05);
assert.equal(quantileLinear([0,10],0.25),2.5);
assert.deepEqual(winsorize([0,1,2,100],0.25,0.75).values,[0.75,1,2,26.5]);
const z=populationZ([1,2,3]);
assert.ok(Math.abs(z.mean-2)<1e-12);
assert.ok(Math.abs(z.sd-Math.sqrt(2/3))<1e-12);
assert.equal(qualityScoreFromZ(1),2);
assert.equal(qualityScoreFromZ(-1),0.5);

const rows=Array.from({length:25},(_,i)=>({ticker:`T${i}`,issuerKey:`I${i}`,rawWeight:i===0?100:1}));
const capped=capWeights(rows,0.05);
assert.ok(capped.every(r=>r.weight<=0.0500000001));
assert.ok(Math.abs(capped.reduce((s,r)=>s+r.weight,0)-1)<1e-10);

const dual=capWeights([
  {ticker:'GOOG',issuerKey:'ALPHABET',rawWeight:40},
  {ticker:'GOOGL',issuerKey:'ALPHABET',rawWeight:30},
  ...Array.from({length:25},(_,i)=>({ticker:`X${i}`,issuerKey:`X${i}`,rawWeight:10}))
],0.05);
const alphabetWeight=dual.filter(r=>r.issuerKey==='ALPHABET').reduce((s,r)=>s+r.weight,0);
assert.ok(alphabetWeight<=0.0500000001);

console.log('FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1_UNIT_PASS');
