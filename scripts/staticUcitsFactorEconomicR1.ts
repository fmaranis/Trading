/**
 * Fixed research-only A/B execution diagnostic. Reuses canonical Custodia
 * DynamicHistoricalReplayEngine HOLD_ONLY accounting; never ranks ETFs.
 * Past 2017-2025 results are CONSUMED_DIAGNOSTIC_ONLY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PriceBar } from '../src/investment/backtesting/types';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';
import { EUR_ASSET_UNIVERSE, EUR_VALIDATION_HOLDOUT_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import {
  INSTRUMENTS
} from './staticUcitsFactorMarketDataPreflightV1.mjs';
import {
  resolveUcitsSourceSnapshot, fetchEcb, parseEcbCsv, reconcileAnnual
} from './staticUcitsFactorIssuerAnnualReconciliationV1.mjs';

export const VERSION = 'STATIC_UCITS_FACTOR_ECONOMIC_DIAGNOSTIC_R1';
export const MARKER = 'STATIC_UCITS_FACTOR_ECONOMIC_DIAGNOSTIC_R1_RESULT';
export const OUTPUT = 'validation-runs/diagnostics/static-ucits-factor-economic-diagnostic-r1-result.json';
export const CUTOFF = '2025-12-31';
export const START = '2016-11-04';
export const SLIPPAGE_PCT = 0.1; // 10 bp one-way, fixed before opening economic outcomes
export const CAPITALS_EUR = [13000,2500,30000] as const;
export const A = Object.freeze({EUNL:1});
export const B = Object.freeze({EUNL:0.5,HOLDOUT_XDEM:1/6,HOLDOUT_XDEQ:1/6,HOLDOUT_XDEV:1/6});
function assert(x: unknown, label:string): asserts x { if(!x)throw Error('STATIC_FACTOR_R1_'+label); }
function day(stamp:number){return new Date(stamp*1000).toISOString().slice(0,10);}

/** Complete source OHLC and Yahoo adjusted ratio: no imputed bars. */
export function adjustedYahooBars(raw:string, ticker:string, dates:readonly string[]):PriceBar[]{
  const data=JSON.parse(raw)?.chart?.result?.[0];
  const timestamps=data?.timestamp, q=data?.indicators?.quote?.[0],adj=data?.indicators?.adjclose?.[0]?.adjclose;
  assert(Array.isArray(timestamps)&&q&&Array.isArray(adj),'RAW_YAHOO_INCOMPLETE:'+ticker);
  const rows=new Map<string,PriceBar>();
  for(let i=0;i<timestamps.length;i++){
    const d=day(timestamps[i]);
    if(d<START || d>CUTOFF)continue;
    const open=Number(q.open?.[i]),high=Number(q.high?.[i]),low=Number(q.low?.[i]),
      close=Number(q.close?.[i]),adjusted=Number(adj[i]);
    if(![open,high,low,close,adjusted].every(x=>Number.isFinite(x)&&x>0))continue;
    assert(high+1e-8>=Math.max(open,close)&&low-1e-8<=Math.min(open,close),'RAW_OHLC_CONTRADICTION:'+ticker+':'+d);
    const ratio=adjusted/close;
    assert(!rows.has(d),'DUPLICATED_YAHOO_BAR:'+ticker+':'+d);
    rows.set(d,{timestamp:d+'T00:00:00.000Z',open:open*ratio,
      high:high*ratio,low:low*ratio,close:adjusted,
      volume:Number(q.volume?.[i])||0});
  }
  const result=dates.map(d=>{const bar=rows.get(d);assert(bar,'MISSING_FULL_OHLC:'+ticker+':'+d);return bar});
  assert(result.length>2000&&result.every((v,i)=>i===0||v.timestamp>result[i-1].timestamp),'BAD_COMMON_HISTORY:'+ticker);
  return result;
}
function round(n:number){return Math.round(n*10000)/10000;}
function yearEnds(path: readonly {date:string;equityEur:number}[]){
  const end=new Map<string,{date:string;equityEur:number}>();
  for(const p of path)end.set(p.date.slice(0,4),p);
  return end;
}
export function compareEconomicResults(control:ReturnType<typeof DynamicHistoricalReplayEngine.run>,candidate:ReturnType<typeof DynamicHistoricalReplayEngine.run>){
  assert(control.startDate===candidate.startDate && control.endDate===candidate.endDate,'UNEQUAL_REPLAY_WINDOWS');
  const c=yearEnds(control.equityPath),b=yearEnds(candidate.equityPath);
  let winners=0;const annual=[];
  for(let y=2017;y<=2025;y++){
    const currentC=c.get(String(y)),currentB=b.get(String(y));
    const prevC=c.get(String(y-1)),prevB=b.get(String(y-1));
    assert(currentC && currentB && prevC && prevB && currentC.date===currentB.date,'ANNUAL_WINDOW_INCOMPLETE:'+y);
    const aRet=100*(currentC.equityEur/prevC.equityEur-1);
    const bRet=100*(currentB.equityEur/prevB.equityEur-1);
    const win=bRet>aRet; if(win)winners++;
    annual.push({year:y,controlPct:round(aRet),factorPct:round(bRet),factorExcessPp:round(bRet-aRet),
      candidateBeatsControl:win,
      terminalTaxAffectsThisYear:y===2025});
  }
  return {
    controlNetFinalEur:round(control.finalValueEur),
    candidateNetFinalEur:round(candidate.finalValueEur),
    netExcessEur:round(candidate.finalValueEur-control.finalValueEur),
    netExcessPctPoints:round(candidate.totalReturnPct-control.totalReturnPct),
    candidateBetterNet: candidate.finalValueEur>control.finalValueEur,
    controlMaxDrawdownPct:round(control.decisionPathMaxDrawdownPct),
    candidateMaxDrawdownPct:round(candidate.decisionPathMaxDrawdownPct),
    controlFeesEur:round(control.totalFeesEur),candidateFeesEur:round(candidate.totalFeesEur),
    controlEstimatedTaxEur:round(control.totalEstimatedTaxEur),
    candidateEstimatedTaxEur:round(candidate.totalEstimatedTaxEur),
    controlCashInterestTaxEur:round(control.cashInterestTaxEur),
    candidateCashInterestTaxEur:round(candidate.cashInterestTaxEur),
    candidateWinningYears:winners,disjointYears:annual.length,
    candidateWinningYearsPct:round(winners/annual.length*100),
    annual,
    annualInterpretation:'Descriptive non-overlapping calendar windows, 2025 includes frozen terminal liquidation tax; not an independent holdout or future hit probability.'
  };
}

export async function main(){
  if(fs.existsSync(OUTPUT)){
    const old=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
    assert(old.version===VERSION&&old.productionAuthority===false&&old.economicOutcomesCalculated===true,
      'SAVED_DIAGNOSTIC_INVALID');
    console.log(MARKER,JSON.stringify({status:'ALREADY_SAVED',scientificStatus:old.scientificStatus,
      netExcessEur:old.capitals?.[0]?.comparison?.netExcessEur,output:OUTPUT,productionAuthority:false}));
    return;
  }
  const snapshot=await resolveUcitsSourceSnapshot();
  // A new cache vintage must independently pass the same annual NAV/ECB gates.
  const ecb=await fetchEcb(),rates=parseEcbCsv(ecb.raw);
  const checks=INSTRUMENTS.map(inst=>reconcileAnnual(inst,snapshot.panels[inst.ticker].bars,rates));
  assert(checks.every(row=>row.annualConsistency==='PASS_ANNUAL_CONSISTENCY_ONLY'),'ISSUER_ANNUAL_RECONCILIATION_FAILED');
  assert(snapshot.matchesPriorPublishedSummary && snapshot.coverage.sharedDates===2532,
    'CHANGED_FROZEN_COMPARABLE_HISTORY');
  const yearDates=snapshot.panels['EUNL.DE'].bars.map((b:{date:string})=>b.date).filter((d:string)=>d>=START&&d<=CUTOFF);
  const otherDates=INSTRUMENTS.slice(1).map(inst=>new Set(snapshot.panels[inst.ticker].bars.map((b:{date:string})=>b.date)));
  const common=yearDates.filter((d:string)=>otherDates.every(set=>set.has(d)));
  assert(common.length>2200 && common[0]===START && common.at(-1)?.startsWith('2025-12-'),
    'COMMON_2017_TO_2025_MISSING');
  const catalogue=[...EUR_ASSET_UNIVERSE,...EUR_VALIDATION_HOLDOUT_UNIVERSE];
  const dataset:MultiAssetDataset={
    timeframe:'1d',
    assets:INSTRUMENTS.map(inst=>{
      const item=catalogue.find(row=>row.assetId===inst.assetId);
      assert(item&&item.isin===inst.isin&&item.ticker===inst.ticker,'CATALOGUE_IDENTITY:'+inst.ticker);
      const evidence=snapshot.prior.sourceRawCache[inst.ticker];
      const raw=fs.readFileSync(path.join(snapshot.cacheDir,inst.ticker+'.json'),'utf8');
      const bars=adjustedYahooBars(raw,inst.ticker,common);
      return {assetId:inst.assetId,ticker:inst.ticker,name:item.name,currency:'EUR',bars,
        provenance:{sourceType:'REAL' as const,provider:'Yahoo Finance',symbol:inst.ticker,
          isReproducible:true,datasetFingerprint:evidence.sha256,
          startDate:common[0],endDate:common.at(-1),timeframe:'1d'}};
    })
  };
  const scenarios:Array<{capitalEur:number;status:'EXECUTABLE'|'UNEXECUTABLE';
    comparison:ReturnType<typeof compareEconomicResults>|null;
    orders?:{A:unknown[];B:unknown[]};reason?:string}>=[];
  for(const capital of CAPITALS_EUR){
    function run(targetWeights:Record<string,number>){
      return DynamicHistoricalReplayEngine.run({
        dataset,catalog:catalogue,startDate:START,initialCapitalEur:capital,
        riskProfile:'MEDIUM',horizonYears:5,simulationMode:'HOLD_ONLY',
        cashBenchmarkMode:'HISTORICAL_ECB_DFR_FLOOR_0',
        externalCashFlows:[],
        researchStaticBuyHold:{targetWeights,slippagePct:SLIPPAGE_PCT,liquidateAtEnd:true}
      });
    }
    try {
      const control=run(A),candidate=run(B);
      assert(control.executedBuys===1&&candidate.executedBuys===4
        &&control.executedExits===1&&candidate.executedExits===4,
        'UNEXECUTABLE_INITIAL_OR_TERMINAL_ORDERS:'+capital);
      assert([...control.signals,...candidate.signals].every(x=>
        x.executed&&Number.isInteger(Math.abs(x.unitsDelta))
        &&x.executionDate!==null&&x.executionDate>x.signalDate),
        'NONCAUSAL_OR_FRACTIONAL_ORDER:'+capital);
      scenarios.push({capitalEur:capital,status:'EXECUTABLE',
        comparison:compareEconomicResults(control,candidate),
        orders:{
          A:control.signals.map(x=>({action:x.action,assetId:x.assetId,date:x.executionDate,
            units:x.unitsDelta,feeEur:round(x.feeEur)})),
          B:candidate.signals.map(x=>({action:x.action,assetId:x.assetId,date:x.executionDate,
            units:x.unitsDelta,feeEur:round(x.feeEur)}))
        }});
    } catch(error) {
      // Only a whole-share feasibility failure may be treated as unavailable
      // for a non-primary capital. All other methodology/data errors must STOP.
      const reason=error instanceof Error?error.message:String(error);
      if(capital===CAPITALS_EUR[0]||!reason.includes('UNEXECUTABLE_WHOLE_SHARES'))throw error;
      scenarios.push({capitalEur:capital,status:'UNEXECUTABLE',comparison:null,reason});
    }
  }
  const primary=scenarios[0]?.comparison;
  assert(primary && scenarios[0].status==='EXECUTABLE','PRIMARY_CAPITAL_MUST_BE_EXECUTABLE');
  const scientificStatus=primary.netExcessEur>0?'PROMISING_DIAGNOSTIC_ONLY':'FAIL_DIAGNOSTIC';
  const result={
    version:VERSION,status:'COMPLETED_CONSUMED_HISTORY_DIAGNOSTIC',
    scientificStatus,
    generatedAt:new Date().toISOString(),
    sourceType:'REAL',sourceVintageHash:snapshot.sourceVintageHash,
    sourceResolution:snapshot.sourceResolution,
    matchesPriorPublishedSummary:snapshot.matchesPriorPublishedSummary,
    dataWindow:{first:common[0],last:common.at(-1),sessions:common.length},
    frozenAt:'2026-10-28',researchOnly:true,
    portfolioA:A,portfolioB:B,slippageOneWayPct:SLIPPAGE_PCT,
    brokerProfile:'MYINVESTOR_DEFAULT',cashMode:'HISTORICAL_ECB_DFR_FLOOR_0',
    taxModel:'SPANISH_CONSERVATIVE_MAX_RATE_GAINS_WITH_19_PERCENT_CASH_WITHHOLDING_UNCONFIRMED',
    issuerAnnualConsistencyGates:checks.map(row=>({ticker:row.ticker,status:row.annualConsistency,
      meanAbsPp:row.meanAbsoluteDifferencePctPoints,maxAbsPp:row.maximumAbsoluteDifferencePctPoints})),
    capitals:scenarios,annualHoldoutConsumed:true,independentValidation:false,
    dailyIssuerNavCertified:false,brokerIsinsConfirmed:false,
    economicOutcomesCalculated:true,productionAuthority:false,
    limitations:[
      'The 2017-2025 market years and fund annual NAV returns have already been inspected and are consumed.',
      'Whole-share NEXT_OPEN model; broker commission min/max and frozen 10bp one-way slippage proxy. No historical executable spread/taxes or broker ISIN confirmation.',
      'Issuer annual consistency is not an independent daily NAV or delisting audit.',
      'Tax on gains is conservative where tax context is unknown; the terminal disposal is a frozen horizon convention.',
      'A positive gross or net comparison is NOT promotable; LEGACY unchanged.'
    ]
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(MARKER,JSON.stringify({status:scientificStatus,primaryCapitalEur:13000,
    primaryNetExcessEur:primary.netExcessEur,primaryWinningYears:primary.candidateWinningYears,
    primaryAnnualPeriods:primary.disjointYears,sourceResolution:snapshot.sourceResolution,
    output:OUTPUT,productionAuthority:false}));
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{
  console.error(MARKER,JSON.stringify({status:'BLOCKED',reason:error?.message??String(error),
    productionAuthority:false}));process.exitCode=1;
});
