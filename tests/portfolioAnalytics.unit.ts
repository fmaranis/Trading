import assert from 'node:assert/strict';
import { AlignedMultiAssetDataset } from '../src/investment/portfolioBacktesting/types';
import { DeterministicPortfolioAllocator, PortfolioRiskAnalyzer, RealPortfolioAnalytics } from '../src/investment/portfolioAnalytics';

function bar(date: string, close: number) {
  return { timestamp: `${date}T00:00:00.000Z`, open: close, high: close, low: close, close, volume: 1000 };
}

function aligned(a: number[], b: number[], c?: number[]): AlignedMultiAssetDataset {
  const ids = c ? ['A', 'B', 'C'] : ['A', 'B'];
  return {
    assetIds: ids,
    tickers: Object.fromEntries(ids.map(x => [x, x])),
    policy: 'INTERSECTION',
    rows: a.map((x, i) => ({
      tradingDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
      assets: {
        A: bar(`2024-01-${String(i + 1).padStart(2, '0')}`, x),
        B: bar(`2024-01-${String(i + 1).padStart(2, '0')}`, b[i]),
        ...(c ? { C: bar(`2024-01-${String(i + 1).padStart(2, '0')}`, c[i]) } : {})
      }
    }))
  };
}

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('141 perfect positive correlation', () => {
  const ds = aligned([100, 101, 103, 102, 105], [200, 202, 206, 204, 210]);
  const r = RealPortfolioAnalytics.calculate(ds, 3);
  assert.ok(Math.abs(r.correlationMatrix.values[0][1] - 1) < 1e-10);
});

test('142 covariance matrix symmetric', () => {
  const r = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104, 103], [50, 49, 51, 52, 50]), 3);
  assert.ok(Math.abs(r.covarianceMatrix.values[0][1] - r.covarianceMatrix.values[1][0]) < 1e-15);
});

test('143 diagonal correlation equals one', () => {
  const r = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104], [50, 49, 51, 52]), 2);
  assert.equal(r.correlationMatrix.values[0][0], 1);
  assert.equal(r.correlationMatrix.values[1][1], 1);
});

test('144 observations equal bars minus one', () => {
  const r = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104], [50, 49, 51, 52]), 2);
  assert.equal(r.observations, 3);
});

test('145 equal weight sums to one', () => {
  const ds = aligned([100, 102, 104, 105], [50, 51, 52, 53]);
  const a = DeterministicPortfolioAllocator.allocate(ds, { method: 'EQUAL_WEIGHT' });
  assert.ok(Math.abs(Object.values(a.weights).reduce((x, y) => x + y, 0) - 1) < 1e-12);
});

test('146 inverse volatility favors lower volatility asset', () => {
  const ds = aligned([100, 120, 90, 130, 95, 140], [100, 101, 102, 103, 104, 105]);
  const a = DeterministicPortfolioAllocator.allocate(ds, { method: 'INVERSE_VOLATILITY' });
  assert.ok(a.weights.B > a.weights.A);
});

test('147 risk parity weights are positive and normalized', () => {
  const ds = aligned([100, 104, 102, 108, 105, 110], [100, 101, 103, 102, 104, 105]);
  const a = DeterministicPortfolioAllocator.allocate(ds, { method: 'RISK_PARITY_ERC' });
  assert.ok(Object.values(a.weights).every(x => x > 0));
  assert.ok(Math.abs(Object.values(a.weights).reduce((x, y) => x + y, 0) - 1) < 1e-10);
});

test('148 relative momentum selects strongest positive asset', () => {
  const ds = aligned([100, 105, 110, 115, 120], [100, 99, 98, 97, 96]);
  const a = DeterministicPortfolioAllocator.allocate(ds, { method: 'RELATIVE_MOMENTUM', lookbackBars: 4, topK: 1 });
  assert.equal(a.weights.A, 1);
  assert.equal(a.weights.B, 0);
});

test('149 relative momentum goes to cash when all below threshold', () => {
  const ds = aligned([100, 99, 98, 97], [100, 98, 97, 96]);
  const a = DeterministicPortfolioAllocator.allocate(ds, { method: 'RELATIVE_MOMENTUM', lookbackBars: 3, topK: 1, minimumMomentumPct: 0 });
  assert.equal(a.cashWeight, 1);
  assert.equal(Object.values(a.weights).reduce((x, y) => x + y, 0), 0);
});

test('150 pairwise correlation summary bounded', () => {
  const r = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104, 105], [50, 49, 51, 52, 50]), 3);
  assert.ok((r.averagePairwiseCorrelation ?? 0) <= 1 && (r.averagePairwiseCorrelation ?? 0) >= -1);
});

test('151 momentum uses requested trailing lookback', () => {
  const ds = aligned([100, 50, 60, 70, 84], [100, 200, 190, 180, 170]);
  const r = RealPortfolioAnalytics.calculate(ds, 2);
  const a = r.assetStatistics.find(x => x.assetId === 'A')!;
  assert.ok(Math.abs((a.momentumReturnPct ?? 0) - 40) < 1e-10);
});

test('152 insufficient observations rejected', () => {
  assert.throws(() => RealPortfolioAnalytics.calculate(aligned([100, 101], [100, 99]), 1));
});

test('161 risk contributions sum to 100 percent', () => {
  const analytics = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104, 106], [100, 99, 101, 100, 102]), 3);
  const risk = PortfolioRiskAnalyzer.analyze(analytics, { A: 0.5, B: 0.5 });
  const sum = risk.contributions.reduce((s, x) => s + (x.riskContributionPct ?? 0), 0);
  assert.ok(Math.abs(sum - 100) < 1e-8);
});

test('162 diversification ratio is positive for invested portfolio', () => {
  const analytics = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104, 106], [100, 99, 101, 100, 102]), 3);
  const risk = PortfolioRiskAnalyzer.analyze(analytics, { A: 0.5, B: 0.5 });
  assert.ok((risk.diversificationRatio ?? 0) > 0);
});

test('163 effective number of equally weighted assets equals two', () => {
  const analytics = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104], [100, 99, 101, 100]), 2);
  const risk = PortfolioRiskAnalyzer.analyze(analytics, { A: 0.5, B: 0.5 });
  assert.ok(Math.abs((risk.effectiveNumberOfAssets ?? 0) - 2) < 1e-12);
});

test('164 cash-only portfolio reports zero volatility', () => {
  const analytics = RealPortfolioAnalytics.calculate(aligned([100, 102, 101, 104], [100, 99, 101, 100]), 2);
  const risk = PortfolioRiskAnalyzer.analyze(analytics, { A: 0, B: 0 });
  assert.equal(risk.portfolioAnnualizedVolatilityPct, 0);
  assert.equal(risk.diversificationRatio, null);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}
console.log(`\nPortfolio Analytics: ${passed}/${tests.length} tests passed.`);
