import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}
function read(path: string): string { return readFileSync(path, 'utf8'); }

const script = read('scripts/hfgBoomCrashDiagnosticV1Live.ts');
const productionUniverse = read('src/investment/decision/portfolioDiscoveryUniverse.ts');
const routes = read('server/researchValidationRoutes.ts');

check('HFG diagnostic is explicitly consumed and non-promotional', () => {
  assert.match(script, /sampleStatus:\s*'CONSUMED_DIAGNOSTIC_ONLY'/);
  assert.match(script, /promotionAllowed:\s*false/);
  assert.match(script, /retuningAllowed:\s*false/);
  assert.match(script, /canPromoteProductionPolicy:\s*false/);
  assert.match(script, /canRetuneThresholds:\s*false/);
});

check('HFG metadata is research-only and does not pollute production discovery seed', () => {
  assert.match(script, /const HFG_RESEARCH_ITEM: AssetUniverseItem/);
  assert.match(script, /assetId:\s*HFG_ASSET_ID/);
  assert.match(script, /ticker:\s*HFG_TICKER/);
  assert.doesNotMatch(productionUniverse, /HFG\.DE|EQ_HFG|HelloFresh/);
});

check('historical current Yahoo discovery remains disabled', () => {
  assert.match(script, /currentYahooDiscoveryInHistoricalReplay:\s*false/);
  assert.match(script, /currentOpenDiscovery:\s*false/);
  assert.match(script, /HFG_DIAGNOSTIC_CURRENT_DISCOVERY_LEAK/);
  assert.match(script, /assetId\.startsWith\('OPEN_'\)/);
});

check('diagnostic requires REAL data including HFG itself', () => {
  assert.match(script, /provenance\?\.sourceType !== 'REAL'/);
  assert.match(script, /HFG_DIAGNOSTIC_NON_REAL_DATA/);
  assert.match(script, /HFG_DIAGNOSTIC_HFG_REAL_DATA_REQUIRED/);
});

check('consumed HFG fixture is fixed and does not create recurring money', () => {
  assert.match(script, /const START_DATE = '2019-01-01'/);
  assert.match(script, /const END_DATE = '2022-12-30'/);
  assert.match(script, /const INITIAL_CAPITAL_EUR = 26_000/);
  assert.match(script, /const INITIAL_HFG_EUR = 13_000/);
  assert.match(script, /const INITIAL_CASH_EUR = 13_000/);
  assert.match(script, /source:\s*'MANUAL'/);
  assert.match(script, /frequency:\s*'MONTHLY'/);
  assert.doesNotMatch(script, /externalCashFlows|CONTRIBUTION|1_000/);
});

check('diagnostic reuses canonical causal replay with production LEGACY allocation', () => {
  assert.match(script, /opportunityAllocationPolicy:\s*'LEGACY'/);
  assert.match(script, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
  assert.match(script, /simulationMode:\s*'CUSTODIA_ENGINE'/);
  assert.match(script, /simulationMode:\s*'HOLD_ONLY'/);
  assert.match(script, /execution:\s*'NEXT_OPEN_CAUSAL_REPLAY_ENGINE'/);
});

check('diagnostic separates exit, reentry funding and winner protection', () => {
  assert.match(script, /initialExit:/);
  assert.match(script, /unfundedReadyOrStrong/);
  assert.match(script, /classifyUnfundedReady/);
  assert.match(script, /winnerProtection:/);
  assert.match(script, /economicPolicyCounterfactual:/);
});

check('diagnostic does not write future-forward or replay-results state', () => {
  assert.doesNotMatch(script, /replay-results|GITHUB_REPLAY_SYNC_TOKEN|qualityAllocationDynamicFutureForwardV1StateStore/);
  assert.match(script, /futureForwardFrozenFilesTouched:\s*false/);
});

check('ResearchValidationCenter exposes the integrated HFG diagnostic job', () => {
  assert.match(routes, /id:\s*'hfg-boom-crash-diagnostic-v1'/);
  assert.match(routes, /scripts\/hfgBoomCrashDiagnosticV1Live\.ts/);
  assert.match(routes, /tests\/hfgBoomCrashDiagnosticV1\.unit\.ts/);
  assert.match(routes, /HFG_BOOM_CRASH_DIAGNOSTIC_V1_RESULT/);
});

check('machine-readable result marker remains stable', () => {
  assert.match(script, /const MARKER = 'HFG_BOOM_CRASH_DIAGNOSTIC_V1_RESULT'/);
  assert.match(script, /console\.log\(`\$\{MARKER\}\$\{JSON\.stringify\(result\)\}`\)/);
});

console.log(`HFG boom-crash diagnostic V1: ${passed}/10 invariants passed.`);
