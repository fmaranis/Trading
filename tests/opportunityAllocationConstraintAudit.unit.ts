import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { qualityAllocationMultiplierV1 } from '../src/investment/decision/portfolioDecisionEngine';

assert.equal(qualityAllocationMultiplierV1(50, 50), 1);
assert.equal(qualityAllocationMultiplierV1(100, 100), 1.15);
assert.equal(qualityAllocationMultiplierV1(0, 0), 0.85);

const runner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/opportunityAllocationConstraintAuditV1Live.ts'), 'utf8');
const replayCore = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicHistoricalReplayCore.ts'), 'utf8');
const engine = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/portfolioDecisionEngine.ts'), 'utf8');
const compatibilityEntry = fs.readFileSync(path.resolve(process.cwd(), 'scripts/opportunityQualityAllocationBridgeV1Live.ts'), 'utf8');

assert.match(compatibilityEntry, /import '.\/opportunityAllocationConstraintAuditV1Live';/);
assert.match(runner, /DIAGNOSTIC_STAGE = 'ALLOCATION_CONSTRAINT_AUDIT_V1'/);
assert.match(runner, /monthlyDecisionCadenceIsNotRecurringContribution: true/);
assert.match(runner, /replayHistoricalPortfolioCurrentlySetsPendingCapitalEur: 0/);
assert.match(runner, /noPolicyParameterChangesForThisAudit: true/);
assert.match(runner, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.match(runner, /finally\s*\{\s*PortfolioDecisionEngine\.evaluate = originalEvaluate;/s);
assert.doesNotMatch(runner, /PortfolioCandidateGate\.apply\s*=/);
assert.match(runner, /bridgeAlreadyClosedAsInsufficientFromPriorRun: true/);
assert.match(runner, /noBridgeAmplificationOrRetuningAllowed: true/);

assert.match(replayCore, /stagedCapitalPlan:\s*\{\s*availableEur:\s*0,\s*horizonMonths:\s*12,\s*preferredMode:\s*'MONTHLY'\s*\}/);
assert.match(engine, /opportunityAllocationPolicy \?\? 'LEGACY'/);
assert.match(engine, /Math\.max\(0\.85, Math\.min\(1\.15, 1 \+ adjustment \/ 100\)\)/);

console.log('opportunityAllocationConstraintAudit.unit: PASS');
