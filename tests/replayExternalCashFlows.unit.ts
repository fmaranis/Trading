import assert from 'node:assert/strict';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { DynamicHistoricalReplayEngine } from '../src/investment/decision/dynamicHistoricalReplay';
import {
  cashFlowAdjustedPerformance,
  normalizeReplayExternalCashFlows
} from '../src/investment/decision/replayExternalCashFlows';

function dateAt(i: number): string {
  return new Date(Date.UTC(2020, 0, 1 + i)).toISOString();
}

const catalog: AssetUniverseItem[] = [
  { assetId: 'CASH_TEST', ticker: 'CASH.DE', name: 'Cash Flow Test Asset', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' }
];

const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: [{
    assetId: 'CASH_TEST',
    ticker: 'CASH.DE',
    name: 'Cash Flow Test Asset',
    currency: 'EUR',
    bars: Array.from({ length: 320 }, (_, i) => ({
      timestamp: dateAt(i),
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1_000
    })),
    provenance: {
      sourceType: 'REAL',
      provider: 'test',
      symbol: 'CASH.DE',
      isReproducible: true,
      datasetFingerprint: 'cash-flow-test'
    }
  }]
};

const startDate = dateAt(250).slice(0, 10);
const common = {
  dataset,
  catalog,
  startDate,
  frequency: 'MONTHLY' as const,
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM' as const,
  horizonYears: 3 as const,
  cashBenchmarkMode: 'FIXED_USER_RATE' as const,
  cashBenchmarkAnnualPct: 0,
  minimumBars: 252,
  simulationMode: 'HOLD_ONLY' as const
};

const noFlows = DynamicHistoricalReplayEngine.run(common);
const explicitEmpty = DynamicHistoricalReplayEngine.run({ ...common, externalCashFlows: [] });
assert.deepEqual(explicitEmpty, noFlows, 'externalCashFlows=[] must preserve exact replay parity with the no-flow path');
assert.equal(noFlows.externalCashFlowMode, 'NONE');
assert.equal(noFlows.totalExternalContributionsEur, 0);
assert.equal(noFlows.totalExternalWithdrawalsEur, 0);
assert.equal(noFlows.netExternalCashFlowEur, 0);
assert.equal(noFlows.frequency, 'MONTHLY');
assert.equal(noFlows.appliedExternalCashFlows.length, 0, 'MONTHLY decision cadence must never create implicit contributions');

const contributionDate = dateAt(270).slice(0, 10);
const withdrawalDate = dateAt(285).slice(0, 10);
const withFlows = DynamicHistoricalReplayEngine.run({
  ...common,
  externalCashFlows: [
    { id: 'contribution', date: contributionDate, amountEur: 1_000, kind: 'CONTRIBUTION', label: 'Explicit contribution' },
    { id: 'withdrawal', date: withdrawalDate, amountEur: -500, kind: 'WITHDRAWAL', label: 'Explicit withdrawal' }
  ]
});

assert.equal(withFlows.externalCashFlowMode, 'EXPLICIT');
assert.equal(withFlows.appliedExternalCashFlows.length, 2);
assert.deepEqual(
  withFlows.appliedExternalCashFlows.map(flow => [flow.scheduledDate, flow.appliedDate, flow.amountEur, flow.kind]),
  [
    [contributionDate, contributionDate, 1_000, 'CONTRIBUTION'],
    [withdrawalDate, withdrawalDate, -500, 'WITHDRAWAL']
  ],
  'HOLD_ONLY must apply already-valid external flows on their scheduled dates without lookahead'
);
assert.equal(withFlows.totalExternalContributionsEur, 1_000);
assert.equal(withFlows.totalExternalWithdrawalsEur, 500);
assert.equal(withFlows.netExternalCashFlowEur, 500);
assert.ok(Math.abs(withFlows.finalValueEur - 10_500) < 0.01, 'with 0% cash rate the final cash must be initial + contribution - withdrawal');
assert.ok(Math.abs(withFlows.cashFlowAdjustedProfitEur) < 0.01, 'external money itself must not be reported as investment profit');
assert.ok(Math.abs(withFlows.cashFlowAdjustedReturnPct) < 1e-9, 'external money itself must not create investment return');
assert.ok(Math.abs(withFlows.totalReturnPct) < 1e-9, 'flow-aware totalReturnPct must use the adjusted return semantics');
assert.ok(Math.abs(withFlows.allCashFinalEur - 10_500) < 0.01, 'all-cash benchmark must receive the same explicit flows');
assert.ok(Math.abs(withFlows.allCashReturnPct) < 1e-9, 'all-cash benchmark must not count contributions as return');
assert.equal(withFlows.structuralCoreBenchmarkFinalEur, null, 'structural benchmark V1 must be N/D when it cannot receive the same external flows');
assert.ok(withFlows.equityPath.some(point => point.externalCashFlowEur === 1_000));
assert.ok(withFlows.equityPath.some(point => point.externalCashFlowEur === -500));

const accounting = cashFlowAdjustedPerformance({
  finalValueEur: 12_000,
  initialCapitalEur: 10_000,
  appliedFlows: [
    { id: 'c', scheduledDate: contributionDate, appliedDate: contributionDate, amountEur: 1_000, kind: 'CONTRIBUTION', label: 'c' },
    { id: 'w', scheduledDate: withdrawalDate, appliedDate: withdrawalDate, amountEur: -500, kind: 'WITHDRAWAL', label: 'w' }
  ]
});
assert.equal(accounting.profitEur, 1_500);
assert.ok(Math.abs(accounting.returnPct - (1_500 / 11_000 * 100)) < 1e-9);

assert.throws(
  () => normalizeReplayExternalCashFlows([{ date: contributionDate, amountEur: -100, kind: 'CONTRIBUTION' }], startDate, dateAt(319).slice(0, 10)),
  /REPLAY_EXTERNAL_CASH_FLOW_KIND_AMOUNT_MISMATCH/,
  'cash-flow kind must agree with amount sign'
);
assert.throws(
  () => DynamicHistoricalReplayEngine.run({
    ...common,
    externalCashFlows: [{ date: contributionDate, amountEur: -20_000, kind: 'WITHDRAWAL' }]
  }),
  /REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_CASH/,
  'withdrawals must never trigger a hidden forced sale when cash is insufficient'
);

console.log('replayExternalCashFlows.unit: PASS');
