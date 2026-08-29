import { PortfolioRotationReviewEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}
function bars(multiplier: number, count = 320) {
  const out: any[] = []; let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    out.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  return out;
}
const strongBars = bars(1.0024);
const target: any = {
  asset: { assetId: 'TARGET_FUND', ticker: 'TARGET123456', isin: 'TARGET123456', name: 'Target strong fund', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' },
  status: 'ACCEPTED', bars: strongBars.length, asOfDate: strongBars.at(-1).timestamp.slice(0,10), lastClose: strongBars.at(-1).close,
  momentum20Pct: 6.5, momentum60Pct: 13, momentum120Pct: 26, annualizedVolatilityPct: 15, maxDrawdownPct: 8, score: 21
};
const acceptedDataset: any = { timeframe: '1d', assets: [{ assetId: target.asset.assetId, ticker: target.asset.ticker, name: target.asset.name, currency: 'EUR', bars: strongBars, provenance: { sourceType: 'REAL', provider: 'unit', symbol: target.asset.ticker, isReproducible: true } }] };
const scan: any = { scanned: 1, accepted: 1, rejected: 0, rejectionCounts: {}, selected: [target], candidates: [target], acceptedDataset, dataset: acceptedDataset };
const sourceHealth: any = {
  key: 'source_fund', label: 'Existing weaker fund', tickerOrIsin: 'SOURCE123456', action: 'WATCH', reason: 'Inferior current opportunity set.', source: 'ARBITRARY_REAL_SERIES', currency: 'EUR', currentUnitPrice: 100, currentValueEur: 10000,
  consensusScore: 0, favorableVotes: 1, unfavorableVotes: 1, structuralDowntrend: false, excessVsCashPctPoints: 0, suggestedReductionPct: null
};
const health: any = { generatedAt: new Date().toISOString(), byKey: { source_fund: sourceHealth, SOURCE123456: sourceHealth }, positions: [sourceHealth], warnings: [] };

const withLiquidity: any = {
  cashEur: 0, holdings: [],
  funds: [{ id: 'source_fund', isin: 'SOURCE123456', name: 'Existing weaker fund', category: 'GLOBAL_EQUITY', investedEur: 9000, acquisitionDate: '2025-01-01', currentValueEur: 10000, units: 100, transferable: true, broker: 'MyInvestor' }],
  stagedCapitalPlan: { availableEur: 13000, horizonMonths: 12, preferredMode: 'MONTHLY' }, updatedAt: '2026-08-30T00:00:00Z'
};
const liquidityFirst = PortfolioRotationReviewEngine.evaluate({ portfolio: withLiquidity, scan, positionHealth: health, cashBenchmarkAnnualPct: 2.5, horizonYears: 3 });
check('941 material free liquidity is used before selling an existing position', liquidityFirst.status === 'USE_LIQUIDITY_FIRST');
check('942 liquidity-first review still identifies the stronger target', liquidityFirst.targetAssetId === 'TARGET_FUND');

const noLiquidity = { ...withLiquidity, stagedCapitalPlan: { ...withLiquidity.stagedCapitalPlan, availableEur: 0 } };
const deferredRotation = PortfolioRotationReviewEngine.evaluate({ portfolio: noLiquidity, scan, positionHealth: health, cashBenchmarkAnnualPct: 2.5, horizonYears: 3 });
check('943 transferable fund can become an after-tax rotation candidate once liquidity is exhausted', deferredRotation.status === 'ROTATE_NOW');
check('944 fund-to-fund candidate uses tax-deferred treatment', deferredRotation.assessment?.tax.method === 'TAX_DEFERRED_TRANSFER' && deferredRotation.assessment.immediateFrictionEur === 0);
check('945 rotation amount is finite and only a partial WATCH-position reduction', deferredRotation.amountEur === 5000);

const stockHealth: any = { ...sourceHealth, key: 'OLD.DE', label: 'Old stock', tickerOrIsin: 'OLD.DE', currentValueEur: 10000, excessVsCashPctPoints: -1 };
const stockPortfolio: any = { cashEur: 0, holdings: [{ ticker: 'OLD.DE', shares: 100 }], funds: [], stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' }, updatedAt: '2026-08-30T00:00:00Z' };
const stockHealthResult: any = { generatedAt: new Date().toISOString(), byKey: { 'OLD.DE': stockHealth }, positions: [stockHealth], warnings: [] };
const unknownBasis = PortfolioRotationReviewEngine.evaluate({ portfolio: stockPortfolio, scan, positionHealth: stockHealthResult, cashBenchmarkAnnualPct: 2.5, horizonYears: 3 });
check('946 stock rotation with unknown FIFO basis is not approved', unknownBasis.status === 'NEEDS_TAX_DATA');
check('947 missing acquisition basis is explicit rather than fabricated', unknownBasis.assessment?.tax.method === 'UNKNOWN_COST_BASIS');

console.log(`Portfolio rotation review: ${passed}/7 invariants passed.`);
