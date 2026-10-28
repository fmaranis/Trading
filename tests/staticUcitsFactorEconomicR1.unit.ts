import assert from 'node:assert/strict';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

const dates=['2020-01-02','2020-01-03','2020-01-06','2020-01-07','2020-01-08','2020-01-09'];
const tickers=['EUNL','HOLDOUT_XDEM','HOLDOUT_XDEQ','HOLDOUT_XDEV'] as const;
const catalog: AssetUniverseItem[]=tickers.map((id,i)=>({
  assetId:id,ticker:'ETF'+i+'.DE',name:'Fixture '+id,
  currency:'EUR',category:'GLOBAL_EQUITY',instrumentType:'ETF_ETC'
}));
function dataset(terminalMultiplier=1):MultiAssetDataset {
  return {
    timeframe:'1d',
    assets:tickers.map((assetId,i)=>{
      const start=53+i*4;
      return {assetId,ticker:'ETF'+i+'.DE',name:'Fixture '+assetId,currency:'EUR',
        provenance:{sourceType:'SYNTHETIC' as const,provider:'DETERMINISTIC_UNIT_FIXTURE',
          isReproducible:true,seed:i},
        bars:dates.map((d,j)=>{
          const px=(start+j*(i===2?-0.6:1.5))*(j===dates.length-1?terminalMultiplier:1);
          return {timestamp:d+'T00:00:00Z',open:px,close:px,high:px*1.001,low:px*0.999,volume:1000};
        })
      };
    })
  };
}
function run(input:Partial<Parameters<typeof DynamicHistoricalReplayEngine.run>[0]>={}){
 return DynamicHistoricalReplayEngine.run({
   dataset:dataset(),catalog,startDate:dates[0],
   initialCapitalEur:13000,riskProfile:'MEDIUM',horizonYears:5,
   cashBenchmarkMode:'FIXED_USER_RATE',cashBenchmarkAnnualPct:0,
   simulationMode:'HOLD_ONLY',externalCashFlows:[],
   researchStaticBuyHold:{targetWeights:{
     EUNL:0.5,HOLDOUT_XDEM:1/6,HOLDOUT_XDEQ:1/6,HOLDOUT_XDEV:1/6
   },slippagePct:0.1,liquidateAtEnd:true},
   ...input
 });
}
const result=run();
assert.equal(result.executedBuys,4);
assert.equal(result.executedExits,4);
assert.equal(result.decisions,0);
assert.ok(result.totalFeesEur>0);
assert.ok(result.finalValueEur>0);
assert.ok(result.totalEstimatedTaxEur>=0);
assert.ok(result.equityPath.length>=dates.length);
assert.ok(result.signals.every(s=>s.executed&&Number.isInteger(Math.abs(s.unitsDelta))
  &&s.executionDate!==null&&s.executionDate>s.signalDate));
const buy=result.signals.filter(s=>s.action==='BUY');
assert.ok(buy.every(s=>s.signalDate===dates[0]&&s.executionDate===dates[1]));
const exits=result.signals.filter(s=>s.action==='EXIT');
assert.ok(exits.every(s=>s.signalDate===dates[dates.length-2]&&s.executionDate===dates.at(-1)));
assert.ok(result.equityPath.at(-1));
assert.ok(Math.abs(result.equityPath.at(-1)!.equityEur-result.finalValueEur)<0.02);
const shifted=run({dataset:dataset(3)});
assert.deepEqual(
  shifted.signals.filter(s=>s.action==='BUY').map(s=>({shares:s.unitsDelta,executionPrice:s.executionPriceEur})),
  buy.map(s=>({shares:s.unitsDelta,executionPrice:s.executionPriceEur})),
  'future-only price changes must not affect causal initial orders');
assert.throws(()=>run({researchStaticBuyHold:{
  targetWeights:{EUNL:1,HOLDOUT_XDEM:0.2},slippagePct:0.1,liquidateAtEnd:true
}}),/INVALID_FROZEN_POLICY/);
assert.throws(()=>run({simulationMode:'CUSTODIA_ENGINE'}),/REPLAY_STATIC_BUY_HOLD_REQUIRES/);
assert.throws(()=>run({externalCashFlows:[{id:'ext',date:dates[2],amountEur:100,label:'test'}]}),/REPLAY_STATIC_BUY_HOLD_REQUIRES/);
assert.throws(()=>run({initialPortfolio:{source:'MANUAL',cashEur:0,
  allocations:[{assetId:'EUNL',amountEur:13000}]}}),/REPLAY_STATIC_BUY_HOLD_REQUIRES/);
assert.throws(()=>run({initialCapitalEur:50}),/UNEXECUTABLE_WHOLE_SHARES/);
const legacy=DynamicHistoricalReplayEngine.run({
  dataset:dataset(),catalog,startDate:dates[0],initialCapitalEur:13000,
  riskProfile:'MEDIUM',horizonYears:5,cashBenchmarkMode:'FIXED_USER_RATE',cashBenchmarkAnnualPct:0,
  simulationMode:'HOLD_ONLY',
  initialPortfolio:{source:'MANUAL',cashEur:0,allocations:[{assetId:'EUNL',amountEur:13000}]}
});
assert.equal(legacy.totalFeesEur,0,'existing user-held portfolio semantics unchanged');
assert.equal(legacy.executedBuys,0);
assert.ok(!Number.isInteger(legacy.signals[0].unitsDelta),'legacy stored positions may be fractional; no opt-in must change this');
assert.equal(legacy.equityPath[0].date,dates[0]);
console.log('STATIC_UCITS_FACTOR_ECONOMIC_R1_EXECUTION_GUARD_PASS',JSON.stringify({
  nextOpen:true,wholeShares:true,brokerFees:true,exitTax:true,
  futureCausality:true,legacyParity:true,syntheticFixturesOnly:true,realOutcomesOpened:false
}));
