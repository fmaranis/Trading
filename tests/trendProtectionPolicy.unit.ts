import assert from 'node:assert/strict';
import { classifyTrendProtectionV1, classifyTrendProtectionV2, profitCaptureRatioPct } from '../src/investment/decision/trendProtectionPolicy';
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

const healthyAssessment = assessment('HEALTHY_UPTREND', {
  trendStructure: {
    ...assessment('HEALTHY_UPTREND').trendStructure,
    regressionSlope20AnnualizedPct: 18,
    regressionSlope60AnnualizedPct: 12,
    sma20Slope20AnnualizedPct: 15,
    breakdown20: false,
    state: 'HEALTHY_UPTREND'
  }
});
const healthyWinner = classifyTrendProtectionV1(healthyAssessment, {
  currentReturnPct: 22,
  mfePct: 25,
  givebackFromMfePctPoints: 3,
  isDiversifiedCore: false
});
assert.equal(healthyWinner.action, 'HOLD');

const failedAssessment = assessment('DOWNTREND', {
  consensusScore: -3,
  unfavorableVotes: 4,
  favorableVotes: 0
});
const failedSatellite = classifyTrendProtectionV1(failedAssessment, {
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

// V2: a first break is protection state, not an immediate trade.
const v2FreshWinner = classifyTrendProtectionV2(assessment('BREAKDOWN_RISK', {
  consensusScore: 5,
  unfavorableVotes: 0
}), {
  currentReturnPct: 10,
  mfePct: 20,
  givebackFromMfePctPoints: 10,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 0,
  protectionObservations: 1,
  protectionReferenceReturnPct: 10
});
assert.equal(v2FreshWinner.action, 'PROTECT');
assert.equal(v2FreshWinner.suggestedReductionPct, null);
assert.equal(v2FreshWinner.confirmationStage, 'ARMED');

// Winner can confirm deterioration even while broad consensus remains positive:
// after PROTECT has been observed repeatedly, another >=2 pp loss from the armed
// reference is enough for a small partial reduction.
const v2ConfirmedWinner = classifyTrendProtectionV2(assessment('BREAKDOWN_RISK', {
  consensusScore: 5,
  unfavorableVotes: 0
}), {
  currentReturnPct: 7.5,
  mfePct: 20,
  givebackFromMfePctPoints: 12.5,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 0,
  protectionObservations: 3,
  protectionReferenceReturnPct: 10
});
assert.equal(v2ConfirmedWinner.action, 'REDUCE');
assert.equal(v2ConfirmedWinner.suggestedReductionPct, 25);
assert.equal(v2ConfirmedWinner.confirmationStage, 'CONFIRMED');

// A protected winner that rebounds from the armed reference must not be reduced
// merely because the current trend snapshot is still classified as a break.
const v2RecoveringProtectedWinner = classifyTrendProtectionV2(assessment('DOWNTREND', {
  consensusScore: 3,
  unfavorableVotes: 0
}), {
  currentReturnPct: 7,
  mfePct: 20,
  givebackFromMfePctPoints: 13,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 0,
  protectionObservations: 3,
  protectionReferenceReturnPct: 4
});
assert.equal(v2RecoveringProtectedWinner.action, 'PROTECT');
assert.equal(v2RecoveringProtectedWinner.suggestedReductionPct, null);

const v2HealthyWinner = classifyTrendProtectionV2(healthyAssessment, {
  currentReturnPct: 18,
  mfePct: 25,
  givebackFromMfePctPoints: 7,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 0,
  protectionObservations: 4,
  protectionReferenceReturnPct: 10
});
assert.equal(v2HealthyWinner.action, 'HOLD');
assert.equal(v2HealthyWinner.reclaimDetected, true);

// Sanofi-like case: deep loss + downtrend on a fresh break must not liquidate 100%.
const v2FreshLoser = classifyTrendProtectionV2(failedAssessment, {
  currentReturnPct: -16.4,
  mfePct: 0,
  givebackFromMfePctPoints: 16.4,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 2
});
assert.equal(v2FreshLoser.action, 'PROTECT');
assert.equal(v2FreshLoser.suggestedReductionPct, null);

const v2ConfirmedLoser = classifyTrendProtectionV2(failedAssessment, {
  currentReturnPct: -16.4,
  mfePct: 0,
  givebackFromMfePctPoints: 16.4,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 6
});
assert.equal(v2ConfirmedLoser.action, 'REDUCE');
assert.equal(v2ConfirmedLoser.suggestedReductionPct, 25);

const v2HardLoser = classifyTrendProtectionV2(failedAssessment, {
  currentReturnPct: -20,
  mfePct: 0,
  givebackFromMfePctPoints: 20,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 10
});
assert.equal(v2HardLoser.action, 'EXIT');
assert.equal(v2HardLoser.suggestedReductionPct, 100);
assert.equal(v2HardLoser.confirmationStage, 'PERSISTENT');

const v2Core = classifyTrendProtectionV2(assessment('BREAKDOWN_RISK', {
  consensusScore: -2,
  unfavorableVotes: 3,
  favorableVotes: 1
}), {
  currentReturnPct: -13,
  mfePct: 2,
  givebackFromMfePctPoints: 15,
  isDiversifiedCore: true,
  deteriorationStreakSessions: 6
});
assert.equal(v2Core.action, 'REDUCE');
assert.equal(v2Core.suggestedReductionPct, 25);

assert.equal(profitCaptureRatioPct(10, 20), 50);
assert.equal(profitCaptureRatioPct(-3, 20), null);
assert.equal(profitCaptureRatioPct(5, 0), null);

console.log('TREND_PROTECTION_POLICY_RESULT', JSON.stringify({
  v1: {
    winner: winner.action,
    healthyWinner: healthyWinner.action,
    failedSatellite: failedSatellite.action,
    failedCore: failedCore.action
  },
  v2: {
    freshWinner: v2FreshWinner.action,
    confirmedWinner: v2ConfirmedWinner.action,
    recoveringWinner: v2RecoveringProtectedWinner.action,
    healthyWinner: v2HealthyWinner.action,
    freshLoser: v2FreshLoser.action,
    confirmedLoser: v2ConfirmedLoser.action,
    hardLoser: v2HardLoser.action,
    failedCore: v2Core.action
  }
}));
