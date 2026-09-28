import assert from 'node:assert/strict';
import {buildPrimaryMonthlySignals,buildMomentumMonthlySignals,addExecutionDates,voteWeights,score52w} from '../scripts/sector52WeekHighLeadershipV1Protocol.mjs';

const sectors=['XLB','XLE','XLF','XLI','XLK','XLP','XLU','XLV','XLY'];
const dates=[];for(let i=0;i<700;i++){const d=new Date(Date.UTC(2010,0,1+i));dates.push(d.toISOString().slice(0,10));}
const series={};for(let k=0;k<sectors.length;k++)series[sectors[k]]=dates.map((date,i)=>({date,open:100+i*(1+k/1000),close:100+i*(1+k/1000)}));
const p=buildPrimaryMonthlySignals(series,sectors);assert.ok(p.length>6);
const cutoffDate=p.at(-3).signalDate;
const prefSeries=Object.fromEntries(Object.entries(series).map(([s,b])=>[s,b.filter(row=>row.date<=cutoffDate)]));
const pref=buildPrimaryMonthlySignals(prefSeries,sectors);
assert.deepEqual(pref.map(x=>({d:x.signalDate,s:x.selected,w:x.weights})),p.filter(x=>x.signalDate<=cutoffDate).map(x=>({d:x.signalDate,s:x.selected,w:x.weights})));
const cal=dates;const e=addExecutionDates(p,cal);assert.ok(e.every(x=>x.executionDate>x.signalDate));
const m=buildMomentumMonthlySignals(series,sectors);assert.ok(m.length>0);
const w=voteWeights(Array(6).fill(['XLB','XLE','XLF']));assert.equal(w.XLB,1/3);
const bars=series.XLB;const before=score52w(bars,300);const mutated=[...bars,{date:'2099-01-01',open:1e9,close:1e9}];assert.equal(before,score52w(mutated,300));
console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_CAUSAL_PASS');
