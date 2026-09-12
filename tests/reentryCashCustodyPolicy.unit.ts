import assert from 'node:assert/strict';
import type { AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';
import {
  applyExitProceedsCustodyV1,
  availableCashRespectingReentryReservations,
  effectiveReentryReservations,
  EXIT_PROCEEDS_CUSTODY_V1,
  REENTRY_CUSTODY_EXIT_MARKER,
  type ReentryCashReservation
} from '../src/investment/decision/reentryCashCustodyPolicy';

const core = { assetId: 'EUNL', ticker: 'EUNL.DE', name: 'Core World', category: 'GLOBAL_EQUITY', currency: 'EUR' } as const;
const exited = { assetId: 'EQ_PH4_TEST', ticker: 'TEST.DE', name: 'Test Equity', category: 'EUROPE_EQUITY', currency: 'EUR' } as const;
const other = { assetId: 'EQ_PH4_OTHER', ticker: 'OTHR.DE', name: 'Other Equity', category: 'EUROPE_EQUITY', currency: 'EUR' } as const;

const scan: AssetUniverseScanResult = {
  scanned: 3,
  accepted: 3,
  rejected: 0,
  rejectionCounts: {},
  selected: [],
  candidates: [core, exited, other].map(asset => ({
    asset,
    status: 'ACCEPTED' as const,
    bars: 300,
    asOfDate: '2026-01-01',
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

function base(overrides: Partial<PortfolioDecisionResult> = {}): PortfolioDecisionResult {
  return {
    currentInvestedValueEur: 8_000,
    currentCashEur: 2_000,
    pendingCapitalEur: 0,
    totalPlannedCapitalEur: 10_000,
    targetCashEur: 500,
    deployableToAssetsEur: 1_500,
    plannedRotationProceedsEur: 0,
    maxPortfolioPositions: 12,
    occupiedPortfolioPositions: 2,
    availablePortfolioSlots: 10,
    recommendedNewInvestmentEur: 0,
    residualPlannedCashEur: 2_000,
    exposures: [],
    existingPositions: [],
    contributions: [],
    warnings: [],
    ...overrides
  };
}

function reservation(amountEur = 1_000): ReentryCashReservation {
  return { assetId: exited.assetId, amountEur, createdAt: '2025-06-02' };
}

// LEGACY must be an exact pass-through: Phase 4 cannot change production/default behavior.
{
  const input = base();
  const result = applyExitProceedsCustodyV1({ result: input, scan, reservations: [reservation()], policy: 'LEGACY' });
  assert.equal(result.decision, input);
  assert.equal(result.telemetry.policy, 'LEGACY');
}

// A non-core health EXIT that CORE_ARCHITECTURE_V1 had routed back to the strategic
// core is detached under the candidate. Only that sale amount is removed; the EXIT
// itself remains and gets the explicit custody marker.
{
  const result = base({
    currentInvestedValueEur: 10_000,
    currentCashEur: 0,
    targetCashEur: 0,
    deployableToAssetsEur: 2_000,
    plannedRotationProceedsEur: 2_000,
    recommendedNewInvestmentEur: 2_000,
    residualPlannedCashEur: 0,
    existingPositions: [{
      id: exited.ticker,
      assetId: exited.assetId,
      label: exited.name,
      instrumentType: 'ETF_ETC',
      category: 'EUROPE_EQUITY',
      currentValueEur: 2_000,
      action: 'EXIT',
      reason: 'health exit [CORE_ARCHITECTURE_V1:RETURN_TO_CORE]',
      suggestedReductionPct: 100,
      rotationChallengerAssetId: core.assetId,
      rotationChallengerTicker: core.ticker
    }],
    contributions: [{
      category: 'GLOBAL_EQUITY', assetId: core.assetId, ticker: core.ticker, name: core.name,
      instrumentType: 'ETF_ETC', amountEur: 2_000, targetCategoryGapEur: 2_000,
      currentAssetValueEur: 8_000, targetAssetValueEur: 10_000, executableTargetAssetValueEur: 10_000,
      positionStage: 'ROTATION_ENTRY', reason: 'return to core'
    }]
  });
  const next = applyExitProceedsCustodyV1({ result, scan, reservations: [], policy: EXIT_PROCEEDS_CUSTODY_V1 });
  assert.equal(next.decision.plannedRotationProceedsEur, 0);
  assert.equal(next.decision.contributions.length, 0);
  assert.equal(next.decision.existingPositions[0].rotationChallengerAssetId, null);
  assert.match(next.decision.existingPositions[0].reason, new RegExp(REENTRY_CUSTODY_EXIT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(next.telemetry.detachedReturnToCoreEur, 2_000);
  assert.deepEqual(next.telemetry.qualifyingExitAssetIds, [exited.assetId]);
}

// Strategic cores never create Phase-4 custody.
{
  const result = base({
    existingPositions: [{
      id: core.assetId, assetId: core.assetId, label: core.name, instrumentType: 'ETF_ETC', category: 'GLOBAL_EQUITY',
      currentValueEur: 2_000, action: 'EXIT', reason: 'core exit', suggestedReductionPct: 100
    }]
  });
  const next = applyExitProceedsCustodyV1({ result, scan, reservations: [], policy: EXIT_PROCEEDS_CUSTODY_V1 });
  assert.deepEqual(next.telemetry.qualifyingExitAssetIds, []);
  assert.doesNotMatch(next.decision.existingPositions[0].reason, /EXIT_PROCEEDS_CUSTODY_V1/);
}

// Reserved cash remains unavailable to unrelated contributions, while the same
// asset may use its own reservation only up to the canonical amount already emitted.
{
  const result = base({
    recommendedNewInvestmentEur: 1_500,
    residualPlannedCashEur: 500,
    contributions: [
      {
        category: 'EUROPE_EQUITY', assetId: exited.assetId, ticker: exited.ticker, name: exited.name,
        instrumentType: 'ETF_ETC', amountEur: 500, targetCategoryGapEur: 500,
        currentAssetValueEur: 0, targetAssetValueEur: 500, executableTargetAssetValueEur: 500,
        positionStage: 'STARTER', reason: 'canonical reentry'
      },
      {
        category: 'GLOBAL_EQUITY', assetId: core.assetId, ticker: core.ticker, name: core.name,
        instrumentType: 'ETF_ETC', amountEur: 1_000, targetCategoryGapEur: 1_000,
        currentAssetValueEur: 7_500, targetAssetValueEur: 8_500, executableTargetAssetValueEur: 8_500,
        positionStage: 'BUILD', reason: 'core top-up'
      }
    ]
  });
  const next = applyExitProceedsCustodyV1({ result, scan, reservations: [reservation(1_000)], policy: EXIT_PROCEEDS_CUSTODY_V1 });
  const reentry = next.decision.contributions.find(row => row.assetId === exited.assetId)!;
  const coreTopUp = next.decision.contributions.find(row => row.assetId === core.assetId)!;
  assert.equal(Number(reentry.amountEur.toFixed(2)), 500);
  assert.equal(Number(coreTopUp.amountEur.toFixed(2)), 500);
  assert.equal(next.telemetry.effectiveReservedCashEur, 1_000);
  assert.equal(next.telemetry.reservedCashAuthorizedForReentryEur, 500);
  assert.deepEqual(next.telemetry.matchedReentryAssetIds, [exited.assetId]);
  assert.ok(reentry.amountEur <= 500 + 1e-9, 'custody may never enlarge canonical sizing');
}

// With no matching reentry, only the genuinely free base deployable amount can fund
// ordinary contributions. The reservation remains cash and does not disappear.
{
  const result = base({
    recommendedNewInvestmentEur: 1_500,
    residualPlannedCashEur: 500,
    contributions: [
      {
        category: 'GLOBAL_EQUITY', assetId: core.assetId, ticker: core.ticker, name: core.name,
        instrumentType: 'ETF_ETC', amountEur: 1_000, targetCategoryGapEur: 1_000,
        currentAssetValueEur: 7_000, targetAssetValueEur: 8_000, executableTargetAssetValueEur: 8_000,
        positionStage: 'BUILD', reason: 'core'
      },
      {
        category: 'EUROPE_EQUITY', assetId: other.assetId, ticker: other.ticker, name: other.name,
        instrumentType: 'ETF_ETC', amountEur: 500, targetCategoryGapEur: 500,
        currentAssetValueEur: 0, targetAssetValueEur: 500, executableTargetAssetValueEur: 500,
        positionStage: 'STARTER', reason: 'other'
      }
    ]
  });
  const next = applyExitProceedsCustodyV1({ result, scan, reservations: [reservation(1_000)], policy: EXIT_PROCEEDS_CUSTODY_V1 });
  const total = next.decision.contributions.reduce((sum, row) => sum + row.amountEur, 0);
  assert.ok(total <= 500 + 1e-6, `unrelated investments may use only free 500 EUR, got ${total}`);
  assert.equal(next.telemetry.matchedReentryAssetIds.length, 0);
}

// Target cash has precedence over custody: a nominal reserve cannot magically turn
// required cash into deployable cash.
{
  const effective = effectiveReentryReservations({
    reservations: [reservation(1_000)],
    currentCashEur: 1_000,
    pendingCapitalEur: 0,
    targetCashEur: 500,
    baseDeployableToAssetsEur: 500
  });
  assert.equal(effective.get(exited.assetId), 500);
}

// Executor helper protects reservations belonging to other assets but makes the
// matching reservation accessible to its own reentry.
{
  const reservations: ReentryCashReservation[] = [
    reservation(700),
    { assetId: other.assetId, amountEur: 300, createdAt: '2025-07-01' }
  ];
  assert.equal(availableCashRespectingReentryReservations(1_500, reservations), 500);
  assert.equal(availableCashRespectingReentryReservations(1_500, reservations, exited.assetId), 1_200);
}

console.log('reentryCashCustodyPolicy.unit: PASS');
