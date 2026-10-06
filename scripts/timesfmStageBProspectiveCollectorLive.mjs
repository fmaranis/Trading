import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P,
  legacyScannerScore,
  rebase100,
  trailing60LogDriftForecast
} from './timesfmStageBProtocol.mjs';
import { callTimesFmStageB } from './timesfmStageBRemoteClient.mjs';
import { TIMESFM_MULTIVARIATE_CONTEXT_V1 as MV } from './timesfmMultivariateContextV1Protocol.mjs';
import { callTimesFmMultivariateContextV1 } from './timesfmMultivariateContextV1RemoteClient.mjs';
import { buildCausalMultivariateContext } from './timesfmMultivariateContextV1DiagnosticLive.mjs';
import {
  TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY as M,
  appendTimesFmProspectiveAnchor,
  markTimesFmProspectiveOpened,
  sha256Canonical
} from './timesfmStageBProspectiveProtocol.mjs';
import {
  loadTimesFmProspectiveDurableState,
  saveTimesFmProspectiveDurableState
} from './timesfmStageBProspectiveStateStore.mjs';

export const MARKER = 'TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1_COLLECTOR_RESULT';
const DOWNLOAD_FROM = '2024-01-01';
const ALL = [P.core, ...P.assets];

function nextDay(date) {
  return new Date(Date.parse(date + 'T00:00:00Z') + 86_400_000).toISOString().slice(0,10);
}

function round(value, digits=8) {
  return Number(Number(value).toFixed(digits));
}

function localBerlinParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23'
  }).formatToParts(now);
  const get = type => parts.find(p => p.type === type)?.value ?? '';
  return { date:`${get('year')}-${get('month')}-${get('day')}`, hour:Number(get('hour')) };
}

export function isoWeekKey(date) {
  const d = new Date(date + 'T12:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart) / 86_400_000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function selectProspectiveAnchor(commonDates, todayBerlinDate, berlinHour) {
  const dates=[...new Set(commonDates)].sort();
  const eligible=dates.filter(date => date > M.startAfter && date <= todayBerlinDate);
  if (!eligible.length) return { status:'WAITING_START', informationDate:null, isoWeek:null };
  const latest=eligible.at(-1);
  const week=isoWeekKey(latest);
  const firstInWeek=eligible.find(date => isoWeekKey(date) === week);
  if (!firstInWeek) return { status:'WAITING_START', informationDate:null, isoWeek:null };
  if (latest > firstInWeek) {
    return { status:'MISSED_WEEK_NO_RETROACTIVE_FORECAST', informationDate:firstInWeek, latestCommonDate:latest, isoWeek:week };
  }
  if (firstInWeek === todayBerlinDate && berlinHour < M.collection.sameDayCollectionNotBeforeLocalHour) {
    return { status:'WAITING_SESSION_CLOSE', informationDate:firstInWeek, isoWeek:week };
  }
  return { status:'READY', informationDate:firstInWeek, latestCommonDate:latest, isoWeek:week };
}

export function parseYahooClosePayload(symbol, text) {
  const payload=JSON.parse(text);
  const result=payload?.chart?.result?.[0];
  if(payload?.chart?.error) throw new Error('YAHOO_CHART_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length) throw new Error('YAHOO_NO_DATA:'+symbol);
  const quote=result.indicators?.quote?.[0]??{};
  const bars=[];
  for(let i=0;i<result.timestamp.length;i++){
    const open=Number(quote.open?.[i]),high=Number(quote.high?.[i]),low=Number(quote.low?.[i]),close=Number(quote.close?.[i]),volume=Number(quote.volume?.[i]);
    if(![open,high,low,close,volume].every(Number.isFinite)||!(open>0)||!(high>0)||!(low>0)||!(close>0)||volume<0) continue;
    bars.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),open,high,low,close,volume});
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  return { bars, meta:{ symbol:String(result.meta?.symbol??symbol).toUpperCase(), instrumentType:String(result.meta?.instrumentType??'').toUpperCase() } };
}

async function fetchYahoo(symbol, endDate) {
  const p1=Math.floor(Date.parse(DOWNLOAD_FROM+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse(nextDay(endDate)+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history&includeAdjustedClose=true`;
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      if(response.ok) return parseYahooClosePayload(symbol,text);
      lastError=new Error('YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,160));
      if(![429,500,502,503,504].includes(response.status)) break;
    }catch(error){ lastError=error; }
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  throw lastError??new Error('YAHOO_FETCH_FAILED:'+symbol);
}

function intersectDates(series) {
  const sets=Object.values(series).map(rows=>new Set(rows.map(row=>row.date)));
  if(!sets.length) return [];
  return [...sets[0]].filter(date=>sets.every(set=>set.has(date))).sort();
}

function mapBars(rows) { return new Map(rows.map(row=>[row.date,row.close])); }

export function buildProspectiveCases(series, informationDate) {
  const common=intersectDates(series).filter(date=>date<=informationDate);
  if(common.at(-1)!==informationDate) throw new Error('TIMESFM_PROSPECTIVE_INFORMATION_DATE_NOT_COMMON');
  if(common.length<P.contextLength) throw new Error('TIMESFM_PROSPECTIVE_CONTEXT_SHORT:'+common.length);
  const contextDates=common.slice(-P.contextLength);
  const coreMap=mapBars(series[P.core.ticker]);
  const rawCore=contextDates.map(date=>coreMap.get(date));
  const coreContext=rebase100(rawCore).map(v=>round(v,6));
  const coreLast=coreContext.at(-1);
  const cases=[];
  for(const asset of P.assets){
    const assetMap=mapBars(series[asset.ticker]);
    const rawAsset=contextDates.map(date=>assetMap.get(date));
    const assetContext=rebase100(rawAsset).map(v=>round(v,6));
    const assetLast=assetContext.at(-1);
    const legacyScore=legacyScannerScore(rawAsset,asset.defensive);
    if(!Number.isFinite(legacyScore)) throw new Error('TIMESFM_PROSPECTIVE_LEGACY_SCORE_UNAVAILABLE:'+asset.assetId);
    const momentumAsset={}, momentumCore={}, momentumRelative={};
    for(const horizon of P.evaluationHorizons){
      const a=trailing60LogDriftForecast(rawAsset,horizon);
      const c=trailing60LogDriftForecast(rawCore,horizon);
      momentumAsset[String(horizon)]=a;
      momentumCore[String(horizon)]=c;
      momentumRelative[String(horizon)]=a-c;
    }
    cases.push({
      caseId:`${informationDate}|${asset.assetId}`,
      asset,
      assetContext,
      coreContext,
      assetContextLast:assetLast,
      coreContextLast:coreLast,
      legacyScore,
      momentumAsset,
      momentumCore,
      momentumRelative,
      contextFingerprintSha256:sha256Canonical({assetContext,coreContext})
    });
  }
  return { contextDates, cases };
}

function pct(level,last){ return (Number(level)/last-1)*100; }

export function selectDirectTimesFmWinner(cases) {
  const rows = [
    ...cases.map(row => ({
      assetId: row.assetId,
      ticker: row.ticker,
      predictedRelativeReturn20Pct: Number(row.mvPredRelativeReturnPct?.['20']),
      predictedRelativeReturn60Pct: Number(row.mvPredRelativeReturnPct?.['60'])
    })),
    {
      assetId: P.core.assetId,
      ticker: P.core.ticker,
      predictedRelativeReturn20Pct: 0,
      predictedRelativeReturn60Pct: 0
    }
  ];
  if (rows.length !== P.assets.length + 1) throw new Error('TIMESFM_DIRECT_PROSPECTIVE_POOL_SIZE');
  for (const row of rows) {
    if (!Number.isFinite(row.predictedRelativeReturn20Pct) || !Number.isFinite(row.predictedRelativeReturn60Pct)) {
      throw new Error('TIMESFM_DIRECT_PROSPECTIVE_NON_FINITE:' + row.assetId);
    }
  }
  const rankFor = key => {
    const sorted = [...rows].sort((a,b) => b[key] - a[key] || a.assetId.localeCompare(b.assetId));
    const out = new Map();
    let index = 0;
    while (index < sorted.length) {
      let end = index + 1;
      while (end < sorted.length && sorted[end][key] === sorted[index][key]) end++;
      const rank = (index + 1 + end) / 2;
      for (let i = index; i < end; i++) out.set(sorted[i].assetId, rank);
      index = end;
    }
    return out;
  };
  const r20 = rankFor('predictedRelativeReturn20Pct');
  const r60 = rankFor('predictedRelativeReturn60Pct');
  const ranked = rows.map(row => ({
    ...row,
    rank20: r20.get(row.assetId),
    rank60: r60.get(row.assetId),
    meanOrdinalRank: (r20.get(row.assetId) + r60.get(row.assetId)) / 2,
    meanPredictedRelativeReturnPct: (row.predictedRelativeReturn20Pct + row.predictedRelativeReturn60Pct) / 2
  })).sort((a,b) =>
    a.meanOrdinalRank - b.meanOrdinalRank
    || b.meanPredictedRelativeReturnPct - a.meanPredictedRelativeReturnPct
    || a.assetId.localeCompare(b.assetId)
  );
  const winner = ranked[0];
  return {
    policyVersion: M.economicShadow.version,
    selectedAssetId: winner.assetId,
    selectedTicker: winner.ticker,
    selectedIsStructuralCore: winner.assetId === P.core.assetId,
    rank20: winner.rank20,
    rank60: winner.rank60,
    meanOrdinalRank: winner.meanOrdinalRank,
    meanPredictedRelativeReturnPct: round(winner.meanPredictedRelativeReturnPct),
    predictedRelativeReturn20Pct: round(winner.predictedRelativeReturn20Pct),
    predictedRelativeReturn60Pct: round(winner.predictedRelativeReturn60Pct)
  };
}

export function materializeForecastCases(built, remote) {
  const remoteById=new Map(remote.cases.map(row=>[row.caseId,row]));
  return built.cases.map(row=>{
    const out=remoteById.get(row.caseId);
    if(!out) throw new Error('TIMESFM_PROSPECTIVE_FORECAST_MISSING:'+row.caseId);
    const mvPredAssetReturnPct={}, mvPredCoreReturnPct={}, mvPredRelativeReturnPct={}, uvPredAssetReturnPct={}, mvAssetQuantileReturnPct={};
    for(const horizon of P.evaluationHorizons){
      const key=String(horizon);
      const a=pct(out.mvAssetPoint[key],row.assetContextLast);
      const c=pct(out.mvCorePoint[key],row.coreContextLast);
      mvPredAssetReturnPct[key]=round(a);
      mvPredCoreReturnPct[key]=round(c);
      mvPredRelativeReturnPct[key]=round(a-c);
      uvPredAssetReturnPct[key]=round(pct(out.uvAssetPoint[key],row.assetContextLast));
      mvAssetQuantileReturnPct[key]=(out.mvAssetQuantiles?.[key]??[]).map(level=>round(pct(level,row.assetContextLast)));
    }
    return {
      caseId:row.caseId,
      assetId:row.asset.assetId,
      ticker:row.asset.ticker,
      category:row.asset.category,
      defensive:row.asset.defensive,
      contextFingerprintSha256:row.contextFingerprintSha256,
      assetContextLast:row.assetContextLast,
      coreContextLast:row.coreContextLast,
      legacyScore:round(row.legacyScore),
      momentumPredAssetReturnPct:Object.fromEntries(Object.entries(row.momentumAsset).map(([k,v])=>[k,round(v)])),
      momentumPredCoreReturnPct:Object.fromEntries(Object.entries(row.momentumCore).map(([k,v])=>[k,round(v)])),
      momentumPredRelativeReturnPct:Object.fromEntries(Object.entries(row.momentumRelative).map(([k,v])=>[k,round(v)])),
      mvPredAssetReturnPct,
      mvPredCoreReturnPct,
      mvPredRelativeReturnPct,
      uvPredAssetReturnPct,
      mvAssetQuantileReturnPct,
      mvAssetPath60:(out.mvAssetPath60??[]).map(level=>round(Number(level))),
    };
  });
}

export async function main(now = new Date()) {
  const berlin=localBerlinParts(now);
  if (berlin.date <= M.startAfter) {
    const result={study:M.version,status:'WAITING_START_AFTER_FROZEN_DATE',startAfter:M.startAfter,outcomesOpened:false,productionDefault:'LEGACY'};
    console.log(MARKER); console.log(JSON.stringify(result,null,2)); return result;
  }

  let durable=await loadTimesFmProspectiveDurableState(now.toISOString());
  let state=durable.state;
  let remoteBlobSha=durable.remoteBlobSha;
  if(state.sampleState==='NOT_OPENED'){
    state=markTimesFmProspectiveOpened(state,now.toISOString());
    const opened=await saveTimesFmProspectiveDurableState(state,remoteBlobSha);
    remoteBlobSha=opened.remoteBlobSha;
  }

  const series={};
  const sourceManifest={};
  for(const item of ALL){
    const parsed=await fetchYahoo(item.ticker,berlin.date);
    if(parsed.meta.symbol!==item.ticker) throw new Error('TIMESFM_PROSPECTIVE_YAHOO_IDENTITY:'+item.ticker+':'+parsed.meta.symbol);
    series[item.ticker]=parsed.bars;
    sourceManifest[item.ticker]={sourceType:'REAL',provider:'Yahoo Finance',bars:parsed.bars.length,firstDate:parsed.bars[0]?.date??null,lastDate:parsed.bars.at(-1)?.date??null};
  }

  const common=intersectDates(series);
  const selected=selectProspectiveAnchor(common,berlin.date,berlin.hour);
  if(selected.status==='WAITING_START' || selected.status==='WAITING_SESSION_CLOSE'){
    const result={study:M.version,status:selected.status,...selected,anchorCount:state.anchorCount,outcomesOpened:false,productionDefault:'LEGACY'};
    console.log(MARKER); console.log(JSON.stringify(result,null,2)); return result;
  }
  if(selected.status==='MISSED_WEEK_NO_RETROACTIVE_FORECAST'){
    const result={study:M.version,status:selected.status,...selected,anchorCount:state.anchorCount,outcomesOpened:false,productionDefault:'LEGACY'};
    console.log(MARKER); console.log(JSON.stringify(result,null,2)); process.exitCode=2; return result;
  }

  const informationDate=selected.informationDate;
  if(state.anchors.some(row=>row.informationDate===informationDate)){
    const result={study:M.version,status:'ANCHOR_ALREADY_COLLECTED',informationDate,isoWeek:selected.isoWeek,anchorCount:state.anchorCount,outcomesOpened:false,productionDefault:'LEGACY'};
    console.log(MARKER); console.log(JSON.stringify(result,null,2)); return result;
  }

  const built=buildProspectiveCases(series,informationDate);
  const payload={
    study:P.version,
    protocol:{contextLength:P.contextLength,forecastHorizon:P.forecastHorizon,evaluationHorizons:P.evaluationHorizons,productionDefault:'LEGACY',productionAuthority:false},
    cases:built.cases.map(row=>({caseId:row.caseId,assetContext:row.assetContext,coreContext:row.coreContext}))
  };
  const payloadFingerprintSha256=sha256Canonical(payload);
  const remote=await callTimesFmStageB(payload);
  const cases=materializeForecastCases(built,remote);
  const directShadow=selectDirectTimesFmWinner(cases);

  const mvBuilt=buildCausalMultivariateContext(series,informationDate);
  const mvPayload={
    study:MV.version,
    protocol:{
      contextLength:MV.contextLength,
      forecastHorizon:MV.forecastHorizon,
      targetIds:MV.targets.map(x=>x.assetId),
      pastOnlyCovariateCount:MV.covariates.totalPastOnly,
      useZNorm:true
    },
    anchors:[{
      anchorId:informationDate,
      informationDate,
      targetContext:mvBuilt.targetContext,
      pastOnlyCovariates:mvBuilt.pastOnlyCovariates
    }]
  };
  const mvPayloadFingerprintSha256=sha256Canonical(mvPayload);
  const mvRemote=await callTimesFmMultivariateContextV1(mvPayload);
  const mvAnchor=mvRemote.anchors?.[0];
  if(!mvAnchor || mvAnchor.anchorId!==informationDate) throw new Error('TIMESFM_PROSPECTIVE_MULTIVARIATE_ANCHOR_MISMATCH');
  const multivariateSignalShadow={
    version:MV.version,
    historicalDisposition:'POSTHOC_PANEL_SIGNAL_NO_COVARIATE_LIFT',
    contextStartDate:mvBuilt.contextDates[0],
    contextEndDate:mvBuilt.contextDates.at(-1),
    contextLength:MV.contextLength,
    forecastHorizon:MV.forecastHorizon,
    targetIds:MV.targets.map(x=>x.assetId),
    lastCloseByAsset:Object.fromEntries(MV.targets.map((target,index)=>[target.assetId,round(mvBuilt.targetContext[index].at(-1),8)])),
    payloadFingerprintSha256:mvPayloadFingerprintSha256,
    remoteModel:mvRemote.model,
    remoteRuntime:mvRemote.runtime,
    targetsOnly:mvAnchor.targetsOnly,
    withCausalCovariates:mvAnchor.withCausalCovariates,
    outcomesOpened:false,
    productionAuthority:false
  };
  const draft={
    id:informationDate,
    isoWeek:selected.isoWeek,
    informationDate,
    collectedAt:new Date().toISOString(),
    dataProvenance:'REAL',
    provider:'YAHOO_FINANCE',
    contextStartDate:built.contextDates[0],
    contextEndDate:built.contextDates.at(-1),
    contextLength:P.contextLength,
    forecastHorizon:P.forecastHorizon,
    payloadFingerprintSha256,
    sourceManifest,
    remoteModel:remote.model,
    remoteRuntime:remote.runtime,
    cases,
    directShadow,
    multivariateSignalShadow,
    outcomesOpened:false,
    productionDefault:'LEGACY',
    productionAuthority:false,
    economicShadowPolicyVersion:M.economicShadow.version
  };
  state=appendTimesFmProspectiveAnchor(state,draft,new Date().toISOString());
  const saved=await saveTimesFmProspectiveDurableState(state,remoteBlobSha);
  const result={
    study:M.version,
    status:'PROSPECTIVE_ANCHOR_COLLECTED',
    informationDate,
    isoWeek:selected.isoWeek,
    anchorCount:state.anchorCount,
    cases:cases.length,
    directShadow,
    multivariateSignalShadow:{
      version:multivariateSignalShadow.version,
      arms:['FULL_PANEL_TARGETS_ONLY','FULL_PANEL_PLUS_CAUSAL_COVARIATES'],
      targetCount:multivariateSignalShadow.targetIds.length,
      outcomesOpened:false
    },
    persistence:saved.persistence,
    commitSha:saved.commitSha,
    outcomesOpened:false,
    productionDefault:'LEGACY',
    economicShadowPolicyVersion:M.economicShadow.version
  };
  console.log(MARKER); console.log(JSON.stringify(result,null,2)); return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  main().catch(error=>{
    console.error(MARKER);
    console.error(JSON.stringify({study:M.version,status:'BLOCKED_OR_TECHNICAL_FAILED',error:error?.message??String(error),outcomesOpened:false,productionDefault:'LEGACY'},null,2));
    process.exitCode=1;
  });
}
