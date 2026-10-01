import assert from 'node:assert/strict';
import {
  PEAD_SIGNAL_V1,
  signalEventsFromR3,
  parseYahooPricePayload,
  resolveEventOutcome,
  averageRanks,
  spearman,
  permuteSurprisesWithinReportWeek,
  permutationPValues,
  quintileGroups,
  evaluateDiagnostic
} from '../scripts/peadSignalDiagnosticV1.mjs';

function isoDays(start,count){
  const base=Date.parse(start+'T00:00:00Z');
  return Array.from({length:count},(_,i)=>new Date(base+i*86400000).toISOString().slice(0,10));
}
function bars(start,count,base=100,step=1){
  return isoDays(start,count).map((date,i)=>({date,adjustedOpen:base+i*step,adjustedClose:base+i*step}));
}

const stock=bars('2024-02-01',70,100,1);
const spy=bars('2024-02-01',70,100,0);

const nextSession=resolveEventOutcome(
  {ticker:'AAA',reportDate:'2024-02-01',surprise:20},
  stock,spy
);
assert.equal(nextSession.entryDate,'2024-02-02');
assert.equal(nextSession.exitDate,stock[61].date);
assert.notEqual(nextSession.entryDate,'2024-02-01');
assert.ok(Math.abs(nextSession.stockReturn60-((161/101)-1))<1e-12);

const payload=JSON.stringify({
  chart:{result:[{
    timestamp:[1706745600,1706832000,1706918400,1707004800,1707091200,1707177600,1707264000,1707350400,1707436800,1707523200,1707609600,1707696000,1707782400,1707868800,1707955200,1708041600,1708128000,1708214400,1708300800,1708387200,1708473600,1708560000,1708646400,1708732800,1708819200,1708905600,1708992000,1709078400,1709164800,1709251200,1709337600,1709424000,1709510400,1709596800,1709683200,1709769600,1709856000,1709942400,1710028800,1710115200,1710201600,1710288000,1710374400,1710460800,1710547200,1710633600,1710720000,1710806400,1710892800,1710979200,1711065600,1711152000,1711238400,1711324800,1711411200,1711497600,1711584000,1711670400,1711756800,1711843200,1711929600,1712016000],
    indicators:{
      quote:[{open:Array(62).fill(100),close:Array(62).fill(100)}],
      adjclose:[{adjclose:Array(62).fill(100)}]
    }
  }],error:null}
});
const parsed=parseYahooPricePayload('AAA',payload);
assert.equal(parsed.length,62);
assert.equal(parsed[0].adjustedOpen,100);

assert.deepEqual(averageRanks([10,20,20,40]),[1,2.5,2.5,4]);
assert.ok(spearman([1,2,3,4],[10,20,30,40])>0.999999);
const permuted=permuteSurprisesWithinReportWeek([
  {ticker:'A',reportDate:'2024-02-01',surprise:1,excessReturn60:1},
  {ticker:'B',reportDate:'2024-02-01',surprise:2,excessReturn60:2},
  {ticker:'C',reportDate:'2024-02-20',surprise:3,excessReturn60:3},
  {ticker:'D',reportDate:'2024-02-20',surprise:4,excessReturn60:4}
],()=>0);
assert.deepEqual(permuted.slice(0,2).map(row=>row.surprise).sort((a,b)=>a-b),[1,2]);
assert.deepEqual(permuted.slice(2,4).map(row=>row.surprise).sort((a,b)=>a-b),[3,4]);

function outcome(i,reverse=false){
  const surprise=i-210;
  const excess=(reverse?-1:1)*surprise/10000+0.001;
  return {ticker:'T'+i,reportDate:'2024-02-01',surprise,excessReturn60:excess};
}

const positive=Array.from({length:420},(_,i)=>outcome(i,false));
const pass=evaluateDiagnostic(positive,461);
assert.equal(pass.status,'PASS_SIGNAL_DIAGNOSTIC_CANDIDATE_FOR_FRESH_CONFIRMATION');
assert.equal(pass.passed,true);
assert.equal(pass.gates.positiveSpearman,true);
assert.equal(pass.gates.significantSpearman,true);
assert.equal(pass.gates.positiveExtremeSpread,true);
assert.equal(pass.gates.significantExtremeSpread,true);
assert.ok(pass.metrics.permutation.spearmanP<0.05);
assert.ok(pass.metrics.permutation.extremeSpreadP<0.05);
assert.equal(pass.gates.positiveLongSide,true);
assert.equal(pass.gates.longSideHitRate,true);
assert.deepEqual(pass.metrics.quintileCounts,[84,84,84,84,84]);

const reversed=Array.from({length:420},(_,i)=>outcome(i,true));
const fail=evaluateDiagnostic(reversed,461);
assert.equal(fail.status,'FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY');
assert.equal(fail.passed,false);
assert.equal(fail.gates.positiveSpearman,false);
assert.equal(fail.gates.significantSpearman,false);

const insufficient=evaluateDiagnostic(positive.slice(0,414),461);
assert.equal(insufficient.status,'INCONCLUSIVE_SIGNAL_DATA_COVERAGE');
assert.equal(insufficient.gates.priceCoverage,false);

const r3Events=Array.from({length:440},(_,i)=>({
  ticker:'R'+String(i).padStart(3,'0'),
  reportDate:'2024-02-'+String(1+(i%20)).padStart(2,'0'),
  timingDiagnostic:'UNKNOWN',
  rawTiming:'TAS',
  surprisePct:i-220
}));
const r3Source={
  study:'PEAD_EARNINGS_SOURCE_AUDIT_R3',
  sourceRevision:'YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION',
  status:'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R3',
  audit:{passed:true},
  priceOutcomesFetched:false,
  economicOutcomesOpened:false,
  causalEvents:r3Events
};
const events=signalEventsFromR3(r3Source);
assert.equal(events.length,440);
assert.equal(events[0].ticker,'R000');
assert.equal(events[0].surprise,-220);
assert.equal(Object.hasOwn(events[0],'timing'),false);
await assert.rejects(
  async()=>signalEventsFromR3({...r3Source,status:'INCONCLUSIVE_SOURCE_CAUSALITY_R3'}),
  /PEAD_SIGNAL_R3_SOURCE_NOT_READY/
);
await assert.rejects(
  async()=>signalEventsFromR3({...r3Source,causalEvents:r3Events.slice(0,439)}),
  /PEAD_SIGNAL_R3_SOURCE_EVENT_COUNT/
);

const mapped=resolveEventOutcome(
  {ticker:'AAA',reportDate:'2024-02-01',surprise:12.5},
  stock,spy
);
assert.equal(mapped.surprise,12.5);
assert.equal(mapped.entryDate,'2024-02-02');

assert.equal(PEAD_SIGNAL_V1.horizonSessions,60);
assert.equal(PEAD_SIGNAL_V1.minimumSourceEvents,440);
assert.equal(PEAD_SIGNAL_V1.minimumAbsolutePriceCoverage,415);
assert.equal(PEAD_SIGNAL_V1.minimumPriceCoveragePct,90);
assert.equal(PEAD_SIGNAL_V1.permutationIterations,2000);
assert.equal(PEAD_SIGNAL_V1.permutationSeed,20260929);
assert.equal(PEAD_SIGNAL_V1.maximumOneSidedPValue,0.05);
assert.equal(PEAD_SIGNAL_V1.productionDefault,'LEGACY');
assert.equal(PEAD_SIGNAL_V1.productionAuthority,false);

console.log('PEAD_ANALYST_SURPRISE_V1_UNIT_PASS');
