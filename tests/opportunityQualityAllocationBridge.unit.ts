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

const engine = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/portfolioDecisionEngine.ts'), 'utf8');
const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/opportunityQualityAllocationBridgeV1Live.ts'), 'utf8');

assert.match(engine, /OpportunityAllocationPolicy = 'LEGACY' \| 'QUALITY_ALLOCATION_BRIDGE_V1'/);
assert.match(engine, /opportunityAllocationPolicy \?\? 'LEGACY'/);
assert.match(engine, /candidateQualityAdjustment\(reliabilityScore, opportunityScore\)/);
assert.match(engine, /Math\.max\(0\.85, Math\.min\(1\.15, 1 \+ adjustment \/ 100\)\)/);
assert.match(engine, /const opportunities = CurrentOpportunityAlertEngine\.evaluate\(scan, cashBenchmarkAnnualPct\);/);
assert.doesNotMatch(engine, /CurrentOpportunityAlertEngine\.evaluate\(scan, cashBenchmarkAnnualPct,\s*'QUALITY_V1'\)/);
assert.match(engine, /opportunityPriority\(alert, opportunityAllocationPolicy\)/);
assert.match(engine, /QUALITY_ALLOCATION_BRIDGE_V1 research-only/);

assert.match(runner, /gateSelectionPolicy: 'LEGACY_UNCHANGED'/);
assert.match(runner, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner, /finally\s*\{\s*PortfolioDecisionEngine\.evaluate = originalEvaluate;/s);
assert.doesNotMatch(runner, /PortfolioCandidateGate\.apply\s*=/);

console.log('opportunityQualityAllocationBridge.unit: PASS');
