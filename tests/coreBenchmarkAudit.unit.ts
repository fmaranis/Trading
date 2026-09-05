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
assert.match(replayPublic, /excessReturnVsStructuralCorePctPoints/);
assert.match(replayPublic, /beatsStructuralCoreBenchmark/);

assert.match(worker, /structuralCoreBenchmark/);
assert.match(worker, /auditExtensions/);
assert.match(worker, /STRUCTURAL_CORE_BENCHMARK/);
assert.match(worker, /CORE_ARCHITECTURE_V1/);

assert.match(auditControls, /extractStructuralCoreBenchmark/);
assert.match(auditControls, /summary:\s*\{/);
assert.match(auditControls, /structuralCoreBenchmark/);
assert.match(auditControls, /Motor vs 100% core global/);
assert.match(auditControls, /MOTOR > CORE/);
assert.match(auditControls, /CORE ≥ MOTOR/);
assert.match(auditControls, /new Set\(\[3, 4\]\)/);

console.log('coreBenchmarkAudit.unit: PASS');
