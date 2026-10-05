import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');

const policy=read('src/investment/decision/timesFmDirectSelectorV1.ts');
const replay=read('src/investment/decision/dynamicHistoricalReplayCore.ts');
const index=read('src/investment/decision/index.ts');

assert.match(policy,/version: 'TIMESFM_DIRECT_SELECTOR_V1'/);
assert.match(policy,/LOWEST_MEAN_ORDINAL_RANK_20_60/);
assert.match(policy,/HIGHER_MEAN_PREDICTED_RELATIVE_RETURN_THEN_ASSET_ID/);
assert.match(policy,/FULL_SHADOW_EQUITY_TO_SELECTED_ASSET/);
assert.match(policy,/executionSemantics: 'NEXT_OPEN'/);
assert.match(policy,/productionAuthority: false/);
assert.doesNotMatch(policy,/LEGACY_RANKING_SCORE/);
assert.doesNotMatch(policy,/threshold|multiplier|coefficient/i);

assert.match(replay,/researchDirectSelector\?: DynamicReplayResearchDirectSelector/);
assert.match(replay,/REPLAY_DIRECT_SELECTOR_MISSING_SELECTION/);
assert.match(replay,/REPLAY_DIRECT_SELECTOR_ASSET_NOT_ACCEPTED/);
assert.match(replay,/plannedByAsset\.clear\(\)/);
assert.match(replay,/action: 'EXIT'/);
assert.match(replay,/targetWeight: 1/);
assert.match(replay,/TIMESFM_DIRECT_SELECTOR_V1: ganador directo/);
assert.match(replay,/executionDate: null/);
assert.match(replay,/nextBarAfter\(input\.dataset, plan\.signal\.assetId, decisionDate\)/);
assert.match(replay,/Modo research directo/);

assert.match(index,/timesFmDirectSelectorV1/);

console.log('timesFmDirectSelectorV1Contract.unit: PASS');
