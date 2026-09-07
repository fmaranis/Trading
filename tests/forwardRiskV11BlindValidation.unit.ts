import fs from 'node:fs';
import path from 'node:path';
import { FORWARD_RISK_V11_POLICY_FINGERPRINT } from '../src/investment/decision/forwardRiskV11SizingOverlay';
import { FORWARD_RISK_V11_VALIDATION_PROTOCOL } from '../src/investment/decision/forwardRiskV11ValidationProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`FORWARD_RISK_V11_BLIND_GUARD_FAIL:${label}`);
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`FORWARD_RISK_V11_BLIND_GUARD_FAIL:${label}`);
}

const runner = source('scripts/forwardRiskV11BlindValidationLive.ts');
const expectedTickers = ['IUSQ.DE', 'IUSA.DE', 'EUNM.DE', 'EUNK.DE', 'SXR1.DE', 'IQQJ.DE'];
const actualTickers = FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
if (JSON.stringify(actualTickers) !== JSON.stringify(expectedTickers)) throw new Error('FORWARD_RISK_V11_BLIND_GUARD_FAIL:BLIND_SAMPLE_CHANGED');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.policyFreeze.fingerprint !== FORWARD_RISK_V11_POLICY_FINGERPRINT) throw new Error('FORWARD_RISK_V11_BLIND_GUARD_FAIL:FINGERPRINT_CHANGED');

requireText(runner, "const RESULT_PATH = path.resolve(process.cwd(), 'validation-runs/forward-risk-v11-blind-result.json')", 'ONE_SHOT_RESULT_PATH');
requireText(runner, 'V11_BLIND_ALREADY_COMPLETED', 'SECOND_COMPLETED_RUN_MUST_BE_BLOCKED');
requireText(runner, 'assertForwardRiskV11HistoricalHoldoutUnlocked()', 'UNLOCK_ASSERTION_MISSING');
requireText(runner, 'PortfolioCandidateGate.apply(scan, historicalCashBenchmarkAnnualPct(date), 1)', 'PRODUCTION_OPPORTUNITY_GATE_NOT_REUSED');
requireText(runner, 'allBars.slice(0, fullIndex + 1)', 'OPPORTUNITY_PREFIX_CAUSALITY_MISSING');
requireText(runner, "execution: 'NEXT_OPEN'", 'NEXT_OPEN_AUDIT_MISSING');
requireText(runner, 'maxNavDrawdown', 'FLOW_ADJUSTED_DRAWDOWN_MISSING');
requireText(runner, 'account.units += contributionEur / navOpen', 'UNITIZATION_EXTERNAL_FLOW_MISSING');
requireText(runner, 'decideForwardRiskV11Sizing', 'FROZEN_SIZING_POLICY_NOT_REUSED');
requireText(runner, 'FORWARD_RISK_V11_DATA_QUALITY_GATE.minimumRiskModulatedEligibleEvents', 'MINIMUM_MODULATED_EVIDENCE_MISSING');
requireText(runner, "'V11_BLIND_INCONCLUSIVE_NO_REPLACEMENT_ALLOWED'", 'INCONCLUSIVE_RULE_MISSING');
requireText(runner, "'V11_BLIND_FAIL_RETIRE_V11_POLICY_1'", 'FAIL_RETIRE_RULE_MISSING');
requireText(runner, 'FORWARD_RISK_V11_BLIND_RESULT', 'RESULT_MARKER_MISSING');
requireText(runner, 'This result consumes the six historical V11 blind assets regardless of PASS, FAIL or INCONCLUSIVE.', 'CONSUMPTION_NOTE_MISSING');

for (const ticker of expectedTickers) requireText(runner, `ticker: '${ticker}'`, `BLIND_TICKER_MISSING:${ticker}`);
for (const contaminated of ['SPPW.DE','SPY5.DE','SPYM.DE','ZPRS.DE','VGEU.DE','ZPDJ.DE','VGVF.DE','VNRA.DE','VFEM.DE','VERE.DE','VGEK.DE','VJPN.DE']) {
  forbidText(runner, `ticker: '${contaminated}'`, `CONTAMINATED_BLIND_REUSED:${contaminated}`);
}
forbidText(runner, 'EUR_VALIDATION_HOLDOUT_UNIVERSE', 'OLD_HOLDOUT_UNIVERSE_FORBIDDEN');
forbidText(runner, 'Math.random', 'RANDOMNESS_FORBIDDEN');
forbidText(runner, 'runForwardRiskV9StateMachine', 'V9_STATE_MACHINE_FORBIDDEN');
forbidText(runner, 'DEFER_100_PCT', 'V10_BINARY_DEFERRAL_FORBIDDEN');
forbidText(runner, 'RELEASE_100_PCT', 'V10_RELEASE_STATE_FORBIDDEN');
forbidText(runner, 'GitHub Actions', 'RUNNER_MUST_NOT_USE_GITHUB_ACTIONS');
forbidText(runner.toLowerCase(), 'gemini', 'RUNNER_MUST_NOT_USE_GEMINI');

const unlockIndex = runner.indexOf('assertForwardRiskV11HistoricalHoldoutUnlocked()');
const blindOpenIndex = runner.indexOf('const blindScan = await AssetUniverseScanner.scan(BLIND_CATALOG');
if (unlockIndex < 0 || blindOpenIndex < 0 || unlockIndex >= blindOpenIndex) throw new Error('FORWARD_RISK_V11_BLIND_GUARD_FAIL:BLIND_MUST_OPEN_AFTER_UNLOCK');

console.log('forwardRiskV11BlindValidation.unit: PASS');
