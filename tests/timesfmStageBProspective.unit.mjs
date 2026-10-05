import assert from 'node:assert/strict';
import {
  TIMESFM_STAGE_B_PROSPECTIVE_METHODOLOGY as M,
  createEmptyTimesFmProspectiveState,
  markTimesFmProspectiveOpened,
  appendTimesFmProspectiveAnchor,
  verifyTimesFmProspectiveState
} from '../scripts/timesfmStageBProspectiveProtocol.mjs';
import { selectProspectiveAnchor, isoWeekKey, buildProspectiveCases, materializeForecastCases, selectDirectTimesFmWinner } from '../scripts/timesfmStageBProspectiveCollectorLive.mjs';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P } from '../scripts/timesfmStageBProtocol.mjs';

assert.equal(M.startAfter,'2026-10-05');
assert.equal(M.cadence,'WEEKLY_FIRST_COMMON_TRADING_SESSION');
assert.equal(M.minimumMaturedAnchors,26);
assert.equal(M.collection.noHistoricalCatchUp,true);
assert.equal(M.collection.noRetroactiveForecastAfterFirstCommonSessionPassed,true);
assert.equal(M.collection.futureOutcomeAccess,false);
assert.equal(M.productionDefault,'LEGACY');
assert.equal(M.productionAuthority,false);
assert.equal(M.economicShadow.version,'TIMESFM_DIRECT_SELECTOR_V1');
assert.equal(M.economicShadow.status,'FROZEN_BEFORE_FIRST_PROSPECTIVE_ANCHOR');
assert.equal(M.economicShadow.role,'DIRECT_ASSET_SELECTOR_SHADOW');
assert.equal(M.economicShadow.candidatePool,'8_STAGE_B_ASSETS_PLUS_EUNL_CORE');
assert.equal(M.economicShadow.rule,'LOWEST_MEAN_ORDINAL_RANK_20_60');
assert.equal(M.economicShadow.structuralCoreRelativeForecastPct,0);
assert.equal(M.economicShadow.target,'100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET');
assert.deepEqual(M.economicShadow.comparisonArms,['LEGACY_APP','EUNL_CORE_DIRECT']);
assert.equal(isoWeekKey('2026-10-12'),'2026-W42');

assert.deepEqual(selectProspectiveAnchor(['2026-10-05'],'2026-10-05',20),{status:'WAITING_START',informationDate:null,isoWeek:null});
assert.equal(selectProspectiveAnchor(['2026-10-12'],'2026-10-12',17).status,'WAITING_SESSION_CLOSE');
assert.equal(selectProspectiveAnchor(['2026-10-12'],'2026-10-12',18).status,'READY');
assert.equal(selectProspectiveAnchor(['2026-10-12'],'2026-10-13',9).status,'READY');
assert.equal(selectProspectiveAnchor(['2026-10-12','2026-10-13'],'2026-10-13',20).status,'MISSED_WEEK_NO_RETROACTIVE_FORECAST');

let state=createEmptyTimesFmProspectiveState('2026-10-10T00:00:00Z');
verifyTimesFmProspectiveState(state);
state=markTimesFmProspectiveOpened(state,'2026-10-10T00:00:00Z');
const dummyCases=P.assets.map(asset=>({caseId:'2026-10-12|'+asset.assetId,assetId:asset.assetId,ticker:asset.ticker}));
const dummyDirectShadow={
  policyVersion:'TIMESFM_DIRECT_SELECTOR_V1',
  selectedAssetId:P.core.assetId,
  selectedTicker:P.core.ticker,
  selectedIsStructuralCore:true,
  rank20:1,
  rank60:1,
  meanOrdinalRank:1,
  meanPredictedRelativeReturnPct:0,
  predictedRelativeReturn20Pct:0,
  predictedRelativeReturn60Pct:0
};
state=appendTimesFmProspectiveAnchor(state,{
  id:'2026-10-12',isoWeek:'2026-W42',informationDate:'2026-10-12',collectedAt:'2026-10-12T17:00:00Z',
  dataProvenance:'REAL',provider:'YAHOO_FINANCE',contextStartDate:'2024-10-01',contextEndDate:'2026-10-12',
  contextLength:512,forecastHorizon:60,payloadFingerprintSha256:'a'.repeat(64),sourceManifest:{},remoteModel:{},remoteRuntime:{},
  cases:dummyCases,directShadow:dummyDirectShadow,outcomesOpened:false,productionDefault:'LEGACY',productionAuthority:false
},'2026-10-12T17:00:01Z');
assert.equal(state.anchorCount,1);
assert.equal(state.lastInformationDate,'2026-10-12');
verifyTimesFmProspectiveState(state);
assert.throws(()=>appendTimesFmProspectiveAnchor(state,{...state.anchors[0],previousObservationHashSha256:undefined,observationHashSha256:undefined},'2026-10-12T18:00:00Z'),/DUPLICATE_ANCHOR/);

const dates=Array.from({length:520},(_,i)=>{
  const d=new Date(Date.UTC(2024,0,2+i));
  return d.toISOString().slice(0,10);
});
const series={};
for(const [idx,item] of [P.core,...P.assets].entries()){
  series[item.ticker]=dates.map((date,i)=>({date,close:100+i*(0.1+idx*0.005)}));
}
const info=dates.at(-1);
const built=buildProspectiveCases(series,info);
assert.equal(built.cases.length,8);
assert.equal(built.contextDates.length,512);
assert.ok(built.cases.every(row=>row.assetContext.length===512&&row.coreContext.length===512));
assert.ok(built.cases.every(row=>!JSON.stringify({caseId:row.caseId,assetContext:row.assetContext,coreContext:row.coreContext}).toLowerCase().includes('future')));

const remote={cases:built.cases.map(row=>({
  caseId:row.caseId,
  mvAssetPoint:{'1':row.assetContextLast+0.1,'5':row.assetContextLast+0.5,'20':row.assetContextLast+2,'60':row.assetContextLast+6},
  mvCorePoint:{'1':row.coreContextLast+0.05,'5':row.coreContextLast+0.25,'20':row.coreContextLast+1,'60':row.coreContextLast+3},
  uvAssetPoint:{'1':row.assetContextLast+0.08,'5':row.assetContextLast+0.4,'20':row.assetContextLast+1.6,'60':row.assetContextLast+5},
  mvAssetQuantiles:Object.fromEntries(P.evaluationHorizons.map(h=>[String(h),Array.from({length:9},(_,q)=>row.assetContextLast+(q-4)*0.2+h*0.05)])),
  mvAssetPath60:Array.from({length:60},(_,i)=>row.assetContextLast+(i+1)*0.1)
}))};
const materialized=materializeForecastCases(built,remote);
assert.equal(materialized.length,8);
assert.ok(materialized.every(row=>Number.isFinite(row.mvPredRelativeReturnPct['60'])));
assert.ok(materialized.every(row=>row.contextFingerprintSha256.length===64));
const direct=selectDirectTimesFmWinner(materialized);
assert.equal(direct.policyVersion,'TIMESFM_DIRECT_SELECTOR_V1');
assert.ok(direct.selectedAssetId);
assert.ok(Number.isFinite(direct.meanOrdinalRank));
assert.ok(Number.isFinite(direct.predictedRelativeReturn20Pct));
assert.ok(Number.isFinite(direct.predictedRelativeReturn60Pct));

console.log('timesfmStageBProspective.unit: PASS');
