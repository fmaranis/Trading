import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const forecast = source('src/investment/decision/forwardRiskForecast.ts');
const diagnostics = source('src/investment/decision/forwardRiskDiagnosticData.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const sharedDecision = source('src/investment/decision/portfolioCoreGatePolicy.ts');

assert.match(forecast, /FORWARD_RISK_FORECAST_V1/);
assert.match(forecast, /STRICT_WALK_FORWARD_NEXT_OPEN/);
assert.match(forecast, /candidate\.labelEndIndexes\[labelIndex\] < row\.index/);
assert.match(forecast, /executionIndex: row\.index \+ 1/);
assert.match(forecast, /probability5d3Pct/);
assert.match(forecast, /probability20d5Pct/);
assert.match(forecast, /probability60d10Pct/);
assert.match(forecast, /riskPercentile >= 0\.95 \? 0\.70/);
assert.match(forecast, /economicPassFrictionless/);
assert.match(forecast, /economicPassRealistic/);
assert.match(forecast, /predictiveSignalPass/);
assert.match(forecast, /brokerCommission/);
assert.match(forecast, /estimatedTax = Math\.max\(0, realizedGain\) \* 0\.30/);
assert.match(forecast, /taxOnInterest: gross => gross \* 0\.19/);
assert.doesNotMatch(forecast, /PortfolioDecisionEngine/);
assert.doesNotMatch(forecast, /evaluatePortfolioDecision/);

assert.match(diagnostics, /'\^VIX'/);
assert.match(diagnostics, /'\^VIX3M'/);
assert.match(diagnostics, /no synthetic/i);

assert.match(worker, /runForwardRiskForecastV1\(\{/);
assert.match(worker, /isFinalChunk/);
assert.match(worker, /forwardRiskForecastV1/);
assert.match(worker, /const REPLAY_ROTATION_EXPERIMENT = 'CORE_ARCHITECTURE_V1'/);

// Productive entry remains the mature V1 architecture. The predictor is not
// allowed to become a live portfolio action until it passes economic validation.
assert.match(sharedDecision, /return applyCoreArchitectureV1\(normalizedInput, gated\);/);

console.log('forwardRiskForecast.unit: PASS');