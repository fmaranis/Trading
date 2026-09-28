import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SECTOR_52W_HIGH_LEADERSHIP_V1 as P, assertSeries, assertFullCoverage } from './sector52WeekHighLeadershipV1Protocol.mjs';

export const OUTPUT_PATH='validation-runs/diagnostics/sector-52w-high-leadership-v1-input.json';
export const CACHE_DIR='.runtime/sector-52w-high-leadership-v1/yahoo';
export const DOWNLOAD_FROM='2011-07-01';
export const DOWNLOAD_THROUGH='2026-01-07';
export const INPUT_MARKER='SECTOR_52W_HIGH_LEADERSHIP_V1_INPUT';

export function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
export function finitePositive(v){return Number.isFinite(Number(v))&&Number(v)>0;}
export function nextDay(date){return new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);}

export function parseYahooPayload(symbol,text){
  const payload=JSON.parse(text),result=payload?.chart?.result?.[0];
  if(payload?.chart?.error) throw new Error('YAHOO_CHART_ERROR:'+symbol+':'+String(payload.chart.error.description??payload.chart.error.code??'unknown'));
  if(!result?.timestamp?.length) throw new Error('YAHOO_NO_DATA:'+symbol);
  const meta=result.meta??{},quote=result.indicators?.quote?.[0]??{},adj=result.indicators?.adjclose?.[0]?.adjclose??[];
  const bars=[];
  for(let i=0;i<result.timestamp.length;i++){
    const rawOpen=Number(quote.open?.[i]),rawClose=Number(quote.close?.[i]),adjustedClose=Number(adj[i]);
    if(!finitePositive(rawOpen)||!finitePositive(rawClose)||!finitePositive(adjustedClose)) continue;
    const adjustedOpen=rawOpen*adjustedClose/rawClose;
    if(!finitePositive(adjustedOpen)) continue;
    bars.push({date:new Date(Number(result.timestamp[i])*1000).toISOString().slice(0,10),open:adjustedOpen,close:adjustedClose});
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  assertSeries(bars,symbol);
  const firstTradeDate=Number.isFinite(Number(meta.firstTradeDate))?new Date(Number(meta.firstTradeDate)*1000).toISOString().slice(0,10):null;
  return {
    bars,
    meta:{
      symbol:String(meta.symbol??symbol).toUpperCase(),
      currency:String(meta.currency??'').toUpperCase(),
      exchange:String(meta.exchangeName??''),
      instrumentType:String(meta.instrumentType??'').toUpperCase(),
      firstTradeDate,
      timezone:String(meta.timezone??''),
      rawEventCounts:{
        dividends:Object.keys(result.events?.dividends??{}).length,
        splits:Object.keys(result.events?.splits??{}).length
      }
    }
  };
}

export function assertIdentity(symbol,meta){
  if(meta.symbol!==symbol) throw new Error('YAHOO_SYMBOL_IDENTITY:'+symbol+':'+meta.symbol);
  if(meta.currency!=='USD') throw new Error('YAHOO_NON_USD:'+symbol+':'+meta.currency);
  if(meta.instrumentType!=='ETF') throw new Error('YAHOO_NON_ETF:'+symbol+':'+meta.instrumentType);
  if(!meta.firstTradeDate) throw new Error('YAHOO_FIRST_TRADE_UNKNOWN:'+symbol);
  const cutoff=P.sectors.includes(symbol)?'1999-01-01':symbol==='SPY'?'1994-01-01':'2013-01-01';
  if(meta.firstTradeDate>cutoff) throw new Error('YAHOO_IDENTITY_TOO_NEW:'+symbol+':'+meta.firstTradeDate+':'+cutoff);
}

async function fetchYahooRaw(symbol){
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const cachePath=path.join(CACHE_DIR,symbol+'.json');
  if(fs.existsSync(cachePath)){
    const text=fs.readFileSync(cachePath,'utf8');
    return {text,cachePath,cached:true,sha256:sha256(text)};
  }
  const p1=Math.floor(Date.parse(DOWNLOAD_FROM+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse(nextDay(DOWNLOAD_THROUGH)+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
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
      lastError=new Error('YAHOO_HTTP_'+response.status+':'+symbol+':'+text.slice(0,160));
      if(![429,500,502,503,504].includes(response.status)) break;
    }catch(error){lastError=error;}
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  throw lastError??new Error('YAHOO_FETCH_FAILED:'+symbol);
}

function existingSummary(input,text){
  return {
    status:'INPUT_ALREADY_FROZEN',
    study:input.study,
    provider:input.provider,
    inputPath:OUTPUT_PATH,
    inputSha256:sha256(text),
    symbols:Object.keys(input.series??{}).length,
    productionDefault:input.productionDefault,
    productionAuthority:input.productionAuthority
  };
}

export async function main(){
  if(fs.existsSync(OUTPUT_PATH)){
    const text=fs.readFileSync(OUTPUT_PATH,'utf8'),input=JSON.parse(text);
    if(input.study!==P.version||input.provider!=='YAHOO_FINANCE'||input.provenance!=='REAL') throw new Error('EXISTING_INPUT_INVALID');
    console.log(INPUT_MARKER,JSON.stringify(existingSummary(input,text)));
    return;
  }

  const symbols=[...P.sectors,...P.benchmarks],series={},seriesMeta={},rawCache={};
  for(const symbol of symbols){
    const raw=await fetchYahooRaw(symbol);
    const parsed=parseYahooPayload(symbol,raw.text);
    assertIdentity(symbol,parsed.meta);
    series[symbol]=parsed.bars;
    seriesMeta[symbol]={...parsed.meta,provider:'Yahoo Finance',currency:'USD',adjustmentStatus:'ADJUSTED_DERIVED',adjustmentMethod:'PROVIDER_ADJCLOSE_RATIO'};
    rawCache[symbol]={path:raw.cachePath,sha256:raw.sha256,bytes:Buffer.byteLength(raw.text),cached:raw.cached};
  }

  assertFullCoverage(series,P.sectors,DOWNLOAD_FROM,DOWNLOAD_THROUGH);
  assertFullCoverage(series,[...P.sectors,...P.benchmarks],P.diagnostic.startOnOrAfter,DOWNLOAD_THROUGH);

  const input={
    schemaVersion:1,
    study:P.version,
    generatedAt:new Date().toISOString(),
    provider:'YAHOO_FINANCE',
    provenance:'REAL',
    downloadFrom:DOWNLOAD_FROM,
    downloadThrough:DOWNLOAD_THROUGH,
    adjustment:'Yahoo raw open/close adjusted by same-session adjClose/rawClose; close = adjClose',
    identityAudit:'PASS',
    coverageAudit:'PASS',
    seriesMeta,
    rawCache,
    series,
    productionDefault:'LEGACY',
    productionAuthority:false,
    economicOutcomesCalculated:false
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH),{recursive:true});
  const text=JSON.stringify(input,null,2)+'\n';
  fs.writeFileSync(OUTPUT_PATH,text,'utf8');
  console.log(INPUT_MARKER,JSON.stringify({
    status:'INPUT_FROZEN',
    study:P.version,provider:input.provider,inputPath:OUTPUT_PATH,inputSha256:sha256(text),
    symbols:symbols.length,sectorSessions:series[P.sectors[0]].length,commonSessionsFrom2013:series.SPY.filter(r=>r.date>=P.diagnostic.startOnOrAfter).length,
    productionDefault:'LEGACY',productionAuthority:false
  }));
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  main().catch(error=>{
    console.error(INPUT_MARKER,JSON.stringify({status:'INPUT_BLOCKED',reason:error?.message??String(error),productionDefault:'LEGACY',productionAuthority:false}));
    process.exitCode=1;
  });
}
