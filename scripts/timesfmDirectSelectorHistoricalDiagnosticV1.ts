import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';
import { selectTimesFmDirectWinnerV1 } from '../src/investment/decision/timesFmDirectSelectorV1';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as STAGE_B } from './timesfmStageBProtocol.mjs';
import { main as runStageBDiagnostic } from './timesfmStageBDiagnosticLive.mjs';
import {
  TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1 as P,
  classifyTimesFmDirectHistorical
} from './timesfmDirectSelectorHistoricalDiagnosticV1Protocol.mjs';

export const MARKER = 'TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1_RESULT';
const STAGE_B_RESULT_PATH = 'validation-runs/diagnostics/timesfm-stage-b-predictive-benchmark-v1-result.json';
const RESULT_PATH = 'validation-runs/diagnostics/timesfm-direct-selector-historical-diagnostic-v1-result.json';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function round(value: number | null | undefined, digits = 4): number | null {
  return Number.isFinite(value) ? Number(Number(value).toFixed(digits)) : null;
}

function median(values: number[]): number | null {
  const rows = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

async function ensureStageBResult(): Promise<{ result: any; regenerated: boolean }> {
  let regenerated = false;
  if (!fs.existsSync(STAGE_B_RESULT_PATH)) {
    await runStageBDiagnostic();
    regenerated = true;
  }
  let result = JSON.parse(fs.readFileSync(STAGE_B_RESULT_PATH, 'utf8'));
  if (result?.status !== 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION') {
    throw new Error('TIMESFM_DIRECT_STAGE_B_NOT_PASS:' + String(result?.status ?? 'MISSING'));
  }
  const manifest = result?.evidence?.sourceManifest ?? {};
  const invalid = Object.values(manifest).some((row: any) => {
    const cachePath = String(row?.rawCachePath ?? '');
    if (!cachePath || !fs.existsSync(cachePath)) return true;
    return sha256(fs.readFileSync(cachePath,'utf8')) !== String(row?.rawSha256 ?? '');
  });
  if (invalid) {
    await runStageBDiagnostic();
    regenerated = true;
    result = JSON.parse(fs.readFileSync(STAGE_B_RESULT_PATH, 'utf8'));
    if (result?.status !== 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION') {
      throw new Error('TIMESFM_DIRECT_STAGE_B_REGEN_NOT_PASS:' + String(result?.status ?? 'MISSING'));
    }
  }
  return { result, regenerated };
}

function parseYahooOhlc(symbol: string, text: string) {
  const payload=JSON.parse(text);
  const result=payload?.chart?.result?.[0];
  if(payload?.chart?.error) throw new Error('TIMESFM_DIRECT_YAHOO_ERROR:'+symbol);
  if(!result?.timestamp?.length) throw new Error('TIMESFM_DIRECT_YAHOO_NO_DATA:'+symbol);
  const quote=result.indicators?.quote?.[0]??{};
  const bars:Array<{timestamp:string;open:number;high:number;low:number;close:number;volume:number}>=[];
  for(let i=0;i<result.timestamp.length;i++){
    const open=Number(quote.open?.[i]),high=Number(quote.high?.[i]),low=Number(quote.low?.[i]),close=Number(quote.close?.[i]);
    if(![open,high,low,close].every(value=>Number.isFinite(value)&&value>0)) continue;
    const volume=Number(quote.volume?.[i]);
    bars.push({
      timestamp:new Date(Number(result.timestamp[i])*1000).toISOString(),
      open,high,low,close,
      volume:Number.isFinite(volume)&&volume>=0?volume:0
    });
  }
  bars.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  return bars;
}

function buildDataset(stageBResult:any){
  const wanted=[STAGE_B.core.assetId,...STAGE_B.assets.map((row:any)=>row.assetId)];
  const catalog=EUR_ASSET_UNIVERSE.filter(item=>wanted.includes(item.assetId));
  if(catalog.length!==wanted.length) throw new Error('TIMESFM_DIRECT_CATALOG_COVERAGE:'+catalog.length+'/'+wanted.length);
  const manifest=stageBResult.evidence.sourceManifest;
  const assets=catalog.map(item=>{
    const row=manifest[item.ticker];
    if(!row?.rawCachePath||!fs.existsSync(row.rawCachePath)) throw new Error('TIMESFM_DIRECT_RAW_CACHE_MISSING:'+item.ticker);
    const text=fs.readFileSync(row.rawCachePath,'utf8');
    if(sha256(text)!==row.rawSha256) throw new Error('TIMESFM_DIRECT_RAW_CACHE_SHA:'+item.ticker);
    return {
      assetId:item.assetId,
      ticker:item.ticker,
      name:item.name,
      currency:'EUR',
      bars:parseYahooOhlc(item.ticker,text),
      provenance:{
        sourceType:'REAL' as const,
        provider:'Yahoo Finance',
        symbol:item.ticker,
        isReproducible:true,
        datasetFingerprint:row.rawSha256
      }
    };
  });
  return {catalog,dataset:{timeframe:'1d',assets}};
}

function buildSelections(stageBResult:any){
  const eventRows:any[]=Array.isArray(stageBResult?.events)?stageBResult.events:[];
  const dates:string[]=[...new Set<string>(eventRows.map((row:any)=>String(row.informationDate)))].sort((a,b)=>a.localeCompare(b));
  if(dates.length!==P.decisionCountExpected) throw new Error('TIMESFM_DIRECT_INFORMATION_DATE_COUNT:'+dates.length);
  const selectionsByDate:Record<string,string>={};
  const trace:any[]=[];
  for(const date of dates){
    const rows=eventRows.filter((row:any)=>String(row.informationDate)===date);
    const evidence=STAGE_B.assets.map((asset:any)=>{
      const r20=rows.find((row:any)=>row.assetId===asset.assetId&&row.horizon===20);
      const r60=rows.find((row:any)=>row.assetId===asset.assetId&&row.horizon===60);
      const v20=Number(r20?.mvPredRelativeReturnPct),v60=Number(r60?.mvPredRelativeReturnPct);
      if(!Number.isFinite(v20)||!Number.isFinite(v60)) throw new Error('TIMESFM_DIRECT_FORECAST_MISSING:'+date+':'+asset.assetId);
      return {assetId:asset.assetId,predictedRelativeReturn20Pct:v20,predictedRelativeReturn60Pct:v60};
    });
    evidence.push({
      assetId:STAGE_B.core.assetId,
      predictedRelativeReturn20Pct:0,
      predictedRelativeReturn60Pct:0
    });
    const winner=selectTimesFmDirectWinnerV1(evidence);
    selectionsByDate[date]=winner.assetId;
    const item=[STAGE_B.core,...STAGE_B.assets].find((row:any)=>row.assetId===winner.assetId);
    trace.push({
      informationDate:date,
      selectedAssetId:winner.assetId,
      selectedTicker:item?.ticker??winner.assetId,
      selectedIsStructuralCore:winner.assetId===STAGE_B.core.assetId,
      rank20:winner.rank20,
      rank60:winner.rank60,
      meanOrdinalRank:winner.meanOrdinalRank,
      meanPredictedRelativeReturnPct:round(winner.meanPredictedRelativeReturnPct),
      predictedRelativeReturn20Pct:round(winner.predictedRelativeReturn20Pct),
      predictedRelativeReturn60Pct:round(winner.predictedRelativeReturn60Pct)
    });
  }
  return {dates,selectionsByDate,trace};
}

function executedTradeSignature(result:any):string{
  return result.signals
    .filter((row:any)=>row.executed&&!row.isInitialAllocation&&['BUY','ADD','REDUCE','EXIT'].includes(row.action))
    .map((row:any)=>[
      row.signalDate,row.executionDate,row.assetId,row.action,
      Number(row.notionalEur??0).toFixed(2),Number(row.feeEur??0).toFixed(2)
    ].join('|'))
    .join('\n');
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
    finalCashEur:round(finalPoint?.cashEur,2),
    decisions:result.decisions,
    materialSignals:result.materialSignals
  };
}

export async function main(){
  const stageB=await ensureStageBResult();
  const {catalog,dataset}=buildDataset(stageB.result);
  const {dates,selectionsByDate,trace}=buildSelections(stageB.result);
  const coreSelectionsByDate=Object.fromEntries(dates.map(date=>[date,STAGE_B.core.assetId]));

  const scenarios:any[]=[];
  for(const capital of P.capitalScenarios){
    for(const riskProfile of P.riskProfiles){
      const input:any={
        dataset,
        catalog,
        startDate:dates[0],
        explicitDecisionDates:dates,
        frequency:'QUARTERLY',
        initialCapitalEur:capital.initialCapitalEur,
        riskProfile,
        horizonYears:P.horizonYears,
        cashBenchmarkAnnualPct:2.5,
        minimumBars:P.minimumBars,
        taxSettings:{priorSavingsTaxableBaseEur:0,contextConfirmed:false},
        externalCashFlows:[]
      };
      const legacy=runDynamicReplayWithRotationExperiment(input,'CORE_ARCHITECTURE_V1');
      const timesfm=DynamicHistoricalReplayEngine.run({
        ...input,
        researchDirectSelector:{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate}
      });
      const core=DynamicHistoricalReplayEngine.run({
        ...input,
        researchDirectSelector:{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate:coreSelectionsByDate}
      });

      scenarios.push({
        capitalBand:capital.band,
        initialCapitalEur:capital.initialCapitalEur,
        riskProfile,
        legacy:summarize(legacy),
        timesfm:summarize(timesfm),
        core:summarize(core),
        timesFmExcessFinalEurVsLegacy:timesfm.finalValueEur-legacy.finalValueEur,
        timesFmExcessReturnPctPointsVsLegacy:timesfm.totalReturnPct-legacy.totalReturnPct,
        timesFmExcessFinalEurVsCore:timesfm.finalValueEur-core.finalValueEur,
        timesFmExcessReturnPctPointsVsCore:timesfm.totalReturnPct-core.totalReturnPct,
        legacyExcessFinalEurVsCore:legacy.finalValueEur-core.finalValueEur,
        timesFmTradeSignatureChangedVsLegacy:executedTradeSignature(timesfm)!==executedTradeSignature(legacy),
        timesFmBeatsLegacy:timesfm.finalValueEur>legacy.finalValueEur+0.005,
        timesFmBeatsCore:timesfm.finalValueEur>core.finalValueEur+0.005,
        legacyBeatsCore:legacy.finalValueEur>core.finalValueEur+0.005
      });
    }
  }

  const counts:Record<string,number>={};
  for(const row of trace) counts[row.selectedTicker]=(counts[row.selectedTicker]??0)+1;
  const winnerChanges=trace.reduce((sum,row,index)=>sum+(index>0&&row.selectedAssetId!==trace[index-1].selectedAssetId?1:0),0);
  const status=classifyTimesFmDirectHistorical(scenarios);
  const result={
    schemaVersion:1,
    study:P.version,
    generatedAt:new Date().toISOString(),
    status,
    role:P.role,
    methodology:P,
    evidence:{
      stageBResultPath:STAGE_B_RESULT_PATH,
      stageBResultRegenerated:stageB.regenerated,
      stageBStatus:stageB.result.status,
      informationDates:dates,
      informationDateCount:dates.length,
      yahooRawSourceManifest:stageB.result.evidence.sourceManifest
    },
    selection:{
      policy:'TIMESFM_DIRECT_SELECTOR_V1',
      structuralCoreAssetId:STAGE_B.core.assetId,
      structuralCoreTicker:STAGE_B.core.ticker,
      winnerChanges,
      selectionCounts:counts,
      trace
    },
    aggregate:{
      scenarios:scenarios.length,
      timesFmBeatsLegacyScenarios:scenarios.filter(row=>row.timesFmBeatsLegacy).length,
      timesFmBeatsCoreScenarios:scenarios.filter(row=>row.timesFmBeatsCore).length,
      legacyBeatsCoreScenarios:scenarios.filter(row=>row.legacyBeatsCore).length,
      tradeSignatureChangedVsLegacyScenarios:scenarios.filter(row=>row.timesFmTradeSignatureChangedVsLegacy).length,
      medianTimesFmExcessFinalEurVsLegacy:round(median(scenarios.map(row=>row.timesFmExcessFinalEurVsLegacy)),2),
      medianTimesFmExcessReturnPctPointsVsLegacy:round(median(scenarios.map(row=>row.timesFmExcessReturnPctPointsVsLegacy))),
      medianTimesFmExcessFinalEurVsCore:round(median(scenarios.map(row=>row.timesFmExcessFinalEurVsCore)),2),
      medianTimesFmExcessReturnPctPointsVsCore:round(median(scenarios.map(row=>row.timesFmExcessReturnPctPointsVsCore)))
    },
    scenarios:scenarios.map(row=>({
      ...row,
      timesFmExcessFinalEurVsLegacy:round(row.timesFmExcessFinalEurVsLegacy,2),
      timesFmExcessReturnPctPointsVsLegacy:round(row.timesFmExcessReturnPctPointsVsLegacy),
      timesFmExcessFinalEurVsCore:round(row.timesFmExcessFinalEurVsCore,2),
      timesFmExcessReturnPctPointsVsCore:round(row.timesFmExcessReturnPctPointsVsCore),
      legacyExcessFinalEurVsCore:round(row.legacyExcessFinalEurVsCore,2)
    })),
    notes:[
      'POST-HOC consumed-sample diagnostic only: no production promotion authority.',
      'TimesFM directly chooses one instrument from the frozen eight-asset panel plus structural core; LEGACY scores/gates do not choose the asset in this arm.',
      'The canonical replay still executes NEXT_OPEN, whole-share feasibility, fees, taxes and causal cash remuneration.',
      'The exact same TIMESFM_DIRECT_SELECTOR_V1 rule is frozen before the first future prospective anchor.'
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
  main().catch(error=>{
    console.error(MARKER);
    console.error(JSON.stringify({
      study:P.version,
      status:'BLOCKED_OR_TECHNICAL_FAILED',
      error:error?.message??String(error),
      productionDefault:'LEGACY',
      productionAuthority:false
    },null,2));
    process.exitCode=1;
  });
}
