import assert from 'node:assert/strict';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import { appendTrendProtectionV2Counterfactual } from '../src/investment/decision/trendProtectionCounterfactual';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string { return new Date(Date.UTC(2021, 0, 1 + i)).toISOString(); }
function trendBars(mode: 'risk' | 'defensive') {
  let price = mode === 'risk' ? 55 : 90;
  return Array.from({ length: 760 }, (_, i) => {
    if (mode === 'risk') {
      const drift = i < 470 ? 0.0018 : i < 555 ? -0.0065 : i < 650 ? 0.0013 : 0.0005;
      price *= 1 + drift + Math.sin(i / 23) * 0.0002;
    } else {
      price *= 1.00015 + Math.sin(i / 31) * 0.00005;
    }
    return { timestamp: dateAt(i), open: price * 0.999, high: price * 1.003, low: price * 0.997, close: price, volume: 1000 + i };
  });
}

const catalog: AssetUniverseItem[] = [
  { assetId: 'EQ_RISK_TEST', ticker: 'RISK.DE', name: 'Risk Test', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'DEF_TEST', ticker: 'DEF.DE', name: 'Defensive Test', category: 'GOV_BONDS', currency: 'EUR', instrumentType: 'ETF_ETC', defensive: true }
];
const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: [
    { assetId: 'EQ_RISK_TEST', ticker: 'RISK.DE', name: 'Risk Test', currency: 'EUR', bars: trendBars('risk'), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'RISK.DE', isReproducible: true, datasetFingerprint: 'risk-v2-ab' } },
    { assetId: 'DEF_TEST', ticker: 'DEF.DE', name: 'Defensive Test', currency: 'EUR', bars: trendBars('defensive'), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'DEF.DE', isReproducible: true, datasetFingerprint: 'def-v2-ab' } }
  ]
};
const startDate = dateAt(330).slice(0, 10);
const baseline = DynamicHistoricalReplayEngine.run({
  dataset,
  catalog,
  startDate,
  frequency: 'WEEKLY',
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252
});

const baselineSnapshot = {
  finalValueEur: baseline.finalValueEur,
  totalReturnPct: baseline.totalReturnPct,
  executedBuys: baseline.executedBuys,
  executedAdds: baseline.executedAdds,
  executedReductions: baseline.executedReductions,
  executedExits: baseline.executedExits,
  signalCount: baseline.signals.length
};

appendTrendProtectionV2Counterfactual({
  result: baseline,
  dataset,
  catalog,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }
});

const ab = baseline.trendProtectionV2Counterfactual;
assert.ok(ab, 'V2 counterfactual must be attached to the baseline replay result');
assert.equal(ab.policy, 'TREND_PROTECTION_V2');
assert.equal(ab.methodology, 'FIXED_BASELINE_ENTRIES');
assert.equal(ab.entryParity.baselineExecutedEntries, baseline.signals.filter(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD')).length);
assert.equal(ab.entryParity.reproducedEntries, ab.trades.filter(trade => trade.source === 'BASELINE_ENTRY').length);
assert.equal(ab.valid, ab.entryParity.exact, 'economic A/B validity must be identical to exact entry parity');
assert.ok(ab.entryParity.reproducedEntries <= ab.entryParity.baselineExecutedEntries);
assert.ok(Number.isFinite(ab.finalValueEur) && Number.isFinite(ab.totalReturnPct) && Number.isFinite(ab.maxDrawdownPct));
assert.ok(ab.totalFeesEur >= 0 && ab.totalEstimatedTaxEur >= 0 && ab.turnoverEur >= 0);
assert.ok(ab.equityPath.length > 0 && ab.equityPath.every(point => Number.isFinite(point.equityEur)));
assert.ok(ab.trades.filter(trade => trade.source === 'TREND_PROTECTION_V2').every(trade => trade.executionDate > trade.signalDate), 'V2 management must execute strictly after its causal signal');
assert.equal(
  ab.executedReductions + ab.executedExits,
  ab.trades.filter(trade => trade.source === 'TREND_PROTECTION_V2').length,
  'all V2 management executions must reconcile with the trade ledger'
);
assert.deepEqual(
  {
    finalValueEur: baseline.finalValueEur,
    totalReturnPct: baseline.totalReturnPct,
    executedBuys: baseline.executedBuys,
    executedAdds: baseline.executedAdds,
    executedReductions: baseline.executedReductions,
    executedExits: baseline.executedExits,
    signalCount: baseline.signals.length
  },
  baselineSnapshot,
  'attaching the A/B audit must not mutate baseline economics or baseline signals'
);

console.log('TREND_PROTECTION_COUNTERFACTUAL_RESULT', JSON.stringify({
  valid: ab.valid,
  entryParity: ab.entryParity,
  baselineReturnPct: baseline.totalReturnPct,
  v2ReturnPct: ab.totalReturnPct,
  deltaReturnPctPoints: ab.deltaVsCurrentPolicy.returnPctPoints,
  baselineMaxDrawdownPct: baseline.decisionPathMaxDrawdownPct,
  v2MaxDrawdownPct: ab.maxDrawdownPct,
  v2Reductions: ab.executedReductions,
  v2Exits: ab.executedExits
}));
