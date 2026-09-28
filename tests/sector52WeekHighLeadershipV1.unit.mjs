import assert from 'node:assert/strict';
import {
  score52w,selectTop,voteWeights,rebalanceAtOpen,liquidateAtOpen,metrics,bootstrapMean,
  bootstrapJointExcess,descriptiveTechnicals,firstDateOnOrAfter
} from '../scripts/sector52WeekHighLeadershipV1Protocol.mjs';

const bars=Array.from({length:300},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),open:i+1,close:i+1}));
assert.equal(score52w(bars,251),1);
bars[251].close=250; assert.equal(score52w(bars,251),250/251);
assert.deepEqual(selectTop({XLE:1,XLB:1,XLK:.9},2),['XLB','XLE']);
const w=voteWeights([['XLB','XLE','XLF'],['XLB','XLE','XLK'],['XLB','XLK','XLI'],['XLB','XLV','XLY'],['XLB','XLU','XLP'],['XLB','XLE','XLK']]);
assert.ok(Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)<1e-12);
assert.equal(w.XLB,1/3);

const entry=rebalanceAtOpen({shares:{},cash:1},{A:.6,B:.4},{A:10,B:20},20);
assert.ok(entry.equity<1 && entry.equity>0.99);
const exit=liquidateAtOpen(entry,{A:11,B:18},20); assert.ok(exit.equity>0);

const rotated=rebalanceAtOpen(
  {shares:{A:0.05,B:0.025},cash:0},
  {B:.5,C:.5},
  {A:11,B:18,C:25},
  20
);
assert.ok(Number.isFinite(rotated.equity) && rotated.equity>0);
assert.ok(Number.isFinite(rotated.cost) && rotated.cost>0);
assert.equal(rotated.shares.A,undefined);
assert.ok((rotated.shares.B??0)>0 && (rotated.shares.C??0)>0);
assert.throws(
  ()=>rebalanceAtOpen({shares:{A:0.05},cash:0},{B:1},{B:18},20),
  /REBALANCE_OPEN_MISSING_OR_INVALID:A/
);

const m=metrics([1,1.01,1.02,1.00,1.05],['2020-01-02','2020-04-02','2020-07-02','2020-10-02','2021-01-04']);
assert.ok(m.maxDrawdownPct<0);
assert.ok(m.years>.99 && m.years<1.01);

const b=bootstrapMean([.01,.02,-.01,.03],{block:2,reps:20,seed:20260928}); assert.ok(Number.isFinite(b.lower95));
const joint=bootstrapJointExcess(
  Array(36).fill(.02),
  Array(36).fill(.01),
  Array(36).fill(.005),
  {block:12,reps:100,seed:20260928}
);
assert.ok(joint.lowerOneSided95PctPoints>0);

const trendBars=Array.from({length:253},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),open:100+i,close:100+i}));
const tech=descriptiveTechnicals(trendBars,252);
assert.equal(tech.breakout20,true);
assert.equal(tech.breakout252,true);
assert.ok((tech.slope20AnnualizedPct??0)>0);
assert.ok((tech.slope60AnnualizedPct??0)>0);
assert.ok((tech.slope120AnnualizedPct??0)>0);

assert.equal(firstDateOnOrAfter(['2018-12-31','2019-01-02','2019-01-03'],'2019-01-01'),'2019-01-02');
assert.throws(()=>firstDateOnOrAfter(['2018-12-31'],'2019-01-01'),/BOUNDARY_MISSING/);

console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_UNIT_PASS');
