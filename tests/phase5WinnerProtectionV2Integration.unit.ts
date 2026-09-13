import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  executedPhase5WinnerProtectionSignals,
  winnerOnlyAssessment
} from '../src/investment/decision/phase5WinnerProtectionV2Overlay';
import { classifyTrendProtectionV2 } from '../src/investment/decision/trendProtectionPolicy';
import type { StrategyConsensusAssessment } from '../src/investment/decision/strategyConsensusEngine';
import {
  PHASE5_SEALED_COHORTS,
  PHASE5_SEALED_SAMPLE,
  PHASE5_SEALED_SAMPLE_STATE
} from '../scripts/phase5WinnerProtectionV2SealedSample';

function assessment(overrides: Partial<StrategyConsensusAssessment> = {}): StrategyConsensusAssessment {
  return {
    assetId: 'EQ_TEST',
    ticker: 'TEST.DE',
    name: 'Test',
    asOfDate: '2002-01-01',
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
      breakdown20: true,
      state: 'DOWNTREND'
    },
    favorableVotes: 0,
    unfavorableVotes: 5,
    neutralVotes: 0,
    consensusScore: -5,
    votes: [],
    newMoneyAction: 'WATCH',
    existingPositionAction: 'HOLD',
    structuralDowntrend: true,
    buyTheDipCandidate: false,
    explanation: 'test',
    ...overrides
  };
}

const loserSource = assessment();
const winnerOnly = winnerOnlyAssessment(loserSource);
assert.ok(winnerOnly);
assert.equal(winnerOnly!.unfavorableVotes, 0);
assert.equal(winnerOnly!.consensusScore, 0);
assert.equal(winnerOnly!.trendStructure.state, 'DOWNTREND');

const loserWouldExitInFullV2 = classifyTrendProtectionV2(loserSource, {
  currentReturnPct: -20,
  mfePct: 0,
  givebackFromMfePctPoints: 20,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 10,
  protectionReductionExecuted: true
});
assert.equal(loserWouldExitInFullV2.action, 'EXIT');

const loserNeutralizedInPhase5 = classifyTrendProtectionV2(winnerOnly, {
  currentReturnPct: -20,
  mfePct: 0,
  givebackFromMfePctPoints: 20,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 10,
  protectionReductionExecuted: true
});
assert.equal(loserNeutralizedInPhase5.action, 'HOLD');
assert.equal(loserNeutralizedInPhase5.loserFailureArmed, false);

const confirmedWinner = classifyTrendProtectionV2(winnerOnly, {
  currentReturnPct: 7.5,
  mfePct: 20,
  givebackFromMfePctPoints: 12.5,
  isDiversifiedCore: false,
  deteriorationStreakSessions: 0,
  protectionObservations: 3,
  protectionReferenceReturnPct: 10,
  protectionReductionExecuted: false
});
assert.equal(confirmedWinner.action, 'REDUCE');
assert.equal(confirmedWinner.suggestedReductionPct, 25);
assert.equal(confirmedWinner.winnerProtectionArmed, true);

assert.equal(executedPhase5WinnerProtectionSignals({ signals: [
  { executed: true, action: 'REDUCE', reason: '[PHASE5_WINNER_PROTECTION_V2:REDUCE] test' },
  { executed: false, action: 'REDUCE', reason: '[PHASE5_WINNER_PROTECTION_V2:REDUCE] test' },
  { executed: true, action: 'REDUCE', reason: 'canonical' },
  { executed: true, action: 'EXIT', reason: '[PHASE5_WINNER_PROTECTION_V2:REDUCE] test' }
] }), 1);

assert.equal(PHASE5_SEALED_SAMPLE_STATE, 'SEALED_NOT_OPENED');
assert.equal(PHASE5_SEALED_SAMPLE.length, 18);
assert.equal(PHASE5_SEALED_COHORTS.length, 6);
assert.ok(PHASE5_SEALED_COHORTS.every(cohort => cohort.length === 3));
assert.equal(new Set(PHASE5_SEALED_SAMPLE.map(row => row.assetId)).size, 18);

const wrapper = readFileSync('src/investment/decision/replayRotationPolicyExperiment.ts', 'utf8');
const overlayIndex = wrapper.indexOf('applyPhase5WinnerProtectionV2Overlay({');
const architectureIndex = wrapper.indexOf('applyCoreArchitectureV1(evaluationInput, phase5Gated');
assert.ok(overlayIndex >= 0 && architectureIndex > overlayIndex, 'Phase 5 overlay must run after gate and before architecture');
assert.match(wrapper, /winnerProtectionPolicy \?\? 'LEGACY'/);
assert.match(wrapper, /PHASE5_WINNER_PROTECTION_REQUIRES_CORE_ARCHITECTURE_V1/);
assert.match(wrapper, /executedPhase5WinnerProtectionSignals\(result\)/);
assert.doesNotMatch(wrapper, /replayTrendProtectionV2Experiment/);

const overlaySource = readFileSync('src/investment/decision/phase5WinnerProtectionV2Overlay.ts', 'utf8');
assert.match(overlaySource, /health\.isDiversifiedCore === true/);
assert.match(overlaySource, /canonicalStronger = position\.action === 'REDUCE'/);
assert.match(overlaySource, /position\.suggestedReductionPct = 25/);
assert.match(overlaySource, /state\.pendingReduction = true/);
assert.match(overlaySource, /currentUnits < state\.lastUnits/);
assert.match(overlaySource, /result\.contributions = result\.contributions\.filter/);
assert.match(overlaySource, /refreshRecommendedTotals/);

console.log('PHASE5_WINNER_PROTECTION_V2_INTEGRATION_PASS', JSON.stringify({
  sampleAssets: PHASE5_SEALED_SAMPLE.length,
  cohorts: PHASE5_SEALED_COHORTS.length,
  loserBranchNeutralized: loserNeutralizedInPhase5.action,
  confirmedWinner: confirmedWinner.action,
  reductionPct: confirmedWinner.suggestedReductionPct
}));
