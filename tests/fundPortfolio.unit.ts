import { assessFundTaxReview, EXAMPLE_FUND_POSITIONS, EXAMPLE_STAGED_CAPITAL_PLAN, monthlyStagedAmount, valueFundFromNav } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) { if (!condition) throw new Error(`FAIL ${name}`); passed++; console.log(`✓ ${name}`); }

check('401 two editable example funds exist', EXAMPLE_FUND_POSITIONS.length === 2);
check('402 global fund preserves ISIN', EXAMPLE_FUND_POSITIONS[0].isin === 'IE00B03HD191');
check('403 global fund preserves invested amount and date', EXAMPLE_FUND_POSITIONS[0].investedEur === 12600 && EXAMPLE_FUND_POSITIONS[0].acquisitionDate === '2026-08-11');
check('404 emerging fund preserves ISIN', EXAMPLE_FUND_POSITIONS[1].isin === 'IE0031786696');
check('405 emerging fund preserves invested amount and date', EXAMPLE_FUND_POSITIONS[1].investedEur === 1400 && EXAMPLE_FUND_POSITIONS[1].acquisitionDate === '2026-08-12');
check('406 both example funds are marked transferable', EXAMPLE_FUND_POSITIONS.every(f => f.transferable));
const gain = assessFundTaxReview({ ...EXAMPLE_FUND_POSITIONS[0], currentValueEur: 13000 });
check('407 unrealized gain is explicit', gain.unrealizedGainEur === 400);
check('408 eligible transfer is preferred over taxable redemption as exit route', gain.preferredExitRoute === 'TRANSFER_IF_ELIGIBLE' && gain.transferDefersTax);
check('409 staged capital preserves 13000 EUR over 12 months', EXAMPLE_STAGED_CAPITAL_PLAN.availableEur === 13000 && EXAMPLE_STAGED_CAPITAL_PLAN.horizonMonths === 12);
check('410 uniform monthly reference is 1083.33 EUR approximately', Math.abs(monthlyStagedAmount(EXAMPLE_STAGED_CAPITAL_PLAN) - 1083.3333333333) < 1e-6);

const navPoints = [
  { date: '2026-08-10', nav: 60 },
  { date: '2026-08-11', nav: 60 },
  { date: '2026-08-28', nav: 63 }
];
const estimated = valueFundFromNav({ ...EXAMPLE_FUND_POSITIONS[0], investedEur: 1200, units: null }, navPoints, 63);
check('411 position can be estimated from invested amount and entry NAV', estimated.precision === 'ESTIMATED_FROM_ENTRY_NAV' && Math.abs((estimated.currentValueEur ?? 0) - 1260) < 1e-9);
check('412 estimated return is calculated from real NAV movement', Math.abs((estimated.gainPct ?? 0) - 5) < 1e-9);
const exact = valueFundFromNav({ ...EXAMPLE_FUND_POSITIONS[0], investedEur: 1200, units: 20.5 }, navPoints, 63);
check('413 explicit fund units produce exact market valuation', exact.precision === 'EXACT_WITH_UNITS' && Math.abs((exact.currentValueEur ?? 0) - 1291.5) < 1e-9);
check('414 missing NAV history never fabricates a position value', valueFundFromNav(EXAMPLE_FUND_POSITIONS[0], [], null).precision === 'UNAVAILABLE');

console.log(`Fund portfolio/tax/NAV: ${passed}/14 invariants passed.`);
