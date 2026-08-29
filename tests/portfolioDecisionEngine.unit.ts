import { PortfolioDecisionEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

const scan: any = {
  scanned: 4,
  accepted: 4,
  rejected: 0,
  rejectionCounts: {},
  selected: [],
  dataset: { timeframe: '1d', assets: [] },
  acceptedDataset: { timeframe: '1d', assets: [] },
  candidates: [
    { asset: { assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', isin: 'IE00B03HD191', name: 'Global fund', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' }, status: 'ACCEPTED', lastClose: 64 },
    { asset: { assetId: 'FUND_VANGUARD_EMERGING', ticker: 'IE0031786696', isin: 'IE0031786696', name: 'Emerging fund', category: 'EMERGING_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' }, status: 'ACCEPTED', lastClose: 310 },
    { asset: { assetId: 'EUNL', ticker: 'EUNL.DE', name: 'World ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' }, status: 'ACCEPTED', lastClose: 125 },
    { asset: { assetId: 'EUN6', ticker: 'EUN6.DE', name: 'Bond ETF', category: 'GOV_BONDS', currency: 'EUR', defensive: true }, status: 'ACCEPTED', lastClose: 100 }
  ]
};

const decision: any = {
  cashWeight: 0.10,
  assets: [
    { assetId: 'FUND_VANGUARD_GLOBAL', ticker: 'IE00B03HD191', name: 'Global fund', weight: 0.45 },
    { assetId: 'FUND_VANGUARD_EMERGING', ticker: 'IE0031786696', name: 'Emerging fund', weight: 0.15 },
    { assetId: 'EUN6', ticker: 'EUN6.DE', name: 'Bond ETF', weight: 0.30 }
  ]
};

const portfolio: any = {
  cashEur: 0,
  holdings: [],
  funds: [
    { id: 'global', isin: 'IE00B03HD191', name: 'Global fund', category: 'GLOBAL_EQUITY', investedEur: 12600, acquisitionDate: '2026-08-11', units: 196.59, currentValueEur: null, transferable: true },
    { id: 'emerging', isin: 'IE0031786696', name: 'Emerging fund', category: 'EMERGING_EQUITY', investedEur: 1400, acquisitionDate: '2026-08-12', units: 4.61, currentValueEur: null, transferable: true }
  ],
  stagedCapitalPlan: { availableEur: 13000, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-28T00:00:00Z'
};

const result = PortfolioDecisionEngine.evaluate({
  portfolio,
  scan,
  decision,
  fundMarketValues: { global: 12581.76, emerging: 1429.10 }
});

check('501 existing mutual funds count as current invested exposure', Math.abs(result.currentInvestedValueEur - 14010.86) < 1e-6);
check('502 pending 13000 EUR is not counted as already invested', result.pendingCapitalEur === 13000 && result.currentInvestedValueEur < result.totalPlannedCapitalEur);
check('503 total planned capital combines current invested plus deployable capital', Math.abs(result.totalPlannedCapitalEur - 27010.86) < 1e-6);
check('504 global fund exposure is aggregated into GLOBAL_EQUITY before new allocation', Math.abs((result.exposures.find(x => x.category === 'GLOBAL_EQUITY')?.currentValueEur ?? 0) - 12581.76) < 1e-6);
check('505 emerging fund exposure is aggregated into EMERGING_EQUITY', Math.abs((result.exposures.find(x => x.category === 'EMERGING_EQUITY')?.currentValueEur ?? 0) - 1429.10) < 1e-6);
check('506 new contributions do not allocate from zero and therefore avoid duplicating existing global exposure', (result.contributions.find(x => x.category === 'GLOBAL_EQUITY')?.amountEur ?? 0) < 13000 * 0.45);
check('507 underweight government bonds receive new capital', (result.contributions.find(x => x.category === 'GOV_BONDS')?.amountEur ?? 0) > 0);
check('508 target cash is reserved before new investment', Math.abs(result.targetCashEur - result.totalPlannedCapitalEur * 0.10) < 1e-6 && result.recommendedNewInvestmentEur <= result.deployableToAssetsEur + 1e-9);
check('509 allocation drift alone never emits REDUCE/EXIT for a real fund', result.existingPositions.every(x => x.instrumentType !== 'MUTUAL_FUND' || (x.action !== 'REDUCE' && x.action !== 'EXIT')));
check('510 position actions distinguish existing holdings from contribution recommendations', result.existingPositions.length === 2 && result.contributions.length > 0);
check('511 contribution recommendations identify instrument type', result.contributions.every(x => x.instrumentType === 'MUTUAL_FUND' || x.instrumentType === 'ETF_ETC'));
check('512 no contribution exceeds its category deficit', result.contributions.every(x => x.amountEur <= x.targetCategoryGapEur + 1e-9));

const missing = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, fundMarketValues: {} });
check('513 missing fund valuation stays explicit instead of using cost basis as market value', missing.existingPositions.filter(x => x.instrumentType === 'MUTUAL_FUND').every(x => x.action === 'DATA_MISSING'));
check('514 missing fund market values are excluded from precise invested exposure', missing.currentInvestedValueEur === 0);
check('515 missing existing valuations block new contribution recommendations', missing.recommendedNewInvestmentEur === 0 && missing.contributions.length === 0 && missing.warnings.some(x => x.includes('bloquea temporalmente')));

const withEtf: any = {
  ...portfolio,
  funds: [],
  holdings: [{ ticker: 'EUNL.DE', shares: 100 }],
  stagedCapitalPlan: { availableEur: 1000, horizonMonths: 12, preferredMode: 'MONTHLY' }
};
const etfResult = PortfolioDecisionEngine.evaluate({ portfolio: withEtf, scan, decision, fundMarketValues: {} });
check('516 listed holdings and mutual funds share the same category reconciliation layer', Math.abs((etfResult.exposures.find(x => x.category === 'GLOBAL_EQUITY')?.currentValueEur ?? 0) - 12500) < 1e-6);

const unknownPortfolio: any = {
  cashEur: 200,
  holdings: [{ ticker: 'ARBITRARY.DE', shares: 10 }],
  funds: [],
  stagedCapitalPlan: { availableEur: 1000, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-29T00:00:00Z'
};
const arbitraryWatch: any = {
  key: 'ARBITRARY.DE', label: 'Arbitrary', tickerOrIsin: 'ARBITRARY.DE', action: 'WATCH', reason: 'Weak versus cash but not structurally broken.', source: 'ARBITRARY_REAL_SERIES', currency: 'EUR', currentUnitPrice: 50, currentValueEur: 500, consensusScore: -1, favorableVotes: 1, unfavorableVotes: 2, structuralDowntrend: false, excessVsCashPctPoints: -1, suggestedReductionPct: null
};
const unknownWatched = PortfolioDecisionEngine.evaluate({ portfolio: unknownPortfolio, scan, decision, positionHealth: { 'ARBITRARY.DE': arbitraryWatch } });
check('517 arbitrary EUR holding monitored outside catalog counts toward invested capital', Math.abs(unknownWatched.currentInvestedValueEur - 500) < 1e-9);
check('518 arbitrary valued holding is WATCH rather than DATA_MISSING/automatic HOLD', unknownWatched.existingPositions[0]?.action === 'WATCH');
check('519 arbitrary valued holding no longer blocks new-money allocation just because category is unknown', !unknownWatched.warnings.some(x => x.includes('bloquea temporalmente')));

const reduceHealth: any = { ...arbitraryWatch, key: 'EUNL.DE', tickerOrIsin: 'EUNL.DE', action: 'REDUCE', reason: 'Structural deterioration.', source: 'UNIVERSE_SCAN', currentUnitPrice: 125, currentValueEur: 12500, consensusScore: -3, unfavorableVotes: 3, structuralDowntrend: true, suggestedReductionPct: 50 };
const reduced = PortfolioDecisionEngine.evaluate({ portfolio: withEtf, scan, decision, positionHealth: { 'EUNL.DE': reduceHealth } });
check('520 independent health REDUCE overrides otherwise protective allocation-drift logic', reduced.existingPositions[0]?.action === 'REDUCE' && reduced.existingPositions[0]?.suggestedReductionPct === 50);

const exitHealth: any = { ...reduceHealth, action: 'EXIT', reason: 'Strong structural deterioration.', consensusScore: -4, unfavorableVotes: 4, suggestedReductionPct: 100 };
const exited = PortfolioDecisionEngine.evaluate({ portfolio: withEtf, scan, decision, positionHealth: { 'EUNL.DE': exitHealth } });
check('521 independent health EXIT overrides category allocation and requests full exit', exited.existingPositions[0]?.action === 'EXIT' && exited.existingPositions[0]?.suggestedReductionPct === 100);

const watchKnown: any = { ...reduceHealth, action: 'WATCH', reason: 'Under cash only.', structuralDowntrend: false, consensusScore: 0, unfavorableVotes: 1, suggestedReductionPct: null };
const watchedKnown = PortfolioDecisionEngine.evaluate({ portfolio: withEtf, scan, decision, positionHealth: { 'EUNL.DE': watchKnown } });
check('522 weak cash comparison alone remains WATCH and cannot become a sale', watchedKnown.existingPositions[0]?.action === 'WATCH');

console.log(`Portfolio-aware decision engine: ${passed}/22 invariants passed.`);