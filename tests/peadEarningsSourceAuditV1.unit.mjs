import assert from 'node:assert/strict';
import { PEAD_SOURCE_AUDIT_V1,tickerKey,normalizeComponentRows,normalizeEarningsRows,activeMember,auditPayloads } from '../scripts/peadEarningsSourceAuditV1.mjs';

assert.equal(tickerKey('BRK-B.US'),'BRK-B');
assert.equal(tickerKey('BRK.B'),'BRK-B');

const components={HistoricalTickerComponents:{}};
for(let i=0;i<250;i++)components.HistoricalTickerComponents[String(i)]={Code:'T'+i,StartDate:'2020-01-01',EndDate:null};
const directFilteredComponents={};
for(let i=0;i<250;i++)directFilteredComponents[String(i)]={Code:'T'+i,StartDate:'2020-01-01',EndDate:null};
assert.equal(normalizeComponentRows(directFilteredComponents).length,250);
assert.equal(normalizeComponentRows(components).length,250);

const earnings={earnings:[]};
for(let i=0;i<220;i++)earnings.earnings.push({
  code:'T'+i+'.US',report_date:'2024-02-01',date:'2023-12-31',
  before_after_market:i%2?'AfterMarket':'BeforeMarket',
  actual:1.2,estimate:1.0,difference:.2,percent:20,currency:'USD'
});
const audit=auditPayloads(components,earnings);
assert.equal(audit.passed,true);
assert.equal(audit.counts.pitEvents,220);
assert.equal(audit.counts.causalEligible,220);
assert.equal(audit.quality.duplicateCount,0);
assert.equal(audit.quality.inconsistentDifferenceCount,0);
assert.equal(activeMember([{code:'ABC',start:'2020-01-01',end:'2024-12-31'}],'ABC.US','2024-02-01'),true);

const rows=normalizeEarningsRows({earnings:[{code:'ABC.US',report_date:'2024-02-01',date:'2023-12-31',before_after_market:'AfterMarket',actual:2,estimate:1.5,difference:.5,percent:33.3}]});
assert.equal(rows[0].ticker,'ABC');
assert.equal(rows[0].actual,2);

const bad=structuredClone(earnings);
bad.earnings[0].difference=99;
assert.equal(auditPayloads(components,bad).passed,false);
console.log('PEAD_EARNINGS_SOURCE_AUDIT_V1_UNIT_PASS',PEAD_SOURCE_AUDIT_V1.study);
