import assert from 'node:assert/strict';
import { classifyTrendProtectionV1, profitCaptureRatioPct } from '../src/investment/decision/trendProtectionPolicy';
import type { StrategyConsensusAssessment, TrendStructureState } from '../src/investment/decision/strategyConsensusEngine';

function assessment(state: TrendStructureState, overrides: Partial<StrategyConsensusAssessment> = {}): StrategyConsensusAssessment {
  return {
    assetId: 'TEST',
    ticker: 'TEST',
    name: 'Test asset',
    asOfDate: '2026-01-01',
    longReturnPct: 10,
    momentum120Pct: 8,
    momentum60Pct: 3,
    momentum20Pct: -2,
    rsi14: 45,
    distanceToSma200Pct: 3,
    currentDrawdownPct: -8,
    annualizedVolatilityPct: 20,
    trendStructure: {
      regressionSlope20AnnualizedPct: -15,
      regressionSlope60AnnualizedPct: 8,
      regressionSlope120AnnualizedPct: 10,
      slopeAcceleration20vs60PctPoints: -23,
      sma20Slope20AnnualizedPct: -10,
      sma50Slope20AnnualizedPct: 2,
      prior20High: 120,
      prior20Low: 105,
      breakout20: false,
      breakdown20: state === 'BREAKDOWN_RISK' || state === 'DOWNTREND',
      state
    },
    favorableVotes: 2,
    unfavorableVotes: 2,
    neutralVotes: 1,
    consensusScore: 0,
    votes: [],
    newMoneyAction: 'WATCH',
    existingPositionAction: 'HOLD',
    structuralDowntrend: false,
    buyTheDipCandidate: false,
    explanation: 'test',
    ...overrides
  };
}

const winner = classifyTrendProtectionV1(assessment('BREAKDOWN_RISK'), {
  currentReturnPct: 10,
  mfePct: 20,
  givebackFromMfePctPoints: 10,
  isDiversifiedCore: false
});
assert.equal(winner.action, 'REDUCE');
assert.equal(winner.suggestedReductionPct, 50);
assert.equal(winner.winnerProtectionArmed, true);

const healthyWinner = classifyTrendProtectionV1(assessment('HEALTHY_UPTREND', {
  trendStructure: {
    ...assessment('HEALTHY_UPTREND').trendStructure,
    regressionSlope20AnnualizedPct: 18,
    regressionSlope60AnnualizedPct: 12,
    sma20Slope20AnnualizedPct: 15,
    breakdown20: false,
    state: 'HEALTHY_UPTREND'
  }
}), {
  currentReturnPct: 22,
  mfePct: 25,
  givebackFromMfePctPoints: 3,
  isDiversifiedCore: false
});
assert.equal(healthyWinner.action, 'HOLD');

const failedSatellite = classifyTrendProtectionV1(assessment('DOWNTREND', {
  consensusScore: -3,
  unfavorableVotes: 4,
  favorableVotes: 0
}), {
  currentReturnPct: -16,
  mfePct: 1,
  givebackFromMfePctPoints: 17,
  isDiversifiedCore: false
});
assert.equal(failedSatellite.action, 'EXIT');
assert.equal(failedSatellite.loserFailureArmed, true);

const failedCore = classifyTrendProtectionV1(assessment('BREAKDOWN_RISK', {
  consensusScore: -2,
  unfavorableVotes: 3,
  favorableVotes: 1
}), {
  currentReturnPct: -13,
  mfePct: 2,
  givebackFromMfePctPoints: 15,
  isDiversifiedCore: true
});
assert.equal(failedCore.action, 'REDUCE');
assert.equal(failedCore.suggestedReductionPct, 50);

assert.equal(profitCaptureRatioPct(10, 20), 50);
assert.equal(profitCaptureRatioPct(-3, 20), null);
assert.equal(profitCaptureRatioPct(5, 0), null);

console.log('TREND_PROTECTION_POLICY_RESULT', JSON.stringify({
  winner: winner.action,
  healthyWinner: healthyWinner.action,
  failedSatellite: failedSatellite.action,
  failedCore: failedCore.action
}));
