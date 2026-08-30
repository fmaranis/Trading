import assert from 'node:assert/strict';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string { return new Date(Date.UTC(2020, 0, 1 + i)).toISOString(); }
function riskBars(futureShock = false) {
  let price = 50;
  return Array.from({ length: 1050 }, (_, i) => {
    const drift = i < 550 ? 0.0015 : i < 660 ? -0.008 : i < 780 ? 0.0012 : 0.00045;
    price *= 1 + drift + Math.sin(i / 19) * 0.00025;
    if (futureShock && i > 850) price *= 1.004;
    return { timestamp: dateAt(i), open: price * 0.999, high: price * 1.003, low: price * 0.997, close: price, volume: 1000 + i };
  });
}
function defensiveBars() {
  let price = 90;
  return Array.from({ length: 1050 }, (_, i) => {
    price *= 1.00012 + Math.sin(i / 31) * 0.00008;
    return { timestamp: dateAt(i), open: price * 0.9998, high: price * 1.0005, low: price * 0.9995, close: price, volume: 900 + i };
  });
}

const catalog: AssetUniverseItem[] = [
  { assetId: 'RISK', ticker: 'RISK.DE', name: 'Risk Asset', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'DEF', ticker: 'DEF.DE', name: 'Defensive Asset', category: 'GOV_BONDS', currency: 'EUR', instrumentType: 'ETF_ETC', defensive: true }
];
function dataset(futureShock = false, bars = 1050): MultiAssetDataset {
  return {
    timeframe: '1d',
    assets: [
      { assetId: 'RISK', ticker: 'RISK.DE', name: 'Risk Asset', currency: 'EUR', bars: riskBars(futureShock).slice(0, bars), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'RISK.DE', isReproducible: true, datasetFingerprint: futureShock ? 'risk-future-shock' : 'risk-base' } },
      { assetId: 'DEF', ticker: 'DEF.DE', name: 'Defensive Asset', currency: 'EUR', bars: defensiveBars().slice(0, bars), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'DEF.DE', isReproducible: true, datasetFingerprint: 'def-base' } }
    ]
  };
}

const startDate = dateAt(400).slice(0, 10);
const base = DynamicHistoricalReplayEngine.run({
  dataset: dataset(false),
  catalog,
  startDate,
  frequency: 'MONTHLY',
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252
});

assert.ok(base.decisions > 10, 'dynamic replay must revisit the portfolio repeatedly');
assert.ok(base.signals.some(signal => (signal.action === 'BUY' || signal.action === 'ADD') && signal.executed), 'the rising regime should produce at least one executable buy/add signal');
assert.ok(base.signals.some(signal => (signal.action === 'REDUCE' || signal.action === 'EXIT') && signal.executed), 'the engineered structural collapse should produce an executable reduce/exit signal');
assert.ok(base.signals.filter(signal => signal.action === 'REDUCE' || signal.action === 'EXIT').every(signal => signal.structuralDowntrend && (signal.unfavorableVotes ?? 0) >= 3), 'sell-side signals require structural deterioration plus several adverse votes');
assert.ok(base.signals.filter(signal => signal.executed).every(signal => signal.executionDate != null && signal.executionDate > signal.signalDate), 'every trade must execute strictly after the information date');
assert.ok(Number.isFinite(base.finalValueEur));
assert.ok(Number.isFinite(base.allCashFinalEur));
assert.ok(base.staticBuyHoldFinalEur != null && Number.isFinite(base.staticBuyHoldFinalEur));
assert.ok(base.totalFeesEur >= 0);
assert.ok(base.totalEstimatedTaxEur >= 0, 'tax friction must be explicitly accounted for');
assert.ok(base.totalTransferredEur >= 0, 'tax-deferred fund transfer accounting must be explicit even when the test has no funds');
assert.ok(base.cashInterestEur >= 0);
assert.ok(base.equityPath.length > base.decisions, 'portfolio equity must be valued on a denser session path than decision dates');
assert.ok(base.equityPath.every(point => Number.isFinite(point.equityEur) && Number.isFinite(point.cashBenchmarkEur)), 'every chart point must carry portfolio and cash benchmark values');
assert.ok(base.events.every(event => Number.isFinite(event.amountEur) && event.feeEur >= 0 && event.taxEur >= 0), 'operation ledger must expose finite amounts, fees and taxes');

const daily = DynamicHistoricalReplayEngine.run({
  dataset: dataset(false, 560),
  catalog,
  startDate,
  frequency: 'DAILY',
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252
});
const monthlySameWindow = DynamicHistoricalReplayEngine.run({
  dataset: dataset(false, 560),
  catalog,
  startDate,
  frequency: 'MONTHLY',
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252
});
assert.equal(daily.frequency, 'DAILY');
assert.ok(daily.decisions > monthlySameWindow.decisions, 'DAILY mode must genuinely re-evaluate more often than MONTHLY mode');
assert.ok(daily.equityPath.length >= daily.decisions, 'DAILY replay must still provide a coherent session-valued equity path');

const shocked = DynamicHistoricalReplayEngine.run({
  dataset: dataset(true),
  catalog,
  startDate,
  frequency: 'MONTHLY',
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252
});
const isolationCutoff = dateAt(820).slice(0, 10);
const before = (result: typeof base) => result.signals
  .filter(signal => signal.signalDate <= isolationCutoff)
  .map(signal => [signal.signalDate, signal.assetId, signal.action, signal.consensusScore, signal.structuralDowntrend, signal.buyTheDipCandidate, Number(signal.targetWeight.toFixed(10))]);
assert.deepEqual(before(shocked), before(base), 'prices changed only after the cutoff must not alter earlier dynamic signals or targets');
assert.notEqual(shocked.finalValueEur, base.finalValueEur, 'future prices may change final outcome while prior signals remain invariant');

console.log('Dynamic Historical Replay: causal daily/monthly decisions, dense equity path, costs/tax accounting and future isolation passed.');