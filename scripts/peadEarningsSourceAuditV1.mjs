import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PEAD_SOURCE_AUDIT_V1=Object.freeze({
  study:'PEAD_EARNINGS_SOURCE_AUDIT_V1',
  sourceRevision:'YAHOO_STATIC_DUAL_PIT_R1',
  window:{from:'2024-01-15',to:'2024-03-15'},
  gates:{minimumPitEvents:200,minimumKnownTimingPct:70,minimumActualEstimatePct:70,minimumCausalEligible:150},
  productionDefault:'LEGACY',
  productionAuthority:false
});

export const SOURCE_PINS=Object.freeze({
  earnings:{
    repository:'vivek-v-rao/Earnings-Dates',
    commit:'7ed98a0e2497b0a83bcbc290db41705089768c16',
    path:'earnings_dates_all.csv',
    blobSha:'abde11f719e93dc427a1040ffed3f0b8590b8508'
  },
  pitFja:{
    repository:'fja05680/sp500',
    commit:'a2430f2af0c79ddf0748e91de11bdeb1616ab5a7',
    path:'sp500_ticker_start_end.csv',
    blobSha:'3ed3b0e8d9e6e63730c153ee1f13ddaf6ed281bb'
  },
  pitLawcal:{
    repository:'lawcal/sp500-components-history',
    commit:'2e59b86998a119d68e377f9f98aa7a816cfc7d5b',
    path:'data/components_history.csv',
    blobSha:'6a865618173f322ecda9a569bc6bd48edcfaf996'
  }
});

const OUT='validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json';
const CACHE='.runtime/pead-earnings-source-audit-v1-static';
const MARKER='PEAD_EARNINGS_SOURCE_AUDIT_V1_RESULT';

function rawUrl(source){
  return 'https://raw.githubusercontent.com/'+source.repository+'/'+source.commit+'/'+source.path;
}
function gitBlobSha(text){
  const bytes=Buffer.from(text,'utf8');
  return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function cleanDate(v){
  const s=String(v??'').replace(/\*/g,'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))?s:null;
}
export function tickerKey(v){
  return String(v??'').trim().toUpperCase().replace(/\.US$/,'').replace(/[./]/g,'-');
}

export function parseCsvLine(line){
  const out=[];let current='';let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){current+='"';i++;} else quoted=!quoted;
    }else if(ch===','&&!quoted){out.push(current);current='';}
    else current+=ch;
  }
  out.push(current);
  return out;
}

export function parseCsv(text){
  const lines=String(text??'').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.length<2)throw new Error('PEAD_SOURCE_CSV_EMPTY');
  const header=parseCsvLine(lines[0]);
  const index=Object.fromEntries(header.map((name,i)=>[name,i]));
  return {header,index,rows:lines.slice(1).filter(Boolean).map(parseCsvLine)};
}

export function normalizeFjaPit(text){
  const table=parseCsv(text),i=table.index;
  for(const required of ['ticker','start_date','end_date'])if(i[required]==null)throw new Error('PEAD_FJA_SCHEMA:'+required);
  return table.rows.map(row=>({
    ticker:tickerKey(row[i.ticker]),
    start:cleanDate(row[i.start_date]),
    end:cleanDate(row[i.end_date])
  })).filter(row=>row.ticker&&row.start);
}

export function normalizeLawcalPit(text){
  const table=parseCsv(text),i=table.index;
  for(const required of ['symbol','date_added','date_removed','created_at'])if(i[required]==null)throw new Error('PEAD_LAWCAL_SCHEMA:'+required);
  return table.rows.map(row=>({
    ticker:tickerKey(row[i.symbol]),
    start:cleanDate(row[i.date_added]),
    end:cleanDate(row[i.date_removed]),
    createdAt:cleanDate(row[i.created_at])
  })).filter(row=>row.ticker);
}

export function normalizeYahooEarnings(text){
  const table=parseCsv(text),i=table.index;
  for(const required of ['Earnings Date','earnings_datetime_utc','earnings_date','ticker','EPS Estimate','Reported EPS','Surprise(%)']){
    if(i[required]==null)throw new Error('PEAD_YAHOO_SCHEMA:'+required);
  }
  return table.rows.map(row=>({
    rawDate:String(row[i['Earnings Date']]??'').trim(),
    utcDateTime:String(row[i.earnings_datetime_utc]??'').trim(),
    reportDate:cleanDate(row[i.earnings_date]),
    ticker:tickerKey(row[i.ticker]),
    estimate:finite(row[i['EPS Estimate']])?Number(row[i['EPS Estimate']]):null,
    actual:finite(row[i['Reported EPS']])?Number(row[i['Reported EPS']]):null,
    surprisePct:finite(row[i['Surprise(%)']])?Number(row[i['Surprise(%)']]):null
  })).filter(row=>row.ticker&&row.reportDate);
}

export function activeFja(intervals,ticker,date){
  const key=tickerKey(ticker);
  return intervals.some(row=>row.ticker===key&&row.start<=date&&(!row.end||date<row.end));
}

export function activeLawcal(intervals,ticker,date){
  const key=tickerKey(ticker);
  return intervals.some(row=>row.ticker===key
    &&(!row.start||row.start<=date)
    &&(!row.end||date<row.end)
    &&(!row.createdAt||row.createdAt<=date));
}

export function classifyYahooTiming(rawDate){
  const match=String(rawDate??'').match(/^\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):/);
  if(!match)return 'UNKNOWN';
  const minute=Number(match[1])*60+Number(match[2]);
  if(minute<9*60+30)return 'BeforeMarket';
  if(minute>=16*60)return 'AfterMarket';
  return 'DuringMarket';
}

export function auditStaticSources(fjaText,lawcalText,earningsText){
  const fja=normalizeFjaPit(fjaText);
  const lawcal=normalizeLawcalPit(lawcalText);
  const allEarnings=normalizeYahooEarnings(earningsText);
  const p=PEAD_SOURCE_AUDIT_V1;
  const windowEvents=allEarnings.filter(e=>e.reportDate>=p.window.from&&e.reportDate<=p.window.to);
  const fjaPit=windowEvents.filter(e=>activeFja(fja,e.ticker,e.reportDate));
  const lawcalPit=windowEvents.filter(e=>activeLawcal(lawcal,e.ticker,e.reportDate));
  const pit=windowEvents
    .filter(e=>activeFja(fja,e.ticker,e.reportDate)&&activeLawcal(lawcal,e.ticker,e.reportDate))
    .map(e=>({...e,timing:classifyYahooTiming(e.rawDate)}));

  const fjaKeys=new Set(fjaPit.map(e=>e.ticker+'|'+e.reportDate));
  const lawcalKeys=new Set(lawcalPit.map(e=>e.ticker+'|'+e.reportDate));
  const pitDisagreements={
    fjaOnly:fjaPit.filter(e=>!lawcalKeys.has(e.ticker+'|'+e.reportDate)).map(e=>({ticker:e.ticker,reportDate:e.reportDate})),
    lawcalOnly:lawcalPit.filter(e=>!fjaKeys.has(e.ticker+'|'+e.reportDate)).map(e=>({ticker:e.ticker,reportDate:e.reportDate}))
  };

  const knownTiming=pit.filter(e=>e.timing==='BeforeMarket'||e.timing==='AfterMarket');
  const actualEstimate=pit.filter(e=>e.actual!=null&&e.estimate!=null);
  const causal=pit.filter(e=>(e.timing==='BeforeMarket'||e.timing==='AfterMarket')
    &&e.actual!=null&&e.estimate!=null&&e.surprisePct!=null);

  const seen=new Set(),duplicates=[];
  for(const e of pit){
    const k=e.ticker+'|'+(e.utcDateTime||e.rawDate||e.reportDate);
    if(seen.has(k))duplicates.push(k); else seen.add(k);
  }

  const directionalContradictions=pit.filter(e=>{
    if(e.actual==null||e.estimate==null||e.surprisePct==null)return false;
    const diff=e.actual-e.estimate;
    if(diff===0||e.surprisePct===0)return false;
    return Math.sign(diff)!==Math.sign(e.surprisePct);
  });
  const roundedEqualButProviderSurprise=pit.filter(e=>
    e.actual!=null&&e.estimate!=null&&e.surprisePct!=null
    &&e.actual===e.estimate&&e.surprisePct!==0);

  const timingPct=pit.length?100*knownTiming.length/pit.length:0;
  const actualEstimatePct=pit.length?100*actualEstimate.length/pit.length:0;
  const g=p.gates;
  const gates={
    pitEvents:pit.length>=g.minimumPitEvents,
    timingCoverage:timingPct>=g.minimumKnownTimingPct,
    actualEstimateCoverage:actualEstimatePct>=g.minimumActualEstimatePct,
    causalEligible:causal.length>=g.minimumCausalEligible,
    noDuplicates:duplicates.length===0,
    noDirectionalContradictions:directionalContradictions.length===0,
    dualPitAgreementForIncludedEvents:true,
    noSynthetic:true
  };

  return {
    counts:{
      fjaIntervals:fja.length,
      lawcalIntervals:lawcal.length,
      rawEarningsEvents:allEarnings.length,
      earningsWindow:windowEvents.length,
      fjaPitWindow:fjaPit.length,
      lawcalPitWindow:lawcalPit.length,
      pitEvents:pit.length,
      knownTiming:knownTiming.length,
      actualEstimate:actualEstimate.length,
      causalEligible:causal.length
    },
    coverage:{knownTimingPct:timingPct,actualEstimatePct},
    quality:{
      duplicateCount:duplicates.length,
      directionalContradictionCount:directionalContradictions.length,
      roundedEqualButProviderSurpriseCount:roundedEqualButProviderSurprise.length,
      pitSourceDisagreements
    },
    timingBreakdown:{
      beforeMarket:pit.filter(e=>e.timing==='BeforeMarket').length,
      afterMarket:pit.filter(e=>e.timing==='AfterMarket').length,
      duringMarket:pit.filter(e=>e.timing==='DuringMarket').length,
      unknown:pit.filter(e=>e.timing==='UNKNOWN').length
    },
    exclusions:{
      missingActual:pit.filter(e=>e.actual==null).map(e=>({ticker:e.ticker,reportDate:e.reportDate,rawDate:e.rawDate})),
      duringMarket:pit.filter(e=>e.timing==='DuringMarket').map(e=>({ticker:e.ticker,reportDate:e.reportDate,rawDate:e.rawDate}))
    },
    gates,
    passed:Object.values(gates).every(Boolean)
  };
}

async function fetchPinnedText(name,source){
  fs.mkdirSync(CACHE,{recursive:true});
  const file=path.join(CACHE,name+'.csv');
  let text;
  if(fs.existsSync(file))text=fs.readFileSync(file,'utf8');
  else{
    const response=await fetch(rawUrl(source),{
      headers:{Accept:'text/plain','User-Agent':'Custodia/1.0 PEADSourceAudit'},
      signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||60000)
    });
    text=await response.text();
    if(!response.ok)throw new Error('PEAD_STATIC_SOURCE_HTTP_'+response.status+':'+name+':'+text.slice(0,160));
    fs.writeFileSync(file,text,'utf8');
  }
  const actualBlob=gitBlobSha(text);
  if(actualBlob!==source.blobSha)throw new Error('PEAD_STATIC_SOURCE_BLOB_MISMATCH:'+name+':'+actualBlob+':'+source.blobSha);
  return {text,blobSha:actualBlob,bytes:Buffer.byteLength(text)};
}

export async function main(){
  const [earnings,fja,lawcal]=await Promise.all([
    fetchPinnedText('yahoo-earnings-pinned',SOURCE_PINS.earnings),
    fetchPinnedText('sp500-pit-fja-pinned',SOURCE_PINS.pitFja),
    fetchPinnedText('sp500-pit-lawcal-pinned',SOURCE_PINS.pitLawcal)
  ]);
  const audit=auditStaticSources(fja.text,lawcal.text,earnings.text);
  const p=PEAD_SOURCE_AUDIT_V1;
  const result={
    schemaVersion:1,
    study:p.study,
    sourceRevision:p.sourceRevision,
    status:audit.passed?'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION':'INCONCLUSIVE_SOURCE_CAUSALITY',
    window:p.window,
    provider:'YAHOO_FINANCE_VIA_PINNED_STATIC_REFERENCE',
    provenance:'STATIC_REFERENCE',
    sourcePins:SOURCE_PINS,
    sourceFingerprints:{
      earnings:{blobSha:earnings.blobSha,bytes:earnings.bytes},
      pitFja:{blobSha:fja.blobSha,bytes:fja.bytes},
      pitLawcal:{blobSha:lawcal.blobSha,bytes:lawcal.bytes}
    },
    audit,
    providerContract:{
      earningsOrigin:'Yahoo Finance historical earnings calendar captured by pinned MIT-licensed repository snapshot',
      announcementTime:'Yahoo Earnings Date local timestamp; <09:30 ET BeforeMarket, >=16:00 ET AfterMarket, regular-session timestamps excluded',
      estimate:'Yahoo EPS Estimate; historical consensus snapshot semantics are accepted for diagnostic research but no independent vintage archive is guaranteed',
      pitMembership:'intersection of two independently reconstructed, commit-pinned S&P 500 PIT histories; an event is included only when both agree on the historical ticker',
      tickerAliasPolicy:'exact historical ticker agreement; future/current aliases do not expand membership',
      surpriseIntegrity:'direction of provider Surprise(%) must not contradict Reported EPS - EPS Estimate when rounded EPS values differ',
      vintageArchiveGuaranteed:false,
      interpretation:'diagnostic source audit only; STATIC_REFERENCE cannot authorize production promotion'
    },
    economicOutcomesOpened:false,
    priceOutcomesFetched:false,
    productionDefault:'LEGACY',
    productionAuthority:false,
    promotionAllowed:false
  };
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(MARKER,JSON.stringify(result));
  if(!audit.passed)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{
    console.error(MARKER,JSON.stringify({
      status:'BLOCKED',
      reason:error?.message??String(error),
      economicOutcomesOpened:false,
      priceOutcomesFetched:false,
      productionDefault:'LEGACY'
    }));
    process.exitCode=1;
  });
}
