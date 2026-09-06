import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V8_ECONOMIC_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V8_ECONOMIC_GUARD_FAIL:${label}`); }

const script = source('scripts/forwardRiskV8EconomicGateLive.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

requireText(script, 'INITIAL_CAPITAL_EUR = 13_000', 'INITIAL_CAPITAL_MUST_STAY_FROZEN');
requireText(script, 'PROTECTION_REDUCTION_PCT = 25', 'PROTECTION_PERCENT_MUST_STAY_FROZEN');
requireText(script, 'V5_SIGNAL_SCORE_PCT = 80', 'V5_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'V7_SIGNAL_SCORE_PCT = 80', 'V7_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'EVENT_THRESHOLD_PCT = 5', 'EVENT_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'MIN_DRAWDOWN_REDUCTION_PCT_POINTS = 1', 'DRAWDOWN_GATE_MUST_STAY_FROZEN');
requireText(script, 'MIN_HOLDOUT_ECONOMIC_PASSES = 4', 'HOLDOUT_PASS_COUNT_MUST_STAY_FROZEN');
requireText(script, 'loadForwardRiskMacroDataV5VintageSafe', 'MUST_USE_VINTAGE_SAFE_MACRO');
requireText(script, "mode: 'HISTORICAL_ECB_DFR_FLOOR_0'", 'MUST_USE_HISTORICAL_ECB_CASH');
requireText(script, 'accrueRemuneratedCashScenarioAfterTax', 'MUST_USE_EXISTING_AFTER_TAX_CASH_ENGINE');
requireText(script, 'brokerCommission', 'MUST_USE_EXISTING_BROKER_COMMISSION');
requireText(script, 'estimateSpanishTaxOnRealizedGain', 'MUST_USE_EXISTING_REALIZED_GAIN_TAX');
requireText(script, 'estimateSpanishTaxOnCashInterest', 'MUST_USE_EXISTING_CASH_INTEREST_TAX');
requireText(script, 'point.informationDate >= executionDate', 'NEXT_OPEN_MUST_REJECT_SAME_DATE_INFORMATION');
requireText(script, "executionMode: 'NEXT_OPEN'", 'NEXT_OPEN_POLICY_MISSING');
requireText(script, "'HOLDOUT_XDEM'", 'PREDECLARED_HOLDOUT_SET_MISSING');
requireText(script, 'V8_CAUSAL_ECONOMIC_GATE_PASS_READY_FOR_SHADOW_PILOT', 'PASS_VERDICT_MISSING');
requireText(script, 'V8_CAUSAL_ECONOMIC_GATE_FAIL_RESEARCH_ONLY', 'FAIL_VERDICT_MISSING');
requireText(script, 'productionPromotionAllowed: false', 'MUST_NOT_PROMOTE_TO_PRODUCTION');
requireText(script, 'parameterGridUsed: false', 'GRID_PROHIBITION_MISSING');
requireText(script, 'protectionPctRetuned: false', 'PROTECTION_RETUNING_PROHIBITION_MISSING');
forbidText(script, 'PROTECTION_REDUCTION_PCT = 10', 'NO_POSTHOC_PROTECTION_GRID');
forbidText(script, 'PROTECTION_REDUCTION_PCT = 50', 'NO_POSTHOC_PROTECTION_GRID');
forbidText(worker, 'forwardRiskV8EconomicGate', 'ECONOMIC_RESEARCH_MUST_NOT_ENTER_REPLAY_WORKER');
forbidText(worker, 'V8_CAUSAL_ECONOMIC', 'ECONOMIC_RESEARCH_MUST_NOT_ENTER_REPLAY_WORKER');

console.log('forwardRiskV8EconomicGate.unit: PASS');
