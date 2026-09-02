import assert from 'node:assert/strict';
import { applyQualitySizingOverlay, assessQualitySizing } from '../src/investment/decision/qualitySizingPolicy';

assert.equal(assessQualitySizing(90, 90).multiplier, 1, 'top quality keeps the existing cap but never amplifies it');
assert.equal(assessQualitySizing(75, 75).multiplier, 0.9, 'strong quality uses 90% of the pre-authorized size');
assert.equal(assessQualitySizing(65, 65).multiplier, 0.8, 'adequate quality uses 80% of the pre-authorized size');
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

const result: any = {
  currentInvestedValueEur: 0,
  currentCashEur: 3000,
  pendingCapitalEur: 0,
  totalPlannedCapitalEur: 10_000,
  targetCashEur: 0,
  deployableToAssetsEur: 3000,
  plannedRotationProceedsEur: 1000,
  maxPortfolioPositions: 12,
  occupiedPortfolioPositions: 0,
  availablePortfolioSlots: 12,
  recommendedNewInvestmentEur: 3000,
  residualPlannedCashEur: 0,
  exposures: [],
  existingPositions: [],
  contributions: [
    { category: 'TECHNOLOGY', assetId: 'HIGH', ticker: 'HIGH.DE', name: 'High', instrumentType: 'ETF_ETC', amountEur: 1000, targetCategoryGapEur: 1000, currentAssetValueEur: 0, positionStage: 'STARTER', reason: 'fixture' },
    { category: 'ENERGY', assetId: 'FRAGILE', ticker: 'FRAG.DE', name: 'Fragile', instrumentType: 'ETF_ETC', amountEur: 1000, targetCategoryGapEur: 1000, currentAssetValueEur: 0, positionStage: 'BUILD', reason: 'fixture' },
    { category: 'EUROPE_EQUITY', assetId: 'ROTATE', ticker: 'ROT.DE', name: 'Rotate', instrumentType: 'ETF_ETC', amountEur: 1000, targetCategoryGapEur: 1000, currentAssetValueEur: 0, positionStage: 'ROTATION_ENTRY', reason: 'fixture' }
  ],
  warnings: []
};

const sized = applyQualitySizingOverlay({ result, scan });
const high = sized.contributions.find((row: any) => row.assetId === 'HIGH');
const fragile = sized.contributions.find((row: any) => row.assetId === 'FRAGILE');
const rotate = sized.contributions.find((row: any) => row.assetId === 'ROTATE');

assert.equal(high.amountEur, 1000, 'high quality can use the full old cap but not more');
assert.equal(fragile.amountEur, 650, 'fragile STARTER/BUILD amount is reduced to 65%');
assert.equal(rotate.amountEur, 1000, 'rotation entry is deliberately untouched');
assert.equal(sized.recommendedNewInvestmentEur, 2650, 'recommended total is reconciled after sizing');
assert.equal(sized.residualPlannedCashEur, 350, 'released sizing capital remains cash and never becomes debt');
assert.ok(sized.contributions.every((row: any) => row.amountEur <= 1000), 'quality sizing never amplifies a pre-authorized amount');
assert.match(fragile.reason, /QUALITY_SIZING_V1/);
assert.ok(sized.warnings.some((warning: string) => warning.includes('QUALITY_SIZING_V1')));

console.log('QUALITY_SIZING_POLICY_RESULT', JSON.stringify({
  valid: true,
  highAmountEur: high.amountEur,
  fragileAmountEur: fragile.amountEur,
  rotationAmountEur: rotate.amountEur,
  recommendedNewInvestmentEur: sized.recommendedNewInvestmentEur,
  residualPlannedCashEur: sized.residualPlannedCashEur
}));
