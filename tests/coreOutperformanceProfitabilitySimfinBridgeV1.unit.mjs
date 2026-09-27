import assert from 'node:assert/strict';

function pctReturn(start,end){return (end/start-1)*100;}
function cagrPct(periodReturnsPct,startDate,endDate){
  const wealth=periodReturnsPct.reduce((w,r)=>w*(1+r/100),1);
  const years=(Date.parse(endDate)-Date.parse(startDate))/(365.25*86400000);
  return (Math.pow(wealth,1/years)-1)*100;
}
assert.ok(Math.abs(pctReturn(100,110)-10)<1e-12);
const c=cagrPct([10,10,10,10],'2020-07-01','2024-07-01');
assert.ok(c>9.9&&c<10.1);

const caps=[{ticker:'A',close:10,shares:2},{ticker:'B',close:5,shares:6}];
const total=caps.reduce((s,r)=>s+r.close*r.shares,0);
const weights=caps.map(r=>r.close*r.shares/total);
assert.ok(Math.abs(weights[0]-0.4)<1e-12);
assert.ok(Math.abs(weights[1]-0.6)<1e-12);
assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);

console.log('CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1_UNIT_PASS');
