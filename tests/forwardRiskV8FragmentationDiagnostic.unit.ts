import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V8_FRAGMENTATION_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V8_FRAGMENTATION_GUARD_FAIL:${label}`); }

const script = source('scripts/forwardRiskV8FragmentationDiagnosticLive.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

requireText(script, 'V5_SIGNAL_SCORE_PCT = 80', 'V5_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'V7_SIGNAL_SCORE_PCT = 80', 'V7_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'FROZEN_V8_VINTAGE_SAFE_SIGNAL_STATE_FRAGMENTATION_DIAGNOSTIC_NO_POLICY_TUNING', 'METHODOLOGY_MARKER_MISSING');
requireText(script, 'actual EUNL market sessions', 'MUST_MEASURE_MARKET_SESSIONS');
requireText(script, 'at least 20 ON runs AND at least 40% of ON runs last <=3 market sessions', 'DIAGNOSTIC_RULE_MUST_BE_PREDECLARED');
requireText(script, 'thresholdsRetuned: false', 'NO_THRESHOLD_RETUNING_REQUIRED');
requireText(script, 'policyRetuned: false', 'NO_POLICY_RETUNING_REQUIRED');
requireText(script, 'productionPromotionAllowed: false', 'MUST_NOT_PROMOTE_TO_PRODUCTION');
forbidText(script, 'protectionReductionPct', 'DIAGNOSTIC_MUST_NOT_TEST_PROTECTION_SIZES');
forbidText(script, 'brokerCommission', 'DIAGNOSTIC_MUST_NOT_SIMULATE_TRADES');
forbidText(worker, 'forwardRiskV8Fragmentation', 'RESEARCH_DIAGNOSTIC_MUST_NOT_ENTER_REPLAY_WORKER');

console.log('forwardRiskV8FragmentationDiagnostic.unit: PASS');
