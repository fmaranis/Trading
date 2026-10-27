/**
 * RESEARCH DATA QUALITY ONLY. Cross-checks issuer-reported USD calendar-year NAV
 * returns (2017-2025) against the ALREADY-CACHED Yahoo Xetra EUR adjusted prices
 * transformed to USD with ECB daily reference EUR/USD.
 * It NEVER ranks funds, computes a portfolio strategy, or changes production.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { INSTRUMENTS, parseYahooEtfChart, auditCoverage } from './staticUcitsFactorMarketDataPreflightV1.mjs';

export const VERSION='STATIC_UCITS_FACTOR_ISSUER_ANNUAL_RECONCILIATION_V1';
export const MARKER='STATIC_UCITS_FACTOR_ISSUER_ANNUAL_RECONCILIATION_V1_RESULT';
export const PERIODS=Object.freeze([2017,2018,2019,2020,2021,2022,2023,2024,2025]);
export const ECB_URL='https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2016-12-01&endPeriod=2025-12-31&format=csvdata';
export const FX_CACHE='.runtime/static-ucits-factor-v1/ecb/eur-usd-reference-2016-2025.csv';
export const COVERAGE_MANIFEST='validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-result.json';
export const OUTPUT='validation-runs/diagnostics/static-ucits-factor-issuer-annual-reconciliation-v1-result.json';
const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');
const insist=(x,reason)=>{if(!x)throw Error('ISSUER_ANNUAL_RECONCILIATION_'+reason);};
// Immutable transcription of the issuer's USD NAV calendar-year results.
// Xtrackers: DWS official 'Past Performance' 1C, publication in 2026;
// EUNL: BlackRock/iShares official June 2026 factsheet for SWDA/EUNL same ISIN.
export const OFFICIAL=Object.freeze({
 'EUNL.DE':{
   isin:'IE00B4L5Y983',currency:'USD',publisher:'BLACKROCK_ISHARES',precisionPct:0.01,
   url:'https://www.ishares.com/uk/professional/en/literature/fact-sheet/swda-ishares-core-msci-world-ucits-etf-fund-fact-sheet-en-gb.pdf',
   returns:[22.45,-8.65,27.76,15.95,21.90,-18.03,23.86,18.70,21.16]
 },
 'XDEM.DE':{
   isin:'IE00BL25JP72',currency:'USD',publisher:'DWS_XTRACKERS',precisionPct:0.1,
   url:'https://etf.dws.com/Download/Past%20Performance/IE00BL25JP72/IE/EN',
   returns:[32.7,-4.0,28.8,28.0,14.5,-17.8,11.7,30.0,21.2]
 },
 'XDEQ.DE':{
   isin:'IE00BL25JL35',currency:'USD',publisher:'DWS_XTRACKERS',precisionPct:0.1,
   url:'https://etf.dws.com/Download/Past%20Performance/IE00BL25JL35/IE/EN',
   returns:[23.2,-7.9,31.5,14.9,23.3,-19.2,25.8,16.7,15.4]
 },
 'XDEV.DE':{
   isin:'IE00BL25JM42',currency:'USD',publisher:'DWS_XTRACKERS',precisionPct:0.1,
   url:'https://etf.dws.com/Download/Past%20Performance/IE00BL25JM42/IE/EN',
   returns:[22.3,-14.4,19.6,-4.0,20.1,-9.8,19.5,5.2,39.5]
 }
});
// Preregistered data-discrepancy STOP thresholds: not trading thresholds.
// Year-end mismatches may arise from NAV timing vs exchange/FX fixing.
export const QUALITY_LIMITS=Object.freeze({
 maxYearAbsoluteDifferencePctPoints:3.0,
 maxMeanAbsoluteDifferencePctPoints:1.5,
 minAnnualComparisonsPerAsset:9,
 maximumEcbObservationLagDays:4,
 maximumXetraYearEndLagDays:7
});
function dayDiff(later,earlier){return Math.round((Date.parse(later+'T00:00:00Z')-Date.parse(earlier+'T00:00:00Z'))/86400000);}
export function parseEcbCsv(csv){
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const split=line=>{const out=[];let v='',quoted=false;for(let i=0;i<line.length;i++){
    if(line[i]==='"'&&quoted&&line[i+1]==='"'){v+='"';i++;continue;}
    if(line[i]==='"'){quoted=!quoted;continue;}
    if(line[i]===','&&!quoted){out.push(v);v='';continue;}
    v+=line[i];
  }out.push(v);return out;};
  insist(lines.length>100,'ECB_TOO_SHORT');
  const hdr=split(lines[0]), dateIx=hdr.indexOf('TIME_PERIOD'),rateIx=hdr.indexOf('OBS_VALUE'),
    freqIx=hdr.indexOf('FREQ'),currencyIx=hdr.indexOf('CURRENCY'),denomIx=hdr.indexOf('CURRENCY_DENOM');
  insist(dateIx>=0&&rateIx>=0&&freqIx>=0&&currencyIx>=0&&denomIx>=0,'ECB_BAD_SCHEMA');
  const fx=new Map();
  for(const line of lines.slice(1)){
    if(!line.trim())continue;const c=split(line),d=c[dateIx],r=Number(c[rateIx]);
    insist(c[freqIx]==='D'&&c[currencyIx]==='USD'&&c[denomIx]==='EUR','ECB_WRONG_SERIES');
    if(!/^20\d\d-\d\d-\d\d$/.test(d)||!Number.isFinite(r)||r<=0)continue;
    insist(!fx.has(d),'ECB_DUPLICATE_DAY:'+d);
    fx.set(d,r);
  }
  insist(fx.size>2000,'ECB_INSUFFICIENT_OBSERVATIONS');
  return fx; // USD per EUR, NEVER inverted here.
}
function ecbAtOrBefore(fx,date,maxLag){
  for(let lag=0;lag<=maxLag;lag++){
    const d=new Date(Date.parse(date+'T00:00:00Z')-lag*86400000).toISOString().slice(0,10);
    if(fx.has(d))return {date:d,value:fx.get(d),lagDays:lag};
  }
  throw Error('ISSUER_ANNUAL_RECONCILIATION_ECB_MISSING:'+date);
}
function lastBarForYear(bars,year,maxLag){
  const cutoff=String(year)+'-12-31';
  const valid=bars.filter(x=>x.date<=cutoff&&x.date>=String(year)+'-12-01');
  const bar=valid.at(-1);
  insist(bar&&dayDiff(cutoff,bar.date)<=maxLag,'NO_XETRA_YEAR_END:'+year);
  insist(Number.isFinite(bar.adjustedClose)&&bar.adjustedClose>0,'BAD_ADJUSTED_CLOSE:'+year);
  return bar;
}
export function annualUsdReturns(bars,fx,limits=QUALITY_LIMITS){
  const checks=[];
  for(const year of PERIODS){
    const start=lastBarForYear(bars,year-1,limits.maximumXetraYearEndLagDays);
    const end=lastBarForYear(bars,year,limits.maximumXetraYearEndLagDays);
    const x0=ecbAtOrBefore(fx,start.date,limits.maximumEcbObservationLagDays);
    const x1=ecbAtOrBefore(fx,end.date,limits.maximumEcbObservationLagDays);
    // Base Xetra EUR prices are adjusted by Yahoo corporate-action ratios.
    // USD value of EUR quotation = EUR quotation * USD per EUR (ECB rate).
    const startUsd=start.adjustedClose*x0.value,endUsd=end.adjustedClose*x1.value;
    checks.push({year,firstMarketDate:start.date,lastMarketDate:end.date,
      firstFxDate:x0.date,lastFxDate:x1.date,firstFxLagDays:x0.lagDays,lastFxLagDays:x1.lagDays,
      marketUsdReturnPct:100*(endUsd/startUsd-1)});
  }
  return checks;
}
export function reconcileAnnual(instrument,bars,fx,official=OFFICIAL,limits=QUALITY_LIMITS){
  const ref=official[instrument.ticker];
  insist(ref&&ref.isin===instrument.isin&&ref.currency==='USD'&&ref.returns.length===PERIODS.length,'ISSUER_IDENTITY');
  const outcomes=annualUsdReturns(bars,fx,limits).map((row,i)=>{
    const issuerNavReturnPct=ref.returns[i],deltaPctPoints=row.marketUsdReturnPct-issuerNavReturnPct;
    return {...row,issuerNavReturnPct,deltaPctPoints,absDeltaPctPoints:Math.abs(deltaPctPoints)};
  });
  const maximumAbsoluteDifferencePctPoints=Math.max(...outcomes.map(x=>x.absDeltaPctPoints));
  const meanAbsoluteDifferencePctPoints=outcomes.reduce((a,x)=>a+x.absDeltaPctPoints,0)/outcomes.length;
  const qualified=outcomes.length>=limits.minAnnualComparisonsPerAsset
    &&maximumAbsoluteDifferencePctPoints<=limits.maxYearAbsoluteDifferencePctPoints
    &&meanAbsoluteDifferencePctPoints<=limits.maxMeanAbsoluteDifferencePctPoints;
  return {ticker:instrument.ticker,isin:instrument.isin,issuer:ref.publisher,issuerUrl:ref.url,
    years:outcomes,meanAbsoluteDifferencePctPoints,maximumAbsoluteDifferencePctPoints,
    annualConsistency:qualified?'PASS_ANNUAL_CONSISTENCY_ONLY':'INCONCLUSIVE_ANNUAL_MISMATCH'};
}
async function fetchEcb(){
  if(fs.existsSync(FX_CACHE)){const raw=fs.readFileSync(FX_CACHE,'utf8');return {raw,cached:true,sha256:sha256(raw)};}
  const response=await fetch(ECB_URL,{headers:{'Accept':'text/csv'},signal:AbortSignal.timeout(30000)});
  insist(response.ok,'ECB_HTTP_'+response.status);
  const raw=await response.text();
  parseEcbCsv(raw);
  fs.mkdirSync(path.dirname(FX_CACHE),{recursive:true});
  fs.writeFileSync(FX_CACHE,raw,{flag:'wx'});
  return {raw,cached:false,sha256:sha256(raw)};
}
export async function main(){
  insist(fs.existsSync(COVERAGE_MANIFEST),'COVERAGE_MANIFEST_NOT_PERSISTED_LOCAL');
  const prior=JSON.parse(fs.readFileSync(COVERAGE_MANIFEST,'utf8'));
  insist(prior.version==='STATIC_UCITS_FACTOR_MARKET_DATA_PREFLIGHT_V1'
    &&prior.sourceType==='REAL'&&prior.economicOutcomesCalculated===false,'COVERAGE_MANIFEST_INVALID');
  const panels={};
  for(const inst of INSTRUMENTS){
    const evidence=prior.sourceRawCache?.[inst.ticker];
    insist(evidence&&typeof evidence.sha256==='string'&&/^[a-f0-9]{64}$/.test(evidence.sha256),'RAW_LINEAGE_MISSING:'+inst.ticker);
    // Read only from frozen local prefix; a manifest cannot redirect outside repo-local runtime.
    const expected=path.join('.runtime/static-ucits-factor-v1/yahoo',inst.ticker+'.json');
    insist(evidence.path===expected,'RAW_CACHE_PATH_MISMATCH:'+inst.ticker);
    insist(fs.existsSync(expected),'RAW_CACHE_MISSING:'+inst.ticker);
    const raw=fs.readFileSync(expected,'utf8');
    insist(sha256(raw)===evidence.sha256,'RAW_CHECKSUM_MISMATCH:'+inst.ticker);
    panels[inst.ticker]=parseYahooEtfChart(inst.ticker,raw);
  }
  const coverage=auditCoverage(panels);
  insist(coverage.sharedDates===prior.coverage?.sharedDates&&coverage.sharedDates>=2500,'PREVIOUS_COVERAGE_CHANGED');
  if(fs.existsSync(OUTPUT)){
    const already=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
    insist(already.version===VERSION&&already.rawLineageMatchesPreviousPreflight===true,'EXISTING_RESULT_INVALID');
    console.log(MARKER,JSON.stringify({status:'ALREADY_SAVED',study:VERSION,output:OUTPUT,economicOutcomesCalculated:false}));
    return;
  }
  const exchange=await fetchEcb(),fx=parseEcbCsv(exchange.raw);
  const comparisons=INSTRUMENTS.map(inst=>reconcileAnnual(inst,panels[inst.ticker].bars,fx));
  const allPass=comparisons.every(x=>x.annualConsistency==='PASS_ANNUAL_CONSISTENCY_ONLY');
  const result={version:VERSION,status:allPass?'PASS_ANNUAL_CONSISTENCY_PENDING_DAILY_NAV':'INCONCLUSIVE_ANNUAL_RECONCILIATION',
    sourceType:'REAL',issuerSourceType:'OFFICIAL_ISSUER_PUBLISHED_ANNUAL_NAV_RETURNS',currency:'USD',
    generatedAt:new Date().toISOString(),studyWindow:'2017-2025',sourceRawCache:prior.sourceRawCache,
    rawLineageMatchesPreviousPreflight:true,coverageSharedDays:coverage.sharedDates,
    fx:{provider:'ECB',series:'EXR.D.USD.EUR.SP00.A',source:ECB_URL,sha256:exchange.sha256,cached:exchange.cached,convention:'USD_PER_EUR'},
    officialSources:Object.fromEntries(INSTRUMENTS.map(x=>[x.isin,OFFICIAL[x.ticker].url])),
    issuerFiguresFrozenBeforeLocalMarketComparisons:true,qualityLimits:QUALITY_LIMITS,comparisons,
    dailyIssuerNavReconciliation:false,brokerIsinEligibilityVerified:false,productionAuthority:false,
    economicOutcomesCalculated:false,benchmarkAlphaOrPortfolioReturnsCalculated:false,
    pending:['DAILY_NAV_INDEPENDENT_CROSSCHECK','CORPORATE_ACTION_ACCOUNTING','BROKER_EXACT_ISINS','LOOKTHROUGH','SINGLE_FROZEN_POLICY_AND_FRESH_SAMPLE'],
    notes:[
      'Issuer calendar-year NAV returns in USD, including internal fees, read from original issuer documents; not a daily NAV series',
      'Yahoo Xetra EUR adjusted closing quotations converted to USD with ECB published reference USD/EUR fixing on/before each Xetra close',
      'FX fixing and NAV valuation times differ from market close; this is an annual consistency filter, never proof of exact daily price reconciliation',
      '2014-2016 before benchmark change excluded. No timing/ranking/weights optimization or investment advice.'
    ]};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(MARKER,JSON.stringify({study:VERSION,status:result.status,counts:comparisons.map(x=>({ticker:x.ticker,years:x.years.length,
    meanAbsDiff:x.meanAbsoluteDifferencePctPoints,maxAbsDiff:x.maximumAbsoluteDifferencePctPoints,gate:x.annualConsistency})),
    economicOutcomesCalculated:false,productionAuthority:false,output:OUTPUT}));
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(err=>{
  console.error(MARKER,JSON.stringify({status:'BLOCKED',reason:err?.message??String(err),economicOutcomesCalculated:false,productionAuthority:false}));
  process.exitCode=1;
});
