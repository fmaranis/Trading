import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const worker = source('src/workers/historicalReplayAudit.worker.ts');
const auditControls = source('src/components/HistoricalAuditJsonControls.tsx');
const replayPublic = source('src/investment/decision/dynamicHistoricalReplay.ts');

assert.match(replayPublic, /structuralCoreBenchmarkFinalEur/);
assert.match(replayPublic, /structuralCoreBenchmarkStartDate/);
assert.match(replayPublic, /structuralCoreBenchmarkEndDate/);
assert.match(replayPublic, /excessReturnVsStructuralCorePctPoints/);
assert.match(replayPublic, /beatsStructuralCoreBenchmark/);
assert.match(replayPublic, /MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);
assert.match(replayPublic, /startLagDays > MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);
assert.match(replayPublic, /endLagDays > MAX_CORE_BENCHMARK_EDGE_LAG_DAYS/);

assert.match(worker, /structuralCoreBenchmark/);
assert.match(worker, /auditExtensions/);
assert.match(worker, /STRUCTURAL_CORE_BENCHMARK/);
assert.match(worker, /const REPLAY_ROTATION_EXPERIMENT = 'CORE_ARCHITECTURE_V1'/);
assert.match(worker, /FORWARD_RISK_FORECAST_V1/);
assert.match(worker, /replayPolicy/);

assert.match(auditControls, /extractStructuralCoreBenchmark/);
assert.match(auditControls, /summary:\s*\{/);
assert.match(auditControls, /structuralCoreBenchmark/);
assert.match(auditControls, /Motor vs 100% core global/);
assert.match(auditControls, /MOTOR > CORE/);
assert.match(auditControls, /CORE ≥ MOTOR/);
assert.match(auditControls, /new Set\(\[3, 4\]\)/);


import { buildMatchedCoreBuyHoldAudit } from '../src/investment/decision/dynamicHistoricalReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

const catalog: AssetUniverseItem[] = [
  { assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'FUND', name: 'fixture fund', currency: 'EUR', category: 'GLOBAL_EQUITY', instrumentType: 'MUTUAL_FUND' },
  { assetId: 'EUNL', ticker: 'ETF', name: 'fixture ETF', currency: 'EUR', category: 'GLOBAL_EQUITY', instrumentType: 'ETF_ETC' },
  { assetId: 'VWCE', ticker: 'ABSENT', name: 'fixture absent', currency: 'EUR', category: 'GLOBAL_EQUITY' },
  { assetId: 'NON_CORE', ticker: 'OTHER', name: 'fixture non-core', currency: 'EUR', category: 'GLOBAL_EQUITY' }
];
const fixtureBars = [
  { timestamp: '2021-01-04', open: 90, close: 100, high: 100, low: 90 },
  { timestamp: '2021-01-05', open: 100, close: 110, high: 110, low: 100 },
  { timestamp: '2021-01-06', open: 110, close: 121, high: 121, low: 110 },
  { timestamp: '2021-01-07', open: 121, close: 999, high: 999, low: 121 }
];
// Artificial fixtures exercise source contracts, not investment performance.
const dataset: MultiAssetDataset = { timeframe: '1d', assets: catalog.filter(x => x.assetId !== 'VWCE').map(x => ({
  assetId: x.assetId, ticker: x.ticker, name: x.name, currency: 'EUR',
  bars: fixtureBars.map(b => ({ ...b })), provenance: { sourceType: 'REAL', isReproducible: true }
})) };
const input = { dataset, catalog, initialCapitalEur: 1000 };
const window = { firstDecisionDate: '2021-01-04', endDate: '2021-01-06', referenceAssetId: 'FUND_VANGUARD_GLOBAL', initialPortfolioSpecified: false, hasExternalFlows: false };
const audit = buildMatchedCoreBuyHoldAudit(input, window)!;
assert.equal(audit.entryDate, '2021-01-05');
assert.equal(audit.rows.length, 3, 'unrelated global-category instruments cannot act as structural cores');
const fund = audit.rows.find(x => x.assetId === 'FUND_VANGUARD_GLOBAL')!;
const etf = audit.rows.find(x => x.assetId === 'EUNL')!;
assert.equal(fund.entryPriceEur, 110, 'fund uses the next available NAV');
assert.equal(etf.entryPriceEur, 100, 'ETF uses next session opening price');
assert.ok(Math.abs(fund.grossReturnPct! - 10) < 1e-8);
assert.ok(Math.abs(etf.excessVsReferencePctPoints! - 11) < 1e-8);
assert.equal(audit.rows.find(x => x.assetId === 'VWCE')!.grossReturnPct, null);
assert.equal(buildMatchedCoreBuyHoldAudit(input, { ...window, hasExternalFlows: true }), null);
assert.equal(buildMatchedCoreBuyHoldAudit(input, { ...window, initialPortfolioSpecified: true }), null);
const withEtf = (patch: Partial<MultiAssetDataset['assets'][number]>) => ({
  ...input, dataset: { ...dataset, assets: dataset.assets.map(a => a.assetId === 'EUNL' ? { ...a, ...patch } : a) }
});
for (const patch of [
  { provenance: { sourceType: 'SYNTHETIC' as const, isReproducible: true } },
  { provenance: { sourceType: 'STATIC_REFERENCE' as const, isReproducible: true } },
  { currency: 'USD' },
  { bars: fixtureBars.filter(b => b.timestamp !== '2021-01-05') },
  { bars: [...fixtureBars.slice(0, 2), fixtureBars[1], ...fixtureBars.slice(2)] },
  { ticker: 'UNRELATED' }
]) {
  assert.equal(buildMatchedCoreBuyHoldAudit(withEtf(patch), window)!.rows.find(x => x.assetId === 'EUNL')!.grossReturnPct, null);
}
assert.equal(buildMatchedCoreBuyHoldAudit(input, { ...window, endDate: '2021-01-08' }), null);
assert.match(worker, /matchedCoreBuyHoldAudit/);
assert.match(auditControls, /matchedCoreBuyHoldAudit/);
assert.match(source('src/components/HistoricalReplayProgressivePanel.tsx'), /matchedCoreBuyHoldAudit/);

console.log('coreBenchmarkAudit.unit: PASS');