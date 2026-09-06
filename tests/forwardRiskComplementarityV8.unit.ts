import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V8_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V8_GUARD_FAIL:${label}`); }

const model = source('src/investment/decision/forwardRiskComplementarityV8.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

requireText(model, "FORWARD_RISK_COMPLEMENTARITY_V8", 'V8_IDENTITY_MISSING');
requireText(model, "FROZEN_V5_OR_V7_COMPLEMENTARITY_DIAGNOSTIC_NO_RETUNING", 'V8_METHODOLOGY_MISSING');
requireText(model, 'const V5_VULNERABLE_SCORE_PCT = 80', 'V8_MUST_INHERIT_FROZEN_V5_THRESHOLD');
requireText(model, 'const V7_SIGNAL_SCORE_PCT = 80', 'V8_MUST_INHERIT_FROZEN_V7_THRESHOLD');
requireText(model, 'const PRE_PEAK_LOOKBACK_SESSIONS = 63', 'V8_LOOKBACK_MUST_REMAIN_FROZEN');
requireText(model, 'v5Point.vulnerabilityScorePct >= V5_VULNERABLE_SCORE_PCT || v7Point.signalScorePct >= V7_SIGNAL_SCORE_PCT', 'V8_MUST_BE_SIMPLE_OR_UNION');
requireText(model, 'anticipationRatePct ?? 0) >= 50', 'V8_DIAGNOSTIC_ANTICIPATION_GATE_MISSING');
requireText(model, 'medianLeadSessionsBeforePeak ?? 0) >= 10', 'V8_DIAGNOSTIC_LEAD_GATE_MISSING');
requireText(model, 'falseSignalTimePct ?? 100) <= 35', 'V8_DIAGNOSTIC_FALSE_SIGNAL_GATE_MISSING');
requireText(model, 'requires independent confirmation', 'V8_POST_SELECTION_CAUTION_MISSING');
forbidText(model, 'logistic', 'V8_MUST_NOT_FIT_MODEL');
forbidText(model, 'grid', 'V8_MUST_NOT_OPTIMIZE_GRID');
forbidText(model, 'targetExposure', 'V8_MUST_NOT_SET_PRODUCTION_EXPOSURE');
forbidText(worker, 'forwardRiskComplementarityV8', 'V8_MUST_NOT_BE_WIRED_TO_REPLAY_WORKER');
forbidText(worker, 'FORWARD_RISK_COMPLEMENTARITY_V8', 'V8_MUST_NOT_AFFECT_PRODUCTIVE_REPLAY');

console.log('forwardRiskComplementarityV8.unit: PASS');
