import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SEAL_PATH='validation-runs/preregistration/pead-earnings-source-audit-v1-seal.json';

function gitBlobSha(text){
  const normalized=text.replace(/\r\n/g,'\n');
  const bytes=Buffer.from(normalized,'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal=JSON.parse(fs.readFileSync(SEAL_PATH,'utf8'));
assert.equal(seal.study,'PEAD_EARNINGS_SOURCE_AUDIT_V1');
assert.equal(seal.sourceWindow?.from,'2024-01-15');
assert.equal(seal.sourceWindow?.to,'2024-03-15');
assert.equal(seal.outcomes?.priceOutcomesFetched,false);
assert.equal(seal.outcomes?.economicOutcomesOpened,false);
assert.equal(seal.outcomes?.signalThresholdFrozen,false);
assert.equal(seal.outcomes?.economicPolicyFrozen,false);
assert.equal(seal.authority?.productionDefault,'LEGACY');
assert.equal(seal.authority?.productionAuthority,false);
assert.equal(seal.authority?.promotionAllowed,false);

for(const [file,expected] of Object.entries(seal.gitBlobSha??{})){
  const full=path.resolve(process.cwd(),file);
  assert.equal(fs.existsSync(full),true,`PEAD_SEAL_FILE_MISSING:${file}`);
  const actual=gitBlobSha(fs.readFileSync(full,'utf8'));
  assert.equal(actual,expected,`PEAD_SEAL_MISMATCH:${file}:${expected}:${actual}`);
}

const script=fs.readFileSync(path.resolve(process.cwd(),'scripts/peadEarningsSourceAuditV1.mjs'),'utf8');
assert.match(script,/\/api\/fundamentals\//);
assert.match(script,/filter=HistoricalTickerComponents/);
assert.match(script,/economicOutcomesOpened:false/);
assert.match(script,/priceOutcomesFetched:false/);
assert.match(script,/productionDefault:'LEGACY'/);

const routes=fs.readFileSync(path.resolve(process.cwd(),'server/researchValidationRoutes.ts'),'utf8');
const current=(routes.match(/visibility: 'CURRENT'/g)??[]).length;
assert.ok(current<=1);
const peadStart=routes.indexOf("id: 'pead-earnings-source-audit-v1'");
assert.ok(peadStart>=0);
const peadEnd=routes.indexOf("archivedJob(",peadStart);
const peadBlock=routes.slice(peadStart,peadEnd>peadStart?peadEnd:undefined);
assert.match(peadBlock,/visibility: 'PARKED'/);
assert.match(peadBlock,/requiresEodhdApiKey: true/);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_V1_SEAL_PASS');
