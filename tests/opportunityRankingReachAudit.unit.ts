import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/opportunityRankingReachAuditLive.ts'), 'utf8');

assert.match(script, /OPPORTUNITY_RANKING_REACH_AUDIT_V1/);
assert.match(script, /productionArchitecture: 'CORE_ARCHITECTURE_V1'/);
assert.match(script, /currentYahooDiscoveryInHistoricalAudit: false/);
assert.match(script, /productionPolicyRemains: 'LEGACY'/);
assert.match(script, /productionPromotionAllowed: false/);
assert.match(script, /noThresholdTuningOnConsumedWindows: true/);
assert.match(script, /PortfolioCandidateGate\.apply =/);
assert.match(script, /eligibleSetParityViolations/);
assert.match(script, /rankOrderChangedDecisionGates/);
assert.match(script, /selectedSetChangedDecisionGates/);
assert.match(script, /plannedAcquisitionDecisionDatesChanged/);
assert.match(script, /executedAcquisitionDecisionDatesChanged/);
assert.match(script, /selectionCompetition/);
assert.match(script, /runDynamicReplayWithRotationExperiment\(input, 'CORE_ARCHITECTURE_V1'\)/);
assert.doesNotMatch(script, /open-universe/);
assert.doesNotMatch(script, /asset-discovery/);
assert.doesNotMatch(script, /QUALITY_V1\.1|SLOPE_V1\.1/);

console.log('opportunityRankingReachAudit.unit: PASS');
