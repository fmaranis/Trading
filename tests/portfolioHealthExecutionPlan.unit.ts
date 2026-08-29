import { buildPortfolioExecutionPlan } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

const scan: any = {
  candidates: [
    { asset: { assetId: 'KNOWN', ticker: 'KNOWN.DE', name: 'Known', category: 'TECHNOLOGY', currency: 'EUR', instrumentType: 'ETF_ETC' }, status: 'ACCEPTED', lastClose: 50, momentum120Pct: -10 }
  ]
};

const portfolio: any = {
  cashEur: 250,
  holdings: [
    { ticker: 'KNOWN.DE', shares: 5 },
    { ticker: 'ARBITRARY.DE', shares: 5 }
  ],
  funds: [],
  stagedCapitalPlan: { availableEur: 250, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-29T00:00:00Z'
};

const baseDecision: any = {
  currentInvestedValueEur: 500,
  currentCashEur: 250,
  pendingCapitalEur: 250,
  totalPlannedCapitalEur: 1000,
  targetCashEur: 250,
  deployableToAssetsEur: 250,
  recommendedNewInvestmentEur: 0,
  residualPlannedCashEur: 500,
  exposures: [],
  contributions: [],
  warnings: []
};

const exitDecision: any = {
  ...baseDecision,
  existingPositions: [
    { id: 'KNOWN.DE', label: 'Known', instrumentType: 'ETF_ETC', category: 'TECHNOLOGY', currentValueEur: 250, action: 'EXIT', reason: 'Strong structural deterioration.', suggestedReductionPct: 100 }
  ]
};
const exitPlan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-29', portfolioDecision: exitDecision, cashBenchmarkAnnualPct: 2.5 });
const exitLine = exitPlan.lines.find(x => x.action === 'SELL_ETF');
check('821 EXIT health action becomes executable ETF sale', !!exitLine);
check('822 EXIT sells every share in the existing position', exitLine?.shares === 5 && exitLine?.amountEur === 250);

const reduceDecision: any = {
  ...baseDecision,
  existingPositions: [
    { id: 'KNOWN.DE', label: 'Known', instrumentType: 'ETF_ETC', category: 'TECHNOLOGY', currentValueEur: 250, action: 'REDUCE', reason: 'Confirmed multi-signal deterioration.', suggestedReductionPct: 40 }
  ]
};
const reducePlan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-29', portfolioDecision: reduceDecision, cashBenchmarkAnnualPct: 2.5 });
const reduceLine = reducePlan.lines.find(x => x.action === 'SELL_ETF');
check('823 REDUCE health action becomes partial ETF sale', !!reduceLine);
check('824 40 percent reduction of five shares at 50 EUR sells two whole shares', reduceLine?.shares === 2 && reduceLine?.amountEur === 100);

const arbitraryDecision: any = {
  ...baseDecision,
  existingPositions: [
    { id: 'ARBITRARY.DE', label: 'Arbitrary', instrumentType: 'ETF_ETC', category: 'UNKNOWN', currentValueEur: 250, action: 'EXIT', reason: 'Arbitrary position independently deteriorated.', suggestedReductionPct: 100, healthSource: 'ARBITRARY_REAL_SERIES' }
  ]
};
const arbitraryPlan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-29', portfolioDecision: arbitraryDecision, cashBenchmarkAnnualPct: 2.5 });
const arbitraryExit = arbitraryPlan.lines.find(x => x.action === 'SELL_ETF' && x.targetTicker === 'ARBITRARY.DE');
check('825 arbitrary holding outside catalog can still produce an EXIT instruction', !!arbitraryExit);
check('826 arbitrary EXIT derives a usable unit price from REAL monitored position value', arbitraryExit?.estimatedPriceEur === 50 && arbitraryExit?.shares === 5);

const watchDecision: any = {
  ...baseDecision,
  existingPositions: [
    { id: 'KNOWN.DE', label: 'Known', instrumentType: 'ETF_ETC', category: 'TECHNOLOGY', currentValueEur: 250, action: 'WATCH', reason: 'Weak versus cash only.', suggestedReductionPct: null }
  ]
};
const watchPlan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-29', portfolioDecision: watchDecision, cashBenchmarkAnnualPct: 2.5 });
check('827 WATCH never becomes a sell instruction', !watchPlan.lines.some(x => x.action === 'SELL_ETF'));

console.log(`Health-driven execution plan: ${passed}/7 invariants passed.`);
