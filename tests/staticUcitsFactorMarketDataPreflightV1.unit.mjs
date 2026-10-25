import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VERSION, MARKER, INSTRUMENTS, START, THROUGH, BENCHMARK_CHANGE, DATA_GATES,
  parseYahooEtfChart, auditCoverage
} from '../scripts/staticUcitsFactorMarketDataPreflightV1.mjs';

function dates(){
  const result=[];
  let t=Date.parse(START+'T00:00:00Z'),end=Date.parse(THROUGH+'T00:00:00Z');
  while(t<=end){
    const d=new Date(t),weekday=d.getUTCDay();
    if(weekday!==0&&weekday!==6)result.push(t);
    t+=86400000;
  }
  return result;
}
const timestamps=dates();
function yahooPayload(ticker,opts={}){
  const ts=opts.timestamp??timestamps;
  const values=ts.map((_,i)=>20+i*0.04);
  return JSON.stringify({
    chart:{error:null,result:[{
      meta:{
        symbol:opts.symbol??ticker,currency:opts.currency??'EUR',
        exchangeName:opts.exchange??'GER',instrumentType:opts.instrumentType??'ETF',
        firstTradeDate:Date.parse((opts.firstTrade??'2014-09-05')+'T00:00:00Z')/1000,
        timezone:'Europe/Berlin'
      },
      timestamp:ts.map(t=>Math.floor(t/1000)),
      indicators:{
        quote:[{open:values,close:values.map(x=>x+0.03)}],
        ...(opts.noAdjusted?{}:{adjclose:[{adjclose:values.map(x=>x+0.029)}]})
      },
      events:opts.splits?{splits:{one:{date:Date.parse('2025-12-05T00:00:00Z')/1000,numerator:2,denominator:1}}}:{}
    }]}
  });
}
const toPanel=(ticker,options)=>parseYahooEtfChart(ticker,yahooPayload(ticker,options));
const panels=Object.fromEntries(INSTRUMENTS.map(x=>[x.ticker,toPanel(x.ticker)]));
assert.equal(VERSION,'STATIC_UCITS_FACTOR_MARKET_DATA_PREFLIGHT_V1');
assert.match(MARKER,/RESULT$/);
assert.equal(BENCHMARK_CHANGE,'2016-11-03');
assert.ok(timestamps.length>=DATA_GATES.minReferenceBars);
const p=auditCoverage(panels);
assert.equal(p.comparableStartDate,START);
assert.equal(p.lastCommonDate,THROUGH);
assert.equal(p.sharedCoverageFraction,1);
assert.equal(p.sharedDates,timestamps.length);
for(const inst of INSTRUMENTS){
  assert.equal(panels[inst.ticker].meta.currency,'EUR');
  assert.equal(p.instruments[inst.ticker].referenceCoverageFraction,1);
  assert.ok(panels[inst.ticker].bars[0].adjustedOpen>0);
}
const xdem='XDEM.DE';
assert.throws(()=>toPanel(xdem,{currency:'USD'}),/NOT_EUR/);
assert.throws(()=>toPanel(xdem,{symbol:'XDEV.DE'}),/WRONG_SYMBOL/);
assert.throws(()=>toPanel(xdem,{instrumentType:'EQUITY'}),/NOT_ETF/);
assert.throws(()=>toPanel(xdem,{exchange:'NYSE'}),/NOT_XETRA/);
assert.throws(()=>toPanel(xdem,{noAdjusted:true}),/ADJUSTED_CLOSE_MISSING/);
assert.throws(()=>toPanel(xdem,{firstTrade:'2020-01-01'}),/INSTRUMENT_TOO_NEW/);
const splits=toPanel(xdem,{splits:true});
assert.equal(splits.meta.splitEvents.length,1,'splits must remain visible for separate issuer reconciliation, not silently erased');
const reduced={...panels,[xdem]:toPanel(xdem,{timestamp:timestamps.slice(0,800)})};
assert.throws(()=>auditCoverage(reduced),/COVERAGE/);
const stalled={...panels,[xdem]:toPanel(xdem,{timestamp:timestamps.slice(0,-35)})};
assert.throws(()=>auditCoverage(stalled),/HISTORICAL_DATA_STALE|COVERAGE/);
const unseen={...panels,[xdem]:undefined};
assert.throws(()=>auditCoverage(unseen),/MISSING_SERIES/);
const source=fs.readFileSync('src/investment/decision/assetUniverse.ts','utf8');
for(const inst of INSTRUMENTS){
  const target=`assetId: '${inst.assetId}', ticker: '${inst.ticker}', isin: '${inst.isin}'`;
  assert.ok(source.includes(target),'the preflight cannot use a ticker detached from the canonical ISIN catalogue: '+inst.ticker);
}
const script=fs.readFileSync('scripts/staticUcitsFactorMarketDataPreflightV1.mjs','utf8');
assert.match(script,/sourceType:'REAL'/,'only provider source may be labelled REAL');
assert.doesNotMatch(script,/Math\.random|SYNTHETIC|economicReturn|cagr/i,'the preflight does not create synthetic data or economic results');
assert.match(script,/fs\.writeFileSync\(file,raw,\{flag:'wx'\}\)/,'raw downloaded payload never replaced');
assert.match(script,/economicOutcomesCalculated:false/);
console.log('STATIC_UCITS_FACTOR_PREFLIGHT_UNIT_PASS',JSON.stringify({
  checks:'identity,EUR,ETF,Xetra,first-trade,adjustment,coverage,stale,split-lineage,immutable-cache,no-economic-outcome',
  syntheticFixturesOnly:true,realDataFetched:false,marketOutcomeOpened:false
}));
