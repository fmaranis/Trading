import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SEAL='validation-runs/preregistration/pead-yahoo-calendar-source-audit-r2-seal.json';

function gitBlobSha(text){
  const normalized=text.replace(/\r\n/g,'\n');
  const bytes=Buffer.from(normalized,'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal=JSON.parse(fs.readFileSync(SEAL,'utf8'));
assert.equal(seal.study,'PEAD_EARNINGS_SOURCE_AUDIT_R2');
assert.equal(seal.sourceRevision,'YAHOO_CALENDAR_RANGE_DUAL_PIT_R2');
assert.equal(seal.window?.from,'2024-01-15');
assert.equal(seal.window?.to,'2024-03-15');
assert.equal(seal.gates?.minimumPitEvents,450);
assert.equal(seal.gates?.minimumCausalEligible,440);
assert.equal(seal.gates?.minimumKnownTimingPct,95);
assert.equal(seal.gates?.minimumActualEstimatePct,95);
assert.equal(seal.gates?.minimumR1OverlapPct,95);
assert.equal(seal.outcomes?.priceOutcomesFetched,false);
assert.equal(seal.outcomes?.economicOutcomesOpened,false);
assert.equal(seal.authority?.productionDefault,'LEGACY');
assert.equal(seal.authority?.productionAuthority,false);
assert.equal(seal.authority?.promotionAllowed,false);

for(const [file,expected] of Object.entries(seal.gitBlobSha??{})){
  const full=path.resolve(process.cwd(),file);
  assert.equal(fs.existsSync(full),true,`PEAD_R2_SEAL_FILE_MISSING:${file}`);
  const actual=gitBlobSha(fs.readFileSync(full,'utf8'));
  assert.equal(actual,expected,`PEAD_R2_SEAL_MISMATCH:${file}:${expected}:${actual}`);
}

const runner=fs.readFileSync('scripts/peadYahooCalendarSourceAuditR2.mjs','utf8');
assert.match(runner,/YAHOO_CALENDAR_RANGE_DUAL_PIT_R2/);
assert.match(runner,/filterMostActive:false/);
assert.match(runner,/currentTickerSeed:false/);
assert.match(runner,/sortField:'startdatetime'/);
assert.match(runner,/minimumR1OverlapPct:95/);
assert.match(runner,/economicOutcomesOpened:false/);
assert.match(runner,/priceOutcomesFetched:false/);
assert.doesNotMatch(runner,/ITOT/);

const signal=fs.readFileSync('scripts/peadSignalDiagnosticV1.mjs','utf8');
assert.match(signal,/PEAD_EARNINGS_SOURCE_AUDIT_R2/);
assert.match(signal,/YAHOO_CALENDAR_RANGE_DUAL_PIT_R2/);
assert.match(signal,/PEAD_SIGNAL_R2_SOURCE_RESULT_MISSING/);
assert.doesNotMatch(signal,/pead-earnings-source-audit-v1-result\.json/);
assert.doesNotMatch(signal,/SOURCE_PINS/);

const routes=fs.readFileSync('server/researchValidationRoutes.ts','utf8');
const r2Start=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r2'");
assert.ok(r2Start>=0);
const signalStart=routes.indexOf("id: 'pead-analyst-surprise-v1'",r2Start);
const r2Block=routes.slice(r2Start,signalStart);
assert.match(r2Block,/visibility: 'PARKED'/);
assert.match(r2Block,/Guard seal PEAD R2/);
const signalBlock=routes.slice(signalStart,routes.indexOf("archivedJob(",signalStart));
assert.match(signalBlock,/visibility: 'PARKED'/);
assert.match(signalBlock,/Guard fuente PEAD R2/);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_R2_SEAL_PASS');
