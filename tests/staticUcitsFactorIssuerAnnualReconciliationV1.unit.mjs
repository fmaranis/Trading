import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VERSION,MARKER,PERIODS,ECB_URL,OFFICIAL,QUALITY_LIMITS,parseEcbCsv,
  annualUsdReturns,reconcileAnnual,chooseUcitsSourceResolution
} from '../scripts/staticUcitsFactorIssuerAnnualReconciliationV1.mjs';
import { INSTRUMENTS } from '../scripts/staticUcitsFactorMarketDataPreflightV1.mjs';

const date=year=>String(year)+'-12-30';
const fauxFx=new Map();
const priceByTicker=new Map();
for(const inst of INSTRUMENTS){
  const official=OFFICIAL[inst.ticker];
  assert.equal(official.isin,inst.isin);
  assert.equal(official.currency,'USD');
  assert.equal(official.returns.length,9);
  const bars=[{date:date(2016),adjustedClose:100}];
  for(let i=0;i<PERIODS.length;i++){
    bars.push({date:date(PERIODS[i]),adjustedClose:bars[i].adjustedClose*(1+official.returns[i]/100)});
  }
  priceByTicker.set(inst.ticker,bars);
}
for(let y=2016;y<=2025;y++)fauxFx.set(date(y),1.2); // synthetic EUR/USD fixture only; NOT market evidence
for(const inst of INSTRUMENTS){
  const bars=priceByTicker.get(inst.ticker);
  const value=reconcileAnnual(inst,bars,fauxFx);
  assert.equal(value.annualConsistency,'PASS_ANNUAL_CONSISTENCY_ONLY');
  assert.equal(value.years.length,9);
  assert.ok(value.maximumAbsoluteDifferencePctPoints<1e-10);
  assert.equal(value.years[0].firstMarketDate,'2016-12-30');
  assert.equal(value.years.at(-1).lastMarketDate,'2025-12-30');
}
const bad=priceByTicker.get('XDEM.DE').map(x=>({...x}));
bad[4].adjustedClose*=1.2;
assert.equal(reconcileAnnual(INSTRUMENTS[1],bad,fauxFx).annualConsistency,'INCONCLUSIVE_ANNUAL_MISMATCH');
const wrongIsin={...INSTRUMENTS[0],isin:'IE0000000000'};
assert.throws(()=>reconcileAnnual(wrongIsin,priceByTicker.get('EUNL.DE'),fauxFx),/ISSUER_IDENTITY/);
const freshFx=new Map(fauxFx);freshFx.delete('2025-12-30');
assert.throws(()=>annualUsdReturns(priceByTicker.get('EUNL.DE'),freshFx),/ECB_MISSING/);
let lines=['KEY,FREQ,CURRENCY,CURRENCY_DENOM,TIME_PERIOD,OBS_VALUE'];
let t=Date.UTC(2016,11,1);
while(t<=Date.UTC(2025,11,31)){
  const d=new Date(t).toISOString().slice(0,10),n=new Date(t).getUTCDay();
  if(n!==0&&n!==6)lines.push('EXR.D.USD.EUR.SP00.A,D,USD,EUR,'+d+',1.2');
  t+=86400000;
}
const rates=parseEcbCsv(lines.join('\n'));
assert.ok(rates.size>2200);
assert.equal(rates.get('2025-12-30'),1.2);
assert.throws(()=>parseEcbCsv(lines.join('\n').replace(',USD,EUR,',',EUR,USD,')),/ECB_WRONG_SERIES/);
assert.equal(PERIODS[0],2017);
assert.equal(PERIODS.at(-1),2025);
assert.ok(ECB_URL.includes('D.USD.EUR.SP00.A'));
assert.equal(QUALITY_LIMITS.maxYearAbsoluteDifferencePctPoints,3);
const source=fs.readFileSync('scripts/staticUcitsFactorIssuerAnnualReconciliationV1.mjs','utf8');
// Original 26-Oct source is never silently replaced by a fresh download.
const choose=(originalManifestExists,originalRawCount,recaptureManifestExists,recaptureRawCount)=>
  chooseUcitsSourceResolution({originalManifestExists,originalRawCount,recaptureManifestExists,recaptureRawCount});
assert.equal(choose(true,4,false,0),'ORIGINAL_VERIFIED_MANIFEST');
assert.equal(choose(false,4,false,0),'REBUILD_MANIFEST_FROM_UNCHANGED_ORIGINAL_RAW');
assert.equal(choose(false,0,false,0),'EXPLICIT_NEW_SOURCE_RECAPTURE');
assert.equal(choose(true,0,false,0),'EXPLICIT_NEW_SOURCE_RECAPTURE');
assert.equal(choose(true,2,false,0),'EXPLICIT_NEW_SOURCE_RECAPTURE');
assert.equal(choose(true,3,true,4),'EXPLICIT_RECAPTURE_EXISTING');
assert.equal(choose(false,0,true,4),'EXPLICIT_RECAPTURE_EXISTING');
assert.equal(choose(false,0,false,2),'EXPLICIT_RESUME_NEW_SOURCE_RECAPTURE');
assert.equal(choose(true,0,true,2),'BLOCKED_RECAPTURE_MISSING_RAW');
assert.throws(()=>choose(true,5,false,0),/INVALID_SOURCE_FILE_COUNTS/);
assert.match(source,/REBUILD_MANIFEST_FROM_UNCHANGED_ORIGINAL_RAW/);
assert.match(source,/NEW_REAL_YAHOO_SOURCE_VINTAGE_AFTER_EPHEMERAL_STORAGE_LOSS/);
assert.match(source,/SOURCE_VINTAGE_HASH_DIVERGENCE/);
assert.match(source,/RAW_CHECKSUM_MISMATCH/);
assert.match(source,/flag:'wx'/);
assert.match(source,/sourceType:'REAL'/);
assert.match(source,/dailyIssuerNavReconciliation:false/);
assert.match(source,/economicOutcomesCalculated:false/);
assert.ok(!source.includes('Math.random'));
console.log('STATIC_UCITS_FACTOR_ISSUER_ANNUAL_RECONCILIATION_V1_UNIT_PASS',JSON.stringify({
  contract:VERSION,marker:MARKER,scenarios:'four issuer fixtures, 36 annual comparisons, wrong market/ISIN/FX, recovered original, fresh and resumed separate vintages, no mixed original/reacquired data',
  marketDataFetched:false,sourceType:'SYNTHETIC_UNIT_FIXTURE_ONLY'
}));
