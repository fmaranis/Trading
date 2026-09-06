import assert from 'node:assert/strict';
import { selectDynamicCoreV1, DYNAMIC_CORE_SELECTOR_V1 } from '../src/investment/decision/dynamicCoreSelector';
import { applyCoreArchitectureV1, type PortfolioEvaluationInput } from '../src/investment/decision/portfolioCoreGatePolicy';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';

const vanguard = {
  assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', isin: 'IE00B03HD191',
  name: 'Vanguard Global Stock Index Fund EUR Acc', category: 'GLOBAL_EQUITY', currency: 'EUR',
  instrumentType: 'MUTUAL_FUND'
} as const;
const eunl = {
  assetId: 'EUNL', ticker: 'EUNL.DE', isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR'
} as const;

function candidate(asset: typeof vanguard | typeof eunl, score: number, healthy = true) {
  return {
    asset,
    status: 'ACCEPTED' as const,
    bars: 300,
    asOfDate: '2026-01-01',
    lastClose: 100,
    momentum20Pct: healthy ? 5 : -12,
    momentum60Pct: healthy ? 8 : -15,
    momentum120Pct: healthy ? 12 : -20,
    annualizedVolatilityPct: 15,
    maxDrawdownPct: healthy ? 10 : 35,
    score
  };
}

function causalBars(healthy: boolean) {
  return Array.from({ length: 300 }, (_, i) => {
    const close = healthy ? 70 + i * 0.10 : 130 - i * 0.10;
    return {
      timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      open: close,
      high: close * 1.001,
      low: close * 0.999,
      close
    };
  });
}

function input(rows: Array<ReturnType<typeof candidate>>): PortfolioEvaluationInput {
  const acceptedAssets = rows.map(row => ({
    assetId: row.asset.assetId,
    ticker: row.asset.ticker,
    name: row.asset.name,
    bars: causalBars((row.momentum120Pct ?? 0) >= 0)
  }));
  return {
    portfolio: { cashEur: 0, holdings: [], funds: [], updatedAt: '2026-01-01T00:00:00Z' },
    scan: {
      scanned: rows.length, accepted: rows.length, rejected: 0, rejectionCounts: {}, selected: [], candidates: rows,
      dataset: { timeframe: '1d', assets: acceptedAssets }, acceptedDataset: { timeframe: '1d', assets: acceptedAssets }
    },
    decision: {
      generatedAt: '2026-01-01T00:00:00Z', asOfDate: '2026-01-01', dataAgeDays: 0, currency: 'EUR', capitalEur: 10_000,
      riskProfile: 'MEDIUM', horizonYears: 3, marketRegime: 'BULL_LOW_VOL', regimeTrendPct: 10, regimeVolatilityPct: 15,
      confidence: 'HIGH', confidenceScore: 90, recommendedMethod: 'RISK_PARITY_ERC', cashWeight: 0.05, cashAmountEur: 500,
      assets: [], portfolioDatasetFingerprint: 'TEST', evidence: 'REAL_ONLY', warnings: [], summary: 'test', methodology: []
    },
    fundMarketValues: {}, positionHealth: {}, cashBenchmarkAnnualPct: 2
  } as unknown as PortfolioEvaluationInput;
}

function result(existingCore?: 'EUNL' | 'FUND_VANGUARD_GLOBAL'): PortfolioDecisionResult {
  const existingPositions = existingCore ? [{
    id: existingCore,
    assetId: existingCore,
    label: existingCore === 'EUNL' ? eunl.name : vanguard.name,
    instrumentType: existingCore === 'EUNL' ? 'ETF_ETC' as const : 'MUTUAL_FUND' as const,
    category: 'GLOBAL_EQUITY' as const,
    currentValueEur: 8_000,
    action: 'HOLD' as const,
    reason: 'incumbent core'
  }] : [];
  return {
    currentInvestedValueEur: existingCore ? 8_000 : 0,
    currentCashEur: existingCore ? 2_000 : 10_000,
    pendingCapitalEur: 0,
    totalPlannedCapitalEur: 10_000,
    targetCashEur: existingCore ? 2_000 : 10_000,
    deployableToAssetsEur: 0,
    plannedRotationProceedsEur: 0,
    maxPortfolioPositions: 12,
    occupiedPortfolioPositions: existingPositions.length,
    availablePortfolioSlots: 12 - existingPositions.length,
    recommendedNewInvestmentEur: 0,
    residualPlannedCashEur: existingCore ? 2_000 : 10_000,
    exposures: [], existingPositions, contributions: [], warnings: []
  } as PortfolioDecisionResult;
}

// No incumbent: the best causal score wins. Vanguard being first in the old
// product-priority list must have zero effect on the result.
{
  const selection = selectDynamicCoreV1(
    input([candidate(vanguard, 10), candidate(eunl, 35)]),
    result()
  );
  assert.equal(selection.version, DYNAMIC_CORE_SELECTOR_V1);
  assert.equal(selection.selectedAssetId, 'EUNL');
  assert.equal(selection.reason, 'BEST_HEALTHY_CORE');
}

// Reverse the evidence and the chosen core reverses as well: no hard-coded asset.
{
  const selection = selectDynamicCoreV1(
    input([candidate(vanguard, 40), candidate(eunl, 10)]),
    result()
  );
  assert.equal(selection.selectedAssetId, 'FUND_VANGUARD_GLOBAL');
}

// Inertia: a healthy incumbent remains the core even if another product scores
// higher today. This prevents performance chasing and needless taxable turnover.
{
  const selection = selectDynamicCoreV1(
    input([candidate(vanguard, 80), candidate(eunl, 10)]),
    result('EUNL')
  );
  assert.equal(selection.selectedAssetId, 'EUNL');
  assert.equal(selection.reason, 'HEALTHY_INCUMBENT_INERTIA');
  assert.equal(selection.incumbentHealthy, true);
}

// Missing evidence is never treated as proof of deterioration. Even with a
// healthy alternative available, an incumbent whose own series is unavailable
// cannot be structurally transferred.
{
  const scenario = input([candidate(vanguard, 80), candidate(eunl, 10)]);
  scenario.scan.acceptedDataset.assets = scenario.scan.acceptedDataset.assets.filter(row => row.assetId !== 'EUNL');
  const selection = selectDynamicCoreV1(scenario, result('EUNL'));
  assert.equal(selection.selectedAssetId, null);
  assert.equal(selection.incumbentHealthy, null);
  assert.equal(selection.reason, 'INCUMBENT_EVIDENCE_INSUFFICIENT');
}

// A genuinely unhealthy incumbent is not protected forever: the best healthy
// broad-global alternative becomes the selected replacement.
{
  const selection = selectDynamicCoreV1(
    input([candidate(vanguard, 30, true), candidate(eunl, -20, false)]),
    result('EUNL')
  );
  assert.equal(selection.selectedAssetId, 'FUND_VANGUARD_GLOBAL');
  assert.equal(selection.reason, 'REPLACE_UNHEALTHY_INCUMBENT');
  assert.equal(selection.incumbentHealthy, false);
}

// No healthy alternative means no forced default allocation.
{
  const selection = selectDynamicCoreV1(
    input([candidate(vanguard, -10, false), candidate(eunl, -20, false)]),
    result()
  );
  assert.equal(selection.selected, null);
  assert.equal(selection.reason, 'NO_HEALTHY_CORE');
}

// Integration: structural transfer is explicit and atomic; it is not swallowed
// by the short-term core protection layer.
{
  const base = result('EUNL');
  const next = applyCoreArchitectureV1(
    input([candidate(vanguard, 30, true), candidate(eunl, -20, false)]),
    base
  );
  const incumbent = next.existingPositions.find(row => row.assetId === 'EUNL')!;
  const replacement = next.contributions.find(row => row.assetId === 'FUND_VANGUARD_GLOBAL')!;
  assert.equal(incumbent.action, 'EXIT');
  assert.equal(incumbent.rotationChallengerAssetId, 'FUND_VANGUARD_GLOBAL');
  assert.match(incumbent.reason, /DYNAMIC_CORE_SELECTOR_V1:STRUCTURAL_TRANSFER/);
  assert.ok(replacement);
  assert.equal(replacement.positionStage, 'ROTATION_ENTRY');
}

console.log('dynamicCoreSelectorV1.unit: PASS');
