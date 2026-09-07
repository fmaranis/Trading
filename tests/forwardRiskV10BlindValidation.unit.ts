import fs from 'node:fs';
import path from 'node:path';
import { FORWARD_RISK_V10_POLICY_FINGERPRINT } from '../src/investment/decision/forwardRiskV10Policy';
import { FORWARD_RISK_V10_VALIDATION_PROTOCOL, assertForwardRiskV10HistoricalHoldoutUnlocked } from '../src/investment/decision/forwardRiskV10ValidationProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`FORWARD_RISK_V10_BLIND_GUARD_FAIL:${label}`);
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`FORWARD_RISK_V10_BLIND_GUARD_FAIL:${label}`);
}

const runner = source('scripts/forwardRiskV10BlindValidationLive.ts');
const expectedTickers = ['VGVF.DE', 'VNRA.DE', 'VFEM.DE', 'VERE.DE', 'VGEK.DE', 'VJPN.DE'];
const actualTickers = FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
if (JSON.stringify(actualTickers) !== JSON.stringify(expectedTickers)) throw new Error('FORWARD_RISK_V10_BLIND_GUARD_FAIL:BLIND_SAMPLE_CHANGED');
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.localImplementationGates.status !== 'PASS') throw new Error('FORWARD_RISK_V10_BLIND_GUARD_FAIL:LOCAL_GATES_NOT_PASS');
if (assertForwardRiskV10HistoricalHoldoutUnlocked() !== FORWARD_RISK_V10_POLICY_FINGERPRINT) throw new Error('FORWARD_RISK_V10_BLIND_GUARD_FAIL:FINGERPRINT_UNLOCK_MISMATCH');

requireText(runner, "const RESULT_PATH = path.resolve(process.cwd(), 'validation-runs/forward-risk-v10-blind-result.json')", 'ONE_SHOT_RESULT_PATH');
requireText(runner, 'V10_BLIND_ALREADY_COMPLETED', 'SECOND_COMPLETED_RUN_MUST_BE_BLOCKED');
requireText(runner, 'AssetUniverseScanner.scan(BLIND_CATALOG, DATA_FROM, FINAL_END_DATE', 'BLIND_MUST_USE_SHARED_REAL_SCANNER');
requireText(runner, 'PortfolioCandidateGate.apply(scan, historicalCashBenchmarkAnnualPct(date), 1)', 'MUST_REUSE_CAUSAL_PRODUCTION_OPPORTUNITY_GATE');
requireText(runner, 'causalSingleAssetScan(asset, series, allBars.slice(0, fullIndex + 1))', 'OPPORTUNITY_MUST_USE_PRICE_PREFIX_ONLY');
requireText(runner, 'latestRisk(v8, date)', 'RISK_MUST_USE_LATEST_AVAILABLE_V8');
requireText(runner, "execution: 'NEXT_OPEN'", 'NEXT_OPEN_AUDIT_MISSING');
requireText(runner, 'FORWARD_RISK_V10_DATA_QUALITY_GATE.maxAbsoluteOneSessionCloseReturnPct', 'DATA_QUALITY_SHOCK_GATE_MISSING');
requireText(runner, 'FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumDeferredContributionsPerAsset', 'MIN_DEFERRED_EVIDENCE_MISSING');
requireText(runner, "'V10_BLIND_INCONCLUSIVE_NO_REPLACEMENT_ALLOWED'", 'INCONCLUSIVE_RULE_MISSING');
requireText(runner, "'V10_BLIND_FAIL_RETIRE_V10_POLICY_1'", 'FAIL_RETIRE_RULE_MISSING');
requireText(runner, 'FORWARD_RISK_V10_BLIND_RESULT', 'RESULT_MARKER_MISSING');
requireText(runner, 'This result consumes the six historical V10 blind assets regardless of PASS, FAIL or INCONCLUSIVE.', 'CONSUMPTION_NOTE_MISSING');

for (const ticker of expectedTickers) requireText(runner, `ticker: '${ticker}'`, `BLIND_TICKER_MISSING:${ticker}`);
forbidText(runner, 'SELL_25_PCT_NEXT_OPEN', 'V9_SELL_ACTION_FORBIDDEN');
forbidText(runner, 'runForwardRiskV9StateMachine', 'V9_STATE_MACHINE_FORBIDDEN');
forbidText(runner, 'GitHub Actions', 'RUNNER_MUST_NOT_INVOKE_GITHUB_ACTIONS');
forbidText(runner, 'gemini', 'RUNNER_MUST_NOT_USE_GEMINI');

console.log('forwardRiskV10BlindValidation.unit: PASS');
