import { CurrentOpportunityAlertEngine, PortfolioDecisionEngine } from '../src/investment/decision';

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
function candidate(assetId: string, ticker: string, category: string, series: any[], m120: number, vol: number, score: number): any {
  return {
    asset: { assetId, ticker, name: ticker, category, currency: 'EUR' }, status: 'ACCEPTED', bars: series.length,
    asOfDate: series.at(-1).timestamp.slice(0,10), lastClose: series.at(-1).close,
    momentum20Pct: m120 / 4, momentum60Pct: m120 / 2, momentum120Pct: m120,
    annualizedVolatilityPct: vol, maxDrawdownPct: 8, score
  };
}
const techBars = bars(1.0024);
const europeBars = bars(1.0021);
const weakBars = bars(1.00005);
const candidates: any[] = [
  candidate('STRONG_TECH', 'STRONGT.DE', 'TECHNOLOGY', techBars, 26, 15, 21),
  candidate('STRONG_EU', 'STRONGE.DE', 'EUROPE_EQUITY', europeBars, 21, 14, 18),
  candidate('WEAK_BOND', 'WEAKB.DE', 'GOV_BONDS', weakBars, 0.5, 7, 10)
];
const acceptedDataset: any = { timeframe: '1d', assets: candidates.map((c, i) => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, currency: 'EUR', bars: [techBars, europeBars, weakBars][i], provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true } })) };
const scan: any = { scanned: 3, accepted: 3, rejected: 0, rejectionCounts: {}, selected: candidates, candidates, acceptedDataset, dataset: acceptedDataset };
const portfolio: any = { cashEur: 0, holdings: [], funds: [], stagedCapitalPlan: { availableEur: 10000, horizonMonths: 12, preferredMode: 'MONTHLY' }, updatedAt: '2026-08-30T00:00:00Z' };
const decision: any = {
  cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3,
  assets: [{ assetId: 'WEAK_BOND', ticker: 'WEAKB.DE', name: 'Weak theoretical bond', weight: 0.90 }]
};

const alerts = CurrentOpportunityAlertEngine.evaluate(scan, 2.5);
const result = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, cashBenchmarkAnnualPct: 2.5 });
const totalContribution = result.contributions.reduce((sum, row) => sum + row.amountEur, 0);

check('931 current strong opportunities exist for the production allocation test', alerts.some(a => a.assetId === 'STRONG_TECH') && alerts.some(a => a.assetId === 'STRONG_EU'));
check('932 finite capital is allocated to current opportunities', result.contributions.some(row => row.assetId === 'STRONG_TECH') && result.contributions.some(row => row.assetId === 'STRONG_EU'));
check('933 weak theoretical preferred asset is not funded when current opportunities exist', !result.contributions.some(row => row.assetId === 'WEAK_BOND'));
check('934 total proposed capital never exceeds deployable finite capital', totalContribution <= result.deployableToAssetsEur + 1e-9 && result.deployableToAssetsEur <= 10000 + 1e-9);
check('935 medium-risk high-conviction single-name amount respects concentration cap', result.contributions.every(row => row.amountEur <= result.deployableToAssetsEur * 0.50 + 1e-9));
check('936 operational contributions explicitly carry current opportunity semantics', result.contributions.every(row => row.opportunityLevel != null && row.priorityScore != null));
check('937 residual cash reconciles exactly with finite available capital', Math.abs(result.residualPlannedCashEur - (10000 - totalContribution)) < 1e-6);

console.log(`Current finite-capital allocation: ${passed}/7 invariants passed.`);
