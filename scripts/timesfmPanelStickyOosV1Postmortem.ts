import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const MARKER='TIMESFM_PANEL_STICKY_OOS_V1_POSTMORTEM_RESULT';
const SOURCE_RESULT='validation-runs/diagnostics/timesfm-panel-sticky-oos-v1-result.json';
const RESULT_PATH='validation-runs/diagnostics/timesfm-panel-sticky-oos-v1-postmortem.json';

function sha256(text:string){return crypto.createHash('sha256').update(text).digest('hex');}
function mean(xs:number[]){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function round(x:number|null|undefined,d=4){return Number.isFinite(x)?Number(Number(x).toFixed(d)):null;}

function ordinalRanks(rows:Array<{id:string;value:number}>){
  const sorted=[...rows].sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
  const ranks=new Map<string,number>();
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;
    const rank=(i+1+j)/2;
    for(let k=i;k<j;k++)ranks.set(sorted[k].id,rank);
    i=j;
  }
  return ranks;
}

export function spearmanRankIc(pred:Array<{id:string;value:number}>,actual:Array<{id:string;value:number}>){
  const a=new Map(actual.map(row=>[row.id,row.value]));
  const common=pred.filter(row=>a.has(row.id));
  if(common.length<3)return null;
  const rp=ordinalRanks(common);
  const ra=ordinalRanks(common.map(row=>({id:row.id,value:a.get(row.id)!})));
  const xp=common.map(row=>rp.get(row.id)!);
  const xa=common.map(row=>ra.get(row.id)!);
  const mp=mean(xp)!,ma=mean(xa)!;
  let num=0,dp=0,da=0;
  for(let i=0;i<common.length;i++){
    const p=xp[i]-mp,q=xa[i]-ma;
    num+=p*q;dp+=p*p;da+=q*q;
  }
  const den=Math.sqrt(dp*da);
  return den>0?num/den:null;
}

function parseYahooClose(text:string){
  const payload=JSON.parse(text),result=payload?.chart?.result?.[0];
  if(!result?.timestamp?.length)throw new Error('TIMESFM_STICKY_POSTMORTEM_YAHOO_NO_DATA');
  const q=result.indicators?.quote?.[0]??{},rows:Array<{date:string;close:number}>=[];
  for(let i=0;i<result.timestamp.length;i++){
    const close=Number(q.close?.[i]);
    if(!(close>0)||!Number.isFinite(close))continue;
    rows.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),close});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return rows;
}

function intersectDates(series:Record<string,Array<{date:string;close:number}>>){
  const sets=Object.values(series).map(rows=>new Set(rows.map(row=>row.date)));
  if(!sets.length)return[];
  return [...sets[0]].filter(date=>sets.every(set=>set.has(date))).sort();
}

function closeMap(rows:Array<{date:string;close:number}>){return new Map(rows.map(row=>[row.date,row.close]));}

export async function main(){
  if(!fs.existsSync(SOURCE_RESULT))throw new Error('TIMESFM_STICKY_POSTMORTEM_SOURCE_RESULT_MISSING');
  const source=JSON.parse(fs.readFileSync(SOURCE_RESULT,'utf8'));
  if(source?.study!=='TIMESFM_PANEL_STICKY_OOS_V1')throw new Error('TIMESFM_STICKY_POSTMORTEM_SOURCE_STUDY');
  if(source?.status!=='FAIL_OOS_ECONOMIC_SCREEN_DO_NOT_PROMOTE')throw new Error('TIMESFM_STICKY_POSTMORTEM_SOURCE_STATUS:'+String(source?.status));

  const manifest=source?.evidence?.sourceManifest??{};
  const series:Record<string,Array<{date:string;close:number}>>={};
  for(const [ticker,row] of Object.entries<any>(manifest)){
    const cachePath=String(row?.rawCachePath??'');
    if(!cachePath||!fs.existsSync(cachePath))throw new Error('TIMESFM_STICKY_POSTMORTEM_CACHE_MISSING:'+ticker);
    const text=fs.readFileSync(cachePath,'utf8');
    if(sha256(text)!==String(row.rawSha256))throw new Error('TIMESFM_STICKY_POSTMORTEM_CACHE_SHA:'+ticker);
    series[ticker]=parseYahooClose(text);
  }
  const assetToTicker:Record<string,string>={
    EUNL:'EUNL.DE',SXR8:'SXR8.DE',EQQQ:'EQQQ.DE',EXSA:'EXSA.DE',IS3N:'IS3N.DE',
    ZPRV:'ZPRV.DE',EXH1:'EXH1.DE',IBCI:'IBCI.DE','4GLD':'4GLD.DE'
  };
  const common=intersectDates(series);
  const maps=Object.fromEntries(Object.entries(series).map(([ticker,rows])=>[ticker,closeMap(rows)]));
  const rows:any[]=[];

  for(const trace of source.selection?.trace??[]){
    const info=String(trace.informationDate);
    const idx=common.indexOf(info);
    if(idx<0)throw new Error('TIMESFM_STICKY_POSTMORTEM_INFO_NOT_COMMON:'+info);
    const futureDate=common[idx+60];
    if(!futureDate)throw new Error('TIMESFM_STICKY_POSTMORTEM_FUTURE60_MISSING:'+info);
    const core0=maps['EUNL.DE'].get(info),core1=maps['EUNL.DE'].get(futureDate);
    if(!(core0>0&&core1>0))throw new Error('TIMESFM_STICKY_POSTMORTEM_CORE_PRICE:'+info);
    const coreRet=(core1/core0-1)*100;

    const pred:any[]=[],actual:any[]=[];
    for(const rank of trace.ranked??[]){
      const assetId=String(rank.assetId);
      if(assetId==='EUNL')continue;
      const ticker=assetToTicker[assetId];
      const p0=maps[ticker]?.get(info),p1=maps[ticker]?.get(futureDate);
      if(!(p0>0&&p1>0))throw new Error('TIMESFM_STICKY_POSTMORTEM_PRICE:'+info+':'+assetId);
      const rel=(p1/p0-1)*100-coreRet;
      pred.push({id:assetId,value:Number(rank.predictedRelativeReturn60Pct)});
      actual.push({id:assetId,value:rel});
    }
    const ic=spearmanRankIc(pred,actual);
    const predSorted=[...pred].sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
    const actualSorted=[...actual].sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
    const top1=predSorted[0]?.id??null;
    const actualBest=actualSorted[0]?.id??null;
    const top1ActualRank=actualSorted.findIndex(row=>row.id===top1)+1;
    const directionHits=pred.map(p=>{
      const a=actual.find(x=>x.id===p.id)!;
      return Math.sign(p.value)===Math.sign(a.value)?1:0;
    });
    const selectedAssetId=String(trace.selectedAssetId);
    const selectedActual=actual.find(x=>x.id===selectedAssetId)?.value??(selectedAssetId==='EUNL'?0:null);

    rows.push({
      month:trace.month,informationDate:info,future60Date:futureDate,
      rankIc60:round(ic,6),
      directionalAccuracyPct60:round((mean(directionHits)??0)*100,2),
      predictedTop1AssetId:top1,
      actualBestAssetId:actualBest,
      top1ExactHit:top1===actualBest,
      top1ActualRank,
      top1InActualTop3:top1ActualRank>0&&top1ActualRank<=3,
      selectedAssetId,
      selectedActualRelativeReturn60Pct:round(selectedActual,4),
      actualRelativeReturns60:Object.fromEntries(actual.map(x=>[x.id,round(x.value,4)]))
    });
  }

  const rankIcs=rows.map(row=>Number(row.rankIc60)).filter(Number.isFinite);
  const dirs=rows.map(row=>Number(row.directionalAccuracyPct60)).filter(Number.isFinite);
  const selectedRels=rows.map(row=>Number(row.selectedActualRelativeReturn60Pct)).filter(Number.isFinite);
  const result={
    schemaVersion:1,
    study:'TIMESFM_PANEL_STICKY_OOS_V1_POSTMORTEM',
    generatedAt:new Date().toISOString(),
    status:'CONSUMED_HOLDOUT_SIGNAL_DIAGNOSTIC_ONLY',
    sourceStudy:source.study,
    sourceStatus:source.status,
    sampleDisposition:'CONSUMED_AFTER_OOS_POLICY_TEST_NO_PROMOTION',
    aggregate:{
      anchors:rows.length,
      meanRankIc60:round(mean(rankIcs),6),
      meanDirectionalAccuracyPct60:round(mean(dirs),2),
      positiveRankIcAnchors:rows.filter(row=>Number(row.rankIc60)>0).length,
      top1ExactHits:rows.filter(row=>row.top1ExactHit).length,
      top1InActualTop3:rows.filter(row=>row.top1InActualTop3).length,
      meanSelectedActualRelativeReturn60Pct:round(mean(selectedRels),4)
    },
    anchors:rows,
    interpretation:{
      signalQualitySeparatedFromEconomicPolicy:true,
      mayRetuneOnThisHoldout:false,
      mayPromoteProduction:false
    },
    notes:[
      'This postmortem reuses only forecasts and REAL Yahoo data already consumed by the OOS economic screen.',
      'It is diagnostic only and cannot validate any new policy designed after observing these outcomes.',
      'The purpose is to separate TimesFM cross-sectional signal quality from the failed 100%-concentration economic translation.'
    ],
    productionDefault:'LEGACY',
    productionAuthority:false
  };
  fs.mkdirSync(path.dirname(RESULT_PATH),{recursive:true});
  fs.writeFileSync(RESULT_PATH,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(MARKER);console.log(JSON.stringify(result,null,2));return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{
  console.error(MARKER);
  console.error(JSON.stringify({study:'TIMESFM_PANEL_STICKY_OOS_V1_POSTMORTEM',status:'BLOCKED_OR_TECHNICAL_FAILED',error:error?.message??String(error),productionDefault:'LEGACY',productionAuthority:false},null,2));
  process.exitCode=1;
});
