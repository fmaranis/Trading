import assert from 'node:assert/strict';
import { StrategyConsensusEngine } from '../src/investment/decision/strategyConsensusEngine';
import type { AssetUniverseScanResult, AssetScanCandidate } from '../src/investment/decision/assetUniverseScanner';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string { return new Date(Date.UTC(2024, 0, 1 + i)).toISOString(); }
function makeBars(mode: 'healthyDip' | 'structuralFall') {
  let price = 100;
  return Array.from({ length: 320 }, (_, i) => {
    if (mode === 'healthyDip') price *= i < 300 ? 1.0012 : 0.996;
    else price *= 0.9985;
    return { timestamp: dateAt(i), open: price, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 };
  });
}
function pct(prices: number[], n: number): number { return (prices.at(-1)! / prices[prices.length - 1 - n] - 1) * 100; }
function candidate(asset: AssetUniverseItem, bars: ReturnType<typeof makeBars>): AssetScanCandidate {
  const prices = bars.map(b => b.close);
  return { asset, status: 'ACCEPTED', bars: bars.length, asOfDate: bars.at(-1)!.timestamp.slice(0, 10), lastClose: prices.at(-1)!, momentum20Pct: pct(prices, 20), momentum60Pct: pct(prices, 60), momentum120Pct: pct(prices, 120), annualizedVolatilityPct: asset.assetId === 'FALL' ? 24 : 14, maxDrawdownPct: asset.assetId === 'FALL' ? 38 : 12, score: 1 };
}

const healthy: AssetUniverseItem = { assetId: 'HEALTHY', ticker: 'HEALTHY.DE', name: 'Healthy Dip', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' };
const fall: AssetUniverseItem = { assetId: 'FALL', ticker: 'FALL.DE', name: 'Structural Fall', category: 'US_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' };
const healthyBars = makeBars('healthyDip');
const fallBars = makeBars('structuralFall');
const candidates = [candidate(healthy, healthyBars), candidate(fall, fallBars)];
const dataset: MultiAssetDataset = { timeframe: '1d', assets: [
  { assetId: healthy.assetId, ticker: healthy.ticker, name: healthy.name, currency: 'EUR', bars: healthyBars, provenance: { sourceType: 'REAL', provider: 'test', symbol: healthy.ticker, isReproducible: true, datasetFingerprint: 'healthy' } },
  { assetId: fall.assetId, ticker: fall.ticker, name: fall.name, currency: 'EUR', bars: fallBars, provenance: { sourceType: 'REAL', provider: 'test', symbol: fall.ticker, isReproducible: true, datasetFingerprint: 'fall' } }
] };
const scan: AssetUniverseScanResult = { scanned: 2, accepted: 2, rejected: 0, selected: candidates, candidates, dataset, acceptedDataset: dataset, rejectionCounts: {} };

const dip = StrategyConsensusEngine.assess(scan, 'HEALTHY', 2.5)!;
assert.ok(dip);
assert.equal(dip.structuralDowntrend, false);
assert.equal(dip.buyTheDipCandidate, true, 'healthy long trend plus controlled oversold drawdown should be detected as buy-the-dip candidate');
assert.notEqual(dip.existingPositionAction, 'REDUCE_REVIEW', 'a recent weak window alone must not trigger an existing-position reduction');
assert.ok(dip.votes.some(v => v.id === 'MEAN_REVERSION' && v.score === 1));
assert.ok(Number.isFinite(dip.trendStructure.regressionSlope20AnnualizedPct));
assert.ok(Number.isFinite(dip.trendStructure.regressionSlope60AnnualizedPct));
assert.equal(typeof dip.trendStructure.breakdown20, 'boolean');

const broken = StrategyConsensusEngine.assess(scan, 'FALL', 2.5)!;
assert.equal(broken.structuralDowntrend, true);
assert.equal(broken.existingPositionAction, 'REDUCE_REVIEW', 'structural deterioration confirmed by several signals may trigger reduction review');
assert.ok(broken.unfavorableVotes >= 3);
assert.ok((broken.trendStructure.regressionSlope20AnnualizedPct ?? 0) < 0);
assert.ok((broken.trendStructure.regressionSlope60AnnualizedPct ?? 0) < 0);
assert.ok(['DOWNTREND', 'BREAKDOWN_RISK'].includes(broken.trendStructure.state));

console.log('Strategy Consensus: 13/13 trend/mean-reversion/sell-protection invariants passed.');
