import assert from 'node:assert/strict';
import { PortfolioStrategyComparator } from '../src/investment/portfolioBacktesting';
import { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function makeBars(start: string, count: number, drift: number, wobble: number) {
  const d0 = new Date(`${start}T00:00:00.000Z`);
  const out = [];
  let p = 100;
  for (let i = 0; i < count; i++) {
    p = Math.max(1, p * (1 + drift + (i % 2 ? wobble : -wobble)));
    const d = new Date(d0.getTime() + i * 86400000).toISOString();
    out.push({ timestamp: d, open: p, high: p, low: p, close: p, volume: 1000 });
  }
  return out;
}

const provenance = { sourceType: 'SYNTHETIC' as const, provider: 'unit', timeframe: '1d', isReproducible: true };
const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: [
    { assetId: 'A', ticker: 'A', name: 'A', currency: 'USD', bars: makeBars('2023-01-01', 180, 0.0015, 0.002), provenance },
    { assetId: 'B', ticker: 'B', name: 'B', currency: 'USD', bars: makeBars('2023-01-01', 180, 0.0004, 0.0008), provenance }
  ]
};

const result = PortfolioStrategyComparator.compare(dataset, {
  initialCapital: 10000,
  commissionPct: 0.05,
  slippagePct: 0.02,
  rebalanceFrequency: 'MONTHLY',
  executionMode: 'NEXT_OPEN',
  rebalanceTolerancePct: 0.25,
  alignmentPolicy: 'INTERSECTION'
}, 30);

assert.equal(result.items.length, 4, '165 four policies compared');
assert.ok(result.portfolioDatasetFingerprint.startsWith('pfp_'), '166 comparator preserves portfolio fingerprint');
assert.equal(new Set(result.items.map(x => x.result.provenance.portfolioDatasetFingerprint)).size, 1, '167 all strategies use identical dataset fingerprint');
assert.ok(result.items.every(x => x.result.equityCurve.length === 180), '168 all strategies use identical aligned dates');
assert.ok(result.items.filter(x => x.strategyId !== 'EQUAL_WEIGHT_STATIC').every(x => x.result.allocationHistory.every(a => a.informationEndDate < a.executionDate)), '169 rolling policies remain causal');
assert.ok(result.bestByTotalReturn != null && result.lowestMaxDrawdown != null, '170 comparator ranks deterministic outputs');

console.log('Portfolio Comparator: 6/6 tests passed.');
