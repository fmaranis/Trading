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


const COHORT = Object.freeze([
  {
    "ticker": "PSA",
    "cik": "0001393311",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "GM",
    "cik": "0001467858",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "FCX",
    "cik": "0000831259",
    "cut": "2018-12-31",
    "sector": "materials"
  },
  {
    "ticker": "FFIV",
    "cik": "0001048695",
    "cut": "2018-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "MGM",
    "cik": "0000789570",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "SLB",
    "cik": "0000087347",
    "cut": "2018-12-31",
    "sector": "energy"
  },
  {
    "ticker": "TSN",
    "cik": "0000100493",
    "cut": "2018-12-31",
    "sector": "consumer_staples"
  },
  {
    "ticker": "ALLE",
    "cik": "0001579241",
    "cut": "2018-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "SLG",
    "cik": "0001040971",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "SHW",
    "cik": "0000089800",
    "cut": "2018-12-31",
    "sector": "materials"
  },
  {
    "ticker": "CHD",
    "cik": "0000313927",
    "cut": "2018-12-31",
    "sector": "consumer_staples"
  },
  {
    "ticker": "BR",
    "cik": "0001383312",
    "cut": "2018-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "FIS",
    "cik": "0001136893",
    "cut": "2018-12-31",
    "sector": "financials"
  },
  {
    "ticker": "TPR",
    "cik": "0001116132",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "HCA",
    "cik": "0000860730",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "FTNT",
    "cik": "0001262039",
    "cut": "2018-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "CCI",
    "cik": "0001051470",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "PSX",
    "cik": "0001534701",
    "cut": "2018-12-31",
    "sector": "energy"
  },
  {
    "ticker": "NUE",
    "cik": "0000073309",
    "cut": "2018-12-31",
    "sector": "materials"
  },
  {
    "ticker": "GE",
    "cik": "0000040545",
    "cut": "2018-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "NI",
    "cik": "0001111711",
    "cut": "2018-12-31",
    "sector": "utilities"
  },
  {
    "ticker": "GD",
    "cik": "0000040533",
    "cut": "2018-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "AIG",
    "cik": "0000005272",
    "cut": "2018-12-31",
    "sector": "financials"
  },
  {
    "ticker": "DRE",
    "cik": "0000783280",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "COO",
    "cik": "0000711404",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "MTD",
    "cik": "0001037646",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "ULTA",
    "cik": "0001403568",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "CCL",
    "cik": "0000815097",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "KEYS",
    "cik": "0001601046",
    "cut": "2018-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "ZTS",
    "cik": "0001555280",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "TIF",
    "cik": "0000098246",
    "cut": "2018-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "WY",
    "cik": "0000106535",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "HRL",
    "cik": "0000048465",
    "cut": "2018-12-31",
    "sector": "consumer_staples"
  },
  {
    "ticker": "PPG",
    "cik": "0000079879",
    "cut": "2018-12-31",
    "sector": "materials"
  },
  {
    "ticker": "IT",
    "cik": "0000749251",
    "cut": "2018-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "ALK",
    "cik": "0000766421",
    "cut": "2018-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "AES",
    "cik": "0000874761",
    "cut": "2018-12-31",
    "sector": "utilities"
  },
  {
    "ticker": "ABC",
    "cik": "0001140859",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "SBAC",
    "cik": "0001034054",
    "cut": "2018-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "VRTX",
    "cik": "0000875320",
    "cut": "2018-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "CTSH",
    "cik": "0001058290",
    "cut": "2021-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "VRSN",
    "cik": "0001014473",
    "cut": "2021-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "CHTR",
    "cik": "0001091667",
    "cut": "2021-12-31",
    "sector": "communication_services"
  },
  {
    "ticker": "PEG",
    "cik": "0000788784",
    "cut": "2021-12-31",
    "sector": "utilities"
  },
  {
    "ticker": "ALGN",
    "cik": "0001097149",
    "cut": "2021-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "CZR",
    "cik": "0001590895",
    "cut": "2021-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "CSX",
    "cik": "0000277948",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "GPN",
    "cik": "0001123360",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "LIN",
    "cik": "0001707925",
    "cut": "2021-12-31",
    "sector": "materials"
  },
  {
    "ticker": "T",
    "cik": "0000732717",
    "cut": "2021-12-31",
    "sector": "communication_services"
  },
  {
    "ticker": "COF",
    "cik": "0000927628",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "NRG",
    "cik": "0001013871",
    "cut": "2021-12-31",
    "sector": "utilities"
  },
  {
    "ticker": "ECL",
    "cik": "0000031462",
    "cut": "2021-12-31",
    "sector": "materials"
  },
  {
    "ticker": "ILMN",
    "cik": "0001110803",
    "cut": "2021-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "V",
    "cik": "0001403161",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "ANTM",
    "cik": "0001156039",
    "cut": "2021-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "CPRT",
    "cik": "0000900075",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "EMN",
    "cik": "0000915389",
    "cut": "2021-12-31",
    "sector": "materials"
  },
  {
    "ticker": "RTX",
    "cik": "0000101829",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "JPM",
    "cik": "0000019617",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "RMD",
    "cik": "0000943819",
    "cut": "2021-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "GNRC",
    "cik": "0001474735",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "LYV",
    "cik": "0001335258",
    "cut": "2021-12-31",
    "sector": "communication_services"
  },
  {
    "ticker": "HWM",
    "cik": "0000004281",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "JCI",
    "cik": "0000833444",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "ARE",
    "cik": "0001035443",
    "cut": "2021-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "GPC",
    "cik": "0000040987",
    "cut": "2021-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "LVS",
    "cik": "0001300514",
    "cut": "2021-12-31",
    "sector": "consumer_discretionary"
  },
  {
    "ticker": "PLD",
    "cik": "0001045609",
    "cut": "2021-12-31",
    "sector": "real_estate"
  },
  {
    "ticker": "LNC",
    "cik": "0000059558",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "HON",
    "cik": "0000773840",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "A",
    "cik": "0001090872",
    "cut": "2021-12-31",
    "sector": "health_care"
  },
  {
    "ticker": "EPAM",
    "cik": "0001352010",
    "cut": "2021-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "ADM",
    "cik": "0000007084",
    "cut": "2021-12-31",
    "sector": "consumer_staples"
  },
  {
    "ticker": "NWSA",
    "cik": "0001564708",
    "cut": "2021-12-31",
    "sector": "communication_services"
  },
  {
    "ticker": "ACN",
    "cik": "0001467373",
    "cut": "2021-12-31",
    "sector": "information_technology"
  },
  {
    "ticker": "C",
    "cik": "0000831001",
    "cut": "2021-12-31",
    "sector": "financials"
  },
  {
    "ticker": "EMR",
    "cik": "0000032604",
    "cut": "2021-12-31",
    "sector": "industrials"
  },
  {
    "ticker": "D",
    "cik": "0000715957",
    "cut": "2021-12-31",
    "sector": "utilities"
  },
  {
    "ticker": "HPE",
    "cik": "0001645590",
    "cut": "2021-12-31",
    "sector": "information_technology"
  }
]);
function extractAnnualFacts(item,payload) {
  const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
  const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!/^\d{10}$/.test(item.cik)||!date(item.cut)||String(payload?.cik??'').padStart(10,'0')!==item.cik)throw Error('CIK_OR_CUTOFF_MISMATCH');
  const facts=(taxonomy,tag,unit)=>{const a=payload?.facts?.[taxonomy]?.[tag]?.units?.[unit];return Array.isArray(a)?a:[]};
  const causal=x=>date(x.end)&&date(x.filed)&&x.end<=x.filed&&x.filed<item.cut&&typeof x.val==='number'&&Number.isFinite(x.val)&&typeof x.accn==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(x.accn)&&x.accn.split('-')[1]===x.filed.slice(2,4);
  const anchors=facts('us-gaap','Assets','USD').filter(x=>causal(x)&&x.form==='10-K'&&!x.start&&x.val>0&&days(x.filed,x.end)<=120&&days(item.cut,x.end)<=450).sort((a,b)=>b.end.localeCompare(a.end)||a.filed.localeCompare(b.filed)||a.accn.localeCompare(b.accn));
  const a=anchors[0];
  const result={...item,source:'SEC_COMPANYFACTS',identityStatus:'HISTORICAL_STATIC_CIK_MATCH_ONLY',status:a?'EXTRACTED_PARTIAL':'ANNUAL_ANCHOR_UNAVAILABLE',anchor:a?{periodEnd:a.end,filed:a.filed,accn:a.accn}:null,fields:{},shares:null,marketCap:null,valuationReady:false};
  if(!a)return result;
  const specs=[['assets','Assets','USD',false],['liabilities','Liabilities','USD',false],['equity','StockholdersEquity','USD',false],['cash','CashAndCashEquivalentsAtCarryingValue','USD',false],['longDebt','LongTermDebt','USD',false],['revenue','RevenueFromContractWithCustomerExcludingAssessedTax','USD',true],['revenueAlt','Revenues','USD',true],['revenueNet','SalesRevenueNet','USD',true],['operatingIncome','OperatingIncomeLoss','USD',true],['netIncome','NetIncomeLoss','USD',true],['pretaxIncome','IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest','USD',true],['incomeTax','IncomeTaxExpense','USD',true],['cfo','NetCashProvidedByUsedInOperatingActivities','USD',true],['capex','PaymentsToAcquirePropertyPlantAndEquipment','USD',true],['eps','EarningsPerShareDiluted','USD/shares',true]];
  for(const [name,tag,unit,duration] of specs){
    const pick=prior=>{
      const eligible=facts('us-gaap',tag,unit).filter(x=>causal(x)&&x.form==='10-K'&&x.accn===a.accn&&x.filed===a.filed&&(prior?days(a.end,x.end)>=350&&days(a.end,x.end)<=380:x.end===a.end)&&(duration?date(x.start)&&days(x.end,x.start)>=350&&days(x.end,x.start)<=380:!x.start));
      const unique=[...new Set(eligible.map(x=>JSON.stringify([x.start??null,x.end,x.val])))];
      if(unique.length!==1)return null;
      const x=eligible[0];return {value:x.val,start:x.start??null,end:x.end,filed:x.filed,accn:x.accn,tag,unit};
    };
    result.fields[name]={current:pick(false),prior:pick(true)};
  }
  // These facts are not certified single-class outstanding shares. Preserve both tags,
  // never substitute diluted weighted averages, and do not calculate market cap here.
  for(const [tax,tag] of [['dei','EntityCommonStockSharesOutstanding'],['us-gaap','CommonStockSharesOutstanding']]){
    const candidates=facts(tax,tag,'shares').filter(x=>causal(x)&&['10-K','10-Q'].includes(x.form)&&!x.start&&Number.isSafeInteger(x.val)&&x.val>0&&days(item.cut,x.end)<=150).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed)||a.accn.localeCompare(b.accn));
    if(!candidates.length)continue;
    const x=candidates[0];const same=candidates.filter(y=>y.end===x.end&&y.filed===x.filed);
    if(new Set(same.map(y=>y.val)).size!==1)continue;
    result.shares={value:x.val,asOf:x.end,filed:x.filed,accn:x.accn,taxonomy:tax,tag,basis:'AS_REPORTED_CLASS_SCOPE_UNVERIFIED'};break;
  }
  return result;
}
function runCollectorSelfTest(){
  const item={ticker:'TEST',cik:'0000000001',cut:'2021-12-31',sector:'test'};
  const accn='0000000001-21-000001',base={end:'2020-12-31',filed:'2021-02-01',accn,form:'10-K'};
  const fact=(val,extra={})=>({...base,val,...extra});
  const annual=(val,extra={})=>fact(val,{start:'2020-01-01',...extra});
  const fixture={cik:1,facts:{'us-gaap':{Assets:{units:{USD:[fact(100),fact(90,{end:'2019-12-31'}),fact(999,{end:'2021-12-31',filed:'2022-02-01',accn:'0000000001-22-000001'})]}},OperatingIncomeLoss:{units:{USD:[annual(12),annual(8,{start:'2019-01-01',end:'2019-12-31'}),annual(999,{filed:'2022-02-01',accn:'0000000001-22-000001'})]}},EarningsPerShareDiluted:{units:{'USD/shares':[annual(2),annual(3)]}}},dei:{EntityCommonStockSharesOutstanding:{units:{shares:[fact(5,{end:'2021-10-01',filed:'2021-11-01',form:'10-Q',accn:'0000000001-21-000002'})]}}}}};
  const r=extractAnnualFacts(item,fixture);
  const checks=[r.anchor.periodEnd==='2020-12-31',r.fields.assets.current.value===100,r.fields.assets.prior.value===90,r.fields.operatingIncome.current.value===12,r.fields.operatingIncome.prior.value===8,r.fields.eps.current===null,r.fields.cfo.current===null,r.shares.value===5,r.shares.basis==='AS_REPORTED_CLASS_SCOPE_UNVERIFIED',r.marketCap===null&&r.valuationReady===false];
  let bad=false;try{extractAnnualFacts({...item,cik:'0000000002'},fixture)}catch(e){bad=e.message==='CIK_OR_CUTOFF_MISMATCH'}checks.push(bad);
  if(checks.some(x=>!x))throw Error('COLLECTOR_SELF_TEST_FAIL');return {status:'PASS',checks:checks.length,fixture:'SYNTHETIC_TEST_ONLY'};
}

async function collectFundamentals() {
  const { mkdir, writeFile, access } = await import('node:fs/promises');
  const dir='.runtime/historical-valuation-basis';
  const output=dir+'/sec-fundamentals-consumed-cohorts.json';
  const ua=(process.env.SEC_EDGAR_USER_AGENT??'').trim();
  if(!/\S+@\S+\.\S+/.test(ua))throw Error('SEC_EDGAR_USER_AGENT_REQUIRED: use existing declared contact');
  if(COHORT.length!==80||new Set(COHORT.map(x=>x.ticker)).size!==80)throw Error('COHORT_INVALID');
  runSelfTest();runCollectorSelfTest();
  await mkdir(dir,{recursive:true});
  if(await access(output).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('OUTPUT_EXISTS: preserve prior evidence');
  const rows=[];let stop=null, consecutiveNetworkFailures=0;
  for(const item of COHORT){
    if(stop){rows.push({...item,status:'NOT_ATTEMPTED',reason:stop});continue;}
    let response;
    try{
      response=await fetch('https://data.sec.gov/api/xbrl/companyfacts/CIK'+item.cik+'.json',{headers:{'User-Agent':ua,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
      consecutiveNetworkFailures=0;
      if(!response.ok){
        rows.push({...item,status:'HTTP_ERROR',httpStatus:response.status});
        if([401,403,429].includes(response.status))stop='SEC_ACCESS_OR_RATE_LIMIT';
      }else rows.push(extractAnnualFacts(item,await response.json()));
    }catch(e){
      rows.push({...item,status:'FETCH_OR_PARSE_ERROR',reason:e.message==='CIK_OR_CUTOFF_MISMATCH'?e.message:'FETCH_OR_PARSE_FAILED'});
      if(!response&&++consecutiveNetworkFailures>=2)stop='NETWORK_UNAVAILABLE';
    }
    if(!stop)await new Promise(resolve=>setTimeout(resolve,300));
  }
  const counts=rows.reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{});
  const report={schemaVersion:1,study:'CONSUMED_COHORT_FUNDAMENTAL_COVERAGE_ONLY',productionAuthority:false,source:'SEC_COMPANYFACTS',membershipSource:'lawcal/sp500-components-history@2e59b86998a119d68e377f9f98aa7a816cfc7d5b:6a865618173f322ecda9a569bc6bd48edcfaf996',generatedAt:new Date().toISOString(),outcomesAccessed:false,coverageCertified:false,valuationReady:false,counts,rows};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,counts,valuationReady:false,stop},null,2));
  if(stop||counts.EXTRACTED_PARTIAL!==80)process.exitCode=2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try{
    if(process.argv[2]==='--self-test')console.log(JSON.stringify({basis:runSelfTest(),collector:runCollectorSelfTest()},null,2));
    else if(process.argv[2]==='--collect-fundamentals')await collectFundamentals();
    else {console.error('Use --self-test or --collect-fundamentals. No replay.');process.exitCode=2;}
  }catch(e){console.error(e.message);process.exitCode=2;}
}
