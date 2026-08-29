import { classifyPositionHealth } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

const base: any = {
  existingPositionAction: 'HOLD',
  newMoneyAction: 'WATCH',
  structuralDowntrend: false,
  unfavorableVotes: 1,
  favorableVotes: 1,
  neutralVotes: 3,
  consensusScore: 0,
  explanation: 'Neutral'
};

const exit = classifyPositionHealth({ ...base, structuralDowntrend: true, unfavorableVotes: 4, favorableVotes: 0, consensusScore: -4, existingPositionAction: 'REDUCE_REVIEW', newMoneyAction: 'AVOID' }, -20);
check('801 strong structural deterioration becomes EXIT', exit.action === 'EXIT');
check('802 EXIT requests a complete reduction', exit.suggestedReductionPct === 100);

const reduce = classifyPositionHealth({ ...base, structuralDowntrend: true, unfavorableVotes: 3, favorableVotes: 0, consensusScore: -2, existingPositionAction: 'REDUCE_REVIEW', newMoneyAction: 'AVOID' }, -12);
check('803 multi-signal deterioration below EXIT threshold becomes REDUCE', reduce.action === 'REDUCE');
check('804 REDUCE defaults to a partial 50 percent review', reduce.suggestedReductionPct === 50);

const add = classifyPositionHealth({ ...base, existingPositionAction: 'ADD', newMoneyAction: 'BUY', favorableVotes: 4, unfavorableVotes: 0, consensusScore: 4 }, 8);
check('805 favorable existing position that beats cash can ADD', add.action === 'ADD');

const watchAvoid = classifyPositionHealth({ ...base, existingPositionAction: 'HOLD', newMoneyAction: 'AVOID', unfavorableVotes: 2, consensusScore: -2 }, 1);
check('806 AVOID without structural sell threshold becomes WATCH, not sell', watchAvoid.action === 'WATCH');

const watchCash = classifyPositionHealth({ ...base, existingPositionAction: 'HOLD', newMoneyAction: 'WATCH', consensusScore: 0 }, -0.5);
check('807 cash underperformance alone becomes WATCH', watchCash.action === 'WATCH');
check('808 cash underperformance alone never becomes REDUCE or EXIT', watchCash.action !== 'REDUCE' && watchCash.action !== 'EXIT');

const hold = classifyPositionHealth({ ...base, existingPositionAction: 'HOLD', newMoneyAction: 'WATCH', consensusScore: 1 }, 4);
check('809 neutral healthy position stays HOLD', hold.action === 'HOLD');

const missing = classifyPositionHealth(null, null);
check('810 insufficient causal evidence stays DATA_MISSING', missing.action === 'DATA_MISSING');

console.log(`Portfolio position health: ${passed}/10 invariants passed.`);
