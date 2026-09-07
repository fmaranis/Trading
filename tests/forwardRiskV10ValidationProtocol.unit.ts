import fs from 'node:fs';
import path from 'node:path';
import {
  FORWARD_RISK_V10_VALIDATION_PROTOCOL,
  assertForwardRiskV10HistoricalHoldoutUnlocked
} from '../src/investment/decision/forwardRiskV10ValidationProtocol';
import { FORWARD_RISK_V10_POLICY_FINGERPRINT } from '../src/investment/decision/forwardRiskV10Policy';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:${label}`);
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:${label}`);
}
function readLocalStatus(): 'PENDING' | 'PASS' {
  return FORWARD_RISK_V10_VALIDATION_PROTOCOL.localImplementationGates.status as 'PENDING' | 'PASS';
}

const protocolSource = source('src/investment/decision/forwardRiskV10ValidationProtocol.ts');
const universeSource = source('src/investment/decision/assetUniverse.ts');
const v9ProtocolSource = source('src/investment/decision/forwardRiskV9ValidationProtocol.ts');
const expectedBlindTickers = ['VGVF.DE', 'VNRA.DE', 'VFEM.DE', 'VERE.DE', 'VGEK.DE', 'VJPN.DE'];
const actualBlindTickers = FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);

if (JSON.stringify(actualBlindTickers) !== JSON.stringify(expectedBlindTickers)) {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:BLIND_SAMPLE_CHANGED');
}
for (const ticker of expectedBlindTickers) {
  forbidText(universeSource, ticker, `BLIND_TICKER_ALREADY_IN_EXISTING_UNIVERSE:${ticker}`);
  forbidText(v9ProtocolSource, ticker, `BLIND_TICKER_ALREADY_IN_V9_PROTOCOL:${ticker}`);
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.policyFreeze.status !== 'FROZEN') {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:POLICY_NOT_FROZEN');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.policyFreeze.fingerprint !== FORWARD_RISK_V10_POLICY_FINGERPRINT) {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:FINGERPRINT_CHANGED');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.futureForwardConfirmation.startDateInclusive !== '2026-09-08') {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:FUTURE_FORWARD_START_CHANGED');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.frozenRiskInput.v5ThresholdPct !== 80 || FORWARD_RISK_V10_VALIDATION_PROTOCOL.frozenRiskInput.v7ThresholdPct !== 80) {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:V8_THRESHOLDS_CHANGED');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.frozenOpportunityInput.source !== 'PORTFOLIO_CANDIDATE_GATE' || FORWARD_RISK_V10_VALIDATION_PROTOCOL.frozenOpportunityInput.signal !== 'ELIGIBLE') {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:OPPORTUNITY_INPUT_CHANGED');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.frozenEconomicContract.existingHoldings !== 'NEVER_SELL_OR_REDUCE') {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:EXISTING_HOLDINGS_MUST_NEVER_SELL');
}
if (FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.replacementAfterOpeningAllowed !== false
  || FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.insufficientDataReplacementAllowed !== false
  || FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.dataQualityFailureReplacementAllowed !== false) {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:BLIND_REPLACEMENT_MUST_BE_FORBIDDEN');
}

const localStatus = readLocalStatus();
if (localStatus !== 'PENDING' && localStatus !== 'PASS') {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:INVALID_LOCAL_GATE_STATUS');
}
if (localStatus === 'PENDING') {
  let locked = false;
  try {
    assertForwardRiskV10HistoricalHoldoutUnlocked();
  } catch (error) {
    locked = error instanceof Error && error.message === 'V10_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED';
  }
  if (!locked) throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:HOLDOUT_MUST_STAY_LOCKED_UNTIL_LOCAL_GATES_PASS');
} else if (assertForwardRiskV10HistoricalHoldoutUnlocked() !== FORWARD_RISK_V10_POLICY_FINGERPRINT) {
  throw new Error('FORWARD_RISK_V10_PROTOCOL_GUARD_FAIL:UNLOCKED_FINGERPRINT_MISMATCH');
}

requireText(protocolSource, 'Do not fetch or inspect historical price series for V10 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.', 'ANTI_LEAKAGE_RULE_MISSING');
requireText(protocolSource, 'Do not use V9 blind assets as V10 validation assets or replacements.', 'V9_CONTAMINATION_BOUNDARY_MISSING');
requireText(protocolSource, 'Do not add a V10-specific opportunity threshold; use the existing PortfolioCandidateGate ELIGIBLE boolean only.', 'NO_NEW_UPSIDE_THRESHOLD_RULE_MISSING');
requireText(protocolSource, 'Do not sell or reduce existing holdings inside V10_POLICY_1.', 'NO_SELL_RULE_MISSING');
requireText(protocolSource, "failureSemantics: 'ASSET_INVALID_DATA_AND_AGGREGATE_INCONCLUSIVE_IF_FEWER_THAN_6_VALID_NO_REPLACEMENT'", 'DATA_QUALITY_FAILURE_SEMANTICS_MISSING');

console.log('forwardRiskV10ValidationProtocol.unit: PASS');
