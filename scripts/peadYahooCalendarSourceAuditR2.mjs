import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  SOURCE_PINS,
  normalizeFjaPit,
  normalizeLawcalPit,
  normalizeYahooEarnings,
  activeFja,
  activeLawcal,
  classifyYahooTiming,
  tickerKey
} from './peadEarningsSourceAuditV1.mjs';

export const PEAD_SOURCE_AUDIT_R2=Object.freeze({
  study:'PEAD_EARNINGS_SOURCE_AUDIT_R2',
  sourceRevision:'YAHOO_CALENDAR_RANGE_DUAL_PIT_R2',
  window:{from:'2024-01-15',to:'2024-03-15'},
  gates:{
    minimumPitEvents:450,
    minimumKnownTimingPct:95,
    minimumActualEstimatePct:95,
    minimumCausalEligible:440,
    minimumR1OverlapPct:95
  },
  pageSize:100,
  maxPages:100,
  productionDefault:'LEGACY',
  productionAuthority:false
});

const OUT='validation-runs/diagnostics/pead-yahoo-calendar-source-audit-r2-result.json';
const CACHE='.runtime/pead-yahoo-calendar-source-audit-r2';
const MARKER='PEAD_EARNINGS_SOURCE_AUDIT_R2_RESULT';

function gitBlobSha(text){
  const bytes=Buffer.from(text,'utf8');
  return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function rawUrl(source){return 'https://raw.githubusercontent.com/'+source.repository+'/'+source.commit+'/'+source.path;}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function isoDate(value){
  const s=String(value??'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))?s:null;
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export function cookiesFromResponse(response){
  const raw=typeof response?.headers?.getSetCookie==='function'
    ? response.headers.getSetCookie()
    : [response?.headers?.get?.('set-cookie')].filter(Boolean);
  return raw.map(value=>String(value).split(';',1)[0].trim()).filter(Boolean);
}

function mergeCookieStrings(...groups){
  const map=new Map();
  for(const group of groups.flat()){
    for(const pair of String(group??'').split(';')){
      const clean=pair.trim();
      const eq=clean.indexOf('=');
      if(eq>0)map.set(clean.slice(0,eq),clean);
    }
  }
  return [...map.values()].join('; ');
}

export async function createYahooSession(fetchImpl=fetch){
  const headers={
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    Accept:'*/*'
  };
  let cookies=[];
  for(const bootstrapUrl of ['https://fc.yahoo.com','https://finance.yahoo.com/']){
    try{
      const response=await fetchImpl(bootstrapUrl,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
      cookies.push(...cookiesFromResponse(response));
      if(cookies.length)break;
    }catch{}
  }
  const cookie=mergeCookieStrings(cookies);
  const crumbResponse=await fetchImpl('https://query1.finance.yahoo.com/v1/test/getcrumb',{
    headers:{...headers,...(cookie?{Cookie:cookie}:{})},
    signal:AbortSignal.timeout(15000)
  });
  const moreCookies=cookiesFromResponse(crumbResponse);
  const mergedCookie=mergeCookieStrings(cookie,moreCookies);
  const crumb=(await crumbResponse.text()).trim();
  if(!crumbResponse.ok||!crumb||/unauthorized|error/i.test(crumb)){
    throw new Error('PEAD_R2_YAHOO_CRUMB_UNAVAILABLE:'+crumbResponse.status+':'+crumb.slice(0,120));
  }
  return {cookie:mergedCookie,crumb,userAgent:headers['User-Agent']};
}

export function yahooCalendarQueryBody(offset=0){
  const p=PEAD_SOURCE_AUDIT_R2;
  return {
    sortType:'ASC',
    entityIdType:'sp_earnings',
    sortField:'startdatetime',
    includeFields:[
      'ticker','companyshortname','intradaymarketcap','eventname',
      'startdatetime','startdatetimetype','epsestimate','epsactual','epssurprisepct'
    ],
    size:p.pageSize,
    offset,
    query:{
      operator:'AND',
      operands:[
        {operator:'EQ',operands:['region','us']},
        {operator:'OR',operands:[
          {operator:'EQ',operands:['eventtype','EAD']},
          {operator:'EQ',operands:['eventtype','ERA']}
        ]},
        {operator:'GTE',operands:['startdatetime',p.window.from]},
        {operator:'LTE',operands:['startdatetime',p.window.to]}
      ]
    }
  };
}

function documentFromPayload(payload){
  const financeError=payload?.finance?.error;
  if(financeError)throw new Error('PEAD_R2_YAHOO_FINANCE_ERROR:'+JSON.stringify(financeError).slice(0,300));
  const doc=payload?.finance?.result?.[0]?.documents?.[0];
  if(!doc||!Array.isArray(doc.columns)||!Array.isArray(doc.rows)){
    throw new Error('PEAD_R2_YAHOO_SCHEMA_MISSING_DOCUMENT');
  }
  return doc;
}

function columnIndexes(columns){
  const result={};
  for(let i=0;i<columns.length;i++){
    const label=String(columns[i]?.label??'');
    const type=String(columns[i]?.type??'').toUpperCase();
    if(label==='Symbol')result.symbol=i;
    else if(label==='EPS Estimate')result.estimate=i;
    else if(label==='Reported EPS')result.actual=i;
    else if(label==='Surprise (%)')result.surprise=i;
    else if(label==='Event Start Date'&&type==='STRING')result.timing=i;
    else if(label==='Event Start Date'&&result.dateTime==null)result.dateTime=i;
  }
  for(const key of ['symbol','estimate','actual','surprise','dateTime']){
    if(result[key]==null)throw new Error('PEAD_R2_YAHOO_SCHEMA_COLUMN:'+key);
  }
  return result;
}

function etParts(value){
  const ms=Date.parse(String(value??''));
  if(!Number.isFinite(ms))return null;
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ms));
  const get=type=>parts.find(part=>part.type===type)?.value;
  const year=get('year'),month=get('month'),day=get('day'),hour=get('hour'),minute=get('minute');
  if(!year||!month||!day||hour==null||minute==null)return null;
  return {date:year+'-'+month+'-'+day,hour:Number(hour),minute:Number(minute)};
}

export function classifyCalendarTiming(rawTiming,startDateTime){
  const timing=String(rawTiming??'').trim().toUpperCase().replace(/[^A-Z]/g,'');
  if(['BMO','BEFOREMARKETOPEN','BEFOREMARKET'].includes(timing))return 'BeforeMarket';
  if(['AMC','AFTERMARKETCLOSE','AFTERMARKET'].includes(timing))return 'AfterMarket';
  if(['DMH','DURINGMARKETHOURS','DURINGMARKET'].includes(timing))return 'DuringMarket';
  if(['TAS','TIMENOTSUPPLIED','TIMENOTANNOUNCED','UNKNOWN'].includes(timing))return 'UNKNOWN';
  const parts=etParts(startDateTime);
  if(!parts)return 'UNKNOWN';
  const minute=parts.hour*60+parts.minute;
  if(minute<9*60+30)return 'BeforeMarket';
  if(minute>=16*60)return 'AfterMarket';
  return 'DuringMarket';
}

export function normalizeYahooCalendarPayload(payload){
  const doc=documentFromPayload(payload);
  const i=columnIndexes(doc.columns);
  return doc.rows.map(row=>{
    const startDateTime=String(row[i.dateTime]??'').trim();
    const parts=etParts(startDateTime);
    return {
      ticker:tickerKey(row[i.symbol]),
      startDateTime,
      reportDate:parts?.date??isoDate(startDateTime),
      timing:classifyCalendarTiming(i.timing==null?null:row[i.timing],startDateTime),
      rawTiming:i.timing==null?null:String(row[i.timing]??''),
      estimate:finite(row[i.estimate])?Number(row[i.estimate]):null,
      actual:finite(row[i.actual])?Number(row[i.actual]):null,
      surprisePct:finite(row[i.surprise])?Number(row[i.surprise]):null
    };
  }).filter(row=>row.ticker&&row.reportDate);
}

export async function fetchYahooCalendarRange(fetchImpl=fetch,session=null){
  const auth=session??await createYahooSession(fetchImpl);
  const pages=[];
  const all=[];
  let terminalPageSeen=false;
  for(let page=0;page<PEAD_SOURCE_AUDIT_R2.maxPages;page++){
    const offset=page*PEAD_SOURCE_AUDIT_R2.pageSize;
    const url='https://query1.finance.yahoo.com/v1/finance/visualization?lang=en-US&region=US&crumb='+encodeURIComponent(auth.crumb);
    const response=await fetchImpl(url,{
      method:'POST',
      headers:{
        'User-Agent':auth.userAgent,
        Accept:'application/json',
        'Content-Type':'application/json',
        ...(auth.cookie?{Cookie:auth.cookie}:{})
      },
      body:JSON.stringify(yahooCalendarQueryBody(offset)),
      signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)
    });
    const text=await response.text();
    if(!response.ok)throw new Error('PEAD_R2_YAHOO_HTTP_'+response.status+':offset='+offset+':'+text.slice(0,180));
    const payload=JSON.parse(text);
    const rows=normalizeYahooCalendarPayload(payload);
    pages.push({offset,rowCount:rows.length,sha256:crypto.createHash('sha256').update(text).digest('hex')});
    all.push(...rows);
    if(rows.length<PEAD_SOURCE_AUDIT_R2.pageSize){terminalPageSeen=true;break;}
    await sleep(150);
  }
  if(!terminalPageSeen)throw new Error('PEAD_R2_YAHOO_PAGINATION_NO_TERMINAL_PAGE');
  return {rows:all,pages,terminalPageSeen};
}

async function fetchPinnedText(name,source,fetchImpl=fetch){
  const dir=path.join(CACHE,'static');
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,name+'.csv');
  let text;
  if(fs.existsSync(file))text=fs.readFileSync(file,'utf8');
  else{
    const response=await fetchImpl(rawUrl(source),{
      headers:{Accept:'text/plain','User-Agent':'Mozilla/5.0 Custodia/1.0'},
      signal:AbortSignal.timeout(60000)
    });
    text=await response.text();
    if(!response.ok)throw new Error('PEAD_R2_STATIC_HTTP_'+response.status+':'+name+':'+text.slice(0,160));
    fs.writeFileSync(file,text,'utf8');
  }
  const blob=gitBlobSha(text);
  if(blob!==source.blobSha)throw new Error('PEAD_R2_STATIC_BLOB_MISMATCH:'+name+':'+blob+':'+source.blobSha);
  return text;
}

export function buildR1CausalKeys(fjaText,lawcalText,earningsText){
  const fja=normalizeFjaPit(fjaText),lawcal=normalizeLawcalPit(lawcalText);
  return new Set(normalizeYahooEarnings(earningsText)
    .filter(e=>e.reportDate>=PEAD_SOURCE_AUDIT_R2.window.from&&e.reportDate<=PEAD_SOURCE_AUDIT_R2.window.to)
    .filter(e=>activeFja(fja,e.ticker,e.reportDate)&&activeLawcal(lawcal,e.ticker,e.reportDate))
    .map(e=>({...e,timing:classifyYahooTiming(e.rawDate)}))
    .filter(e=>(e.timing==='BeforeMarket'||e.timing==='AfterMarket')
      &&e.actual!=null&&e.estimate!=null&&e.surprisePct!=null)
    .map(e=>e.ticker+'|'+e.reportDate));
}

export function auditR2(calendarRows,fjaText,lawcalText,r1CausalKeys,pages=[]){
  const fja=normalizeFjaPit(fjaText),lawcal=normalizeLawcalPit(lawcalText);
  const windowRows=calendarRows.filter(e=>e.reportDate>=PEAD_SOURCE_AUDIT_R2.window.from&&e.reportDate<=PEAD_SOURCE_AUDIT_R2.window.to);
  const pit=windowRows.filter(e=>activeFja(fja,e.ticker,e.reportDate)&&activeLawcal(lawcal,e.ticker,e.reportDate));
  const knownTiming=pit.filter(e=>e.timing==='BeforeMarket'||e.timing==='AfterMarket');
  const actualEstimate=pit.filter(e=>e.actual!=null&&e.estimate!=null);
  const directionalContradictions=pit.filter(e=>{
    if(e.actual==null||e.estimate==null||e.surprisePct==null)return false;
    const diff=e.actual-e.estimate;
    if(diff===0||e.surprisePct===0)return false;
    return Math.sign(diff)!==Math.sign(e.surprisePct);
  });
  const seen=new Set(),duplicates=[];
  for(const e of pit){
    const key=e.ticker+'|'+e.startDateTime;
    if(seen.has(key))duplicates.push(key); else seen.add(key);
  }
  const causal=pit.filter(e=>(e.timing==='BeforeMarket'||e.timing==='AfterMarket')
    &&e.actual!=null&&e.estimate!=null&&e.surprisePct!=null
    &&!directionalContradictions.includes(e));
  const causalKeys=new Set(causal.map(e=>e.ticker+'|'+e.reportDate));
  let overlap=0;
  for(const key of r1CausalKeys)if(causalKeys.has(key))overlap++;
  const overlapPct=r1CausalKeys.size?100*overlap/r1CausalKeys.size:0;
  const timingPct=pit.length?100*knownTiming.length/pit.length:0;
  const actualEstimatePct=pit.length?100*actualEstimate.length/pit.length:0;
  const g=PEAD_SOURCE_AUDIT_R2.gates;
  const terminalPageSeen=pages.length>0&&pages[pages.length-1].rowCount<PEAD_SOURCE_AUDIT_R2.pageSize;
  const gates={
    pitEvents:pit.length>=g.minimumPitEvents,
    timingCoverage:timingPct>=g.minimumKnownTimingPct,
    actualEstimateCoverage:actualEstimatePct>=g.minimumActualEstimatePct,
    causalEligible:causal.length>=g.minimumCausalEligible,
    noDuplicates:duplicates.length===0,
    noDirectionalContradictions:directionalContradictions.length===0,
    paginationComplete:terminalPageSeen,
    r1Overlap:overlapPct>=g.minimumR1OverlapPct,
    noCurrentTickerSeed:true,
    noSynthetic:true
  };
  return {
    counts:{
      rawCalendarRows:calendarRows.length,
      windowRows:windowRows.length,
      pitEvents:pit.length,
      knownTiming:knownTiming.length,
      actualEstimate:actualEstimate.length,
      causalEligible:causal.length,
      r1CausalEvents:r1CausalKeys.size,
      r1Overlap:overlap,
      newVsR1:[...causalKeys].filter(key=>!r1CausalKeys.has(key)).length
    },
    coverage:{knownTimingPct:timingPct,actualEstimatePct,r1OverlapPct:overlapPct},
    quality:{
      duplicateCount:duplicates.length,
      directionalContradictionCount:directionalContradictions.length,
      terminalPageSeen
    },
    timingBreakdown:{
      beforeMarket:pit.filter(e=>e.timing==='BeforeMarket').length,
      afterMarket:pit.filter(e=>e.timing==='AfterMarket').length,
      duringMarket:pit.filter(e=>e.timing==='DuringMarket').length,
      unknown:pit.filter(e=>e.timing==='UNKNOWN').length
    },
    gates,
    passed:Object.values(gates).every(Boolean)
  };
}

export async function main(){
  const [fjaText,lawcalText,r1EarningsText]=await Promise.all([
    fetchPinnedText('pit-fja',SOURCE_PINS.pitFja),
    fetchPinnedText('pit-lawcal',SOURCE_PINS.pitLawcal),
    fetchPinnedText('r1-earnings',SOURCE_PINS.earnings)
  ]);
  const r1Keys=buildR1CausalKeys(fjaText,lawcalText,r1EarningsText);
  if(r1Keys.size!==461)throw new Error('PEAD_R2_R1_BASELINE_COUNT:'+r1Keys.size+':461');
  const live=await fetchYahooCalendarRange();
  const audit=auditR2(live.rows,fjaText,lawcalText,r1Keys,live.pages);
  const result={
    schemaVersion:1,
    study:PEAD_SOURCE_AUDIT_R2.study,
    sourceRevision:PEAD_SOURCE_AUDIT_R2.sourceRevision,
    status:audit.passed?'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R2':'INCONCLUSIVE_SOURCE_CAUSALITY_R2',
    window:PEAD_SOURCE_AUDIT_R2.window,
    provider:'YAHOO_FINANCE_CALENDAR_RANGE',
    provenance:'REAL',
    universeProvenance:'STATIC_REFERENCE',
    sourcePins:{pitFja:SOURCE_PINS.pitFja,pitLawcal:SOURCE_PINS.pitLawcal,r1BaselineEarnings:SOURCE_PINS.earnings},
    yahooContract:{
      endpoint:'/v1/finance/visualization',
      region:'us',
      eventTypes:['EAD','ERA'],
      filterMostActive:false,
      currentTickerSeed:false,
      pagination:{size:PEAD_SOURCE_AUDIT_R2.pageSize,pages:live.pages}
    },
    audit,
    providerContract:{
      earnings:'Yahoo Finance calendar queried by historical date range, not by a current ticker universe',
      pitMembership:'exact-ticker intersection of two commit-pinned S&P 500 historical reconstructions',
      estimate:'historical Yahoo EPS Estimate; no independent consensus-vintage archive guarantee',
      interpretation:'diagnostic source only; cannot authorize production promotion by itself'
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
