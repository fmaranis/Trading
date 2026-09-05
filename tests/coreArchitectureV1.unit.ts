import assert from 'node:assert/strict';
import {
  applyCoreArchitectureV1,
  CORE_ARCHITECTURE_V1_LIMITS,
  type PortfolioEvaluationInput
} from '../src/investment/decision/portfolioCoreGatePolicy';
import { portfolioAssetRole } from '../src/investment/decision/portfolioAssetRole';
import { applyStrategicCoreShortTermProtection } from '../src/investment/decision/strategicCorePolicy';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';

const coreAsset = {
  assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', isin: 'IE00B03HD191',
  name: 'Vanguard Global Stock Index Fund EUR Acc', category: 'GLOBAL_EQUITY', currency: 'EUR',
  instrumentType: 'MUTUAL_FUND'
} as const;
const usAsset = {
  assetId: 'SXR8', ticker: 'SXR8.DE', isin: 'IE00B5BMR087',
  name: 'iShares Core S&P 500 UCITS ETF', category: 'US_EQUITY', currency: 'EUR'
} as const;
const stockAsset = {
  assetId: 'EQ_ASML', ticker: 'ASML.AS', name: 'ASML Holding', category: 'SEMICONDUCTORS', currency: 'EUR'
} as const;

function input(riskProfile: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'): PortfolioEvaluationInput {
  return {
    portfolio: { cashEur: 0, holdings: [], funds: [], updatedAt: '2026-01-01T00:00:00Z' },
    scan: {
      scanned: 3, accepted: 3, rejected: 0, rejectionCounts: {},
      selected: [],
      candidates: [coreAsset, usAsset, stockAsset].map(asset => ({ asset, status: 'ACCEPTED', bars: 300, asOfDate: '2026-01-01', lastClose: 100, momentum20Pct: 5, momentum60Pct: 8, momentum120Pct: 12, annualizedVolatilityPct: 15, maxDrawdownPct: 10, score: 10 })),
      dataset: { timeframe: '1d', assets: [] },
      acceptedDataset: { timeframe: '1d', assets: [] }
    },
    decision: {
      generatedAt: '2026-01-01T00:00:00Z', asOfDate: '2026-01-01', dataAgeDays: 0, currency: 'EUR', capitalEur: 10_000,
      riskProfile, horizonYears: 3, marketRegime: 'BULL_LOW_VOL', regimeTrendPct: 10, regimeVolatilityPct: 15,
      confidence: 'HIGH', confidenceScore: 90, recommendedMethod: 'RISK_PARITY_ERC', cashWeight: 0.05, cashAmountEur: 500,
      assets: [], portfolioDatasetFingerprint: 'TEST', evidence: 'REAL_ONLY', warnings: [], summary: 'test', methodology: []
    },
    fundMarketValues: {}, positionHealth: {}, cashBenchmarkAnnualPct: 2
  } as unknown as PortfolioEvaluationInput;
}

function result(overrides: Partial<PortfolioDecisionResult> = {}): PortfolioDecisionResult {
  return {
    currentInvestedValueEur: 0,
    currentCashEur: 10_000,
    pendingCapitalEur: 0,
    totalPlannedCapitalEur: 10_000,
    targetCashEur: 10_000,
    deployableToAssetsEur: 0,
    plannedRotationProceedsEur: 0,
    maxPortfolioPositions: 12,
    occupiedPortfolioPositions: 0,
    availablePortfolioSlots: 12,
    recommendedNewInvestmentEur: 0,
    residualPlannedCashEur: 10_000,
    exposures: [],
    existingPositions: [],
    contributions: [],
    warnings: [],
    ...overrides
  };
}

// The structural core is global broad-market exposure. US500 is a tilt/sleeve,
// not an untouchable substitute for the whole world portfolio.
assert.equal(portfolioAssetRole(coreAsset), 'STRATEGIC_GROWTH_CORE');
assert.equal(portfolioAssetRole(usAsset), 'DIVERSIFIED_SLEEVE');

// Tactical health is still observable for the core, but cannot authorize a sale.
const protectedHealth = applyStrategicCoreShortTermProtection(coreAsset.assetId, {
  key: coreAsset.assetId, label: coreAsset.name, tickerOrIsin: coreAsset.ticker,
  action: 'EXIT', reason: 'Deterioro estructural fuerte', source: 'UNIVERSE_SCAN', currency: 'EUR',
  currentUnitPrice: 100, currentValueEur: 8_000, consensusScore: -5, favorableVotes: 0, unfavorableVotes: 5,
  structuralDowntrend: true, excessVsCashPctPoints: -10, suggestedReductionPct: 100
});
assert.equal(protectedHealth.action, 'WATCH');
assert.equal(protectedHealth.suggestedReductionPct, null);
assert.match(protectedHealth.reason, /STRATEGIC_CORE_HOLD_V1/);

// CORE_ARCHITECTURE_V1 independently blocks an EXIT emitted by the baseline
// portfolio engine and removes its tactical challenger.
{
  const base = result({
    currentInvestedValueEur: 8_000, currentCashEur: 0, totalPlannedCapitalEur: 8_000,
    targetCashEur: 0, residualPlannedCashEur: 0, occupiedPortfolioPositions: 1, availablePortfolioSlots: 11,
    existingPositions: [{
      id: coreAsset.assetId, assetId: coreAsset.assetId, label: coreAsset.name, instrumentType: 'MUTUAL_FUND', category: 'GLOBAL_EQUITY',
      currentValueEur: 8_000, action: 'EXIT', reason: 'baseline EXIT', suggestedReductionPct: 100,
      rotationChallengerAssetId: usAsset.assetId, rotationChallengerTicker: usAsset.ticker
    }],
    contributions: [{
      category: 'US_EQUITY', assetId: usAsset.assetId, ticker: usAsset.ticker, name: usAsset.name, instrumentType: 'ETF_ETC',
      amountEur: 8_000, targetCategoryGapEur: 8_000, positionStage: 'ROTATION_ENTRY', reason: 'baseline rotation'
    }],
    recommendedNewInvestmentEur: 8_000, plannedRotationProceedsEur: 8_000, deployableToAssetsEur: 8_000
  });
  const next = applyCoreArchitectureV1(input(), base);
  assert.equal(next.existingPositions[0].action, 'HOLD');
  assert.equal(next.existingPositions[0].rotationChallengerAssetId, null);
  assert.equal(next.contributions.some(row => row.assetId === usAsset.assetId), false);
}

// Idle money is deployed to the structural core; only the explicit operational
// reserve remains cash. For MEDIUM that reserve is 5%, not a timing position.
{
  const next = applyCoreArchitectureV1(input('MEDIUM'), result());
  const core = next.contributions.find(row => row.assetId === coreAsset.assetId);
  assert.ok(core);
  assert.equal(Number(core!.amountEur.toFixed(2)), 9_500);
  assert.equal(Number(next.residualPlannedCashEur.toFixed(2)), 500);
  assert.equal(CORE_ARCHITECTURE_V1_LIMITS.MEDIUM.operationalCashReserveShare, 0.05);
}

// Fresh non-core exposure cannot exceed the profile budget. Existing exposure is
// not force-sold just because it is near the cap.
{
  const base = result({
    currentInvestedValueEur: 2_000, currentCashEur: 8_000,
    existingPositions: [{
      id: usAsset.assetId, assetId: usAsset.assetId, label: usAsset.name, instrumentType: 'ETF_ETC', category: 'US_EQUITY',
      currentValueEur: 2_000, action: 'HOLD', reason: 'hold'
    }],
    contributions: [{
      category: 'SEMICONDUCTORS', assetId: stockAsset.assetId, ticker: stockAsset.ticker, name: stockAsset.name, instrumentType: 'ETF_ETC',
      amountEur: 1_000, targetCategoryGapEur: 1_000, positionStage: 'STARTER', priorityScore: 100, reason: 'alpha'
    }],
    recommendedNewInvestmentEur: 1_000,
    residualPlannedCashEur: 7_000,
    deployableToAssetsEur: 1_000,
    occupiedPortfolioPositions: 1,
    availablePortfolioSlots: 11
  });
  const next = applyCoreArchitectureV1(input('MEDIUM'), base);
  const alpha = next.contributions.find(row => row.assetId === stockAsset.assetId);
  assert.ok(alpha);
  assert.equal(Number(alpha!.amountEur.toFixed(2)), 500); // 25% of 10k less existing 2k sleeve.
}

// A non-core sale returns to the structural core instead of leaving the proceeds
// in cash. The pair is marked ROTATION_ENTRY so replay execution remains atomic.
{
  const base = result({
    currentInvestedValueEur: 10_000, currentCashEur: 0, targetCashEur: 0, residualPlannedCashEur: 0,
    occupiedPortfolioPositions: 2, availablePortfolioSlots: 10,
    existingPositions: [
      { id: coreAsset.assetId, assetId: coreAsset.assetId, label: coreAsset.name, instrumentType: 'MUTUAL_FUND', category: 'GLOBAL_EQUITY', currentValueEur: 8_000, action: 'HOLD', reason: 'core hold' },
      { id: usAsset.assetId, assetId: usAsset.assetId, label: usAsset.name, instrumentType: 'ETF_ETC', category: 'US_EQUITY', currentValueEur: 2_000, action: 'EXIT', reason: 'tilt exit', suggestedReductionPct: 100 }
    ]
  });
  const next = applyCoreArchitectureV1(input('MEDIUM'), base);
  const sale = next.existingPositions.find(row => row.assetId === usAsset.assetId)!;
  const coreContribution = next.contributions.find(row => row.assetId === coreAsset.assetId)!;
  assert.equal(sale.rotationChallengerAssetId, coreAsset.assetId);
  assert.equal(coreContribution.positionStage, 'ROTATION_ENTRY');
  assert.equal(Number(coreContribution.amountEur.toFixed(2)), 2_000);
}

console.log('coreArchitectureV1.unit: PASS');
