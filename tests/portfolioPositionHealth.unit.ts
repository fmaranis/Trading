import { classifyPositionHealth, isDiversifiedCoreCategory } from '../src/investment/decision';
import { registerLiveDiscoveredAsset } from '../src/investment/decision/dynamicPortfolioDiscovery';

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
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
});
check('811 satellite giveback REDUCE can fire on the tenth consecutive weak session', tacticalReduce.action === 'REDUCE');
check('812 satellite giveback REDUCE remains partial at fifty percent', tacticalReduce.suggestedReductionPct === 50);

const firstEligibleOnEleven = classifyPositionHealth(weakSatellite, -10, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -11,
  mfePct: 8,
  givebackFromMfePctPoints: 19,
  deteriorationStreakSessions: 11,
  momentum20Pct: -5
});
check('813 an asset that becomes fully eligible only after day ten may REDUCE on day eleven', firstEligibleOnEleven.action === 'REDUCE' && firstEligibleOnEleven.suggestedReductionPct === 50);

const rebasedAfterReduction = classifyPositionHealth(weakSatellite, -10, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -11,
  mfePct: 0,
  givebackFromMfePctPoints: 11,
  deteriorationStreakSessions: 11,
  momentum20Pct: -5
});
check('814 after an executed REDUCE rebases MFE, the same continuous weakness falls back to WATCH instead of selling again', rebasedAfterReduction.action === 'WATCH' && rebasedAfterReduction.suggestedReductionPct == null);

const coreProtected = classifyPositionHealth(weakSatellite, -10, {
  category: 'US_EQUITY',
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
});
check('815 diversified core never uses the MFE giveback REDUCE rule', coreProtected.action === 'WATCH');

const stagedWatch = classifyPositionHealth({ ...weakSatellite, newMoneyAction: 'WATCH' }, 2, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -4,
  mfePct: 3,
  givebackFromMfePctPoints: 7,
  deteriorationStreakSessions: 3,
  momentum20Pct: -2
});
check('816 three weak sessions with material loss enter WATCH without selling', stagedWatch.action === 'WATCH' && stagedWatch.suggestedReductionPct == null);

const shortWeakness = classifyPositionHealth({ ...weakSatellite, newMoneyAction: 'WATCH' }, 2, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -6,
  mfePct: 4,
  givebackFromMfePctPoints: 10,
  deteriorationStreakSessions: 2,
  momentum20Pct: -3
});
check('817 weakness shorter than three sessions does not enter the persistent WATCH state', shortWeakness.action === 'HOLD');

const recoveringSatellite = classifyPositionHealth(weakSatellite, -10, {
  category: 'TECHNOLOGY',
  isDiversifiedCore: false,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: 2
});
check('818 positive short momentum blocks giveback REDUCE while recovery is underway', recoveringSatellite.action === 'WATCH');
check('819 broad US equity is classified as diversified core while technology is tactical', isDiversifiedCoreCategory('US_EQUITY') && !isDiversifiedCoreCategory('TECHNOLOGY'));

const singleEquityContext: any = {
  category: 'EUROPE_EQUITY',
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const singleEquityReduce = classifyPositionHealth({ ...weakSatellite, assetId: 'EQ_FERROVIAL', ticker: 'FER.MC', name: 'Ferrovial' }, -10, singleEquityContext);
check('820 a single EQ_ stock cannot inherit broad EUROPE_EQUITY core protection from a stale context', singleEquityReduce.action === 'REDUCE' && singleEquityContext.isDiversifiedCore === false);

const broadEuropeContext: any = {
  category: 'EUROPE_EQUITY',
  isDiversifiedCore: false,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const broadEuropeProtected = classifyPositionHealth({ ...weakSatellite, assetId: 'EXSA', ticker: 'EXSA.DE', name: 'STOXX Europe 600' }, -10, broadEuropeContext);
check('821 a broad Europe ETF remains core even if the incoming context was incorrectly marked tactical', broadEuropeProtected.action === 'WATCH' && broadEuropeContext.isDiversifiedCore === true);

const dynamicEquity = registerLiveDiscoveredAsset({
  symbol: 'HFG.DE',
  name: 'HelloFresh SE',
  quoteType: 'EQUITY',
  exchange: 'GER',
  currency: 'EUR',
  usableInEurEngine: true,
  historyBars3y: 756,
  source: 'YAHOO_LIVE_DISCOVERY'
});
const dynamicEquityContext: any = {
  category: 'EUROPE_EQUITY',
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const dynamicEquityReduce = classifyPositionHealth({ ...weakSatellite, assetId: dynamicEquity.assetId, ticker: dynamicEquity.ticker, name: dynamicEquity.name }, -10, dynamicEquityContext);
check('822 a Yahoo-discovered DYNAMIC equity cannot inherit EUROPE_EQUITY core protection', dynamicEquityReduce.action === 'REDUCE' && dynamicEquityContext.isDiversifiedCore === false);
check('823 dynamic equity identity is recognized by both assetId and ticker', !isDiversifiedCoreCategory('EUROPE_EQUITY', dynamicEquity.assetId) && !isDiversifiedCoreCategory('EUROPE_EQUITY', dynamicEquity.ticker));

const dynamicEtf = registerLiveDiscoveredAsset({
  symbol: 'TESTETF.DE',
  name: 'Test Broad Europe ETF',
  quoteType: 'ETF',
  exchange: 'GER',
  currency: 'EUR',
  usableInEurEngine: true,
  historyBars3y: 756,
  source: 'YAHOO_LIVE_DISCOVERY'
});
check('824 a Yahoo-discovered broad ETF does not become a tactical single stock by mistake', isDiversifiedCoreCategory('GLOBAL_EQUITY', dynamicEtf.assetId));

const currentLiveEquityContext: any = {
  category: 'EUROPE_EQUITY',
  isListedEquity: true,
  isDiversifiedCore: true,
  currentReturnPct: -10,
  mfePct: 8,
  givebackFromMfePctPoints: 18,
  deteriorationStreakSessions: 10,
  momentum20Pct: -4
};
const currentLiveEquityReduce = classifyPositionHealth({ ...weakSatellite, assetId: 'OPEN_HFG_DE', ticker: 'HFG.DE', name: 'HelloFresh current-live' }, -10, currentLiveEquityContext);
check('825 a current-live OPEN equity uses listed-equity identity instead of broad-category core protection', currentLiveEquityReduce.action === 'REDUCE' && currentLiveEquityContext.isDiversifiedCore === false);

console.log(`Portfolio position health: ${passed}/25 invariants passed.`);
