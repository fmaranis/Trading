import assert from 'node:assert/strict';
import { MultiAssetDataAligner, MultiAssetDataset, PortfolioStrategyComparator } from '../src/investment/portfolioBacktesting';
import { CausalRegimePolicySelector } from '../src/investment/portfolioRegimes';

function dateAt(i: number): string {
  return new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
}

function makeBars(prices: number[]) {
  return prices.map((close, i) => ({ timestamp: `${dateAt(i)}T00:00:00.000Z`, open: close, high: close * 1.001, low: close * 0.999, close, volume: 1000 }));
}

function makeDataset(a: number[], b: number[]): MultiAssetDataset {
  return {
    timeframe: '1d',
    assets: [
      { assetId: 'A', ticker: 'A', name: 'A', currency: 'USD', bars: makeBars(a), provenance: { sourceType: 'SYNTHETIC', isReproducible: true, seed: 1 } },
      { assetId: 'B', ticker: 'B', name: 'B', currency: 'USD', bars: makeBars(b), provenance: { sourceType: 'SYNTHETIC', isReproducible: true, seed: 2 } }
    ]
  };
}

const n = 260;
const a = Array.from({ length: n }, (_, i) => 100 * Math.exp(i * 0.001 + Math.sin(i / 13) * 0.01));
const b = Array.from({ length: n }, (_, i) => 90 * Math.exp(i * 0.0005 + Math.cos(i / 17) * 0.008));
const baseConfig = { initialCapital: 10000, commissionPct: 0, slippagePct: 0, rebalanceFrequency: 'MONTHLY' as const, executionMode: 'NEXT_OPEN' as const, alignmentPolicy: 'INTERSECTION' as const };
const classifier = { trendLookbackBars: 20, volatilityLookbackBars: 10, volatilityBaselineBars: 30, bullTrendThresholdPct: 1, bearTrendThresholdPct: -1 };

function build(ds: MultiAssetDataset) {
  const aligned = MultiAssetDataAligner.align(ds);
  const comparison = PortfolioStrategyComparator.compare(ds, baseConfig, 20);
  const selection = CausalRegimePolicySelector.select(aligned, comparison, {
    rebalanceFrequency: 'MONTHLY',
    learningLookbackBars: 80,
    minimumRegimeObservations: 5,
    metric: 'TOTAL_RETURN',
    classifier
  });
  return { aligned, comparison, selection };
}

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('186 every execution happens after its decision date', () => {
  const { selection } = build(makeDataset(a, b));
  assert.ok(selection.decisions.length > 0);
  assert.ok(selection.decisions.every(x => x.executionDate > x.decisionDate));
});

test('187 training data never ends after decision date', () => {
  const { selection } = build(makeDataset(a, b));
  assert.ok(selection.decisions.every(x => x.trainingEndDate == null || x.trainingEndDate <= x.decisionDate));
});

test('188 selector preserves portfolio fingerprint', () => {
  const { comparison, selection } = build(makeDataset(a, b));
  assert.equal(selection.portfolioDatasetFingerprint, comparison.portfolioDatasetFingerprint);
});

test('189 warmup or insufficient regime evidence uses explicit fallback', () => {
  const { selection } = build(makeDataset(a, b));
  assert.ok(selection.decisions.some(x => x.fallbackUsed));
  assert.ok(selection.decisions.filter(x => x.fallbackUsed).every(x => x.selectedPolicy === selection.fallbackPolicy));
});

test('190 future mutation cannot change earlier selector decisions', () => {
  const mutatedA = [...a];
  const mutatedB = [...b];
  for (let i = 210; i < n; i++) { mutatedA[i] *= 0.45; mutatedB[i] *= 1.8; }
  const s1 = build(makeDataset(a, b)).selection;
  const s2 = build(makeDataset(mutatedA, mutatedB)).selection;
  const cutoff = dateAt(208);
  const d1 = s1.decisions.filter(x => x.executionDate <= cutoff).map(x => [x.executionDate, x.selectedPolicy, x.regimeAtDecision]);
  const d2 = s2.decisions.filter(x => x.executionDate <= cutoff).map(x => [x.executionDate, x.selectedPolicy, x.regimeAtDecision]);
  assert.deepEqual(d1, d2);
});

test('191 selector is diagnostic and does not claim execution', () => {
  const { selection } = build(makeDataset(a, b));
  assert.match(selection.note, /No ejecuta órdenes/);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}
console.log(`\nCausal Regime Selector: ${passed}/${tests.length} tests passed.`);
