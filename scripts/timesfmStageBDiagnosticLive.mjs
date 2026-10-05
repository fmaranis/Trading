import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P,
  quarterEndCalendarDates,
  rebase100,
  legacyScannerScore,
  trailing60LogDriftForecast
} from './timesfmStageBProtocol.mjs';
import { callTimesFmStageB } from './timesfmStageBRemoteClient.mjs';

export const MARKER = 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1_RESULT';
export const CACHE_DIR = '.runtime/timesfm-stage-b-v1/yahoo';
export const PAYLOAD_PATH = '.runtime/timesfm-stage-b-v1/payload.json';
export const RESULT_PATH = 'validation-runs/diagnostics/timesfm-stage-b-predictive-benchmark-v1-result.json';

const QUANTILES = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9];

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function nextDay(date) {
  return new Date(Date.parse(date + 'T00:00:00Z') + 86_400_000).toISOString().slice(0,10);
}

function mean(values) {
  const rows = values.filter(Number.isFinite);
  return rows.length ? rows.reduce((sum,value)=>sum+value,0)/rows.length : null;
}

function rmse(errors) {
  const rows = errors.filter(Number.isFinite);
  return rows.length ? Math.sqrt(rows.reduce((sum,value)=>sum+value*value,0)/rows.length) : null;
}

function round(value, digits=6) {
  return Number.isFinite(value) ? Number(Number(value).toFixed(digits)) : null;
}

function sign(value) {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function ranks(values) {
  const indexed = values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value || a.index-b.index);
  const result = new Array(values.length);
  let i=0;
  while(i<indexed.length){
    let j=i+1;
    while(j<indexed.length && indexed[j].value===indexed[i].value) j++;
    const rank=(i+j-1)/2+1;
    for(let k=i;k<j;k++) result[indexed[k].index]=rank;
    i=j;
  }
  return result;
}

export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return null;
  if (xs.some(v=>!Number.isFinite(v)) || ys.some(v=>!Number.isFinite(v))) return null;
  const rx=ranks(xs), ry=ranks(ys);
  const mx=mean(rx), my=mean(ry);
  let cov=0,vx=0,vy=0;
  for(let i=0;i<rx.length;i++){
    const dx=rx[i]-mx, dy=ry[i]-my;
    cov+=dx*dy; vx+=dx*dx; vy+=dy*dy;
  }
  return vx>0 && vy>0 ? cov/Math.sqrt(vx*vy) : null;
}

export function maxDrawdownPct(values) {
  if (!values.length) return null;
  let peak=values[0], maximum=0;
  for(const value of values){
    if(!(value>0)) continue;
    peak=Math.max(peak,value);
    if(peak>0) maximum=Math.max(maximum,(peak-value)/peak*100);
  }
  return maximum;
}

function pinballLoss(actual, predicted, q) {
  const error=actual-predicted;
  return error>=0 ? q*error : (q-1)*error;
}

export function parseYahooClosePayload(symbol, text) {
  const payload=JSON.parse(text);
  const result=payload?.chart?.result?.[0];
  if(payload?.chart?.error) throw new Error('YAHOO_CHART_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length) throw new Error('YAHOO_NO_DATA:'+symbol);
  const quote=result.indicators?.quote?.[0]??{};
  const bars=[];
  for(let i=0;i<result.timestamp.length;i++){
    const close=Number(quote.close?.[i]);
    if(!(close>0) || !Number.isFinite(close)) continue;
    bars.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),close});
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  const seen=new Set();
  for(const row of bars){
    if(seen.has(row.date)) throw new Error('YAHOO_DUPLICATE_DATE:'+symbol+':'+row.date);
    seen.add(row.date);
  }
  if(bars.length<P.contextLength+P.forecastHorizon) throw new Error('YAHOO_INSUFFICIENT_HISTORY:'+symbol+':'+bars.length);
  return {
    bars,
    meta:{
      symbol:String(result.meta?.symbol??symbol).toUpperCase(),
      currency:String(result.meta?.currency??'').toUpperCase(),
      exchange:String(result.meta?.exchangeName??''),
      instrumentType:String(result.meta?.instrumentType??'').toUpperCase()
    }
  };
}

async function fetchYahooRaw(symbol) {
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const cachePath=path.join(CACHE_DIR,symbol.replace(/[^A-Za-z0-9._-]/g,'_')+'.json');
  if(fs.existsSync(cachePath)){
    const text=fs.readFileSync(cachePath,'utf8');
    return {text,cachePath,cached:true,sha256:sha256(text)};
  }
  const p1=Math.floor(Date.parse(P.data.downloadFrom+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse(nextDay(P.data.outcomesThrough)+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history&includeAdjustedClose=true`;
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{
        headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},
        signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)
      });
      const text=await response.text();
      if(response.ok){
        JSON.parse(text);
        fs.writeFileSync(cachePath,text,'utf8');
        return {text,cachePath,cached:false,sha256:sha256(text)};
      }
      lastError=new Error('YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,200));
      if(![429,500,502,503,504].includes(response.status)) break;
    }catch(error){ lastError=error; }
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  throw lastError??new Error('YAHOO_FETCH_FAILED:'+symbol);
}

function mapBars(bars) {
  return new Map(bars.map(row=>[row.date,row.close]));
}

function lastOnOrBefore(dates, cutoff) {
  let result=null;
  for(const date of dates){
    if(date>cutoff) break;
    result=date;
  }
  return result;
}

function anchorKey(calendarDate) {
  const year=Number(calendarDate.slice(0,4));
  const month=Number(calendarDate.slice(5,7));
  return `${year}Q${Math.ceil(month/3)}`;
}

function roundContext(values) {
  const factor=10**P.payloadRoundDecimals;
  return values.map(value=>Math.round(value*factor)/factor);
}

export function buildStageBCases(series) {
  const coreBars=series[P.core.ticker];
  if(!coreBars) throw new Error('TIMESFM_STAGE_B_CORE_SERIES_MISSING');
  const coreMap=mapBars(coreBars);
  const coreDates=coreBars.map(row=>row.date).filter(date=>date<=P.data.outcomesThrough);
  const candidates=[];
  const skips=[];

  for(const calendarDate of quarterEndCalendarDates()){
    const informationDate=lastOnOrBefore(coreDates,calendarDate);
    if(!informationDate){ skips.push({anchor:anchorKey(calendarDate),reason:'CORE_ANCHOR_MISSING'}); continue; }
    const anchorCases=[];
    for(const asset of P.assets){
      const assetBars=series[asset.ticker];
      if(!assetBars){ skips.push({anchor:anchorKey(calendarDate),ticker:asset.ticker,reason:'ASSET_SERIES_MISSING'}); continue; }
      const assetMap=mapBars(assetBars);
      if(!assetMap.has(informationDate)){
        skips.push({anchor:anchorKey(calendarDate),ticker:asset.ticker,reason:'ASSET_ANCHOR_MISSING'});
        continue;
      }
      const pairDates=coreDates.filter(date=>date<=informationDate && assetMap.has(date));
      if(pairDates.length<P.contextLength){
        skips.push({anchor:anchorKey(calendarDate),ticker:asset.ticker,reason:'CONTEXT_SHORT',available:pairDates.length});
        continue;
      }
      const contextDates=pairDates.slice(-P.contextLength);
      const futureDates=coreDates.filter(date=>date>informationDate && assetMap.has(date)).slice(0,P.forecastHorizon);
      if(futureDates.length<P.forecastHorizon){
        skips.push({anchor:anchorKey(calendarDate),ticker:asset.ticker,reason:'FUTURE_SHORT',available:futureDates.length});
        continue;
      }
      const rawAssetContext=contextDates.map(date=>assetMap.get(date));
      const rawCoreContext=contextDates.map(date=>coreMap.get(date));
      const assetContext=roundContext(rebase100(rawAssetContext));
      const coreContext=roundContext(rebase100(rawCoreContext));
      const caseId=`${anchorKey(calendarDate)}|${asset.assetId}`;
      anchorCases.push({
        caseId,
        anchorKey:anchorKey(calendarDate),
        calendarDate,
        informationDate,
        contextStartDate:contextDates[0],
        contextEndDate:contextDates.at(-1),
        futureDates,
        asset,
        rawAssetContext,
        rawCoreContext,
        payload:{caseId,assetContext,coreContext}
      });
    }
    if(anchorCases.length<P.diagnostic.minimumAssetsPerAnchor){
      for(const row of anchorCases) skips.push({anchor:row.anchorKey,ticker:row.asset.ticker,reason:'ANCHOR_MIN_ASSETS_NOT_MET'});
      continue;
    }
    candidates.push(...anchorCases);
  }

  return {cases:candidates,skips};
}

function actualOutcome(row, series, horizon) {
  const assetMap=mapBars(series[row.asset.ticker]);
  const coreMap=mapBars(series[P.core.ticker]);
  const futureDate=row.futureDates[horizon-1];
  const asset0=assetMap.get(row.informationDate), asset1=assetMap.get(futureDate);
  const core0=coreMap.get(row.informationDate), core1=coreMap.get(futureDate);
  if(!(asset0>0)||!(asset1>0)||!(core0>0)||!(core1>0)) return null;
  const assetReturn=(asset1/asset0-1)*100;
  const coreReturn=(core1/core0-1)*100;
  return {futureDate,assetReturn,coreReturn,relativeReturn:assetReturn-coreReturn,assetFutureClose:asset1,assetAnchorClose:asset0};
}

function groupBy(rows,keyFn) {
  const result=new Map();
  for(const row of rows){
    const key=keyFn(row);
    if(!result.has(key)) result.set(key,[]);
    result.get(key).push(row);
  }
  return result;
}

function metricErrors(rows,key) {
  const errors=rows.map(row=>row[key]).filter(Number.isFinite);
  return {mae:mean(errors.map(Math.abs)),rmse:rmse(errors)};
}

function horizonMetrics(rows,horizon) {
  const hrows=rows.filter(row=>row.horizon===horizon);
  const anchorGroups=groupBy(hrows,row=>row.anchorKey);
  const mvRank=[], uvRank=[], legacyRank=[], momentumRank=[];
  for(const group of anchorGroups.values()){
    if(group.length<P.diagnostic.minimumAssetsPerAnchor) continue;
    const actual=group.map(r=>r.actualRelativeReturn);
    mvRank.push(spearman(group.map(r=>r.mvPredRelativeReturn),actual));
    uvRank.push(spearman(group.map(r=>r.uvPredAssetReturn),actual));
    legacyRank.push(spearman(group.map(r=>r.legacyScore),actual));
    momentumRank.push(spearman(group.map(r=>r.momentumPredRelativeReturn),actual));
  }
  const directionalRows=hrows.filter(r=>sign(r.actualRelativeReturn)!==0 && sign(r.mvPredRelativeReturn)!==0);
  const absoluteDirectional=hrows.filter(r=>sign(r.actualAssetReturn)!==0 && sign(r.mvPredAssetReturn)!==0);
  const coverageRows=hrows.filter(r=>typeof r.quantile80Covered==='boolean');
  const pinballRows=hrows.flatMap(r=>r.pinballLosses??[]);
  return {
    horizonSessions:horizon,
    evaluated:hrows.length,
    mvRelativeDirectionalAccuracyPct:directionalRows.length?directionalRows.filter(r=>sign(r.actualRelativeReturn)===sign(r.mvPredRelativeReturn)).length/directionalRows.length*100:null,
    mvAbsoluteDirectionalAccuracyPct:absoluteDirectional.length?absoluteDirectional.filter(r=>sign(r.actualAssetReturn)===sign(r.mvPredAssetReturn)).length/absoluteDirectional.length*100:null,
    buyHoldDirectionalAccuracyPct:hrows.length?hrows.filter(r=>r.actualAssetReturn>0).length/hrows.length*100:null,
    mvMeanCrossSectionalRankIc:mean(mvRank),
    uvMeanCrossSectionalRankIc:mean(uvRank),
    legacyMeanCrossSectionalRankIc:mean(legacyRank),
    momentumMeanCrossSectionalRankIc:mean(momentumRank),
    mvAssetError:metricErrors(hrows,'mvAssetError'),
    uvAssetError:metricErrors(hrows,'uvAssetError'),
    momentumAssetError:metricErrors(hrows,'momentumAssetError'),
    zeroAssetError:metricErrors(hrows,'zeroAssetError'),
    mvRelativeError:metricErrors(hrows,'mvRelativeError'),
    momentumRelativeError:metricErrors(hrows,'momentumRelativeError'),
    zeroRelativeError:metricErrors(hrows,'zeroRelativeError'),
    quantile80CoveragePct:coverageRows.length?coverageRows.filter(r=>r.quantile80Covered).length/coverageRows.length*100:null,
    meanPinballLoss:mean(pinballRows),
    meanAbsPointPathDrawdownErrorPct:horizon===60?mean(hrows.map(r=>r.pointPathDrawdownAbsErrorPct).filter(Number.isFinite)):null
  };
}

export function evaluateStageB(series, caseRows, remote) {
  const remoteById=new Map(remote.cases.map(row=>[row.caseId,row]));
  const eventRows=[];
  for(const row of caseRows){
    const forecast=remoteById.get(row.caseId);
    if(!forecast) throw new Error('TIMESFM_STAGE_B_FORECAST_MISSING:'+row.caseId);
    const assetLast=row.payload.assetContext.at(-1);
    const coreLast=row.payload.coreContext.at(-1);
    const legacyScore=legacyScannerScore(row.rawAssetContext,row.asset.defensive);
    for(const horizon of P.evaluationHorizons){
      const actual=actualOutcome(row,series,horizon);
      if(!actual || legacyScore==null) continue;
      const mvAssetLevel=Number(forecast.mvAssetPoint[String(horizon)]);
      const mvCoreLevel=Number(forecast.mvCorePoint[String(horizon)]);
      const uvAssetLevel=Number(forecast.uvAssetPoint[String(horizon)]);
      if(![mvAssetLevel,mvCoreLevel,uvAssetLevel].every(Number.isFinite)) continue;
      const mvPredAssetReturn=(mvAssetLevel/assetLast-1)*100;
      const mvPredCoreReturn=(mvCoreLevel/coreLast-1)*100;
      const mvPredRelativeReturn=mvPredAssetReturn-mvPredCoreReturn;
      const uvPredAssetReturn=(uvAssetLevel/assetLast-1)*100;
      const momentumPredAssetReturn=trailing60LogDriftForecast(row.rawAssetContext,horizon);
      const momentumPredCoreReturn=trailing60LogDriftForecast(row.rawCoreContext,horizon);
      const momentumPredRelativeReturn=momentumPredAssetReturn!=null&&momentumPredCoreReturn!=null?momentumPredAssetReturn-momentumPredCoreReturn:null;

      const qLevels=(forecast.mvAssetQuantiles?.[String(horizon)]??[]).map(Number);
      const actualNormalizedLevel=assetLast*(1+actual.assetReturn/100);
      const quantile80Covered=qLevels.length===9 && qLevels.every(Number.isFinite)
        ? actualNormalizedLevel>=qLevels[0] && actualNormalizedLevel<=qLevels[8]
        : null;
      const pinballLosses=qLevels.length===9 && qLevels.every(Number.isFinite)
        ? qLevels.map((level,index)=>pinballLoss(actual.assetReturn,(level/assetLast-1)*100,QUANTILES[index]))
        : [];

      let pointPathDrawdownAbsErrorPct=null;
      if(horizon===60 && Array.isArray(forecast.mvAssetPath60) && forecast.mvAssetPath60.length===60){
        const actualAssetMap=mapBars(series[row.asset.ticker]);
        const actualPath=[actualAssetMap.get(row.informationDate),...row.futureDates.map(date=>actualAssetMap.get(date))].filter(Number.isFinite);
        const predictedPath=[assetLast,...forecast.mvAssetPath60.map(Number)].filter(Number.isFinite);
        const actualDd=maxDrawdownPct(actualPath), predictedDd=maxDrawdownPct(predictedPath);
        if(actualDd!=null&&predictedDd!=null) pointPathDrawdownAbsErrorPct=Math.abs(predictedDd-actualDd);
      }

      eventRows.push({
        caseId:row.caseId,
        anchorKey:row.anchorKey,
        informationDate:row.informationDate,
        futureDate:actual.futureDate,
        assetId:row.asset.assetId,
        ticker:row.asset.ticker,
        horizon,
        actualAssetReturn:actual.assetReturn,
        actualCoreReturn:actual.coreReturn,
        actualRelativeReturn:actual.relativeReturn,
        mvPredAssetReturn,
        mvPredCoreReturn,
        mvPredRelativeReturn,
        uvPredAssetReturn,
        momentumPredAssetReturn,
        momentumPredCoreReturn,
        momentumPredRelativeReturn,
        legacyScore,
        mvAssetError:mvPredAssetReturn-actual.assetReturn,
        uvAssetError:uvPredAssetReturn-actual.assetReturn,
        momentumAssetError:momentumPredAssetReturn==null?null:momentumPredAssetReturn-actual.assetReturn,
        zeroAssetError:-actual.assetReturn,
        mvRelativeError:mvPredRelativeReturn-actual.relativeReturn,
        momentumRelativeError:momentumPredRelativeReturn==null?null:momentumPredRelativeReturn-actual.relativeReturn,
        zeroRelativeError:-actual.relativeReturn,
        quantile80Covered,
        pinballLosses,
        pointPathDrawdownAbsErrorPct
      });
    }
  }

  const metrics=P.evaluationHorizons.map(h=>horizonMetrics(eventRows,h));
  const primary=metrics.filter(row=>P.primaryHorizons.includes(row.horizonSessions));
  const meanRankIc=mean(primary.map(row=>row.mvMeanCrossSectionalRankIc).filter(Number.isFinite));
  const legacyRankIc=mean(primary.map(row=>row.legacyMeanCrossSectionalRankIc).filter(Number.isFinite));
  const rankIcLift=meanRankIc!=null&&legacyRankIc!=null?meanRankIc-legacyRankIc:null;
  const primaryRows=eventRows.filter(row=>P.primaryHorizons.includes(row.horizon));
  const dirRows=primaryRows.filter(row=>sign(row.actualRelativeReturn)!==0 && sign(row.mvPredRelativeReturn)!==0);
  const relativeDirectionalAccuracyPct=dirRows.length?dirRows.filter(row=>sign(row.actualRelativeReturn)===sign(row.mvPredRelativeReturn)).length/dirRows.length*100:null;
  const coverageRows=primaryRows.filter(row=>typeof row.quantile80Covered==='boolean');
  const quantile80CoveragePct=coverageRows.length?coverageRows.filter(row=>row.quantile80Covered).length/coverageRows.length*100:null;

  const temporalByAsset=[];
  for(const asset of P.assets){
    const rows=eventRows.filter(row=>row.assetId===asset.assetId && P.primaryHorizons.includes(row.horizon));
    const ics=P.primaryHorizons.map(h=>{
      const subset=rows.filter(row=>row.horizon===h);
      return spearman(subset.map(row=>row.mvPredRelativeReturn),subset.map(row=>row.actualRelativeReturn));
    }).filter(Number.isFinite);
    temporalByAsset.push({assetId:asset.assetId,ticker:asset.ticker,meanPrimaryTemporalIc:mean(ics)});
  }
  const positiveTemporalIcAssets=temporalByAsset.filter(row=>(row.meanPrimaryTemporalIc??-Infinity)>0).length;
  const coveragePct=caseRows.length/P.diagnostic.expectedMaximumCases*100;

  const gateChecks={
    coverage:coveragePct>=P.gates.minimumCoveragePct,
    meanRankIc:meanRankIc!=null&&meanRankIc>=P.gates.minimumMeanRankIcPrimary20_60,
    rankIcLiftVsLegacy:rankIcLift!=null&&rankIcLift>=P.gates.minimumRankIcLiftVsLegacy20_60,
    relativeDirectionalAccuracy:relativeDirectionalAccuracyPct!=null&&relativeDirectionalAccuracyPct>=P.gates.minimumRelativeDirectionalAccuracyPct20_60,
    positiveTemporalIcAssets:positiveTemporalIcAssets>=P.gates.minimumPositiveTemporalIcAssets,
    quantile80Coverage:quantile80CoveragePct!=null&&quantile80CoveragePct>=P.gates.quantile80CoverageMinPct&&quantile80CoveragePct<=P.gates.quantile80CoverageMaxPct
  };

  const status=!gateChecks.coverage
    ? 'INCONCLUSIVE_COVERAGE'
    : Object.values(gateChecks).every(Boolean)
      ? 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION'
      : 'FAIL_SIGNAL_DIAGNOSTIC';

  return {
    status,
    metrics,
    primarySummary:{
      coveragePct,
      meanRankIc20_60:meanRankIc,
      legacyMeanRankIc20_60:legacyRankIc,
      rankIcLiftVsLegacy20_60:rankIcLift,
      pooledRelativeDirectionalAccuracyPct20_60:relativeDirectionalAccuracyPct,
      quantile80CoveragePct20_60:quantile80CoveragePct,
      positiveTemporalIcAssets,
      temporalByAsset,
      gateChecks
    },
    events:eventRows.map(row=>({
      caseId:row.caseId,anchorKey:row.anchorKey,informationDate:row.informationDate,futureDate:row.futureDate,
      assetId:row.assetId,ticker:row.ticker,horizon:row.horizon,
      actualAssetReturnPct:round(row.actualAssetReturn),actualCoreReturnPct:round(row.actualCoreReturn),actualRelativeReturnPct:round(row.actualRelativeReturn),
      mvPredAssetReturnPct:round(row.mvPredAssetReturn),mvPredCoreReturnPct:round(row.mvPredCoreReturn),mvPredRelativeReturnPct:round(row.mvPredRelativeReturn),
      uvPredAssetReturnPct:round(row.uvPredAssetReturn),momentumPredRelativeReturnPct:round(row.momentumPredRelativeReturn),
      legacyScore:round(row.legacyScore),quantile80Covered:row.quantile80Covered
    }))
  };
}

export async function main() {
  const symbols=[P.core.ticker,...P.assets.map(asset=>asset.ticker)];
  const series={}, sourceManifest={};
  for(const symbol of symbols){
    const raw=await fetchYahooRaw(symbol);
    const parsed=parseYahooClosePayload(symbol,raw.text);
    if(parsed.meta.symbol!==symbol) throw new Error('YAHOO_SYMBOL_IDENTITY:'+symbol+':'+parsed.meta.symbol);
    series[symbol]=parsed.bars;
    sourceManifest[symbol]={
      provider:'Yahoo Finance',sourceType:'REAL',currency:parsed.meta.currency,exchange:parsed.meta.exchange,
      instrumentType:parsed.meta.instrumentType,rawCachePath:raw.cachePath,rawSha256:raw.sha256,cached:raw.cached,
      firstDate:parsed.bars[0].date,lastDate:parsed.bars.at(-1).date,bars:parsed.bars.length
    };
  }

  const built=buildStageBCases(series);
  const coveragePct=built.cases.length/P.diagnostic.expectedMaximumCases*100;
  if(coveragePct<P.gates.minimumCoveragePct){
    const result={
      study:P.version,status:'INCONCLUSIVE_COVERAGE',role:P.role,
      coverage:{expectedMaximumCases:P.diagnostic.expectedMaximumCases,usableCases:built.cases.length,coveragePct,skips:built.skips},
      sourceManifest,productionDefault:'LEGACY',productionAuthority:false
    };
    console.log(MARKER);
    console.log(JSON.stringify(result,null,2));
    return result;
  }

  const payload={
    study:P.version,
    protocol:{
      contextLength:P.contextLength,forecastHorizon:P.forecastHorizon,evaluationHorizons:P.evaluationHorizons,
      primaryModel:P.models.primary,secondaryModel:P.models.secondary,normalization:P.normalization,
      productionDefault:'LEGACY',productionAuthority:false
    },
    cases:built.cases.map(row=>row.payload)
  };
  fs.mkdirSync(path.dirname(PAYLOAD_PATH),{recursive:true});
  const payloadText=JSON.stringify(payload);
  fs.writeFileSync(PAYLOAD_PATH,payloadText+'\n','utf8');
  const payloadSha256=sha256(payloadText);

  const remote=await callTimesFmStageB(payload);
  const evaluated=evaluateStageB(series,built.cases,remote);
  const result={
    schemaVersion:1,
    study:P.version,
    generatedAt:new Date().toISOString(),
    role:P.role,
    status:evaluated.status,
    protocol:{
      model:P.model,data:P.data,core:P.core,assets:P.assets,contextLength:P.contextLength,forecastHorizon:P.forecastHorizon,
      evaluationHorizons:P.evaluationHorizons,primaryHorizons:P.primaryHorizons,models:P.models,baselines:P.baselines,gates:P.gates,
      prospectiveConfirmation:P.prospectiveConfirmation,productionDefault:'LEGACY',productionAuthority:false
    },
    coverage:{
      expectedMaximumCases:P.diagnostic.expectedMaximumCases,usableCases:built.cases.length,coveragePct,
      anchors:groupBy(built.cases,row=>row.anchorKey).size,skips:built.skips
    },
    evidence:{
      payloadPath:PAYLOAD_PATH,payloadSha256,remoteCaseCount:remote.caseCount,
      remoteRuntime:remote.runtime,remoteProtocol:remote.protocol,sourceManifest
    },
    metrics:evaluated.metrics,
    primarySummary:evaluated.primarySummary,
    events:evaluated.events,
    notes:[
      'Historical 2018Q1-2025Q3 sample is diagnostic/consumed and has no promotion authority.',
      'Only causal 512-session contexts were sent to ZeroGPU; future outcomes stayed local until forecasts returned.',
      'Primary arm is multivariate asset+core. Univariate diagnostics cannot rescue a primary FAIL.',
      'Quantiles are marginal and are not treated as a joint path distribution.',
      evaluated.status==='PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION'
        ? 'PASS only authorizes the preregistered prospective confirmation; Stage C remains closed.'
        : 'No parameter rescue or retuning is allowed on this consumed diagnostic.'
    ],
    productionDefault:'LEGACY',
    productionAuthority:false
  };
  fs.mkdirSync(path.dirname(RESULT_PATH),{recursive:true});
  fs.writeFileSync(RESULT_PATH,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(MARKER);
  console.log(JSON.stringify(result,null,2));
  return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  main().then(result=>{
    if(result?.status!=='PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION') process.exitCode=2;
  }).catch(error=>{
    console.error(MARKER);
    console.error(JSON.stringify({
      study:P.version,status:'BLOCKED_OR_TECHNICAL_FAILED',
      error:error?.message??String(error),productionDefault:'LEGACY',productionAuthority:false
    },null,2));
    process.exitCode=1;
  });
}
