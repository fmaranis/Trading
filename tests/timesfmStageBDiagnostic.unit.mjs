import assert from 'node:assert/strict';
import {
  buildStageBCases,
  evaluateStageB,
  spearman,
  maxDrawdownPct
} from '../scripts/timesfmStageBDiagnosticLive.mjs';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as P } from '../scripts/timesfmStageBProtocol.mjs';

function weekdays(start, end) {
  const rows = [];
  for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += 86_400_000) {
    const d = new Date(t);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) rows.push(d.toISOString().slice(0, 10));
  }
  return rows;
}

const dates = weekdays('2015-01-01', '2025-12-31');
const symbols = [P.core.ticker, ...P.assets.map(asset => asset.ticker)];
const series = {};
for (let s = 0; s < symbols.length; s++) {
  series[symbols[s]] = dates.map((date, i) => ({
    date,
    close: 100 + i * (0.015 + s * 0.002) + Math.sin((i + s * 7) / (21 + s)) * (1 + s * 0.05)
  }));
}

const built = buildStageBCases(series);
assert.equal(built.cases.length, P.diagnostic.expectedMaximumCases);
assert.equal(built.skips.length, 0);
assert.equal(new Set(built.cases.map(row => row.anchorKey)).size, 31);

for (const row of built.cases) {
  assert.deepEqual(Object.keys(row.payload).sort(), ['assetContext','caseId','coreContext']);
  assert.equal(row.payload.assetContext.length, 512);
  assert.equal(row.payload.coreContext.length, 512);
  assert.equal(row.payload.assetContext[0], 100);
  assert.equal(row.payload.coreContext[0], 100);
  const serialized = JSON.stringify(row.payload).toLowerCase();
  assert.equal(serialized.includes('future'), false);
  assert.equal(serialized.includes('outcome'), false);
  assert.ok(row.contextEndDate <= row.informationDate);
  assert.ok(row.futureDates.every(date => date > row.informationDate));
}

const remote = {
  study: P.version,
  status: 'PASS_STAGE_B_INFERENCE_BATCH',
  caseCount: built.cases.length,
  cases: built.cases.map(row => {
    const assetLast = row.payload.assetContext.at(-1);
    const coreLast = row.payload.coreContext.at(-1);
    const assetSlope = (assetLast / row.payload.assetContext.at(-61)) ** (1 / 60);
    const coreSlope = (coreLast / row.payload.coreContext.at(-61)) ** (1 / 60);
    const path = Array.from({ length: 60 }, (_, i) => assetLast * assetSlope ** (i + 1));
    const points = Object.fromEntries(P.evaluationHorizons.map(h => [String(h), path[h - 1]]));
    const corePoints = Object.fromEntries(P.evaluationHorizons.map(h => [String(h), coreLast * coreSlope ** h]));
    const quantiles = Object.fromEntries(P.evaluationHorizons.map(h => {
      const point = points[String(h)];
      return [String(h), [0.94,0.96,0.98,0.99,1,1.01,1.02,1.04,1.06].map(mult => point * mult)];
    }));
    return {
      caseId: row.caseId,
      mvAssetPoint: points,
      mvCorePoint: corePoints,
      mvAssetQuantiles: quantiles,
      mvAssetPath60: path,
      uvAssetPoint: points
    };
  })
};

const evaluated = evaluateStageB(series, built.cases, remote);
assert.ok(['PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION','FAIL_SIGNAL_DIAGNOSTIC'].includes(evaluated.status));
assert.equal(evaluated.metrics.length, 4);
assert.deepEqual(evaluated.metrics.map(row => row.horizonSessions), [1,5,20,60]);
assert.equal(evaluated.events.length, built.cases.length * 4);
assert.equal(evaluated.primarySummary.coveragePct, 100);
assert.equal(evaluated.primarySummary.temporalByAsset.length, 8);
assert.equal(Object.keys(evaluated.primarySummary.gateChecks).length, 6);
assert.ok(evaluated.events.every(row => row.informationDate < row.futureDate));

assert.equal(spearman([1,2,3,4],[10,20,30,40]), 1);
assert.equal(spearman([1,2,3,4],[40,30,20,10]), -1);
assert.equal(maxDrawdownPct([100,110,99,120]), 10);

console.log('timesfmStageBDiagnostic.unit: PASS');
