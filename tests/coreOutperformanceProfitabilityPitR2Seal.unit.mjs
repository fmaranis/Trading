import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const seal=JSON.parse(fs.readFileSync('validation-runs/preregistration/core-outperformance-profitability-pit-r2-seal.json','utf8'));
function gitBlobSha(text){
  const normalized=text.replace(/\r\n/g,'\n');
  const body=Buffer.from(normalized,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body])).digest('hex');
}

assert.equal(seal.version,'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_SEAL');
assert.equal(seal.sealRevision,3);
assert.equal(seal.previousSealRevision,2);
assert.equal(seal.preOutcomeTechnicalReseal.stockOutcomesOpened,false);
assert.equal(seal.preOutcomeTechnicalReseal.methodologyChanged,false);
assert.equal(seal.preOutcomeTechnicalReseal.coverageGatesChanged,false);
assert.equal(seal.preOutcomeStatusSemantics.stockOutcomesOpened,false);
assert.equal(seal.preOutcomeStatusSemantics.methodologyChanged,false);
assert.equal(seal.preOutcomeStatusSemantics.coverageGatesChanged,false);
assert.equal(seal.supersedesPreOutcome,'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1');
assert.equal(seal.v1Disposition,'INCONCLUSIVE_COVERAGE_PRE_OUTCOME_114_LT_250');
assert.equal(seal.stockOutcomesOpened,false);
assert.equal(seal.methodologyChangeScope,'MISSING_EXPENSE_TRANSLATION_ONLY');
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);
assert.equal(seal.preserved.coverageGates,true);
assert.equal(seal.preserved.formula,true);

for(const [path,expected] of Object.entries(seal.expectedGitBlobSha)){
  assert.equal(fs.existsSync(path),true,`missing sealed file ${path}`);
  assert.equal(gitBlobSha(fs.readFileSync(path,'utf8')),expected,`seal mismatch ${path}`);
}

console.log('coreOutperformanceProfitabilityPitR2Seal.unit: PASS');
