import fs from 'node:fs';
import path from 'node:path';
import {
  FORWARD_RISK_V11_VALIDATION_PROTOCOL,
  assertForwardRiskV11HistoricalHoldoutUnlocked
} from '../src/investment/decision/forwardRiskV11ValidationProtocol';
import { FORWARD_RISK_V11_POLICY_FINGERPRINT } from '../src/investment/decision/forwardRiskV11SizingOverlay';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function forbidText(file: string, text: string, label: string): void {
  if (file.includes(text)) throw new Error(`FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:${label}`);
}
function requireText(file: string, text: string, label: string): void {
  if (!file.includes(text)) throw new Error(`FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:${label}`);
}

const universeSource = source('src/investment/decision/assetUniverse.ts');
const v9Source = source('src/investment/decision/forwardRiskV9ValidationProtocol.ts');
const v10Source = source('src/investment/decision/forwardRiskV10ValidationProtocol.ts');
const protocolSource = source('src/investment/decision/forwardRiskV11ValidationProtocol.ts');
const expectedTickers = ['IUSQ.DE', 'SXR4.DE', 'EUNM.DE', 'EUNK.DE', 'SXR1.DE', 'SXRZ.DE'];
const actualTickers = FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
if (JSON.stringify(actualTickers) !== JSON.stringify(expectedTickers)) throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:BLIND_SAMPLE_CHANGED');

for (const ticker of expectedTickers) {
  forbidText(universeSource, ticker, `BLIND_TICKER_ALREADY_IN_EXISTING_UNIVERSE:${ticker}`);
  forbidText(v9Source, ticker, `BLIND_TICKER_ALREADY_IN_V9:${ticker}`);
  forbidText(v10Source, ticker, `BLIND_TICKER_ALREADY_IN_V10:${ticker}`);
}

if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.policyFreeze.status !== 'FROZEN') throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:POLICY_NOT_FROZEN');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.policyFreeze.fingerprint !== FORWARD_RISK_V11_POLICY_FINGERPRINT) throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:FINGERPRINT_CHANGED');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.productionPromotionAllowed !== false) throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:PRODUCTION_PROMOTION_MUST_BE_FALSE');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.status !== 'OPENED_CONSUMED_FAIL_2026_09_07') throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:CONSUMED_STATUS_MISSING');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.blindOutcome.verdict !== 'V11_BLIND_FAIL_RETIRE_V11_POLICY_1') throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:BLIND_OUTCOME_CHANGED');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.blindOutcome.validBlindAssets !== 6 || FORWARD_RISK_V11_VALIDATION_PROTOCOL.blindOutcome.individualPasses !== 0) throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:BLIND_COUNTS_CHANGED');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.futureForwardConfirmation.status !== 'CANCELLED_AFTER_HISTORICAL_BLIND_FAIL') throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:FUTURE_CONFIRMATION_MUST_BE_CANCELLED');
if (FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.replacementAfterOpeningAllowed !== false
  || FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.insufficientDataReplacementAllowed !== false
  || FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.dataQualityFailureReplacementAllowed !== false) {
  throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:REPLACEMENT_MUST_BE_FORBIDDEN');
}

let consumedLocked = false;
try {
  assertForwardRiskV11HistoricalHoldoutUnlocked();
} catch (error) {
  consumedLocked = error instanceof Error && error.message === 'V11_BLIND_HOLDOUT_ALREADY_CONSUMED';
}
if (!consumedLocked) throw new Error('FORWARD_RISK_V11_PROTOCOL_GUARD_FAIL:CONSUMED_HOLDOUT_MUST_BE_LOCKED');

requireText(protocolSource, 'Do not fetch or inspect historical price series for V11 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.', 'ANTI_LEAKAGE_RULE_MISSING');
requireText(protocolSource, 'Do not use V9 or V10 blind assets as V11 validation assets or replacements.', 'CONTAMINATION_BOUNDARY_MISSING');
requireText(protocolSource, 'Do not let Forward Risk make a rejected PortfolioCandidateGate asset eligible.', 'BASE_GATE_OVERRIDE_FORBIDDEN');
requireText(protocolSource, 'Do not add a risk-specific daily release/waiting state to V11.', 'NO_WAITING_STATE_RULE_MISSING');
requireText(protocolSource, 'accumulating share class to avoid dividend-cashflow bias when using causal split-adjusted Close', 'ACCUMULATING_SAMPLE_RULE_MISSING');
requireText(protocolSource, "drawdownMetric: 'FLOW_ADJUSTED_UNIT_NAV_MAX_DRAWDOWN'", 'FLOW_ADJUSTED_DRAWDOWN_MISSING');
requireText(protocolSource, "failureSemantics: 'ASSET_INVALID_DATA_AND_AGGREGATE_INCONCLUSIVE_IF_FEWER_THAN_6_VALID_NO_REPLACEMENT'", 'DATA_FAILURE_SEMANTICS_MISSING');
requireText(protocolSource, "disposition: 'RETIRED_NO_V11_1_ON_OPENED_HOLDOUT'", 'RETIRE_DISPOSITION_MISSING');

console.log('forwardRiskV11ValidationProtocol.unit: PASS');
