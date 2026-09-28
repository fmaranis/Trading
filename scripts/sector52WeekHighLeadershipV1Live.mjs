import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SECTOR_52W_HIGH_LEADERSHIP_V1 as P,
  assertSeries,assertFullCoverage,sortBars,toDate,
  buildPrimaryMonthlySignals,buildMomentumMonthlySignals,addExecutionDates,
  rebalanceAtOpen,liquidateAtOpen,markAtClose,metrics,bootstrapMean
} from './sector52WeekHighLeadershipV1Protocol.mjs';

const args=process.argv.slice(2);
const arg=(name,def=null)=>{const i=args.indexOf(name);return i>=0?args[i+1]:def;};
const inputPath=arg('--input','validation-runs/diagnostics/sector-52w-high-leadership-v1-input.json');
const outputPath=arg('--output','validation-runs/diagnostics/sector-52w-high-leadership-v1-result.json');
const costBps=Number(arg('--cost-bps','20'));

function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
function byDate(bars){return new Map(sortBars(bars).map(r=>[toDate(r),r]));}
function firstDateOnOrAfter(calendar,d){const x=calendar.find(v=>v>=d);if(!x)throw new Error('BOUNDARY_MISSING:'+d);return x;}
function opensAt(series,maps,date,symbols){return Object.fromEntries(symbols.map(s=>[s,Number(maps[s].get(date).open)]));}
function closesAt(series,maps,date,symbols){return Object.fromEntries(symbols.map(s=>[s,Number(maps[s].get(date).close)]));}

function constantSignals(primary,weights){
  return primary.map(s=>({...s,weights:{...weights},selected:Object.keys(weights)}));
}

function simulate({seriesBySymbol,calendar,signals,startBoundary,endBoundary,costBps,label}){
  const maps=Object.fromEntries(Object.entries(seriesBySymbol).map(([s,b])=>[s,byDate(b)]));
  const start=firstDateOnOrAfter(calendar,startBoundary), end=firstDateOnOrAfter(calendar,endBoundary);
  const events=addExecutionDates(signals,calendar).filter(e=>e.executionDate>=start&&e.executionDate<end);
  if(!events.length||events[0].executionDate!==start) throw new Error('START_EVENT_MISMATCH:'+label+':'+start+':'+events[0]?.executionDate);
  const eventMap=new Map(events.map(e=>[e.executionDate,e]));
  let state={shares:{},cash:1}, totalCost=0,totalTraded=0;
  const daily=[{date:start,equity:1,kind:'INITIAL'}], eventEquity=[];
  const startIdx=calendar.indexOf(start), endIdx=calendar.indexOf(end);
  for(let ci=startIdx;ci<endIdx;ci++){
    const date=calendar[ci], ev=eventMap.get(date);
    if(ev){
      const opens=opensAt(seriesBySymbol,maps,date,Object.keys(ev.weights));
      const r=rebalanceAtOpen(state,ev.weights,opens,costBps); state={shares:r.shares,cash:r.cash};
      totalCost+=r.cost;totalTraded+=r.tradedNotional;
      eventEquity.push({date,equity:r.equity,weights:ev.weights,selected:ev.selected});
    }
    const held=Object.keys(state.shares);
    const eq=held.length?markAtClose(state,closesAt(seriesBySymbol,maps,date,held)):state.cash;
    daily.push({date,equity:eq,kind:'CLOSE'});
  }
  const held=Object.keys(state.shares), exit=liquidateAtOpen(state,opensAt(seriesBySymbol,maps,end,held),costBps);
  totalCost+=exit.cost;totalTraded+=exit.tradedNotional;
  daily.push({date:end,equity:exit.equity,kind:'FINAL_OPEN'});
  return {label,start,end,costBps,daily,eventEquity,totalCost,totalTraded,turnoverOnInitialCapital:totalTraded,metrics:metrics(daily.map(x=>x.equity))};
}

function benchmarkCurve(bars,start,end,costBps){
  const xs=sortBars(bars).filter(r=>toDate(r)>=start&&toDate(r)<=end), map=new Map(xs.map(r=>[toDate(r),r]));
  const startBar=map.get(start),endBar=map.get(end); if(!startBar||!endBar)throw new Error('BENCHMARK_BOUNDARY');
  const c=costBps/10000, invested=1/(1+c), shares=invested/Number(startBar.open);
  const daily=[{date:start,equity:1,kind:'INITIAL'}];
  for(const r of xs){const d=toDate(r);if(d>=start&&d<end)daily.push({date:d,equity:shares*Number(r.close),kind:'CLOSE'});}
  daily.push({date:end,equity:shares*Number(endBar.open)*(1-c),kind:'FINAL_OPEN'});
  return {start,end,costBps,daily,metrics:metrics(daily.map(x=>x.equity))};
}

function valueAtDate(curve,date){
  const hit=[...curve].reverse().find(x=>x.date<=date); if(!hit)throw new Error('VALUE_DATE:'+date); return hit.equity;
}
function monthlyReturnsFromEvents(sim){
  const x=sim.eventEquity, out=[];
  for(let i=1;i<x.length;i++)out.push({date:x[i].date,ret:x[i].equity/x[i-1].equity-1});
  return out;
}
function benchmarkMonthly(curve,dates){
  const out=[];for(let i=1;i<dates.length;i++)out.push({date:dates[i],ret:valueAtDate(curve,dates[i])/valueAtDate(curve,dates[i-1])-1});return out;
}
function hitRates(sim,spy,urth){
  const dates=sim.eventEquity.map(x=>x.date), vals=sim.eventEquity.map(x=>x.equity);
  const windows=[];for(let i=0;i+12<dates.length;i++){const j=i+12,cr=vals[j]/vals[i]-1,sr=valueAtDate(spy.daily,dates[j])/valueAtDate(spy.daily,dates[i])-1,ur=valueAtDate(urth.daily,dates[j])/valueAtDate(urth.daily,dates[i])-1;windows.push({start:dates[i],end:dates[j],candidate:cr,spy:sr,urth:ur,beatsSpy:cr>sr,beatsUrth:cr>ur,beatsBoth:cr>sr&&cr>ur});}
  const nonoverlap=windows.filter((_,i)=>i%12===0);
  const summarize=a=>({n:a.length,spyWins:a.filter(x=>x.beatsSpy).length,urthWins:a.filter(x=>x.beatsUrth).length,bothWins:a.filter(x=>x.beatsBoth).length,bothPct:a.length?100*a.filter(x=>x.beatsBoth).length/a.length:null});
  return {rolling12:summarize(windows),nonOverlapping12:summarize(nonoverlap),windows};
}
function hacAlpha(y,x,lag=12){
  const n=Math.min(y.length,x.length);if(n<lag+5)return null;
  let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;
  let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(x[i]-mx)**2;sxy+=(x[i]-mx)*(y[i]-my);}
  const beta=sxy/sxx,alpha=my-beta*mx,e=Array.from({length:n},(_,i)=>y[i]-alpha-beta*x[i]);
  const X=Array.from({length:n},(_,i)=>[1,x[i]]);let S=[[0,0],[0,0]];
  const add=(a,b,k)=>{S[0][0]+=k*a[0]*b[0];S[0][1]+=k*a[0]*b[1];S[1][0]+=k*a[1]*b[0];S[1][1]+=k*a[1]*b[1];};
  for(let t=0;t<n;t++)add(X[t].map(v=>v*e[t]),X[t].map(v=>v*e[t]),1);
  for(let l=1;l<=lag;l++){const w=1-l/(lag+1);for(let t=l;t<n;t++){const a=X[t].map(v=>v*e[t]),b=X[t-l].map(v=>v*e[t-l]);add(a,b,w);add(b,a,w);}}
  let a=n,bx=X.reduce((s,r)=>s+r[1],0),d=X.reduce((s,r)=>s+r[1]*r[1],0),det=a*d-bx*bx;const inv=[[d/det,-bx/det],[-bx/det,a/det]];
  const M=[[0,0],[0,0]];for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let p=0;p<2;p++)for(let q=0;q<2;q++)M[i][j]+=inv[i][p]*S[p][q]*inv[q][j];
  const se=Math.sqrt(Math.max(0,M[0][0]));return {alphaMonthly:alpha,betaSpy:beta,hac12SeAlpha:se,tStat:se>0?alpha/se:null};
}
function blockResult(input,signals,eqSignals,momSignals,startB,endB){
  const s=input.series, calendar=assertFullCoverage(s,[...P.sectors,...P.benchmarks],startB,endB);
  const primary=simulate({seriesBySymbol:s,calendar,signals,startBoundary:startB,endBoundary:endB,costBps,label:'primary'});
  const eq=simulate({seriesBySymbol:s,calendar,signals:eqSignals,startBoundary:startB,endBoundary:endB,costBps,label:'equal9'});
  const mom=simulate({seriesBySymbol:s,calendar,signals:momSignals,startBoundary:startB,endBoundary:endB,costBps,label:'momentum12_2'});
  const spy=benchmarkCurve(s.SPY,primary.start,primary.end,costBps),urth=benchmarkCurve(s.URTH,primary.start,primary.end,costBps);
  const gates={
    excessVsSpy:primary.metrics.cagrPct>spy.metrics.cagrPct,
    excessVsUrth:primary.metrics.cagrPct>urth.metrics.cagrPct,
    excessVsEqual9:primary.metrics.cagrPct>eq.metrics.cagrPct,
    drawdownNoWorseUrth:primary.metrics.maxDrawdownPct>=urth.metrics.maxDrawdownPct,
    sharpeAtLeastUrth:primary.metrics.sharpe>=urth.metrics.sharpe
  };
  const dates=primary.eventEquity.map(x=>x.date),pr=monthlyReturnsFromEvents(primary),er=monthlyReturnsFromEvents(eq),sr=benchmarkMonthly(spy.daily,dates);
  const n=Math.min(pr.length,er.length,sr.length),diff=Array.from({length:n},(_,i)=>pr[i].ret-er[i].ret),sx=Array.from({length:n},(_,i)=>sr[i].ret);
  return {primary,equal9:eq,momentum12_2:mom,spy,urth,gates,gatePassed:Object.values(gates).every(Boolean),hitRates:hitRates(primary,spy,urth),selectorIncrementalHac12:hacAlpha(diff,sx,12)};
}

const inputText=fs.readFileSync(inputPath,'utf8'),input=JSON.parse(inputText);
if(input.study!==P.version)throw new Error('INPUT_STUDY_MISMATCH');
if(input.productionDefault!=='LEGACY'||input.productionAuthority!==false)throw new Error('INPUT_PRODUCTION_INVALID');
if(input.provenance!=='REAL')throw new Error('NON_REAL_INPUT');
if(input.provider==='WOLFRAM_FINANCIALDATA'&&input.reconciliation?.status!=='PASS')throw new Error('INCONCLUSIVE_DATA_RECONCILIATION');
for(const s of [...P.sectors,...P.benchmarks]){if(!input.series?.[s])throw new Error('MISSING_SERIES:'+s);assertSeries(input.series[s],s);if(input.seriesMeta?.[s]?.currency!=='USD')throw new Error('NON_USD:'+s);}

const sectorCalendar=assertFullCoverage(input.series,P.sectors,input.downloadFrom,input.downloadThrough);
const primarySignals=buildPrimaryMonthlySignals(input.series,P.sectors);
const momSignals=buildMomentumMonthlySignals(input.series,P.sectors);
const eqWeights=Object.fromEntries(P.sectors.map(s=>[s,1/P.sectors.length]));
const eqSignals=constantSignals(primarySignals,eqWeights);
const diag=blockResult(input,primarySignals,eqSignals,momSignals,P.diagnostic.startOnOrAfter,P.diagnostic.endOnOrAfter);
let replication=null,status=diag.gatePassed?'PASS_DIAGNOSTIC_CONTINUE_REPLICATION':'FAIL_DIAGNOSTIC';
if(diag.gatePassed){replication=blockResult(input,primarySignals,eqSignals,momSignals,P.replication.startOnOrAfter,P.replication.endOnOrAfter);status=replication.gatePassed?'PASS_RESEARCH_CANDIDATE_NO_PROMOTION':'FAIL_REPLICATION';}

const result={schemaVersion:1,study:P.version,status,provider:input.provider,inputSha256:sha256(inputText),costBpsPerSide:costBps,diagnostic:diag,replication,productionDefault:'LEGACY',productionAuthority:false,promotionAllowed:false};
if(replication?.gatePassed){
  const blocks=[diag,replication].map(b=>{
    const dates=b.primary.eventEquity.map(x=>x.date),pr=monthlyReturnsFromEvents(b.primary),sr=benchmarkMonthly(b.spy.daily,dates),ur=benchmarkMonthly(b.urth.daily,dates);
    const n=Math.min(pr.length,sr.length,ur.length);return Array.from({length:n},(_,i)=>Math.min(pr[i].ret-sr[i].ret,pr[i].ret-ur[i].ret));
  });
  result.statistics={diagnostic:bootstrapMean(blocks[0],{block:12,reps:2000,seed:20260928}),replication:bootstrapMean(blocks[1],{block:12,reps:2000,seed:20260928}),observed80pctTargetMet:diag.hitRates.nonOverlapping12.bothPct>=80&&replication.hitRates.nonOverlapping12.bothPct>=80};
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({study:result.study,status:result.status,diagnostic:{gatePassed:diag.gatePassed,cagr:diag.primary.metrics.cagrPct,spy:diag.spy.metrics.cagrPct,urth:diag.urth.metrics.cagrPct,equal9:diag.equal9.metrics.cagrPct,dd:diag.primary.metrics.maxDrawdownPct,urthDd:diag.urth.metrics.maxDrawdownPct,sharpe:diag.primary.metrics.sharpe,urthSharpe:diag.urth.metrics.sharpe,hit:diag.hitRates.nonOverlapping12},replication:replication?{gatePassed:replication.gatePassed,cagr:replication.primary.metrics.cagrPct,spy:replication.spy.metrics.cagrPct,urth:replication.urth.metrics.cagrPct,equal9:replication.equal9.metrics.cagrPct,hit:replication.hitRates.nonOverlapping12}:null},null,2));
