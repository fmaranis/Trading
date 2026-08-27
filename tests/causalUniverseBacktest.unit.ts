import assert from 'node:assert/strict';
import { AssetUniverseItem, CausalUniverseBacktestEngine } from '../src/investment/decision';
import { MultiAssetDataset } from '../src/investment/portfolioBacktesting';

function dateAt(i: number): string {
  const d = new Date(Date.UTC(2019, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}

function series(start: number, drift: number, wobble: number, n = 760) {
  let p = start;
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + drift + Math.sin(i / 17) * wobble;
    return { timestamp: `${dateAt(i)}T00:00:00.000Z`, open: p * 0.999, high: p * 1.004, low: p * 0.996, close: p, volume: 1000 + i };
  });
}

const catalog: AssetUniverseItem[] = [
  { assetId: 'A', ticker: 'A.DE', name: 'A', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'B', ticker: 'B.DE', name: 'B', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'C', ticker: 'C.DE', name: 'C', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'D', ticker: 'D.DE', name: 'D', category: 'GOV_BONDS', currency: 'EUR', defensive: true },
  { assetId: 'E', ticker: 'E.DE', name: 'E', category: 'MONEY_MARKET', currency: 'EUR', defensive: true },
  { assetId: 'F', ticker: 'F.DE', name: 'F', category: 'HEALTHCARE', currency: 'EUR' }
];

function dataset(mutator?: (id: string, i: number, close: number) => number): MultiAssetDataset {
  const defs = [
    ['A', 100, 0.00055, 0.0016], ['B', 80, 0.00075, 0.0022], ['C', 65, 0.00035, 0.0014],
    ['D', 100, 0.00010, 0.00035], ['E', 140, 0.00004, 0.00010], ['F', 50, 0.00045, 0.0018]
  ] as const;
  return {
    timeframe: '1d',
    assets: defs.map(([id, start, drift, wobble], idx) => {
      const raw = series(start, drift, wobble);
      return {
        assetId: id,
        ticker: `${id}.DE`,
        name: id,
        currency: 'EUR',
        bars: raw.map((bar, i) => {
          const close = mutator ? mutator(id, i, bar.close) : bar.close;
          const ratio = close / bar.close;
          return { ...bar, open: bar.open * ratio, high: bar.high * ratio, low: bar.low * ratio, close };
        }),
        provenance: { sourceType: 'REAL' as const, provider: 'test', symbol: `${id}.DE`, isReproducible: false, datasetFingerprint: `fp_causal_${idx}` }
      };
    })
  };
}

const config = { initialCapital: 1000, riskProfile: 'MEDIUM' as const, horizonYears: 3 as const, commissionPct: 0.05, slippagePct: 0.02, rebalanceFrequency: 'MONTHLY' as const };
const base = CausalUniverseBacktestEngine.run(dataset(), catalog, config, 4);
assert.equal(base.scope, 'CAUSAL_SELECTION_WITHIN_CURRENTLY_VALIDATED_UNIVERSE');
assert.ok(base.rebalanceCount > 3);
assert.ok(base.selectionHistory.length === base.rebalanceCount);
assert.ok(base.selectionHistory.every(x => x.informationEndDate < x.executionDate));
assert.ok(base.selectionHistory.every(x => x.selectedTickers.length >= 2 && x.selectedTickers.length <= 4));
assert.ok(base.totalTrades > 0);
assert.ok(base.finalEquity > 0);

const mutated = CausalUniverseBacktestEngine.run(dataset((id, i, close) => i >= 620 ? close * (id === 'B' ? 3.0 : 0.45) : close), catalog, config, 4);
const cutoff = dateAt(619);
assert.deepEqual(
  base.selectionHistory.filter(x => x.executionDate <= cutoff).map(x => [x.informationEndDate, x.executionDate, x.selectedTickers, x.scores]),
  mutated.selectionHistory.filter(x => x.executionDate <= cutoff).map(x => [x.informationEndDate, x.executionDate, x.selectedTickers, x.scores])
);
assert.deepEqual(
  base.equityCurve.filter(x => x.timestamp <= cutoff).map(x => [x.timestamp, Number(x.equity.toFixed(8))]),
  mutated.equityCurve.filter(x => x.timestamp <= cutoff).map(x => [x.timestamp, Number(x.equity.toFixed(8))])
);

console.log('Causal Universe Backtest: 8/8 selection/lookahead/accounting invariants passed.');
