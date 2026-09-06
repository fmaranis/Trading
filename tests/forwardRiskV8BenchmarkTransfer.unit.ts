import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string { return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'); }
function requireText(file: string, text: string, label: string): void { if (!file.includes(text)) throw new Error(`V8_BENCHMARK_TRANSFER_GUARD_FAIL:${label}`); }
function forbidText(file: string, text: string, label: string): void { if (file.includes(text)) throw new Error(`V8_BENCHMARK_TRANSFER_GUARD_FAIL:${label}`); }

const script = source('scripts/forwardRiskV8BenchmarkTransferLive.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');

for (const id of ['HOLDOUT_XDEM','HOLDOUT_XDEV','HOLDOUT_XDEQ','HOLDOUT_XDEB','HOLDOUT_IS3R','HOLDOUT_IS3S']) {
  requireText(script, `'${id}'`, `BENCHMARK_${id}_MISSING`);
}
requireText(script, "V5_SIGNAL_SCORE_PCT = 80", 'V5_THRESHOLD_MUST_REMAIN_FROZEN');
requireText(script, "V7_SIGNAL_SCORE_PCT = 80", 'V7_THRESHOLD_MUST_REMAIN_FROZEN');
requireText(script, "PRE_PEAK_LOOKBACK_SESSIONS = 63", 'LOOKBACK_MUST_REMAIN_FROZEN');
requireText(script, "EVENT_THRESHOLD_PCT = 5", 'EVENT_THRESHOLD_MUST_REMAIN_FROZEN');
requireText(script, "valid.length >= 3", 'MINIMUM_BENCHMARK_GATE_MISSING');
requireText(script, "anticipationRatePct ?? 0) >= 50", 'ANTICIPATION_GATE_MISSING');
requireText(script, "medianLeadSessionsBeforePeak ?? 0) >= 10", 'LEAD_GATE_MISSING');
requireText(script, "falseSignalTimePct ?? 100) <= 35", 'FALSE_SIGNAL_GATE_MISSING');
requireText(script, "productionPromotionAllowed: false", 'PRODUCTION_PROMOTION_MUST_BE_BLOCKED');
requireText(script, "Current-vintage FRED macro still blocks production/economic promotion", 'VINTAGE_CAVEAT_MISSING');
forbidText(script, 'grid', 'NO_PARAMETER_GRID_ALLOWED');
forbidText(script, 'targetExposure', 'NO_PRODUCTION_EXPOSURE_ALLOWED');
forbidText(worker, 'forwardRiskV8BenchmarkTransfer', 'TRANSFER_CONFIRMATION_MUST_NOT_BE_WIRED_TO_REPLAY');

console.log('forwardRiskV8BenchmarkTransfer.unit: PASS');
