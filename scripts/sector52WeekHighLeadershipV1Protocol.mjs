export const SECTOR_52W_HIGH_LEADERSHIP_V1 = Object.freeze({
  version:'SECTOR_52W_HIGH_LEADERSHIP_V1',
  researchOnly:true,
  productionAuthority:false,
  productionDefault:'LEGACY',
  sectors:['XLB','XLE','XLF','XLI','XLK','XLP','XLU','XLV','XLY'],
  benchmarks:['SPY','URTH'],
  signalWindowSessions:252,
  selectedCount:3,
  voteMonths:6,
  maxWeight:1/3,
  diagnostic:{startOnOrAfter:'2013-01-01',endOnOrAfter:'2019-01-01'},
  replication:{startOnOrAfter:'2019-01-01',endOnOrAfter:'2026-01-01'},
  costs:{primaryBpsPerSide:10,doubleBpsPerSide:20},
  momentumControl:{id:'SECTOR_12_2_ABLATION',formula:'monthEndClose[t-2]/monthEndClose[t-12]-1',promotionAuthority:false},
  sourcePolicy:{primary:'YAHOO_CHART_EXISTING_PROVIDER',fallback:'WOLFRAM_FINANCIALDATA_REAL_SECONDARY_REQUIRES_OFFICIAL_NAV_RECONCILIATION'},
  tieBreak:'TICKER_ASCII_ASC'
});

export function toDate(row){ return String(row.date??row.timestamp).slice(0,10); }
export function sortBars(bars){ return [...bars].sort((a,b)=>toDate(a).localeCompare(toDate(b))); }

export function assertSeries(bars,label='series'){
  if(!Array.isArray(bars)||bars.length===0) throw new Error('EMPTY_SERIES:'+label);
  let prev='';
  for(const row of bars){
    const d=toDate(row), o=Number(row.open), c=Number(row.close);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!(o>0)||!(c>0)) throw new Error('INVALID_BAR:'+label+':'+d);
    if(prev && d<=prev) throw new Error('NON_ASCENDING_OR_DUPLICATE:'+label+':'+d);
    prev=d;
  }
}

export function assertFullCoverage(seriesBySymbol,symbols,startDate,endDate){
  const ref=sortBars(seriesBySymbol[symbols[0]]).filter(r=>toDate(r)>=startDate&&toDate(r)<=endDate).map(toDate);
  if(!ref.length) throw new Error('NO_REFERENCE_CALENDAR');
  for(const symbol of symbols.slice(1)){
    const ds=sortBars(seriesBySymbol[symbol]).filter(r=>toDate(r)>=startDate&&toDate(r)<=endDate).map(toDate);
    if(ds.length!==ref.length) throw new Error('COVERAGE_LENGTH:'+symbol+':'+ds.length+':'+ref.length);
    for(let i=0;i<ref.length;i++) if(ds[i]!==ref[i]) throw new Error('COVERAGE_DATE:'+symbol+':'+ref[i]+':'+ds[i]);
  }
  return ref;
}

export function firstDateOnOrAfter(calendar,date){
  const found=calendar.find(value=>value>=date);
  if(!found) throw new Error('BOUNDARY_MISSING:'+date);
  return found;
}

export function monthEndIndices(bars){
  const xs=sortBars(bars); const out=[];
  for(let i=0;i<xs.length;i++){
    const m=toDate(xs[i]).slice(0,7), next=i+1<xs.length?toDate(xs[i+1]).slice(0,7):null;
    if(m!==next) out.push(i);
  }
  return out;
}

export function score52w(bars,index,window=252){
  if(index<window-1) return null;
  let hi=-Infinity;
  for(let i=index-window+1;i<=index;i++) hi=Math.max(hi,Number(bars[i].close));
  const c=Number(bars[index].close);
  return c/hi;
}

export function selectTop(scores,count=3){
  return Object.entries(scores)
    .filter(([,v])=>Number.isFinite(Number(v)))
    .sort((a,b)=>Number(b[1])-Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0,count).map(([s])=>s);
}

export function voteWeights(selections,voteMonths=6){
  if(selections.length<voteMonths) throw new Error('VOTE_WARMUP');
  const recent=selections.slice(-voteMonths), counts={};
  for(const sel of recent) for(const s of sel) counts[s]=(counts[s]??0)+1;
  const out={}; for(const [s,n] of Object.entries(counts)) out[s]=n/(voteMonths*3);
  const sum=Object.values(out).reduce((a,b)=>a+b,0);
  if(Math.abs(sum-1)>1e-12) throw new Error('WEIGHT_SUM:'+sum);
  if(Object.values(out).some(w=>w>1/3+1e-12)) throw new Error('WEIGHT_CAP');
  return out;
}

export function regressionSlopeAnnualizedPct(values,lookback){
  if(values.length<lookback||lookback<2) return null;
  const slice=values.slice(-lookback);
  if(slice.some(v=>!Number.isFinite(Number(v))||Number(v)<=0)) return null;
  const logs=slice.map(v=>Math.log(Number(v))),n=logs.length,meanX=(n-1)/2,meanY=logs.reduce((a,b)=>a+b,0)/n;
  let num=0,den=0;
  for(let i=0;i<n;i++){const dx=i-meanX;num+=dx*(logs[i]-meanY);den+=dx*dx;}
  if(!(den>0)) return null;
  return (Math.exp((num/den)*252)-1)*100;
}

export function descriptiveTechnicals(bars,index){
  const xs=sortBars(bars), closes=xs.slice(0,index+1).map(r=>Number(r.close));
  const current=closes.at(-1)??null;
  const prior20=closes.length>=21?closes.slice(-21,-1):[];
  const prior252=closes.length>=253?closes.slice(-253,-1):[];
  const slope20=regressionSlopeAnnualizedPct(closes,20);
  const slope60=regressionSlopeAnnualizedPct(closes,60);
  const slope120=regressionSlopeAnnualizedPct(closes,120);
  return {
    slope20AnnualizedPct:slope20,
    slope60AnnualizedPct:slope60,
    slope120AnnualizedPct:slope120,
    slopeAcceleration20vs60PctPoints:slope20!=null&&slope60!=null?slope20-slope60:null,
    breakout20:current!=null&&prior20.length===20?current>Math.max(...prior20):null,
    breakout252:current!=null&&prior252.length===252?current>Math.max(...prior252):null
  };
}

export function buildPrimaryMonthlySignals(seriesBySymbol,sectors){
  const ref=sortBars(seriesBySymbol[sectors[0]]);
  const monthIdx=monthEndIndices(ref), history=[], out=[];
  for(const idx of monthIdx){
    const date=toDate(ref[idx]), scores={}, descriptive={};
    for(const s of sectors){
      const bars=sortBars(seriesBySymbol[s]);
      if(toDate(bars[idx])!==date) throw new Error('SECTOR_CALENDAR_MISMATCH:'+s+':'+date);
      scores[s]=score52w(bars,idx,252);
      descriptive[s]=descriptiveTechnicals(bars,idx);
    }
    if(Object.values(scores).every(Number.isFinite)){
      const selected=selectTop(scores,3); history.push(selected);
      if(history.length>=6) out.push({signalDate:date,index:idx,scores,selected,weights:voteWeights(history,6),descriptive});
    }
  }
  return out;
}

export function buildMomentumMonthlySignals(seriesBySymbol,sectors){
  const ref=sortBars(seriesBySymbol[sectors[0]]), mIdx=monthEndIndices(ref), history=[], out=[];
  for(let j=12;j<mIdx.length;j++){
    const idx=mIdx[j], i2=mIdx[j-2], i12=mIdx[j-12], date=toDate(ref[idx]), scores={};
    for(const s of sectors){
      const bars=sortBars(seriesBySymbol[s]);
      scores[s]=Number(bars[i2].close)/Number(bars[i12].close)-1;
    }
    const selected=selectTop(scores,3); history.push(selected);
    if(history.length>=6) out.push({signalDate:date,index:idx,scores,selected,weights:voteWeights(history,6)});
  }
  return out;
}

export function addExecutionDates(signals,calendar){
  const index=new Map(calendar.map((d,i)=>[d,i]));
  return signals.map(s=>{
    const i=index.get(s.signalDate);
    if(i==null||i+1>=calendar.length) return {...s,executionDate:null};
    return {...s,executionDate:calendar[i+1]};
  }).filter(x=>x.executionDate);
}

export function rebalanceAtOpen(state,target,opens,costBps){
  const c=costBps/10000;
  const current={}; let pre=Number(state.cash??0);
  for(const [s,shares] of Object.entries(state.shares??{})){
    const v=Number(shares)*Number(opens[s]); current[s]=v; pre+=v;
  }
  let post=pre;
  for(let k=0;k<100;k++){
    let traded=0;
    const names=new Set([...Object.keys(current),...Object.keys(target)]);
    for(const s of names) traded+=Math.abs(post*Number(target[s]??0)-Number(current[s]??0));
    const next=pre-c*traded;
    if(Math.abs(next-post)<1e-14*Math.max(1,pre)){post=next;break;}
    post=next;
  }
  const shares={}; let traded=0; const names=new Set([...Object.keys(current),...Object.keys(target)]);
  for(const s of Object.keys(target)) shares[s]=(post*Number(target[s]))/Number(opens[s]);
  for(const s of names) traded+=Math.abs(Number(shares[s]??0)*Number(opens[s])-Number(current[s]??0));
  const cost=c*traded;
  return {shares,cash:0,equity:pre-cost,tradedNotional:traded,cost};
}

export function liquidateAtOpen(state,opens,costBps){
  let gross=Number(state.cash??0), sold=0;
  for(const [s,shares] of Object.entries(state.shares??{})){const v=Number(shares)*Number(opens[s]);gross+=v;sold+=v;}
  const cost=sold*(costBps/10000);
  return {equity:gross-cost,tradedNotional:sold,cost};
}

export function markAtClose(state,closes){
  let v=Number(state.cash??0); for(const [s,shares] of Object.entries(state.shares??{})) v+=Number(shares)*Number(closes[s]); return v;
}

export function metrics(values,dates=null){
  if(!Array.isArray(values)||values.length<2) throw new Error('METRICS_TOO_SHORT');
  const vals=values.map(Number), rets=[]; let peak=vals[0],dd=0;
  for(let i=1;i<vals.length;i++){rets.push(vals[i]/vals[i-1]-1);peak=Math.max(peak,vals[i]);dd=Math.min(dd,vals[i]/peak-1);}
  const mean=rets.reduce((a,b)=>a+b,0)/rets.length;
  const sd=rets.length>1?Math.sqrt(rets.reduce((s,x)=>s+(x-mean)**2,0)/(rets.length-1)):0;
  let years=(vals.length-1)/252;
  if(Array.isArray(dates)&&dates.length===vals.length){
    const ms=Date.parse(String(dates.at(-1)).slice(0,10)+'T00:00:00Z')-Date.parse(String(dates[0]).slice(0,10)+'T00:00:00Z');
    if(ms>0) years=ms/(365.2425*86400000);
  }
  return {totalReturnPct:(vals.at(-1)/vals[0]-1)*100,cagrPct:(Math.pow(vals.at(-1)/vals[0],1/years)-1)*100,annualizedVolPct:sd*Math.sqrt(252)*100,maxDrawdownPct:dd*100,sharpe:sd>0?mean/sd*Math.sqrt(252):null,years};
}

export function bootstrapMean(values,{block=12,reps=2000,seed=20260928}={}){
  const xs=values.map(Number), n=xs.length;
  let state=seed>>>0; const rnd=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
  const samples=[];
  for(let r=0;r<reps;r++){const out=[];while(out.length<n){const start=Math.floor(rnd()*n);for(let k=0;k<block&&out.length<n;k++)out.push(xs[(start+k)%n]);}samples.push(out.reduce((a,b)=>a+b,0)/out.length);}
  samples.sort((a,b)=>a-b); return {lower95:samples[Math.floor(0.05*reps)],median:samples[Math.floor(0.5*reps)],upper95:samples[Math.floor(0.95*reps)]};
}

export function cagrFromPeriodicReturns(values,periodsPerYear=12){
  if(!Array.isArray(values)||!values.length) throw new Error('CAGR_RETURNS_EMPTY');
  const wealth=values.reduce((w,r)=>w*(1+Number(r)),1);
  return Math.pow(wealth,periodsPerYear/values.length)-1;
}

export function bootstrapJointExcess(candidate,spy,urth,{block=12,reps=2000,seed=20260928}={}){
  const n=Math.min(candidate.length,spy.length,urth.length);
  if(n<block+1) throw new Error('BOOTSTRAP_TOO_SHORT');
  const c=candidate.slice(0,n).map(Number),s=spy.slice(0,n).map(Number),u=urth.slice(0,n).map(Number);
  let state=seed>>>0;
  const rnd=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
  const samples=[];
  for(let r=0;r<reps;r++){
    const idx=[];
    while(idx.length<n){
      const start=Math.floor(rnd()*n);
      for(let k=0;k<block&&idx.length<n;k++) idx.push((start+k)%n);
    }
    const cr=cagrFromPeriodicReturns(idx.map(i=>c[i]));
    const sr=cagrFromPeriodicReturns(idx.map(i=>s[i]));
    const ur=cagrFromPeriodicReturns(idx.map(i=>u[i]));
    samples.push(Math.min(cr-sr,cr-ur));
  }
  samples.sort((a,b)=>a-b);
  return {
    replicates:reps,blockMonths:block,seed,
    lowerOneSided95PctPoints:samples[Math.floor(0.05*reps)]*100,
    medianPctPoints:samples[Math.floor(0.5*reps)]*100,
    upper95PctPoints:samples[Math.floor(0.95*reps)]*100
  };
}
