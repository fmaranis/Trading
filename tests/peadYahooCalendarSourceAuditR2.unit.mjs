import assert from 'node:assert/strict';
import {
  PEAD_SOURCE_AUDIT_R2,
  yahooCalendarQueryBody,
  classifyCalendarTiming,
  normalizeYahooCalendarPayload,
  auditR2
} from '../scripts/peadYahooCalendarSourceAuditR2.mjs';

assert.equal(PEAD_SOURCE_AUDIT_R2.window.from,'2024-01-15');
assert.equal(PEAD_SOURCE_AUDIT_R2.window.to,'2024-03-15');
assert.equal(PEAD_SOURCE_AUDIT_R2.productionDefault,'LEGACY');
assert.equal(PEAD_SOURCE_AUDIT_R2.productionAuthority,false);

const body=yahooCalendarQueryBody(0);
assert.equal(body.offset,0);
assert.equal(body.size,100);
assert.equal(body.entityIdType,'sp_earnings');
assert.equal(body.sortField,'startdatetime');
assert.equal(body.sortType,'ASC');
const bodyText=JSON.stringify(body);
assert.equal(/MOST_ACTIVE|MOSTACTIVES|symbols|tickers|ITOT/i.test(bodyText),false);
assert.match(bodyText,/startdatetime/);
assert.match(bodyText,/2024-01-15/);
assert.match(bodyText,/2024-03-15/);

assert.equal(classifyCalendarTiming('BMO','2024-02-01T08:00:00-05:00'),'BeforeMarket');
assert.equal(classifyCalendarTiming('AMC','2024-02-01T16:00:00-05:00'),'AfterMarket');
assert.equal(classifyCalendarTiming('DMH','2024-02-01T12:00:00-05:00'),'DuringMarket');
assert.equal(classifyCalendarTiming('TAS','2024-02-01T12:00:00-05:00'),'UNKNOWN');
assert.equal(classifyCalendarTiming('', '2024-02-01T08:00:00-05:00'),'BeforeMarket');
assert.equal(classifyCalendarTiming('', '2024-02-01T16:00:00-05:00'),'AfterMarket');

function payload(rows){
  return {
    finance:{result:[{documents:[{
      columns:[
        {label:'Symbol',type:'STRING'},
        {label:'Event Start Date',type:'DATE'},
        {label:'Event Start Date',type:'STRING'},
        {label:'EPS Estimate',type:'NUMBER'},
        {label:'Reported EPS',type:'NUMBER'},
        {label:'Surprise (%)',type:'NUMBER'}
      ],
      rows
    }]}],error:null}
  };
}
const normalized=normalizeYahooCalendarPayload(payload([
  ['AAA','2024-02-01T08:00:00-05:00','BMO',1,1.2,20],
  ['BBB','2024-02-01T16:00:00-05:00','AMC',1,0.8,-20],
  ['CCC','2024-02-01T12:00:00-05:00','TAS',1,1.1,10]
]));
assert.equal(normalized.length,3);
assert.equal(normalized[0].ticker,'AAA');
assert.equal(normalized[0].reportDate,'2024-02-01');
assert.equal(normalized[0].timing,'BeforeMarket');
assert.equal(normalized[1].timing,'AfterMarket');
assert.equal(normalized[2].timing,'UNKNOWN');

const fja=['ticker,start_date,end_date'];
const law=['symbol,cik,name,sector,date_added,date_removed,created_at'];
const rows=[];
const r1Keys=new Set();
for(let i=0;i<460;i++){
  const ticker='T'+String(i).padStart(3,'0');
  fja.push(ticker+',2020-01-01,');
  law.push(ticker+',1,'+ticker+',industrials,2020-01-01,,2020-01-01');
  const reportDate='2024-02-'+String(1+(i%20)).padStart(2,'0');
  rows.push({
    ticker,
    startDateTime:reportDate+'T08:00:00-05:00',
    reportDate,
    timing:'BeforeMarket',
    rawTiming:'BMO',
    estimate:1,
    actual:1.2,
    surprisePct:20
  });
  if(i<450)r1Keys.add(ticker+'|'+reportDate);
}
const pages=[{offset:0,rowCount:100},{offset:100,rowCount:100},{offset:200,rowCount:100},{offset:300,rowCount:100},{offset:400,rowCount:60}];
const pass=auditR2(rows,fja.join('\n')+'\n',law.join('\n')+'\n',r1Keys,pages);
assert.equal(pass.passed,true);
assert.equal(pass.gates.pitEvents,true);
assert.equal(pass.gates.paginationComplete,true);
assert.equal(pass.gates.r1Overlap,true);
assert.equal(pass.counts.pitEvents,460);
assert.equal(pass.counts.causalEligible,460);

const noTerminal=auditR2(rows,fja.join('\n')+'\n',law.join('\n')+'\n',r1Keys,[{offset:0,rowCount:100}]);
assert.equal(noTerminal.gates.paginationComplete,false);
assert.equal(noTerminal.passed,false);

const duplicateRows=[...rows,{...rows[0]}];
const duplicate=auditR2(duplicateRows,fja.join('\n')+'\n',law.join('\n')+'\n',r1Keys,pages);
assert.equal(duplicate.gates.noDuplicates,false);
assert.equal(duplicate.passed,false);

const lowOverlapKeys=new Set([...r1Keys].slice(0,440));
for(let i=0;i<30;i++)lowOverlapKeys.add('MISSING'+i+'|2024-02-01');
const lowOverlap=auditR2(rows,fja.join('\n')+'\n',law.join('\n')+'\n',lowOverlapKeys,pages);
assert.ok(lowOverlap.coverage.r1OverlapPct<95);
assert.equal(lowOverlap.gates.r1Overlap,false);
assert.equal(lowOverlap.passed,false);

const manyUnknown=rows.map((row,i)=>i<30?{...row,timing:'UNKNOWN'}:row);
const unknown=auditR2(manyUnknown,fja.join('\n')+'\n',law.join('\n')+'\n',r1Keys,pages);
assert.ok(unknown.coverage.knownTimingPct<95);
assert.equal(unknown.gates.timingCoverage,false);
assert.equal(unknown.passed,false);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_R2_UNIT_PASS');
