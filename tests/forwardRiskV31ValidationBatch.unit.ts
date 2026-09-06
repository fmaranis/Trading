import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/forwardRiskV31ValidationBatchLive.ts'), 'utf8');

assert.match(script, /WARMUP_YEARS = 7/);
assert.match(script, /Q4_2018_CORRECTION/);
assert.match(script, /PRE_COVID_CALM/);
assert.match(script, /COVID_2020/);
assert.match(script, /BEAR_2022/);
assert.match(script, /CALM_RECOVERY_2023/);
assert.match(script, /runForwardRiskForecastV31/);
assert.match(script, /FROZEN_V3_1_MULTI_PERIOD_OOS_RESEARCH_ONLY/);
assert.match(script, /productionPromotionAllowed: false/);
assert.match(script, /Economic money-saved validation remains a separate required gate/);
assert.doesNotMatch(script, /runDynamicReplayWithRotationExperiment/);
assert.doesNotMatch(script, /portfolioDecisionEngine/);

const scanCalls = script.match(/AssetUniverseScanner\.scan\(/g) ?? [];
const diagnosticCalls = script.match(/loadForwardRiskDiagnosticData\(/g) ?? [];
assert.equal(scanCalls.length, 1, 'The batch must share one expensive universe scan across all periods.');
assert.equal(diagnosticCalls.length, 1, 'The batch must share one diagnostic-data load across all periods.');

console.log('forwardRiskV31ValidationBatch.unit: PASS');
