import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const core = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicHistoricalReplayCore.ts'), 'utf8');
const wrapper = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicHistoricalReplay.ts'), 'utf8');
const helper = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/replayExternalCashFlows.ts'), 'utf8');
const engine = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/portfolioDecisionEngine.ts'), 'utf8');
const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/replayExplicitCashFlowsV1Live.ts'), 'utf8');

assert.match(core, /externalCashFlows\?: DynamicReplayExternalCashFlow\[\]/);
assert.match(core, /normalizeReplayExternalCashFlows\(input\.externalCashFlows, input\.startDate, endDate\)/);
assert.match(core, /advanceCashTo\(decisionDate\);/);
assert.match(core, /if \(commonExecutionDate\) advanceCashTo\(commonExecutionDate\);/);
assert.match(core, /advanceCashTo\(endDate\);/);
assert.match(core, /REPLAY_EXTERNAL_WITHDRAWAL_EXCEEDS_CASH/);
assert.match(core, /MONTHLY\/DAILY\/WEEKLY\/QUARTERLY sólo controlan la frecuencia de decisión y nunca crean aportaciones implícitas/);
assert.match(core, /stagedCapitalPlan:\s*\{\s*availableEur:\s*0,\s*horizonMonths:\s*12,\s*preferredMode:\s*'MONTHLY'\s*\}/);
assert.match(core, /cashFlowAdjustedPerformance/);
assert.match(core, /allCashBenchmarkWithAppliedFlows/);
assert.doesNotMatch(core, /currentOpenDiscovery\s*:\s*true/);

assert.match(helper, /DynamicReplayExternalCashFlowKind = 'CONTRIBUTION' \| 'WITHDRAWAL'/);
assert.match(helper, /profitEur = input\.finalValueEur \+ summary\.withdrawalsEur - input\.initialCapitalEur - summary\.contributionsEur/);
assert.match(helper, /REPLAY_EXTERNAL_CASH_FLOW_KIND_AMOUNT_MISMATCH/);

assert.match(wrapper, /if \(result\.appliedExternalCashFlows\.length > 0\) return null;/);
assert.match(wrapper, /Benchmark estructural N\/D con flujos externos/);
assert.match(engine, /opportunityAllocationPolicy \?\? 'LEGACY'/, 'production allocation policy must remain LEGACY by default');

assert.match(runner, /VERSION = 'REPLAY_EXPLICIT_CASH_FLOWS_V1'/);
assert.match(runner, /EXPLICIT_MONTHLY_CONTRIBUTION_EUR = 1_000/);
assert.match(runner, /researchContributionFixtureIsProductionDefault: false/);
assert.match(runner, /researchContributionFixtureIsUserCashFlowAssumption: false/);
assert.match(runner, /monthlyDecisionCadenceCreatesImplicitCash: false/);
assert.match(runner, /withdrawalPolicyV1: 'CASH_ONLY_FAIL_EXPLICITLY_IF_INSUFFICIENT_NO_HIDDEN_FORCED_SALE'/);
assert.match(runner, /runArm\(baseInput, 'CLOSED_LEGACY', 'LEGACY'\)/);
assert.match(runner, /runArm\(\{ \.\.\.baseInput, externalCashFlows: flows \}, 'EXPLICIT_LEGACY', 'LEGACY'\)/);
assert.match(runner, /'EXPLICIT_QUALITY', 'QUALITY_ALLOCATION_BRIDGE_V1'/);
assert.match(runner, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner, /currentOpenDiscovery: false/);
assert.match(runner, /consumedHistoricalWindowsCannotPromoteQuality: true/);
assert.match(runner, /noQualityRetuning: true/);
assert.match(runner, /finally\s*\{\s*PortfolioDecisionEngine\.evaluate = originalEvaluate;/s);

console.log('replayExternalCashFlowIntegration.unit: PASS');
