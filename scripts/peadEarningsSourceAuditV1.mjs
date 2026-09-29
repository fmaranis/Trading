import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PEAD_SOURCE_AUDIT_V1=Object.freeze({
  study:'PEAD_EARNINGS_SOURCE_AUDIT_V1',
  window:{from:'2024-01-15',to:'2024-03-15'},
  indexSymbol:'GSPC.INDX',
  gates:{minimumPitEvents:200,minimumKnownTimingPct:70,minimumActualEstimatePct:70,minimumCausalEligible:150},
  productionDefault:'LEGACY',
  productionAuthority:false
});

const OUT='validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json';
const CACHE='.runtime/pead-earnings-source-audit-v1';
const MARKER='PEAD_EARNINGS_SOURCE_AUDIT_V1_RESULT';

function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
function iso(v){const s=String(v??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))?s:null;}
function finite(v){return v!==null&&v!==''&&Number.isFinite(Number(v));}
export function tickerKey(v){
  return String(v??'').trim().toUpperCase().replace(/\.US$/,'').replace(/[.]/g,'-');
}
function valuesOfObject(v){return v&&typeof v==='object'?Object.values(v):[];}

export function normalizeComponentRows(payload){
  const rows=payload?.HistoricalTickerComponents??payload;
  return valuesOfObject(rows).map(row=>({
    code:tickerKey(row?.Code),
    start:iso(row?.StartDate),
    end:iso(row?.EndDate)
  })).filter(r=>r.code&&r.start);
}

export function normalizeEarningsRows(payload){
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.earnings)?payload.earnings:[];
  return rows.map(row=>({
    code:String(row?.code??row?.Code??'').trim().toUpperCase(),
    ticker:tickerKey(row?.code??row?.Code),
    reportDate:iso(row?.report_date??row?.reportDate),
    fiscalDate:iso(row?.date),
    timing:String(row?.before_after_market??row?.beforeAfterMarket??'').trim(),
    actual:finite(row?.actual??row?.epsActual)?Number(row?.actual??row?.epsActual):null,
    estimate:finite(row?.estimate??row?.epsEstimate)?Number(row?.estimate??row?.epsEstimate):null,
    difference:finite(row?.difference??row?.epsDifference)?Number(row?.difference??row?.epsDifference):null,
    percent:finite(row?.percent??row?.surprisePercent)?Number(row?.percent??row?.surprisePercent):null,
    currency:row?.currency==null?null:String(row.currency)
  }));
}

export function activeMember(componentRows,ticker,date){
  if(!date)return false;
  const key=tickerKey(ticker);
  return componentRows.some(r=>r.code===key&&r.start<=date&&(!r.end||date<=r.end));
}

export function auditPayloads(componentPayload,earningsPayload){
  const components=normalizeComponentRows(componentPayload);
  const events=normalizeEarningsRows(earningsPayload);
  const pit=events.filter(e=>e.reportDate&&activeMember(components,e.ticker,e.reportDate));
  const knownTiming=pit.filter(e=>e.timing==='BeforeMarket'||e.timing==='AfterMarket');
  const actualEstimate=pit.filter(e=>e.actual!=null&&e.estimate!=null);
  const inconsistent=pit.filter(e=>{
    if(e.actual==null||e.estimate==null||e.difference==null)return false;
    const tolerance=Math.max(0.005,1e-4*Math.max(1,Math.abs(e.actual),Math.abs(e.estimate)));
    return Math.abs((e.actual-e.estimate)-e.difference)>tolerance;
  });
  const seen=new Set(),duplicates=[];
  for(const e of pit){
    const k=[e.ticker,e.fiscalDate,e.reportDate].join('|');
    if(seen.has(k))duplicates.push(k); else seen.add(k);
  }
  const causal=pit.filter(e=>
    e.reportDate&&e.fiscalDate
    &&(e.timing==='BeforeMarket'||e.timing==='AfterMarket')
    &&e.actual!=null&&e.estimate!=null
    &&!inconsistent.includes(e)
  );
  const timingPct=pit.length?100*knownTiming.length/pit.length:0;
  const actualEstimatePct=pit.length?100*actualEstimate.length/pit.length:0;
  const g=PEAD_SOURCE_AUDIT_V1.gates;
  const gates={
    pitEvents:pit.length>=g.minimumPitEvents,
    timingCoverage:timingPct>=g.minimumKnownTimingPct,
    actualEstimateCoverage:actualEstimatePct>=g.minimumActualEstimatePct,
    causalEligible:causal.length>=g.minimumCausalEligible,
    noDuplicates:duplicates.length===0,
    differenceConsistent:inconsistent.length===0
  };
  return {
    counts:{componentIntervals:components.length,rawEarningsEvents:events.length,pitEvents:pit.length,knownTiming:knownTiming.length,actualEstimate:actualEstimate.length,causalEligible:causal.length},
    coverage:{knownTimingPct:timingPct,actualEstimatePct},
    quality:{duplicateCount:duplicates.length,inconsistentDifferenceCount:inconsistent.length},
    gates,
    passed:Object.values(gates).every(Boolean),
    timingBreakdown:{
      beforeMarket:pit.filter(e=>e.timing==='BeforeMarket').length,
      afterMarket:pit.filter(e=>e.timing==='AfterMarket').length,
      unknown:pit.filter(e=>e.timing!=='BeforeMarket'&&e.timing!=='AfterMarket').length
    }
  };
}

async function fetchJsonCached(name,url,headers={}){
  fs.mkdirSync(CACHE,{recursive:true});
  const file=path.join(CACHE,name+'.json');
  let text;
  if(fs.existsSync(file))text=fs.readFileSync(file,'utf8');
  else{
    const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Custodia/1.0 PEADSourceAudit',...headers},signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)});
    text=await response.text();
    if(!response.ok)throw new Error('PEAD_SOURCE_HTTP_'+response.status+':'+name+':'+text.slice(0,160));
    JSON.parse(text);fs.writeFileSync(file,text,'utf8');
  }
  return {payload:JSON.parse(text),sha256:sha256(text),bytes:Buffer.byteLength(text)};
}

export async function main(){
  const key=process.env.EODHD_API_KEY?.trim();
  if(!key)throw new Error('PEAD_SOURCE_EODHD_API_KEY_NOT_CONFIGURED');
  const p=PEAD_SOURCE_AUDIT_V1;
  const compUrl='https://eodhd.com/api/fundamentals/'+encodeURIComponent(p.indexSymbol)+'?api_token='+encodeURIComponent(key)+'&fmt=json&filter=HistoricalTickerComponents';
  const earnUrl='https://eodhd.com/api/calendar/earnings?from='+p.window.from+'&to='+p.window.to+'&api_token='+encodeURIComponent(key)+'&fmt=json';
  const components=await fetchJsonCached('sp500-historical-components-fundamentals-v1',compUrl);
  const earnings=await fetchJsonCached('earnings-window',earnUrl);
  const audit=auditPayloads(components.payload,earnings.payload);
  const result={
    schemaVersion:1,
    study:p.study,
    status:audit.passed?'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION':'INCONCLUSIVE_SOURCE_CAUSALITY',
    window:p.window,
    provider:'EODHD',
    provenance:'REAL',
    sourceHashes:{historicalComponents:components.sha256,earningsCalendar:earnings.sha256},
    audit,
    providerContract:{
      historicalMembership:'EODHD Fundamentals HistoricalTickerComponents for GSPC.INDX; filtered section or wrapped response accepted',
      reportDate:'announcement date',
      timing:'BeforeMarket/AfterMarket when available',
      estimate:'consensus EPS; provider documentation/glossary describes estimate as prior to earnings release',
      vintageArchiveGuaranteed:false,
      interpretation:'historical diagnostic source only; not sufficient alone for production promotion'
    },
    economicOutcomesOpened:false,
    priceOutcomesFetched:false,
    productionDefault:'LEGACY',
    productionAuthority:false,
    promotionAllowed:false
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(MARKER,JSON.stringify(result));
  if(!audit.passed)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error(MARKER,JSON.stringify({status:'BLOCKED',reason:error?.message??String(error),economicOutcomesOpened:false,productionDefault:'LEGACY'}));process.exitCode=1;});
}
