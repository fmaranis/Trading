import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2 as P,
  normalizeTicker,
  reconstructHistoricalMembers,
  selectTopDecile,
  yahooTicker
} from './coreOutperformanceProfitabilityPitR2Protocol.mjs';

const SEAL_PATH = 'validation-runs/preregistration/core-outperformance-profitability-pit-r2-seal.json';
const CACHE_DIR = '.runtime/core-outperformance-profitability-pit-r2-cache';
const CHECKPOINT = '.runtime/core-outperformance-profitability-pit-r2-pre-outcome.json';
const RAW_BASE = `https://raw.githubusercontent.com/${P.source.repository}/${P.source.commit}`;
const SEC_INTERVAL_MS = 130;

function gitBlobSha(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function verifySeal() {
  const seal = JSON.parse(readFileSync(SEAL_PATH,'utf8'));
  if (seal.version !== 'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_SEAL') throw new Error('PROFITABILITY_PIT_SEAL_VERSION_INVALID');
  if (seal.productionDefault !== 'LEGACY' || seal.productionAuthority !== false) throw new Error('PROFITABILITY_PIT_SEAL_PRODUCTION_INVALID');
  for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
    const actual = gitBlobSha(readFileSync(path,'utf8'));
    if (actual !== expected) throw new Error(`PROFITABILITY_PIT_SEAL_MISMATCH:${path}:${expected}:${actual}`);
  }
  return seal;
}
function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CORE_OUTPERFORMANCE_PROFITABILITY_PIT_${name}_REQUIRED`);
  return value;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function cachePath(url) { return join(CACHE_DIR, `${sha256(url)}.txt`); }
async function fetchTextCached(url, headers={}, label='HTTP') {
  mkdirSync(CACHE_DIR,{recursive:true});
  const path = cachePath(url);
  if (existsSync(path)) return readFileSync(path,'utf8');
  const response = await fetch(url,{headers,signal:AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS)||30000)});
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}_HTTP_${response.status}:${text.slice(0,200)}`);
  writeFileSync(path,text,'utf8');
  return text;
}
function parseCsvLine(line) {
  const out=[]; let cur=''; let quoted=false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch==='"') {
      if (quoted && line[i+1]==='"') { cur+='"'; i++; }
      else quoted=!quoted;
    } else if (ch===',' && !quoted) { out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out;
}
function parseCurrentSymbols(text) {
  return text.split(/\r?\n/).slice(1).filter(Boolean).map(line => parseCsvLine(line)[0]).filter(Boolean);
}
function parsePythonList(value) {
  if (!value?.trim()) return [];
  return [...value.matchAll(/'([^']+)'/g)].map(m=>m[1]);
}
function parseChanges(text) {
  return text.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const cols=parseCsvLine(line);
    return {date:cols[0],added:parsePythonList(cols[1]),removed:parsePythonList(cols[2])};
  });
}
function tickerKey(value) { return normalizeTicker(value); }
function iso(value) { return String(value ?? '').slice(0,10); }
function valuesOfObject(value) { return value && typeof value==='object' ? Object.values(value) : []; }
function sleep(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }

let lastSecAt=0;
async function secJson(url,userAgent,label) {
  const elapsed=Date.now()-lastSecAt;
  if (elapsed<SEC_INTERVAL_MS) await sleep(SEC_INTERVAL_MS-elapsed);
  lastSecAt=Date.now();
  const text=await fetchTextCached(url,{'Accept':'application/json','Accept-Encoding':'gzip, deflate','User-Agent':userAgent},label);
  return JSON.parse(text);
}
function unitRows(payload, taxonomy, tag, kind) {
  const units=payload?.facts?.[taxonomy]?.[tag]?.units;
  if (!units || typeof units!=='object') return [];
  const match=Object.entries(units).find(([unit]) => {
    const u=unit.toLowerCase().replace(/\s+/g,'');
    if (kind==='USD') return u==='usd';
    if (kind==='SHARES') return u==='shares';
    return false;
  });
  return Array.isArray(match?.[1]) ? match[1] : [];
}
function annualSeries(payload,tags,signalDate) {
  const byEnd=new Map();
  for (let tagPriority=0; tagPriority<tags.length; tagPriority++) {
    const tag=tags[tagPriority];
    const rows=unitRows(payload,'us-gaap',tag,'USD').filter(row => {
      const start=Date.parse(String(row.start??'')), end=Date.parse(String(row.end??''));
      const days=(end-start)/86400000;
      return Number.isFinite(Number(row.val)) && P.fundamentals.acceptedForms.includes(String(row.form))
        && iso(row.filed) && iso(row.filed)<=signalDate && days>=250 && days<=460;
    });
    for (const row of rows) {
      const end=iso(row.end);
      if (!end) continue;
      const candidate={end,value:Number(row.val),filed:iso(row.filed),tag,tagPriority};
      const prev=byEnd.get(end);
      if (!prev
        || candidate.filed>prev.filed
        || (candidate.filed===prev.filed && candidate.tagPriority<prev.tagPriority)) {
        byEnd.set(end,candidate);
      }
    }
  }
  return [...byEnd.values()].sort((x,y)=>x.end.localeCompare(y.end));
}
function instantAtEnd(payload,tags,end,signalDate) {
  for (const tag of tags) {
    const rows=unitRows(payload,'us-gaap',tag,'USD')
      .filter(row=>Number.isFinite(Number(row.val)) && iso(row.end)===end && iso(row.filed) && iso(row.filed)<=signalDate)
      .sort((a,b)=>iso(a.filed).localeCompare(iso(b.filed)));
    if (rows.length) { const r=rows.at(-1); return {value:Number(r.val),filed:iso(r.filed),tag}; }
  }
  return null;
}
function latestShares(payload,signalDate) {
  for (const [taxonomy,tags] of [['dei',['EntityCommonStockSharesOutstanding']],['us-gaap',['CommonStockSharesOutstanding']]]) {
    for (const tag of tags) {
      const rows=unitRows(payload,taxonomy,tag,'SHARES')
        .filter(row=>Number.isFinite(Number(row.val)) && iso(row.end) && iso(row.end)<=signalDate && iso(row.filed) && iso(row.filed)<=signalDate)
        .sort((a,b)=>iso(a.end).localeCompare(iso(b.end)) || iso(a.filed).localeCompare(iso(b.filed)));
      if (rows.length) { const r=rows.at(-1); if (Number(r.val)>0) return {value:Number(r.val),filed:iso(r.filed),tag}; }
    }
  }
  return null;
}
function exactFiscalComponent(series,end) { return series.find(row=>row.end===end) ?? null; }
function opRowFromFacts(ticker,cik,payload,signalDate) {
  const revenue=annualSeries(payload,P.fundamentals.revenueTags,signalDate);
  const cogs=annualSeries(payload,P.fundamentals.cogsTags,signalDate);
  const sga=annualSeries(payload,P.fundamentals.sgaTags,signalDate);
  const interest=annualSeries(payload,P.fundamentals.interestTags,signalDate);
  const ends=revenue.map(x=>x.end).sort();

  for (let index=ends.length-1; index>=0; index--) {
    const end=ends[index];
    const rev=exactFiscalComponent(revenue,end);
    const cg=exactFiscalComponent(cogs,end);
    const sg=exactFiscalComponent(sga,end);
    const it=exactFiscalComponent(interest,end);
    const observed=[cg,sg,it].filter(Boolean);
    if (!rev || observed.length===0) continue;

    const equity=instantAtEnd(payload,P.fundamentals.equityTags,end,signalDate);
    const shares=latestShares(payload,signalDate);
    if (!equity || !(equity.value>0) || !shares) continue;

    const numerator=rev.value-(cg?.value??0)-(sg?.value??0)-(it?.value??0);
    const causalFilings=[rev.filed,...observed.map(row=>row.filed),equity.filed,shares.filed];
    if (causalFilings.some(f=>f>signalDate)) throw new Error(`PROFITABILITY_PIT_R2_LOOKAHEAD:${ticker}`);

    return {
      ticker,cik,fiscalEnd:end,
      operatingProfitability:numerator/equity.value,
      sharesOutstanding:shares.value,
      expenseObserved:{cogs:Boolean(cg),sga:Boolean(sg),interest:Boolean(it)},
      missingExpenseImputedZero:{cogs:!cg,sga:!sg,interest:!it},
      causalFilings:[...new Set(causalFilings)].sort()
    };
  }
  return null;
}
async function loadSecTickerMap(userAgent) {
  const payload=await secJson('https://www.sec.gov/files/company_tickers.json',userAgent,'SEC_TICKERS');
  const map=new Map();
  for (const row of valuesOfObject(payload)) {
    const ticker=String(row.ticker??'').trim();
    if (ticker && Number.isFinite(Number(row.cik_str))) map.set(tickerKey(ticker),String(row.cik_str).padStart(10,'0'));
  }
  return map;
}
async function yahooChart(symbol,start,end) {
  const p1=Math.floor(Date.parse(start+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse(end+'T00:00:00Z')/1000);
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const payload=JSON.parse(await fetchTextCached(url,{'User-Agent':'Mozilla/5.0'},`YAHOO_${symbol}`));
  const r=payload?.chart?.result?.[0]; if (!r) throw new Error(`YAHOO_NO_RESULT:${symbol}`);
  const q=r.indicators?.quote?.[0], adj=r.indicators?.adjclose?.[0]?.adjclose ?? [];
  return (r.timestamp??[]).map((ts,i)=>({date:new Date(ts*1000).toISOString().slice(0,10),open:q?.open?.[i],close:q?.close?.[i],adjClose:adj[i]}))
    .filter(x=>x.date && Number.isFinite(x.close));
}
function adjustedOpen(bar) {
  if (!(bar?.open>0) || !(bar?.close>0) || !(bar?.adjClose>0)) return null;
  return bar.open*(bar.adjClose/bar.close);
}
async function resolveCalendar(anchor) {
  const start=new Date(Date.parse(anchor+'T00:00:00Z')-8*86400000).toISOString().slice(0,10);
  const end=new Date(Date.parse(anchor+'T00:00:00Z')+8*86400000).toISOString().slice(0,10);
  const bars=await yahooChart('SPY',start,end);
  const before=bars.filter(b=>b.date<=anchor).sort((a,b)=>a.date.localeCompare(b.date));
  const signal=before.at(-1); if(!signal) throw new Error(`SIGNAL_SESSION_MISSING:${anchor}`);
  const execution=bars.filter(b=>b.date>signal.date).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!execution) throw new Error(`EXECUTION_SESSION_MISSING:${anchor}`);
  return {anchor,signalDate:signal.date,executionDate:execution.date};
}
async function rawCloseOn(symbol,date) {
  const end=new Date(Date.parse(date+'T00:00:00Z')+3*86400000).toISOString().slice(0,10);
  const bars=await yahooChart(symbol,date,end);
  const b=bars.find(x=>x.date===date); if(!(b?.close>0)) throw new Error(`RAW_CLOSE_MISSING:${symbol}:${date}`);
  return b.close;
}
async function adjustedOpenOn(symbol,date) {
  const end=new Date(Date.parse(date+'T00:00:00Z')+3*86400000).toISOString().slice(0,10);
  const bars=await yahooChart(symbol,date,end);
  const b=bars.find(x=>x.date===date); const v=adjustedOpen(b);
  if(!(v>0)) throw new Error(`ADJUSTED_OPEN_MISSING:${symbol}:${date}`); return v;
}
function weightedReturn(rows) { return rows.reduce((s,r)=>s+r.weight*r.returnPct,0); }
function cagrFromPeriods(periodPct) {
  const wealth=periodPct.reduce((w,r)=>w*(1+r/100),1);
  return (Math.pow(wealth,1/periodPct.length)-1)*100;
}

async function main() {
  const seal=verifySeal();
  const secUserAgent=requiredEnv('SEC_EDGAR_USER_AGENT');

  const currentText=await fetchTextCached(`${RAW_BASE}/${P.source.currentPath}`,{},'SP500_CURRENT');
  const changesText=await fetchTextCached(`${RAW_BASE}/${P.source.changesPath}`,{},'SP500_CHANGES');
  const currentSymbols=parseCurrentSymbols(currentText), changes=parseChanges(changesText);
  const tickerMap=await loadSecTickerMap(secUserAgent);
  const calendars=[];
  for (const anchor of P.anchors) calendars.push(await resolveCalendar(anchor));

  const formations=[];
  for (let i=0;i<calendars.length-1;i++) {
    const cal=calendars[i], next=calendars[i+1];
    const members=reconstructHistoricalMembers(currentSymbols,changes,cal.signalDate);
    if (members.length<P.coverage.minimumHistoricalMembers) throw new Error(`INCONCLUSIVE_HISTORICAL_MEMBERS:${cal.signalDate}:${members.length}`);
    const mapped=members.map(ticker=>({ticker,cik:tickerMap.get(tickerKey(ticker))})).filter(x=>x.cik);
    if (mapped.length<P.coverage.minimumCikMapped) throw new Error(`INCONCLUSIVE_CIK_MAPPING:${cal.signalDate}:${mapped.length}`);

    const evaluated=[]; const exclusions=[];
    for (let j=0;j<mapped.length;j++) {
      const item=mapped[j];
      try {
        const payload=await secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${item.cik}.json`,secUserAgent,`SEC_${item.ticker}`);
        const row=opRowFromFacts(item.ticker,item.cik,payload,cal.signalDate);
        if(row) evaluated.push(row); else exclusions.push({ticker:item.ticker,reason:'FF_STYLE_COMPONENTS_UNAVAILABLE'});
      } catch(error) { exclusions.push({ticker:item.ticker,reason:error?.message||String(error)}); }
      if ((j+1)%50===0) console.log(`PROFITABILITY_PIT_R2_SEC_PROGRESS ${cal.signalDate} ${j+1}/${mapped.length}`);
    }
    const componentCoverage={
      evaluated:evaluated.length,
      cogsObserved:evaluated.filter(row=>row.expenseObserved.cogs).length,
      sgaObserved:evaluated.filter(row=>row.expenseObserved.sga).length,
      interestObserved:evaluated.filter(row=>row.expenseObserved.interest).length,
      oneExpenseOnly:evaluated.filter(row=>Object.values(row.expenseObserved).filter(Boolean).length===1).length,
      twoExpenses:evaluated.filter(row=>Object.values(row.expenseObserved).filter(Boolean).length===2).length,
      allThreeExpenses:evaluated.filter(row=>Object.values(row.expenseObserved).filter(Boolean).length===3).length,
      exclusions:exclusions.length
    };
    if(evaluated.length<P.coverage.minimumEvaluable) throw new Error(
      `INCONCLUSIVE_OP_COVERAGE:${cal.signalDate}:${evaluated.length}:diagnostic=${JSON.stringify(componentCoverage)}`
    );
    const selected=selectTopDecile(evaluated);
    if(selected.length<P.coverage.minimumSelected) throw new Error(`INCONCLUSIVE_SELECTED_COUNT:${cal.signalDate}:${selected.length}`);

    const withCap=[];
    for(const row of selected) {
      const raw=await rawCloseOn(yahooTicker(row.ticker),cal.signalDate);
      const marketCap=raw*row.sharesOutstanding;
      if(!(marketCap>0)) throw new Error(`INCONCLUSIVE_SELECTED_MARKET_CAP:${row.ticker}:${cal.signalDate}`);
      withCap.push({...row,rawClose:raw,marketCap});
    }
    const totalCap=withCap.reduce((s,r)=>s+r.marketCap,0);
    const frozenSelection=withCap.map(r=>({...r,weight:r.marketCap/totalCap})).sort((a,b)=>a.ticker.localeCompare(b.ticker));
    formations.push({signalDate:cal.signalDate,executionDate:cal.executionDate,nextExecutionDate:next.executionDate,counts:{members:members.length,mapped:mapped.length,evaluated:evaluated.length,selected:frozenSelection.length},componentCoverage,selected:frozenSelection,exclusionCount:exclusions.length});
  }

  mkdirSync(dirname(CHECKPOINT),{recursive:true});
  writeFileSync(CHECKPOINT,JSON.stringify({version:P.version,sealFrozenAt:seal.frozenAt,outcomeAccessed:false,formations},null,2)+'\n','utf8');

  const periodResults=[];
  for(const formation of formations) {
    const outcomeRows=[];
    for(const row of formation.selected) {
      const symbol=yahooTicker(row.ticker);
      const start=await adjustedOpenOn(symbol,formation.executionDate);
      const end=await adjustedOpenOn(symbol,formation.nextExecutionDate);
      outcomeRows.push({ticker:row.ticker,weight:row.weight,returnPct:(end/start-1)*100});
    }
    const portfolioReturnPct=weightedReturn(outcomeRows);
    const spyStart=await adjustedOpenOn('SPY',formation.executionDate), spyEnd=await adjustedOpenOn('SPY',formation.nextExecutionDate);
    const urthStart=await adjustedOpenOn('URTH',formation.executionDate), urthEnd=await adjustedOpenOn('URTH',formation.nextExecutionDate);
    periodResults.push({signalDate:formation.signalDate,executionDate:formation.executionDate,nextExecutionDate:formation.nextExecutionDate,portfolioReturnPct,spyReturnPct:(spyEnd/spyStart-1)*100,urthReturnPct:(urthEnd/urthStart-1)*100,outcomeRows});
  }
  const p=periodResults.map(x=>x.portfolioReturnPct), s=periodResults.map(x=>x.spyReturnPct), u=periodResults.map(x=>x.urthReturnPct);
  const candidateCagrPct=cagrFromPeriods(p), spyCagrPct=cagrFromPeriods(s), urthCagrPct=cagrFromPeriods(u);
  const passed=periodResults.length===P.stageC1Gate.requiredPeriods && candidateCagrPct>spyCagrPct && candidateCagrPct>urthCagrPct;
  const result={version:P.version,status:passed?'PASS_ACTIONABLE_TRANSLATION_GROSS_ONLY':'FAIL_ACTIONABLE_TRANSLATION',protocol:P,periodResults,metrics:{candidateCagrPct,spyCagrPct,urthCagrPct,excessVsSpyPctPoints:candidateCagrPct-spyCagrPct,excessVsUrthPctPoints:candidateCagrPct-urthCagrPct},productionDefault:'LEGACY',productionAuthority:false,nextAction:passed?'STAGE_C2_ECONOMIC_HARNESS':'STOP_TRANSLATION_NO_RETUNING'};
  console.log('CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_RESULT',JSON.stringify(result));
}

main().catch(error => {
  const reason=error?.message||String(error);
  const inconclusive=String(reason).startsWith('INCONCLUSIVE_');
  const payload={
    version:P.version,
    status:inconclusive?'INCONCLUSIVE_COVERAGE':'BLOCKED_DATA_ACCESS',
    reason,
    productionDefault:'LEGACY',
    productionAuthority:false
  };
  console.log('CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_RESULT',JSON.stringify(payload));
  if(!inconclusive) process.exitCode=1;
});
