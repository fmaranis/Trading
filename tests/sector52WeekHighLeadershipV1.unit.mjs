import assert from 'node:assert/strict';
import {score52w,selectTop,voteWeights,rebalanceAtOpen,liquidateAtOpen,metrics,bootstrapMean} from '../scripts/sector52WeekHighLeadershipV1Protocol.mjs';

const bars=Array.from({length:260},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),open:i+1,close:i+1}));
assert.equal(score52w(bars,251),1);
bars[251].close=250; assert.equal(score52w(bars,251),250/251);
assert.deepEqual(selectTop({XLE:1,XLB:1,XLK:.9},2),['XLB','XLE']);
const w=voteWeights([['XLB','XLE','XLF'],['XLB','XLE','XLK'],['XLB','XLK','XLI'],['XLB','XLV','XLY'],['XLB','XLU','XLP'],['XLB','XLE','XLK']]);
assert.ok(Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)<1e-12);
assert.equal(w.XLB,1/3);
const entry=rebalanceAtOpen({shares:{},cash:1},{A:.6,B:.4},{A:10,B:20},20);
assert.ok(entry.equity<1 && entry.equity>0.99);
const exit=liquidateAtOpen(entry,{A:11,B:18},20); assert.ok(exit.equity>0);
const m=metrics([1,1.01,1.02,1.00,1.05]); assert.ok(m.maxDrawdownPct<0);
const b=bootstrapMean([.01,.02,-.01,.03],{block:2,reps:20,seed:20260928}); assert.ok(Number.isFinite(b.lower95));
console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_UNIT_PASS');
