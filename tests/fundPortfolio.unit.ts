import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { assessFundTaxReview, EXAMPLE_FUND_POSITIONS, EXAMPLE_STAGED_CAPITAL_PLAN, monthlyStagedAmount, valueFundFromNav } from '../src/investment/decision';
import { VERIFIED_YAHOO_FUND_ALIASES } from '../src/investment/data/marketData/fundMarketData';

let passed = 0;
function check(name: string, condition: boolean) { if (!condition) throw new Error(`FAIL ${name}`); passed++; console.log(`✓ ${name}`); }

check('401 new-account source defaults contain no personal fund positions', EXAMPLE_FUND_POSITIONS.length === 0);
check('402 new-account staged capital is zero', EXAMPLE_STAGED_CAPITAL_PLAN.availableEur === 0 && EXAMPLE_STAGED_CAPITAL_PLAN.horizonMonths === 12);
check('403 zero staged capital produces zero monthly amount', monthlyStagedAmount(EXAMPLE_STAGED_CAPITAL_PLAN) === 0);

const sampleFund = {
  id: 'test_fund', isin: 'TEST00000001', name: 'Test Fund', category: 'OTHER' as const,
  investedEur: 1200, acquisitionDate: '2026-08-11', currentValueEur: 1300, units: 20,
  transferable: true, broker: 'TestBroker'
};
const gain = assessFundTaxReview(sampleFund);
check('404 unrealized gain is explicit', gain.unrealizedGainEur === 100);
check('405 eligible transfer is preferred over taxable redemption as exit route', gain.preferredExitRoute === 'TRANSFER_IF_ELIGIBLE' && gain.transferDefersTax);

const navPoints = [
  { date: '2026-08-10', nav: 60 },
  { date: '2026-08-11', nav: 60 },
  { date: '2026-08-28', nav: 63 }
];
const estimated = valueFundFromNav({ ...sampleFund, currentValueEur: null, investedEur: 1200, units: null }, navPoints, 63);
check('406 position can be estimated from invested amount and entry NAV', estimated.precision === 'ESTIMATED_FROM_ENTRY_NAV' && Math.abs((estimated.currentValueEur ?? 0) - 1260) < 1e-9);
check('407 estimated return is calculated from real NAV movement', Math.abs((estimated.gainPct ?? 0) - 5) < 1e-9);
const exact = valueFundFromNav({ ...sampleFund, currentValueEur: null, investedEur: 1200, units: 20.5 }, navPoints, 63);
check('408 explicit fund units produce exact market valuation', exact.precision === 'EXACT_WITH_UNITS' && Math.abs((exact.currentValueEur ?? 0) - 1291.5) < 1e-9);
check('409 missing NAV history never fabricates a position value', valueFundFromNav({ ...sampleFund, currentValueEur: null }, [], null).precision === 'UNAVAILABLE');

// Curated market-data aliases are instrument metadata, not a user's portfolio.
check('410 verified Yahoo alias registry keeps known fund mapping', VERIFIED_YAHOO_FUND_ALIASES.IE00B03HD191 === '0P00000WLG.F');
check('411 second verified fund alias remains available to the market-data resolver', VERIFIED_YAHOO_FUND_ALIASES.IE0031786696 === '0P00012I6A.F');
check('412 CINVEST A&A ISIN resolves to its verified Yahoo Finance alias', VERIFIED_YAHOO_FUND_ALIASES.ES0174115065 === '0P0001PBAK.F');

const fundMarketSource = readFileSync('src/investment/data/marketData/fundMarketData.ts', 'utf8');
const marketRoutesSource = readFileSync('server/marketDataRoutes.ts', 'utf8');
check('413 unknown ISINs use the automatic Yahoo resolver without another UI surface', fundMarketSource.includes('/api/market-data/resolve-symbol?'));
check('414 automatically discovered ISIN aliases are cached in browser storage', fundMarketSource.includes('custodia_yahoo_isin_alias_cache_v1'));
check('415 resolver uses Yahoo exact-ISIN search and validates candidate history', marketRoutesSource.includes('/v1/finance/search?q=') && marketRoutesSource.includes('yahooSymbolHasHistory'));
check('416 resolver rejects ambiguous matches instead of guessing', marketRoutesSource.includes('Equivalencia ambigua') && marketRoutesSource.includes('top.length !== 1'));
assert.doesNotMatch(fundMarketSource, /VERIFIED_YAHOO_FUND_ALIASES\[[^\]]+\]\s*=\s*/);
check('417 runtime discovery does not mutate the curated verified alias registry', true);

console.log(`Fund portfolio/tax/NAV privacy-safe: ${passed}/17 invariants passed.`);
