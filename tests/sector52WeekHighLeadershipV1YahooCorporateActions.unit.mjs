import assert from 'node:assert/strict';
import { auditSymbol, splitAdjustmentCheck } from '../scripts/sector52WeekHighLeadershipV1YahooCorporateActions.mjs';

const prev=Math.floor(Date.parse('2025-12-04T21:00:00Z')/1000);
const now=Math.floor(Date.parse('2025-12-05T21:00:00Z')/1000);
const payload={chart:{result:[{
  timestamp:[prev,now],
  indicators:{quote:[{close:[50,50]}],adjclose:[{adjclose:[49,49]}]},
  events:{splits:{x:{date:now,numerator:2,denominator:1,splitRatio:'2:1'}},dividends:{d:{date:prev,amount:.5}}}
}],error:null}};
const audit=auditSymbol('XLB',payload);
assert.equal(audit.splits.length,1);
assert.equal(audit.dividends.length,1);
assert.equal(audit.splitChecks[0].pass,true);
assert.ok(audit.splitChecks[0].relativeError<1e-12);

const broken=structuredClone(payload);
broken.chart.result[0].indicators.quote[0].close=[100,50];
assert.equal(splitAdjustmentCheck(broken.chart.result[0],audit.splits[0]).pass,false);
assert.throws(()=>auditSymbol('XLB',broken),/SPLIT_ADJUSTMENT_MISMATCH/);

console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_CORPORATE_ACTIONS_UNIT_PASS');
