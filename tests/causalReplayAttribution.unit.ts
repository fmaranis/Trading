import assert from 'node:assert/strict';
import { buildCurrentVsCoreCausalAttribution } from '../src/investment/decision/causalReplayAttribution';

function signal(input: {
  id: string;
  date: string;
  assetId: string;
  ticker: string;
  action: 'BUY' | 'ADD' | 'REDUCE' | 'EXIT';
  notionalEur: number;
  unitsDelta: number;
  realizedGainEur?: number;
}): any {
  return {
    id: input.id,
    signalDate: input.date,
    executionDate: input.date,
    assetId: input.assetId,
    ticker: input.ticker,
    action: input.action,
    targetWeight: 0,
    currentWeight: 0,
    recommendedAmountEur: input.notionalEur,
    consensusScore: 2,
    favorableVotes: 3,
    unfavorableVotes: 0,
    structuralDowntrend: false,
    buyTheDipCandidate: false,
    timingState: 'ENTRY_READY',
    timingSetup: null,
    timingScore: 50,
    suggestedInitialFraction: 0.3,
    executed: true,
    unitsDelta: input.unitsDelta,
    notionalEur: input.notionalEur,
    feeEur: 0,
    realizedGainEur: input.realizedGainEur ?? 0,
    estimatedTaxEur: 0,
    taxDeferredTransferEur: 0,
    executionPriceEur: 100,
    reason: 'fixture'
  };
}

function replay(input: {
  finalValueEur: number;
  totalReturnPct: number;
  signals: any[];
  equityPath: Array<{ date: string; equityEur: number; cashEur: number; investedEur: number }>;
}): any {
  return {
    requestedStartDate: '2020-01-01',
    startDate: '2020-01-01',
    endDate: '2020-01-31',
    frequency: 'DAILY',
    initialCapitalEur: 1000,
    finalValueEur: input.finalValueEur,
    totalReturnPct: input.totalReturnPct,
    signals: input.signals,
    equityPath: input.equityPath.map(point => ({ ...point, cashBenchmarkEur: 1000, regime: 'FIXTURE', method: 'FIXTURE' }))
  };
}

const current = replay({
  finalValueEur: 1050,
  totalReturnPct: 5,
  signals: [
    signal({ id: 'c1', date: '2020-01-02', assetId: 'A', ticker: 'A', action: 'BUY', notionalEur: 500, unitsDelta: 5 }),
    signal({ id: 'c2', date: '2020-01-03', assetId: 'B', ticker: 'B', action: 'BUY', notionalEur: 300, unitsDelta: 3 }),
    signal({ id: 'c3', date: '2020-01-10', assetId: 'A', ticker: 'A', action: 'REDUCE', notionalEur: 200, unitsDelta: -2, realizedGainEur: 20 })
  ],
  equityPath: [
    { date: '2020-01-02', equityEur: 1000, cashEur: 500, investedEur: 500 },
    { date: '2020-01-03', equityEur: 1010, cashEur: 200, investedEur: 810 },
    { date: '2020-01-31', equityEur: 1050, cashEur: 410, investedEur: 640 }
  ]
});

const v2 = replay({
  finalValueEur: 1020,
  totalReturnPct: 2,
  signals: [
    signal({ id: 'v1', date: '2020-01-02', assetId: 'A', ticker: 'A', action: 'BUY', notionalEur: 500, unitsDelta: 5 }),
    signal({ id: 'v2', date: '2020-01-03', assetId: 'C', ticker: 'C', action: 'BUY', notionalEur: 250, unitsDelta: 2.5 })
  ],
  equityPath: [
    { date: '2020-01-02', equityEur: 1000, cashEur: 500, investedEur: 500 },
    { date: '2020-01-03', equityEur: 1005, cashEur: 250, investedEur: 755 },
    { date: '2020-01-31', equityEur: 1020, cashEur: 260, investedEur: 760 }
  ]
});

const core = replay({
  finalValueEur: 1030,
  totalReturnPct: 3,
  signals: [
    signal({ id: 'h1', date: '2020-01-02', assetId: 'A', ticker: 'A', action: 'BUY', notionalEur: 500, unitsDelta: 5 }),
    signal({ id: 'h2', date: '2020-01-03', assetId: 'C', ticker: 'C', action: 'BUY', notionalEur: 250, unitsDelta: 2.5 }),
    signal({ id: 'h3', date: '2020-01-15', assetId: 'A', ticker: 'A', action: 'ADD', notionalEur: 100, unitsDelta: 1 })
  ],
  equityPath: [
    { date: '2020-01-02', equityEur: 1000, cashEur: 500, investedEur: 500 },
    { date: '2020-01-03', equityEur: 1005, cashEur: 250, investedEur: 755 },
    { date: '2020-01-31', equityEur: 1030, cashEur: 160, investedEur: 870 }
  ]
});

const result = buildCurrentVsCoreCausalAttribution({ current, trendProtectionV2: v2, strategicCore: core });

assert.equal(result.policy, 'CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1');
assert.equal(result.valid, true);
assert.equal(result.accountingIdentity.trendProtectionV2EffectEur, -30);
assert.equal(result.accountingIdentity.strategicCoreHoldIncrementalEffectEur, 10);
assert.equal(result.accountingIdentity.totalCoreVsCurrentEur, -20);
assert.equal(result.accountingIdentity.reconstructedCoreVsCurrentEur, -20);
assert.ok(Math.abs(result.accountingIdentity.residualEur) <= 1e-9);
assert.equal(result.accountingIdentity.reconcilesWithinOneCent, true);

assert.equal(result.firstCurrentVsCoreDivergence.date, '2020-01-03');
assert.ok(result.firstCurrentVsCoreDivergence.rows.some(row => row.assetId === 'B' && row.deltaCandidateMinusReferenceEur === -300));
assert.ok(result.firstCurrentVsCoreDivergence.rows.some(row => row.assetId === 'C' && row.deltaCandidateMinusReferenceEur === 250));
assert.equal(result.firstTrendProtectionV2Divergence.date, '2020-01-03');
assert.equal(result.firstStrategicCoreHoldDivergence.date, '2020-01-15');
assert.ok(result.firstStrategicCoreHoldDivergence.rows.some(row => row.assetId === 'A' && row.action === 'ADD' && row.deltaCandidateMinusReferenceEur === 100));

assert.equal(result.executedActionCounts.current.BUY, 2);
assert.equal(result.executedActionCounts.core.ADD, 1);
assert.ok(result.largestAssetAllocationDifferences.some(row => row.assetId === 'B' && row.deltaEntryEur === -300));
assert.ok(result.largestAssetAllocationDifferences.some(row => row.assetId === 'C' && row.deltaEntryEur === 250));
assert.equal(result.pathExposure.matchedDates, 3);
assert.ok((result.pathExposure.finalCashDeltaCoreMinusCurrentEur ?? 0) < 0, 'core fixture ends with less cash than current');
assert.ok((result.pathExposure.maxCurrentEquityAdvantageEur ?? 0) > 0, 'current fixture must lead core at some point');

console.log('CURRENT_CORE_CAUSAL_ATTRIBUTION_RESULT', JSON.stringify({
  valid: result.valid,
  identity: result.accountingIdentity,
  firstCurrentVsCoreDivergence: result.firstCurrentVsCoreDivergence,
  firstTrendProtectionV2Divergence: result.firstTrendProtectionV2Divergence,
  firstStrategicCoreHoldDivergence: result.firstStrategicCoreHoldDivergence,
  actionDelta: result.executedActionCounts.deltaCoreMinusCurrent,
  finalCashDeltaCoreMinusCurrentEur: result.pathExposure.finalCashDeltaCoreMinusCurrentEur
}));
