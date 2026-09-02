import assert from 'node:assert/strict';
import { applyQualitySizingOverlay, assessQualitySizing } from '../src/investment/decision/qualitySizingPolicy';

assert.equal(assessQualitySizing(90, 90).multiplier, 1, 'top quality keeps the existing cap but never amplifies it');
assert.equal(assessQualitySizing(75, 75).multiplier, 0.9, 'strong quality uses 90% of the pre-authorized cap');
assert.equal(assessQualitySizing(65, 65).multiplier, 0.8, 'adequate quality uses 80% of the pre-authorized cap');
assert.equal(assessQualitySizing(50, 50).multiplier, 0.65, 'fragile quality is materially downsized');
assert.equal(assessQualitySizing(null, 80).tier, 'QUALITY_UNAVAILABLE', 'missing evidence is explicit rather than silently fabricated');
assert.equal(assessQualitySizing(null, 80).multiplier, 1, 'missing evidence preserves legacy size explicitly');

function bars(count = 260) {
  let price = 100;
  return Array.from({ length: count }, (_, i) => {
    price *= 1.0008;
    return { timestamp: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(), open: price, high: price, low: price, close: price, volume: 1000 };
  });
}

const series = bars();
const scan: any = {
  scanned: 3,
  accepted: 3,
  rejected: 0,
  selected: [],
  candidates: [
    {
      asset: { assetId: 'HIGH', ticker: 'HIGH.DE', name: 'High', category: 'TECHNOLOGY', currency: 'EUR' },
      status: 'ACCEPTED', bars: series.length, asOfDate: '2024-12-31', lastClose: 50,
      momentum20Pct: 8, momentum60Pct: 14, momentum120Pct: 25, annualizedVolatilityPct: 12, maxDrawdownPct: 7,
      score: 20, reliabilityScore: 90, opportunityScore: 90
    },
    {
      asset: { assetId: 'FRAGILE', ticker: 'FRAG.DE', name: 'Fragile', category: 'ENERGY', currency: 'EUR' },
      status: 'ACCEPTED', bars: series.length, asOfDate: '2024-12-31', lastClose: 50,
      momentum20Pct: 3, momentum60Pct: 5, momentum120Pct: 8, annualizedVolatilityPct: 25, maxDrawdownPct: 20,
      score: 5, reliabilityScore: 50, opportunityScore: 50
    },
    {
      asset: { assetId: 'ROTATE', ticker: 'ROT.DE', name: 'Rotate', category: 'EUROPE_EQUITY', currency: 'EUR' },
      status: 'ACCEPTED', bars: series.length, asOfDate: '2024-12-31', lastClose: 50,
      momentum20Pct: 3, momentum60Pct: 5, momentum120Pct: 8, annualizedVolatilityPct: 25, maxDrawdownPct: 20,
      score: 5, reliabilityScore: 50, opportunityScore: 50
    }
  ],
  acceptedDataset: {
    timeframe: '1d',
    assets: ['HIGH', 'FRAGILE', 'ROTATE'].map(assetId => ({ assetId, ticker: `${assetId}.DE`, name: assetId, currency: 'EUR', bars: series, provenance: { sourceType: 'REAL', provider: 'unit', isReproducible: true } }))
  },
  dataset: { timeframe: '1d', assets: [] },
  rejectionCounts: {}
};

function fixture(fragileCurrentValueEur = 0): any {
  return {
    currentInvestedValueEur: fragileCurrentValueEur,
    currentCashEur: 3000,
    pendingCapitalEur: 0,
    totalPlannedCapitalEur: 10_000,
    targetCashEur: 0,
    deployableToAssetsEur: 3000,
    plannedRotationProceedsEur: 1000,
    maxPortfolioPositions: 12,
    occupiedPortfolioPositions: fragileCurrentValueEur > 0 ? 1 : 0,
    availablePortfolioSlots: fragileCurrentValueEur > 0 ? 11 : 12,
    recommendedNewInvestmentEur: 3000,
    residualPlannedCashEur: 0,
    exposures: [],
    existingPositions: [],
    contributions: [
      { category: 'TECHNOLOGY', assetId: 'HIGH', ticker: 'HIGH.DE', name: 'High', instrumentType: 'ETF_ETC', amountEur: 500, targetCategoryGapEur: 1000, currentAssetValueEur: 0, positionStage: 'STARTER', portfolioShareCapPct: 5, reason: 'fixture' },
      { category: 'ENERGY', assetId: 'FRAGILE', ticker: 'FRAG.DE', name: 'Fragile', instrumentType: 'ETF_ETC', amountEur: Math.max(0, 800 - fragileCurrentValueEur), targetCategoryGapEur: 1000, currentAssetValueEur: fragileCurrentValueEur, positionStage: 'BUILD', portfolioShareCapPct: 8, reason: 'fixture' },
      { category: 'EUROPE_EQUITY', assetId: 'ROTATE', ticker: 'ROT.DE', name: 'Rotate', instrumentType: 'ETF_ETC', amountEur: 1000, targetCategoryGapEur: 1000, currentAssetValueEur: 0, positionStage: 'ROTATION_ENTRY', portfolioShareCapPct: 5, reason: 'fixture' }
    ],
    warnings: []
  };
}

const sized = applyQualitySizingOverlay({ result: fixture(), scan });
const high = sized.contributions.find((row: any) => row.assetId === 'HIGH');
const fragile = sized.contributions.find((row: any) => row.assetId === 'FRAGILE');
const rotate = sized.contributions.find((row: any) => row.assetId === 'ROTATE');

assert.equal(high.amountEur, 500, 'high quality can use the full old starter cap but not more');
assert.equal(high.portfolioShareCapPct, 5, 'full-cap quality preserves the original stage cap');
assert.equal(fragile.amountEur, 520, 'fragile BUILD target is a persistent 65% of the original 8% cap: 10k × 8% × 65%');
assert.equal(fragile.portfolioShareCapPct, 5.2, 'reported cap is the persistent quality-adjusted stage cap');
assert.equal(rotate.amountEur, 1000, 'rotation entry is deliberately untouched');
assert.equal(sized.recommendedNewInvestmentEur, 2020, 'recommended total is reconciled after persistent-cap sizing');
assert.equal(sized.residualPlannedCashEur, 980, 'released sizing capital remains cash and never becomes debt');
assert.ok(sized.contributions.every((row: any) => row.amountEur <= 1000), 'quality sizing never amplifies a pre-authorized amount');
assert.match(fragile.reason, /cap persistente/i);
assert.ok(sized.warnings.some((warning: string) => warning.includes('QUALITY_SIZING_V1')));

const repeated = applyQualitySizingOverlay({ result: fixture(520), scan });
assert.equal(repeated.contributions.some((row: any) => row.assetId === 'FRAGILE'), false, 'a position already at its quality-adjusted cap is not topped up toward the larger legacy cap on the next evaluation');
assert.ok(repeated.residualPlannedCashEur >= 280, 'the unneeded legacy remainder stays in cash instead of being retried');

console.log('QUALITY_SIZING_POLICY_RESULT', JSON.stringify({
  valid: true,
  highAmountEur: high.amountEur,
  fragileAmountEur: fragile.amountEur,
  fragilePersistentCapPct: fragile.portfolioShareCapPct,
  rotationAmountEur: rotate.amountEur,
  repeatedFragileOrder: repeated.contributions.some((row: any) => row.assetId === 'FRAGILE'),
  recommendedNewInvestmentEur: sized.recommendedNewInvestmentEur,
  residualPlannedCashEur: sized.residualPlannedCashEur
}));
