import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { candidateQualityAdjustment } from '../src/investment/decision/portfolioCandidateGate';
import { qualityAllocationMultiplierV1 } from '../src/investment/decision/portfolioDecisionEngine';

assert.equal(candidateQualityAdjustment(50, 50), 0);
assert.equal(qualityAllocationMultiplierV1(50, 50), 1);
assert.equal(qualityAllocationMultiplierV1(100, 100), 1.15);
assert.equal(qualityAllocationMultiplierV1(0, 0), 0.85);
assert.ok(qualityAllocationMultiplierV1(80, 80) > 1);
assert.ok(qualityAllocationMultiplierV1(20, 20) < 1);

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/portfolioDecisionEngine.ts'), 'utf8');
assert.match(source, /OpportunityAllocationPolicy = 'LEGACY' \| 'QUALITY_ALLOCATION_BRIDGE_V1'/);
assert.match(source, /opportunityAllocationPolicy \?\? 'LEGACY'/);
assert.match(source, /candidateQualityAdjustment\(reliabilityScore, opportunityScore\)/);
assert.match(source, /Math\.max\(0\.85, Math\.min\(1\.15, 1 \+ adjustment \/ 100\)\)/);
assert.match(source, /opportunityPriority\(alert, opportunityAllocationPolicy\)/);
assert.match(source, /QUALITY_ALLOCATION_BRIDGE_V1 research-only/);

console.log('opportunityQualityAllocationBridge.unit: PASS');
