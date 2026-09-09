import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { qualityAllocationMultiplierV1 } from '../src/investment/decision/portfolioDecisionEngine';
import {
  QUALITY_ALLOCATION_FUTURE_FORWARD_V1 as protocol,
  QUALITY_ALLOCATION_FUTURE_FORWARD_V1_UNIVERSE as universe,
  qualityAllocationFutureForwardV1ResearchFlows
} from '../src/investment/decision/qualityAllocationFutureForwardV1';

assert.equal(protocol.version, 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1');
assert.equal(protocol.frozenAt, '2026-09-09');
assert.equal(protocol.eligibleStartDate, '2026-09-10');
assert.equal(protocol.sourcePreregistrationHead, '479b1a1efa2576caf2be11790d9fc9a6cd2fb10c');
assert.equal(protocol.productionArchitecture, 'CORE_ARCHITECTURE_V1');
assert.equal(protocol.productionAllocationPolicy, 'LEGACY');
assert.equal(protocol.candidateAllocationPolicy, 'QUALITY_ALLOCATION_BRIDGE_V1');
assert.equal(protocol.candidateIsShadowResearchOnly, true);
assert.equal(protocol.candidateCanPromoteDirectlyFromPhaseA, false);
assert.equal(protocol.noParameterChangesAfterFreeze, true);
assert.equal(protocol.noHistoricalOutcomeBackfill, true);
assert.equal(protocol.preStartBarsAreFeatureWarmupOnly, true);
assert.equal(protocol.currentYahooDiscoveryInEvaluation, false);
assert.equal(protocol.validationHoldoutUniverseExcluded, true);
assert.equal(protocol.forwardRiskIncluded, false);
assert.equal(protocol.frequency, 'MONTHLY');
assert.equal(protocol.researchContributionFixtureEurPerMonth, 1_000);
assert.equal(protocol.researchContributionFixtureIsProductionDefault, false);
assert.equal(protocol.researchContributionFixtureIsUserCashFlowAssumption, false);
assert.equal(protocol.monthlyDecisionCadenceCreatesImplicitCash, false);
assert.equal(protocol.minimumForwardSessionsForEconomicEvaluation, 252);
assert.deepEqual(protocol.reachGate, {
  minimumAllocationPlanChangedDecisionGates: 3,
  minimumExecutedAcquisitionDatesChanged: 8,
  minimumAbsoluteExecutedNotionalDeltaEur: 1_000
});
assert.deepEqual(protocol.economicGate, {
  minimumCashFlowAdjustedReturnDeltaPctPoints: 0.50,
  requirePositiveFinalValueDeltaEur: true,
  maximumAllowedDrawdownWorseningPctPoints: 1.0
});
assert.equal(protocol.phaseAPassMeaning, 'CANDIDATE_FOR_SEPARATE_FRESH_CONFIRMATION_NOT_PRODUCTION_PROMOTION');

assert.equal(universe.length, 64, 'future-forward universe must remain the frozen 64-asset snapshot');
assert.equal(new Set(universe.map(asset => asset.assetId)).size, 64, 'asset ids must be unique');
assert.equal(new Set(universe.map(asset => asset.ticker.toUpperCase())).size, 64, 'tickers must be unique');
assert.ok(universe.every(asset => !asset.assetId.startsWith('OPEN_')), 'future OPEN_* discoveries must not enter the frozen sample');
assert.ok(universe.every(asset => !asset.assetId.startsWith('HOLDOUT_')), 'validation holdout assets must remain excluded');
assert.ok(universe.every(asset => asset.currency === 'EUR'));

assert.equal(qualityAllocationMultiplierV1(50, 50), 1);
assert.equal(qualityAllocationMultiplierV1(100, 100), 1.15);
assert.equal(qualityAllocationMultiplierV1(0, 0), 0.85);

const firstFlows = qualityAllocationFutureForwardV1ResearchFlows('2026-11-30');
assert.equal(firstFlows.length, 2);
assert.equal(firstFlows[0].date, '2026-10-01');
assert.equal(firstFlows[1].date, '2026-11-01');
assert.ok(firstFlows.every(flow => flow.date > protocol.eligibleStartDate));
assert.ok(firstFlows.every(flow => flow.amountEur === 1_000 && flow.kind === 'CONTRIBUTION'));

const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/qualityAllocationFutureForwardV1CheckpointLive.ts'), 'utf8');
assert.match(runner, /QUALITY_ALLOCATION_FUTURE_FORWARD_V1_UNIVERSE as FROZEN_UNIVERSE/);
assert.match(runner, /currentOpenDiscovery: false/);
assert.match(runner, /startDate: PROTOCOL\.eligibleStartDate/);
assert.match(runner, /externalCashFlows: flows/);
assert.match(runner, /runArm\(baseInput, 'LEGACY'\)/);
assert.match(runner, /runArm\(baseInput, 'QUALITY_ALLOCATION_BRIDGE_V1'\)/);
assert.match(runner, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner, /finally\s*\{\s*PortfolioDecisionEngine\.evaluate = originalEvaluate;/s);
assert.match(runner, /ACCUMULATING_FUTURE_DATA/);
assert.match(runner, /PHASE_A_INCONCLUSIVE_INSUFFICIENT_REACH_KEEP_LEGACY/);
assert.match(runner, /PHASE_A_CANDIDATE_FOR_CONFIRMATION/);
assert.match(runner, /PHASE_A_FAIL_KEEP_LEGACY/);
assert.match(runner, /forwardDates\.length >= PROTOCOL\.minimumForwardSessionsForEconomicEvaluation/);

// Future-forward evidence must be append-only in meaning: no later code/data run may silently rewrite an already observed prefix.
assert.match(runner, /\.runtime\/quality-allocation-future-forward-v1-state\.json/);
assert.match(runner, /createHash\('sha256'\)/);
assert.match(runner, /legacyHistoryHash/);
assert.match(runner, /qualityHistoryHash/);
assert.match(runner, /lastLockedDataDate/);
assert.match(runner, /lockedHistoryHash\(legacy, continuityState\.lastLockedDataDate\)/);
assert.match(runner, /lockedHistoryHash\(quality, continuityState\.lastLockedDataDate\)/);
assert.match(runner, /PHASE_A_INVALIDATED_FORWARD_HISTORY_DRIFT_KEEP_LEGACY/);
assert.match(runner, /PHASE_A_INVALIDATED_FROZEN_CONTRACT_DRIFT_KEEP_LEGACY/);
assert.match(runner, /PHASE_A_INVALIDATED_MISSING_FORWARD_BASELINE_KEEP_LEGACY/);
assert.match(runner, /if \(!continuityState && endDate && endDate > PROTOCOL\.eligibleStartDate\)/);
assert.match(runner, /saveContinuityState\(nextState\)/);
assert.match(runner, /previouslyObservedForwardHistoryIsImmutable: true/);
assert.doesNotMatch(runner, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.doesNotMatch(runner, /EUR_VALIDATION_HOLDOUT_UNIVERSE/);
assert.doesNotMatch(runner, /PortfolioCandidateGate\.apply\s*=/);
assert.doesNotMatch(runner, /recordValidationResult/);

console.log('qualityAllocationFutureForwardV1.unit: PASS');
