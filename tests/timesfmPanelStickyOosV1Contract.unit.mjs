import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const protocol=read('scripts/timesfmPanelStickyOosV1Protocol.mjs');
const selector=read('src/investment/decision/timesFmPanelStickySelectorV1.ts');
const runner=read('scripts/timesfmPanelStickyOosV1Live.ts');
const replay=read('src/investment/decision/dynamicHistoricalReplayCore.ts');

assert.match(protocol,/firstCalendarMonth: '2025-10'/);
assert.match(protocol,/lastCalendarMonth: '2026-06'/);
assert.match(protocol,/outcomesThrough: '2026-09-30'/);
assert.match(protocol,/outcomesOpenedBeforeSeal: false/);
assert.match(protocol,/arm: 'FULL_PANEL_TARGETS_ONLY'/);
assert.match(protocol,/horizonSessions: 60/);
assert.match(protocol,/entryRank: 1/);
assert.match(protocol,/incumbentRetentionRank: 3/);
assert.match(protocol,/relativeReturnFloorPct: 0/);
assert.match(protocol,/productionDefault: 'LEGACY'/);
assert.match(protocol,/productionAuthority: false/);

assert.match(selector,/RETAIN_TOP3_BUFFER/);
assert.match(selector,/FALLBACK_CORE/);
assert.match(selector,/executionSemantics: 'NEXT_OPEN'/);
assert.match(selector,/productionAuthority: false/);

assert.match(runner,/buildProspectiveMultivariateContext/);
assert.match(runner,/callTimesFmMultivariateContextV1\(payload\)/);
assert.match(runner,/out\.targetsOnly/);
assert.doesNotMatch(runner,/withCausalCovariates/);
assert.match(runner,/researchDirectSelector:\{policy:'TIMESFM_PANEL_STICKY_SELECTOR_V1'/);
assert.match(runner,/runDynamicReplayWithRotationExperiment\(input,'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner,/externalCashFlows:\[\]/);
assert.match(runner,/sourceType:'REAL'/);
assert.doesNotMatch(runner,/SYNTHETIC/);
assert.match(runner,/productionDefault:'LEGACY',productionAuthority:false/);
assert.ok(runner.indexOf('const remote=await callTimesFmMultivariateContextV1(payload);') < runner.indexOf('const scenarios:any[]=[]'));

assert.match(replay,/TIMESFM_PANEL_STICKY_SELECTOR_V1/);
assert.match(replay,/Modo research directo/);

console.log('timesfmPanelStickyOosV1Contract.unit: PASS');
