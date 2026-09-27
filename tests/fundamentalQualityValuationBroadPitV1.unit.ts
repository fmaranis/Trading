import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1 as P,
  epsGrowthVariability,
  scoreQualityCrossSection,
  splitHighQualityByValuation
} from '../scripts/fundamentalQualityValuationBroadPitV1Protocol';

assert.equal(P.researchOnly, true);
assert.equal(P.productionAuthority, false);
assert.equal(P.productionDefault, 'LEGACY');
assert.equal(P.informationDate, '2021-05-03');
assert.equal(P.outcomeDate, '2022-05-03');
assert.equal(P.universe.indexSymbol, 'GSPC.INDX');
assert.equal(P.fundamentals.filingRule, 'filed <= informationDate');
assert.equal(P.fundamentals.operatingProfitabilityGuard, 'LATEST_CAUSAL_ANNUAL_OPERATING_INCOME_GT_0');
assert.equal(P.fundamentals.earningsVariability, 'SAMPLE_STDDEV_OF_4_YOY_EPS_GROWTH_RATES_FROM_LAST_5_CAUSAL_ANNUAL_EPS_VALUES');
assert.deepEqual(P.fundamentals.winsorizationPct, [5, 95]);
assert.deepEqual(P.fundamentals.descriptorWeights, { roe: 1, debtEquity: 1, earningsVariability: 1 });
assert.equal(P.qualityBranch.noOutcomeTuning, true);
assert.match(P.fundamentals.translationStatus, /PROVIDER_INDEPENDENT_SEC_TRANSLATION/);
assert.match(P.valuation.translationStatus, /ANNUAL_CAUSAL_EARNINGS_YIELD_TRANSLATION/);
assert.equal(P.valuation.noOutcomeTuning, true);
assert.equal(P.outcomes.primaryBenchmark, 'SPY');
assert.equal(P.outcomes.secondaryStructuralCoreProxy, 'URTH');
assert.equal(P.interpretation.samplePromotionEligible, false);
assert.equal(P.interpretation.noRetuningAfterOutcome, true);

const ev = epsGrowthVariability([1, 1.1, 1.21, 1.331, 1.4641]);
assert.ok(ev != null && ev < 1e-12, 'constant EPS growth should have near-zero variability');
assert.equal(epsGrowthVariability([1, 0, 1, 2, 3]), null, 'zero prior EPS must fail closed');
assert.equal(epsGrowthVariability([1, 2, 3, 4]), null, 'requires exactly five annual EPS observations');

const scored = scoreQualityCrossSection([
  { id: 'A', roe: 30, debtEquity: 0.1, earningsVariability: 0.1, earningsYield: 6 },
  { id: 'B', roe: 28, debtEquity: 0.2, earningsVariability: 0.2, earningsYield: 4 },
  { id: 'C', roe: 10, debtEquity: 2.0, earningsVariability: 1.2, earningsYield: 8 },
  { id: 'D', roe: 12, debtEquity: null, earningsVariability: 1.0, earningsYield: 5 },
  { id: 'E', roe: 20, debtEquity: 0.4, earningsVariability: null, earningsYield: 3 },
  { id: 'EXCLUDE', roe: 40, debtEquity: null, earningsVariability: null, earningsYield: 10 }
]);
assert.equal(scored.some(row => row.id === 'EXCLUDE'), false, 'ROE-only rows cannot receive a quality score');
assert.equal(scored.find(row => row.id === 'D')?.debtEquityZ, null, 'single D/E missing is allowed');
assert.equal(scored.find(row => row.id === 'E')?.earningsVariabilityZ, null, 'single EVAR missing is allowed');

const split = splitHighQualityByValuation(scored);
assert.ok(split.highQuality.length >= 2);
assert.ok(split.cheapReasonable.every(row => (row.earningsYield ?? -Infinity) >= split.valuationMedian));
assert.ok(split.expensive.every(row => (row.earningsYield ?? Infinity) < split.valuationMedian));
assert.equal(
  new Set([...split.cheapReasonable, ...split.expensive].map(row => row.id)).size,
  split.cheapReasonable.length + split.expensive.length,
  'valuation branches must be disjoint'
);

const gitBlobSha = (text: string) => {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const sealPath = path.resolve(process.cwd(), 'validation-runs/preregistration/fundamental-quality-valuation-broad-pit-v1-seal.json');
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
assert.equal(seal.version, 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1_SEAL');
assert.equal(seal.informationDate, P.informationDate);
assert.equal(seal.outcomeDate, P.outcomeDate);
assert.equal(seal.productionDefault, 'LEGACY');
assert.equal(seal.productionAuthority, false);
assert.equal(seal.noRetuningAfterOutcome, true);
assert.equal(seal.currentYahooDiscoveryHistorical, false);
for (const [relative, expected] of Object.entries(seal.expectedGitBlobSha as Record<string, string>)) {
  const content = fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
  assert.equal(gitBlobSha(content), expected, `seal mismatch: ${relative}`);
}

const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/fundamentalQualityValuationBroadPitV1Live.ts'), 'utf8');
assert.match(runner, /HistoricalTickerComponents/);
assert.match(runner, /filed <= P\.informationDate/);
assert.match(runner, /data\.sec\.gov\/api\/xbrl\/companyfacts/);
assert.match(runner, /sourceType !== 'REAL'/);
assert.match(runner, /saveDurableResearchValidationEvidence/);
assert.doesNotMatch(runner, /SYNTHETIC.*fallback|currentOpenDiscovery\s*:\s*true/i);

console.log('fundamentalQualityValuationBroadPitV1.unit: PASS');
