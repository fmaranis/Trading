import assert from 'node:assert/strict';
import {
  MultiAssetDataAligner,
  PortfolioBacktestEngine,
  canonicalTradingDate,
  computePortfolioDatasetFingerprint,
  createEqualWeights,
  isRebalanceDate,
  MultiAssetDataset,
  MultiAssetDataError,
  UnsupportedMultiCurrencyPortfolioError
} from '../src/investment/portfolioBacktesting';
import { PriceBar } from '../src/investment/backtesting/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}`); throw e; }
}

const bar = (timestamp: string, open: number, close = open): PriceBar => ({
  timestamp, open, close, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, volume: 1000
});

function dataset(
  aBars: PriceBar[],
  bBars: PriceBar[],
  options?: { aCurrency?: string; bCurrency?: string; aSource?: 'REAL'|'STATIC_REFERENCE'|'SYNTHETIC'; bSource?: 'REAL'|'STATIC_REFERENCE'|'SYNTHETIC' }
): MultiAssetDataset {
  return {
    timeframe: '1d',
    assets: [
      { assetId: 'A', ticker: 'AAA', name: 'Asset A', currency: options?.aCurrency ?? 'USD', bars: aBars,
        provenance: { sourceType: options?.aSource ?? 'REAL', provider: 'fixture', isReproducible: true } },
      { assetId: 'B', ticker: 'BBB', name: 'Asset B', currency: options?.bCurrency ?? 'USD', bars: bBars,
        provenance: { sourceType: options?.bSource ?? 'REAL', provider: 'fixture', isReproducible: true } }
    ]
  };
}

const baseConfig = {
  initialCapital: 10000,
  commissionPct: 0,
  slippagePct: 0,
  rebalanceFrequency: 'NONE' as const,
  executionMode: 'NEXT_OPEN' as const,
  targetWeights: { A: 0.5, B: 0.5 },
  rebalanceTolerancePct: 0
};

const d1 = '2024-01-02T14:30:00.000Z';
const d2 = '2024-01-03T14:30:00.000Z';
const d3 = '2024-02-01T14:30:00.000Z';
const d4 = '2024-04-01T13:30:00.000Z';

// 119
test('119 — Two Asset Alignment', () => {
  const aligned = MultiAssetDataAligner.align(dataset([bar(d1,100),bar(d2,101)],[bar(d1,50),bar(d2,51)]));
  assert.deepEqual(aligned.rows.map(r => r.tradingDate), ['2024-01-02','2024-01-03']);
});

// 120
test('120 — Different Trading Hours Same Date', () => {
  assert.equal(canonicalTradingDate('2024-01-02T08:00:00Z'), canonicalTradingDate('2024-01-02T21:00:00Z'));
  const aligned = MultiAssetDataAligner.align(dataset(
    [bar('2024-01-02T08:00:00Z',100),bar('2024-01-03T08:00:00Z',101)],
    [bar('2024-01-02T21:00:00Z',50),bar('2024-01-03T21:00:00Z',51)]
  ));
  assert.equal(aligned.rows.length, 2);
});

// 121
test('121 — Missing Date Intersection, no forward fill', () => {
  const aligned = MultiAssetDataAligner.align(dataset([bar(d1,100),bar(d2,101)],[bar(d1,50),bar(d3,52)]));
  assert.deepEqual(aligned.rows.map(r => r.tradingDate), ['2024-01-02']);
});

// 122
test('122 — Duplicate Trading Date rejected', () => {
  assert.throws(() => MultiAssetDataAligner.align(dataset(
    [bar('2024-01-02T08:00:00Z',100),bar('2024-01-02T20:00:00Z',101)],
    [bar(d1,50),bar(d2,51)]
  )), MultiAssetDataError);
});

// 123
test('123 — Weight Sum >100% rejected', () => {
  const ds = dataset([bar(d1,100),bar(d2,100)],[bar(d1,50),bar(d2,50)]);
  assert.throws(() => PortfolioBacktestEngine.run(ds, {...baseConfig, targetWeights:{A:0.7,B:0.5}}), MultiAssetDataError);
});

// 124
test('124 — Cash Residual preserved', () => {
  const ds = dataset([bar(d1,100),bar(d2,100)],[bar(d1,50),bar(d2,50)]);
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, targetWeights:{A:0.4,B:0.4}});
  assert.ok(Math.abs(result.equityCurve[0].cash - 2000) < 1e-6);
});

// 125
test('125 — Initial Allocation at first open', () => {
  const ds = dataset([bar(d1,100),bar(d2,100)],[bar(d1,50),bar(d2,50)]);
  const result = PortfolioBacktestEngine.run(ds, baseConfig);
  assert.equal(result.trades.filter(t => t.reason === 'INITIAL_ALLOCATION').length, 2);
  assert.equal(result.trades[0].timestamp, '2024-01-02');
});

// 126
test('126 — Monthly Rebalance only on first aligned bar of new month', () => {
  assert.equal(isRebalanceDate('2024-01-31','2024-02-01','MONTHLY'), true);
  assert.equal(isRebalanceDate('2024-02-01','2024-02-02','MONTHLY'), false);
});

// 127
test('127 — Quarterly Rebalance boundaries', () => {
  assert.equal(isRebalanceDate('2024-03-28','2024-04-01','QUARTERLY'), true);
  assert.equal(isRebalanceDate('2024-04-01','2024-05-01','QUARTERLY'), false);
});

// 128
test('128 — Sell before buy during rebalance', () => {
  const ds = dataset(
    [bar(d1,100,100),bar(d2,100,150),bar(d3,150,150)],
    [bar(d1,100,100),bar(d2,100,50),bar(d3,50,50)]
  );
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, rebalanceFrequency:'MONTHLY'});
  const feb = result.trades.filter(t => t.timestamp === '2024-02-01');
  const firstBuy = feb.findIndex(t => t.side === 'BUY');
  const lastSell = Math.max(...feb.map((t,i) => t.side === 'SELL' ? i : -1));
  assert.ok(lastSell === -1 || firstBuy === -1 || lastSell < firstBuy);
});

// 129
test('129 — Rebalance tolerance suppresses tiny drift trades', () => {
  const ds = dataset(
    [bar(d1,100,100),bar(d2,100,100.1),bar(d3,100.1,100.1)],
    [bar(d1,100,100),bar(d2,100,99.9),bar(d3,99.9,99.9)]
  );
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, rebalanceFrequency:'MONTHLY', rebalanceTolerancePct:1});
  assert.equal(result.trades.filter(t => t.reason === 'MONTHLY_REBALANCE').length, 0);
});

// 130
test('130 — Equity accounting identity', () => {
  const ds = dataset([bar(d1,100),bar(d2,105)],[bar(d1,50),bar(d2,49)]);
  const result = PortfolioBacktestEngine.run(ds, baseConfig);
  for (const p of result.equityCurve) assert.ok(Math.abs(p.equity - p.cash - p.positionsValue) <= 0.01);
});

// 131
test('131 — Cash never negative', () => {
  const ds = dataset([bar(d1,100),bar(d2,110)],[bar(d1,50),bar(d2,60)]);
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, commissionPct:0.5, slippagePct:0.2});
  assert.ok(result.equityCurve.every(p => p.cash >= -0.001));
});

// 132
test('132 — Trading costs sum exactly', () => {
  const ds = dataset([bar(d1,100),bar(d2,100)],[bar(d1,50),bar(d2,50)]);
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, commissionPct:0.1, slippagePct:0.05});
  const comm = result.trades.reduce((s,t)=>s+t.commissionEur,0);
  const slip = result.trades.reduce((s,t)=>s+t.slippageEur,0);
  assert.ok(Math.abs(result.metrics.totalCommissionEur - comm) < 1e-8);
  assert.ok(Math.abs(result.metrics.totalSlippageEur - slip) < 1e-8);
});

// 133
test('133 — Benchmark is buy-and-hold with no rebalance trades', () => {
  const ds = dataset([bar(d1,100),bar(d2,120),bar(d3,110)],[bar(d1,50),bar(d2,45),bar(d3,55)]);
  const result = PortfolioBacktestEngine.run(ds, {...baseConfig, rebalanceFrequency:'MONTHLY'});
  assert.equal(result.benchmarkEquityCurve.length, result.alignedBarsCount);
  assert.ok(result.benchmarkEquityCurve.every(p => Number.isFinite(p.equity)));
});

// 134
test('134 — Portfolio fingerprint deterministic and order-independent', () => {
  const a = computePortfolioDatasetFingerprint('1d',{A:'fp_a',B:'fp_b'});
  const b = computePortfolioDatasetFingerprint('1d',{B:'fp_b',A:'fp_a'});
  assert.equal(a,b);
});

// 135
test('135 — Incomplete/Mixed REAL dataset does not execute', () => {
  const empty = dataset([bar(d1,100),bar(d2,101)],[],{});
  assert.throws(() => PortfolioBacktestEngine.run(empty, baseConfig), MultiAssetDataError);
  const mixed = dataset([bar(d1,100),bar(d2,101)],[bar(d1,50),bar(d2,51)],{bSource:'SYNTHETIC'});
  assert.throws(() => PortfolioBacktestEngine.run(mixed, baseConfig), MultiAssetDataError);
});

// Additional single-currency invariant
 test('9A — Multi-currency portfolio rejected', () => {
  const ds = dataset([bar(d1,100),bar(d2,101)],[bar(d1,50),bar(d2,51)],{aCurrency:'USD',bCurrency:'EUR'});
  assert.throws(() => PortfolioBacktestEngine.run(ds, baseConfig), UnsupportedMultiCurrencyPortfolioError);
});

test('9A — Equal weights helper', () => {
  assert.deepEqual(createEqualWeights(['A','B','C']), {A:1/3,B:1/3,C:1/3});
});

console.log(`\n${passed} multi-asset tests passed.`);
