import assert from 'node:assert/strict';
import type { StrategyConsensusAssessment, TrendStructureState } from '../src/investment/decision/strategyConsensusEngine';
import { classifyTrendProtectionV2 } from '../src/investment/decision/trendProtectionPolicy';
import { classifyTrendProtectionV2WithMediumTermWinnerConfirm } from '../src/investment/decision/trendProtectionV2MediumTermConfirm';

function assessment(overrides: Partial<StrategyConsensusAssessment> = {}): StrategyConsensusAssessment {
  const state: TrendStructureState = 'BREAKDOWN_RISK';
  return {
    assetId: 'TEST',
    ticker: 'TEST',
    name: 'Test asset',
    asOfDate: '2026-01-01',
    longReturnPct: 20,
    momentum120Pct: 12,
    momentum60Pct: 5,
    momentum20Pct: -8,
    rsi14: 42,
    distanceToSma200Pct: 5,
    currentDrawdownPct: -10,
    annualizedVolatilityPct: 20,
    trendStructure: {
      regressionSlope20AnnualizedPct: -60,
      regressionSlope60AnnualizedPct: 10,
      regressionSlope120AnnualizedPct: 15,
      slopeAcceleration20vs60PctPoints: -70,
      sma20Slope20AnnualizedPct: -40,
      sma50Slope20AnnualizedPct: 4,
      prior20High: 120,
      prior20Low: 100,
      breakout20: false,
      breakdown20: true,
      state
    },
    favorableVotes: 4,
    unfavorableVotes: 0,
    neutralVotes: 1,
    consensusScore: 4,
    votes: [],
    newMoneyAction: 'WATCH',
    existingPositionAction: 'HOLD',
    structuralDowntrend: false,
    buyTheDipCandidate: false,
    explanation: 'test',
    ...overrides
  };
}

const winnerContext = {
  currentReturnPct: 18,
  mfePct: 35,
  givebackFromMfePctPoints: 17,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 4,
  protectionObservations: 4,
  protectionReferenceReturnPct: 22,
  protectionReductionExecuted: false
};

const constructive = assessment();
assert.equal(classifyTrendProtectionV2(constructive, winnerContext).action, 'REDUCE', 'base V2 must still reduce this confirmed short-term break');
const guardedConstructive = classifyTrendProtectionV2WithMediumTermWinnerConfirm(constructive, winnerContext);
assert.equal(guardedConstructive.action, 'PROTECT', 'positive 60d slope + constructive consensus must keep winner protected, not sold');
assert.match(guardedConstructive.reason, /MEDIUM_TERM_WINNER_CONFIRM/);

const negativeSlope60 = assessment({
  trendStructure: {
    ...constructive.trendStructure,
    regressionSlope60AnnualizedPct: -8
  }
});
assert.equal(
  classifyTrendProtectionV2WithMediumTermWinnerConfirm(negativeSlope60, winnerContext).action,
  'REDUCE',
  'medium-term deterioration must authorize the same winner REDUCE as base V2'
);

const weakConsensus = assessment({ consensusScore: 0, favorableVotes: 2, unfavorableVotes: 1 });
assert.equal(
  classifyTrendProtectionV2WithMediumTermWinnerConfirm(weakConsensus, winnerContext).action,
  'REDUCE',
  'non-positive consensus must authorize winner REDUCE even with positive 60d slope'
);

const adverseVotes = assessment({ consensusScore: 2, favorableVotes: 2, unfavorableVotes: 2 });
assert.equal(
  classifyTrendProtectionV2WithMediumTermWinnerConfirm(adverseVotes, winnerContext).action,
  'REDUCE',
  'two adverse votes must authorize winner REDUCE even with positive 60d slope'
);

const loserAssessment = assessment({
  consensusScore: -3,
  favorableVotes: 0,
  unfavorableVotes: 4,
  trendStructure: {
    ...constructive.trendStructure,
    regressionSlope60AnnualizedPct: 12,
    state: 'DOWNTREND'
  }
});
const loserContext = {
  currentReturnPct: -16,
  mfePct: 0,
  givebackFromMfePctPoints: 16,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 6,
  protectionObservations: 6,
  protectionReferenceReturnPct: -10,
  protectionReductionExecuted: false
};
const baseLoser = classifyTrendProtectionV2(loserAssessment, loserContext);
const guardedLoser = classifyTrendProtectionV2WithMediumTermWinnerConfirm(loserAssessment, loserContext);
assert.equal(baseLoser.action, 'REDUCE');
assert.deepEqual(guardedLoser, baseLoser, 'LOSER_FAILURE behavior must remain byte-for-byte equivalent to base V2 decision');

console.log('TREND_PROTECTION_V2_MEDIUM_TERM_CONFIRM_RESULT', JSON.stringify({
  constructiveWinner: guardedConstructive.action,
  negativeSlope60Winner: classifyTrendProtectionV2WithMediumTermWinnerConfirm(negativeSlope60, winnerContext).action,
  weakConsensusWinner: classifyTrendProtectionV2WithMediumTermWinnerConfirm(weakConsensus, winnerContext).action,
  adverseVotesWinner: classifyTrendProtectionV2WithMediumTermWinnerConfirm(adverseVotes, winnerContext).action,
  loserUnchanged: guardedLoser.action === baseLoser.action
}));
