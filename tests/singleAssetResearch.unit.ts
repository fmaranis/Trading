import assert from 'node:assert/strict';
import { SingleAssetResearchEngine, convertUsdBarsToEurCausally } from '../src/investment/decision';
import type { PriceBar } from '../src/investment/backtesting/types';

function makeBars(): PriceBar[] {
  const bars: PriceBar[] = [];
  const start = Date.UTC(2022, 0, 1);
  let price = 100;
  for (let i = 0; i < 950; i++) {
    if (i < 520) price *= 1.0015;
    else if (i < 760) price *= 0.996;
    else price *= 1.002;
    const date = new Date(start + i * 86_400_000).toISOString();
    bars.push({ timestamp: date, open: price * 0.999, high: price * 1.005, low: price * 0.995, close: price, volume: 1000 });
  }
  return bars;
}

const bars = makeBars();
const result = SingleAssetResearchEngine.run({
  symbol: 'TEST', bars, displayStartDate: '2023-01-01', frequency: 'MONTHLY', cashBenchmarkAnnualPct: 2.5
});

assert.equal(result.symbol, 'TEST');
assert.ok(result.chart.length > 500, 'selected period should be charted');
assert.ok(result.reviews > 10, 'monthly causal reviews should exist');
assert.ok(result.signals.some(s => s.action === 'BUY'), 'rising regime should create a buy marker');
assert.ok(result.signals.some(s => s.action === 'SELL'), 'structural falling regime should create a sell marker');
assert.ok(result.signals.every(s => s.executionDate > s.signalDate), 'every marker executes strictly after its signal date');
assert.ok(result.signals.every(s => Number.isFinite(s.executionPrice) && s.executionPrice > 0), 'every marker has a real next-bar execution price');
assert.ok(result.buyHoldReturnPct != null && Number.isFinite(result.buyHoldReturnPct));
assert.ok(result.assetMaxDrawdownPct != null && result.assetMaxDrawdownPct > 0);

const weekly = SingleAssetResearchEngine.run({
  symbol: 'TEST', bars, displayStartDate: '2023-01-01', frequency: 'WEEKLY', cashBenchmarkAnnualPct: 2.5
});
assert.ok(weekly.reviews > result.reviews * 3, 'weekly cadence should review materially more often than monthly');
assert.ok(weekly.signals.every(s => s.executionDate > s.signalDate), 'weekly signals must preserve strict NEXT_OPEN causality');
assert.ok(weekly.signals.every(s => Number.isFinite(s.executionPrice) && s.executionPrice > 0), 'weekly markers must use a valid next-bar execution price');

const cutoff = '2023-09-01';
const baseBefore = weekly.signals.filter(s => s.signalDate <= cutoff).map(s => `${s.action}:${s.signalDate}:${s.executionDate}`);
const altered = bars.map((bar, i) => i > 700 ? { ...bar, open: bar.open * 5, high: bar.high * 5, low: bar.low * 5, close: bar.close * 5 } : bar);
const alteredResult = SingleAssetResearchEngine.run({
  symbol: 'TEST', bars: altered, displayStartDate: '2023-01-01', frequency: 'WEEKLY', cashBenchmarkAnnualPct: 2.5
});
const alteredBefore = alteredResult.signals.filter(s => s.signalDate <= cutoff).map(s => `${s.action}:${s.signalDate}:${s.executionDate}`);
assert.deepEqual(alteredBefore, baseBefore, 'future prices must not change earlier weekly research signals');


assert.ok(result.currentCandidateGate?.status === 'ELIGIBLE' || result.currentCandidateGate?.status === 'REJECTED',
  'single-asset current research must use the existing PortfolioCandidateGate without a separate policy');

const usd = [
  { timestamp: '2026-01-02T00:00:00.000Z', open: 100, high: 110, low: 95, close: 105, volume: 100 },
  { timestamp: '2026-01-05T00:00:00.000Z', open: 120, high: 125, low: 110, close: 118, volume: 150 }
];
const fx = [
  { timestamp: '2026-01-01T00:00:00.000Z', open: 1.2, high: 1.21, low: 1.19, close: 1.2 },
  { timestamp: '2026-01-02T00:00:00.000Z', open: 1.25, high: 1.27, low: 1.23, close: 1.25 },
  { timestamp: '2026-01-05T00:00:00.000Z', open: 1.8, high: 1.85, low: 1.75, close: 1.8 }
];
const converted = convertUsdBarsToEurCausally(usd, fx);
assert.equal(converted.fxPair, 'EURUSD=X');
assert.equal(converted.bars[0].close, 105 / 1.2, 'Friday must use Thursday USD/EUR FX close');
assert.equal(converted.bars[1].open, 120 / 1.25, 'Monday NEXT_OPEN must use prior Friday FX, not Monday future FX');
assert.equal(converted.fxObservationDate, '2026-01-02');
assert.equal(converted.maxObservedFxAgeDays, 3);
const futureFxChanged = fx.map(bar => bar.timestamp.startsWith('2026-01-05') ? { ...bar, close: 100 } : bar);
assert.deepEqual(convertUsdBarsToEurCausally(usd, futureFxChanged).bars, converted.bars,
  'FX observed on or after a quote date cannot change the earlier research signal or NEXT_OPEN mark');
assert.throws(() => convertUsdBarsToEurCausally(usd, fx.slice(2)), /USD_FX_MISSING_OR_STALE/,
  'missing prior REAL FX must block rather than invent a conversion');
assert.throws(() => convertUsdBarsToEurCausally(usd, fx.map(row => ({ ...row, close: 0 }))), /USD_FX_MISSING_OR_STALE/,
  'invalid REAL FX must block, with no synthetic fallback');
assert.throws(() => convertUsdBarsToEurCausally(usd, []), /USD_FX_REAL_HISTORY_REQUIRED/,
  'USD asset data alone is insufficient to assert EUR comparable returns');

console.log(`Single Asset Research: weekly=${weekly.reviews} reviews, monthly=${result.reviews}; causal BUY/SELL and future isolation passed.`);