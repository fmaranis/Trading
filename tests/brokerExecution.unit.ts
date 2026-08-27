import assert from 'node:assert/strict';
import { buildWholeShareExecutionPlan, MYINVESTOR_BROKER_PROFILE } from '../src/investment/decision';

const allocations = [
  { assetId: 'EUN6', ticker: 'EUN6.DE', amountEur: 40, weight: 0.40 },
  { assetId: 'XEON', ticker: 'XEON.DE', amountEur: 39.9, weight: 0.399 },
  { assetId: 'ISPA', ticker: 'ISPA.DE', amountEur: 0.91, weight: 0.0091 }
];
const prices = { EUN6: 98.688, XEON: 149.995, ISPA: 40.255 };

const plan = buildWholeShareExecutionPlan(100, allocations, prices, MYINVESTOR_BROKER_PROFILE);
assert.equal(plan.broker.supportsFractionalShares, false);
assert.ok(plan.orders.every(o => Number.isInteger(o.shares)));
assert.ok(plan.residualCashEur >= -1e-9);
assert.ok(plan.investedEur + plan.estimatedFeesEur <= 100 + 1e-9);
assert.ok(plan.executable);
assert.ok(plan.orders.some(o => o.executable && o.shares >= 1));
const executable = plan.orders.filter(o => o.executable);
for (const order of executable) {
  assert.ok(order.commissionEur >= 1 - 1e-9);
  assert.ok(order.totalCostEur <= 100 + 1e-9);
}

const cheap = buildWholeShareExecutionPlan(100, [
  { assetId: 'ISPA', ticker: 'ISPA.DE', amountEur: 95, weight: 0.95 }
], { ISPA: 40.255 }, MYINVESTOR_BROKER_PROFILE);
assert.equal(cheap.orders.find(o => o.executable)?.shares, 2);
assert.ok(cheap.estimatedFeesEur >= 1);

console.log('Broker Execution: 8/8 whole-share/fee invariants passed.');
