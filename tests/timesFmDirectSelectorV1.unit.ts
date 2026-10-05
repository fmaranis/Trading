import assert from 'node:assert/strict';
import {
  TIMESFM_DIRECT_SELECTOR_V1,
  selectTimesFmDirectWinnerV1
} from '../src/investment/decision/timesFmDirectSelectorV1';

assert.equal(TIMESFM_DIRECT_SELECTOR_V1.version,'TIMESFM_DIRECT_SELECTOR_V1');
assert.equal(TIMESFM_DIRECT_SELECTOR_V1.productionAuthority,false);
assert.equal(TIMESFM_DIRECT_SELECTOR_V1.executionAuthority,false);
assert.equal(TIMESFM_DIRECT_SELECTOR_V1.sizingMode,'FULL_SHADOW_EQUITY_TO_SELECTED_ASSET');
assert.deepEqual(TIMESFM_DIRECT_SELECTOR_V1.primaryHorizons,[20,60]);

const coreWins=selectTimesFmDirectWinnerV1([
  {assetId:'CORE',predictedRelativeReturn20Pct:0,predictedRelativeReturn60Pct:0},
  {assetId:'A',predictedRelativeReturn20Pct:-2,predictedRelativeReturn60Pct:-1},
  {assetId:'B',predictedRelativeReturn20Pct:-1,predictedRelativeReturn60Pct:-3}
]);
assert.equal(coreWins.assetId,'CORE','core must win naturally when every candidate forecast is inferior');

const candidateWins=selectTimesFmDirectWinnerV1([
  {assetId:'CORE',predictedRelativeReturn20Pct:0,predictedRelativeReturn60Pct:0},
  {assetId:'A',predictedRelativeReturn20Pct:5,predictedRelativeReturn60Pct:2},
  {assetId:'B',predictedRelativeReturn20Pct:1,predictedRelativeReturn60Pct:4}
]);
assert.equal(candidateWins.assetId,'A','winner must come from TimesFM 20/60 ordinal evidence only');

const tied=selectTimesFmDirectWinnerV1([
  {assetId:'CORE',predictedRelativeReturn20Pct:0,predictedRelativeReturn60Pct:0},
  {assetId:'A',predictedRelativeReturn20Pct:4,predictedRelativeReturn60Pct:1},
  {assetId:'B',predictedRelativeReturn20Pct:1,predictedRelativeReturn60Pct:4}
]);
assert.equal(tied.assetId,'A','exact TimesFM ties use deterministic assetId after equal mean forecast');

assert.throws(()=>selectTimesFmDirectWinnerV1([]),/EMPTY_EVIDENCE/);
assert.throws(()=>selectTimesFmDirectWinnerV1([
  {assetId:'A',predictedRelativeReturn20Pct:1,predictedRelativeReturn60Pct:2},
  {assetId:'A',predictedRelativeReturn20Pct:3,predictedRelativeReturn60Pct:4}
]),/INVALID_OR_DUPLICATE_ASSET/);

console.log('timesFmDirectSelectorV1.unit: PASS');
