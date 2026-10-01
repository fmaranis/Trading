import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  SOURCE_PINS,
  normalizeFjaPit,
  normalizeLawcalPit,
  activeFja,
  activeLawcal
} from './peadEarningsSourceAuditV1.mjs';
import {
  fetchYahooCalendarRange,
  buildR1CausalKeys
} from './peadYahooCalendarSourceAuditR2.mjs';

export const PEAD_SOURCE_AUDIT_R3=Object.freeze({
  study:'PEAD_EARNINGS_SOURCE_AUDIT_R3',
  sourceRevision:'YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION',
  window:{from:'2024-01-15',to:'2024-03-15'},
  gates:{
    minimumPitEvents:450,
    minimumActualEstimatePct:95,
    minimumSurprisePct:95,
    minimumCausalEligible:440,
    minimumR1OverlapPct:95
  },
  pageSize:100,
  productionDefault:'LEGACY',
  productionAuthority:false
});

const OUT='validation-runs/diagnostics/pead-yahoo-calendar-source-audit-r3-result.json';
const CACHE='.runtime/pead-yahoo-calendar-source-audit-r3';
const MARKER='PEAD_EARNINGS_SOURCE_AUDIT_R3_RESULT';

function gitBlobSha(text){
  const bytes=Buffer.from(text,'utf8');
  return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function rawUrl(source){return 'https://raw.githubusercontent.com/'+source.repository+'/'+source.commit+'/'+source.path;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

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
    if(!response.ok)throw new Error('PEAD_R3_STATIC_HTTP_'+response.status+':'+name+':'+text.slice(0,160));
    fs.writeFileSync(file,text,'utf8');
  }
  const blob=gitBlobSha(text);
  if(blob!==source.blobSha)throw new Error('PEAD_R3_STATIC_BLOB_MISMATCH:'+name+':'+blob+':'+source.blobSha);
  return text;
}

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}

export function auditR3(calendarRows,fjaText,lawcalText,r1CausalKeys,pages=[]){
  const fja=normalizeFjaPit(fjaText),lawcal=normalizeLawcalPit(lawcalText);
  const p=PEAD_SOURCE_AUDIT_R3;
  const windowRows=calendarRows.filter(e=>e.reportDate>=p.window.from&&e.reportDate<=p.window.to);
  const pit=windowRows.filter(e=>activeFja(fja,e.ticker,e.reportDate)&&activeLawcal(lawcal,e.ticker,e.reportDate));

  const actualEstimate=pit.filter(e=>finite(e.actual)&&finite(e.estimate));
  const surpriseFinite=pit.filter(e=>finite(e.surprisePct));

  const directionalContradictions=pit.filter(e=>{
    if(!finite(e.actual)||!finite(e.estimate)||!finite(e.surprisePct))return false;
    const diff=Number(e.actual)-Number(e.estimate);
    const surprise=Number(e.surprisePct);
    if(diff===0||surprise===0)return false;
    return Math.sign(diff)!==Math.sign(surprise);
  });

  const seen=new Set(),duplicates=[];
  for(const e of pit){
    const key=e.ticker+'|'+e.reportDate;
    if(seen.has(key))duplicates.push(key); else seen.add(key);
  }

  const contradictoryKeys=new Set(directionalContradictions.map(e=>e.ticker+'|'+e.reportDate));
  const duplicateKeys=new Set(duplicates);
  const causal=pit.filter(e=>{
    const key=e.ticker+'|'+e.reportDate;
    return finite(e.actual)&&finite(e.estimate)&&finite(e.surprisePct)
      &&!contradictoryKeys.has(key)
      &&!duplicateKeys.has(key);
  });

  const causalKeys=new Set(causal.map(e=>e.ticker+'|'+e.reportDate));
  let overlap=0;
  for(const key of r1CausalKeys)if(causalKeys.has(key))overlap++;

  const actualEstimatePct=pit.length?100*actualEstimate.length/pit.length:0;
  const surprisePct=pit.length?100*surpriseFinite.length/pit.length:0;
  const overlapPct=r1CausalKeys.size?100*overlap/r1CausalKeys.size:0;
  const terminalPageSeen=pages.length>0&&pages[pages.length-1].rowCount<PEAD_SOURCE_AUDIT_R3.pageSize;
  const unparseableCalendarRows=pages.reduce((sum,page)=>sum+Number(page.unparseableRowCount??0),0);

  const g=p.gates;
  const gates={
    pitEvents:pit.length>=g.minimumPitEvents,
    actualEstimateCoverage:actualEstimatePct>=g.minimumActualEstimatePct,
    surpriseCoverage:surprisePct>=g.minimumSurprisePct,
    causalEligible:causal.length>=g.minimumCausalEligible,
    noDuplicates:duplicates.length===0,
    noDirectionalContradictions:directionalContradictions.length===0,
    paginationComplete:terminalPageSeen,
    noUnparseableCalendarRows:unparseableCalendarRows===0,
    r1Overlap:overlapPct>=g.minimumR1OverlapPct,
    nextSessionExecutionFrozen:true,
    noCurrentTickerSeed:true,
    noSynthetic:true
  };

  const causalEvents=[...causal]
    .sort((a,b)=>a.reportDate.localeCompare(b.reportDate)||a.ticker.localeCompare(b.ticker))
    .map(e=>({
      ticker:e.ticker,
      reportDate:e.reportDate,
      startDateTime:e.startDateTime,
      timingDiagnostic:e.timing,
      rawTiming:e.rawTiming,
      estimate:Number(e.estimate),
      actual:Number(e.actual),
      surprisePct:Number(e.surprisePct)
    }));

  return {
    causalEvents,
    counts:{
      rawCalendarRows:calendarRows.length,
      windowRows:windowRows.length,
      pitEvents:pit.length,
      actualEstimate:actualEstimate.length,
      surpriseFinite:surpriseFinite.length,
      causalEligible:causal.length,
      r1CausalEvents:r1CausalKeys.size,
      r1Overlap:overlap,
      newVsR1:[...causalKeys].filter(key=>!r1CausalKeys.has(key)).length
    },
    coverage:{actualEstimatePct,surprisePct,r1OverlapPct:overlapPct},
    quality:{
      duplicateCount:duplicates.length,
      directionalContradictionCount:directionalContradictions.length,
      terminalPageSeen,
      unparseableCalendarRows
    },
    timingDiagnostic:{
      beforeMarket:pit.filter(e=>e.timing==='BeforeMarket').length,
      afterMarket:pit.filter(e=>e.timing==='AfterMarket').length,
      duringMarket:pit.filter(e=>e.timing==='DuringMarket').length,
      unknown:pit.filter(e=>e.timing==='UNKNOWN').length,
      authority:'DIAGNOSTIC_ONLY_NOT_A_GATE'
    },
    executionSemantics:{
      entry:'FIRST_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE',
      announcementDayReturnIncluded:false,
      timingInferenceAllowed:false
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
  if(r1Keys.size!==461)throw new Error('PEAD_R3_R1_BASELINE_COUNT:'+r1Keys.size+':461');

  const live=await fetchYahooCalendarRange();
  const audit=auditR3(live.rows,fjaText,lawcalText,r1Keys,live.pages);

  const result={
    schemaVersion:1,
    study:PEAD_SOURCE_AUDIT_R3.study,
    sourceRevision:PEAD_SOURCE_AUDIT_R3.sourceRevision,
    status:audit.passed?'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R3':'INCONCLUSIVE_SOURCE_CAUSALITY_R3',
    window:PEAD_SOURCE_AUDIT_R3.window,
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
      transportRevision:'R2_VALIDATED_COOKIE_CRUMB_RAW_ROW_PAGINATION',
      pagination:{size:PEAD_SOURCE_AUDIT_R3.pageSize,pages:live.pages}
    },
    audit:{...audit,causalEvents:undefined},
    causalEvents:audit.causalEvents,
    providerContract:{
      earnings:'Yahoo Finance calendar queried by historical date range, not by a current ticker universe',
      timing:'Yahoo historical startdatetimetype is diagnostic only; TAS/unknown never inferred',
      pitMembership:'exact-ticker intersection of two commit-pinned S&P 500 historical reconstructions',
      estimate:'historical Yahoo EPS Estimate; no independent consensus-vintage archive guarantee',
      execution:'first regular open strictly after reportDate for every event',
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
