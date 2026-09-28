import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SECTOR_52W_HIGH_LEADERSHIP_V1 as P,
  assertSeries, assertFullCoverage, firstDateOnOrAfter, sortBars, toDate,
  buildPrimaryMonthlySignals, buildMomentumMonthlySignals, addExecutionDates,
  rebalanceAtOpen, liquidateAtOpen, markAtClose, metrics, bootstrapJointExcess
} from './sector52WeekHighLeadershipV1Protocol.mjs';

const args=process.argv.slice(2);
const arg=(name,def=null)=>{const i=args.indexOf(name);return i>=0?args[i+1]:def;};
const inputPath=arg('--input','validation-runs/diagnostics/sector-52w-high-leadership-v1-input.json');
const outputPath=arg('--output','validation-runs/diagnostics/sector-52w-high-leadership-v1-result.json');
const RESULT_MARKER='SECTOR_52W_HIGH_LEADERSHIP_V1_RESULT';

function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
function byDate(bars){return new Map(sortBars(bars).map(r=>[toDate(r),r]));}
function opensAt(maps,date,symbols){
  return Object.fromEntries(symbols.map(s=>{
    const row=maps[s]?.get(date); if(!row) throw new Error('OPEN_MISSING:'+s+':'+date);
    return [s,Number(row.open)];
  }));
}
function closesAt(maps,date,symbols){
  return Object.fromEntries(symbols.map(s=>{
    const row=maps[s]?.get(date); if(!row) throw new Error('CLOSE_MISSING:'+s+':'+date);
    return [s,Number(row.close)];
  }));
}
function constantSignals(primary,weights){return primary.map(s=>({...s,weights:{...weights},selected:Object.keys(weights)}));}

function simulate({seriesBySymbol,valuationCalendar,executionCalendar,signals,startBoundary,endBoundary,costBps,label}){
  const maps=Object.fromEntries(Object.entries(seriesBySymbol).map(([s,b])=>[s,byDate(b)]));
  const start=firstDateOnOrAfter(valuationCalendar,startBoundary);
  const end=firstDateOnOrAfter(valuationCalendar,endBoundary);
  const events=addExecutionDates(signals,executionCalendar).filter(e=>e.executionDate>=start&&e.executionDate<end);
  if(!events.length||events[0].executionDate!==start) throw new Error('START_EVENT_MISMATCH:'+label+':'+start+':'+events[0]?.executionDate);
  if(events.some(e=>!valuationCalendar.includes(e.executionDate))) throw new Error('EVENT_OUTSIDE_COMMON_CALENDAR:'+label);
  const eventMap=new Map(events.map(e=>[e.executionDate,e]));
  let state={shares:{},cash:1},totalCost=0,totalTraded=0;
  const daily=[{date:start,equity:1,kind:'INITIAL'}],eventEquity=[];
  const startIdx=valuationCalendar.indexOf(start),endIdx=valuationCalendar.indexOf(end);
  for(let ci=startIdx;ci<endIdx;ci++){
    const date=valuationCalendar[ci],ev=eventMap.get(date);
    if(ev){
      const rebalanceSymbols=[...new Set([...Object.keys(state.shares??{}),...Object.keys(ev.weights)])];
      const r=rebalanceAtOpen(state,ev.weights,opensAt(maps,date,rebalanceSymbols),costBps);
      state={shares:r.shares,cash:r.cash};totalCost+=r.cost;totalTraded+=r.tradedNotional;
      eventEquity.push({date,equity:r.equity,weights:ev.weights,selected:ev.selected,descriptive:ev.descriptive??null});
    }
    const held=Object.keys(state.shares);
    const eq=held.length?markAtClose(state,closesAt(maps,date,held)):state.cash;
    daily.push({date,equity:eq,kind:'CLOSE'});
  }
  const held=Object.keys(state.shares);
  const exit=liquidateAtOpen(state,opensAt(maps,end,held),costBps);
  totalCost+=exit.cost;totalTraded+=exit.tradedNotional;
  daily.push({date:end,equity:exit.equity,kind:'FINAL_OPEN'});
  const out={
    label,start,end,costBps,daily,eventEquity,
    finalEquity:exit.equity,totalCost,totalTraded,turnoverOnInitialCapital:totalTraded
  };
  out.metrics=metrics(daily.map(x=>x.equity),daily.map(x=>x.date));
  return out;
}

function benchmarkCurve(bars,start,end,costBps){
  const xs=sortBars(bars).filter(r=>toDate(r)>=start&&toDate(r)<=end);
  const map=new Map(xs.map(r=>[toDate(r),r])),startBar=map.get(start),endBar=map.get(end);
  if(!startBar||!endBar) throw new Error('BENCHMARK_BOUNDARY');
  const c=costBps/10000,invested=1/(1+c),shares=invested/Number(startBar.open);
  const daily=[{date:start,equity:1,kind:'INITIAL'}];
  for(const r of xs){const d=toDate(r);if(d>=start&&d<end)daily.push({date:d,equity:shares*Number(r.close),kind:'CLOSE'});}
  const finalEquity=shares*Number(endBar.open)*(1-c);
  daily.push({date:end,equity:finalEquity,kind:'FINAL_OPEN'});
  return {
    start,end,costBps,daily,shares,finalEquity,map,
    metrics:metrics(daily.map(x=>x.equity),daily.map(x=>x.date))
  };
}

function monthlyPortfolioReturns(sim){
  const events=sim.eventEquity;
  if(events.length<2) throw new Error('MONTHLY_EVENTS_TOO_SHORT:'+sim.label);
  const returns=[],labels=[];let prev=Number(events[0].equity);
  if(!(prev>0)||!Number.isFinite(prev)) throw new Error('MONTHLY_FIRST_EVENT_EQUITY_INVALID:'+sim.label);
  for(let i=1;i<events.length;i++){
    const current=Number(events[i].equity);
    if(!(current>0)||!Number.isFinite(current)) throw new Error('MONTHLY_EVENT_EQUITY_INVALID:'+sim.label+':'+events[i].date);
    returns.push(current/prev-1);labels.push(events[i].date);prev=current;
  }
  if(!(sim.finalEquity>0)||!Number.isFinite(Number(sim.finalEquity))) throw new Error('MONTHLY_FINAL_EQUITY_INVALID:'+sim.label);
  returns.push(Number(sim.finalEquity)/prev-1);labels.push(sim.end);
  return {returns,labels};
}

function monthlyBenchmarkReturns(bench,eventDates,endDate){
  if(eventDates.length<2) throw new Error('BENCHMARK_EVENTS_TOO_SHORT');
  const firstRow=bench.map.get(eventDates[0]);
  if(!firstRow) throw new Error('BENCHMARK_FIRST_EVENT_OPEN_MISSING:'+eventDates[0]);
  let prev=bench.shares*Number(firstRow.open);
  if(!(prev>0)||!Number.isFinite(prev)) throw new Error('BENCHMARK_FIRST_EVENT_EQUITY_INVALID');
  const returns=[],labels=[];
  for(let i=1;i<eventDates.length;i++){
    const row=bench.map.get(eventDates[i]);if(!row)throw new Error('BENCHMARK_EVENT_OPEN_MISSING:'+eventDates[i]);
    const eq=bench.shares*Number(row.open);
    if(!(eq>0)||!Number.isFinite(eq)) throw new Error('BENCHMARK_EVENT_EQUITY_INVALID:'+eventDates[i]);
    returns.push(eq/prev-1);labels.push(eventDates[i]);prev=eq;
  }
  if(!(bench.finalEquity>0)||!Number.isFinite(Number(bench.finalEquity))) throw new Error('BENCHMARK_FINAL_EQUITY_INVALID');
  returns.push(Number(bench.finalEquity)/prev-1);labels.push(endDate);
  return {returns,labels};
}

function hitRates(candidate,spy,urth,labels){
  const n=Math.min(candidate.length,spy.length,urth.length),windows=[];
  for(let i=0;i+12<=n;i++){
    const c=candidate.slice(i,i+12).reduce((w,r)=>w*(1+r),1)-1;
    const s=spy.slice(i,i+12).reduce((w,r)=>w*(1+r),1)-1;
    const u=urth.slice(i,i+12).reduce((w,r)=>w*(1+r),1)-1;
    windows.push({start:i===0?'BLOCK_START':labels[i-1],end:labels[i+11],candidate:c,spy:s,urth:u,beatsSpy:c>s,beatsUrth:c>u,beatsBoth:c>s&&c>u});
  }
  const nonoverlap=windows.filter((_,i)=>i%12===0);
  const summarize=a=>({n:a.length,spyWins:a.filter(x=>x.beatsSpy).length,urthWins:a.filter(x=>x.beatsUrth).length,bothWins:a.filter(x=>x.beatsBoth).length,bothPct:a.length?100*a.filter(x=>x.beatsBoth).length/a.length:null});
  return {rolling12:summarize(windows),nonOverlapping12:summarize(nonoverlap),windows};
}

function hacAlpha(y,x,lag=12){
  const n=Math.min(y.length,x.length);if(n<lag+5)return null;
  let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;
  let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(x[i]-mx)**2;sxy+=(x[i]-mx)*(y[i]-my);}
  if(!(sxx>0))return null;
  const beta=sxy/sxx,alpha=my-beta*mx,e=Array.from({length:n},(_,i)=>y[i]-alpha-beta*x[i]);
  const X=Array.from({length:n},(_,i)=>[1,x[i]]);let S=[[0,0],[0,0]];
  const add=(a,b,k)=>{S[0][0]+=k*a[0]*b[0];S[0][1]+=k*a[0]*b[1];S[1][0]+=k*a[1]*b[0];S[1][1]+=k*a[1]*b[1];};
  for(let t=0;t<n;t++)add(X[t].map(v=>v*e[t]),X[t].map(v=>v*e[t]),1);
  for(let l=1;l<=lag;l++){const w=1-l/(lag+1);for(let t=l;t<n;t++){const a=X[t].map(v=>v*e[t]),b=X[t-l].map(v=>v*e[t-l]);add(a,b,w);add(b,a,w);}}
  const a=n,bx=X.reduce((s,r)=>s+r[1],0),d=X.reduce((s,r)=>s+r[1]*r[1],0),det=a*d-bx*bx;
  if(!(Math.abs(det)>1e-18))return null;
  const inv=[[d/det,-bx/det],[-bx/det,a/det]],M=[[0,0],[0,0]];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let p=0;p<2;p++)for(let q=0;q<2;q++)M[i][j]+=inv[i][p]*S[p][q]*inv[q][j];
  const se=Math.sqrt(Math.max(0,M[0][0]));
  return {alphaMonthly:alpha,betaSpy:beta,hac12SeAlpha:se,tStat:se>0?alpha/se:null};
}

function evaluateBlock({input,primarySignals,eqSignals,momSignals,executionCalendar,valuationCalendar,startB,endB,costBps}){
  const s=input.series;
  const primary=simulate({seriesBySymbol:s,valuationCalendar,executionCalendar,signals:primarySignals,startBoundary:startB,endBoundary:endB,costBps,label:'primary'});
  const equal9=simulate({seriesBySymbol:s,valuationCalendar,executionCalendar,signals:eqSignals,startBoundary:startB,endBoundary:endB,costBps,label:'equal9'});
  const momentum12_2=simulate({seriesBySymbol:s,valuationCalendar,executionCalendar,signals:momSignals,startBoundary:startB,endBoundary:endB,costBps,label:'momentum12_2'});
  const spy=benchmarkCurve(s.SPY,primary.start,primary.end,costBps);
  const urth=benchmarkCurve(s.URTH,primary.start,primary.end,costBps);
  const gates={
    excessVsSpy:primary.metrics.cagrPct>spy.metrics.cagrPct,
    excessVsUrth:primary.metrics.cagrPct>urth.metrics.cagrPct,
    excessVsEqual9:primary.metrics.cagrPct>equal9.metrics.cagrPct,
    drawdownNoWorseUrth:primary.metrics.maxDrawdownPct>=urth.metrics.maxDrawdownPct,
    sharpeAtLeastUrth:primary.metrics.sharpe>=urth.metrics.sharpe
  };
  const pr=monthlyPortfolioReturns(primary),eq=monthlyPortfolioReturns(equal9);
  const eventDates=primary.eventEquity.map(x=>x.date);
  const sr=monthlyBenchmarkReturns(spy,eventDates,primary.end);
  const ur=monthlyBenchmarkReturns(urth,eventDates,primary.end);
  if(!(pr.returns.length===sr.returns.length&&pr.returns.length===ur.returns.length))throw new Error('MONTHLY_PAIRING_MISMATCH');
  const n=Math.min(pr.returns.length,eq.returns.length,sr.returns.length);
  const selectorDiff=Array.from({length:n},(_,i)=>pr.returns[i]-eq.returns[i]);
  const selectorIncrementalHac12=hacAlpha(selectorDiff,sr.returns.slice(0,n),12);
  return {
    costBpsPerSide:costBps,primary,equal9,momentum12_2,spy,urth,
    gates,gatePassed:Object.values(gates).every(Boolean),
    monthly:{candidate:pr.returns,spy:sr.returns,urth:ur.returns,labels:pr.labels},
    hitRates:hitRates(pr.returns,sr.returns,ur.returns,pr.labels),
    selectorIncrementalHac12
  };
}

function publicBlock(block){
  if(!block)return null;
  const pick=x=>({totalReturnPct:x.metrics.totalReturnPct,cagrPct:x.metrics.cagrPct,annualizedVolPct:x.metrics.annualizedVolPct,maxDrawdownPct:x.metrics.maxDrawdownPct,sharpe:x.metrics.sharpe});
  return {
    costBpsPerSide:block.costBpsPerSide,gatePassed:block.gatePassed,gates:block.gates,
    candidate:pick(block.primary),spy:pick(block.spy),urth:pick(block.urth),equal9:pick(block.equal9),momentum12_2:pick(block.momentum12_2),
    hitRates:block.hitRates.nonOverlapping12,selectorIncrementalHac12:block.selectorIncrementalHac12,
    start:block.primary.start,end:block.primary.end,totalCost:block.primary.totalCost,turnoverOnInitialCapital:block.primary.turnoverOnInitialCapital
  };
}

function finiteMetricBlock(block){
  if(!block) return false;
  const metricObjects=[block.primary?.metrics,block.equal9?.metrics,block.momentum12_2?.metrics,block.spy?.metrics,block.urth?.metrics];
  const metricKeys=['totalReturnPct','cagrPct','annualizedVolPct','maxDrawdownPct'];
  return metricObjects.every(m=>m&&metricKeys.every(k=>Number.isFinite(Number(m[k]))))
    && Number.isFinite(Number(block.primary?.totalCost))
    && Number.isFinite(Number(block.primary?.turnoverOnInitialCapital));
}
function assertFiniteEconomicBlock(block,label){
  if(!finiteMetricBlock(block)) throw new Error('NON_FINITE_ECONOMIC_BLOCK:'+label);
}
function existingResultIsValid(existing){
  if(!existing||existing.study!==P.version||existing.implementationRevision!==P.implementationRevision) return false;
  if(!existing.diagnostic?.cost10||!existing.diagnostic?.cost20) return false;
  if(!finiteMetricBlock(existing.diagnostic.cost10)||!finiteMetricBlock(existing.diagnostic.cost20)) return false;
  if(existing.replication){
    if(!finiteMetricBlock(existing.replication.cost10)||!finiteMetricBlock(existing.replication.cost20)) return false;
  }
  return true;
}

function publicSummary(result){
  return {
    schemaVersion:1,study:result.study,implementationRevision:result.implementationRevision,status:result.status,provider:result.provider,inputSha256:result.inputSha256,
    diagnostic10:publicBlock(result.diagnostic?.cost10),diagnostic20:publicBlock(result.diagnostic?.cost20),
    replication10:publicBlock(result.replication?.cost10),replication20:publicBlock(result.replication?.cost20),
    statistics:result.statistics??null,userFrequencyTarget:result.userFrequencyTarget??null,
    productionDefault:'LEGACY',productionAuthority:false,promotionAllowed:false
  };
}

if(fs.existsSync(outputPath)){
  const existingText=fs.readFileSync(outputPath,'utf8');
  const existing=JSON.parse(existingText);
  if(existing.study!==P.version)throw new Error('EXISTING_RESULT_STUDY_MISMATCH');
  if(existingResultIsValid(existing)){
    console.log(RESULT_MARKER,JSON.stringify(publicSummary(existing)));
    process.exit(0);
  }
  const invalidPath=outputPath.replace(/\.json$/,'-invalid-technical-v1.json');
  if(!fs.existsSync(invalidPath)) fs.writeFileSync(invalidPath,existingText);
  fs.unlinkSync(outputPath);
  console.error('SECTOR_52W_HIGH_LEADERSHIP_V1_TECHNICAL_INVALID_ARCHIVED',invalidPath);
}

const inputText=fs.readFileSync(inputPath,'utf8'),input=JSON.parse(inputText);
if(input.study!==P.version)throw new Error('INPUT_STUDY_MISMATCH');
if(input.productionDefault!=='LEGACY'||input.productionAuthority!==false)throw new Error('INPUT_PRODUCTION_INVALID');
if(input.provenance!=='REAL')throw new Error('NON_REAL_INPUT');
if(input.provider==='WOLFRAM_FINANCIALDATA'&&input.reconciliation?.status!=='PASS')throw new Error('INCONCLUSIVE_DATA_RECONCILIATION');
for(const s of [...P.sectors,...P.benchmarks]){
  if(!input.series?.[s])throw new Error('MISSING_SERIES:'+s);
  assertSeries(input.series[s],s);
  if(input.seriesMeta?.[s]?.currency!=='USD')throw new Error('NON_USD:'+s);
}

const executionCalendar=assertFullCoverage(input.series,P.sectors,input.downloadFrom,input.downloadThrough);
const valuationCalendar=assertFullCoverage(input.series,[...P.sectors,...P.benchmarks],P.diagnostic.startOnOrAfter,input.downloadThrough);
const primarySignals=buildPrimaryMonthlySignals(input.series,P.sectors);
const momSignals=buildMomentumMonthlySignals(input.series,P.sectors);
const eqWeights=Object.fromEntries(P.sectors.map(s=>[s,1/P.sectors.length]));
const eqSignals=constantSignals(primarySignals,eqWeights);

const diagnostic={
  cost10:evaluateBlock({input,primarySignals,eqSignals,momSignals,executionCalendar,valuationCalendar,startB:P.diagnostic.startOnOrAfter,endB:P.diagnostic.endOnOrAfter,costBps:P.costs.primaryBpsPerSide}),
  cost20:evaluateBlock({input,primarySignals,eqSignals,momSignals,executionCalendar,valuationCalendar,startB:P.diagnostic.startOnOrAfter,endB:P.diagnostic.endOnOrAfter,costBps:P.costs.doubleBpsPerSide})
};
assertFiniteEconomicBlock(diagnostic.cost10,'diagnostic10');
assertFiniteEconomicBlock(diagnostic.cost20,'diagnostic20');

let replication=null,status=diagnostic.cost20.gatePassed?'PASS_DIAGNOSTIC_CONTINUE_REPLICATION':'FAIL_DIAGNOSTIC';
if(diagnostic.cost20.gatePassed){
  replication={
    cost10:evaluateBlock({input,primarySignals,eqSignals,momSignals,executionCalendar,valuationCalendar,startB:P.replication.startOnOrAfter,endB:P.replication.endOnOrAfter,costBps:P.costs.primaryBpsPerSide}),
    cost20:evaluateBlock({input,primarySignals,eqSignals,momSignals,executionCalendar,valuationCalendar,startB:P.replication.startOnOrAfter,endB:P.replication.endOnOrAfter,costBps:P.costs.doubleBpsPerSide})
  };
  assertFiniteEconomicBlock(replication.cost10,'replication10');
  assertFiniteEconomicBlock(replication.cost20,'replication20');
  status=replication.cost20.gatePassed?'PASS_REPLICATION_GATES_PENDING_STATISTICS':'FAIL_REPLICATION';
}

const result={
  schemaVersion:1,study:P.version,implementationRevision:P.implementationRevision,status,provider:input.provider,inputSha256:sha256(inputText),
  diagnostic,replication,statistics:null,userFrequencyTarget:null,
  productionDefault:'LEGACY',productionAuthority:false,promotionAllowed:false
};

if(replication?.cost20.gatePassed){
  const d=diagnostic.cost20.monthly,r=replication.cost20.monthly;
  const db=bootstrapJointExcess(d.candidate,d.spy,d.urth,{block:12,reps:2000,seed:20260928});
  const rb=bootstrapJointExcess(r.candidate,r.spy,r.urth,{block:12,reps:2000,seed:20260928});
  const statisticsPassed=db.lowerOneSided95PctPoints>0&&rb.lowerOneSided95PctPoints>0;
  result.statistics={diagnostic:db,replication:rb,passed:statisticsPassed,rule:'one-sided 95% lower bound of joint min(CAGR excess vs SPY, URTH) > 0 in each block'};
  result.userFrequencyTarget={
    targetPct:80,
    diagnosticPct:diagnostic.cost20.hitRates.nonOverlapping12.bothPct,
    replicationPct:replication.cost20.hitRates.nonOverlapping12.bothPct,
    met:diagnostic.cost20.hitRates.nonOverlapping12.bothPct>=80&&replication.cost20.hitRates.nonOverlapping12.bothPct>=80,
    futureProbabilityClaim:false
  };
  result.status=statisticsPassed?'PASS_RESEARCH_CANDIDATE_NO_PROMOTION':'INCONCLUSIVE_STATISTICAL_EVIDENCE';
}

fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(RESULT_MARKER,JSON.stringify(publicSummary(result)));
