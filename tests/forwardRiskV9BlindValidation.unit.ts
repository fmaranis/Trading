import fs from 'node:fs';
import path from 'node:path';
import { FORWARD_RISK_V9_VALIDATION_PROTOCOL } from '../src/investment/decision/forwardRiskV9ValidationProtocol';
import { FORWARD_RISK_V9_POLICY } from '../src/investment/decision/forwardRiskV9StateMachine';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V9_BLIND_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V9_BLIND_GUARD_FAIL:${label}`); }

const script = source('scripts/forwardRiskV9BlindValidationLive.ts');
const protocol = FORWARD_RISK_V9_VALIDATION_PROTOCOL;
const expectedFingerprint = 'sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0';
const expectedTickers = ['SPPW.DE', 'SPY5.DE', 'SPYM.DE', 'ZPRS.DE', 'VGEU.DE', 'ZPDJ.DE'];

if (protocol.localImplementationGates.status !== 'PASS') throw new Error('FORWARD_RISK_V9_BLIND_GUARD_FAIL:LOCAL_GATES_NOT_PASS');
if (protocol.policyFreeze.fingerprint !== expectedFingerprint) throw new Error('FORWARD_RISK_V9_BLIND_GUARD_FAIL:FINGERPRINT_CHANGED');
if (FORWARD_RISK_V9_POLICY.policyVersion !== 'V9_POLICY_1') throw new Error('FORWARD_RISK_V9_BLIND_GUARD_FAIL:POLICY_VERSION_CHANGED');
if (JSON.stringify(protocol.historicalBlindHoldout.assets.map(asset => asset.ticker)) !== JSON.stringify(expectedTickers)) throw new Error('FORWARD_RISK_V9_BLIND_GUARD_FAIL:SEALED_SAMPLE_CHANGED');

for (const ticker of expectedTickers) requireText(script, `ticker: '${ticker}'`, `BLIND_TICKER_MISSING:${ticker}`);
requireText(script, 'assertForwardRiskV9HistoricalHoldoutUnlocked()', 'UNLOCK_GUARD_MISSING');
requireText(script, 'V9_BLIND_ALREADY_COMPLETED', 'ONE_SHOT_RESULT_GUARD_MISSING');
requireText(script, "const V5_SIGNAL_SCORE_PCT = 80", 'V5_THRESHOLD_CHANGED');
requireText(script, "const V7_SIGNAL_SCORE_PCT = 80", 'V7_THRESHOLD_CHANGED');
requireText(script, "parameterGridUsed: false", 'NO_GRID_MARKER_MISSING');
requireText(script, "thresholdsRetuned: false", 'NO_THRESHOLD_RETUNING_MARKER_MISSING');
requireText(script, "policyRetuned: false", 'NO_POLICY_RETUNING_MARKER_MISSING');
requireText(script, "holdoutReplacementAllowed: false", 'NO_REPLACEMENT_MARKER_MISSING');
requireText(script, "productionPromotionAllowed: false", 'NO_PRODUCTION_PROMOTION_MARKER_MISSING');
requireText(script, 'FORWARD_RISK_V9_BLIND_RESULT', 'RESULT_MARKER_MISSING');
requireText(script, "validation-runs/forward-risk-v9-blind-result.json", 'DURABLE_LOCAL_RESULT_MISSING');
forbidText(script, 'EUR_VALIDATION_HOLDOUT_UNIVERSE', 'OLD_CONTAMINATED_HOLDOUT_MUST_NOT_ENTER_V9');
forbidText(script, 'Math.random', 'BLIND_SELECTION_MUST_NOT_BE_RANDOMIZED_AFTER_SEAL');

console.log('forwardRiskV9BlindValidation.unit: PASS');
