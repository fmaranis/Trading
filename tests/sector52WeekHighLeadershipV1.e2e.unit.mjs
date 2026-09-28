import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SECTOR_52W_HIGH_LEADERSHIP_V1 as P } from '../scripts/sector52WeekHighLeadershipV1Protocol.mjs';

const SECTORS=[...P.sectors];
const ALL=[...P.sectors,...P.benchmarks];
const RUNNER=path.resolve('scripts/sector52WeekHighLeadershipV1Live.mjs');

function tradingDays(start,end){
  const out=[];
  for(let d=new Date(start+'T00:00:00Z'),last=new Date(end+'T00:00:00Z');d<=last;d.setUTCDate(d.getUTCDate()+1)){
    const wd=d.getUTCDay(),md=d.toISOString().slice(5,10);
    if(wd===0||wd===6||md==='01-01'||md==='12-25') continue;
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}

function row(date,close,i,k){
  const open=close*(1+0.0006*Math.sin(i*0.37+k*0.71));
  return {date,open,close};
}

function makeInput(mode){
  const dates=tradingDays('2011-07-01','2026-01-07'),series={},seriesMeta={};
  for(let k=0;k<SECTORS.length;k++){
    series[SECTORS[k]]=dates.map((date,i)=>{
      let logp;
      if(mode==='pass'){
        const rate=k<3 ? [0.00085,0.00078,0.00072][k] : 0.00006+0.000005*k;
        logp=Math.log(90+3*k)+rate*i+0.002*Math.sin(i/29+k);
      }else{
        const rate=0.00016+0.000015*Math.sin(k);
        logp=Math.log(90+3*k)+rate*i+0.16*Math.sin(i/58+k*0.83)+0.025*Math.sin(i/11+k);
      }
      return row(date,Math.exp(logp),i,k);
    });
  }
  const benchRate={SPY:0.00024,URTH:0.00018};
  for(const [j,symbol] of P.benchmarks.entries()){
    series[symbol]=dates.map((date,i)=>{
      const amplitude=symbol==='URTH'?0.02:0.01;
      const close=Math.exp(Math.log(100+j*5)+benchRate[symbol]*i+amplitude*Math.sin(i/31+j));
      return row(date,close,i,20+j);
    });
  }
  for(const symbol of ALL) seriesMeta[symbol]={currency:'USD'};
  return {
    schemaVersion:1,
    study:P.version,
    generatedAt:'2026-09-28T00:00:00.000Z',
    provider:'TEST_FIXTURE',
    provenance:'SYNTHETIC_TEST',
    downloadFrom:'2011-07-01',
    downloadThrough:'2026-01-07',
    seriesMeta,
    series,
    productionDefault:'LEGACY',
    productionAuthority:false
  };
}

function finiteBlock(block){
  assert.ok(block);
  for(const name of ['candidate','spy','urth','equal9','momentum12_2']){
    for(const key of ['totalReturnPct','cagrPct','annualizedVolPct','maxDrawdownPct']){
      assert.ok(Number.isFinite(Number(block[name]?.[key])),`${name}.${key} non-finite`);
    }
  }
  assert.ok(Number.isFinite(Number(block.totalCost)));
  assert.ok(Number.isFinite(Number(block.turnoverOnInitialCapital)));
  assert.ok(Number.isFinite(Number(block.rolling12Diagnostics?.worst12mPct)));
  assert.ok(Number.isFinite(Number(block.concentration?.averageHhi)));
}

function runFixture(dir,name,input,{seedInvalid=false}={}){
  const inputPath=path.join(dir,name+'-input.json');
  const outputPath=path.join(dir,name+'-result.json');
  writeFileSync(inputPath,JSON.stringify(input));
  if(seedInvalid){
    writeFileSync(outputPath,JSON.stringify({
      schemaVersion:1,study:P.version,status:'FAIL_DIAGNOSTIC',
      diagnostic:{cost10:{},cost20:{}},productionDefault:'LEGACY',productionAuthority:false
    }));
  }
  const child=spawnSync(process.execPath,[RUNNER,'--input',inputPath,'--output',outputPath],{
    cwd:process.cwd(),
    env:{...process.env,SECTOR52W_E2E_TEST:'1'},
    encoding:'utf8',
    maxBuffer:20*1024*1024
  });
  assert.equal(child.status,0,`runner failed: ${child.stderr}\n${child.stdout}`);
  assert.ok(child.stdout.includes('SECTOR_52W_HIGH_LEADERSHIP_V1_RESULT'));
  const result=JSON.parse(readFileSync(outputPath,'utf8'));
  assert.equal(result.implementationRevision,P.implementationRevision);
  finiteBlock({
    ...result.diagnostic.cost20,
    candidate:result.diagnostic.cost20.primary.metrics,
    spy:result.diagnostic.cost20.spy.metrics,
    urth:result.diagnostic.cost20.urth.metrics,
    equal9:result.diagnostic.cost20.equal9.metrics,
    momentum12_2:result.diagnostic.cost20.momentum12_2.metrics,
    totalCost:result.diagnostic.cost20.primary.totalCost,
    turnoverOnInitialCapital:result.diagnostic.cost20.primary.turnoverOnInitialCapital
  });
  if(seedInvalid){
    assert.ok(existsSync(outputPath.replace(/\.json$/,'-invalid-technical-v1.json')),'invalid prior result not archived');
  }
  return result;
}

const dir=mkdtempSync(path.join(tmpdir(),'sector52w-e2e-'));
try{
  const rotation=runFixture(dir,'rotation',makeInput('rotation'),{seedInvalid:true});
  assert.ok(rotation.diagnostic.cost20.primary.eventEquity.length>=60);
  const rotationSelections=rotation.diagnostic.cost20.primary.eventEquity.map(e=>Object.keys(e.weights).sort().join(','));
  assert.ok(new Set(rotationSelections).size>2,'rotation fixture did not rotate enough');

  const pass=runFixture(dir,'pass',makeInput('pass'));
  assert.equal(pass.diagnostic.cost20.gatePassed,true,'pass fixture must clear diagnostic gate');
  assert.ok(pass.replication,'replication did not open after passing diagnostic');
  assert.equal(pass.replication.cost20.gatePassed,true,'pass fixture must clear replication gate');
  assert.ok(pass.statistics?.passed,'bootstrap continuity should pass in strong fixture');
  assert.equal(pass.userFrequencyTarget?.met,true,'strong fixture should meet observed 80% target');
  assert.equal(pass.status,'PASS_RESEARCH_CANDIDATE_NO_PROMOTION');

  console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_E2E_PASS',JSON.stringify({
    revision:P.implementationRevision,
    rotationStatus:rotation.status,
    rotationEvents:rotation.diagnostic.cost20.primary.eventEquity.length,
    passStatus:pass.status,
    replicationOpened:Boolean(pass.replication),
    statisticsPassed:pass.statistics?.passed,
    frequencyMet:pass.userFrequencyTarget?.met
  }));
} finally {
  rmSync(dir,{recursive:true,force:true});
}
