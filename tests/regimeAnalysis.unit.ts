import assert from 'node:assert/strict';
import { MultiAssetDataAligner, MultiAssetDataset, PortfolioStrategyComparator } from '../src/investment/portfolioBacktesting';
import { DeterministicRegimeClassifier, PolicyRegimeComparator } from '../src/investment/portfolioRegimes';

function dateAt(i: number): string {
  const d = new Date(Date.UTC(2020, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}

function bars(prices: number[]) {
  return prices.map((close, i) => ({ timestamp: `${dateAt(i)}T00:00:00.000Z`, open: close, high: close * 1.001, low: close * 0.999, close, volume: 1000 }));
}

function dataset(a: number[], b: number[]): MultiAssetDataset {
  return {
    timeframe: '1d',
    assets: [
      { assetId: 'A', ticker: 'A', name: 'A', currency: 'USD', bars: bars(a), provenance: { sourceType: 'SYNTHETIC', isReproducible: true, seed: 1 } },
      { assetId: 'B', ticker: 'B', name: 'B', currency: 'USD', bars: bars(b), provenance: { sourceType: 'SYNTHETIC', isReproducible: true, seed: 2 } }
    ]
  };
}

const n = 220;
const upA = Array.from({ length: n }, (_, i) => 100 * Math.exp(i * 0.0015));
const upB = Array.from({ length: n }, (_, i) => 80 * Math.exp(i * 0.0012));
const downA = Array.from({ length: n }, (_, i) => 100 * Math.exp(-i * 0.0015));
const downB = Array.from({ length: n }, (_, i) => 80 * Math.exp(-i * 0.0012));

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('171 warmup is UNKNOWN', () => {
  const aligned = MultiAssetDataAligner.align(dataset(upA, upB));
  const r = DeterministicRegimeClassifier.classify(aligned, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30 });
  assert.equal(r.observations[5].regime, 'UNKNOWN');
});

test('172 persistent positive trend classified bull', () => {
  const aligned = MultiAssetDataAligner.align(dataset(upA, upB));
  const r = DeterministicRegimeClassifier.classify(aligned, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bullTrendThresholdPct: 1 });
  assert.ok(r.observations.slice(60).some(x => x.regime === 'BULL_LOW_VOL' || x.regime === 'BULL_HIGH_VOL'));
});

test('173 persistent negative trend classified bear', () => {
  const aligned = MultiAssetDataAligner.align(dataset(downA, downB));
  const r = DeterministicRegimeClassifier.classify(aligned, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bearTrendThresholdPct: -1 });
  assert.ok(r.observations.slice(60).some(x => x.regime === 'BEAR_LOW_VOL' || x.regime === 'BEAR_HIGH_VOL'));
});

test('174 future mutation cannot change past regime labels', () => {
  const base = dataset(upA, upB);
  const mutatedA = [...upA];
  const mutatedB = [...upB];
  for (let i = 170; i < n; i++) { mutatedA[i] *= 0.3; mutatedB[i] *= 2.5; }
  const cfg = { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bullTrendThresholdPct: 1 };
  const r1 = DeterministicRegimeClassifier.classify(MultiAssetDataAligner.align(base), cfg);
  const r2 = DeterministicRegimeClassifier.classify(MultiAssetDataAligner.align(dataset(mutatedA, mutatedB)), cfg);
  assert.deepEqual(r1.observations.slice(0, 169).map(x => x.regime), r2.observations.slice(0, 169).map(x => x.regime));
});

test('175 informationEndDate equals observation date', () => {
  const r = DeterministicRegimeClassifier.classify(MultiAssetDataAligner.align(dataset(upA, upB)), { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30 });
  assert.ok(r.observations.every(x => x.informationEndDate === x.tradingDate));
});

test('176 classified plus unknown equals total rows', () => {
  const aligned = MultiAssetDataAligner.align(dataset(upA, upB));
  const r = DeterministicRegimeClassifier.classify(aligned, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30 });
  assert.equal(r.classifiedObservations + r.unknownObservations, aligned.rows.length);
});

test('177 policy comparison preserves one portfolio fingerprint', () => {
  const ds = dataset(upA, upB);
  const comparison = PortfolioStrategyComparator.compare(ds, { initialCapital: 10000, commissionPct: 0, slippagePct: 0, rebalanceFrequency: 'MONTHLY', executionMode: 'NEXT_OPEN', alignmentPolicy: 'INTERSECTION' }, 20);
  assert.ok(comparison.items.every(x => x.result.provenance.portfolioDatasetFingerprint === comparison.portfolioDatasetFingerprint));
});

test('178 regime policy comparator returns six leaderboards', () => {
  const ds = dataset(upA, upB);
  const aligned = MultiAssetDataAligner.align(ds);
  const comparison = PortfolioStrategyComparator.compare(ds, { initialCapital: 10000, commissionPct: 0, slippagePct: 0, rebalanceFrequency: 'MONTHLY', executionMode: 'NEXT_OPEN', alignmentPolicy: 'INTERSECTION' }, 20);
  const r = PolicyRegimeComparator.compare(aligned, comparison, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bullTrendThresholdPct: 1 });
  assert.equal(r.leaderboards.length, 6);
  assert.equal(r.portfolioDatasetFingerprint, comparison.portfolioDatasetFingerprint);
});

test('179 attribution has classified observations', () => {
  const ds = dataset(upA, upB);
  const aligned = MultiAssetDataAligner.align(ds);
  const comparison = PortfolioStrategyComparator.compare(ds, { initialCapital: 10000, commissionPct: 0, slippagePct: 0, rebalanceFrequency: 'MONTHLY', executionMode: 'NEXT_OPEN', alignmentPolicy: 'INTERSECTION' }, 20);
  const r = PolicyRegimeComparator.compare(aligned, comparison, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bullTrendThresholdPct: 1 });
  assert.ok(r.classifiedObservations > 0);
});

test('180 regime ranking does not mutate strategy results', () => {
  const ds = dataset(upA, upB);
  const aligned = MultiAssetDataAligner.align(ds);
  const comparison = PortfolioStrategyComparator.compare(ds, { initialCapital: 10000, commissionPct: 0, slippagePct: 0, rebalanceFrequency: 'MONTHLY', executionMode: 'NEXT_OPEN', alignmentPolicy: 'INTERSECTION' }, 20);
  const before = comparison.items.map(x => x.result.metrics.financial.finalEquity);
  PolicyRegimeComparator.compare(aligned, comparison, { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30 });
  assert.deepEqual(comparison.items.map(x => x.result.metrics.financial.finalEquity), before);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}
console.log(`\nRegime Analytics: ${passed}/${tests.length} tests passed.`);
