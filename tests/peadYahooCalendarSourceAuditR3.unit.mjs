import assert from 'node:assert/strict';
import { PEAD_SOURCE_AUDIT_R3, auditR3 } from '../scripts/peadYahooCalendarSourceAuditR3.mjs';

assert.equal(PEAD_SOURCE_AUDIT_R3.study,'PEAD_EARNINGS_SOURCE_AUDIT_R3');
assert.equal(PEAD_SOURCE_AUDIT_R3.sourceRevision,'YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION');
assert.equal(PEAD_SOURCE_AUDIT_R3.gates.minimumPitEvents,450);
assert.equal(PEAD_SOURCE_AUDIT_R3.gates.minimumCausalEligible,440);
assert.equal(PEAD_SOURCE_AUDIT_R3.productionDefault,'LEGACY');
assert.equal(PEAD_SOURCE_AUDIT_R3.productionAuthority,false);

const fja=['ticker,start_date,end_date'];
const law=['symbol,cik,name,sector,date_added,date_removed,created_at'];
const rows=[];
const r1Keys=new Set();
for(let i=0;i<468;i++){
  const ticker='T'+String(i).padStart(3,'0');
  fja.push(ticker+',2020-01-01,');
  law.push(ticker+',1,'+ticker+',industrials,2020-01-01,,2020-01-01');
  const reportDate='2024-02-'+String(1+(i%20)).padStart(2,'0');
  rows.push({
    ticker,
    startDateTime:reportDate+'T20:00:00-05:00',
    reportDate,
    timing:'UNKNOWN',
    rawTiming:'TAS',
    estimate:1,
    actual:1.2,
    surprisePct:20
  });
  if(i<461)r1Keys.add(ticker+'|'+reportDate);
}

const pages=[
  {offset:0,rowCount:100,normalizedRowCount:100,unparseableRowCount:0},
  {offset:100,rowCount:100,normalizedRowCount:100,unparseableRowCount:0},
  {offset:200,rowCount:100,normalizedRowCount:100,unparseableRowCount:0},
  {offset:300,rowCount:100,normalizedRowCount:100,unparseableRowCount:0},
  {offset:400,rowCount:68,normalizedRowCount:68,unparseableRowCount:0}
];

const fjaText=fja.join('\n')+'\n';
const lawText=law.join('\n')+'\n';
const pass=auditR3(rows,fjaText,lawText,r1Keys,pages);
assert.equal(pass.passed,true);
assert.equal(pass.counts.pitEvents,468);
assert.equal(pass.counts.causalEligible,468);
assert.equal(pass.timingDiagnostic.unknown,468);
assert.equal(pass.timingDiagnostic.authority,'DIAGNOSTIC_ONLY_NOT_A_GATE');
assert.equal(pass.executionSemantics.entry,'FIRST_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE');
assert.equal(pass.executionSemantics.announcementDayReturnIncluded,false);
assert.equal(pass.executionSemantics.timingInferenceAllowed,false);
assert.equal(pass.gates.causalEligible,true);
assert.equal(pass.gates.r1Overlap,true);
assert.equal(pass.gates.noDuplicates,true);
assert.equal(pass.gates.noDirectionalContradictions,true);

const missingSurprise=rows.map((row,i)=>i<30?{...row,surprisePct:null}:row);
const surpriseFail=auditR3(missingSurprise,fjaText,lawText,r1Keys,pages);
assert.ok(surpriseFail.coverage.surprisePct<95);
assert.equal(surpriseFail.gates.surpriseCoverage,false);
assert.equal(surpriseFail.passed,false);

const duplicate=auditR3([...rows,{...rows[0]}],fjaText,lawText,r1Keys,pages);
assert.equal(duplicate.gates.noDuplicates,false);
assert.equal(duplicate.passed,false);

const contradictionRows=rows.map((row,i)=>i===0?{...row,actual:.8,estimate:1,surprisePct:20}:row);
const contradiction=auditR3(contradictionRows,fjaText,lawText,r1Keys,pages);
assert.equal(contradiction.gates.noDirectionalContradictions,false);
assert.equal(contradiction.passed,false);

const noTerminal=auditR3(rows,fjaText,lawText,r1Keys,[{offset:0,rowCount:100,normalizedRowCount:100,unparseableRowCount:0}]);
assert.equal(noTerminal.gates.paginationComplete,false);
assert.equal(noTerminal.passed,false);

const unparseable=auditR3(rows,fjaText,lawText,r1Keys,[
  {offset:0,rowCount:100,normalizedRowCount:99,unparseableRowCount:1},
  {offset:100,rowCount:68,normalizedRowCount:68,unparseableRowCount:0}
]);
assert.equal(unparseable.gates.noUnparseableCalendarRows,false);
assert.equal(unparseable.passed,false);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_R3_UNIT_PASS');
