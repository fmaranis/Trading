import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';
import {
  selectTimesFmPanelNaiveTop1V1,
  selectTimesFmPanelStickyV1
} from '../src/investment/decision/timesFmPanelStickySelectorV1';
import { TIMESFM_MULTIVARIATE_CONTEXT_V1 as MV } from './timesfmMultivariateContextV1Protocol.mjs';
import { callTimesFmMultivariateContextV1 } from './timesfmMultivariateContextV1RemoteClient.mjs';
import { buildProspectiveMultivariateContext } from './timesfmStageBProspectiveCollectorLive.mjs';
import { TIMESFM_PANEL_STICKY_OOS_V1 as P } from './timesfmPanelStickyOosV1Protocol.mjs';

export const MARKER='TIMESFM_PANEL_STICKY_OOS_V1_RESULT';
const CACHE_DIR='.runtime/timesfm-panel-sticky-oos-v1/yahoo';
const RESULT_PATH='validation-runs/diagnostics/timesfm-panel-sticky-oos-v1-result.json';

function sha256(text:string){return crypto.createHash('sha256').update(text).digest('hex');}
function nextDay(date:string){return new Date(Date.parse(date+'T00:00:00Z')+86_400_000).toISOString().slice(0,10);}
function round(value:number|null|undefined,digits=4){return Number.isFinite(value)?Number(Number(value).toFixed(digits)):null;}
function median(values:number[]){const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!rows.length)return null;const m=Math.floor(rows.length/2);return rows.length%2?rows[m]:(rows[m-1]+rows[m])/2;}

function parseYahooOhlcv(symbol:string,text:string){
  const payload=JSON.parse(text),result=payload?.chart?.result?.[0];
  if(payload?.chart?.error)throw new Error('TIMESFM_STICKY_YAHOO_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length)throw new Error('TIMESFM_STICKY_YAHOO_NO_DATA:'+symbol);
  const q=result.indicators?.quote?.[0]??{},rows:any[]=[];
  for(let i=0;i<result.timestamp.length;i++){
    const open=Number(q.open?.[i]),high=Number(q.high?.[i]),low=Number(q.low?.[i]),close=Number(q.close?.[i]),volume=Number(q.volume?.[i]);
    if(![open,high,low,close,volume].every(Number.isFinite)||!(open>0)||!(high>0)||!(low>0)||!(close>0)||volume<0)continue;
    rows.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),open,high,low,close,volume});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return {rows,meta:{symbol:String(result.meta?.symbol??symbol).toUpperCase(),instrumentType:String(result.meta?.instrumentType??'').toUpperCase()}};
}

async function fetchYahooRaw(symbol:string){
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const cachePath=path.join(CACHE_DIR,symbol.replace(/[^A-Za-z0-9._-]/g,'_')+'.json');
  if(fs.existsSync(cachePath)){
    const text=fs.readFileSync(cachePath,'utf8');
    return {text,cachePath,cached:true,sha256:sha256(text)};
  }
  const p1=Math.floor(Date.parse(P.data.downloadFrom+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse(nextDay(P.holdout.outcomesThrough)+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=history&includeAdjustedClose=true`;
  let last:any=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      if(response.ok){JSON.parse(text);fs.writeFileSync(cachePath,text,'utf8');return{text,cachePath,cached:false,sha256:sha256(text)};}
      last=new Error('TIMESFM_STICKY_YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,160));
    }catch(error){last=error;}
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  throw last??new Error('TIMESFM_STICKY_YAHOO_FETCH_FAILED:'+symbol);
}

function intersectDates(series:Record<string,any[]>){
  const sets=Object.values(series).map(rows=>new Set(rows.map(row=>row.date)));
  if(!sets.length)return[];
  return [...sets[0]].filter(date=>sets.every(set=>set.has(date))).sort();
}

function monthKeys(first:string,last:string){
  const out:string[]=[];
  let cursor=new Date(first+'-01T00:00:00Z');
  const end=new Date(last+'-01T00:00:00Z');
  while(cursor<=end){
    out.push(cursor.toISOString().slice(0,7));
    cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
  }
  return out;
}

function lastCommonDateInMonth(common:string[],month:string){
  return common.filter(date=>date.startsWith(month)).at(-1)??null;
}

function buildDataset(series:Record<string,any[]>,sourceManifest:any){
  const wanted=MV.targets.map((row:any)=>row.assetId);
  const catalog=EUR_ASSET_UNIVERSE.filter(item=>wanted.includes(item.assetId));
  if(catalog.length!==wanted.length)throw new Error('TIMESFM_STICKY_CATALOG_COVERAGE:'+catalog.length+'/'+wanted.length);
  const assets=catalog.map(item=>({
    assetId:item.assetId,ticker:item.ticker,name:item.name,currency:'EUR',
    bars:series[item.ticker].map(row=>({
      timestamp:row.date+'T00:00:00.000Z',open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume
    })),
    provenance:{sourceType:'REAL' as const,provider:'Yahoo Finance',symbol:item.ticker,isReproducible:true,datasetFingerprint:sourceManifest[item.ticker].rawSha256}
  }));
  return {catalog,dataset:{timeframe:'1d' as const,assets}};
}

function summarize(result:any){
  const finalPoint=result.equityPath.at(-1);
  return {
    finalValueEur:round(result.finalValueEur,2),
    totalReturnPct:round(result.totalReturnPct),
    cashFlowAdjustedReturnPct:round(result.cashFlowAdjustedReturnPct),
    maxDrawdownPct:round(result.decisionPathMaxDrawdownPct),
    totalFeesEur:round(result.totalFeesEur,2),
    totalEstimatedTaxEur:round(result.totalEstimatedTaxEur,2),
    executedBuys:result.executedBuys,
    executedAdds:result.executedAdds,
    executedReductions:result.executedReductions,
    executedExits:result.executedExits,
    finalCashEur:round(finalPoint?.cashEur,2)
  };
}

function selectionChanges(ids:string[]){
  let changes=0;
  for(let i=1;i<ids.length;i++)if(ids[i]!==ids[i-1])changes++;
  return changes;
}

export async function main(){
  const series:Record<string,any[]>={},sourceManifest:any={};
  for(const target of MV.targets){
    const raw=await fetchYahooRaw(target.ticker);
    const parsed=parseYahooOhlcv(target.ticker,raw.text);
    if(parsed.meta.symbol!==target.ticker)throw new Error('TIMESFM_STICKY_YAHOO_IDENTITY:'+target.ticker+':'+parsed.meta.symbol);
    series[target.ticker]=parsed.rows;
    sourceManifest[target.ticker]={
      provider:'Yahoo Finance',sourceType:'REAL',rawCachePath:raw.cachePath,rawSha256:raw.sha256,cached:raw.cached,
      firstDate:parsed.rows[0]?.date??null,lastDate:parsed.rows.at(-1)?.date??null,bars:parsed.rows.length,...parsed.meta
    };
  }

  const common=intersectDates(series);
  const anchors=monthKeys(P.holdout.firstCalendarMonth,P.holdout.lastCalendarMonth).map(month=>{
    const informationDate=lastCommonDateInMonth(common,month);
    if(!informationDate)throw new Error('TIMESFM_STICKY_MONTH_NO_COMMON_DATE:'+month);
    const built=buildProspectiveMultivariateContext(series,informationDate);
    return {anchorId:month,month,informationDate,...built};
  });
  if(anchors.length<P.holdout.minimumUsableAnchors){
    const result={study:P.version,status:P.interpretation.insufficientLabel,anchors:anchors.length,productionDefault:'LEGACY',productionAuthority:false};
    console.log(MARKER);console.log(JSON.stringify(result,null,2));return result;
  }

  const payload={
    study:MV.version,
    protocol:{contextLength:MV.contextLength,forecastHorizon:MV.forecastHorizon,targetIds:MV.targets.map((x:any)=>x.assetId),pastOnlyCovariateCount:MV.covariates.totalPastOnly,useZNorm:true},
    anchors:anchors.map(anchor=>({
      anchorId:anchor.anchorId,informationDate:anchor.informationDate,targetContext:anchor.targetContext,pastOnlyCovariates:anchor.pastOnlyCovariates
    }))
  };
  const remote=await callTimesFmMultivariateContextV1(payload);
  const remoteById=new Map(remote.anchors.map((row:any)=>[String(row.anchorId),row]));

  let previous:string|null=null;
  const stickySelections:Record<string,string>={};
  const naiveSelections:Record<string,string>={};
  const coreSelections:Record<string,string>={};
  const trace:any[]=[];
  for(const anchor of anchors){
    const out:any=remoteById.get(anchor.anchorId);
    if(!out)throw new Error('TIMESFM_STICKY_REMOTE_ANCHOR_MISSING:'+anchor.anchorId);
    const coreIndex=MV.targets.findIndex((x:any)=>x.assetId==='EUNL');
    const coreLast=anchor.targetContext[coreIndex].at(-1);
    const coreLevel=Number(out.targetsOnly?.point?.EUNL?.['60']);
    if(!(coreLast>0)||!Number.isFinite(coreLevel))throw new Error('TIMESFM_STICKY_CORE_FORECAST_INVALID:'+anchor.anchorId);
    const corePred=(coreLevel/coreLast-1)*100;
    const evidence=MV.targets.map((target:any,index:number)=>{
      if(target.assetId==='EUNL')return {assetId:'EUNL',predictedRelativeReturn60Pct:0};
      const last=anchor.targetContext[index].at(-1);
      const level=Number(out.targetsOnly?.point?.[target.assetId]?.['60']);
      if(!(last>0)||!Number.isFinite(level))throw new Error('TIMESFM_STICKY_FORECAST_INVALID:'+anchor.anchorId+':'+target.assetId);
      return {assetId:target.assetId,predictedRelativeReturn60Pct:(level/last-1)*100-corePred};
    });
    const selected=selectTimesFmPanelStickyV1(evidence,previous);
    const naive=selectTimesFmPanelNaiveTop1V1(evidence);
    stickySelections[anchor.informationDate]=selected.selectedAssetId;
    naiveSelections[anchor.informationDate]=naive;
    coreSelections[anchor.informationDate]='EUNL';
    trace.push({
      month:anchor.month,informationDate:anchor.informationDate,previousAssetId:previous,
      selectedAssetId:selected.selectedAssetId,selectedRank60:selected.selectedRank60,
      selectedPredictedRelativeReturn60Pct:round(selected.selectedPredictedRelativeReturn60Pct),
      selectionReason:selected.reason,switched:selected.switched,naiveTop1AssetId:naive,
      ranked:selected.ranked.map(row=>({...row,predictedRelativeReturn60Pct:round(row.predictedRelativeReturn60Pct)}))
    });
    previous=selected.selectedAssetId;
  }

  const {catalog,dataset}=buildDataset(series,sourceManifest);
  const decisionDates=anchors.map(anchor=>anchor.informationDate);
  const scenarios:any[]=[];
  for(const initialCapitalEur of P.scenarios.capitalEur){
    for(const riskProfile of P.scenarios.riskProfiles){
      const input:any={
        dataset,catalog,startDate:decisionDates[0],explicitDecisionDates:decisionDates,frequency:'MONTHLY',
        initialCapitalEur,riskProfile,horizonYears:3,cashBenchmarkAnnualPct:P.scenarios.cashBenchmarkAnnualPct,
        minimumBars:252,taxSettings:{priorSavingsTaxableBaseEur:0,contextConfirmed:P.scenarios.taxContextConfirmed},externalCashFlows:[]
      };
      const legacy=runDynamicReplayWithRotationExperiment(input,'CORE_ARCHITECTURE_V1');
      const sticky=DynamicHistoricalReplayEngine.run({...input,researchDirectSelector:{policy:'TIMESFM_PANEL_STICKY_SELECTOR_V1',selectionsByDate:stickySelections}});
      const core=DynamicHistoricalReplayEngine.run({...input,researchDirectSelector:{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate:coreSelections}});
      const naive=DynamicHistoricalReplayEngine.run({...input,researchDirectSelector:{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate:naiveSelections}});
      scenarios.push({
        initialCapitalEur,riskProfile,
        sticky:summarize(sticky),legacy:summarize(legacy),core:summarize(core),naive:summarize(naive),
        stickyBeatsCore:sticky.finalValueEur>core.finalValueEur+0.005,
        stickyBeatsLegacy:sticky.finalValueEur>legacy.finalValueEur+0.005,
        stickyBeatsNaive:sticky.finalValueEur>naive.finalValueEur+0.005,
        stickyExcessReturnPctPointsVsCore:sticky.totalReturnPct-core.totalReturnPct,
        stickyExcessReturnPctPointsVsLegacy:sticky.totalReturnPct-legacy.totalReturnPct,
        stickyExcessReturnPctPointsVsNaive:sticky.totalReturnPct-naive.totalReturnPct,
        stickyMaxDrawdownDeteriorationVsCorePctPoints:sticky.decisionPathMaxDrawdownPct-core.decisionPathMaxDrawdownPct
      });
    }
  }

  const stickyIds=trace.map(row=>row.selectedAssetId);
  const naiveIds=trace.map(row=>row.naiveTop1AssetId);
  const stickyChanges=selectionChanges(stickyIds);
  const naiveChanges=selectionChanges(naiveIds);
  const beatsCore=scenarios.filter(row=>row.stickyBeatsCore).length;
  const beatsLegacy=scenarios.filter(row=>row.stickyBeatsLegacy).length;
  const medianVsCore=median(scenarios.map(row=>row.stickyExcessReturnPctPointsVsCore));
  const medianVsLegacy=median(scenarios.map(row=>row.stickyExcessReturnPctPointsVsLegacy));
  const maxDdDeterioration=Math.max(...scenarios.map(row=>row.stickyMaxDrawdownDeteriorationVsCorePctPoints));
  const pass=
    beatsCore>=P.interpretation.minimumScenariosBeatingCore
    &&beatsLegacy>=P.interpretation.minimumScenariosBeatingLegacy
    &&(medianVsCore??-Infinity)>0
    &&(medianVsLegacy??-Infinity)>0
    &&maxDdDeterioration<=P.interpretation.maximumDrawdownDeteriorationVsCorePctPoints
    &&stickyChanges<=naiveChanges;
  const status=pass?P.interpretation.passLabel:P.interpretation.failLabel;

  const result={
    schemaVersion:1,study:P.version,generatedAt:new Date().toISOString(),status,methodology:P,
    holdout:{anchors:anchors.length,decisionDates,firstInformationDate:decisionDates[0],lastInformationDate:decisionDates.at(-1),outcomesThrough:P.holdout.outcomesThrough},
    evidence:{sourceManifest,remoteModel:remote.model,remoteRuntime:remote.runtime},
    selection:{stickyChanges,naiveChanges,trace},
    aggregate:{
      scenarios:scenarios.length,stickyBeatsCoreScenarios:beatsCore,stickyBeatsLegacyScenarios:beatsLegacy,
      stickyBeatsNaiveScenarios:scenarios.filter(row=>row.stickyBeatsNaive).length,
      medianStickyExcessReturnPctPointsVsCore:round(medianVsCore),
      medianStickyExcessReturnPctPointsVsLegacy:round(medianVsLegacy),
      medianStickyExcessReturnPctPointsVsNaive:round(median(scenarios.map(row=>row.stickyExcessReturnPctPointsVsNaive))),
      maxStickyDrawdownDeteriorationVsCorePctPoints:round(maxDdDeterioration)
    },
    scenarios:scenarios.map(row=>({
      ...row,
      stickyExcessReturnPctPointsVsCore:round(row.stickyExcessReturnPctPointsVsCore),
      stickyExcessReturnPctPointsVsLegacy:round(row.stickyExcessReturnPctPointsVsLegacy),
      stickyExcessReturnPctPointsVsNaive:round(row.stickyExcessReturnPctPointsVsNaive),
      stickyMaxDrawdownDeteriorationVsCorePctPoints:round(row.stickyMaxDrawdownDeteriorationVsCorePctPoints)
    })),
    notes:[
      'Policy frozen before opening the 2025-10 through 2026-06 holdout.',
      'Consumed 2018Q1-2025Q3 data may not validate or promote this policy.',
      'The sticky selector uses only FULL_PANEL_TARGETS_ONLY 60-session relative forecasts, with top-1 entry and top-3 incumbent retention.',
      'Replay is canonical NEXT_OPEN with whole-share feasibility, fees, taxes and causal cash remuneration.',
      'PASS is only an OOS economic screen; production remains LEGACY and prospective confirmation remains mandatory.'
    ],
    productionDefault:'LEGACY',productionAuthority:false
  };
  fs.mkdirSync(path.dirname(RESULT_PATH),{recursive:true});
  fs.writeFileSync(RESULT_PATH,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(MARKER);console.log(JSON.stringify(result,null,2));return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{
  console.error(MARKER);
  console.error(JSON.stringify({study:P.version,status:'BLOCKED_OR_TECHNICAL_FAILED',error:error?.message??String(error),productionDefault:'LEGACY',productionAuthority:false},null,2));
  process.exitCode=1;
});
