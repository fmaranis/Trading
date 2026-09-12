import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';
import { applyExitProceedsCustodyV1, EXIT_PROCEEDS_CUSTODY_V1 } from '../src/investment/decision/reentryCashCustodyPolicy';

const wrapperSource = readFileSync('src/investment/decision/replayRotationPolicyExperiment.ts', 'utf8');
const workerSource = readFileSync('src/workers/historicalReplayAudit.worker.ts', 'utf8');
const policySource = readFileSync('src/investment/decision/reentryCashCustodyPolicy.ts', 'utf8');
const indexSource = readFileSync('src/investment/decision/index.ts', 'utf8');
const runnerSource = readFileSync('scripts/phase4ReentryCashCustodyV1BlindLive.ts', 'utf8');
const validationRoutesSource = readFileSync('server/researchValidationRoutes.ts', 'utf8');

// Architecture parity: Phase 4 must layer on the exact existing canonical replay
// wrapper. Directly replacing the core call with evaluatePortfolioDecision would
// apply CORE_GATE/CORE_ARCHITECTURE twice because this wrapper already owns them.
assert.match(workerSource, /runDynamicReplayWithRotationExperiment\(input,\s*REPLAY_ROTATION_EXPERIMENT\)/);
assert.match(workerSource, /REPLAY_ROTATION_EXPERIMENT\s*=\s*'CORE_ARCHITECTURE_V1'/);
assert.match(wrapperSource, /applyCoreGateV1\(/);
assert.match(wrapperSource, /applyCoreArchitectureV1\(/);
assert.match(wrapperSource, /PHASE4_REENTRY_REQUIRES_CORE_ARCHITECTURE_V1/);
assert.match(wrapperSource, /reentryFundingPolicy:\s*EXIT_PROCEEDS_CUSTODY_V1|reentryFundingPolicy\s*===\s*EXIT_PROCEEDS_CUSTODY_V1/);

// Production/default remains clean. The worker must never enable the research
// policy and the isolated module must not be exported through the public barrel.
assert.doesNotMatch(workerSource, /EXIT_PROCEEDS_CUSTODY_V1/);
assert.doesNotMatch(indexSource, /reentryCashCustodyPolicy/);

// Text is audit only. Neither policy nor wrapper can use reason strings as
// execution authority.
assert.doesNotMatch(policySource, /reason\.includes\(/);
assert.doesNotMatch(wrapperSource, /reason\.includes\(/);
assert.match(wrapperSource, /healthSnapshot\(evaluationInput,\s*position\.assetId\)\?\.action\s*===\s*'EXIT'/);
assert.match(wrapperSource, /rotationFundingByAssetId/);
assert.match(wrapperSource, /replayDecisionDate\(evaluationInput\)/);

// The one-shot runner must use the existing wrapper for paired baseline/candidate
// comparisons and may only appear after guards + TypeScript in the existing RVC.
assert.match(runnerSource, /runDynamicReplayWithRotationExperiment\(replayInput,\s*'CORE_ARCHITECTURE_V1'\)/);
assert.match(runnerSource, /reentryFundingPolicy:\s*EXIT_PROCEEDS_CUSTODY_V1/);
assert.match(runnerSource, /sampleState:\s*'R2_OPENED_CONSUMED'/);
assert.match(runnerSource, /currentOpenDiscovery:\s*false/);
assert.match(runnerSource, /PHASE4_R2_PREOPEN_PRODUCT_CATALOG_CONTAMINATION/);
const phase4Job = validationRoutesSource.indexOf("id: 'phase4-reentry-cash-custody-v1'");
assert.ok(phase4Job >= 0, 'Phase 4 must be one job in the existing ResearchValidationCenter');
const phase4Slice = validationRoutesSource.slice(phase4Job, validationRoutesSource.indexOf("id: 'quality-allocation-dynamic-future-forward-v1'", phase4Job));
assert.ok(phase4Slice.indexOf("label: 'TypeScript'") >= 0);
assert.ok(phase4Slice.indexOf("label: 'Blind R2 REAL one-shot'") > phase4Slice.indexOf("label: 'TypeScript'"));

const core = { assetId: 'EUNL', ticker: 'EUNL.DE', name: 'Core', category: 'GLOBAL_EQUITY', currency: 'EUR' } as const;
const incumbent = { assetId: 'EQ_PH4_R2_TEST', ticker: 'TEST.DE', name: 'Incumbent', category: 'EUROPE_EQUITY', currency: 'EUR' } as const;
const challenger = { assetId: 'EQ_PH4_R2_NEXT', ticker: 'NEXT.DE', name: 'Challenger', category: 'EUROPE_EQUITY', currency: 'EUR' } as const;
const scan: AssetUniverseScanResult = {
  scanned: 3,
  accepted: 3,
  rejected: 0,
  rejectionCounts: {},
  selected: [],
  candidates: [core, incumbent, challenger].map(asset => ({
    asset,
    status: 'ACCEPTED' as const,
    bars: 400,
    asOfDate: '2010-01-04',
    lastClose: 50,
    momentum20Pct: 5,
    momentum60Pct: 8,
    momentum120Pct: 12,
    annualizedVolatilityPct: 15,
    maxDrawdownPct: 10,
    score: 10
  })),
  dataset: { timeframe: '1d', assets: [] },
  acceptedDataset: { timeframe: '1d', assets: [] }
};

function decision(): PortfolioDecisionResult {
  return {
    currentInvestedValueEur: 9_000,
    currentCashEur: 1_000,
    pendingCapitalEur: 0,
    totalPlannedCapitalEur: 10_000,
    targetCashEur: 0,
    deployableToAssetsEur: 2_000,
    plannedRotationProceedsEur: 1_000,
    maxPortfolioPositions: 12,
    occupiedPortfolioPositions: 2,
    availablePortfolioSlots: 10,
    recommendedNewInvestmentEur: 1_000,
    residualPlannedCashEur: 0,
    exposures: [],
    existingPositions: [{
      id: incumbent.ticker,
      assetId: incumbent.assetId,
      label: incumbent.name,
      instrumentType: 'ETF_ETC',
      category: 'EUROPE_EQUITY',
      currentValueEur: 1_000,
      action: 'EXIT',
      reason: 'competitive rotation',
      suggestedReductionPct: 100,
      rotationChallengerAssetId: challenger.assetId,
      rotationChallengerTicker: challenger.ticker
    }],
    contributions: [{
      category: 'EUROPE_EQUITY',
      assetId: challenger.assetId,
      ticker: challenger.ticker,
      name: challenger.name,
      instrumentType: 'ETF_ETC',
      amountEur: 1_000,
      targetCategoryGapEur: 1_000,
      currentAssetValueEur: 0,
      targetAssetValueEur: 1_000,
      executableTargetAssetValueEur: 1_000,
      positionStage: 'ROTATION_ENTRY',
      reason: 'atomic challenger'
    }],
    warnings: []
  };
}

// Before the first reservation exists, structured net-funding diagnostics must
// have zero economic authority. Candidate and baseline ordinary rotations remain
// identical; otherwise Phase 4 would secretly test a second fee/tax policy.
{
  const result = applyExitProceedsCustodyV1({
    result: decision(),
    scan,
    reservations: [],
    eligibleHealthExitAssetIds: [],
    rotationFundingByAssetId: { [challenger.assetId]: 600 },
    policy: EXIT_PROCEEDS_CUSTODY_V1
  });
  assert.equal(result.decision.contributions.length, 1);
  assert.equal(Number(result.decision.contributions[0].amountEur.toFixed(2)), 1_000);
}

// Once custody is active, a 1:1 rotation whose sale can really fund only 600 EUR
// may not borrow the 1,000 EUR reservation belonging to a different asset. The
// challenger is capped to dedicated proceeds because free base cash is reserved.
{
  const result = applyExitProceedsCustodyV1({
    result: decision(),
    scan,
    reservations: [{ assetId: 'EQ_PH4_R2_RESERVED', amountEur: 1_000, createdAt: '2009-12-01' }],
    eligibleHealthExitAssetIds: [],
    rotationFundingByAssetId: { [challenger.assetId]: 600 },
    policy: EXIT_PROCEEDS_CUSTODY_V1
  });
  assert.equal(result.decision.contributions.length, 1);
  assert.equal(Number(result.decision.contributions[0].amountEur.toFixed(2)), 600);
  assert.equal(Number(result.telemetry.dedicatedRotationFundingEur.toFixed(2)), 600);
  assert.equal(Number(result.telemetry.effectiveReservedCashEur.toFixed(2)), 1_000);
}

console.log('phase4ReentryCustodyIntegration.unit: PASS');
