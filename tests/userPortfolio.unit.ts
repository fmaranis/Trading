import { analyzePortfolioRebalance, MYINVESTOR_BROKER_PROFILE, UserPortfolioService } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const targets = [
  { assetId: 'A', ticker: 'AAA.DE', weight: 0.40 },
  { assetId: 'B', ticker: 'BBB.DE', weight: 0.40 }
];
const prices = { 'AAA.DE': 100, 'BBB.DE': 50 };

const balanced = analyzePortfolioRebalance(
  { cashEur: 200, holdings: [{ ticker: 'AAA.DE', shares: 4 }, { ticker: 'BBB.DE', shares: 8 }], updatedAt: '2026-08-28T00:00:00Z' },
  targets, prices, 0.20, MYINVESTOR_BROKER_PROFILE
);
check('301 portfolio total value is calculated from cash and holdings', Math.abs(balanced.totalPortfolioValueEur - 1000) < 1e-9);
check('302 already aligned portfolio does not recommend rebalance', balanced.rebalanceRecommended === false);
check('303 balanced portfolio produces no executable orders', balanced.executableOrders === 0);

const drifted = analyzePortfolioRebalance(
  { cashEur: 600, holdings: [{ ticker: 'AAA.DE', shares: 4 }], updatedAt: '2026-08-28T00:00:00Z' },
  targets, prices, 0.20, MYINVESTOR_BROKER_PROFILE
);
check('304 material drift recommends rebalance', drifted.rebalanceRecommended === true);
check('305 underweight target creates whole-share buy', drifted.lines.some(x => x.ticker === 'BBB.DE' && x.action === 'BUY' && Number.isInteger(x.proposedShares) && x.proposedShares > 0));
check('306 projected cash never goes negative', drifted.projectedCashEur >= 0);
check('307 fees are estimated for executable orders', drifted.estimatedFeesEur > 0);

const overweight = analyzePortfolioRebalance(
  { cashEur: 0, holdings: [{ ticker: 'AAA.DE', shares: 9 }, { ticker: 'BBB.DE', shares: 2 }], updatedAt: '2026-08-28T00:00:00Z' },
  targets, prices, 0.20, MYINVESTOR_BROKER_PROFILE
);
check('308 over-weight position can create sell review', overweight.lines.some(x => x.ticker === 'AAA.DE' && x.action === 'SELL'));

const missing = analyzePortfolioRebalance(
  { cashEur: 100, holdings: [{ ticker: 'UNKNOWN.DE', shares: 2 }], updatedAt: '2026-08-28T00:00:00Z' },
  targets, prices, 0.20, MYINVESTOR_BROKER_PROFILE
);
check('309 missing market price is explicit', missing.lines.some(x => x.ticker === 'UNKNOWN.DE' && x.action === 'DATA_MISSING'));
check('310 unknown holding adds warning instead of fabricated price', missing.warnings.includes('PRICE_MISSING:UNKNOWN.DE'));

const unified = UserPortfolioService.load();
check('311 default real portfolio contains the two example mutual funds', (unified.funds ?? []).length === 2);
check('312 global fund is inside real portfolio state', unified.funds?.some(f => f.isin === 'IE00B03HD191' && f.investedEur === 12600 && f.acquisitionDate === '2026-08-11') === true);
check('313 emerging fund is inside real portfolio state', unified.funds?.some(f => f.isin === 'IE0031786696' && f.investedEur === 1400 && f.acquisitionDate === '2026-08-12') === true);
check('314 staged capital is inside the same real portfolio state', unified.stagedCapitalPlan?.availableEur === 13000 && unified.stagedCapitalPlan?.horizonMonths === 12);
check('315 unified portfolio keeps ETF holdings and mutual funds as different product fields in one state', Array.isArray(unified.holdings) && Array.isArray(unified.funds));

console.log(`User portfolio rebalance/unified state: ${passed}/15 invariants passed.`);
