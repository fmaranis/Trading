import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.resolve(root, relative), 'utf8');

const policy = read('src/investment/decision/timesFmRelativeRankV1.ts');
const gate = read('src/investment/decision/portfolioCandidateGate.ts');
const alerts = read('src/investment/decision/currentOpportunityAlerts.ts');
const portfolio = read('src/investment/decision/portfolioDecisionEngine.ts');
const replay = read('src/investment/decision/replayTimesFmRelativeRankExperiment.ts');
const index = read('src/investment/decision/index.ts');

assert.match(policy, /version: 'TIMESFM_RELATIVE_RANK_V1'/);
assert.match(policy, /aggregation: 'MEAN_ORDINAL_RANK_ACROSS_20_60'/);
assert.match(policy, /tieBreak: 'LEGACY_RANKING_SCORE_THEN_ASSET_ID'/);
assert.match(policy, /coverageRule: 'ALL_ELIGIBLE_CANDIDATES_REQUIRE_FROZEN_FORECAST_EVIDENCE'/);
assert.match(policy, /gateAuthority: false/);
assert.match(policy, /sizingAuthority: false/);
assert.match(policy, /cashAuthority: false/);
assert.match(policy, /timingAuthority: false/);
assert.match(policy, /productionDefault: 'LEGACY'/);
assert.match(policy, /productionAuthority: false/);
assert.doesNotMatch(policy, /threshold|multiplier|coefficient/i);

assert.match(gate, /'TIMESFM_RELATIVE_RANK_V1'/);
assert.match(gate, /rankEligibleCandidatesWithTimesFmRelativeV1/);
assert.match(policy, /TIMESFM_RELATIVE_RANK_V1_ELIGIBLE_FORECAST_MISSING/);
assert.match(gate, /BEATS_CASH_CONSENSUS_TIMING_AND_TIMESFM_RELATIVE_RANKED/);
assert.ok(
  gate.indexOf("if (cash.passes !== true)") < gate.indexOf("if (selectionPolicy === 'TIMESFM_RELATIVE_RANK_V1')"),
  'Cash gate must execute before TimesFM ranking.'
);
assert.ok(
  gate.indexOf("if (timing.state === 'WAIT')") < gate.indexOf("if (selectionPolicy === 'TIMESFM_RELATIVE_RANK_V1')"),
  'Entry timing must execute before TimesFM ranking.'
);

assert.match(alerts, /CandidateSelectionContext/);
assert.match(alerts, /PortfolioCandidateGate\.apply\(scan, cashBenchmarkAnnualPct, 1000, selectionPolicy, selectionContext\)/);
assert.match(alerts, /Ranking TIMESFM_RELATIVE_RANK_V1/);

assert.match(portfolio, /candidateSelectionPolicy\?: CandidateSelectionPolicy/);
assert.match(portfolio, /candidateSelectionContext\?: CandidateSelectionContext/);
assert.match(portfolio, /CurrentOpportunityAlertEngine\.evaluate\(scan, cashBenchmarkAnnualPct, candidateSelectionPolicy, candidateSelectionContext\)/);
assert.match(portfolio, /allocator, sizing, cash, caps, costes, fiscalidad y reglas de rotación permanecen sin cambios/);
assert.match(portfolio, /OpportunityAllocationPolicy = 'LEGACY' \| 'QUALITY_ALLOCATION_BRIDGE_V1'/);
assert.match(portfolio, /ResearchOpportunityAllocationPolicy = OpportunityAllocationPolicy \| 'TIMESFM_ALLOCATION_BRIDGE_V1'/);
assert.doesNotMatch(portfolio, /OpportunityAllocationPolicy = [^\n]*TIMESFM_RELATIVE_RANK_V1/);
assert.doesNotMatch(portfolio, /OpportunityAllocationPolicy = [^\n]*TIMESFM_ALLOCATION_BRIDGE_V1/);

const relativeReplayStart = replay.indexOf('export function runDynamicReplayWithTimesFmRelativeRankV1');
const allocationBridgeStart = replay.indexOf('export function runDynamicReplayWithTimesFmAllocationBridgeV1');
assert.ok(relativeReplayStart >= 0, 'TIMESFM_RELATIVE_RANK_V1 replay wrapper missing');
const relativeReplay = replay.slice(
  relativeReplayStart,
  allocationBridgeStart > relativeReplayStart ? allocationBridgeStart : undefined
);
assert.doesNotMatch(
  relativeReplay,
  /opportunityAllocationPolicy:/,
  'TIMESFM_RELATIVE_RANK_V1 must not gain allocation authority; allocation bridge is a separate post-hoc policy.'
);

assert.match(replay, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(replay, /candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1'/);
assert.match(replay, /TIMESFM_RELATIVE_RANK_V1_DATE_EVIDENCE_MISSING/);
assert.match(replay, /PortfolioCandidateGate\.apply = originalApply/);
assert.match(replay, /PortfolioDecisionEngine\.evaluate = originalEvaluate/);
assert.doesNotMatch(replay, /SAME_CLOSE/);
assert.doesNotMatch(replay, /productionAuthority: true/);

assert.match(index, /timesFmRelativeRankV1/);
assert.match(index, /replayTimesFmRelativeRankExperiment/);

console.log('timesFmRelativeRankV1Contract.unit: PASS');
