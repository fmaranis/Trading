import assert from 'node:assert/strict';
import { selectTimesFmDirectWinnerV1 } from '../src/investment/decision/timesFmDirectSelectorV1';
import { selectDirectTimesFmWinner } from '../scripts/timesfmStageBProspectiveCollectorLive.mjs';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P } from '../scripts/timesfmStageBProtocol.mjs';

const cases = P.assets.map((asset,index) => ({
  assetId: asset.assetId,
  ticker: asset.ticker,
  mvPredRelativeReturnPct: {
    '20': [4,1,3,-1,2,0.5,-0.5,1.5][index],
    '60': [2,5,1,-2,3,0.2,-0.2,1.2][index]
  }
}));

const prospective = selectDirectTimesFmWinner(cases);
const canonical = selectTimesFmDirectWinnerV1([
  ...cases.map(row => ({
    assetId: row.assetId,
    predictedRelativeReturn20Pct: row.mvPredRelativeReturnPct['20'],
    predictedRelativeReturn60Pct: row.mvPredRelativeReturnPct['60']
  })),
  {
    assetId: P.core.assetId,
    predictedRelativeReturn20Pct: 0,
    predictedRelativeReturn60Pct: 0
  }
]);

assert.equal(prospective.selectedAssetId, canonical.assetId);
assert.equal(prospective.rank20, canonical.rank20);
assert.equal(prospective.rank60, canonical.rank60);
assert.equal(prospective.meanOrdinalRank, canonical.meanOrdinalRank);
assert.equal(prospective.predictedRelativeReturn20Pct, canonical.predictedRelativeReturn20Pct);
assert.equal(prospective.predictedRelativeReturn60Pct, canonical.predictedRelativeReturn60Pct);

console.log('timesFmDirectSelectorProspectiveParity.unit: PASS');
