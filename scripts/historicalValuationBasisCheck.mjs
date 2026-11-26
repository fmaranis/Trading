// Research-only arithmetic and fail-closed input contract. No network, orders or replay.
// Evidence declarations must be established independently by the caller; this is not a provider certification.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function reconcileHistoricalValuation(input) {
  const fail = code => { throw new Error(code); };
  const date = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const evidence = s => typeof s === 'string' && s.trim().length > 0;
  const {securityId, currency, informationDate, quote, nominalReference, shares, earnings, actions} = input;
  if (!evidence(securityId) || currency !== 'USD' || !date(informationDate)) fail('IDENTITY_OR_DATE_UNVERIFIED');
  for (const x of [quote,nominalReference,shares,earnings,actions]) {
    if (!x || x.securityId !== securityId || !evidence(x.source)) fail('IDENTITY_OR_SOURCE_MISMATCH');
  }
  if (quote.currency !== currency || nominalReference.currency !== currency || earnings.currency !== currency) fail('CURRENCY_MISMATCH');
  if (quote.date !== informationDate || nominalReference.date !== informationDate || quote.basis !== 'SPLIT_ADJUSTED_CLOSE' || nominalReference.basis !== 'CONTEMPORARY_NOMINAL_CLOSE' || !positive(quote.close) || !positive(nominalReference.close) || quote.source === nominalReference.source) fail('PRICE_BASIS_UNVERIFIED');
  if (!date(quote.snapshotDate) || quote.snapshotDate < informationDate || !date(shares.asOf) || !date(shares.filed) || shares.asOf > shares.filed || shares.filed >= informationDate || shares.basis !== 'AS_REPORTED_OUTSTANDING_SINGLE_CLASS' || !positive(shares.count) || !Number.isSafeInteger(shares.count)) fail('SHARES_UNVERIFIED');
  if (!date(earnings.periodEnd) || !date(earnings.filed) || earnings.periodEnd > earnings.filed || earnings.filed >= informationDate || earnings.basis !== 'AS_REPORTED_ANNUAL_NET_INCOME' || !Number.isFinite(earnings.value)) fail('EARNINGS_UNVERIFIED');
  if (actions.coverageVerified !== true || !date(actions.from) || !date(actions.through) || actions.from > shares.asOf || actions.through !== quote.snapshotDate || !Array.isArray(actions.splits)) fail('SPLIT_COVERAGE_UNVERIFIED');
  let factor = 1;
  const seen = new Set();
  for (const event of actions.splits) {
    if (!date(event.date) || event.date < actions.from || event.date > actions.through || seen.has(event.date) || !Number.isSafeInteger(event.numerator) || !Number.isSafeInteger(event.denominator) || !positive(event.numerator) || !positive(event.denominator) || !evidence(event.source)) fail('SPLIT_EVENT_INVALID');
    seen.add(event.date);
    if (event.date >= shares.asOf && event.date <= informationDate) fail('SHARES_BASIS_CHANGED_OR_AMBIGUOUS');
    if (event.date > informationDate) factor *= event.numerator / event.denominator;
  }
  const nominal = quote.close * factor;
  if (!positive(nominal) || Math.abs(nominal - nominalReference.close) > 0.010000001) fail('NOMINAL_REFERENCE_MISMATCH');
  const estimatedMarketCap = nominal * shares.count;
  const earningsYield = earnings.value / estimatedMarketCap;
  if (!positive(estimatedMarketCap) || !Number.isFinite(earningsYield)) fail('VALUATION_INVALID');
  return {securityId,informationDate,splitFactor:factor,nominalClose:nominal,estimatedMarketCap,earningsYield,pe:earnings.value>0?estimatedMarketCap/earnings.value:null,shareCountAsOf:shares.asOf,productionAuthority:false};
}

export function runSelfTest() {
  const id='AMZN_COMMON', date='2021-12-31';
  const fixture={securityId:id,currency:'USD',informationDate:date,
    quote:{securityId:id,currency:'USD',date,basis:'SPLIT_ADJUSTED_CLOSE',close:166.717,snapshotDate:'2025-09-09',source:'SEC 424B2 https://www.sec.gov/Archives/edgar/data/1419828/000088698225001354/gs-20250909.htm'},
    nominalReference:{securityId:id,currency:'USD',date,basis:'CONTEMPORARY_NOMINAL_CLOSE',close:3334.34,source:'Digrin https://www.digrin.com/stocks/detail/AMZN/price'},
    shares:{securityId:id,asOf:'2021-10-20',filed:'2021-10-29',basis:'AS_REPORTED_OUTSTANDING_SINGLE_CLASS',count:507147620,source:'SEC 10-Q https://www.sec.gov/Archives/edgar/data/1018724/000101872421000028/amzn-20210930.htm'},
    earnings:{securityId:id,currency:'USD',periodEnd:'2020-12-31',filed:'2021-02-03',basis:'AS_REPORTED_ANNUAL_NET_INCOME',value:21331000000,source:'SEC 10-K https://www.sec.gov/Archives/edgar/data/1018724/000101872421000004/amzn-20201231.htm'},
    actions:{securityId:id,from:'2021-10-20',through:'2025-09-09',coverageVerified:true,source:'TEST FIXTURE: assumed complete for arithmetic only, not a live coverage certification',splits:[{date:'2022-06-06',numerator:20,denominator:1,source:'OCC https://infomemo.theocc.com/infomemos?number=50496'}]}};
  const check=(ok,label)=>{if(!ok)throw new Error('SELF_TEST_FAIL:'+label);};
  const out=reconcileHistoricalValuation(fixture);
  check(out.splitFactor===20&&Math.abs(out.nominalClose-3334.34)<1e-8,'AMZN nominal');
  check(Math.abs((fixture.earnings.value/(fixture.quote.close*fixture.shares.count))/out.earningsYield-20)<1e-10,'AMZN yield factor');
  const reject=(label,edit,code)=>{const x=JSON.parse(JSON.stringify(fixture));edit(x);let actual='';try{reconcileHistoricalValuation(x);}catch(e){actual=e.message;}check(actual===code,label);};
  reject('missing split',x=>x.actions.splits=[],'NOMINAL_REFERENCE_MISMATCH');
  reject('incomplete coverage',x=>x.actions.coverageVerified=false,'SPLIT_COVERAGE_UNVERIFIED');
  reject('duplicate',x=>x.actions.splits.push(x.actions.splits[0]),'SPLIT_EVENT_INVALID');
  reject('same day split',x=>x.actions.splits[0].date=date,'SHARES_BASIS_CHANGED_OR_AMBIGUOUS');
  reject('future earnings',x=>x.earnings.filed='2022-02-04','EARNINGS_UNVERIFIED');
  reject('future shares',x=>x.shares.filed=date,'SHARES_UNVERIFIED');
  reject('weighted average shares',x=>x.shares.basis='DILUTED_WEIGHTED_AVERAGE','SHARES_UNVERIFIED');
  reject('dividend adjusted',x=>x.quote.basis='TOTAL_RETURN_ADJUSTED','PRICE_BASIS_UNVERIFIED');
  reject('different security',x=>x.shares.securityId='OTHER','IDENTITY_OR_SOURCE_MISMATCH');
  reject('wrong currency',x=>x.nominalReference.currency='EUR','CURRENCY_MISMATCH');
  const reverse=JSON.parse(JSON.stringify(fixture));reverse.actions.splits=[{date:'2022-06-06',numerator:1,denominator:5,source:'synthetic reverse split fixture'}];reverse.quote.close=500;reverse.nominalReference.close=100;
  check(Math.abs(reconcileHistoricalValuation(reverse).nominalClose-100)<1e-8,'reverse split');
  const multiple=JSON.parse(JSON.stringify(fixture));multiple.actions.splits=[{date:'2022-06-06',numerator:2,denominator:1,source:'synthetic split fixture'},{date:'2023-06-06',numerator:3,denominator:1,source:'synthetic split fixture'}];multiple.quote.close=100;multiple.nominalReference.close=600;
  check(reconcileHistoricalValuation(multiple).nominalClose===600,'multiple splits');
  return {status:'PASS',checks:14,fixture:'AMZN with documented inputs; split coverage assumed for test only',...out,incorrectEarningsYield:fixture.earnings.value/(fixture.quote.close*fixture.shares.count)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== '--self-test') { console.error('Use --self-test; no live data acquisition.'); process.exitCode = 2; }
  else console.log(JSON.stringify(runSelfTest(), null, 2));
}
