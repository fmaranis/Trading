import assert from 'node:assert/strict';
import { DecisionBacktestEngine } from '../src/investment/decision';
import { MultiAssetDataset } from '../src/investment/portfolioBacktesting';

function dateAt(i: number): string {
  const d = new Date(Date.UTC(2020, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}

function priceSeries(start: number, drift: number, wobble: number, n = 620) {
  let p = start;
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + drift + Math.sin(i / 13) * wobble;
    return { timestamp: `${dateAt(i)}T00:00:00.000Z`, open: p * 0.999, high: p * 1.004, low: p * 0.996, close: p, volume: 1000 + i };
  });
}

function makeDataset(mutator?: (assetId: string, index: number, close: number) => number): MultiAssetDataset {
  const defs = [
    ['VWCE', 'VWCE.DE', 100, 0.0006, 0.0020],
    ['EQQQ', 'EQQQ.DE', 80, 0.0009, 0.0030],
    ['4GLD', '4GLD.DE', 50, 0.00025, 0.0013],
    ['VAGF', 'VAGF.DE', 25, 0.00012, 0.0007],
    ['XEON', 'XEON.DE', 140, 0.00005, 0.00015]
  ] as const;
  return {
    timeframe: '1d',
    assets: defs.map(([assetId, ticker, start, drift, wobble], idx) => {
      const raw = priceSeries(start, drift, wobble);
      const bars = raw.map((bar, i) => {
        const close = mutator ? mutator(assetId, i, bar.close) : bar.close;
        const ratio = close / bar.close;
        return { ...bar, open: bar.open * ratio, high: bar.high * ratio, low: bar.low * ratio, close };
      });
      return {
        assetId,
        ticker,
        name: ticker,
        currency: 'EUR',
        bars,
        provenance: { sourceType: 'REAL' as const, provider: 'test', symbol: ticker, isReproducible: false, datasetFingerprint: `fp_bt_${idx}` }
      };
    })
  };
}

const config = { initialCapital: 1000, riskProfile: 'MEDIUM' as const, horizonYears: 3 as const, commissionPct: 0.05, slippagePct: 0.02, rebalanceFrequency: 'MONTHLY' as const };
const base = DecisionBacktestEngine.run(makeDataset(), config);
assert.ok(base.rebalanceCount > 2);
assert.ok(base.totalTrades > 0);
assert.ok(base.finalEquity > 0);
assert.ok(base.totalCommissionEur >= 0);
assert.ok(base.totalSlippageEur >= 0);
assert.ok(base.maxDrawdownPct >= 0);
assert.equal(base.equityCurve.length, 620);
assert.ok(base.equityCurve.slice(0, 181).every(p => p.method === 'WARMUP_CASH'));

const mutated = DecisionBacktestEngine.run(makeDataset((assetId, i, close) => i >= 500 ? close * (assetId === 'EQQQ' ? 2.4 : 0.55) : close), config);
assert.deepEqual(
  base.equityCurve.slice(0, 499).map(p => [p.timestamp, p.equity, p.method, p.regime]),
  mutated.equityCurve.slice(0, 499).map(p => [p.timestamp, p.equity, p.method, p.regime])
);

console.log('Decision Backtest: 8/8 causal/accounting invariants passed.');
