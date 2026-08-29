import assert from 'node:assert/strict';
import { SingleAssetResearchEngine } from '../src/investment/decision';
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

const cutoff = '2023-09-01';
const baseBefore = result.signals.filter(s => s.signalDate <= cutoff).map(s => `${s.action}:${s.signalDate}:${s.executionDate}`);
const altered = bars.map((bar, i) => i > 700 ? { ...bar, open: bar.open * 5, high: bar.high * 5, low: bar.low * 5, close: bar.close * 5 } : bar);
const alteredResult = SingleAssetResearchEngine.run({
  symbol: 'TEST', bars: altered, displayStartDate: '2023-01-01', frequency: 'MONTHLY', cashBenchmarkAnnualPct: 2.5
});
const alteredBefore = alteredResult.signals.filter(s => s.signalDate <= cutoff).map(s => `${s.action}:${s.signalDate}:${s.executionDate}`);
assert.deepEqual(alteredBefore, baseBefore, 'future prices must not change earlier research signals');

console.log(`Single Asset Research: ${result.signals.length} markers, causal BUY/SELL and future isolation passed.`);