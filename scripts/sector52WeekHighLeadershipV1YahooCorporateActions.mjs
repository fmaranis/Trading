import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SECTOR_52W_HIGH_LEADERSHIP_V1 as P } from './sector52WeekHighLeadershipV1Protocol.mjs';
import { OUTPUT_PATH, sha256 } from './sector52WeekHighLeadershipV1YahooInput.mjs';

const AUDIT_PATH='validation-runs/diagnostics/sector-52w-high-leadership-v1-corporate-actions.json';
const EXPECTED_SPLITS_2025=Object.freeze({
  XLB:{date:'2025-12-05',numerator:2,denominator:1},
  XLE:{date:'2025-12-05',numerator:2,denominator:1},
  XLK:{date:'2025-12-05',numerator:2,denominator:1},
  XLU:{date:'2025-12-05',numerator:2,denominator:1},
  XLY:{date:'2025-12-05',numerator:2,denominator:1}
});

function dateFromEpoch(value){return new Date(Number(value)*1000).toISOString().slice(0,10);}
function finitePositive(v){return Number.isFinite(Number(v))&&Number(v)>0;}

export function normalizeEvents(payload){
  const result=payload?.chart?.result?.[0];
  if(!result) throw new Error('CORPORATE_ACTIONS_NO_RESULT');
  const splits=Object.values(result.events?.splits??{}).map(e=>({
    date:dateFromEpoch(e.date),
    numerator:Number(e.numerator),
    denominator:Number(e.denominator),
    splitRatio:String(e.splitRatio??'')
  })).sort((a,b)=>a.date.localeCompare(b.date));
  const dividends=Object.values(result.events?.dividends??{}).map(e=>({
    date:dateFromEpoch(e.date),
    amount:Number(e.amount)
  })).sort((a,b)=>a.date.localeCompare(b.date));
  return {result,splits,dividends};
}

export function splitAdjustmentCheck(result,split){
  const timestamps=result.timestamp??[],q=result.indicators?.quote?.[0]??{},adj=result.indicators?.adjclose?.[0]?.adjclose??[];
  const dates=timestamps.map(dateFromEpoch),idx=dates.findIndex(d=>d===split.date);
  if(idx<=0) throw new Error('SPLIT_SESSION_NOT_FOUND:'+split.date);
  const rawPrev=Number(q.close?.[idx-1]),rawNow=Number(q.close?.[idx]),adjPrev=Number(adj[idx-1]),adjNow=Number(adj[idx]);
  if(![rawPrev,rawNow,adjPrev,adjNow].every(finitePositive)) throw new Error('SPLIT_PRICE_INVALID:'+split.date);
  const expectedRatio=(rawNow/rawPrev)*(split.numerator/split.denominator);
  const adjustedRatio=adjNow/adjPrev;
  const relativeError=Math.abs(expectedRatio-adjustedRatio)/Math.max(1e-12,Math.abs(adjustedRatio));
  return {date:split.date,rawPrev,rawNow,adjPrev,adjNow,expectedRatio,adjustedRatio,relativeError,pass:relativeError<=1e-6};
}

export function auditSymbol(symbol,payload){
  const {result,splits,dividends}=normalizeEvents(payload);
  for(const s of splits){
    if(!finitePositive(s.numerator)||!finitePositive(s.denominator)) throw new Error('SPLIT_RATIO_INVALID:'+symbol+':'+s.date);
  }
  for(const d of dividends){
    if(!Number.isFinite(d.amount)||d.amount<0) throw new Error('DIVIDEND_INVALID:'+symbol+':'+d.date);
  }
  const splitChecks=splits.map(s=>splitAdjustmentCheck(result,s));
  if(splitChecks.some(x=>!x.pass)) throw new Error('SPLIT_ADJUSTMENT_MISMATCH:'+symbol);
  const expected=EXPECTED_SPLITS_2025[symbol];
  if(expected){
    const match=splits.find(s=>s.date===expected.date&&s.numerator===expected.numerator&&s.denominator===expected.denominator);
    if(!match) throw new Error('EXPECTED_2025_SPLIT_MISSING:'+symbol);
  }
  return {symbol,splits,dividends,splitChecks};
}

export function main(){
  if(!fs.existsSync(OUTPUT_PATH)) throw new Error('YAHOO_FROZEN_INPUT_MISSING');
  const input=JSON.parse(fs.readFileSync(OUTPUT_PATH,'utf8'));
  if(input.study!==P.version||input.provider!=='YAHOO_FINANCE'||input.provenance!=='REAL') throw new Error('YAHOO_FROZEN_INPUT_INVALID');
  const symbols=[...P.sectors,...P.benchmarks],audits=[];
  for(const symbol of symbols){
    const cache=input.rawCache?.[symbol];
    if(!cache?.path||!cache?.sha256) throw new Error('RAW_CACHE_MANIFEST_MISSING:'+symbol);
    if(!fs.existsSync(cache.path)) throw new Error('RAW_CACHE_FILE_MISSING:'+symbol);
    const raw=fs.readFileSync(cache.path,'utf8');
    if(sha256(raw)!==cache.sha256) throw new Error('RAW_CACHE_HASH_MISMATCH:'+symbol);
    audits.push(auditSymbol(symbol,JSON.parse(raw)));
  }
  const result={
    schemaVersion:1,
    study:P.version,
    implementationRevision:P.implementationRevision,
    status:'PASS_CORPORATE_ACTIONS',
    source:'YAHOO_RAW_CACHE',
    expectedOfficial2025SplitSet:EXPECTED_SPLITS_2025,
    symbols:audits,
    totalSplits:audits.reduce((s,a)=>s+a.splits.length,0),
    totalDividends:audits.reduce((s,a)=>s+a.dividends.length,0),
    productionDefault:'LEGACY',
    productionAuthority:false
  };
  fs.mkdirSync(path.dirname(AUDIT_PATH),{recursive:true});
  fs.writeFileSync(AUDIT_PATH,JSON.stringify(result,null,2)+'\n');
  console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_CORPORATE_ACTIONS_PASS',JSON.stringify({
    revision:P.implementationRevision,totalSplits:result.totalSplits,totalDividends:result.totalDividends
  }));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{main();}catch(error){
    console.error('SECTOR_52W_HIGH_LEADERSHIP_V1_CORPORATE_ACTIONS_BLOCKED',error?.message??String(error));
    process.exitCode=1;
  }
}
