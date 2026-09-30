import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SEAL_PATH='validation-runs/preregistration/pead-signal-diagnostic-v1-seal.json';

function gitBlobSha(text){
  const bytes=Buffer.from(text.replace(/\r\n/g,'\n'),'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal=JSON.parse(fs.readFileSync(SEAL_PATH,'utf8'));
assert.equal(seal.study,'PEAD_ANALYST_SURPRISE_V1');
assert.equal(seal.sourceStudy,'PEAD_EARNINGS_SOURCE_AUDIT_V1');
assert.equal(seal.sourceRevision,'YAHOO_STATIC_DUAL_PIT_R1');
assert.equal(seal.signal?.predictor,'Yahoo Surprise(%)');
assert.equal(seal.signal?.horizonSessions,60);
assert.equal(seal.signal?.benchmark,'SPY');
assert.equal(seal.signal?.minimumPriceCoverage,415);
assert.equal(seal.signal?.permutationIterations,2000);
assert.equal(seal.signal?.permutationSeed,20260929);
assert.equal(seal.signal?.maximumOneSidedPValue,0.05);
assert.equal(seal.outcomes?.priceOutcomesOpened,false);
assert.equal(seal.outcomes?.economicPolicyOpened,false);
assert.equal(seal.authority?.productionDefault,'LEGACY');
assert.equal(seal.authority?.productionAuthority,false);
assert.equal(seal.authority?.promotionAllowed,false);

for(const [file,expected] of Object.entries(seal.gitBlobSha??{})){
  const full=path.resolve(process.cwd(),file);
  assert.equal(fs.existsSync(full),true,`PEAD_SIGNAL_SEAL_FILE_MISSING:${file}`);
  const actual=gitBlobSha(fs.readFileSync(full,'utf8'));
  assert.equal(actual,expected,`PEAD_SIGNAL_SEAL_MISMATCH:${file}:${expected}:${actual}`);
}

const source=JSON.parse(fs.readFileSync('validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json','utf8'));
assert.equal(source.status,'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION');
assert.equal(source.provenance,'STATIC_REFERENCE');
assert.equal(source.priceOutcomesFetched,false);

const runner=fs.readFileSync('scripts/peadSignalDiagnosticV1.mjs','utf8');
assert.match(runner,/horizonSessions:60/);
assert.match(runner,/minimumPriceCoverage:415/);
assert.match(runner,/permutationIterations:2000/);
assert.match(runner,/permutationSeed:20260929/);
assert.match(runner,/maximumOneSidedPValue:0\.05/);
assert.match(runner,/ONE_SIDED_WITHIN_REPORT_WEEK_PERMUTATION/);
assert.match(runner,/benchmark:'SPY'/);
assert.match(runner,/AfterMarket:'NEXT_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE'/);
assert.match(runner,/PASS_SIGNAL_DIAGNOSTIC_CANDIDATE_FOR_FRESH_CONFIRMATION/);
assert.match(runner,/FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY/);
assert.doesNotMatch(runner,/horizonSessions:(?:5|10|20|40|90|120)/);

const routes=fs.readFileSync('server/researchValidationRoutes.ts','utf8');
const start=routes.indexOf("id: 'pead-analyst-surprise-v1'");
assert.ok(start>=0);
const end=routes.indexOf("archivedJob(",start);
const block=routes.slice(start,end>start?end:undefined);
assert.match(block,/visibility: 'PARKED'/);
assert.match(block,/Yahoo REAL · diagnóstico PEAD 60 sesiones/);

console.log('PEAD_ANALYST_SURPRISE_V1_SEAL_PASS');
