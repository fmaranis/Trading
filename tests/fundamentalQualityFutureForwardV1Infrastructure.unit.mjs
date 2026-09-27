import assert from 'node:assert/strict';
import { loadSnapshot, SNAPSHOT_PATH, ROOT, SNAPSHOT_SHA256, requiredSymbols, providerSymbol, checkpointDate, sessionsBetween,
  availableAt, adjustedOpen, fingerprint, sha256, sealEvidence, sessionOpen, sessionClose, verifyInfrastructureSeal } from '../scripts/fundamentalQualityFutureForwardV1Infrastructure.mjs';
import { captureStart, verifyStart } from '../scripts/fundamentalQualityFutureForwardV1Start.mjs';
import { evaluateCheckpoint, pathMetrics } from '../scripts/fundamentalQualityFutureForwardV1Evaluator.mjs';
import { CORPORATE_ACTION_POLICY } from '../scripts/researchCorporateActionsFailClosedV1.mjs';
import { runFutureForward, fetchYahooPacket } from '../scripts/fundamentalQualityFutureForwardV1Live.mjs';
import { ImmutableEvidenceStore } from '../scripts/researchImmutableEvidenceStore.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fabricated unit fixtures ONLY, never written to real study evidence and never used as economic validation.
const s=loadSnapshot(),symbols=requiredSymbols(s),startDate='2026-09-28';
const checks=[];
async function test(name,fn){await fn();checks.push(name);}
function review(from,through){return {policy:CORPORATE_ACTION_POLICY,sourceType:'REAL',coverage:'COMPLETE',from,through,
  reviewedAt:through+'T22:10:00Z',reviewer:'UNIT_FIXTURE_NOT_REAL_EVIDENCE',symbols,
  sources:[{url:'https://example.invalid/unit-only',sha256:'a'.repeat(64)}],events:[],nonTradableSessions:[]};}
function packets(from,through,{candidateSlope=.001,benchmarkSlope=.0005,scale=1}={}){
  const dates=sessionsBetween(from,through);
  return Object.fromEntries(symbols.map(symbol=>[symbol,{sourceType:'REAL',provider:'YAHOO_FINANCE',symbol,providerSymbol:providerSymbol(symbol),
    returnedSymbol:providerSymbol(symbol),currency:'USD',sourceUrl:'https://example.invalid/unit-only',rawSha256:'a'.repeat(64),
    requestFrom:from,requestThrough:through,fetchedAt:through+'T22:10:00Z',events:[],
    bars:dates.map((date,i)=>({date,open:100,close:100,adjustedClose:80*scale*(1+i*(symbol==='SPY'||symbol==='URTH'?benchmarkSlope:candidateSlope))}))}]));}
const startPackets=packets(startDate,startDate);
const start=captureStart(startPackets,review(startDate,startDate),startDate+'T22:15:00Z');
await test('frozen snapshot hash, cardinality, issuer cap, immutable objects',()=>{
  assert.equal(s.selected.length,100);assert.equal(new Set(s.selected.map(r=>r.issuerKey)).size,99);
  assert.equal(sha256(readFileSync(resolve(ROOT,SNAPSHOT_PATH))),SNAPSHOT_SHA256);
  assert.throws(()=>{s.selected[0].weight=.9;},TypeError);
  const changed=JSON.parse(readFileSync(resolve(ROOT,SNAPSHOT_PATH)));changed.selected[0].weight+=.01;
  assert.throws(()=>loadSnapshot(Buffer.from(JSON.stringify(changed))),/FINGERPRINT/);
  assert.throws(()=>loadSnapshot(Buffer.concat([readFileSync(resolve(ROOT,SNAPSHOT_PATH)),Buffer.from(' ')])),/FINGERPRINT/);
});
await test('explicit symbol mapping, no regexp wildcard alias',()=>{assert.equal(providerSymbol('NYSE:BRK.B'),'BRK-B');assert.equal(providerSymbol('NASDAQ:AAPL'),'AAPL');assert.throws(()=>providerSymbol('OTHER:AAPL'));});
await test('same-session adjusted open, invalid numbers',()=>{assert.equal(adjustedOpen({open:100,close:110,adjustedClose:99}),90);for(const x of [null,0,-1,NaN,Infinity,'100'])assert.throws(()=>adjustedOpen({open:x,close:100,adjustedClose:100}));});
await test('no future start even if input claims prices available',()=>assert.throws(()=>captureStart(startPackets,review(startDate,startDate),'2026-09-28T19:00:00Z'),/COMPLETED/));
await test('calendar weekends, holidays, early close and DST',()=>{
  assert.equal(checkpointDate(startDate,3),'2026-12-28');assert.equal(checkpointDate(startDate,6),'2027-03-29');assert.equal(checkpointDate(startDate,12),'2027-09-28');
  assert.equal(sessionOpen(startDate),Date.parse('2026-09-28T13:30:00Z'));assert.equal(sessionClose('2026-12-24'),Date.parse('2026-12-24T18:00:00Z'));
  assert.throws(()=>checkpointDate(startDate,9),/HORIZON/);assert.equal(availableAt(startDate),Date.parse('2026-09-28T22:00:00Z'));
});
await test('start missing data cannot choose a later date',()=>{
  const end='2026-09-29',p=packets(startDate,end),r=review(startDate,end);p[symbols[0]].bars.shift();
  assert.throws(()=>captureStart(p,r,end+'T22:15:00Z'),/UNRESOLVED_EARLIER/);
  r.nonTradableSessions.push({symbol:symbols[0],date:startDate,reason:'EXCHANGE_CONFIRMED_FULL_SESSION_HALT',sourceUrl:'https://example.invalid/halt',sourceSha256:'b'.repeat(64)});
  assert.equal(captureStart(p,r,end+'T22:15:00Z').payload.startDate,end);
});
await test('snapshot and start evidence cannot be silently rewritten',()=>{const x=structuredClone(start);x.payload.prices.SPY.open=999;assert.throws(()=>verifyStart(x),/HASH/);});
for(const months of [3,6,12])await test(`${months}m gate, immutable weights and complete paths`,()=>{
  const end=checkpointDate(startDate,months),p=packets(startDate,end),r=review(startDate,end),before=fingerprint(s);
  const out=evaluateCheckpoint(start,p,r,months,end+'T22:15:00Z').payload;
  assert.equal(out.status,months===12?'PASS_PRIMARY_12M_SIGNAL_ONLY':'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION');
  assert.equal(out.primaryGateEvaluated,months===12);assert.equal(out.outcomeCoveragePct,100);
  assert.equal(out.productionAuthority,false);assert.equal(out.promotionAllowed,false);assert.equal(fingerprint(s),before);
  assert.equal(out.riskConvention.riskFree,'CONSTANT_ZERO_DAILY_RESEARCH_REFERENCE');
  // Independent terminal sum for linear unit fixture, not the production metric helper.
  assert.ok(Math.abs(out.candidate.totalReturnPct-(p.SPY.bars.length-1)*.1)<1e-9);
});
const end=checkpointDate(startDate,12),now=end+'T22:15:00Z',p=packets(startDate,end),r=review(startDate,end);
await test('12m tie is FAIL, neither checkpoint nor horizon can rescue',()=>{
  const equal=packets(startDate,end,{candidateSlope:.0005});assert.equal(evaluateCheckpoint(start,equal,r,12,now).payload.status,'FAIL_PRIMARY_12M');
  const oneOnly=structuredClone(p);oneOnly.SPY.bars=p[symbols[0]].bars;assert.equal(evaluateCheckpoint(start,oneOnly,r,12,now).payload.status,'FAIL_PRIMARY_12M');
  assert.throws(()=>evaluateCheckpoint(start,p,r,12,'2027-09-28T19:00:00Z'),/NOT_MATURE/);
  assert.throws(()=>evaluateCheckpoint(start,p,r,9,now),/HORIZON/);
});
await test('daily coverage fails for missing benchmark, constituent, middle bar or duplicates',()=>{
  for(const symbol of ['SPY','URTH',symbols[0]]){const x=structuredClone(p);delete x[symbol];assert.throws(()=>evaluateCheckpoint(start,x,r,12,now),/COVERAGE/);}
  const missing=structuredClone(p);missing[symbols[0]].bars.splice(10,1);assert.throws(()=>evaluateCheckpoint(start,missing,r,12,now),/DAILY_COVERAGE/);
  const dup=structuredClone(p);dup.SPY.bars[2]=dup.SPY.bars[1];assert.throws(()=>evaluateCheckpoint(start,dup,r,12,now),/DUPLICATE/);
});
await test('REAL-only, currency/identity and future-bar checks',()=>{
  for(const [key,val] of [['sourceType','SYNTHETIC'],['currency','EUR'],['returnedSymbol','OTHER']]){const x=structuredClone(p);x.SPY[key]=val;assert.throws(()=>evaluateCheckpoint(start,x,r,12,now),/IDENTITY/);}
  const x=structuredClone(p);x.SPY.bars.at(-1).date='2027-09-29';assert.throws(()=>evaluateCheckpoint(start,x,r,12,now),/FUTURE/);
});
await test('same-vintage rebasing cancels later uniform dividend rescaling',()=>{
  const scaled=packets(startDate,end,{scale:.73});const a=evaluateCheckpoint(start,p,r,12,now).payload,b=evaluateCheckpoint(start,scaled,r,12,now).payload;
  assert.ok(Math.abs(a.candidate.totalReturnPct-b.candidate.totalReturnPct)<1e-9);
  const rawRevision=structuredClone(p);rawRevision.SPY.bars[0].open=50;assert.throws(()=>evaluateCheckpoint(start,rawRevision,r,12,now),/REVISION/);
});
await test('unresolved corporate actions including ticker changes never receive invented terminal values',()=>{
  assert.throws(()=>evaluateCheckpoint(start,p,null,12,now),/REVIEW_REQUIRED/);
  for(const type of ['CASH_MERGER','STOCK_MERGER','DELISTING','TICKER_CHANGE','SPIN_OFF','SPLIT','UNKNOWN']){
    const rev=structuredClone(r);rev.events.push({symbol:symbols[0],type,effectiveDate:'2027-01-04',knownAt:'2026-12-01T00:00:00Z',sourceUrl:'https://example.invalid/event'});
    assert.throws(()=>evaluateCheckpoint(start,p,rev,12,now),/INCONCLUSIVE_CORPORATE/);
  }
  const split=structuredClone(p);split.SPY.events=[{type:'splits'}];assert.throws(()=>evaluateCheckpoint(start,split,r,12,now),/CORPORATE/);
});
await test('independent risk arithmetic: close-to-close plus entry, actual CAGR and zero-vol Sharpe',()=>{
  const m=pathMetrics([1,1.1,.88,1.056],1);const rr=[.1,-.2,.2],mean=rr.reduce((a,b)=>a+b)/3,sd=Math.sqrt(rr.reduce((a,b)=>a+(b-mean)**2,0)/2);
  assert.ok(Math.abs(m.totalReturnPct-5.6)<1e-10);assert.ok(Math.abs(m.cagrEquivalentPct-5.6)<1e-10);
  assert.ok(Math.abs(m.maxDailyDrawdownPct-20)<1e-10);assert.ok(Math.abs(m.annualizedDailyVolatilityPct-sd*Math.sqrt(252)*100)<1e-10);
  assert.ok(Math.abs(m.sharpe-mean/sd*Math.sqrt(252))<1e-10);assert.equal(pathMetrics([1,1,1],1).sharpe,null);
});
await test('live wrapper Sunday does not construct store, ask for review or fetch',async()=>{
  const fail=()=>{throw Error('UNEXPECTED_IO');};const out=await runFutureForward({mode:'start',now:'2026-09-27T21:42:24Z',reviewAt:fail,storeFactory:fail,fetchPacket:fail});
  assert.equal(out.status,'WAITING_FOR_COMPLETED_SESSION');assert.equal(out.outcomesState,'UNOPENED');
});
await test('checkpoint maturity blocks price IO, valid durable start is reused',async()=>{
  const store={read:async key=>key==='start'?start:null};const fail=()=>{throw Error('UNEXPECTED_IO');};
  const out=await runFutureForward({mode:'evaluate',months:12,now:'2026-10-01T22:15:00Z',storeFactory:()=>store,reviewAt:fail,fetchPacket:fail});
  assert.equal(out.status,'WAITING_FOR_CHECKPOINT');
  assert.equal((await runFutureForward({mode:'start',now:'2026-10-01T22:15:00Z',storeFactory:()=>store,reviewAt:fail,fetchPacket:fail})).status,'START_ALREADY_CAPTURED');
});
await test('provider cannot be called pre-close; exact symbol preserved',async()=>{
  let calls=0;
  const stub=async()=>{
    calls++;
    const payload={chart:{result:[{
      meta:{symbol:'SPY',currency:'USD',exchangeTimezoneName:'America/New_York',instrumentType:'ETF'},
      timestamp:[sessionOpen(startDate)/1000],
      indicators:{quote:[{open:[100],close:[110]}],adjclose:[{adjclose:[99]}]}
    }]}};
    return {ok:true,text:async()=>JSON.stringify(payload)};
  };
  await assert.rejects(()=>fetchYahooPacket('SPY',startDate,startDate,'2026-09-28T19:00:00Z',stub),/BEFORE_COMPLETED/);assert.equal(calls,0);
  assert.equal((await fetchYahooPacket('SPY',startDate,startDate,'2026-09-28T22:15:00Z',stub)).packet.returnedSymbol,'SPY');
});
await test('create-only store refuses conflicting locks without writing',async()=>{
  const store=new ImmutableEvidenceStore('UNIT_TEST_TOKEN',async()=>{throw Error('UNEXPECTED_NETWORK');});store.read=async()=>start;
  assert.equal((await store.create('start',start)).alreadyPresent,true);
  await assert.rejects(()=>store.create('start',sealEvidence({...start.payload,startDate:'2026-09-29'})),/CONFLICT/);
});
await test('capture pipeline persists opening before prices, all inputs, and reuses locked start',async()=>{
  const values=new Map(),trace=[];
  const store={read:async key=>values.get(key)??null,create:async(key,value)=>{
    if(values.has(key))assert.equal(fingerprint(values.get(key)),fingerprint(value));
    values.set(key,structuredClone(value));trace.push('save:'+key);
  }};
  const fetchPacket=async(symbol,from,through)=>{
    assert.ok(values.has('start-opening'));trace.push('fetch:'+symbol);
    const packet=structuredClone(startPackets[symbol]);
    const raw=JSON.stringify({UNIT_ONLY:true,symbol});packet.rawSha256=sha256(raw);
    return {packet,raw};
  };
  const args={mode:'start',now:'2026-09-28T22:15:00Z',reviewAt:async()=>review(startDate,startDate),storeFactory:()=>store,fetchPacket};
  assert.equal((await runFutureForward(args)).status,'START_CAPTURED');
  assert.equal(trace.filter(x=>x.startsWith('fetch:')).length,102);
  assert.ok(trace.indexOf('save:start-opening')<trace.findIndex(x=>x.startsWith('fetch:')));
  assert.ok(values.has('start') && values.has('start-input-2026-09-28'));
  const before=trace.length;assert.equal((await runFutureForward(args)).status,'START_ALREADY_CAPTURED');assert.equal(trace.length,before);
});
await test('bad event review fails before first market call',async()=>{
  let calls=0;const store={read:async()=>null,create:async()=>{throw Error('UNEXPECTED_WRITE');}};
  await assert.rejects(()=>runFutureForward({mode:'start',now:'2026-09-28T22:15:00Z',storeFactory:()=>store,reviewAt:async()=>null,fetchPacket:async()=>{calls++;}}),/REVIEW_REQUIRED/);
  assert.equal(calls,0);
});

verifyInfrastructureSeal();
console.log(JSON.stringify({status:'PASS_PRE_OUTCOME_INFRASTRUCTURE',testGroups:checks.length,checks,fixtureUse:'UNIT_ONLY_NOT_MARKET_EVIDENCE',marketRequests:0,productionDefault:'LEGACY',productionAuthority:false}));
