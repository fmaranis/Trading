import assert from 'node:assert/strict';
import { assessBrokerBacktestCostFeasibility, MYINVESTOR_BROKER_PROFILE } from '../src/investment/decision';

const diagnostic = assessBrokerBacktestCostFeasibility({
  initialCapitalEur: 100,
  totalTrades: 397,
  modeledCommissionEur: 0.70,
  modeledSlippageEur: 0.39
}, MYINVESTOR_BROKER_PROFILE, 2);

assert.equal(diagnostic.minimumCommissionLowerBoundEur, 397);
assert.equal(diagnostic.minimumTradingCostLowerBoundEur, 397.39);
assert.equal(diagnostic.minimumCommissionDragPct, 397);
assert.equal(diagnostic.brokerCommissionModelCompatible, false);
assert.ok(diagnostic.modeledCommissionUnderstatementEur > 396);
assert.ok((diagnostic.modeledCommissionUnderstatementFactor ?? 0) > 500);
assert.equal(diagnostic.minimumCapitalForCommissionDragTargetEur, 19850);
assert.ok(diagnostic.warnings.includes('PERCENTAGE_ONLY_COMMISSION_MODEL_UNDERESTIMATES_BROKER_MINIMUM_FEES'));
assert.ok(diagnostic.warnings.includes('BROKER_MINIMUM_COMMISSIONS_EXCEED_INITIAL_CAPITAL'));
assert.ok(diagnostic.warnings.some(w => w.startsWith('MINIMUM_COMMISSION_DRAG_ABOVE_TARGET')));

const compatible = assessBrokerBacktestCostFeasibility({
  initialCapitalEur: 1000,
  totalTrades: 2,
  modeledCommissionEur: 2,
  modeledSlippageEur: 0
}, MYINVESTOR_BROKER_PROFILE, 2);
assert.equal(compatible.brokerCommissionModelCompatible, true);
assert.equal(compatible.minimumCommissionDragPct, 0.2);
assert.equal(compatible.warnings.length, 0);

assert.throws(() => assessBrokerBacktestCostFeasibility({ initialCapitalEur: 0, totalTrades: 1, modeledCommissionEur: 1 }));
assert.throws(() => assessBrokerBacktestCostFeasibility({ initialCapitalEur: 100, totalTrades: 1.5, modeledCommissionEur: 1 }));

console.log('Broker Backtest Feasibility: 15/15 minimum-fee integrity invariants passed.');
