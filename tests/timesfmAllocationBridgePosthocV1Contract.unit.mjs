import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');

const engine=read('src/investment/decision/portfolioDecisionEngine.ts');
const wrapper=read('src/investment/decision/replayTimesFmRelativeRankExperiment.ts');
const runner=read('scripts/timesfmAllocationBridgePosthocV1.ts');
const protocol=read('scripts/timesfmAllocationBridgePosthocV1Protocol.mjs');

assert.match(engine,/TIMESFM_ALLOCATION_BRIDGE_V1/);
assert.match(engine,/const aRank = a\.timesFmRelativeRankPosition \?\? Number\.POSITIVE_INFINITY/);
assert.match(engine,/const bRank = b\.timesFmRelativeRankPosition \?\? Number\.POSITIVE_INFINITY/);
assert.match(engine,/return aRank - bRank \|\| b\.rankingScore - a\.rankingScore/);
assert.match(engine,/TIMESFM_ALLOCATION_BRIDGE_V1 post-hoc research-only/);
assert.doesNotMatch(engine,/TIMESFM_ALLOCATION_BRIDGE_V1'\s*\?\s*legacy \*/);

assert.match(wrapper,/runDynamicReplayWithTimesFmAllocationBridgeV1/);
assert.match(wrapper,/candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1'/);
assert.match(wrapper,/opportunityAllocationPolicy: 'TIMESFM_ALLOCATION_BRIDGE_V1'/);
assert.match(wrapper,/runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);

assert.match(runner,/runDynamicReplayWithTimesFmAllocationBridgeV1\(input, evidenceByDate\)/);
assert.match(runner,/runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner,/explicitDecisionDates: dates/);
assert.match(runner,/externalCashFlows: \[\]/);
assert.match(runner,/POST-HOC ARCHITECTURE DIAGNOSTIC ONLY/);
assert.match(runner,/LEGACY still computes target\/sizing magnitudes/);

assert.match(protocol,/sizingFormula: 'LEGACY_UNCHANGED'/);
assert.match(protocol,/promotionAuthority: false/);
assert.match(protocol,/productionAuthority: false/);

console.log('timesfmAllocationBridgePosthocV1Contract.unit: PASS');
