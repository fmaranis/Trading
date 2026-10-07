import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SEAL='validation-runs/preregistration/pead-yahoo-calendar-source-audit-r3-seal.json';

function gitBlobSha(text){
  const normalized=text.replace(/\r\n/g,'\n');
  const bytes=Buffer.from(normalized,'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const seal=JSON.parse(fs.readFileSync(SEAL,'utf8'));
assert.equal(seal.study,'PEAD_EARNINGS_SOURCE_AUDIT_R3');
assert.equal(seal.sealRevision,6);
assert.equal(seal.previousSealRevision,5);
assert.equal(seal.technicalReseal?.priceOutcomesOpened,false);
assert.equal(seal.technicalReseal?.methodologyChanged,false);
assert.equal(seal.sourceRevision,'YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION');
assert.equal(seal.window?.from,'2024-01-15');
assert.equal(seal.window?.to,'2024-03-15');
assert.equal(seal.gates?.minimumPitEvents,450);
assert.equal(seal.gates?.minimumActualEstimatePct,95);
assert.equal(seal.gates?.minimumSurprisePct,95);
assert.equal(seal.gates?.minimumCausalEligible,440);
assert.equal(seal.gates?.minimumR1OverlapPct,95);
assert.equal(seal.execution?.entry,'FIRST_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE');
assert.equal(seal.execution?.announcementDayReturnIncluded,false);
assert.equal(seal.execution?.timingInferenceAllowed,false);
assert.equal(seal.outcomes?.priceOutcomesFetched,false);
assert.equal(seal.outcomes?.economicOutcomesOpened,false);
assert.equal(seal.authority?.productionDefault,'LEGACY');
assert.equal(seal.authority?.productionAuthority,false);
assert.equal(seal.authority?.promotionAllowed,false);
assert.equal(seal.runtimeVerification?.liveYahooCalendarAudit,'PASS');
assert.equal(seal.runtimeVerification?.liveCausalEligible,470);

for(const [file,expected] of Object.entries(seal.gitBlobSha??{})){
  const full=path.resolve(process.cwd(),file);
  assert.equal(fs.existsSync(full),true,`PEAD_R3_SEAL_FILE_MISSING:${file}`);
  const actual=gitBlobSha(fs.readFileSync(full,'utf8'));
  assert.equal(actual,expected,`PEAD_R3_SEAL_MISMATCH:${file}:${expected}:${actual}`);
}

const runner=fs.readFileSync('scripts/peadYahooCalendarSourceAuditR3.mjs','utf8');
assert.match(runner,/YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION/);
assert.match(runner,/FIRST_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE/);
assert.match(runner,/DIAGNOSTIC_ONLY_NOT_A_GATE/);
assert.doesNotMatch(runner,/minimumKnownTimingPct/);
assert.match(runner,/economicOutcomesOpened:false/);
assert.match(runner,/priceOutcomesFetched:false/);

const signal=fs.readFileSync('scripts/peadSignalDiagnosticV1.mjs','utf8');
assert.match(signal,/PEAD_EARNINGS_SOURCE_AUDIT_R3/);
assert.match(signal,/YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION/);
assert.match(signal,/PEAD_SIGNAL_R3_SOURCE_RESULT_MISSING/);
assert.match(signal,/bar\.date>event\.reportDate/);
assert.doesNotMatch(signal,/BeforeMarket:'SAME_DATE/);
assert.doesNotMatch(signal,/pead-yahoo-calendar-source-audit-r2-result\.json/);

const routes=fs.readFileSync('server/researchValidationRoutes.ts','utf8');
const r3Start=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'");
assert.ok(r3Start>=0);
const signalStart=routes.indexOf("id: 'pead-analyst-surprise-v1'",r3Start);
const r3Block=routes.slice(r3Start,signalStart);
assert.match(r3Block,/visibility: 'CURRENT'/);
assert.match(r3Block,/Guard seal PEAD R3/);
const signalBlock=routes.slice(signalStart,routes.indexOf("archivedJob(",signalStart));
assert.match(signalBlock,/visibility: 'PARKED'/);
assert.match(signalBlock,/Guard fuente PEAD R3/);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_R3_SEAL_PASS');
