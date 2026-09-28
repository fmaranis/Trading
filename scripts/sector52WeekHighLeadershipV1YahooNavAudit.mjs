import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SECTOR_52W_HIGH_LEADERSHIP_V1 as P } from './sector52WeekHighLeadershipV1Protocol.mjs';
import { sha256 } from './sector52WeekHighLeadershipV1YahooInput.mjs';

const START='2016-08-31';
const END='2026-08-31';
const END_EXCLUSIVE='2026-09-01';
const TOLERANCE_PP=0.20;
const CACHE_DIR='.runtime/sector-52w-high-leadership-v1/yahoo-nav-audit';
const OUTPUT='validation-runs/diagnostics/sector-52w-high-leadership-v1-yahoo-nav-reconciliation.json';

export const OFFICIAL=Object.freeze({
  XLB:{nav:10.21,marketValue:10.21,url:'https://www.ssga.com/us/en/institutional/etfs/state-street-materials-select-sector-spdr-etf-xlb'},
  XLE:{nav:10.79,marketValue:10.79,url:'https://www.ssga.com/us/en/individual/etfs/state-street-energy-select-sector-spdr-etf-xle'},
  XLF:{nav:13.28,marketValue:13.28,url:'https://www.ssga.com/us/en/individual/etfs/state-street-financial-select-sector-spdr-etf-xlf'},
  XLI:{nav:13.48,marketValue:13.49,url:'https://www.ssga.com/us/en/individual/etfs/state-street-industrial-select-sector-spdr-etf-xli'},
  XLK:{nav:24.30,marketValue:24.30,url:'https://www.ssga.com/mainfund/XLK'},
  XLP:{nav:7.39,marketValue:7.40,url:'https://www.ssga.com/us/en/institutional/etfs/state-street-consumer-staples-select-sector-spdr-etf-xlp'},
  XLU:{nav:8.92,marketValue:8.92,url:'https://www.ssga.com/us/en/institutional/etfs/state-street-utilities-select-sector-spdr-etf-xlu'},
  XLV:{nav:10.72,marketValue:10.72,url:'https://www.ssga.com/us/en/institutional/etfs/state-street-health-care-select-sector-spdr-etf-xlv'},
  XLY:{nav:12.36,marketValue:12.36,url:'https://www.ssga.com/us/en/intermediary/etfs/state-street-consumer-discretionary-select-sector-spdr-etf-xly'}
});

function epoch(date){return Math.floor(Date.parse(date+'T00:00:00Z')/1000);}
function finitePositive(v){return Number.isFinite(Number(v))&&Number(v)>0;}

export function cagrPct(startValue,endValue,years=10){
  if(!finitePositive(startValue)||!finitePositive(endValue)||!(years>0)) throw new Error('NAV_AUDIT_VALUES_INVALID');
  return (Math.pow(Number(endValue)/Number(startValue),1/years)-1)*100;
}

export function reconcileRow(symbol,startValue,endValue){
  const ref=OFFICIAL[symbol];
  if(!ref) throw new Error('NAV_AUDIT_REFERENCE_MISSING:'+symbol);
  const yahoo=cagrPct(startValue,endValue,10);
  const diffNav=yahoo-ref.nav,diffMarket=yahoo-ref.marketValue;
  return {
    symbol,startDate:START,endDate:END,startAdjustedClose:Number(startValue),endAdjustedClose:Number(endValue),
    yahooCagrPct:yahoo,officialNavPct:ref.nav,officialMarketValuePct:ref.marketValue,
    diffNavPctPoints:diffNav,diffMarketValuePctPoints:diffMarket,
    tolerancePctPoints:TOLERANCE_PP,
    pass:Math.abs(diffNav)<=TOLERANCE_PP&&Math.abs(diffMarket)<=TOLERANCE_PP,
    officialSource:ref.url
  };
}

async function fetchRaw(symbol){
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const file=path.join(CACHE_DIR,symbol+'.json');
  if(fs.existsSync(file)) return {text:fs.readFileSync(file,'utf8'),cached:true};
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${epoch(START)}&period2=${epoch(END_EXCLUSIVE)}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  let last=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)});
      const text=await response.text();
      if(response.ok){JSON.parse(text);fs.writeFileSync(file,text,'utf8');return {text,cached:false};}
      last=new Error('NAV_AUDIT_YAHOO_HTTP_'+response.status+':'+symbol);
      if(![429,500,502,503,504].includes(response.status)) break;
    }catch(error){last=error;}
    if(attempt<2) await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  throw last??new Error('NAV_AUDIT_YAHOO_FAILED:'+symbol);
}

export function endpointsFromPayload(symbol,text){
  const payload=JSON.parse(text),r=payload?.chart?.result?.[0];
  if(payload?.chart?.error||!r?.timestamp?.length) throw new Error('NAV_AUDIT_NO_DATA:'+symbol);
  const adj=r.indicators?.adjclose?.[0]?.adjclose??[];
  const rows=r.timestamp.map((ts,i)=>({date:new Date(Number(ts)*1000).toISOString().slice(0,10),value:Number(adj[i])}))
    .filter(x=>finitePositive(x.value));
  const start=rows.find(x=>x.date===START),end=rows.find(x=>x.date===END);
  if(!start||!end) throw new Error('NAV_AUDIT_ENDPOINT_MISSING:'+symbol+':'+(start?'':'START:')+(end?'':'END'));
  return {start:start.value,end:end.value};
}

export async function main(){
  const rows=[],cache={};
  for(const symbol of P.sectors){
    const raw=await fetchRaw(symbol);
    const ep=endpointsFromPayload(symbol,raw.text);
    rows.push(reconcileRow(symbol,ep.start,ep.end));
    cache[symbol]={sha256:sha256(raw.text),bytes:Buffer.byteLength(raw.text),cached:raw.cached};
  }
  const failed=rows.filter(x=>!x.pass);
  const result={
    schemaVersion:1,study:P.version,implementationRevision:P.implementationRevision,
    status:failed.length?'INCONCLUSIVE_NAV_RECONCILIATION':'PASS_NAV_RECONCILIATION',
    startDate:START,endDate:END,tolerancePctPoints:TOLERANCE_PP,
    officialAsOf:'2026-08-31',rows,cache,
    productionDefault:'LEGACY',productionAuthority:false
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+'\n');
  if(failed.length) throw new Error('NAV_RECONCILIATION_FAILED:'+failed.map(x=>x.symbol).join(','));
  console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_NAV_RECONCILIATION_PASS',JSON.stringify({revision:P.implementationRevision,symbols:rows.length,maxAbsDiffPctPoints:Math.max(...rows.flatMap(x=>[Math.abs(x.diffNavPctPoints),Math.abs(x.diffMarketValuePctPoints)]))}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error('SECTOR_52W_HIGH_LEADERSHIP_V1_NAV_RECONCILIATION_BLOCKED',error?.message??String(error));process.exitCode=1;});
}
