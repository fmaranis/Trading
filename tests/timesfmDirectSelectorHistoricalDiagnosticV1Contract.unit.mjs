import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');

const runner=read('scripts/timesfmDirectSelectorHistoricalDiagnosticV1.ts');
const protocol=read('scripts/timesfmDirectSelectorHistoricalDiagnosticV1Protocol.mjs');
const replay=read('src/investment/decision/dynamicHistoricalReplayCore.ts');
const selector=read('src/investment/decision/timesFmDirectSelectorV1.ts');

assert.match(protocol,/POSTHOC_DIRECT_SELECTOR_DIAGNOSTIC_NO_PROMOTION/);
assert.match(protocol,/8_STAGE_B_ASSETS_PLUS_EUNL_CORE/);
assert.match(protocol,/100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET/);
assert.match(protocol,/totalScenarios: 15/);
assert.match(protocol,/productionAuthority: false/);

assert.match(runner,/selectTimesFmDirectWinnerV1\(evidence\)/);
assert.match(runner,/predictedRelativeReturn20Pct:0/);
assert.match(runner,/predictedRelativeReturn60Pct:0/);
assert.match(runner,/researchDirectSelector:\{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate\}/);
assert.match(runner,/researchDirectSelector:\{policy:'TIMESFM_DIRECT_SELECTOR_V1',selectionsByDate:coreSelectionsByDate\}/);
assert.match(runner,/runDynamicReplayWithRotationExperiment\(input,'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner,/selectionCounts/);
assert.match(runner,/winnerChanges/);

assert.match(replay,/researchDirectSelector\?: DynamicReplayResearchDirectSelector/);
assert.match(replay,/REPLAY_DIRECT_SELECTOR_MISSING_SELECTION/);
assert.match(replay,/action: 'EXIT'/);
assert.match(replay,/targetWeight: 1/);

assert.doesNotMatch(selector,/LEGACY/);
assert.match(selector,/productionAuthority: false/);

console.log('timesfmDirectSelectorHistoricalDiagnosticV1Contract.unit: PASS');
