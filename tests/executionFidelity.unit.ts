import { assessExecutionFidelity, buildWholeShareExecutionPlan, MYINVESTOR_BROKER_PROFILE } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const allocations = [
  { assetId: 'A', ticker: 'AAA.DE', weight: 0.40, amountEur: 40 },
  { assetId: 'B', ticker: 'BBB.DE', weight: 0.35, amountEur: 35 },
  { assetId: 'C', ticker: 'CCC.DE', weight: 0.13, amountEur: 13 }
];
const prices = { A: 98.71, B: 149.99, C: 40.26 };

const smallPlan = buildWholeShareExecutionPlan(100, allocations, prices, MYINVESTOR_BROKER_PROFILE);
const small = assessExecutionFidelity(100, allocations, 0.12, smallPlan);
check('301 small capital fidelity is not high', small.level !== 'HIGH');
check('302 small capital cannot cover all targets', small.targetWeightCoveragePct < 100);
check('303 allocation distance is explicit', small.allocationDistancePct > 0);
check('304 fidelity score is bounded', small.score >= 0 && small.score <= 100);

const largeAllocations = allocations.map(a => ({ ...a, amountEur: 5000 * a.weight }));
const largePlan = buildWholeShareExecutionPlan(5000, largeAllocations, prices, MYINVESTOR_BROKER_PROFILE);
const large = assessExecutionFidelity(5000, largeAllocations, 0.12, largePlan);
check('305 larger capital improves target coverage', large.targetWeightCoveragePct >= small.targetWeightCoveragePct);
check('306 larger capital improves or preserves fidelity score', large.score >= small.score);
check('307 executed target count is deterministic', large.executableTargetCount === largePlan.orders.filter(o => o.executable).length);

const perfectPlan: any = {
  broker: MYINVESTOR_BROKER_PROFILE, capitalEur: 1000, executable: true, estimatedFeesEur: 0, investedEur: 880, residualCashEur: 120, notes: [],
  orders: [
    { assetId: 'A', ticker: 'AAA.DE', executable: true, grossNotionalEur: 400 },
    { assetId: 'B', ticker: 'BBB.DE', executable: true, grossNotionalEur: 350 },
    { assetId: 'C', ticker: 'CCC.DE', executable: true, grossNotionalEur: 130 }
  ]
};
const perfect = assessExecutionFidelity(1000, allocations, 0.12, perfectPlan);
check('308 exact allocation has zero distance', Math.abs(perfect.allocationDistancePct) < 1e-9);
check('309 exact allocation has full target coverage', Math.abs(perfect.targetWeightCoveragePct - 100) < 1e-9);
check('310 exact allocation has high fidelity', perfect.level === 'HIGH' && Math.abs(perfect.score - 100) < 1e-9);

console.log(`Execution fidelity: ${passed}/10 invariants passed.`);
