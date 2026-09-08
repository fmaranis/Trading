import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/opportunityRankingCausalComparisonLive.ts'), 'utf8');

assert.match(runner, /OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1/);
assert.match(runner, /DATA_START_DATE = '2014-09-01'/);
assert.match(runner, /END_DATE = '2026-09-01'/);
assert.match(runner, /LONG_10Y.*2016-09-01/);
assert.match(runner, /MEDIUM_6Y.*2020-09-01/);
assert.match(runner, /RECENT_3Y.*2023-09-01/);
assert.match(runner, /initialCapitalEur: 13_000/);
assert.match(runner, /riskProfile: 'MEDIUM'/);
assert.match(runner, /horizonYears: 3/);
assert.match(runner, /frequency: 'MONTHLY'/);
assert.match(runner, /cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0'/);
assert.match(runner, /currentOpenDiscovery: false/);
assert.match(runner, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner, /runDynamicReplayWithSelectionQualityExperiment/);
assert.match(runner, /runDynamicReplayWithSlopeSelectionExperiment/);
assert.match(runner, /productionPromotionAllowedFromThisHistoricalDiagnostic: false/);
assert.match(runner, /futureForwardRequiredBeforeAnyPromotion: true/);
assert.match(runner, /noThresholdTuningOnTheseWindows: true/);
assert.match(runner, /V8_PREDICTIVE_DOWNSIDE_SIGNAL_REMAINS_AVAILABLE/);
assert.doesNotMatch(runner, /GitHub Actions/i);
assert.doesNotMatch(runner, /Gemini|AI Studio|Codex/i);

console.log('opportunityRankingComparison.unit: PASS');
