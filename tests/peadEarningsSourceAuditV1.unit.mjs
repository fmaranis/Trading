import assert from 'node:assert/strict';
import {
  PEAD_SOURCE_AUDIT_V1,
  SOURCE_PINS,
  tickerKey,
  parseCsvLine,
  normalizeFjaPit,
  normalizeLawcalPit,
  normalizeYahooEarnings,
  activeFja,
  activeLawcal,
  classifyYahooTiming,
  auditStaticSources
} from '../scripts/peadEarningsSourceAuditV1.mjs';

assert.equal(tickerKey('BRK.B'),'BRK-B');
assert.equal(tickerKey('BRK/B'),'BRK-B');
assert.deepEqual(parseCsvLine('A,"B,C","D""E"'),['A','B,C','D"E']);

assert.equal(classifyYahooTiming('2024-02-01 09:29:59-05:00'),'BeforeMarket');
assert.equal(classifyYahooTiming('2024-02-01 09:30:00-05:00'),'DuringMarket');
assert.equal(classifyYahooTiming('2024-02-01 15:59:59-05:00'),'DuringMarket');
assert.equal(classifyYahooTiming('2024-02-01 16:00:00-05:00'),'AfterMarket');
assert.equal(classifyYahooTiming('bad'),'UNKNOWN');

function fjaCsv(count=250){
  const rows=['ticker,start_date,end_date'];
  for(let i=0;i<count;i++)rows.push('T'+i+',2020-01-01,');
  return rows.join('\n')+'\n';
}
function lawcalCsv(count=250){
  const rows=['symbol,cik,name,sector,date_added,date_removed,created_at'];
  for(let i=0;i<count;i++)rows.push('T'+i+',0000000000,T'+i+',industrials,2020-01-01,,2020-01-01');
  return rows.join('\n')+'\n';
}
function earningsCsv(count=220){
  const rows=['Earnings Date,earnings_datetime_utc,earnings_date,ticker,EPS Estimate,Reported EPS,Surprise(%),days_since'];
  for(let i=0;i<count;i++){
    const local=i%2?'2024-02-01 16:00:00-05:00':'2024-02-01 08:00:00-05:00';
    const utc=i%2?'2024-02-01 21:00:00+00:00':'2024-02-01 13:00:00+00:00';
    rows.push([local,utc,'2024-02-01','T'+i,'1.00','1.20','20.0','90'].join(','));
  }
  return rows.join('\n')+'\n';
}

const fja=normalizeFjaPit(fjaCsv());
const lawcal=normalizeLawcalPit(lawcalCsv());
const earnings=normalizeYahooEarnings(earningsCsv());
assert.equal(fja.length,250);
assert.equal(lawcal.length,250);
assert.equal(earnings.length,220);
assert.equal(activeFja(fja,'T0','2024-02-01'),true);
assert.equal(activeLawcal(lawcal,'T0','2024-02-01'),true);

const pass=auditStaticSources(fjaCsv(),lawcalCsv(),earningsCsv());
assert.equal(pass.passed,true);
assert.equal(pass.counts.pitEvents,220);
assert.equal(pass.counts.causalEligible,220);
assert.equal(pass.quality.duplicateCount,0);
assert.equal(pass.quality.directionalContradictionCount,0);

const futureCreated=lawcalCsv().replace(
  'T0,0000000000,T0,industrials,2020-01-01,,2020-01-01',
  'T0,0000000000,T0,industrials,2020-01-01,,2025-01-01'
);
assert.equal(auditStaticSources(fjaCsv(),futureCreated,earningsCsv()).counts.pitEvents,219);

const removedFja=fjaCsv().replace('T0,2020-01-01,','T0,2020-01-01,2024-02-01');
assert.equal(auditStaticSources(removedFja,lawcalCsv(),earningsCsv()).counts.pitEvents,219);

const lawcalAlias=lawcalCsv().replace(
  'T0,0000000000,T0,industrials,2020-01-01,,2020-01-01',
  'FISV,0000798354,Fiserv,financials,2001-04-02,,2007-03-05'
);
const aliasAudit=auditStaticSources(fjaCsv(),lawcalAlias,earningsCsv());
assert.equal(aliasAudit.counts.pitEvents,219);
assert.equal(aliasAudit.quality.pitSourceDisagreements.fjaOnly.length,1);

const during=earningsCsv().replace('2024-02-01 08:00:00-05:00','2024-02-01 12:00:00-05:00');
assert.equal(auditStaticSources(fjaCsv(),lawcalCsv(),during).counts.causalEligible,219);

let missing=earningsCsv();
for(let i=0;i<80;i++)missing=missing.replace('1.00,1.20,20.0','1.00,,20.0');
const missingAudit=auditStaticSources(fjaCsv(),lawcalCsv(),missing);
assert.equal(missingAudit.gates.actualEstimateCoverage,false);
assert.equal(missingAudit.passed,false);

const duplicate=earningsCsv()+earningsCsv().trim().split('\n')[1]+'\n';
const duplicateAudit=auditStaticSources(fjaCsv(),lawcalCsv(),duplicate);
assert.equal(duplicateAudit.quality.duplicateCount,1);
assert.equal(duplicateAudit.gates.noDuplicates,false);
assert.equal(duplicateAudit.passed,false);

const contradiction=earningsCsv().replace('1.00,1.20,20.0','1.00,1.20,-20.0');
const contradictionAudit=auditStaticSources(fjaCsv(),lawcalCsv(),contradiction);
assert.equal(contradictionAudit.quality.directionalContradictionCount,1);
assert.equal(contradictionAudit.gates.noDirectionalContradictions,false);
assert.equal(contradictionAudit.passed,false);

assert.equal(SOURCE_PINS.earnings.commit,'7ed98a0e2497b0a83bcbc290db41705089768c16');
assert.equal(SOURCE_PINS.earnings.blobSha,'abde11f719e93dc427a1040ffed3f0b8590b8508');
assert.equal(SOURCE_PINS.pitFja.blobSha,'3ed3b0e8d9e6e63730c153ee1f13ddaf6ed281bb');
assert.equal(SOURCE_PINS.pitLawcal.blobSha,'6a865618173f322ecda9a569bc6bd48edcfaf996');

console.log('PEAD_EARNINGS_SOURCE_AUDIT_V1_UNIT_PASS',PEAD_SOURCE_AUDIT_V1.sourceRevision);
