import assert from 'node:assert/strict';
import {
  TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P,
  quarterEndCalendarDates,
  rebase100,
  legacyScannerScore,
  trailing60LogDriftForecast
} from '../scripts/timesfmStageBProtocol.mjs';

assert.equal(P.version, 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1');
assert.equal(P.role, 'HISTORICAL_SIGNAL_DIAGNOSTIC_NO_PROMOTION');
assert.equal(P.model.packageVersion, '3.0.2');
assert.equal(P.core.ticker, 'EUNL.DE');
assert.deepEqual(P.assets.map(x => x.ticker), ['SXR8.DE','EQQQ.DE','EXSA.DE','IS3N.DE','ZPRV.DE','EXH1.DE','IBCI.DE','4GLD.DE']);
assert.equal(P.assets.length, 8);
assert.equal(P.contextLength, 512);
assert.equal(P.forecastHorizon, 60);
assert.deepEqual(P.evaluationHorizons, [1,5,20,60]);
assert.deepEqual(P.primaryHorizons, [20,60]);
assert.equal(P.data.sourceType, 'REAL');
assert.equal(P.data.provider, 'YAHOO_FINANCE');
assert.equal(P.data.adjusted, false);
assert.equal(P.diagnostic.firstAnchorQuarterEnd, '2018-03-31');
assert.equal(P.diagnostic.lastAnchorQuarterEnd, '2025-09-30');
assert.equal(P.diagnostic.expectedMaximumCases, 248);
assert.equal(P.models.primary, 'TIMESFM3_MV_ASSET_PLUS_CORE');
assert.equal(P.models.secondary, 'TIMESFM3_UV_ASSET_ONLY');
assert.equal(P.productionDefault, 'LEGACY');
assert.equal(P.productionAuthority, false);
assert.equal(P.prospectiveConfirmation.status, 'FROZEN_BEFORE_DIAGNOSTIC_OUTCOMES');
assert.equal(P.prospectiveConfirmation.noRetuneAfterDiagnostic, true);

const anchors = quarterEndCalendarDates();
assert.equal(anchors.length, 31);
assert.equal(anchors[0], '2018-03-31');
assert.equal(anchors.at(-1), '2025-09-30');
assert.ok(anchors.every(date => date <= '2025-09-30'));

const rebased = rebase100([10,11,12]);
assert.equal(rebased.length, 3);
assert.ok(Math.abs(rebased[0] - 100) < 1e-12);
assert.ok(Math.abs(rebased[1] - 110) < 1e-12);
assert.ok(Math.abs(rebased[2] - 120) < 1e-12);
assert.throws(() => rebase100([]), /TIMESFM_STAGE_B_INVALID_REBASE_INPUT/);

const trending = Array.from({length: 300}, (_, i) => 100 + i * 0.2);
const score = legacyScannerScore(trending, false);
assert.ok(Number.isFinite(score));
const defensiveScore = legacyScannerScore(trending, true);
assert.ok(defensiveScore != null && score != null && Math.abs(defensiveScore - score - 2.5) < 1e-9);

const drift20 = trailing60LogDriftForecast(trending, 20);
const drift60 = trailing60LogDriftForecast(trending, 60);
assert.ok(drift20 != null && drift60 != null && drift20 > 0 && drift60 > drift20);

assert.equal(P.gates.minimumCoveragePct, 85);
assert.equal(P.gates.minimumMeanRankIcPrimary20_60, 0.05);
assert.equal(P.gates.minimumRankIcLiftVsLegacy20_60, 0.02);
assert.equal(P.gates.minimumRelativeDirectionalAccuracyPct20_60, 52);
assert.equal(P.gates.minimumPositiveTemporalIcAssets, 5);
assert.equal(P.gates.quantile80CoverageMinPct, 60);
assert.equal(P.gates.quantile80CoverageMaxPct, 95);

console.log('timesfmStageBProtocol.unit: PASS');
