import assert from 'node:assert/strict';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';
import { adaptTrendProtectionV2ForWholeShareExecution, runDynamicReplayWithTrendProtectionV2Experiment } from '../src/investment/decision/replayTrendProtectionV2Experiment';
import { buildTrendProtectionV2ReplayComparison } from '../src/investment/decision/trendProtectionReplayComparison';
import type { TrendProtectionV2Decision } from '../src/investment/decision/trendProtectionPolicy';
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
    { assetId: 'EQ_RISK_TEST', ticker: 'RISK.DE', name: 'Risk Test', currency: 'EUR', bars: trendBars('risk'), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'RISK.DE', isReproducible: true, datasetFingerprint: 'risk-v2-full-ab' } },
    { assetId: 'DEF_TEST', ticker: 'DEF.DE', name: 'Defensive Test', currency: 'EUR', bars: trendBars('defensive'), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'DEF.DE', isReproducible: true, datasetFingerprint: 'def-v2-full-ab' } }
  ]
};
const startDate = dateAt(330).slice(0, 10);
const replayInput = {
  dataset,
  catalog,
  startDate,
  frequency: 'WEEKLY' as const,
  initialCapitalEur: 10_000,
  riskProfile: 'MEDIUM' as const,
  horizonYears: 3 as const,
  cashBenchmarkAnnualPct: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }
};

const reduceDecision: TrendProtectionV2Decision = {
  policy: 'TREND_PROTECTION_V2',
  action: 'REDUCE',
  suggestedReductionPct: 25,
  reason: 'fixture reduction',
  winnerProtectionArmed: true,
  loserFailureArmed: false,
  confirmationStage: 'CONFIRMED',
  reclaimDetected: false,
  trendState: 'BREAKDOWN_RISK'
};
const blockedWholeShare = adaptTrendProtectionV2ForWholeShareExecution(reduceDecision, 'ETF_ETC', 3);
assert.equal(blockedWholeShare.action, 'PROTECT', '25% of three whole ETF shares cannot execute and must remain PROTECT');
assert.equal(blockedWholeShare.suggestedReductionPct, null);
assert.match(blockedWholeShare.reason, /no ejecutable/i);
assert.equal(adaptTrendProtectionV2ForWholeShareExecution(reduceDecision, 'ETF_ETC', 4).action, 'REDUCE', 'four ETF shares can execute one-share REDUCE25');
assert.equal(adaptTrendProtectionV2ForWholeShareExecution(reduceDecision, 'MUTUAL_FUND', 0.25).action, 'REDUCE', 'fractional mutual-fund reductions remain executable');

const baseline = runDynamicReplayWithRotationExperiment(replayInput, 'CORE_GATE_V1');
const baselineSnapshot = {
  finalValueEur: baseline.finalValueEur,
  totalReturnPct: baseline.totalReturnPct,
  executedBuys: baseline.executedBuys,
  executedAdds: baseline.executedAdds,
  executedReductions: baseline.executedReductions,
  executedExits: baseline.executedExits,
  signalCount: baseline.signals.length
};

const v2 = runDynamicReplayWithTrendProtectionV2Experiment(replayInput);
const ab = buildTrendProtectionV2ReplayComparison({ baseline, v2, riskProfile: 'MEDIUM' });

assert.equal(ab.policy, 'TREND_PROTECTION_V2');
assert.equal(ab.methodology, 'FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE');
assert.equal(ab.valid, true, 'the executable V2 path must respect cash and slot constraints');
assert.equal(ab.portfolioConstraints.cashNeverNegative, true, 'V2 must never use negative cash/debt');
assert.ok(ab.portfolioConstraints.maxObservedPositions <= 12, 'MEDIUM V2 path must never close a day above 12 active positions');
assert.equal(ab.entryParity.baselineExecutedEntries, baseline.signals.filter(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD')).length);
assert.ok(ab.entryParity.reproducedEntries <= ab.entryParity.baselineExecutedEntries);
assert.ok(Number.isFinite(ab.finalValueEur) && Number.isFinite(ab.totalReturnPct) && Number.isFinite(ab.maxDrawdownPct));
assert.ok(ab.totalFeesEur >= 0 && ab.totalEstimatedTaxEur >= 0 && ab.turnoverEur >= 0);
assert.ok(ab.equityPath.length > 0 && ab.equityPath.every(point => Number.isFinite(point.equityEur) && point.cashEur >= -1e-6));
assert.ok(
  v2.signals.filter(signal => signal.executed && (signal.action === 'REDUCE' || signal.action === 'EXIT') && signal.reason.includes('[TREND_PROTECTION_V2:'))
    .every(signal => signal.executionDate != null && signal.executionDate > signal.signalDate),
  'V2 management must execute strictly after its causal signal'
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
  'running the V2 arm must not mutate baseline economics or signals'
);

console.log('TREND_PROTECTION_COUNTERFACTUAL_RESULT', JSON.stringify({
  valid: ab.valid,
  methodology: ab.methodology,
  entryParity: ab.entryParity,
  portfolioConstraints: ab.portfolioConstraints,
  baselineReturnPct: baseline.totalReturnPct,
  v2ReturnPct: ab.totalReturnPct,
  deltaReturnPctPoints: ab.deltaVsCurrentPolicy.returnPctPoints,
  baselineMaxDrawdownPct: baseline.decisionPathMaxDrawdownPct,
  v2MaxDrawdownPct: ab.maxDrawdownPct,
  v2Reductions: ab.executedReductions,
  v2Exits: ab.executedExits,
  wholeShareBlockedAction: blockedWholeShare.action
}));