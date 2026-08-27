import assert from 'node:assert/strict';
import { assessBrokerExecutionQuality, buildWholeShareExecutionPlan, estimateMinimumDiversifiedCapital, MYINVESTOR_BROKER_PROFILE } from '../src/investment/decision';

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

const quality100 = assessBrokerExecutionQuality(plan, { minimumPositions: 2, maximumSinglePositionPct: 70, maximumFeeDragPct: 2 });
assert.equal(quality100.diversifiedEnough, false);
assert.equal(quality100.executablePositions, 1);
assert.ok(quality100.reasons.some(r => r.startsWith('INSUFFICIENT_DIVERSIFICATION')));

const minimum = estimateMinimumDiversifiedCapital(allocations, prices, MYINVESTOR_BROKER_PROFILE, {
  minimumPositions: 2,
  maximumSinglePositionPct: 70,
  maximumFeeDragPct: 2,
  startCapitalEur: 100,
  maxCapitalEur: 1000,
  stepEur: 1
});
assert.equal(minimum.found, true);
assert.ok((minimum.minimumCapitalEur ?? 0) > 100);
assert.ok(minimum.quality?.diversifiedEnough);
assert.ok((minimum.plan?.orders.filter(o => o.executable).length ?? 0) >= 2);

const cheap = buildWholeShareExecutionPlan(100, [
  { assetId: 'ISPA', ticker: 'ISPA.DE', amountEur: 95, weight: 0.95 }
], { ISPA: 40.255 }, MYINVESTOR_BROKER_PROFILE);
assert.equal(cheap.orders.find(o => o.executable)?.shares, 2);
assert.ok(cheap.estimatedFeesEur >= 1);

console.log('Broker Execution: 14/14 whole-share/fee/diversification invariants passed.');
