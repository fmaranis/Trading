import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

const quality = source('src/investment/decision/replaySelectionQualityExperiment.ts');
const slope = source('src/investment/decision/replaySlopeSelectionExperiment.ts');
const gate = source('src/investment/decision/portfolioCandidateGate.ts');
const worker = source('src/workers/historicalReplayAudit.worker.ts');
const replay = source('src/investment/decision/dynamicHistoricalReplayCore.ts');

for (const experiment of [quality, slope]) {
  assert.match(experiment, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
  assert.doesNotMatch(experiment, /runDynamicReplayWithStrategicCoreHoldExperiment/);
  assert.match(experiment, /PortfolioCandidateGate\.apply/);
}

assert.match(quality, /'QUALITY_V1'/);
assert.match(slope, /'SLOPE_V1'/);
assert.match(gate, /CandidateSelectionPolicy = 'LEGACY' \| 'QUALITY_V1' \| 'SLOPE_V1'/);
assert.match(gate, /Experimental selection policies can only change relative ranking among those/);
assert.match(gate, /if \(cash\.passes !== true\)/);
assert.match(gate, /if \(timing\.state === 'WAIT'\)/);
assert.match(worker, /REPLAY_ROTATION_EXPERIMENT = 'CORE_ARCHITECTURE_V1'/);

// Current Yahoo discovery must never appear inside the historical replay core.
assert.doesNotMatch(replay, /asset-discovery/);
assert.doesNotMatch(replay, /open-universe/);
assert.doesNotMatch(replay, /currentOpenDiscovery/);

console.log('opportunityRankingArchitecture.unit: PASS');
