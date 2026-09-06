import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V7_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V7_GUARD_FAIL:${label}`); }

const model = source('src/investment/decision/forwardRiskOptionsV7.ts');
const data = source('src/investment/decision/forwardRiskOptionsDataV7.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

requireText(model, "FORWARD_RISK_OPTIONS_V7", 'V7_IDENTITY_MISSING');
requireText(model, "PAST_ONLY_OPTIONS_IMPLIED_STRESS_NO_LABEL_FIT", 'V7_METHODOLOGY_MISSING');
requireText(model, 'const SIGNAL_SCORE = 0.80', 'V7_SIGNAL_THRESHOLD_MUST_BE_FROZEN');
requireText(model, 'const PRE_PEAK_LOOKBACK_SESSIONS = 63', 'V7_PRE_PEAK_LOOKBACK_MUST_BE_FROZEN');
requireText(model, 'const EVENT_THRESHOLD_PCT = 5', 'V7_EVENT_THRESHOLD_MUST_MATCH_PRIOR_GATES');
requireText(model, 'anticipationRatePct ?? 0) >= 50', 'V7_ANTICIPATION_GATE_MISSING');
requireText(model, 'medianLeadSessionsBeforePeak ?? 0) >= 10', 'V7_LEAD_GATE_MISSING');
requireText(model, 'falseSignalTimePct ?? 100) <= 35', 'V7_FALSE_SIGNAL_GATE_MISSING');
requireText(model, "input.optionsData.series.VIX", 'V7_VIX_REQUIRED');
requireText(model, "input.optionsData.series.VIX9D", 'V7_VIX9D_REQUIRED');
requireText(model, "input.optionsData.series.VVIX", 'V7_VVIX_REQUIRED');
requireText(model, 'history.map(row => row.components[name])', 'V7_PAST_ONLY_NORMALIZATION_MISSING');
forbidText(model, 'logistic', 'V7_MUST_NOT_FIT_LOGISTIC_MODEL');
forbidText(model, 'labelEnd', 'V7_MUST_NOT_USE_FUTURE_LABEL_FIT');
forbidText(model, 'targetExposure', 'V7_MUST_NOT_SET_PRODUCTION_EXPOSURE');

requireText(data, 'CBOE_PUBLIC_HISTORICAL_CSV', 'V7_CBOE_PROVENANCE_MISSING');
requireText(data, 'VIX_History.csv', 'V7_CBOE_VIX_SOURCE_MISSING');
requireText(data, 'VIX9D_History.csv', 'V7_CBOE_VIX9D_SOURCE_MISSING');
requireText(data, 'VVIX_History.csv', 'V7_CBOE_VVIX_SOURCE_MISSING');
requireText(data, 'V7_CBOE_DATA_REQUIRED', 'V7_MUST_FAIL_CLOSED_WITHOUT_REAL_OPTIONS_DATA');
requireText(data, 'there is no synthetic fallback', 'V7_NO_SYNTHETIC_FALLBACK_MUST_BE_EXPLICIT');
forbidText(data, "source: 'SYNTHETIC'", 'V7_DATA_MUST_NOT_DECLARE_SYNTHETIC_SOURCE');

forbidText(worker, 'forwardRiskOptionsV7', 'V7_MUST_NOT_BE_WIRED_TO_REPLAY_WORKER');
forbidText(worker, 'FORWARD_RISK_OPTIONS_V7', 'V7_MUST_NOT_AFFECT_PRODUCTIVE_REPLAY');

console.log('forwardRiskOptionsV7.unit: PASS');
