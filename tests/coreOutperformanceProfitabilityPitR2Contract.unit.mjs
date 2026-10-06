import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner=fs.readFileSync('scripts/coreOutperformanceProfitabilityPitR2Live.mjs','utf8');
const protocol=fs.readFileSync('scripts/coreOutperformanceProfitabilityPitR2Protocol.mjs','utf8');

assert.match(runner,/CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_RESULT/);
assert.match(runner,/observed\.length===0/);
assert.match(runner,/\(cg\?\.value\?\?0\)/);
assert.match(runner,/\(sg\?\.value\?\?0\)/);
assert.match(runner,/\(it\?\.value\?\?0\)/);
assert.match(runner,/expenseObserved/);
assert.match(runner,/missingExpenseImputedZero/);
assert.match(runner,/outcomeAccessed:false/);
assert.doesNotMatch(runner,/OperatingIncomeLoss/);
assert.doesNotMatch(protocol,/minimumEvaluable:\s*(?:1\d\d|2[0-4]\d)/);
assert.match(protocol,/minimumEvaluable:\s*250/);
assert.match(protocol,/noOperatingIncomeFallback:\s*true/);
assert.match(protocol,/productionDefault:\s*'LEGACY'/);
assert.match(protocol,/productionAuthority:\s*false/);

console.log('coreOutperformanceProfitabilityPitR2Contract.unit: PASS');
