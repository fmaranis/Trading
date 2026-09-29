import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../scripts/peadEarningsSourceAuditV1.mjs';

const originalCwd=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pead-source-audit-v1-'));
process.chdir(tmp);
process.env.EODHD_API_KEY='integration-test-key';

function componentsPayload(){
  const rows={};
  for(let i=0;i<250;i++)rows[String(i)]={Code:'T'+i,StartDate:'2020-01-01',EndDate:null};
  return rows;
}

function earningsPayload(count){
  const earnings=[];
  for(let i=0;i<count;i++)earnings.push({
    code:'T'+i+'.US',
    report_date:'2024-02-01',
    date:'2023-12-31',
    before_after_market:i%2?'AfterMarket':'BeforeMarket',
    actual:1.2,
    estimate:1.0,
    difference:.2,
    percent:20,
    currency:'USD'
  });
  return {earnings};
}

function resetRuntime(){
  fs.rmSync(path.resolve(tmp,'.runtime/pead-earnings-source-audit-v1'),{recursive:true,force:true});
  fs.rmSync(path.resolve(tmp,'validation-runs'),{recursive:true,force:true});
  process.exitCode=0;
}

async function runCase(earnings){
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const payload=String(url).includes('/fundamentals/')?componentsPayload():earnings;
    return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
  };
  await main();
  const out=JSON.parse(fs.readFileSync(path.resolve(tmp,'validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json'),'utf8'));
  return {calls,out};
}

try{
  resetRuntime();
  const pass=await runCase(earningsPayload(220));
  assert.equal(pass.calls.length,2);
  assert.match(pass.calls[0],/\/api\/fundamentals\/GSPC\.INDX/);
  assert.match(pass.calls[0],/filter=HistoricalTickerComponents/);
  assert.match(pass.calls[1],/\/api\/calendar\/earnings/);
  assert.equal(pass.out.status,'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION');
  assert.equal(pass.out.audit.counts.pitEvents,220);
  assert.equal(pass.out.audit.counts.causalEligible,220);
  assert.equal(pass.out.economicOutcomesOpened,false);
  assert.equal(pass.out.priceOutcomesFetched,false);
  assert.equal(pass.out.productionDefault,'LEGACY');
  assert.equal(pass.out.productionAuthority,false);
  assert.equal(process.exitCode,0);

  resetRuntime();
  const fail=await runCase(earningsPayload(100));
  assert.equal(fail.out.status,'INCONCLUSIVE_SOURCE_CAUSALITY');
  assert.equal(fail.out.audit.gates.pitEvents,false);
  assert.equal(fail.out.audit.gates.causalEligible,false);
  assert.equal(fail.out.economicOutcomesOpened,false);
  assert.equal(fail.out.priceOutcomesFetched,false);
  assert.equal(process.exitCode,2);

  console.log('PEAD_EARNINGS_SOURCE_AUDIT_V1_INTEGRATION_PASS');
} finally {
  process.exitCode=0;
  process.chdir(originalCwd);
  fs.rmSync(tmp,{recursive:true,force:true});
}
