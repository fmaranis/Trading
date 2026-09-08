import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const core = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicHistoricalReplayCore.ts'), 'utf8');
const wrapper = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicHistoricalReplay.ts'), 'utf8');
const helper = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/replayExternalCashFlows.ts'), 'utf8');
const engine = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/portfolioDecisionEngine.ts'), 'utf8');

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

console.log('replayExternalCashFlowIntegration.unit: PASS');
