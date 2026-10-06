import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner=fs.readFileSync('scripts/coreOutperformanceProfitabilityPitR2Live.mjs','utf8');
const protocol=fs.readFileSync('scripts/coreOutperformanceProfitabilityPitR2Protocol.mjs','utf8');

assert.match(runner,/CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_RESULT/);
assert.match(runner,/INCONCLUSIVE_COVERAGE/);
assert.match(runner,/BLOCKED_DATA_ACCESS/);
assert.match(runner,/if\(!inconclusive\) process\.exitCode=1/);
assert.match(runner,/observed\.length===0/);
assert.match(runner,/\(cg\?\.value\?\?0\)/);
assert.match(runner,/\(sg\?\.value\?\?0\)/);
assert.match(runner,/\(it\?\.value\?\?0\)/);
assert.match(runner,/expenseObserved/);
assert.match(runner,/missingExpenseImputedZero/);
assert.match(runner,/outcomeAccessed:false/);
assert.match(runner,/const byEnd=new Map\(\)/);
assert.match(runner,/candidate\.tagPriority<prev\.tagPriority/);
assert.doesNotMatch(runner,/series\.length>best\.length/);
assert.match(protocol,/equivalentTagResolution:\s*'UNION_BY_FISCAL_END_LATEST_FILED_THEN_TAG_PRIORITY'/);
assert.doesNotMatch(runner,/OperatingIncomeLoss/);
assert.doesNotMatch(protocol,/minimumEvaluable:\s*(?:1\d\d|2[0-4]\d)/);
assert.match(protocol,/minimumEvaluable:\s*250/);
assert.match(protocol,/noOperatingIncomeFallback:\s*true/);
assert.match(protocol,/productionDefault:\s*'LEGACY'/);
assert.match(protocol,/productionAuthority:\s*false/);

console.log('coreOutperformanceProfitabilityPitR2Contract.unit: PASS');
