import assert from 'node:assert/strict';
import {
  selectDynamicReplayBatchStartDates,
  summarizeDynamicReplayBatch,
  type DynamicHistoricalReplayResult,
  type DynamicReplayBatchCase
} from '../src/investment/decision';

function dataset(multiplier: number): any {
  const make = (assetId: string, offset: number) => ({
    assetId,
    ticker: `${assetId}.DE`,
    name: assetId,
    currency: 'EUR',
    provenance: { sourceType: 'REAL', provider: 'unit', symbol: assetId, isReproducible: true },
    bars: Array.from({ length: 900 }, (_, i) => {
      const price = (100 + offset) * Math.pow(multiplier, i);
      const timestamp = new Date(Date.UTC(2022, 0, 1 + i)).toISOString();
      return { timestamp, open: price, high: price, low: price, close: price, volume: 1000 };
    })
  });
  return { timeframe: '1d', assets: [make('A', 0), make('B', 5)] };
}

const datesA = selectDynamicReplayBatchStartDates(dataset(1.001), { minimumBars: 252, minimumForwardSessions: 126, maxCases: 8 });
const datesB = selectDynamicReplayBatchStartDates(dataset(0.999), { minimumBars: 252, minimumForwardSessions: 126, maxCases: 8 });
assert.equal(datesA.length, 8, 'the selector should cap the diagnostic sample');
assert.deepEqual(datesA, datesB, 'start-date selection must be independent of observed returns');
assert.ok(datesA.every((date, i) => i === 0 || date > datesA[i - 1]), 'selected dates must be strictly chronological');

function result(input: {
  final: number;
  ret: number;
  cashExcess: number;
  staticExcess: number | null;
  staticPp: number | null;
  dd: number;
  defensive?: boolean;
  executedDefensive?: boolean;
}): DynamicHistoricalReplayResult {
  return {
    requestedStartDate: '2024-01-01', startDate: '2024-01-01', endDate: '2025-01-01', frequency: 'MONTHLY', initialCapitalEur: 10000,
    finalValueEur: input.final, totalReturnPct: input.ret,
    staticBuyHoldFinalEur: input.staticExcess == null ? null : input.final - input.staticExcess,
    staticBuyHoldReturnPct: input.staticPp == null ? null : input.ret - input.staticPp,
    allCashFinalEur: input.final - input.cashExcess, allCashReturnPct: 2,
    excessFinalEurVsStatic: input.staticExcess, excessReturnVsStaticPctPoints: input.staticPp,
    excessFinalEurVsCash: input.cashExcess, excessReturnVsCashPctPoints: input.ret - 2,
    structuralCoreBenchmarkAssetId: null,
    structuralCoreBenchmarkTicker: null,
    structuralCoreBenchmarkStartDate: null,
    structuralCoreBenchmarkEndDate: null,
    structuralCoreBenchmarkFinalEur: null,
    structuralCoreBenchmarkReturnPct: null,
    structuralCoreBenchmarkCagrPct: null,
    structuralCoreBenchmarkMaxDrawdownPct: null,
    excessFinalEurVsStructuralCore: null,
    excessReturnVsStructuralCorePctPoints: null,
    beatsStructuralCoreBenchmark: null,
    decisionPathMaxDrawdownPct: input.dd, decisions: 12, materialSignals: 1, executedBuys: 2, executedAdds: 0,
    executedReductions: input.executedDefensive ? 1 : 0, executedExits: 0,
    timingStateCounts: { WAIT: 0, ENTRY_READY: 0, ENTRY_STRONG: 0 },
    trendProtectionV1Counts: { HOLD: 0, WATCH: 0, REDUCE: 0, EXIT: 0, winnerProtectionArmed: 0, loserFailureArmed: 0, earlierProtectionCandidates: 0 },
    deploymentHorizons: [],
    totalFeesEur: 0, totalEstimatedTaxEur: 0, totalTransferredEur: 0,
    cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0', cashBenchmarkFixedAnnualPct: 2.5,
    cashInterestEur: 10, cashInterestTaxEur: 0, cashInterestNetEur: 10,
    taxMethod: 'CONSERVATIVE_MAX_RATE', operationalParity: 'CURRENT_IN_UNIVERSE_CHAIN',
    signals: input.defensive ? [{ action: 'REDUCE' } as any] : [], events: [], equityPath: [], notes: []
  };
}

const monthly1 = result({ final: 11200, ret: 12, cashExcess: 900, staticExcess: 200, staticPp: 2, dd: 8 });
const monthly2 = result({ final: 9800, ret: -2, cashExcess: -400, staticExcess: -300, staticPp: -3, dd: 22, defensive: true, executedDefensive: true });
const monthly3 = result({ final: 10600, ret: 6, cashExcess: 250, staticExcess: 0, staticPp: 0, dd: 14 });
const daily2 = result({ final: 10050, ret: 0.5, cashExcess: -150, staticExcess: -50, staticPp: -0.5, dd: 17, defensive: true, executedDefensive: true });
daily2.frequency = 'DAILY';

const cases: DynamicReplayBatchCase[] = [
  { startDate: '2023-01-01', monthly: monthly1, dailyStress: null },
  { startDate: '2023-07-01', monthly: monthly2, dailyStress: daily2 },
  { startDate: '2024-01-01', monthly: monthly3, dailyStress: null }
];
const summary = summarizeDynamicReplayBatch(cases.map(row => row.startDate), cases);
assert.equal(summary.successfulMonthlyCases, 3);
assert.equal(summary.monthlyBeatsCashCases, 2);
assert.equal(summary.monthlyBeatsStaticCases, 1);
assert.equal(summary.monthlyDefensiveSignalCases, 1);
assert.equal(summary.monthlyExecutedDefensiveCases, 1);
assert.equal(summary.dailyStressCases, 1);
assert.equal(summary.dailyBetterThanMonthlyCases, 1);
assert.equal(summary.dailyReducedDrawdownCases, 1);
assert.equal(summary.dailyDefensiveSignalCases, 1);
assert.equal(summary.monthlyWorstExcessVsStaticPctPoints, -3);
assert.equal(summary.monthlyMedianExcessVsStaticPctPoints, 0);

console.log('Dynamic Historical Replay Batch: chronology-only sampling + robustness aggregation invariants passed.');