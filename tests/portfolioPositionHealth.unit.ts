import { classifyPositionHealth, isDiversifiedCoreCategory } from '../src/investment/decision';

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
  momentum20Pct: 0,
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

const weakSatellite: any = {
  ...base,
  existingPositionAction: 'HOLD',
  newMoneyAction: 'AVOID',
  unfavorableVotes: 2,
  favorableVotes: 0,
  neutralVotes: 3,
  consensusScore: -2,
  momentum20Pct: -4
};
const tacticalReduce = classifyPositionHealth(weakSatellite, -10, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 12,
  momentum20Pct: -4
});
check('811 persistent satellite giveback can REDUCE before structural EXIT', tacticalReduce.action === 'REDUCE');
check('812 satellite giveback REDUCE remains partial at fifty percent', tacticalReduce.suggestedReductionPct === 50);

const coreProtected = classifyPositionHealth(weakSatellite, -10, {
  category: 'US_EQUITY',
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 12,
  momentum20Pct: -4
});
check('813 diversified core never uses the MFE giveback REDUCE rule', coreProtected.action === 'WATCH');

const stagedWatch = classifyPositionHealth({ ...weakSatellite, newMoneyAction: 'WATCH' }, 2, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -4,
  mfePct: 3,
  givebackFromMfePctPoints: 7,
  deteriorationStreakSessions: 3,
  momentum20Pct: -2
});
check('814 three weak sessions with material loss enter WATCH without selling', stagedWatch.action === 'WATCH' && stagedWatch.suggestedReductionPct == null);

const shortWeakness = classifyPositionHealth({ ...weakSatellite, newMoneyAction: 'WATCH' }, 2, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -6,
  mfePct: 4,
  givebackFromMfePctPoints: 10,
  deteriorationStreakSessions: 2,
  momentum20Pct: -3
});
check('815 weakness shorter than three sessions does not enter the persistent WATCH state', shortWeakness.action === 'HOLD');

const recoveringSatellite = classifyPositionHealth(weakSatellite, -10, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 12,
  momentum20Pct: 2
});
check('816 positive short momentum blocks giveback REDUCE while recovery is underway', recoveringSatellite.action === 'WATCH');
check('817 broad US equity is classified as diversified core while technology is tactical', isDiversifiedCoreCategory('US_EQUITY') && !isDiversifiedCoreCategory('TECHNOLOGY'));

console.log(`Portfolio position health: ${passed}/17 invariants passed.`);
