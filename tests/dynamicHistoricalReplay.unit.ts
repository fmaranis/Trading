import assert from 'node:assert/strict';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
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
assert.ok(base.startDate >= startDate, 'reported replay start must never precede the requested start date');
assert.ok(base.signals.every(signal => signal.signalDate >= startDate), 'no signal may be dated before the requested replay boundary');
assert.ok(base.equityPath.every(point => point.date >= startDate), 'equity path must never contain points before the requested replay boundary');
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

const timingSignals = base.signals.filter(signal => signal.timingState != null);
assert.ok(timingSignals.length > 0, 'replay audit must retain Entry Timing observations inside chronological signals');
assert.equal(
  base.timingStateCounts.WAIT + base.timingStateCounts.ENTRY_READY + base.timingStateCounts.ENTRY_STRONG,
  timingSignals.length,
  'timing state counts must reconcile exactly with timing-aware signals'
);
assert.ok(base.signals.filter(signal => signal.action === 'BUY' || signal.action === 'ADD').every(signal => signal.timingState === 'ENTRY_READY' || signal.timingState === 'ENTRY_STRONG'), 'every funded new-money BUY/ADD must expose the timing state that authorized it');
for (const signal of timingSignals) {
  assert.ok(Number.isFinite(signal.timingScore), 'every timing-aware signal must retain its causal timing score');
  assert.ok(signal.timingSetup != null, 'every timing-aware signal must retain its setup');
  if (signal.timingState === 'WAIT') assert.equal(signal.suggestedInitialFraction, 0, 'WAIT must authorize zero initial fraction');
  if (signal.timingState === 'ENTRY_READY') assert.equal(signal.suggestedInitialFraction, 0.25, 'ENTRY_READY must retain the 25% tranche');
  if (signal.timingState === 'ENTRY_STRONG') assert.equal(signal.suggestedInitialFraction, 0.50, 'ENTRY_STRONG must retain the 50% tranche');
}
assert.deepEqual(base.deploymentHorizons.map(item => item.sessionsFromStart), [1, 5, 20, 60], 'deployment audit must expose the canonical 1/5/20/60-session horizons');
for (const horizon of base.deploymentHorizons) {
  if (horizon.date == null) continue;
  assert.equal(horizon.date, base.equityPath[horizon.sessionsFromStart]?.date, 'deployment horizon date must mean sessions elapsed from replay start, not array position including start as session one');
  assert.ok((horizon.netCommittedEur ?? -1) >= 0, 'net committed capital must be non-negative');
  assert.ok((horizon.netCommittedPctOfInitialCapital ?? -1) >= 0, 'committed percentage must be non-negative');
  assert.ok((horizon.investedMarketValueEur ?? -1) >= 0, 'market value invested must be non-negative');
  assert.ok((horizon.investedPctOfEquity ?? -1) >= 0, 'invested share of equity must be non-negative');
}

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
assert.ok(daily.signals.every(signal => signal.signalDate >= startDate), 'DAILY signals must respect the requested replay boundary');
assert.ok(monthlySameWindow.signals.every(signal => signal.signalDate >= startDate), 'MONTHLY signals must respect the requested replay boundary');

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
  .map(signal => [
    signal.signalDate,
    signal.assetId,
    signal.action,
    signal.consensusScore,
    signal.structuralDowntrend,
    signal.buyTheDipCandidate,
    signal.timingState,
    signal.timingSetup,
    signal.timingScore == null ? null : Number(signal.timingScore.toFixed(10)),
    signal.suggestedInitialFraction,
    Number(signal.targetWeight.toFixed(10))
  ]);
assert.deepEqual(before(shocked), before(base), 'prices changed only after the cutoff must not alter earlier dynamic signals, timing diagnostics or targets');
assert.notEqual(shocked.finalValueEur, base.finalValueEur, 'future prices may change final outcome while prior signals remain invariant');

// Reproduce the real 2022 short-vs-long failure mode at the scanner boundary.
// A dividend-adjusted provider may revise the whole historical prefix when a later
// dividend enters the requested range. The scanner must request split-adjusted
// Close (adjusted:false), making the common prefix invariant to the future end date.
const originalGetHistoricalBars = HistoricalMarketDataService.getHistoricalBars;
const adjustedFlags: Array<boolean | undefined> = [];
(HistoricalMarketDataService as any).getHistoricalBars = async (request: any) => {
  adjustedFlags.push(request.adjusted);
  const startMs = Date.parse(`${request.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${request.endDate}T00:00:00Z`);
  const laterDividendIncluded = request.endDate >= '2023-10-01';
  const dividendBoundaryMs = Date.parse('2023-10-01T00:00:00Z');
  const bars: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }> = [];
  let i = 0;
  for (let cursorMs = startMs; cursorMs <= endMs; cursorMs += 86_400_000) {
    const rawClose = 100 + i * 0.05 + Math.sin(i / 17) * 0.2;
    const hindsightDividendFactor = laterDividendIncluded && cursorMs < dividendBoundaryMs ? 0.91 : 1;
    const factor = request.adjusted === false ? 1 : hindsightDividendFactor;
    const close = rawClose * factor;
    bars.push({ timestamp: new Date(cursorMs).toISOString(), open: close * 0.999, high: close * 1.002, low: close * 0.998, close, volume: 1000 + i });
    i++;
  }
  return {
    bars,
    provenance: { sourceType: 'REAL', provider: 'prefix-test', symbol: request.symbol, isReproducible: true, datasetFingerprint: `prefix-${request.endDate}-${String(request.adjusted)}` },
    metadata: { providerId: 'prefix-test', providerName: 'Prefix Test', symbol: request.symbol, requestedStartDate: request.startDate, requestedEndDate: request.endDate, timeframe: '1d', adjusted: request.adjusted !== false, adjustmentStatus: request.adjusted === false ? 'UNADJUSTED' : 'ADJUSTED_DERIVED', fetchedAt: '2026-08-31T00:00:00.000Z', cached: false, currency: 'EUR' }
  };
};
try {
  const prefixUniverse: AssetUniverseItem[] = [
    { assetId: 'PREFIX', ticker: 'PREFIX.DE', name: 'Prefix Invariance Asset', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' }
  ];
  const prefixStart = '2022-01-01';
  const shortEnd = '2023-08-31';
  const longEnd = '2024-02-29';
  const shortScan = await AssetUniverseScanner.scan(prefixUniverse, prefixStart, shortEnd, { minimumBars: 200, maxDataAgeDays: 2, maxSelected: 1 });
  const longScan = await AssetUniverseScanner.scan(prefixUniverse, prefixStart, longEnd, { minimumBars: 200, maxDataAgeDays: 2, maxSelected: 1 });
  const shortBars = shortScan.acceptedDataset.assets[0].bars;
  const longPrefix = longScan.acceptedDataset.assets[0].bars.filter(bar => bar.timestamp.slice(0, 10) <= shortEnd);
  assert.ok(adjustedFlags.length >= 2 && adjustedFlags.every(flag => flag === false), 'universe scanner must request split-adjusted Close without retrospective dividend adjustment');
  assert.deepEqual(
    longPrefix.map(bar => [bar.timestamp, bar.open, bar.high, bar.low, bar.close]),
    shortBars.map(bar => [bar.timestamp, bar.open, bar.high, bar.low, bar.close]),
    'extending the requested end date must not rewrite the shared market-data prefix'
  );
} finally {
  (HistoricalMarketDataService as any).getHistoricalBars = originalGetHistoricalBars;
}

console.log('Dynamic Historical Replay: causal boundary, timing audit, staged deployment horizons, market-data prefix invariance, costs/tax accounting and future isolation passed.');
