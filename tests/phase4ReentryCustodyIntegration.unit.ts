import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';
import { brokerCommission } from '../src/investment/decision/costAwareExecutionPolicy';
import { applyExitProceedsCustodyV1, EXIT_PROCEEDS_CUSTODY_V1 } from '../src/investment/decision/reentryCashCustodyPolicy';

const wrapperSource = readFileSync('src/investment/decision/replayRotationPolicyExperiment.ts', 'utf8');
const workerSource = readFileSync('src/workers/historicalReplayAudit.worker.ts', 'utf8');
const policySource = readFileSync('src/investment/decision/reentryCashCustodyPolicy.ts', 'utf8');
const indexSource = readFileSync('src/investment/decision/index.ts', 'utf8');
const runnerSource = readFileSync('scripts/phase4ReentryCashCustodyV1BlindLive.ts', 'utf8');
const validationRoutesSource = readFileSync('server/researchValidationRoutes.ts', 'utf8');

// Architecture parity: Phase 4 layers on the existing replay wrapper; production
// still reaches CORE_GATE_V1 + CORE_ARCHITECTURE_V1 through that same path.
assert.match(workerSource, /runDynamicReplayWithRotationExperiment\(input,\s*REPLAY_ROTATION_EXPERIMENT\)/);
assert.match(workerSource, /REPLAY_ROTATION_EXPERIMENT\s*=\s*'CORE_ARCHITECTURE_V1'/);
assert.match(wrapperSource, /applyCoreGateV1\(/);
assert.match(wrapperSource, /applyCoreArchitectureV1\(/);
assert.match(wrapperSource, /PHASE4_REENTRY_REQUIRES_CORE_ARCHITECTURE_V1/);
assert.match(wrapperSource, /reentryFundingPolicy:\s*EXIT_PROCEEDS_CUSTODY_V1|reentryFundingPolicy\s*===\s*EXIT_PROCEEDS_CUSTODY_V1/);

// Production/default remains clean.
assert.doesNotMatch(workerSource, /EXIT_PROCEEDS_CUSTODY_V1/);
assert.doesNotMatch(indexSource, /reentryCashCustodyPolicy/);

// Structured authority only: reason text can never enable custody.
assert.doesNotMatch(policySource, /reason\.includes\(/);
assert.doesNotMatch(wrapperSource, /reason\.includes\(/);
assert.match(wrapperSource, /healthSnapshot\(evaluationInput,\s*position\.assetId\)\?\.action\s*===\s*'EXIT'/);
assert.match(wrapperSource, /item\s*!=\s*null[\s\S]{0,100}item\.instrumentType\s*!==\s*'MUTUAL_FUND'/);
assert.match(wrapperSource, /PHASE4_REENTRY_ELIGIBLE_EXIT_PREDICTION_REQUIRED/);

// Execution accounting guards: Phase 4 must detach RETURN_TO_CORE before
// calculating the actual common NEXT_OPEN funding/prices and must fail if the
// execution date does not converge after the final order set is known.
assert.match(wrapperSource, /prepareExitProceedsCustodyV1\(/);
assert.match(wrapperSource, /rotationFundingByAssetId/);
assert.match(wrapperSource, /executionPriceByAssetId/);
assert.match(wrapperSource, /executionPricesForContributions/);
assert.match(wrapperSource, /PHASE4_REENTRY_EXECUTION_DATE_NOT_STABLE/);
assert.match(wrapperSource, /Math\.max\(0,\s*grossEur\s*-\s*feeEur\)\s*\*\s*0\.30/);
assert.match(policySource, /notional\s*\+\s*fee\s*<=\s*budget/);
assert.match(policySource, /reservations\.length\s*>\s*0\s*\|\|\s*detached\.qualifyingExitAssetIds\.length\s*>\s*0/);
assert.match(policySource, /PHASE4_REENTRY_ROTATION_FUNDING_REQUIRED_WHILE_CUSTODY_ACTIVE/);

// Reach and reserve usage must be backed by a positive structured authorization
// for that exact asset/EXIT. A generic later BUY is not enough.
assert.match(policySource, /reservedCashAuthorizedByAssetEur/);
assert.match(wrapperSource, /overlay\.telemetry\.matchedReentryAssetIds/);
assert.match(wrapperSource, /authorizedReserveSpendEur/);
assert.match(wrapperSource, /row\.sourceExitSignalId\s*===\s*predicted\.signalId/);
assert.match(wrapperSource, /row\.reservedCashUsedEur\s*>\s*0\.01/);

// One-shot runner and RVC ordering remain sealed: guards + TypeScript before blind.
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

// Before custody exists, diagnostics are inert and baseline sizing is exact.
{
  const result = applyExitProceedsCustodyV1({
    result: decision(),
    scan,
    reservations: [],
    eligibleHealthExitAssetIds: [],
    rotationFundingByAssetId: { [challenger.assetId]: 600 },
    executionPriceByAssetId: { [challenger.assetId]: 50 },
    policy: EXIT_PROCEEDS_CUSTODY_V1
  });
  assert.equal(result.decision.contributions.length, 1);
  assert.equal(Number(result.decision.contributions[0].amountEur.toFixed(2)), 1_000);
  assert.deepEqual(result.telemetry.reservedCashAuthorizedByAssetEur, {});
}

// Once custody is active, the paired BUY may use only its dedicated net proceeds.
// Commission is inside the 600 EUR funding cap, so at 50 EUR/share the maximum is
// 11 shares = 550 EUR notional plus the broker fee.
{
  const result = applyExitProceedsCustodyV1({
    result: decision(),
    scan,
    reservations: [{ assetId: 'EQ_PH4_R2_RESERVED', amountEur: 1_000, createdAt: '2009-12-01' }],
    eligibleHealthExitAssetIds: [],
    rotationFundingByAssetId: { [challenger.assetId]: 600 },
    executionPriceByAssetId: { [challenger.assetId]: 50 },
    policy: EXIT_PROCEEDS_CUSTODY_V1
  });
  assert.equal(result.decision.contributions.length, 1);
  const amount = result.decision.contributions[0].amountEur;
  assert.equal(Number(amount.toFixed(2)), 550);
  assert.ok(amount + brokerCommission(amount) <= 600 + 1e-9);
  assert.equal(Number(result.telemetry.dedicatedRotationFundingEur.toFixed(2)), 600);
  assert.equal(Number(result.telemetry.effectiveReservedCashEur.toFixed(2)), 1_000);
  assert.deepEqual(result.telemetry.reservedCashAuthorizedByAssetEur, {});
}

console.log('phase4ReentryCustodyIntegration.unit: PASS');
