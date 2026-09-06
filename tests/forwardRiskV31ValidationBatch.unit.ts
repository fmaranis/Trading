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
assert.match(script, /PROTECTED_SHARE = 0\.25/);
assert.match(script, /ECONOMIC_HORIZON_SESSIONS = 20/);
assert.match(script, /ECONOMIC_HIGH_RISK_PERCENTILE_PCT = 80/);
assert.match(script, /historicalCashBenchmarkAnnualPct/);
assert.match(script, /execution: 'NEXT_OPEN'/);
assert.match(script, /transactionCostsApplied: false/);
assert.match(script, /periodBoundaryEnforced: true/);
assert.match(script, /isoDate\(exit\.timestamp\) > input\.periodEndDate/);
assert.match(script, /breakEvenRoundTripCostBps/);
assert.match(script, /buildEconomicAggregate/);
assert.match(script, /sourcePeriodNets/);
assert.match(script, /ECONOMIC_AGGREGATE_INCONSISTENT/);
assert.match(script, /directSignalTotal/);
assert.match(script, /economicCounterfactual = buildEconomicAggregate\(cases\)/);
assert.doesNotMatch(script, /runDynamicReplayWithRotationExperiment/);
assert.doesNotMatch(script, /portfolioDecisionEngine/);

const scanCalls = script.match(/AssetUniverseScanner\.scan\(/g) ?? [];
const diagnosticCalls = script.match(/loadForwardRiskDiagnosticData\(/g) ?? [];
assert.equal(scanCalls.length, 1, 'The batch must share one expensive universe scan across all periods.');
assert.equal(diagnosticCalls.length, 1, 'The batch must share one diagnostic-data load across all periods.');

console.log('forwardRiskV31ValidationBatch.unit: PASS');
