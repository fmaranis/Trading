import assert from 'node:assert/strict';
import { validateKronosCheckpointData } from '../server/researchValidationRoutes';

const close=Array.from({length:60},(_,i)=>100+i*0.1);
const base={
  version:'KRONOS_STAGE_B_DIAGNOSTIC_V1',
  completed:{
    '2018Q1':[{assetId:'SXR8',horizons:{'20':{medianReturnPct:1},'60':{medianReturnPct:2}}}]
  },
  partial:{
    '2018Q2':{forecasts:{EUNL:[close,...Array(19).fill(null)]},torchRngState:[0,1,2]}
  }
};
function check(value:unknown):void{
  validateKronosCheckpointData(value as Record<string,any>);
}
assert.doesNotThrow(()=>check(base));
assert.doesNotThrow(()=>check({...base,partial:{'2018Q2':{forecasts:{EUNL:Array(20).fill(null)}}}}),'Legacy checkpoints without RNG state stay valid');
assert.throws(()=>check({...base,partial:{'2017Q4':base.partial['2018Q2']}}),/INVALID_PARTIAL/);
assert.throws(()=>check({...base,partial:{'2018Q2':{forecasts:{EUNL:[...Array(20).fill(close),close]}}}}),/INVALID_PATHS/);
assert.throws(()=>check({...base,partial:{'2018Q2':{forecasts:{EUNL:[[-1,...close.slice(1)],...Array(19).fill(null)]}}}}),/INVALID_PATHS/);
assert.throws(()=>check({...base,partial:{'2018Q2':{forecasts:{EUNL:[Array(60).fill(NaN),...Array(19).fill(null)]}}}}),/INVALID_PATHS/);
assert.throws(()=>check({...base,completed:{'2018Q1':[{assetId:'SXR8',horizons:{'20':{}}}]}}),/INVALID_COMPLETED/);
assert.throws(()=>check({...base,partial:{'2018Q2':{forecasts:{EUNL:Array(20).fill(null)},torchRngState:[256]}}}),/INVALID_RNG/);
console.log('kronosStageBCheckpointBehavior.unit: PASS');
