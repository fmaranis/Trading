import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const v1 = source('src/investment/decision/forwardRiskForecast.ts');
const v2 = source('src/investment/decision/forwardRiskForecastV2.ts');
const v3 = source('src/investment/decision/forwardRiskForecastV3.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const productionGate = source('src/investment/decision/portfolioCoreGatePolicy.ts');

// V1 and V2 remain frozen comparison baselines; V3 is an isolated research model.
assert.match(v1, /FORWARD_RISK_FORECAST_V1/);
assert.match(v2, /FORWARD_RISK_FORECAST_V2/);
assert.match(v3, /FORWARD_RISK_FORECAST_V3/);
assert.match(v3, /STRICT_WALK_FORWARD_PRE_CRASH_MONOTONIC_NEXT_OPEN/);
assert.match(v3, /PRE_CRASH_DETERIORATION_NOT_ACTIVE_CRASH/);

// Target semantics remain pre-crash and explicitly exclude already-active drawdowns.
assert.match(v3, /CALM_DRAWDOWN_LIMITS = \[1\.5, 2\.0, 3\.0\]/);
assert.match(v3, /currentDrawdown > calmLimitPct/);
assert.match(v3, /if \(activeCrash\) return \{ label: Number\.NaN, activeCrash: true \}/);

// Strict walk-forward causality and next-open semantics are mandatory.
assert.match(v3, /candidate\.labelEndIndexes\[labelIndex\] < row\.index/);
assert.match(v3, /candidate\.index < row\.index/);
assert.match(v3, /executionDate: isoDate\(coreBars\[row\.index \+ 1\]\.timestamp\)/);

// V3 must use genuinely different feature sets per horizon rather than one shared model.
assert.match(v3, /const HORIZON_FEATURES/);
assert.match(v3, /5: \[/);
assert.match(v3, /20: \[/);
assert.match(v3, /60: \[/);
assert.match(v3, /sma200Deterioration20d/);
assert.match(v3, /breadthAbove200Deterioration20d/);
assert.match(v3, /vixTermDeterioration10d/);

// Explicit deterioration interactions are the central V3 hypothesis.
for (const feature of [
  'strongTrendBreadthDeterioration',
  'strongTrendVixRising',
  'positiveMomentumMomentumLoss',
  'calmMarketVolRising',
  'highBreadthBreadthCollapse',
  'dispersionBreadthStress',
  'contangoFlattening',
  'riskOnDefensiveRotation'
]) assert.match(v3, new RegExp(feature));

// Semantic monotonicity: all engineered features mean more risk as they rise,
// and the classifier cannot assign a negative coefficient to flip that meaning.
assert.match(v3, /values mayores representan deterioro/);
assert.match(v3, /updated = Math\.max\(0, updated - shrink\)/);
assert.match(v3, /weights\[c\] = clamp\(updated, 0, 8\)/);

// Regularization is selected only on an inner chronological split of already
// matured training observations. No replay-future score may select a model.
assert.match(v3, /INNER_VALIDATION_FRACTION/);
assert.match(v3, /const innerTrain = usable\.slice\(0, split\)/);
assert.match(v3, /const innerValidation = usable\.slice\(split\)/);
assert.match(v3, /selectCausalModel/);
assert.match(v3, /innerValidationAuc/);
assert.match(v3, /REGULARIZATION_MULTIPLIERS/);

// Inversion remains diagnostic only; V3 must never replace p with 1-p.
assert.match(v3, /invertedAuc/);
assert.match(v3, /AUC invertida continúa siendo sólo diagnóstica/);
assert.doesNotMatch(v3, /predictions\s*=\s*predictions\.map\([^\n]*1\s*-/);
assert.doesNotMatch(v3, /return\s+1\s*-\s*predict/);

// Forecast horizons remain independent and a strong warning is not averaged away.
assert.match(v3, /Math\.max\(\.\.\.percentiles\)/);
assert.match(v3, /forecasts\.filter\(row => Number\.isFinite\(row\.rawLabels\[horizonIndex\]\)\)/);

// Audit must expose false positives, lead time, orientation and model-selection diagnostics.
assert.match(v3, /highRiskFalsePositivePct/);
assert.match(v3, /anticipatedEpisodeRatePct/);
assert.match(v3, /medianLeadSessionsBeforePeak/);
assert.match(v3, /innerValidationOrientationPass/);
assert.match(v3, /modelDiagnostics/);

// Worker exports all three research generations, while V3 remains outside production decisions.
assert.match(worker, /runForwardRiskForecastV1/);
assert.match(worker, /runForwardRiskForecastV2/);
assert.match(worker, /runForwardRiskForecastV3/);
assert.match(worker, /forwardRiskForecastV3/);
assert.match(worker, /FORWARD_RISK_FORECAST_V3/);
assert.doesNotMatch(v3, /from ['"]\.\/portfolioDecisionEngine['"]/);
assert.doesNotMatch(v3, /evaluatePortfolioDecision\(/);
assert.doesNotMatch(v3, /targetCoreExposurePct/);
assert.match(productionGate, /return applyCoreArchitectureV1\(normalizedInput, gated\);/);

console.log('forwardRiskForecastV3.unit: PASS');
