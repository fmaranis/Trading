import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const worker = source('src/workers/historicalReplayAudit.worker.ts');
const auditControls = source('src/components/HistoricalAuditJsonControls.tsx');
const replayPublic = source('src/investment/decision/dynamicHistoricalReplay.ts');

assert.match(replayPublic, /structuralCoreBenchmarkFinalEur/);
assert.match(replayPublic, /structuralCoreBenchmarkStartDate/);
assert.match(replayPublic, /structuralCoreBenchmarkEndDate/);
assert.match(replayPublic, /excessReturnVsStructuralCorePctPoints/);
assert.match(replayPublic, /beatsStructuralCoreBenchmark/);
assert.match(replayPublic, /MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);
assert.match(replayPublic, /startLagDays > MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);
assert.match(replayPublic, /endLagDays > MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);

assert.match(worker, /structuralCoreBenchmark/);
assert.match(worker, /auditExtensions/);
assert.match(worker, /STRUCTURAL_CORE_BENCHMARK/);
assert.match(worker, /CORE_ALPHA_V2/);
assert.match(worker, /replayPolicy/);

assert.match(auditControls, /extractStructuralCoreBenchmark/);
assert.match(auditControls, /summary:\s*\{/);
assert.match(auditControls, /structuralCoreBenchmark/);
assert.match(auditControls, /Motor vs 100% core global/);
assert.match(auditControls, /MOTOR > CORE/);
assert.match(auditControls, /CORE ≥ MOTOR/);
assert.match(auditControls, /new Set\(\[3, 4\]\)/);

console.log('coreBenchmarkAudit.unit: PASS');
