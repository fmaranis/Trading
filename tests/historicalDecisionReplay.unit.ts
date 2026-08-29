import assert from 'node:assert/strict';
import { HistoricalDecisionReplayEngine } from '../src/investment/decision/historicalDecisionReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string { return new Date(Date.UTC(2022, 0, 1 + i)).toISOString(); }
function bars(start: number, drift: number, futureShock = false) {
  let price = start;
  return Array.from({ length: 900 }, (_, i) => {
    price *= 1 + drift + Math.sin(i / 23) * 0.0004;
    if (futureShock && i > 700) price *= 1.01;
    return { timestamp: dateAt(i), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 + i };
  });
}
const catalog: AssetUniverseItem[] = [
  { assetId: 'A', ticker: 'A.DE', name: 'Asset A', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'B', ticker: 'B.DE', name: 'Asset B', category: 'GOV_BONDS', currency: 'EUR', instrumentType: 'ETF_ETC', defensive: true }
];
function dataset(shock = false): MultiAssetDataset {
  return { timeframe: '1d', assets: [
    { assetId: 'A', ticker: 'A.DE', name: 'Asset A', currency: 'EUR', bars: bars(50, 0.0007, shock), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'A.DE', isReproducible: true, datasetFingerprint: shock ? 'a2' : 'a1' } },
    { assetId: 'B', ticker: 'B.DE', name: 'Asset B', currency: 'EUR', bars: bars(90, 0.00015, false), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'B.DE', isReproducible: true, datasetFingerprint: 'b1' } }
  ] };
}

const requestedDate = dateAt(500).slice(0, 10);
const base = HistoricalDecisionReplayEngine.run({ dataset: dataset(false), catalog, requestedDates: [requestedDate], initialCapitalEur: 10000, riskProfile: 'MEDIUM', horizonYears: 3, cashBenchmarkAnnualPct: 2.5 });
assert.equal(base.successfulCases, 1);
const first = base.cases[0];
assert.ok(first.decisionDate <= requestedDate, 'decision may only use data available on/before requested date');
assert.ok(first.executionDate == null || first.executionDate > first.decisionDate, 'execution must occur strictly after the decision information date');
assert.ok(Number.isFinite(first.finalValueEur));
assert.ok(Number.isFinite(first.allCashFinalEur));
assert.ok(first.allocations.every(a => a.entryDate == null || a.entryDate > first.decisionDate));

const shocked = HistoricalDecisionReplayEngine.run({ dataset: dataset(true), catalog, requestedDates: [requestedDate], initialCapitalEur: 10000, riskProfile: 'MEDIUM', horizonYears: 3, cashBenchmarkAnnualPct: 2.5 });
const second = shocked.cases[0];
assert.equal(second.decisionDate, first.decisionDate);
assert.equal(second.method, first.method);
assert.equal(second.regime, first.regime, 'future price shocks must not alter the historical regime decision');
assert.deepEqual(second.allocations.map(a => [a.assetId, Number(a.targetWeight.toFixed(10))]), first.allocations.map(a => [a.assetId, Number(a.targetWeight.toFixed(10))]), 'future prices must not alter historical target weights');
assert.notEqual(second.finalValueEur, first.finalValueEur, 'future prices may affect outcome, but not the prior decision');

console.log('Historical Decision Replay: 10/10 causality and execution invariants passed.');
