import assert from 'node:assert/strict';
import { auditStaticSources, SOURCE_PINS } from '../scripts/peadEarningsSourceAuditV1.mjs';

function fjaCsv(count){
  return ['ticker,start_date,end_date',...Array.from({length:count},(_,i)=>'T'+i+',2020-01-01,')].join('\n')+'\n';
}
function lawcalCsv(count){
  return ['symbol,cik,name,sector,date_added,date_removed,created_at',...Array.from({length:count},(_,i)=>'T'+i+',0000000000,T'+i+',industrials,2020-01-01,,2020-01-01')].join('\n')+'\n';
}
function earningsCsv(count){
  const rows=['Earnings Date,earnings_datetime_utc,earnings_date,ticker,EPS Estimate,Reported EPS,Surprise(%),days_since'];
  for(let i=0;i<count;i++){
    const after=i%2===1;
    rows.push([
      after?'2024-02-01 16:00:00-05:00':'2024-02-01 08:00:00-05:00',
      after?'2024-02-01 21:00:00+00:00':'2024-02-01 13:00:00+00:00',
      '2024-02-01','T'+i,'1.00','1.20','20.0','90'
    ].join(','));
  }
  return rows.join('\n')+'\n';
}

const pass=auditStaticSources(fjaCsv(250),lawcalCsv(250),earningsCsv(220));
assert.equal(pass.passed,true);
assert.equal(pass.counts.pitEvents,220);
assert.equal(pass.counts.knownTiming,220);
assert.equal(pass.counts.actualEstimate,220);
assert.equal(pass.counts.causalEligible,220);
assert.equal(pass.quality.duplicateCount,0);
assert.equal(pass.quality.directionalContradictionCount,0);

const fail=auditStaticSources(fjaCsv(250),lawcalCsv(250),earningsCsv(100));
assert.equal(fail.passed,false);
assert.equal(fail.gates.pitEvents,false);
assert.equal(fail.gates.causalEligible,false);

assert.ok(SOURCE_PINS.earnings.commit.length===40);
assert.ok(SOURCE_PINS.pitFja.commit.length===40);
assert.ok(SOURCE_PINS.pitLawcal.commit.length===40);
assert.ok(SOURCE_PINS.earnings.blobSha.length===40);
assert.ok(SOURCE_PINS.pitFja.blobSha.length===40);
assert.ok(SOURCE_PINS.pitLawcal.blobSha.length===40);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_V1_INTEGRATION_PASS');
