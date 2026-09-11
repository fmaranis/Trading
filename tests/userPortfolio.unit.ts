import {
  analyzePortfolioRebalance,
  classifyPositionHealth,
  isDiversifiedCoreCategory,
  migrateUserPortfolioState,
  MYINVESTOR_BROKER_PROFILE,
  UserPortfolioService
} from '../src/investment/decision';
import { registerLiveDiscoveredAsset } from '../src/investment/decision/dynamicPortfolioDiscovery';

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

const fresh = UserPortfolioService.load();
check('311 a fresh account has no embedded mutual-fund positions', (fresh.funds ?? []).length === 0);
check('312 a fresh account has no embedded listed holdings', fresh.holdings.length === 0);
check('313 a fresh account has zero pending capital', (fresh.stagedCapitalPlan?.availableEur ?? 0) === 0);
check('314 portfolio product fields remain unified', Array.isArray(fresh.holdings) && Array.isArray(fresh.funds));

const migratedFromAccidentalEmpty = migrateUserPortfolioState({
  cashEur: 0,
  holdings: [],
  funds: [],
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  exampleInitialized: true,
  updatedAt: '2026-08-29T00:00:00Z'
});
check('315 pre-v2 empty state stays empty instead of inserting a person-specific portfolio', (migratedFromAccidentalEmpty.funds ?? []).length === 0);
check('316 pre-v2 empty state keeps zero pending capital', migratedFromAccidentalEmpty.stagedCapitalPlan?.availableEur === 0);
check('317 migration marks state as v2', migratedFromAccidentalEmpty.portfolioDataVersion === 2);

const intentionalEmptyAfterMigration = migrateUserPortfolioState({
  cashEur: 0,
  holdings: [],
  funds: [],
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  portfolioDataVersion: 2,
  updatedAt: '2026-08-29T00:00:00Z'
});
check('318 v2 empty state is respected after an intentional exit', (intentionalEmptyAfterMigration.funds ?? []).length === 0 && intentionalEmptyAfterMigration.stagedCapitalPlan?.availableEur === 0);

const genericLegacyFund = {
  id: 'legacy_test', isin: 'TEST00000001', name: 'Legacy Test Fund', category: 'OTHER', investedEur: 2500,
  acquisitionDate: '2026-01-10', units: 25, transferable: true, broker: 'TestBroker'
};
const migratedLegacy = migrateUserPortfolioState(
  { cashEur: 100, holdings: [], updatedAt: '2026-08-29T00:00:00Z' },
  [genericLegacyFund],
  { availableEur: 3000, horizonMonths: 6, preferredMode: 'MONTHLY' }
);
check('319 legacy user-owned fund data is preserved during migration', migratedLegacy.funds?.length === 1 && migratedLegacy.funds[0].id === 'legacy_test' && migratedLegacy.funds[0].investedEur === 2500);
check('320 legacy user-owned pending capital is preserved during migration', migratedLegacy.stagedCapitalPlan?.availableEur === 3000 && migratedLegacy.stagedCapitalPlan?.horizonMonths === 6);

const dynamicEquity = registerLiveDiscoveredAsset({
  symbol: 'HFG.DE',
  name: 'HelloFresh SE',
  quoteType: 'EQUITY',
  exchange: 'GER',
  currency: 'EUR',
  usableInEurEngine: true,
  historyBars3y: 756,
  source: 'YAHOO_LIVE_DISCOVERY'
});
const weakDynamicEquity: any = {
  assetId: dynamicEquity.assetId,
  ticker: dynamicEquity.ticker,
  name: dynamicEquity.name,
  existingPositionAction: 'HOLD',
  newMoneyAction: 'AVOID',
  structuralDowntrend: false,
  unfavorableVotes: 2,
  favorableVotes: 0,
  neutralVotes: 3,
  consensusScore: -2,
  momentum20Pct: -4,
  explanation: 'Weak dynamic equity'
};
const dynamicEquityContext: any = {
  category: 'EUROPE_EQUITY',
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const dynamicEquityHealth = classifyPositionHealth(weakDynamicEquity, -10, dynamicEquityContext);
check('321 dynamic Yahoo equity is satellite even when its broad category is EUROPE_EQUITY', dynamicEquityHealth.action === 'REDUCE' && dynamicEquityContext.isDiversifiedCore === false);
check('322 dynamic Yahoo equity identity works through assetId and ticker', !isDiversifiedCoreCategory('EUROPE_EQUITY', dynamicEquity.assetId) && !isDiversifiedCoreCategory('EUROPE_EQUITY', dynamicEquity.ticker));

const dynamicEtf = registerLiveDiscoveredAsset({
  symbol: 'TESTETF.DE',
  name: 'Test Broad Europe ETF',
  quoteType: 'ETF',
  exchange: 'GER',
  currency: 'EUR',
  usableInEurEngine: true,
  historyBars3y: 756,
  source: 'YAHOO_LIVE_DISCOVERY'
});
check('323 dynamic ETF retains diversified-core treatment instead of being mistaken for a stock', isDiversifiedCoreCategory('GLOBAL_EQUITY', dynamicEtf.assetId));

const currentLiveEquityContext: any = {
  category: 'EUROPE_EQUITY',
  isListedEquity: true,
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const currentLiveEquityHealth = classifyPositionHealth({ ...weakDynamicEquity, assetId: 'OPEN_HFG_DE', ticker: 'HFG.DE' }, -10, currentLiveEquityContext);
check('324 current-live OPEN equity is also satellite when discovery identifies it as listed equity', currentLiveEquityHealth.action === 'REDUCE' && currentLiveEquityContext.isDiversifiedCore === false);

console.log(`User portfolio rebalance/private-state migration: ${passed}/24 invariants passed.`);
