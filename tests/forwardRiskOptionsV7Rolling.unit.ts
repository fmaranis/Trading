import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V7_ROLLING_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V7_ROLLING_GUARD_FAIL:${label}`); }

const script = source('scripts/forwardRiskOptionsV7RollingLive.ts');

requireText(script, 'const START_YEAR = 2011', 'V7_START_YEAR_MUST_BE_2011');
requireText(script, 'const END_YEAR = 2026', 'V7_END_YEAR_MUST_BE_2026');
requireText(script, "const DATA_FROM = '2008-01-01'", 'V7_WARMUP_START_MISSING');
requireText(script, "const FINAL_END_DATE = '2026-09-01'", 'V7_FINAL_END_DATE_MISSING');
requireText(script, 'loadForwardRiskOptionsDataV7', 'V7_OPTIONS_DATA_LOADER_REQUIRED');
requireText(script, 'runForwardRiskOptionsV7', 'V7_RUNNER_REQUIRED');
requireText(script, "asset.assetId === 'EUNL'", 'V7_CORE_ANCHOR_REQUIRED');
requireText(script, '(anticipationRatePct ?? 0) >= 50', 'V7_AGGREGATE_ANTICIPATION_GATE_MISSING');
requireText(script, '(medianLeadSessionsBeforePeak ?? 0) >= 10', 'V7_AGGREGATE_LEAD_GATE_MISSING');
requireText(script, '(falseSignalTimePct ?? 100) <= 35', 'V7_AGGREGATE_FALSE_SIGNAL_GATE_MISSING');
requireText(script, "'RETIRE_V7_OPTIONS_IMPLIED_ARCHITECTURE'", 'V7_RETIRE_VERDICT_MISSING');
requireText(script, "'V7_CANDIDATE_FOR_ECONOMIC_GATE'", 'V7_PASS_VERDICT_MISSING');
requireText(script, 'FORWARD_RISK_V7_OPTIONS_RESULT', 'V7_RESULT_MARKER_MISSING');
forbidText(script, 'YEAR_2020\'', 'V7_MUST_NOT_HANDPICK_COVID');
forbidText(script, 'thresholds', 'V7_MUST_NOT_RUN_THRESHOLD_GRID');
forbidText(script, 'forwardRiskCrossAssetV6', 'V7_MUST_NOT_REUSE_V6_SIGNAL');
forbidText(script, 'forwardRiskVulnerabilityV5', 'V7_MUST_NOT_REUSE_V5_SIGNAL');

console.log('forwardRiskOptionsV7Rolling.unit: PASS');
