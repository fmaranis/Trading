import assert from 'node:assert/strict';

function adjustedOpen(bar) {
  const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  if (!finitePositive(bar?.open) || !finitePositive(bar?.close) || !finitePositive(bar?.adjClose)) return null;
  return Number(bar.open) * (Number(bar.adjClose) / Number(bar.close));
}

function yahooSymbol(symbol) {
  const [exchange, tickerRaw] = String(symbol).split(':');
  const ticker = tickerRaw ?? exchange;
  return ticker.replace(/\./g, '-');
}

assert.equal(yahooSymbol('NASDAQ:AAPL'), 'AAPL');
assert.equal(yahooSymbol('NYSE:BRK.B'), 'BRK-B');
assert.ok(Math.abs(adjustedOpen({ open: 100, close: 110, adjClose: 99 }) - 90) < 1e-12);
assert.equal(adjustedOpen({ open: 100, close: 0, adjClose: 99 }), null);
assert.equal(adjustedOpen({ open: null, close: 100, adjClose: 100 }), null);

const symbols = ['AAPL','MSFT','SPY','URTH'];
const dates = {
  AAPL: ['2026-09-28','2026-09-29'],
  MSFT: ['2026-09-29'],
  SPY: ['2026-09-28','2026-09-29'],
  URTH: ['2026-09-28','2026-09-29']
};
const candidates = dates.SPY;
const common = candidates.find(date => symbols.every(symbol => dates[symbol]?.includes(date)));
assert.equal(common, '2026-09-29');

console.log('CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_START_UNIT_PASS');
