import fs from 'node:fs';
import path from 'node:path';
import {
  FORWARD_RISK_V9_VALIDATION_PROTOCOL,
  assertForwardRiskV9HistoricalHoldoutUnlocked
} from '../src/investment/decision/forwardRiskV9ValidationProtocol';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:${label}`);
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:${label}`);
}

const protocolSource = source('src/investment/decision/forwardRiskV9ValidationProtocol.ts');
const universeSource = source('src/investment/decision/assetUniverse.ts');

const expectedBlindTickers = ['SPPW.DE', 'SPY5.DE', 'SPYM.DE', 'ZPRS.DE', 'VGEU.DE', 'ZPDJ.DE'];
const expectedFingerprint = 'sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0';
const actualBlindTickers = FORWARD_RISK_V9_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);

if (JSON.stringify(actualBlindTickers) !== JSON.stringify(expectedBlindTickers)) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:BLIND_SAMPLE_CHANGED');
}

for (const ticker of expectedBlindTickers) {
  forbidText(universeSource, `ticker: '${ticker}'`, `BLIND_TICKER_ALREADY_IN_EXISTING_UNIVERSE:${ticker}`);
}

if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze.status !== 'FROZEN') {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:POLICY_NOT_FROZEN');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze.fingerprint !== expectedFingerprint) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:POLICY_FINGERPRINT_CHANGED');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.futureForwardConfirmation.startDateInclusive !== '2026-09-08') {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:FUTURE_FORWARD_START_CHANGED');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.frozenSignalInput.v5ThresholdPct !== 80 || FORWARD_RISK_V9_VALIDATION_PROTOCOL.frozenSignalInput.v7ThresholdPct !== 80) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:V8_THRESHOLDS_CHANGED');
}

// The local implementation gate was already executed and recorded PASS before
// the blind runner was exposed. From this point onward the guard must assert
// that immutable progressed state instead of retaining an unreachable PENDING
// branch, which TypeScript correctly rejects once the protocol constant is PASS.
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.localImplementationGates.status !== 'PASS') {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:LOCAL_IMPLEMENTATION_GATES_NOT_PASS');
}
if (assertForwardRiskV9HistoricalHoldoutUnlocked() !== expectedFingerprint) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:UNLOCKED_FINGERPRINT_MISMATCH');
}

requireText(protocolSource, 'Do not fetch or inspect historical price series for V9 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.', 'ANTI_LEAKAGE_RULE_MISSING');
requireText(protocolSource, 'replacementAfterOpeningAllowed: false', 'HOLDOUT_REPLACEMENT_MUST_BE_FORBIDDEN');
requireText(protocolSource, 'insufficientDataReplacementAllowed: false', 'INSUFFICIENT_DATA_MUST_NOT_ENABLE_CHERRY_PICKING');
requireText(protocolSource, "stateAlphabet: ['NORMAL', 'ALERTA', 'PROTECCION', 'RECUPERACION']", 'STATE_ALPHABET_MUST_BE_PREDECLARED');
requireText(protocolSource, 'thresholdsRetunableInV9: false', 'V8_THRESHOLDS_MUST_REMAIN_FROZEN');
requireText(protocolSource, "policyVersion: 'V9_POLICY_1'", 'FROZEN_POLICY_VERSION_MISSING');
requireText(protocolSource, 'alertOnHitsRequired: 2', 'FROZEN_ALERT_HITS_MISSING');
requireText(protocolSource, 'alertWindowSessions: 3', 'FROZEN_ALERT_WINDOW_MISSING');
requireText(protocolSource, 'recoveryOffSessionsRequired: 5', 'FROZEN_RECOVERY_RULE_MISSING');
requireText(protocolSource, 'protectionReductionPct: 25', 'FROZEN_PROTECTION_SIZE_MISSING');

console.log('forwardRiskV9ValidationProtocol.unit: PASS');
