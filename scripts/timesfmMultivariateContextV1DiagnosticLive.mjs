import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { TIMESFM_MULTIVARIATE_CONTEXT_V1 as P, quarterEndCalendarDates } from './timesfmMultivariateContextV1Protocol.mjs';
import { legacyScannerScore, trailing60LogDriftForecast } from './timesfmStageBProtocol.mjs';
import { callTimesFmMultivariateContextV1 } from './timesfmMultivariateContextV1RemoteClient.mjs';

export const MARKER='TIMESFM_MULTIVARIATE_CONTEXT_V1_RESULT';
export const CACHE_DIR='.runtime/timesfm-multivariate-context-v1/yahoo';
export const PAYLOAD_PATH='.runtime/timesfm-multivariate-context-v1/payload.json';
export const RESULT_PATH='validation-runs/diagnostics/timesfm-multivariate-context-v1-result.json';
const CORE_ID='EUNL';
const TARGET_IDS=P.targets.map(x=>x.assetId);
const TARGET_TICKERS=P.targets.map(x=>x.ticker);
const CANDIDATES=P.targets.filter(x=>x.assetId!==CORE_ID);

function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
function nextDay(date){return new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
function mean(xs){const v=xs.filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
function stdev(xs){const v=xs.filter(Number.isFinite);if(v.length<2)return null;const m=mean(v);return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1));}
function round(v,d=6){return Number.isFinite(v)?Number(Number(v).toFixed(d)):null;}
function sign(v){return v>0?1:v<0?-1:0;}
function ranks(values){
  const a=values.map((value,index)=>({value,index})).sort((x,y)=>x.value-y.value||x.index-y.index);
  const out=new Array(values.length);let i=0;
  while(i<a.length){let j=i+1;while(j<a.length&&a[j].value===a[i].value)j++;const r=(i+j-1)/2+1;for(let k=i;k<j;k++)out[a[k].index]=r;i=j;}
  return out;
}
export function spearman(xs,ys){
  if(xs.length!==ys.length||xs.length<3||xs.some(v=>!Number.isFinite(v))||ys.some(v=>!Number.isFinite(v)))return null;
  const rx=ranks(xs),ry=ranks(ys),mx=mean(rx),my=mean(ry);let c=0,vx=0,vy=0;
  for(let i=0;i<rx.length;i++){const dx=rx[i]-mx,dy=ry[i]-my;c+=dx*dy;vx+=dx*dx;vy+=dy*dy;}
  return vx>0&&vy>0?c/Math.sqrt(vx*vy):null;
}
function zscore(values){
  const m=mean(values),s=stdev(values);
  return values.map(v=>s&&s>1e-12?(v-m)/s:0);
}
function pctReturn(values,lookback,index){
  if(index-lookback<0)return 0;
  const a=values[index-lookback],b=values[index];
  return a>0&&b>0?(b/a-1)*100:0;
}
function realizedVol20(values,index){
  const start=Math.max(1,index-19);const rs=[];
  for(let i=start;i<=index;i++)if(values[i-1]>0&&values[i]>0)rs.push(Math.log(values[i]/values[i-1]));
  const s=stdev(rs);return s==null?0:s*Math.sqrt(252)*100;
}
function drawdown60(values,index){
  const start=Math.max(0,index-59);const slice=values.slice(start,index+1);const peak=Math.max(...slice);return peak>0?(values[index]/peak-1)*100:0;
}

export function parseYahooOhlcvPayload(symbol,text){
  const payload=JSON.parse(text);const result=payload?.chart?.result?.[0];
  if(payload?.chart?.error)throw new Error('YAHOO_CHART_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length)throw new Error('YAHOO_NO_DATA:'+symbol);
  const q=result.indicators?.quote?.[0]??{};const rows=[];
  for(let i=0;i<result.timestamp.length;i++){
    const open=Number(q.open?.[i]),high=Number(q.high?.[i]),low=Number(q.low?.[i]),close=Number(q.close?.[i]),volume=Number(q.volume?.[i]);
    if(![open,high,low,close,volume].every(Number.isFinite)||!(open>0)||!(high>0)||!(low>0)||!(close>0)||volume<0)continue;
    rows.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),open,high,low,close,volume});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return {rows,meta:{symbol:String(result.meta?.symbol??symbol).toUpperCase(),currency:String(result.meta?.currency??'').toUpperCase(),exchange:String(result.meta?.exchangeName??''),instrumentType:String(result.meta?.instrumentType??'').toUpperCase()}};
}

async function fetchYahooRaw(symbol){
  fs.mkdirSync(CACHE_DIR,{recursive:true});const cachePath=path.join(CACHE_DIR,symbol.replace(/[^A-Za-z0-9._-]/g,'_')+'.json');
  if(fs.existsSync(cachePath)){const text=fs.readFileSync(cachePath,'utf8');return{text,cachePath,cached:true,sha256:sha256(text)};}
  const p1=Math.floor(Date.parse(P.data.downloadFrom+'T00:00:00Z')/1000),p2=Math.floor(Date.parse(nextDay(P.data.outcomesThrough)+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history&includeAdjustedClose=true`;
  let last=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},signal:AbortSignal.timeout(30000)});
      const text=await response.text();
      if(response.ok){JSON.parse(text);fs.writeFileSync(cachePath,text,'utf8');return{text,cachePath,cached:false,sha256:sha256(text)};}
      last=new Error('YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,160));
    }catch(e){last=e;}
    if(attempt<2)await new Promise(r=>setTimeout(r,750*(attempt+1)));
  }
  throw last??new Error('YAHOO_FETCH_FAILED:'+symbol);
}

function intersectDates(series){
  const sets=TARGET_TICKERS.map(t=>new Set(series[t].map(x=>x.date)));if(!sets.length)return[];
  return [...sets[0]].filter(d=>sets.every(s=>s.has(d))).sort();
}
function maps(series){return Object.fromEntries(TARGET_TICKERS.map(t=>[t,new Map(series[t].map(r=>[r.date,r]))]));}
function lastOnOrBefore(dates,cutoff){let out=null;for(const d of dates){if(d>cutoff)break;out=d;}return out;}
function anchorKey(date){const y=Number(date.slice(0,4)),m=Number(date.slice(5,7));return `${y}Q${Math.ceil(m/3)}`;}

export function buildAnchors(series){
  const common=intersectDates(series),byTicker=maps(series),anchors=[],skips=[];
  for(const calendarDate of quarterEndCalendarDates()){
    const informationDate=lastOnOrBefore(common,calendarDate);if(!informationDate){skips.push({calendarDate,reason:'NO_COMMON_DATE'});continue;}
    const idx=common.indexOf(informationDate);
    if(idx<P.contextLength+60-1){skips.push({calendarDate,informationDate,reason:'CONTEXT_WARMUP_SHORT',available:idx+1});continue;}
    const futureDates=common.slice(idx+1,idx+1+P.forecastHorizon);
    if(futureDates.length<P.forecastHorizon){skips.push({calendarDate,informationDate,reason:'FUTURE_SHORT',available:futureDates.length});continue;}
    const contextDates=common.slice(idx-P.contextLength+1,idx+1);
    const warmDates=common.slice(idx-P.contextLength-60+1,idx+1);
    const closeHistory={};
    for(const target of P.targets)closeHistory[target.assetId]=warmDates.map(d=>byTicker[target.ticker].get(d).close);
    const targetContext=P.targets.map(target=>contextDates.map(d=>byTicker[target.ticker].get(d).close));
    const covariates=[];
    for(const target of P.targets){
      const vals=contextDates.map(d=>Math.log1p(byTicker[target.ticker].get(d).volume));
      covariates.push(zscore(vals));
    }
    for(const target of P.targets){
      covariates.push(contextDates.map(d=>{const r=byTicker[target.ticker].get(d);return (r.high-r.low)/r.close*100;}));
    }
    const coreAll=closeHistory[CORE_ID];const offset=warmDates.length-contextDates.length;
    const coreVol=[],coreDd=[],disp=[],core20=[],core60=[];
    for(let j=0;j<contextDates.length;j++){
      const wi=offset+j;
      coreVol.push(realizedVol20(coreAll,wi));
      coreDd.push(drawdown60(coreAll,wi));
      core20.push(pctReturn(coreAll,20,wi));
      core60.push(pctReturn(coreAll,60,wi));
      const dailyReturns=[];
      for(const target of P.targets){
        const a=closeHistory[target.assetId];
        if(wi>0&&a[wi-1]>0&&a[wi]>0)dailyReturns.push(Math.log(a[wi]/a[wi-1])*100);
      }
      disp.push(stdev(dailyReturns)??0);
    }
    covariates.push(coreVol,coreDd,disp,core20,core60);
    if(covariates.length!==P.covariates.totalPastOnly)throw new Error('TIMESFM_MV_V1_COVARIATE_BUILD_COUNT:'+covariates.length);
    const anchorId=anchorKey(calendarDate);
    anchors.push({anchorId,calendarDate,informationDate,contextDates,futureDates,targetContext,pastOnlyCovariates:covariates});
  }
  return {anchors,skips};
}

function actualReturn(anchor,series,target,horizon){
  const m=new Map(series[target.ticker].map(r=>[r.date,r.close]));
  const a=m.get(anchor.informationDate),b=m.get(anchor.futureDates[horizon-1]);
  return a>0&&b>0?(b/a-1)*100:null;
}
function predictionFor(remoteAnchor,arm,targetId,horizon,anchor,series){
  const key=arm==='TARGETS_ONLY'?'targetsOnly':'withCausalCovariates';
  const level=Number(remoteAnchor[key]?.point?.[targetId]?.[String(horizon)]);
  const target=P.targets.find(x=>x.assetId===targetId);const m=new Map(series[target.ticker].map(r=>[r.date,r.close]));
  const last=m.get(anchor.informationDate);
  return Number.isFinite(level)&&last>0?(level/last-1)*100:null;
}
function quantileCovered(remoteAnchor,arm,targetId,horizon,anchor,series){
  const key=arm==='TARGETS_ONLY'?'targetsOnly':'withCausalCovariates';
  const q=(remoteAnchor[key]?.quantiles?.[targetId]?.[String(horizon)]??[]).map(Number);
  if(q.length!==9||q.some(v=>!Number.isFinite(v)))return null;
  const target=P.targets.find(x=>x.assetId===targetId),m=new Map(series[target.ticker].map(r=>[r.date,r.close]));
  const actual=m.get(anchor.futureDates[horizon-1]);
  return actual>=q[0]&&actual<=q[8];
}
function evaluateArm(arm,anchors,series,remoteByAnchor){
  const events=[];const core=P.targets.find(x=>x.assetId===CORE_ID);
  for(const anchor of anchors){
    const remote=remoteByAnchor.get(anchor.anchorId);if(!remote)throw new Error('TIMESFM_MV_V1_REMOTE_ANCHOR_MISSING:'+anchor.anchorId);
    const coreRaw=anchor.targetContext[TARGET_IDS.indexOf(CORE_ID)];
    for(const horizon of P.evaluationHorizons){
      const actualCore=actualReturn(anchor,series,core,horizon),predCore=predictionFor(remote,arm,CORE_ID,horizon,anchor,series);
      for(const asset of CANDIDATES){
        const actual=actualReturn(anchor,series,asset,horizon),pred=predictionFor(remote,arm,asset.assetId,horizon,anchor,series);
        if(![actual,actualCore,pred,predCore].every(Number.isFinite))continue;
        const raw=anchor.targetContext[TARGET_IDS.indexOf(asset.assetId)];
        events.push({
          arm,anchorId:anchor.anchorId,informationDate:anchor.informationDate,assetId:asset.assetId,ticker:asset.ticker,horizon,
          actualReturn:actual,actualRelative:actual-actualCore,predReturn:pred,predRelative:pred-predCore,
          legacyScore:legacyScannerScore(raw,asset.defensive===true),momentumRelative:(trailing60LogDriftForecast(raw,horizon)??0)-(trailing60LogDriftForecast(coreRaw,horizon)??0),
          quantile80Covered:quantileCovered(remote,arm,asset.assetId,horizon,anchor,series)
        });
      }
    }
  }
  const metrics=P.evaluationHorizons.map(horizon=>{
    const rows=events.filter(e=>e.horizon===horizon),groups=new Map();
    for(const row of rows){if(!groups.has(row.anchorId))groups.set(row.anchorId,[]);groups.get(row.anchorId).push(row);}
    const rankIcs=[],legacyIcs=[],momentumIcs=[];
    for(const group of groups.values()){
      rankIcs.push(spearman(group.map(x=>x.predRelative),group.map(x=>x.actualRelative)));
      legacyIcs.push(spearman(group.map(x=>x.legacyScore),group.map(x=>x.actualRelative)));
      momentumIcs.push(spearman(group.map(x=>x.momentumRelative),group.map(x=>x.actualRelative)));
    }
    const dir=rows.filter(x=>sign(x.predRelative)!==0&&sign(x.actualRelative)!==0);
    const cov=rows.filter(x=>typeof x.quantile80Covered==='boolean');
    return {
      horizonSessions:horizon,
      evaluated:rows.length,
      meanCrossSectionalRankIc:mean(rankIcs),
      legacyMeanCrossSectionalRankIc:mean(legacyIcs),
      momentumMeanCrossSectionalRankIc:mean(momentumIcs),
      relativeDirectionalAccuracyPct:dir.length?dir.filter(x=>sign(x.predRelative)===sign(x.actualRelative)).length/dir.length*100:null,
      relativeMaePct:mean(rows.map(x=>Math.abs(x.predRelative-x.actualRelative))),
      quantile80CoveragePct:cov.length?cov.filter(x=>x.quantile80Covered).length/cov.length*100:null
    };
  });
  const primary=metrics.filter(x=>P.primaryHorizons.includes(x.horizonSessions));
  const temporal=[];
  for(const asset of CANDIDATES){
    const vals=P.primaryHorizons.map(h=>{
      const rows=events.filter(x=>x.assetId===asset.assetId&&x.horizon===h);
      return spearman(rows.map(x=>x.predRelative),rows.map(x=>x.actualRelative));
    }).filter(Number.isFinite);
    temporal.push({assetId:asset.assetId,meanPrimaryTemporalIc:mean(vals)});
  }
  return {
    arm,
    metrics,
    summary:{
      meanRankIc20_60:mean(primary.map(x=>x.meanCrossSectionalRankIc)),
      pooledDirectionalAccuracyPct20_60:mean(primary.map(x=>x.relativeDirectionalAccuracyPct)),
      quantile80CoveragePct20_60:mean(primary.map(x=>x.quantile80CoveragePct)),
      positiveTemporalIcTargets:temporal.filter(x=>(x.meanPrimaryTemporalIc??-Infinity)>0).length,
      temporalByAsset:temporal
    },
    events:events.map(x=>({...x,actualReturn:round(x.actualReturn),actualRelative:round(x.actualRelative),predReturn:round(x.predReturn),predRelative:round(x.predRelative),legacyScore:round(x.legacyScore),momentumRelative:round(x.momentumRelative)}))
  };
}

export async function main(){
  const series={},sourceManifest={};
  for(const ticker of TARGET_TICKERS){
    const raw=await fetchYahooRaw(ticker),parsed=parseYahooOhlcvPayload(ticker,raw.text);
    if(parsed.meta.symbol!==ticker)throw new Error('TIMESFM_MV_V1_YAHOO_IDENTITY:'+ticker+':'+parsed.meta.symbol);
    series[ticker]=parsed.rows;
    sourceManifest[ticker]={provider:'Yahoo Finance',sourceType:'REAL',rawCachePath:raw.cachePath,rawSha256:raw.sha256,cached:raw.cached,firstDate:parsed.rows[0]?.date,lastDate:parsed.rows.at(-1)?.date,bars:parsed.rows.length,...parsed.meta};
  }
  const built=buildAnchors(series);
  if(built.anchors.length<P.diagnostic.minimumUsableAnchors){
    const result={study:P.version,status:'INCONCLUSIVE_COVERAGE',anchors:built.anchors.length,skips:built.skips,sourceManifest,productionDefault:'LEGACY',productionAuthority:false};
    console.log(MARKER);console.log(JSON.stringify(result,null,2));return result;
  }
  const payload={
    study:P.version,
    protocol:{contextLength:P.contextLength,forecastHorizon:P.forecastHorizon,targetIds:TARGET_IDS,pastOnlyCovariateCount:P.covariates.totalPastOnly,useZNorm:true},
    anchors:built.anchors.map(a=>({anchorId:a.anchorId,informationDate:a.informationDate,targetContext:a.targetContext,pastOnlyCovariates:a.pastOnlyCovariates}))
  };
  fs.mkdirSync(path.dirname(PAYLOAD_PATH),{recursive:true});const payloadText=JSON.stringify(payload);fs.writeFileSync(PAYLOAD_PATH,payloadText+'\n','utf8');
  const remote=await callTimesFmMultivariateContextV1(payload);const remoteByAnchor=new Map(remote.anchors.map(x=>[x.anchorId,x]));
  const targetsOnly=evaluateArm('TARGETS_ONLY',built.anchors,series,remoteByAnchor);
  const withCovariates=evaluateArm('WITH_CAUSAL_COVARIATES',built.anchors,series,remoteByAnchor);
  const lift=(withCovariates.summary.meanRankIc20_60??0)-(targetsOnly.summary.meanRankIc20_60??0);
  const I=P.interpretation;
  const covUseful=(withCovariates.summary.meanRankIc20_60??-Infinity)>=I.minimumMeanRankIc20_60
    &&(withCovariates.summary.pooledDirectionalAccuracyPct20_60??-Infinity)>=I.minimumDirectionalAccuracyPct20_60
    &&withCovariates.summary.positiveTemporalIcTargets>=I.minimumPositiveTemporalIcTargets
    &&lift>=I.minimumCovariateRankIcLiftVsTargetsOnly20_60
    &&(withCovariates.summary.quantile80CoveragePct20_60??-Infinity)>=I.quantile80CoverageMinPct
    &&(withCovariates.summary.quantile80CoveragePct20_60??Infinity)<=I.quantile80CoverageMaxPct;
  const panelUseful=(targetsOnly.summary.meanRankIc20_60??-Infinity)>=I.minimumMeanRankIc20_60
    &&(targetsOnly.summary.pooledDirectionalAccuracyPct20_60??-Infinity)>=I.minimumDirectionalAccuracyPct20_60;
  const status=covUseful?'POSTHOC_COVARIATES_ADD_SIGNAL':panelUseful?'POSTHOC_PANEL_SIGNAL_NO_COVARIATE_LIFT':'POSTHOC_NO_USEFUL_MULTIVARIATE_INCREMENT';
  const result={
    schemaVersion:1,study:P.version,generatedAt:new Date().toISOString(),status,role:P.role,
    protocol:P,
    coverage:{expectedAnchors:P.diagnostic.expectedAnchors,usableAnchors:built.anchors.length,skips:built.skips},
    evidence:{payloadPath:PAYLOAD_PATH,payloadSha256:sha256(payloadText),remoteRuntime:remote.runtime,sourceManifest},
    comparison:{targetsOnly:targetsOnly.summary,withCausalCovariates:withCovariates.summary,covariateRankIcLiftVsTargetsOnly20_60:round(lift)},
    metrics:{targetsOnly:targetsOnly.metrics,withCausalCovariates:withCovariates.metrics},
    events:{targetsOnly:targetsOnly.events,withCausalCovariates:withCovariates.events},
    notes:[
      'Consumed 2018Q1-2025Q3 sample: descriptive signal diagnostic only; no production promotion authority.',
      'Both native TimesFM 3 arms are frozen before the first fresh prospective anchor and are evaluated side-by-side.',
      'Targets-only uses all nine market series in one multivariate forward pass; the covariate arm adds 23 causal past-only variates, reaching the frozen 32-variate model limit.',
      'No trading, allocation, tax or rotation policy is evaluated in this study.'
    ],
    productionDefault:'LEGACY',productionAuthority:false
  };
  fs.mkdirSync(path.dirname(RESULT_PATH),{recursive:true});fs.writeFileSync(RESULT_PATH,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(MARKER);console.log(JSON.stringify(result,null,2));return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{console.error(MARKER);console.error(JSON.stringify({study:P.version,status:'BLOCKED_OR_TECHNICAL_FAILED',error:error?.message??String(error),productionDefault:'LEGACY',productionAuthority:false},null,2));process.exitCode=1;});
