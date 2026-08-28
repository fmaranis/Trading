import assert from 'node:assert/strict';
import { executionPolicyForCapital } from '../src/investment/decision/adaptiveExecutionPolicy';

const p100 = executionPolicyForCapital(100);
const p334 = executionPolicyForCapital(334);
const p1000 = executionPolicyForCapital(1000);
const p5000 = executionPolicyForCapital(5000);
const p25000 = executionPolicyForCapital(25000);

assert.equal(p100.capitalBand, 'MICRO');
assert.equal(p334.capitalBand, 'SMALL');
assert.equal(p1000.capitalBand, 'MEDIUM');
assert.equal(p5000.capitalBand, 'LARGE');
assert.equal(p25000.capitalBand, 'INSTITUTIONAL');
assert.ok(p100.minimumDriftPctPoints > p25000.minimumDriftPctPoints);
assert.ok(p100.minimumOrderNotionalEur >= 100);
assert.ok(p25000.maximumRebalanceFeeDragPct <= p334.maximumRebalanceFeeDragPct);

console.log('Adaptive Execution Policy: 8/8 capital-band/cost-control invariants passed.');
