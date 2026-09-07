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
const actualBlindTickers = FORWARD_RISK_V9_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);

if (JSON.stringify(actualBlindTickers) !== JSON.stringify(expectedBlindTickers)) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:BLIND_SAMPLE_CHANGED');
}

for (const ticker of expectedBlindTickers) {
  forbidText(universeSource, `ticker: '${ticker}'`, `BLIND_TICKER_ALREADY_IN_EXISTING_UNIVERSE:${ticker}`);
}

if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze.status !== 'NOT_FROZEN') {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:POLICY_MUST_START_LOCKED');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze.fingerprint !== null) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:POLICY_FINGERPRINT_MUST_START_NULL');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.futureForwardConfirmation.startDateInclusive !== '2026-09-08') {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:FUTURE_FORWARD_START_CHANGED');
}
if (FORWARD_RISK_V9_VALIDATION_PROTOCOL.frozenSignalInput.v5ThresholdPct !== 80 || FORWARD_RISK_V9_VALIDATION_PROTOCOL.frozenSignalInput.v7ThresholdPct !== 80) {
  throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:V8_THRESHOLDS_CHANGED');
}

let locked = false;
try {
  assertForwardRiskV9HistoricalHoldoutUnlocked();
} catch (error) {
  locked = error instanceof Error && error.message === 'V9_BLIND_HOLDOUT_LOCKED_POLICY_NOT_FROZEN';
}
if (!locked) throw new Error('FORWARD_RISK_V9_PROTOCOL_GUARD_FAIL:BLIND_HOLDOUT_NOT_LOCKED');

requireText(protocolSource, 'Do not fetch or inspect historical price series for V9 blind assets before policyFreeze.status is FROZEN.', 'ANTI_LEAKAGE_RULE_MISSING');
requireText(protocolSource, 'replacementAfterOpeningAllowed: false', 'HOLDOUT_REPLACEMENT_MUST_BE_FORBIDDEN');
requireText(protocolSource, 'insufficientDataReplacementAllowed: false', 'INSUFFICIENT_DATA_MUST_NOT_ENABLE_CHERRY_PICKING');
requireText(protocolSource, "stateAlphabet: ['NORMAL', 'ALERTA', 'PROTECCION', 'RECUPERACION']", 'STATE_ALPHABET_MUST_BE_PREDECLARED');
requireText(protocolSource, 'thresholdsRetunableInV9: false', 'V8_THRESHOLDS_MUST_REMAIN_FROZEN');

console.log('forwardRiskV9ValidationProtocol.unit: PASS');
