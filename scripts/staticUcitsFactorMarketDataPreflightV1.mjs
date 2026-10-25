/**
 * Data-quality preflight only. NO security selection, no return ranking,
 * no strategy weights, no simulated fills, no fresh-holdout certification.
 * Reuses the repo's Yahoo v8 source path and frozen, verified holdout identities.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const VERSION = 'STATIC_UCITS_FACTOR_MARKET_DATA_PREFLIGHT_V1';
export const MARKER = 'STATIC_UCITS_FACTOR_MARKET_DATA_PREFLIGHT_V1_RESULT';
export const START = '2016-11-04'; // Strictly after all three Xtrackers benchmark changes.
export const THROUGH = '2026-10-23'; // Last complete Xetra business day before freeze, not dynamic/lookahead.
export const BENCHMARK_CHANGE = '2016-11-03';
export const CACHE_DIR = '.runtime/static-ucits-factor-v1/yahoo';
export const OUTPUT_PATH = 'validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-result.json';
export const INSTRUMENTS = Object.freeze([
  {assetId:'EUNL', ticker:'EUNL.DE', isin:'IE00B4L5Y983', role:'CORE'},
  {assetId:'HOLDOUT_XDEM', ticker:'XDEM.DE', isin:'IE00BL25JP72', role:'MOMENTUM'},
  {assetId:'HOLDOUT_XDEQ', ticker:'XDEQ.DE', isin:'IE00BL25JL35', role:'SECTOR_NEUTRAL_QUALITY'},
  {assetId:'HOLDOUT_XDEV', ticker:'XDEV.DE', isin:'IE00BL25JM42', role:'ENHANCED_VALUE'}
]);
export const DATA_GATES = Object.freeze({
  minReferenceBars:2000,
  minRelativeCoverage:0.95,
  minCommonCoverage:0.90,
  latestCommonAtLeast:'2026-09-30',
  earliestCommonAtMost:'2016-11-15'
});
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const assert = (ok,code) => {if(!ok)throw new Error('UCITS_PREFLIGHT_'+code);};
const cleanDay = time => new Date(Number(time)*1000).toISOString().slice(0,10);
const positive = value => Number.isFinite(value) && value>0;
const dayAfter = date => new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const uniq = rows => new Set(rows).size===rows.length;
function readFrozenCatalogue(){
  // Keep the catalogue as the one source of truth for instrument identity.
  const content=fs.readFileSync('src/investment/decision/assetUniverse.ts','utf8');
  for(const item of INSTRUMENTS){
    const re=new RegExp("assetId: '"+item.assetId+"', ticker: '"+item.ticker.replace('.','\\.')+"', isin: '"+item.isin+"'");
    assert(re.test(content),'CATALOGUE_ISIN_MISMATCH:'+item.ticker);
  }
}

/** Reject wrong exchange/currency/symbol; Yahoo chart itself is not an ISIN master. */
export function parseYahooEtfChart(ticker,raw){
  const obj=JSON.parse(raw);
  assert(!obj?.chart?.error,'YAHOO_ERROR:'+ticker);
  const data=obj?.chart?.result?.[0], meta=data?.meta, stamps=data?.timestamp;
  assert(Boolean(meta)&&Array.isArray(stamps)&&stamps.length>0,'EMPTY_CHART:'+ticker);
  assert(String(meta.symbol??'').toUpperCase()===ticker,'WRONG_SYMBOL:'+ticker);
  assert(String(meta.currency??'').toUpperCase()==='EUR','NOT_EUR:'+ticker);
  assert(String(meta.instrumentType??meta.quoteType??'').toUpperCase()==='ETF','NOT_ETF:'+ticker);
  assert(['GER','XETRA','XET','XTR'].includes(String(meta.exchangeName??'').toUpperCase())
    || /XETRA/i.test(String(meta.fullExchangeName??'')), 'NOT_XETRA:'+ticker);
  assert(Number.isFinite(Number(meta.firstTradeDate)) && Number(meta.firstTradeDate)>0,'FIRST_TRADE_MISSING:'+ticker);
  assert(cleanDay(meta.firstTradeDate)<BENCHMARK_CHANGE,'INSTRUMENT_TOO_NEW:'+ticker);

  const quote=data.indicators?.quote?.[0]??{};
  const adj=data.indicators?.adjclose?.[0]?.adjclose;
  assert(Array.isArray(adj),'ADJUSTED_CLOSE_MISSING:'+ticker);
  const bars=[],seen=new Set();let incompleteBars=0;
  for(let i=0;i<stamps.length;i++){
    const date=cleanDay(stamps[i]);
    if(date<START||date>THROUGH) continue;
    const rawOpen=quote.open?.[i],rawClose=quote.close?.[i],adjustedClose=adj[i];
    if(!positive(rawOpen)||!positive(rawClose)||!positive(adjustedClose)){incompleteBars++;continue;}
    const adjustedOpen=Number(rawOpen)*Number(adjustedClose)/Number(rawClose);
    assert(positive(adjustedOpen),'INVALID_ADJUSTMENT:'+ticker+':'+date);
    assert(!seen.has(date),'DUPLICATE_SESSION:'+ticker+':'+date);
    seen.add(date);
    bars.push({date,rawOpen:Number(rawOpen),rawClose:Number(rawClose),adjustedOpen,adjustedClose:Number(adjustedClose)});
  }
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  assert(bars.length>0 && bars.every((b,i)=>i===0||bars[i-1].date<b.date),'NON_MONOTONE:'+ticker);
  const splitEvents=Object.values(data.events?.splits??{}).map(e=>({
    date:e.date?cleanDay(e.date):null,numerator:e.numerator??null,denominator:e.denominator??null
  }));
  const dividendEvents=Object.keys(data.events?.dividends??{}).length;
  return {
    bars,
    meta:{
      symbol:ticker,currency:'EUR',exchange:String(meta.exchangeName??meta.fullExchangeName),
      instrumentType:'ETF',firstTradeDate:cleanDay(meta.firstTradeDate),
      timezone:String(meta.timezone??''),
      incompleteBars,splitEvents,dividendEventCount:dividendEvents
    }
  };
}

/** Pure coverage check: no returns, scores, benchmark superiority or factor weights. */
export function auditCoverage(panels,gates=DATA_GATES){
  const symbols=INSTRUMENTS.map(x=>x.ticker);
  for(const ticker of symbols) assert(panels[ticker]?.bars?.length>0,'MISSING_SERIES:'+ticker);
  const ref=panels['EUNL.DE'].bars,referenceDays=ref.map(x=>x.date);
  assert(ref.length>=gates.minReferenceBars,'CORE_HISTORY_SHORT');
  const referenceSet=new Set(referenceDays),present={};
  for(const ticker of symbols){
    const rows=panels[ticker].bars.map(x=>x.date);
    assert(uniq(rows),'DUPLICATE_DATE:'+ticker);
    const covered=rows.filter(date=>referenceSet.has(date)).length;
    const fraction=covered/ref.length;
    assert(fraction>=gates.minRelativeCoverage,'COVERAGE:'+ticker+':'+fraction.toFixed(4));
    present[ticker]={bars:rows.length,first:rows[0],last:rows.at(-1),referenceDaysCovered:covered,referenceCoverageFraction:fraction};
  }
  const others=symbols.slice(1).map(s=>new Set(panels[s].bars.map(x=>x.date)));
  const common=referenceDays.filter(date=>others.every(set=>set.has(date)));
  assert(common.length>0,'NO_COMMON_SESSION');
  assert(common.length/ref.length>=gates.minCommonCoverage,'COMMON_COVERAGE');
  assert(common[0]>BENCHMARK_CHANGE&&common[0]<=gates.earliestCommonAtMost,'START_DATE');
  assert(common.at(-1)>=gates.latestCommonAtLeast,'HISTORICAL_DATA_STALE');
  return {
    benchmarkChangeDate:BENCHMARK_CHANGE,
    comparableStartDate:common[0],lastCommonDate:common.at(-1),
    sharedDates:common.length,referenceDates:ref.length,
    sharedCoverageFraction:common.length/ref.length,
    instruments:present
  };
}

async function readRawYahoo(ticker){
  const file=path.join(CACHE_DIR,ticker+'.json');
  if(fs.existsSync(file)){
    const raw=fs.readFileSync(file,'utf8');
    return {raw,sha256:sha256(raw),cached:true,path:file};
  }
  const period1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),period2=Math.floor(Date.parse(dayAfter(THROUGH)+'T00:00:00Z')/1000);
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)
    +'?period1='+period1+'&period2='+period2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  let lastError=null;
  for(let n=0;n<2;n++){
    try{
      const reply=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 Custodia/1.0','Accept':'application/json'},signal:AbortSignal.timeout(25000)});
      const raw=await reply.text();
      if(!reply.ok)throw new Error('YAHOO_HTTP_'+reply.status+':'+ticker);
      JSON.parse(raw); // invalid JSON must never be cached
      fs.mkdirSync(CACHE_DIR,{recursive:true});
      fs.writeFileSync(file,raw,{flag:'wx'}); // raw snapshot cannot be refreshed post hoc
      return {raw,sha256:sha256(raw),cached:false,path:file};
    }catch(err){lastError=err;}
  }
  throw lastError??new Error('YAHOO_FETCH_UNAVAILABLE:'+ticker);
}

export async function main(){
  readFrozenCatalogue();
  if(fs.existsSync(OUTPUT_PATH)){
    const old=JSON.parse(fs.readFileSync(OUTPUT_PATH,'utf8'));
    assert(old.version===VERSION && old.status==='PASS_DATA_COVERAGE_PENDING_EXTERNAL_RECONCILIATION','SAVED_RESULT_INVALID');
    for(const [ticker,evidence] of Object.entries(old.sourceRawCache??{})){
      const raw=fs.readFileSync(evidence.path,'utf8');
      assert(sha256(raw)===evidence.sha256 && INSTRUMENTS.some(x=>x.ticker===ticker),'SAVED_RAW_CACHE_MISMATCH:'+ticker);
    }
    console.log(MARKER,JSON.stringify({status:'ALREADY_SAVED',version:VERSION,resultPath:OUTPUT_PATH,productionAuthority:false}));
    return;
  }
  const panels={},sourceRawCache={};
  for(const inst of INSTRUMENTS){
    const entry=await readRawYahoo(inst.ticker);
    const parsed=parseYahooEtfChart(inst.ticker,entry.raw);
    panels[inst.ticker]=parsed;
    sourceRawCache[inst.ticker]={
      path:entry.path,sha256:entry.sha256,bytes:Buffer.byteLength(entry.raw),cached:entry.cached
    };
  }
  const coverage=auditCoverage(panels);
  const result={
    version:VERSION,status:'PASS_DATA_COVERAGE_PENDING_EXTERNAL_RECONCILIATION',
    generatedAt:new Date().toISOString(),sourceType:'REAL',provider:'YAHOO_FINANCE',
    from:START,through:THROUGH,sourceRawCache,coverage,
    instruments:INSTRUMENTS.map(inst=>({...inst,metadata:panels[inst.ticker].meta})),
    priceOutcomesAnalyzed:false,economicOutcomesCalculated:false,
    pending:['ISSUER_NAV_ADJUSTMENT_AND_CORPORATE_ACTIONS_RECONCILIATION','MYINVESTOR_EXACT_ISIN_AVAILABILITY','PORTFOLIO_LOOK_THROUGH_AND_CAPITAL_FEASIBILITY','FROZEN_ECONOMIC_POLICY_AND_FRESH_SAMPLE'],
    productionDefault:'LEGACY',productionAuthority:false,
    caveats:[
      'Yahoo adjusted close is not an audited issuer NAV and can be retrospectively rebased by corporate actions',
      'Ticker/exchange/currency identity is not independent ISIN identity; verified issuer ISINs are anchored in catalogue',
      'Same date and EUR listings do not guarantee no lookahead for delayed NAVs or availability of whole-share fills',
      'No rankings, returns, simulation, portfolio strategy or fresh-out-of-sample claims'
    ]
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH),{recursive:true});
  fs.writeFileSync(OUTPUT_PATH,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(MARKER,JSON.stringify({
    status:result.status,resultPath:OUTPUT_PATH,coverage:result.coverage,sourceType:'REAL',
    economicOutcomesCalculated:false,productionAuthority:false
  }));
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{
  console.error(MARKER,JSON.stringify({status:'BLOCKED',reason:error?.message??String(error),economicOutcomesCalculated:false,productionAuthority:false}));
  process.exitCode=1;
});
