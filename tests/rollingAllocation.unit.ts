import assert from 'node:assert/strict';
import { PortfolioBacktestEngine } from '../src/investment/portfolioBacktesting';
import { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function makeBars(start: string, count: number, drift: number, wobble = 0) {
  const d0 = new Date(`${start}T00:00:00.000Z`);
  const bars = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const d = new Date(d0.getTime() + i * 86400000);
    price = Math.max(1, price * (1 + drift + (i % 2 === 0 ? wobble : -wobble)));
    bars.push({ timestamp: d.toISOString(), open: price, high: price, low: price, close: price, volume: 1000 });
  }
  return bars;
}

function dataset(): MultiAssetDataset {
  const provenance = { sourceType: 'SYNTHETIC' as const, provider: 'unit', timeframe: '1d', isReproducible: true };
  return {
    timeframe: '1d',
    assets: [
      { assetId: 'UP', ticker: 'UP', name: 'Up', currency: 'USD', bars: makeBars('2024-01-01', 100, 0.004, 0.001), provenance },
      { assetId: 'DOWN', ticker: 'DOWN', name: 'Down', currency: 'USD', bars: makeBars('2024-01-01', 100, -0.001, 0.001), provenance }
    ]
  };
}

const base = {
  initialCapital: 10000,
  commissionPct: 0,
  slippagePct: 0,
  rebalanceFrequency: 'MONTHLY' as const,
  executionMode: 'NEXT_OPEN' as const,
  targetWeights: {},
  rebalanceTolerancePct: 0,
  alignmentPolicy: 'INTERSECTION' as const
};

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('153 warm-up remains cash', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, dynamicAllocation: { method: 'RELATIVE_MOMENTUM', lookbackBars: 10, minimumHistoryBars: 10, topK: 1 } });
  assert.equal(r.equityCurve.slice(0, 10).every(p => Math.abs(p.cash - 10000) < 1e-9 && p.positionsValue === 0), true);
});

test('154 first dynamic allocation uses only prior information', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, dynamicAllocation: { method: 'RELATIVE_MOMENTUM', lookbackBars: 10, minimumHistoryBars: 10, topK: 1 } });
  const first = r.allocationHistory[0];
  assert.ok(first);
  assert.ok(first.informationEndDate < first.executionDate);
});

test('155 momentum selects rising asset', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, dynamicAllocation: { method: 'RELATIVE_MOMENTUM', lookbackBars: 10, minimumHistoryBars: 10, topK: 1 } });
  assert.equal(r.allocationHistory[0].weights.UP, 1);
  assert.equal(r.allocationHistory[0].weights.DOWN, 0);
});

test('156 allocation history is auditable and chronological', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, dynamicAllocation: { method: 'INVERSE_VOLATILITY', lookbackBars: 15, minimumHistoryBars: 15 } });
  assert.ok(r.allocationHistory.length >= 2);
  for (const point of r.allocationHistory) assert.ok(point.informationEndDate < point.executionDate);
  for (let i = 1; i < r.allocationHistory.length; i++) assert.ok(r.allocationHistory[i - 1].executionDate < r.allocationHistory[i].executionDate);
});

test('157 dynamic portfolio accounting remains exact', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, dynamicAllocation: { method: 'INVERSE_VOLATILITY', lookbackBars: 15, minimumHistoryBars: 15 } });
  for (const p of r.equityCurve) assert.ok(Math.abs(p.equity - p.cash - p.positionsValue) <= 0.01);
});

test('158 cash never negative under dynamic allocation', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, commissionPct: 0.05, slippagePct: 0.02, dynamicAllocation: { method: 'RISK_PARITY_ERC', lookbackBars: 20, minimumHistoryBars: 20 } });
  assert.ok(r.equityCurve.every(p => p.cash >= -0.001));
});

test('159 minimum cash scales dynamic weights', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, minimumCashPct: 20, dynamicAllocation: { method: 'RELATIVE_MOMENTUM', lookbackBars: 10, minimumHistoryBars: 10, topK: 1 } });
  const sum = Object.values(r.allocationHistory[0].weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 0.8) < 1e-12);
  assert.ok(Math.abs(r.allocationHistory[0].cashWeight - 0.2) < 1e-12);
});

test('160 static mode still allocates at first open', () => {
  const r = PortfolioBacktestEngine.run(dataset(), { ...base, targetWeights: { UP: 0.5, DOWN: 0.5 } });
  assert.equal(r.allocationHistory[0].method, 'STATIC');
  assert.equal(r.allocationHistory[0].executionDate, '2024-01-01');
  assert.ok(r.trades.length >= 2);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}`); throw err; }
}
console.log(`\nRolling Allocation: ${passed}/${tests.length} tests passed.`);
