import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V8_ROLLING_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V8_ROLLING_GUARD_FAIL:${label}`); }

const rolling = source('scripts/forwardRiskComplementarityV8RollingLive.ts');

requireText(rolling, 'const START_YEAR = 2011', 'V8_ROLLING_START_MUST_BE_2011');
requireText(rolling, 'const END_YEAR = 2026', 'V8_ROLLING_END_MUST_BE_2026');
requireText(rolling, "const DATA_FROM = '2008-01-01'", 'V8_DATA_FROM_MUST_BE_FROZEN');
requireText(rolling, "const FINAL_END_DATE = '2026-09-01'", 'V8_FINAL_DATE_MUST_BE_FROZEN');
requireText(rolling, 'runForwardRiskVulnerabilityV5({', 'V8_MUST_USE_FROZEN_V5');
requireText(rolling, 'runForwardRiskOptionsV7({', 'V8_MUST_USE_FROZEN_V7');
requireText(rolling, 'runForwardRiskComplementarityV8({ v5, v7 })', 'V8_COMPLEMENTARITY_RUNNER_MISSING');
requireText(rolling, "'V8_COMPLEMENTARITY_SIGNAL_FOUND_REQUIRES_INDEPENDENT_CONFIRMATION'", 'V8_PASS_MUST_NOT_PROMOTE');
requireText(rolling, "'RETIRE_V5_V7_COMPLEMENTARITY_PATH'", 'V8_FAIL_VERDICT_MISSING');
requireText(rolling, 'macroPointInTimeVintageSafe', 'V8_VINTAGE_SAFETY_MUST_BE_REPORTED');
requireText(rolling, 'anticipation >= 50%', 'V8_GATE_MUST_REMAIN_FROZEN');
forbidText(rolling, 'thresholdGrid', 'V8_MUST_NOT_GRID_THRESHOLDS');
forbidText(rolling, 'COVID', 'V8_MUST_NOT_SELECT_CRISIS_WINDOWS');

console.log('forwardRiskComplementarityV8Rolling.unit: PASS');
