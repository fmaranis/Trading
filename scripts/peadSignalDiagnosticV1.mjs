import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const PEAD_SIGNAL_V1=Object.freeze({
  study:'PEAD_ANALYST_SURPRISE_V1',
  sourceStudy:'PEAD_EARNINGS_SOURCE_AUDIT_R2',
  sourceRevision:'YAHOO_CALENDAR_RANGE_DUAL_PIT_R2',
  window:{from:'2024-01-15',to:'2024-03-15'},
  minimumSourceEvents:440,
  minimumAbsolutePriceCoverage:415,
  minimumPriceCoveragePct:90,
  horizonSessions:60,
  benchmark:'SPY',
  permutationIterations:2000,
  permutationSeed:20260929,
  maximumOneSidedPValue:0.05,
  priceDownload:{from:'2024-01-02',through:'2024-07-31'},
  productionDefault:'LEGACY',
  productionAuthority:false
});

const OUT='validation-runs/diagnostics/pead-signal-diagnostic-v1-result.json';
const CACHE='.runtime/pead-signal-diagnostic-v1';
const MARKER='PEAD_ANALYST_SURPRISE_V1_RESULT';

function gitBlobSha(text){
  const bytes=Buffer.from(text,'utf8');
  return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function rawUrl(source){
  return 'https://raw.githubusercontent.com/'+source.repository+'/'+source.commit+'/'+source.path;
}
function nextDay(date){return new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
function finitePositive(v){return Number.isFinite(Number(v))&&Number(v)>0;}

export function signalEventsFromR2(sourceResult){
  if(sourceResult?.study!=='PEAD_EARNINGS_SOURCE_AUDIT_R2'
    ||sourceResult?.sourceRevision!==PEAD_SIGNAL_V1.sourceRevision
    ||sourceResult?.status!=='PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R2'
    ||sourceResult?.audit?.passed!==true
    ||sourceResult?.priceOutcomesFetched!==false
    ||sourceResult?.economicOutcomesOpened!==false){
    throw new Error('PEAD_SIGNAL_R2_SOURCE_NOT_READY');
  }
  const events=Array.isArray(sourceResult.causalEvents)?sourceResult.causalEvents:[];
  if(events.length<PEAD_SIGNAL_V1.minimumSourceEvents)throw new Error('PEAD_SIGNAL_R2_SOURCE_EVENT_COUNT:'+events.length);
  const seen=new Set();
  return events.map(row=>{
    const ticker=String(row?.ticker??'').trim().toUpperCase();
    const reportDate=String(row?.reportDate??'').slice(0,10);
    const timing=String(row?.timing??'');
    const surprise=Number(row?.surprisePct);
    if(!ticker||!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)
      ||(timing!=='BeforeMarket'&&timing!=='AfterMarket')
      ||!Number.isFinite(surprise)){
      throw new Error('PEAD_SIGNAL_R2_SOURCE_EVENT_INVALID');
    }
    const key=ticker+'|'+reportDate;
    if(seen.has(key))throw new Error('PEAD_SIGNAL_R2_SOURCE_EVENT_DUPLICATE:'+key);
    seen.add(key);
    return {ticker,reportDate,timing,surprise};
  }).sort((a,b)=>a.reportDate.localeCompare(b.reportDate)||a.ticker.localeCompare(b.ticker));
}

export function parseYahooPricePayload(symbol,text){
  const payload=JSON.parse(text),result=payload?.chart?.result?.[0];
  if(payload?.chart?.error)throw new Error('YAHOO_CHART_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length)throw new Error('YAHOO_NO_DATA:'+symbol);
  const quote=result.indicators?.quote?.[0]??{},adj=result.indicators?.adjclose?.[0]?.adjclose??[];
  const bars=[];
  for(let i=0;i<result.timestamp.length;i++){
    const rawOpen=Number(quote.open?.[i]),rawClose=Number(quote.close?.[i]),adjustedClose=Number(adj[i]);
    if(!finitePositive(rawOpen)||!finitePositive(rawClose)||!finitePositive(adjustedClose))continue;
    const adjustedOpen=rawOpen*adjustedClose/rawClose;
    if(!finitePositive(adjustedOpen))continue;
    bars.push({
      date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),
      adjustedOpen,
      adjustedClose
    });
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  if(bars.length<PEAD_SIGNAL_V1.horizonSessions+2)throw new Error('YAHOO_INSUFFICIENT_BARS:'+symbol+':'+bars.length);
  return bars;
}

export function resolveEventOutcome(event,bars,spyBars){
  const after=event.timing==='AfterMarket';
  const entryIndex=bars.findIndex(bar=>after?bar.date>event.reportDate:bar.date>=event.reportDate);
  if(entryIndex<0)return null;
  const exitIndex=entryIndex+PEAD_SIGNAL_V1.horizonSessions;
  if(exitIndex>=bars.length)return null;
  const entry=bars[entryIndex],exit=bars[exitIndex];
  const spyByDate=new Map(spyBars.map(bar=>[bar.date,bar]));
  const spyEntry=spyByDate.get(entry.date),spyExit=spyByDate.get(exit.date);
  if(!spyEntry||!spyExit)return null;
  const stockReturn60=exit.adjustedClose/entry.adjustedOpen-1;
  const spyReturn60=spyExit.adjustedClose/spyEntry.adjustedOpen-1;
  if(!Number.isFinite(stockReturn60)||!Number.isFinite(spyReturn60))return null;
  return {
    ticker:event.ticker,
    reportDate:event.reportDate,
    timing:event.timing,
    surprise:event.surprisePct,
    entryDate:entry.date,
    exitDate:exit.date,
    stockReturn60,
    spyReturn60,
    excessReturn60:stockReturn60-spyReturn60
  };
}

function average(values){return values.length?values.reduce((sum,v)=>sum+v,0)/values.length:NaN;}

export function averageRanks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index);
  const ranks=new Array(values.length);
  let i=0;
  while(i<indexed.length){
    let j=i+1;
    while(j<indexed.length&&indexed[j].value===indexed[i].value)j++;
    const rank=(i+1+j)/2;
    for(let k=i;k<j;k++)ranks[indexed[k].index]=rank;
    i=j;
  }
  return ranks;
}

export function pearson(a,b){
  if(a.length!==b.length||a.length<2)return NaN;
  const ma=average(a),mb=average(b);
  let num=0,da=0,db=0;
  for(let i=0;i<a.length;i++){
    const xa=a[i]-ma,xb=b[i]-mb;
    num+=xa*xb;da+=xa*xa;db+=xb*xb;
  }
  return da>0&&db>0?num/Math.sqrt(da*db):NaN;
}

export function spearman(a,b){return pearson(averageRanks(a),averageRanks(b));}

function reportWeekKey(date){
  const ms=Date.parse(date+'T00:00:00Z');
  return String(Math.floor(ms/(7*86400000)));
}

function seededRandom(seed){
  let state=seed>>>0;
  return ()=>{
    state^=state<<13; state^=state>>>17; state^=state<<5;
    return (state>>>0)/4294967296;
  };
}

export function permuteSurprisesWithinReportWeek(outcomes,random){
  const shuffled=outcomes.map(row=>({...row}));
  const groups=new Map();
  for(let i=0;i<shuffled.length;i++){
    const key=reportWeekKey(shuffled[i].reportDate);
    const indexes=groups.get(key)??[];
    indexes.push(i);groups.set(key,indexes);
  }
  for(const indexes of groups.values()){
    const values=indexes.map(index=>shuffled[index].surprise);
    for(let i=values.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [values[i],values[j]]=[values[j],values[i]];
    }
    indexes.forEach((index,i)=>{shuffled[index].surprise=values[i];});
  }
  return shuffled;
}

export function permutationPValues(outcomes,observedRho,observedSpread,iterations=PEAD_SIGNAL_V1.permutationIterations,seed=PEAD_SIGNAL_V1.permutationSeed){
  const random=seededRandom(seed);
  let rhoAtLeast=0,spreadAtLeast=0;
  for(let i=0;i<iterations;i++){
    const permuted=permuteSurprisesWithinReportWeek(outcomes,random);
    const rho=spearman(permuted.map(row=>row.surprise),permuted.map(row=>row.excessReturn60));
    const groups=quintileGroups(permuted);
    const q1Mean=average(groups[0].map(row=>row.excessReturn60));
    const q5Mean=average(groups[4].map(row=>row.excessReturn60));
    const spread=q5Mean-q1Mean;
    if(Number.isFinite(rho)&&rho>=observedRho)rhoAtLeast++;
    if(Number.isFinite(spread)&&spread>=observedSpread)spreadAtLeast++;
  }
  return {
    iterations,
    seed,
    method:'ONE_SIDED_WITHIN_REPORT_WEEK_PERMUTATION',
    spearmanP:(rhoAtLeast+1)/(iterations+1),
    extremeSpreadP:(spreadAtLeast+1)/(iterations+1)
  };
}

export function quintileGroups(outcomes){
  const sorted=[...outcomes].sort((a,b)=>a.surprise-b.surprise||a.reportDate.localeCompare(b.reportDate)||a.ticker.localeCompare(b.ticker));
  const groups=Array.from({length:5},()=>[]);
  for(let i=0;i<sorted.length;i++)groups[Math.min(4,Math.floor(i*5/sorted.length))].push(sorted[i]);
  return groups;
}

export function evaluateDiagnostic(outcomes,sourceEvents){
  const coveragePct=sourceEvents?100*outcomes.length/sourceEvents:0;
  const minimumUsable=Math.max(
    PEAD_SIGNAL_V1.minimumAbsolutePriceCoverage,
    Math.ceil(sourceEvents*PEAD_SIGNAL_V1.minimumPriceCoveragePct/100)
  );
  if(sourceEvents<PEAD_SIGNAL_V1.minimumSourceEvents||outcomes.length<minimumUsable){
    return {
      status:'INCONCLUSIVE_SIGNAL_DATA_COVERAGE',
      coverage:{sourceEvents,usableOutcomes:outcomes.length,coveragePct,minimumUsable},
      gates:{priceCoverage:false},
      passed:false
    };
  }
  const rho=spearman(outcomes.map(row=>row.surprise),outcomes.map(row=>row.excessReturn60));
  const groups=quintileGroups(outcomes);
  const q1=groups[0],q5=groups[4];
  const q1Mean=average(q1.map(row=>row.excessReturn60));
  const q5Mean=average(q5.map(row=>row.excessReturn60));
  const q5HitRate=100*q5.filter(row=>row.excessReturn60>0).length/q5.length;
  const spread=q5Mean-q1Mean;
  const permutation=permutationPValues(outcomes,rho,spread);
  const gates={
    priceCoverage:true,
    positiveSpearman:Number.isFinite(rho)&&rho>0,
    significantSpearman:Number.isFinite(permutation.spearmanP)&&permutation.spearmanP<PEAD_SIGNAL_V1.maximumOneSidedPValue,
    positiveExtremeSpread:Number.isFinite(spread)&&spread>0,
    significantExtremeSpread:Number.isFinite(permutation.extremeSpreadP)&&permutation.extremeSpreadP<PEAD_SIGNAL_V1.maximumOneSidedPValue,
    positiveLongSide:Number.isFinite(q5Mean)&&q5Mean>0,
    longSideHitRate:q5HitRate>50
  };
  const passed=Object.values(gates).every(Boolean);
  return {
    status:passed?'PASS_SIGNAL_DIAGNOSTIC_CANDIDATE_FOR_FRESH_CONFIRMATION':'FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY',
    coverage:{sourceEvents,usableOutcomes:outcomes.length,coveragePct,minimumUsable},
    metrics:{
      spearmanRho:rho,
      q1MeanExcessReturn60:q1Mean,
      q5MeanExcessReturn60:q5Mean,
      q5MinusQ1MeanExcessReturn60:spread,
      q5ExcessHitRatePct:q5HitRate,
      quintileCounts:groups.map(group=>group.length),
      permutation
    },
    gates,
    passed
  };
}

async function fetchYahoo(symbol){
  const dir=path.join(CACHE,'yahoo');
  fs.mkdirSync(dir,{recursive:true});
  const safe=symbol.replace(/[^A-Za-z0-9._-]/g,'_');
  const file=path.join(dir,safe+'.json');
  let text;
  if(fs.existsSync(file))text=fs.readFileSync(file,'utf8');
  else{
    const p1=Math.floor(Date.parse(PEAD_SIGNAL_V1.priceDownload.from+'T00:00:00Z')/1000);
    const p2=Math.floor(Date.parse(nextDay(PEAD_SIGNAL_V1.priceDownload.through)+'T00:00:00Z')/1000);
    const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)
      +'?period1='+p1+'&period2='+p2+'&interval=1d&events=history&includeAdjustedClose=true';
    let lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,{
          headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 Custodia/1.0'},
          signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)
        });
        text=await response.text();
        if(response.ok){JSON.parse(text);fs.writeFileSync(file,text,'utf8');lastError=null;break;}
        lastError=new Error('YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,160));
        if(![429,500,502,503,504].includes(response.status))break;
      }catch(error){lastError=error;}
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
    }
    if(lastError)throw lastError;
  }
  return parseYahooPricePayload(symbol,text);
}

async function mapLimit(items,limit,fn){
  const results=new Array(items.length);let cursor=0;
  async function worker(){
    for(;;){
      const index=cursor++;
      if(index>=items.length)return;
      results[index]=await fn(items[index]);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return results;
}

export async function main(){
  const sourcePath='validation-runs/diagnostics/pead-yahoo-calendar-source-audit-r2-result.json';
  if(!fs.existsSync(sourcePath))throw new Error('PEAD_SIGNAL_R2_SOURCE_RESULT_MISSING');
  const sourceResult=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
  const events=signalEventsFromR2(sourceResult);

  const symbols=[PEAD_SIGNAL_V1.benchmark,...new Set(events.map(event=>event.ticker))];
  const failures=[];
  const rows=await mapLimit(symbols,4,async symbol=>{
    try{return {symbol,bars:await fetchYahoo(symbol),error:null};}
    catch(error){return {symbol,bars:null,error:error?.message??String(error)};}
  });
  const bySymbol=new Map(rows.filter(row=>row.bars).map(row=>[row.symbol,row.bars]));
  for(const row of rows)if(row.error)failures.push({symbol:row.symbol,error:row.error});
  const spy=bySymbol.get(PEAD_SIGNAL_V1.benchmark);
  if(!spy)throw new Error('PEAD_SIGNAL_SPY_UNAVAILABLE');

  const outcomes=[];
  const missingOutcome=[];
  for(const event of events){
    const bars=bySymbol.get(event.ticker);
    if(!bars){missingOutcome.push({ticker:event.ticker,reportDate:event.reportDate,reason:'PRICE_SERIES_UNAVAILABLE'});continue;}
    const outcome=resolveEventOutcome(event,bars,spy);
    if(outcome)outcomes.push(outcome);
    else missingOutcome.push({ticker:event.ticker,reportDate:event.reportDate,reason:'OUTCOME_WINDOW_UNAVAILABLE'});
  }

  const evaluation=evaluateDiagnostic(outcomes,events.length);
  const result={
    schemaVersion:1,
    study:PEAD_SIGNAL_V1.study,
    sourceStudy:PEAD_SIGNAL_V1.sourceStudy,
    sourceRevision:PEAD_SIGNAL_V1.sourceRevision,
    status:evaluation.status,
    window:PEAD_SIGNAL_V1.window,
    horizonSessions:PEAD_SIGNAL_V1.horizonSessions,
    predictor:'Yahoo Surprise(%)',
    eventProvenance:'REAL_YAHOO_CALENDAR_WITH_STATIC_REFERENCE_PIT',
    priceProvider:'Yahoo Finance',
    priceProvenance:'REAL',
    benchmark:PEAD_SIGNAL_V1.benchmark,
    executionSemantics:{BeforeMarket:'SAME_DATE_OR_NEXT_REGULAR_OPEN',AfterMarket:'NEXT_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE'},
    evaluation,
    fetch:{uniqueSymbols:symbols.length,failures,missingOutcomeCount:missingOutcome.length,missingOutcome:missingOutcome.slice(0,100)},
    sampleAuthority:'DIAGNOSTIC_CONSUMED_AFTER_THIS_RUN',
    economicPolicyOpened:false,
    productionDefault:'LEGACY',
    productionAuthority:false,
    promotionAllowed:false
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(MARKER,JSON.stringify(result));
  if(!evaluation.passed)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{
    console.error(MARKER,JSON.stringify({
      status:'BLOCKED',
      reason:error?.message??String(error),
      economicPolicyOpened:false,
      productionDefault:'LEGACY'
    }));
    process.exitCode=1;
  });
}
