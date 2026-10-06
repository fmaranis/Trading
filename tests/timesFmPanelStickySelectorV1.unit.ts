import assert from 'node:assert/strict';
import {
  TIMESFM_PANEL_STICKY_SELECTOR_V1 as P,
  selectTimesFmPanelStickyV1,
  selectTimesFmPanelNaiveTop1V1
} from '../src/investment/decision/timesFmPanelStickySelectorV1';

const rows = [
  {assetId:'EUNL',predictedRelativeReturn60Pct:0},
  {assetId:'SXR8',predictedRelativeReturn60Pct:3},
  {assetId:'EQQQ',predictedRelativeReturn60Pct:2},
  {assetId:'EXSA',predictedRelativeReturn60Pct:1},
  {assetId:'IS3N',predictedRelativeReturn60Pct:-1}
];

assert.equal(P.entryRank,1);
assert.equal(P.incumbentRetentionRank,3);
assert.equal(P.relativeReturnFloorPct,0);
assert.equal(P.executionSemantics,'NEXT_OPEN');
assert.equal(P.productionAuthority,false);

const first=selectTimesFmPanelStickyV1(rows,null);
assert.equal(first.selectedAssetId,'SXR8');
assert.equal(first.reason,'ENTER_TOP1');
assert.equal(first.switched,true);

const retained=selectTimesFmPanelStickyV1([
  {assetId:'EUNL',predictedRelativeReturn60Pct:0},
  {assetId:'SXR8',predictedRelativeReturn60Pct:1},
  {assetId:'EQQQ',predictedRelativeReturn60Pct:3},
  {assetId:'EXSA',predictedRelativeReturn60Pct:2},
  {assetId:'IS3N',predictedRelativeReturn60Pct:-1}
],'SXR8');
assert.equal(retained.selectedAssetId,'SXR8');
assert.equal(retained.selectedRank60,3);
assert.equal(retained.reason,'RETAIN_TOP3_BUFFER');
assert.equal(retained.switched,false);

const switched=selectTimesFmPanelStickyV1([
  {assetId:'EUNL',predictedRelativeReturn60Pct:0},
  {assetId:'SXR8',predictedRelativeReturn60Pct:-0.1},
  {assetId:'EQQQ',predictedRelativeReturn60Pct:3},
  {assetId:'EXSA',predictedRelativeReturn60Pct:2},
  {assetId:'IS3N',predictedRelativeReturn60Pct:1}
],'SXR8');
assert.equal(switched.selectedAssetId,'EQQQ');
assert.equal(switched.reason,'ENTER_TOP1');
assert.equal(switched.switched,true);

const fallback=selectTimesFmPanelStickyV1([
  {assetId:'EUNL',predictedRelativeReturn60Pct:0},
  {assetId:'SXR8',predictedRelativeReturn60Pct:-0.1},
  {assetId:'EQQQ',predictedRelativeReturn60Pct:-0.2},
  {assetId:'EXSA',predictedRelativeReturn60Pct:-0.3}
],'SXR8');
assert.equal(fallback.selectedAssetId,'EUNL');
assert.equal(fallback.reason,'FALLBACK_CORE');

assert.equal(selectTimesFmPanelNaiveTop1V1(rows),'SXR8');

console.log('timesFmPanelStickySelectorV1.unit: PASS');
