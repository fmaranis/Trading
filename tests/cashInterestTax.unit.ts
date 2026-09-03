import assert from 'node:assert/strict';
import { estimateSpanishTaxOnCashInterest } from '../src/investment/decision/spanishTaxModel';
import { accrueRemuneratedCashScenarioAfterTax } from '../src/investment/decision/remuneratedCash';

const unconfirmed = estimateSpanishTaxOnCashInterest(100, { priorSavingsTaxableBaseEur: 0, contextConfirmed: false });
assert.equal(unconfirmed.method, 'STATUTORY_WITHHOLDING_19');
assert.ok(Math.abs(unconfirmed.estimatedTaxEur - 19) < 1e-9);

const configuredFirstBracket = estimateSpanishTaxOnCashInterest(100, { priorSavingsTaxableBaseEur: 0, contextConfirmed: true });
assert.equal(configuredFirstBracket.method, 'CONFIGURED_PROGRESSIVE');
assert.ok(Math.abs(configuredFirstBracket.estimatedTaxEur - 19) < 1e-9);

const configuredSecondBracket = estimateSpanishTaxOnCashInterest(100, { priorSavingsTaxableBaseEur: 6_000, contextConfirmed: true });
assert.ok(Math.abs(configuredSecondBracket.estimatedTaxEur - 21) < 1e-9);

const afterTax = accrueRemuneratedCashScenarioAfterTax({
  cashEur: 10_000,
  mode: 'FIXED_USER_RATE',
  fixedAnnualPct: 2.5,
  fromDate: '2025-01-01',
  toDate: '2026-01-01',
  taxOnInterest: gross => gross * 0.19
});
assert.ok(afterTax.grossInterestEur > 249 && afterTax.grossInterestEur < 251);
assert.ok(afterTax.taxEur > 47 && afterTax.taxEur < 48);
assert.ok(afterTax.cashEur > 10_201 && afterTax.cashEur < 10_203);

console.log('cashInterestTax.unit PASS');
