import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const v1 = source('src/investment/decision/forwardRiskForecast.ts');
const v2 = source('src/investment/decision/forwardRiskForecastV2.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const productionGate = source('src/investment/decision/portfolioCoreGatePolicy.ts');

// V1 remains available as frozen baseline; V2 is a separate research experiment.
assert.match(v1, /FORWARD_RISK_FORECAST_V1/);
assert.match(v2, /FORWARD_RISK_FORECAST_V2/);
assert.match(v2, /STRICT_WALK_FORWARD_PRE_CRASH_NEXT_OPEN/);
assert.match(v2, /PRE_CRASH_NOT_ACTIVE_CRASH/);

// Target semantics: learn risk while the market is still near highs, not after
// the drawdown has already become visible.
assert.match(v2, /CALM_DRAWDOWN_LIMITS = \[1\.5, 2\.0, 3\.0\]/);
assert.match(v2, /currentDrawdown > calmLimitPct/);
assert.match(v2, /if \(activeCrash\) return \{ label: Number\.NaN, activeCrash: true \}/);
assert.match(v2, /futurePreCrashLabel/);

// Strict causality: a row cannot enter training until its complete future label
// window has elapsed. Any hypothetical action is next-open only.
assert.match(v2, /candidate\.labelEndIndexes\[labelIndex\] < row\.index/);
assert.match(v2, /executionDate: isoDate\(coreBars\[row\.index \+ 1\]\.timestamp\)/);

// Model upgrade: class-balanced logistic classifier with Elastic Net rather than
// the V1 ridge least-squares surrogate.
assert.match(v2, /fitLogisticModel/);
assert.match(v2, /positiveWeight = clamp\(negatives \/ Math\.max\(1, positives\), 1, 8\)/);
assert.match(v2, /ELASTIC_L1/);
assert.match(v2, /ELASTIC_L2/);
assert.match(v2, /calibrationShift/);

// Deterioration/divergence features must exist explicitly.
for (const feature of [
  'coreMomentumDeceleration5',
  'coreVolAcceleration5d',
  'breadthPositive20Change5d',
  'crossSectionDispersionChange5d',
  'defensiveRotationAcceleration',
  'priceBreadthDivergence20',
  'vixAcceleration5d',
  'vixTermRatioChange3d'
]) assert.match(v2, new RegExp(feature));

// Horizons are preserved independently. A strong 5d/20d/60d warning is not
// diluted by averaging the three percentiles.
assert.match(v2, /imminentRiskPercentilePct/);
assert.match(v2, /nearTermRiskPercentilePct/);
assert.match(v2, /mediumTermRiskPercentilePct/);
assert.match(v2, /Math\.max\(percentiles\[0\], percentiles\[1\], percentiles\[2\]\)/);

// Inverted AUC is diagnostic only. It must not silently flip predictions.
assert.match(v2, /invertedAuc/);
assert.match(v2, /orientation: 'DIRECT' \| 'INVERTED' \| 'UNRESOLVED'/);
assert.match(v2, /V2 nunca invierte automáticamente una señal/);
assert.doesNotMatch(v2, /predictions\s*=\s*predictions\.map\([^\n]*1\s*-/);

// Real anticipation is audited before the last peak preceding a threshold breach.
assert.match(v2, /peakDate/);
assert.match(v2, /breachDate/);
assert.match(v2, /leadSessionsBeforePeak/);
assert.match(v2, /anticipatedBeforePeak/);
assert.match(v2, /index <= episode\.peakIndex/);

// Research isolation: worker exports V1 and V2 together, but neither V2 nor its
// score may enter the production portfolio decision engine.
assert.match(worker, /runForwardRiskForecastV1/);
assert.match(worker, /runForwardRiskForecastV2/);
assert.match(worker, /forwardRiskForecastV1/);
assert.match(worker, /forwardRiskForecastV2/);
assert.match(worker, /FORWARD_RISK_FORECAST_V2/);
assert.doesNotMatch(v2, /from ['"]\.\/portfolioDecisionEngine['"]/);
assert.doesNotMatch(v2, /evaluatePortfolioDecision\(/);
assert.doesNotMatch(v2, /targetCoreExposurePct/);
assert.match(productionGate, /return applyCoreArchitectureV1\(normalizedInput, gated\);/);

console.log('forwardRiskForecastV2.unit: PASS');