import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`FORWARD_RISK_V8_VINTAGE_SAFE_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`FORWARD_RISK_V8_VINTAGE_SAFE_GUARD_FAIL:${label}`); }

const loader = source('src/investment/decision/forwardRiskMacroDataV5VintageSafe.ts');
const script = source('scripts/forwardRiskV8VintageSafeLive.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

requireText(loader, 'FRED_API_KEY_REQUIRED', 'MUST_REQUIRE_FRED_API_KEY');
requireText(loader, "output_type: '1'", 'MUST_USE_REALTIME_PERIOD_OUTPUT');
requireText(loader, 'realtime_start', 'MUST_READ_REALTIME_START');
requireText(loader, 'realtime_end', 'MUST_READ_REALTIME_END');
requireText(loader, "source: 'FRED_API_ALFRED_REALTIME_PERIODS'", 'VINTAGE_SAFE_PROVENANCE_MISSING');
requireText(loader, 'pointInTimeVintageSafe: true', 'VINTAGE_SAFE_FLAG_MISSING');
forbidText(loader, 'fredgraph.csv', 'VINTAGE_SAFE_MUST_NOT_USE_CURRENT_GRAPH_CSV');
forbidText(loader, "from './synthetic", 'VINTAGE_SAFE_MUST_NOT_IMPORT_SYNTHETIC_DATA');
forbidText(loader, "from '../synthetic", 'VINTAGE_SAFE_MUST_NOT_IMPORT_SYNTHETIC_DATA');
forbidText(loader, 'DataSourceType.SYNTHETIC', 'VINTAGE_SAFE_MUST_NOT_USE_SYNTHETIC_DATA');

requireText(script, 'V5_SIGNAL_SCORE_PCT = 80', 'V5_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'V7_SIGNAL_SCORE_PCT = 80', 'V7_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, 'PRE_PEAK_LOOKBACK_SESSIONS = 63', 'LOOKBACK_MUST_STAY_FROZEN');
requireText(script, 'EVENT_THRESHOLD_PCT = 5', 'EVENT_THRESHOLD_MUST_STAY_FROZEN');
requireText(script, "'HOLDOUT_XDEM'", 'PREDECLARED_HOLDOUT_SET_MISSING');
requireText(script, 'V8_VINTAGE_SAFE_CONFIRMATION_PASS_READY_FOR_CAUSAL_ECONOMIC_GATE', 'PASS_VERDICT_MISSING');
requireText(script, 'productionPromotionAllowed: false', 'MUST_NOT_PROMOTE_TO_PRODUCTION');
forbidText(worker, 'forwardRiskV8VintageSafe', 'VINTAGE_SAFE_RESEARCH_MUST_NOT_ENTER_REPLAY_WORKER');

console.log('forwardRiskV8VintageSafe.unit: PASS');
