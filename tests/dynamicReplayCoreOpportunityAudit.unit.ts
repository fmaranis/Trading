import assert from 'node:assert/strict';
import {
  assessReplayCoreOpportunityReadOnly,
  DynamicHistoricalReplayEngine
} from '../src/investment/decision/dynamicHistoricalReplayCore';
import type { AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import type { PortfolioCandidateGateResult } from '../src/investment/decision/portfolioCandidateGate';
import type { PortfolioDecisionResult } from '../src/investment/decision/portfolioDecisionEngine';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

// These are deterministic unit fixtures, never evidence of REAL market performance.
const asOf = '2023-05-30';
const coreAsset = { assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', name: 'Global Core', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND' } as const;
const satelliteAsset = { assetId: 'EQ_TEST', ticker: 'TEST.DE', name: 'Test Satellite', category: 'EUROPE_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' } as const;
const anotherCore = { assetId: 'VWCE', ticker: 'VWCE.DE', name: 'Other Core', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' } as const;
const candidate = (asset: typeof coreAsset | typeof satelliteAsset | typeof anotherCore, date: string, momentum120Pct: number) => ({
  asset, status: 'ACCEPTED' as const, bars: 321, asOfDate: date, lastClose: 110, momentum20Pct: 2,
  momentum60Pct: 5, momentum120Pct, annualizedVolatilityPct: 17, maxDrawdownPct: 12, score: 10
});
const makeInput = (override: Record<string, unknown> = {}) => ({
  decisionDate: asOf,
  referenceCoreAssetId: 'FUND_VANGUARD_GLOBAL',
  scan: { candidates: [candidate(coreAsset, asOf, 9), candidate(satelliteAsset, asOf, 15)] } as AssetUniverseScanResult,
  gate: { entries: [
    { assetId: 'FUND_VANGUARD_GLOBAL', status: 'ELIGIBLE' },
    { assetId: 'EQ_TEST', status: 'ELIGIBLE' }
  ] } as PortfolioCandidateGateResult,
  portfolioDecision: {
    deployableToAssetsEur: 700, plannedRotationProceedsEur: 500,
    contributions: [{ assetId: 'EQ_TEST', amountEur: 300, positionStage: 'ROTATION_ENTRY' }]
  } as Pick<PortfolioDecisionResult, 'deployableToAssetsEur' | 'plannedRotationProceedsEur' | 'contributions'>,
  equityBeforeDecisionEur: 12000, cashBeforeDecisionEur: 200, heldReferenceCoreValueEur: 9000,
  ...override
});
{
  const input = makeInput();
  const before = JSON.stringify(input);
  const audit = assessReplayCoreOpportunityReadOnly(input);
  assert.equal(audit.status, 'AVAILABLE');
  assert.equal(audit.referenceCoreMomentum120Pct, 9);
  assert.equal(audit.comparableNonCoreCount, 1);
  assert.equal(audit.candidates[0].excessMomentum120VsReferenceCorePctPoints, 6);
  assert.equal(audit.cashBeforeDecisionEur, 200);
  assert.equal(audit.baseDeployableEur, 200);
  assert.equal(audit.plannedRotationProceedsEur, 500);
  assert.equal(audit.proposedNonCoreRotationCount, 1);
  assert.equal(audit.proposedOrderReach, 'PROPOSED_NOT_EXECUTED');
  assert.equal(JSON.stringify(input), before, 'read-only audit must not mutate gate, cash, scan, portfolio or policy');
}
{
  const missing = assessReplayCoreOpportunityReadOnly(makeInput({
    referenceCoreAssetId: 'VWCE'
  }));
  assert.equal(missing.status, 'UNAVAILABLE', 'a recognised but missing core never falls back to a synthetic benchmark');
  assert.equal(missing.reason, 'REFERENCE_CORE_REAL_CAUSAL_SERIES_MISSING');
  assert.deepEqual(missing.candidates, []);
}
{
  const futureCore = assessReplayCoreOpportunityReadOnly(makeInput({
    scan: { candidates: [candidate(coreAsset, '2023-05-31', 90), candidate(satelliteAsset, asOf, 15)] } as AssetUniverseScanResult
  }));
  assert.equal(futureCore.status, 'UNAVAILABLE', 'future core data must not leak into decision-date audit');
}
{
  const staleNav = assessReplayCoreOpportunityReadOnly(makeInput({
    scan: { candidates: [candidate(coreAsset, '2023-05-29', 9), candidate(satelliteAsset, asOf, 15)] } as AssetUniverseScanResult
  }));
  assert.equal(staleNav.status, 'AVAILABLE');
  assert.equal(staleNav.comparableNonCoreCount, 0, 'different NAV/as-of dates cannot be compared silently');
  assert.equal(staleNav.reason, 'NO_COMPARABLE_ELIGIBLE_NON_CORE');
}
{
  const futureSatellite = assessReplayCoreOpportunityReadOnly(makeInput({
    scan: { candidates: [candidate(coreAsset, asOf, 9), candidate(satelliteAsset, '2023-05-31', 100)] } as AssetUniverseScanResult
  }));
  assert.equal(futureSatellite.comparableNonCoreCount, 0, 'future satellite returns must be excluded');
}
{
  const noCapital = assessReplayCoreOpportunityReadOnly(makeInput({
    portfolioDecision: {
      deployableToAssetsEur: 0, plannedRotationProceedsEur: 0, contributions: []
    } as Pick<PortfolioDecisionResult, 'deployableToAssetsEur' | 'plannedRotationProceedsEur' | 'contributions'>
  }));
  assert.equal(noCapital.proposedNonCoreOrderCount, 0);
  assert.equal(noCapital.proposedOrderReach, 'ZERO', 'eligible signal without executable proposed order is zero economic reach');
  assert.equal(noCapital.comparableNonCoreCount, 1, 'signal quality and policy reach remain separate');
}

// Integration parity: the opt-in trace must not alter existing decisions or wealth.
function dateAt(index: number): string { return new Date(Date.UTC(2021, 0, 1 + index)).toISOString(); }
const bars = (drift: number) => {
  let price = 80;
  return Array.from({ length: 530 }, (_, i) => {
    price *= 1 + drift + Math.sin(i / 17) * 0.00005;
    return { timestamp: dateAt(i), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 900 };
  });
};
const catalog: AssetUniverseItem[] = [coreAsset, satelliteAsset];
const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: [
    { assetId: coreAsset.assetId, ticker: coreAsset.ticker, name: coreAsset.name, currency: 'EUR',
      bars: bars(0.0003), provenance: { sourceType: 'SYNTHETIC', provider: 'unit-test', symbol: coreAsset.ticker, isReproducible: true } },
    { assetId: satelliteAsset.assetId, ticker: satelliteAsset.ticker, name: satelliteAsset.name, currency: 'EUR',
      bars: bars(0.0006), provenance: { sourceType: 'SYNTHETIC', provider: 'unit-test', symbol: satelliteAsset.ticker, isReproducible: true } }
  ]
};
const baseInput = {
  dataset, catalog, startDate: dateAt(350).slice(0, 10),
  frequency: 'MONTHLY' as const, initialCapitalEur: 13000,
  riskProfile: 'MEDIUM' as const, horizonYears: 3 as const,
  cashBenchmarkAnnualPct: 1.5, minimumBars: 252
};
const base = DynamicHistoricalReplayEngine.run(baseInput);
const traced = DynamicHistoricalReplayEngine.run({
  ...baseInput,
  researchCoreOpportunityReferenceAssetId: coreAsset.assetId
});
const { researchCoreOpportunityAudit, ...tracedFinancialResult } = traced;
assert.equal(base.researchCoreOpportunityAudit, undefined, 'production/default does not emit or compute extra audit');
assert.ok(researchCoreOpportunityAudit && researchCoreOpportunityAudit.length === traced.decisions);
assert.ok(researchCoreOpportunityAudit.every(row => row.referenceCoreAsOfDate == null || row.referenceCoreAsOfDate <= row.decisionDate));
assert.deepEqual(tracedFinancialResult, base, 'read-only research trace cannot mutate any signal, order, tax, cash, path or final wealth');
const missingCoreReplay = DynamicHistoricalReplayEngine.run({
  ...baseInput, researchCoreOpportunityReferenceAssetId: anotherCore.assetId
});
assert.equal(missingCoreReplay.researchCoreOpportunityAudit?.length, missingCoreReplay.decisions);
assert.ok(missingCoreReplay.researchCoreOpportunityAudit?.every(row => row.status === 'UNAVAILABLE'));
assert.throws(() => DynamicHistoricalReplayEngine.run({
  ...baseInput,
  researchCoreOpportunityReferenceAssetId: coreAsset.assetId,
  simulationMode: 'HOLD_ONLY'
}), /REPLAY_CORE_OPPORTUNITY_AUDIT_REQUIRES_CUSTODIA_ENGINE/);
console.log('✓ core opportunity research-only: causal/missing/NAV/zero-reach guards and canonical replay economic parity');
