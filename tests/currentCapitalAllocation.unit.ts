import { CurrentOpportunityAlertEngine, PortfolioDecisionEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}
function bars(multiplier: number, count = 320) {
  const out: any[] = []; let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    out.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  return out;
}
function transientStrongBars(count = 320) {
  const out: any[] = []; let price = 100;
  const trendBars = count - 10;
  for (let i = 0; i < trendBars; i++) {
    price *= 1.0012;
    out.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  for (let i = trendBars; i < count - 1; i++) {
    price *= 0.995;
    out.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 1.001, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  price *= 1.055;
  out.push({ timestamp: new Date(Date.UTC(2025, 0, count)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  return out;
}
function candidate(assetId: string, ticker: string, category: string, series: any[], m120: number, vol: number, score: number): any {
  return {
    asset: { assetId, ticker, name: ticker, category, currency: 'EUR' }, status: 'ACCEPTED', bars: series.length,
    asOfDate: series.at(-1).timestamp.slice(0,10), lastClose: series.at(-1).close,
    momentum20Pct: m120 / 4, momentum60Pct: m120 / 2, momentum120Pct: m120,
    annualizedVolatilityPct: vol, maxDrawdownPct: 8, score
  };
}
function scanFrom(rows: any[], seriesByAsset: Record<string, any[]>): any {
  const acceptedDataset: any = {
    timeframe: '1d',
    assets: rows.map(c => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, currency: 'EUR', bars: seriesByAsset[c.asset.assetId], provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true } }))
  };
  return { scanned: rows.length, accepted: rows.length, rejected: 0, rejectionCounts: {}, selected: rows, candidates: rows, acceptedDataset, dataset: acceptedDataset };
}
const techBars = bars(1.0024);
const europeBars = bars(1.0021);
const weakBars = bars(1.00005);
const candidates: any[] = [
  candidate('STRONG_TECH', 'STRONGT.DE', 'TECHNOLOGY', techBars, 26, 15, 21),
  candidate('STRONG_EU', 'STRONGE.DE', 'EUROPE_EQUITY', europeBars, 21, 14, 18),
  candidate('WEAK_BOND', 'WEAKB.DE', 'GOV_BONDS', weakBars, 0.5, 7, 10)
];
const scan: any = scanFrom(candidates, { STRONG_TECH: techBars, STRONG_EU: europeBars, WEAK_BOND: weakBars });
const portfolio: any = { cashEur: 0, holdings: [], funds: [], stagedCapitalPlan: { availableEur: 10000, horizonMonths: 12, preferredMode: 'MONTHLY' }, updatedAt: '2026-08-30T00:00:00Z' };
const decision: any = {
  cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3,
  assets: [{ assetId: 'WEAK_BOND', ticker: 'WEAKB.DE', name: 'Weak theoretical bond', weight: 0.90 }]
};

const alerts = CurrentOpportunityAlertEngine.evaluate(scan, 2.5);
const result = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision, cashBenchmarkAnnualPct: 2.5 });
const totalContribution = result.contributions.reduce((sum, row) => sum + row.amountEur, 0);

check('931 current strong opportunities exist for the production allocation test', alerts.some(a => a.assetId === 'STRONG_TECH') && alerts.some(a => a.assetId === 'STRONG_EU'));
check('932 finite capital is allocated to current opportunities', result.contributions.some(row => row.assetId === 'STRONG_TECH') && result.contributions.some(row => row.assetId === 'STRONG_EU'));
check('933 weak theoretical preferred asset is not funded when current opportunities exist', !result.contributions.some(row => row.assetId === 'WEAK_BOND'));
check('934 total proposed capital never exceeds deployable finite capital', totalContribution <= result.deployableToAssetsEur + 1e-9 && result.deployableToAssetsEur <= 10000 + 1e-9);
check('935 medium-risk high-conviction single-name amount respects concentration cap', result.contributions.every(row => row.amountEur <= result.deployableToAssetsEur * 0.50 + 1e-9));
check('936 operational contributions explicitly carry current opportunity semantics', result.contributions.every(row => row.opportunityLevel != null && row.priorityScore != null));
check('937 residual cash reconciles exactly with finite available capital', Math.abs(result.residualPlannedCashEur - (10000 - totalContribution)) < 1e-6);

const techInitial = result.contributions.find(row => row.assetId === 'STRONG_TECH')!;
const euInitial = result.contributions.find(row => row.assetId === 'STRONG_EU')!;
const techPrice = candidates[0].lastClose;
const fullyExecutedPortfolio: any = {
  ...portfolio,
  holdings: [{ ticker: 'STRONGT.DE', shares: techInitial.amountEur / techPrice }],
  stagedCapitalPlan: { ...portfolio.stagedCapitalPlan, availableEur: 10000 - techInitial.amountEur },
  updatedAt: '2026-08-30T00:10:00Z'
};
const afterFullExecution = PortfolioDecisionEngine.evaluate({ portfolio: fullyExecutedPortfolio, scan, decision, cashBenchmarkAnnualPct: 2.5 });
const euAfterFull = afterFullExecution.contributions.find(row => row.assetId === 'STRONG_EU');
check('938 a fully executed starter is not recommended again without an independent ADD confirmation', !afterFullExecution.contributions.some(row => row.assetId === 'STRONG_TECH'));
check('939 buying one starter does not inflate the untouched target by recursively redistributing remaining cash', Boolean(euAfterFull) && Math.abs((euAfterFull?.amountEur ?? 0) - euInitial.amountEur) < 0.01);

const halfExecutedPortfolio: any = {
  ...portfolio,
  holdings: [{ ticker: 'STRONGT.DE', shares: (techInitial.amountEur / 2) / techPrice }],
  stagedCapitalPlan: { ...portfolio.stagedCapitalPlan, availableEur: 10000 - techInitial.amountEur / 2 },
  updatedAt: '2026-08-30T00:05:00Z'
};
const afterHalfExecution = PortfolioDecisionEngine.evaluate({ portfolio: halfExecutedPortfolio, scan, decision, cashBenchmarkAnnualPct: 2.5 });
const techRemaining = afterHalfExecution.contributions.find(row => row.assetId === 'STRONG_TECH');
check('940 a partial starter execution leaves only the unfilled portion of the starter cap', Boolean(techRemaining) && Math.abs((techRemaining?.amountEur ?? 0) - techInitial.amountEur / 2) < 0.01);
check('941 recommendations expose strategic target and current exposure so the UI can explain the remaining amount', result.contributions.every(row => row.targetAssetValueEur != null && row.currentAssetValueEur != null));
check('942 timing fraction is propagated into every actionable contribution', result.contributions.every(row => row.timingState != null && row.suggestedInitialFraction != null && row.suggestedInitialFraction > 0 && row.suggestedInitialFraction <= 0.5));
check('943 executable target never exceeds the timing-authorized fraction of the strategic target', result.contributions.every(row => row.executableTargetAssetValueEur != null && row.targetAssetValueEur != null && row.suggestedInitialFraction != null && (row.executableTargetAssetValueEur ?? Infinity) <= (row.targetAssetValueEur ?? 0) * (row.suggestedInitialFraction ?? 0) + 1e-6));
check('944 immediate order never exceeds the remaining timing-authorized tranche', result.contributions.every(row => row.executableTargetAssetValueEur != null && row.currentAssetValueEur != null && row.amountEur <= Math.max(0, (row.executableTargetAssetValueEur ?? 0) - (row.currentAssetValueEur ?? 0)) + 1e-6));

const fundBars = bars(1.0023);
const fundCandidate: any = candidate('FUND_TEST', 'IE000000TEST', 'GLOBAL_EQUITY', fundBars, 24, 14, 20);
fundCandidate.asset = { ...fundCandidate.asset, isin: 'IE000000TEST', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' };
const fundScan: any = scanFrom([fundCandidate], { FUND_TEST: fundBars });
const fundDecision: any = { cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3, assets: [{ assetId: 'FUND_TEST', ticker: 'IE000000TEST', name: 'Fund Test', weight: 0.90 }] };
const nearTargetFundPortfolio: any = {
  cashEur: 0, holdings: [],
  funds: [{ id: 'FUND_TEST', isin: 'IE000000TEST', name: 'Fund Test', category: 'GLOBAL_EQUITY', investedEur: 4450, currentValueEur: 4450 }],
  stagedCapitalPlan: { availableEur: 5550, horizonMonths: 12, preferredMode: 'MONTHLY' }, updatedAt: '2026-08-30T00:00:00Z'
};
const nearTargetFundResult = PortfolioDecisionEngine.evaluate({ portfolio: nearTargetFundPortfolio, scan: fundScan, decision: fundDecision, cashBenchmarkAnnualPct: 2.5 });
check('945 mutual funds do not create sub-minimum micro-orders merely because brokerage commission is zero', !nearTargetFundResult.contributions.some(row => row.assetId === 'FUND_TEST'));

const materialGapFundPortfolio: any = {
  ...nearTargetFundPortfolio,
  funds: [{ ...nearTargetFundPortfolio.funds[0], investedEur: 4300, currentValueEur: 4300 }],
  stagedCapitalPlan: { ...nearTargetFundPortfolio.stagedCapitalPlan, availableEur: 5700 }
};
const materialGapFundResult = PortfolioDecisionEngine.evaluate({ portfolio: materialGapFundPortfolio, scan: fundScan, decision: fundDecision, cashBenchmarkAnnualPct: 2.5 });
check('946 an existing position already above the timing/starter authorization is not topped up by the new-money entry gate', !materialGapFundResult.contributions.some(row => row.assetId === 'FUND_TEST'));

check('947 medium-risk fresh opportunities are explicitly classified as STARTER positions', result.contributions.every(row => row.positionStage === 'STARTER'));
check('948 medium-risk ENTRY_STRONG starters are capped at five percent of total planned capital', result.contributions.every(row => (row.portfolioShareCapPct ?? Infinity) <= 5 + 1e-9 && (row.executableTargetAssetValueEur ?? Infinity) <= 500 + 1e-6));
check('949 medium-risk allocation opens at most two fresh slots in a single evaluation', result.contributions.filter(row => (row.currentAssetValueEur ?? 0) <= 0.01).length <= 2);

const fullSlotPortfolio: any = {
  cashEur: 0,
  holdings: [],
  funds: Array.from({ length: 12 }, (_, i) => ({ id: `UNKNOWN_${i}`, isin: `UNKNOWN_${i}`, name: `Existing ${i}`, category: 'OTHER', investedEur: 100, currentValueEur: 100 })),
  stagedCapitalPlan: { availableEur: 8800, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00Z'
};
const fullSlotResult = PortfolioDecisionEngine.evaluate({ portfolio: fullSlotPortfolio, scan, decision, cashBenchmarkAnnualPct: 2.5 });
check('950 a full 12-slot medium-risk portfolio cannot open another unrelated starter without freeing a slot', fullSlotResult.maxPortfolioPositions === 12 && fullSlotResult.availablePortfolioSlots === 0 && fullSlotResult.contributions.every(row => (row.currentAssetValueEur ?? 0) > 0));

const incumbentBars = bars(0.9998);
const incumbentCandidate: any = candidate('INCUMBENT', 'INC.DE', 'EUROPE_EQUITY', incumbentBars, -8, 18, 4);
const rotationScan: any = scanFrom([incumbentCandidate, candidates[0]], { INCUMBENT: incumbentBars, STRONG_TECH: techBars });
const incumbentPrice = incumbentCandidate.lastClose;
const rotationHealth: any = {
  'INC.DE': {
    key: 'INC.DE', label: 'Incumbent', tickerOrIsin: 'INC.DE', action: 'WATCH',
    reason: 'Deterioro persistente sin señal de salida estructural.', source: 'UNIVERSE_SCAN', currency: 'EUR', currentUnitPrice: incumbentPrice,
    currentValueEur: 2000, consensusScore: -1, favorableVotes: 1, unfavorableVotes: 3, structuralDowntrend: false,
    excessVsCashPctPoints: -4, suggestedReductionPct: null
  }
};
const rotationDecision: any = { cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3, assets: [] };

const freeSlotRotationPortfolio: any = {
  cashEur: 0,
  holdings: [{ ticker: 'INC.DE', shares: 2000 / incumbentPrice }],
  funds: [],
  stagedCapitalPlan: { availableEur: 1000, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00Z'
};
const freeSlotRotationResult = PortfolioDecisionEngine.evaluate({ portfolio: freeSlotRotationPortfolio, scan: rotationScan, decision: rotationDecision, positionHealth: rotationHealth, cashBenchmarkAnnualPct: 2.5 });
const freeSlotIncumbent = freeSlotRotationResult.existingPositions.find(row => row.assetId === 'INCUMBENT');
check('951 a free portfolio slot lets a challenger enter without forcing a competitive sale', freeSlotRotationResult.availablePortfolioSlots === 11 && freeSlotRotationResult.plannedRotationProceedsEur === 0 && freeSlotIncumbent?.action === 'WATCH' && freeSlotRotationResult.contributions.some(row => row.assetId === 'STRONG_TECH' && row.positionStage === 'STARTER'));

const rotationPortfolio: any = {
  cashEur: 0,
  holdings: [{ ticker: 'INC.DE', shares: 2000 / incumbentPrice }],
  funds: Array.from({ length: 11 }, (_, i) => ({ id: `FILLER_${i}`, isin: `FILLER_${i}`, name: `Filler ${i}`, category: 'OTHER', investedEur: 100, currentValueEur: 100 })),
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00Z'
};
const rotationResult = PortfolioDecisionEngine.evaluate({ portfolio: rotationPortfolio, scan: rotationScan, decision: rotationDecision, positionHealth: rotationHealth, cashBenchmarkAnnualPct: 2.5 });
const rotatedIncumbent = rotationResult.existingPositions.find(row => row.assetId === 'INCUMBENT');
const challengerEntry = rotationResult.contributions.find(row => row.assetId === 'STRONG_TECH');
check('952 a full portfolio rotates one-for-one only for a persistently strong challenger', rotationResult.availablePortfolioSlots === 0 && rotatedIncumbent?.action === 'EXIT' && rotatedIncumbent.suggestedReductionPct === 100 && rotatedIncumbent.rotationChallengerAssetId === 'STRONG_TECH');
check('953 persistent rotation records at least two prior STRONG observations inside the ten-session lookback', (rotatedIncumbent?.rotationChallengerRecentStrongCount ?? 0) >= 2 && rotatedIncumbent?.rotationChallengerPersistenceLookbackSessions === 10);
check('954 one-for-one rotation exposes the incumbent full value as theoretical proceeds', Math.abs(rotationResult.plannedRotationProceedsEur - 2000) < 0.01 && rotationResult.deployableToAssetsEur >= 2000 - 0.01);
check('955 the paired persistent challenger is tagged as ROTATION_ENTRY rather than an unrelated starter', Boolean(challengerEntry) && challengerEntry?.positionStage === 'ROTATION_ENTRY');
check('956 projected active-position count cannot exceed the strict medium-risk slot limit after a paired rotation', rotationResult.occupiedPortfolioPositions - rotationResult.existingPositions.filter(row => row.rotationChallengerAssetId != null && row.action === 'EXIT').length + rotationResult.contributions.filter(row => row.positionStage === 'ROTATION_ENTRY').length <= rotationResult.maxPortfolioPositions);
check('957 rotation remains hysteretic: at most one incumbent is competitively replaced per evaluation', rotationResult.existingPositions.filter(row => row.rotationChallengerAssetId != null).length <= 1);

const transientBars = transientStrongBars();
const transientCandidate: any = candidate('TRANSIENT_STRONG', 'TRANSIENT.DE', 'TECHNOLOGY', transientBars, 26, 15, 24);
const transientRotationScan: any = scanFrom([incumbentCandidate, transientCandidate], { INCUMBENT: incumbentBars, TRANSIENT_STRONG: transientBars });
const transientAlerts = CurrentOpportunityAlertEngine.evaluate(transientRotationScan, 2.5);
const transientRotationResult = PortfolioDecisionEngine.evaluate({ portfolio: rotationPortfolio, scan: transientRotationScan, decision: rotationDecision, positionHealth: rotationHealth, cashBenchmarkAnnualPct: 2.5 });
const transientPreservedIncumbent = transientRotationResult.existingPositions.find(row => row.assetId === 'INCUMBENT');
check('958 a fresh isolated ENTRY_STRONG remains a valid opportunity today but cannot evict an incumbent without prior persistence', transientAlerts.some(row => row.assetId === 'TRANSIENT_STRONG' && row.timingState === 'ENTRY_STRONG') && transientPreservedIncumbent?.action === 'WATCH' && transientPreservedIncumbent.rotationChallengerAssetId == null && !transientRotationResult.contributions.some(row => row.assetId === 'TRANSIENT_STRONG'));

const expensiveBars = techBars.map(bar => ({ ...bar, open: bar.open * 20, high: bar.high * 20, low: bar.low * 20, close: bar.close * 20 }));
const expensiveCandidate: any = candidate('EXPENSIVE_CHALLENGER', 'EXP.DE', 'TECHNOLOGY', expensiveBars, 26, 15, 25);
const expensiveRotationScan: any = scanFrom([incumbentCandidate, expensiveCandidate], { INCUMBENT: incumbentBars, EXPENSIVE_CHALLENGER: expensiveBars });
const expensiveRotationResult = PortfolioDecisionEngine.evaluate({ portfolio: rotationPortfolio, scan: expensiveRotationScan, decision: rotationDecision, positionHealth: rotationHealth, cashBenchmarkAnnualPct: 2.5 });
const preservedIncumbent = expensiveRotationResult.existingPositions.find(row => row.assetId === 'INCUMBENT');
check('959 a full-slot rotation is cancelled when the challenger allocation cannot buy even one whole ETF share', preservedIncumbent?.action === 'WATCH' && preservedIncumbent.rotationChallengerAssetId == null && expensiveRotationResult.plannedRotationProceedsEur === 0 && !expensiveRotationResult.contributions.some(row => row.assetId === 'EXPENSIVE_CHALLENGER'));

const weakOnlyScan: any = scanFrom([candidates[2]], { WEAK_BOND: weakBars });
const weakOnlyDecision: any = { cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3, assets: [{ assetId: 'WEAK_BOND', ticker: 'WEAKB.DE', name: 'Weak theoretical bond', weight: 0.90 }] };
const noOpportunityResult = PortfolioDecisionEngine.evaluate({ portfolio, scan: weakOnlyScan, decision: weakOnlyDecision, cashBenchmarkAnnualPct: 2.5 });
check('960 no-opportunity state never converts theoretical target gaps into fallback purchase orders', noOpportunityResult.contributions.length === 0 && noOpportunityResult.recommendedNewInvestmentEur === 0);

const addHealth: any = {
  'STRONGT.DE': {
    key: 'STRONGT.DE', label: 'Strong Tech', tickerOrIsin: 'STRONGT.DE', action: 'ADD',
    reason: 'La posición confirma tendencia, consenso y ventaja frente a cash.', source: 'UNIVERSE_SCAN', currency: 'EUR', currentUnitPrice: techPrice,
    currentValueEur: techInitial.amountEur, consensusScore: 4, favorableVotes: 5, unfavorableVotes: 0, structuralDowntrend: false,
    excessVsCashPctPoints: 15, suggestedReductionPct: null
  }
};
const confirmedBuildResult = PortfolioDecisionEngine.evaluate({ portfolio: fullyExecutedPortfolio, scan, decision, positionHealth: addHealth, cashBenchmarkAnnualPct: 2.5 });
const confirmedBuild = confirmedBuildResult.contributions.find(row => row.assetId === 'STRONG_TECH');
check('961 a filled starter may grow only when position health independently confirms ADD while timing remains strong', Boolean(confirmedBuild) && confirmedBuild?.positionStage === 'BUILD' && (confirmedBuild.portfolioShareCapPct ?? 0) === 8);
check('962 confirmed BUILD remains incremental and cannot jump beyond the eight-percent medium-risk build cap', Boolean(confirmedBuild) && (confirmedBuild?.executableTargetAssetValueEur ?? Infinity) <= 800 + 1e-6 && (confirmedBuild?.amountEur ?? Infinity) <= 300 + 1e-6);

console.log(`Current finite-capital allocation: ${passed}/32 invariants passed.`);
