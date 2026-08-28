import { assessFundTaxReview, EXAMPLE_FUND_POSITIONS, EXAMPLE_STAGED_CAPITAL_PLAN, monthlyStagedAmount } from '../src/investment/decision';

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
console.log(`Fund portfolio/tax: ${passed}/10 invariants passed.`);
