import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const v3 = source('src/investment/decision/forwardRiskForecastV3.ts');
const v31 = source('src/investment/decision/forwardRiskForecastV31.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const gate = source('src/investment/decision/portfolioCoreGatePolicy.ts');

assert.match(v31, /FORWARD_RISK_FORECAST_V3_1/);
assert.match(v31, /fiveDayFrozenFromV3: true/);
assert.match(v31, /runForwardRiskForecastV3\(input\)/);
assert.match(v31, /frozenV3\.metrics\.find\(m => m\.horizonSessions === 5\)/);
assert.match(v31, /frozenV3\.episodeAudits\.filter\(a => a\.horizonSessions === 5\)/);

for (const feature of [
  'momentumLossPersistent', 'breadth50DeclinePersistent', 'breadth20DeclinePersistent',
  'dispersionWidenPersistent', 'defensiveRotationPersistent', 'vixTermDeteriorationPersistent',
  'multiSignalPersistence', 'nearHigh252', 'breadth200WeakUnderStrongIndex',
  'breadth200SlowDeterioration', 'lowVixBreadthFragility', 'contangoCompressionCalm',
  'silentDivergence', 'concentrationFragility'
]) assert.match(v31, new RegExp(feature));

assert.match(v31, /updated = Math\.max\(0, updated - rate \* l1 \* tw\)/);
assert.match(v31, /weights\[c\] = clamp\(updated, 0, 8\)/);
assert.doesNotMatch(v31, /return\s+1\s*-\s*predict/);
assert.doesNotMatch(v31, /predictions\s*=\s*predictions\.map\([^\n]*1\s*-/);

assert.match(v31, /candidate|c\.labelEndIndexes/);
assert.match(v31, /c\.labelEndIndexes\[li\] < row\.index/);
assert.match(v31, /executionDate: isoDate\(coreBars\[row\.index \+ 1\]\.timestamp\)/);
assert.match(v31, /INNER_VALIDATION_FRACTION/);
assert.match(v31, /innerTrain = usable\.slice\(0, split\)/);
assert.match(v31, /innerValidation = usable\.slice\(split\)/);

assert.match(worker, /runForwardRiskForecastV31/);
assert.match(worker, /forwardRiskForecastV31/);
assert.match(worker, /FORWARD_RISK_FORECAST_V3_1/);
assert.match(worker, /FORWARD_RISK_RESEARCH_WARMUP_YEARS = 5/);
assert.match(worker, /AssetUniverseScanner\.scan\(researchCatalog, forwardRiskRequestedFrom, result\.endDate/);
assert.match(worker, /const common = \{ dataset: forwardRiskDataset/);
assert.match(worker, /isolatedFromReplayDecisions: true/);
assert.doesNotMatch(worker, /replayInput\(forwardRiskDataset\)/);
const baselineIndex = worker.indexOf('const baseline = runDynamicReplayWithRotationExperiment(input, REPLAY_ROTATION_EXPERIMENT)');
const researchScanIndex = worker.indexOf('AssetUniverseScanner.scan(researchCatalog, forwardRiskRequestedFrom, result.endDate');
assert.ok(baselineIndex >= 0 && researchScanIndex > baselineIndex, 'Forward-risk warmup must happen only after the replay baseline is finished.');

assert.doesNotMatch(v31, /portfolioDecisionEngine/);
assert.doesNotMatch(v31, /targetCoreExposurePct/);
assert.match(gate, /return applyCoreArchitectureV1\(normalizedInput, gated\);/);

// V3 itself remains present and unmodified as the frozen comparison baseline.
assert.match(v3, /FORWARD_RISK_FORECAST_V3/);
assert.match(v3, /STRICT_WALK_FORWARD_PRE_CRASH_MONOTONIC_NEXT_OPEN/);

console.log('forwardRiskForecastV31.unit: PASS');