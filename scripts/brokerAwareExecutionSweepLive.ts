import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  BrokerAwareCausalReplayEngine,
  CausalUniverseBacktestEngine,
  CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS,
  DynamicHistoricalReplayEngine,
  EUR_ASSET_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  MixedInstrumentCausalReplayEngine,
  executionPolicyForCapital,
  DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
  historicalStartDates,
  type AssetUniverseItem
} from '../src/investment/decision';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function round(value: number | null, digits = 2): number | null { return value == null ? null : Number(value.toFixed(digits)); }
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function stratifiedSample(items: AssetUniverseItem[], count: number, seed: number): AssetUniverseItem[] {
  const groups = new Map<string, AssetUniverseItem[]>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  const categories = shuffle([...groups.keys()], seed ^ 0x9e3779b9);
  const selected: AssetUniverseItem[] = [];
  for (const category of categories) {
    if (selected.length >= count) break;
    const candidates = shuffle(groups.get(category) ?? [], seed ^ hashSeed(category));
    if (candidates[0]) selected.push(candidates[0]);
  }
  const selectedIds = new Set(selected.map(item => item.assetId));
  const remainder = shuffle(items.filter(item => !selectedIds.has(item.assetId)), seed ^ 0x85ebca6b);
  for (const item of remainder) {
    if (selected.length >= count) break;
    selected.push(item);
  }
  return selected;
}
function subsetDataset(dataset: MultiAssetDataset, ids: Set<string>): MultiAssetDataset {
  return { ...dataset, assets: dataset.assets.filter(asset => ids.has(asset.assetId)) };
}
function annualizedVolatility(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(prices: number[]): number | null {
  if (!prices.length) return null;
  let peak = prices[0]; let max = 0;
  for (const price of prices) { peak = Math.max(peak, price); if (peak > 0) max = Math.max(max, (peak - price) / peak * 100); }
  return max;
}
function trailingReturn(prices: number[], bars = 252): number | null {
  if (prices.length <= bars) return null;
  const a = prices[prices.length - 1 - bars], b = prices.at(-1)!;
  return a > 0 ? (b / a - 1) * 100 : null;
}
function currentDrawdown(prices: number[], bars = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, bars));
  if (!slice.length) return null;
  const peak = Math.max(...slice); const last = slice.at(-1)!;
  return peak > 0 ? (peak - last) / peak * 100 : null;
}
function summarizeReplay(replay: ReturnType<typeof DynamicHistoricalReplayEngine.run>, focusIds: Set<string> = new Set()) {
  const signalCounts: Record<string, number> = {};
  for (const signal of replay.signals) signalCounts[signal.action] = (signalCounts[signal.action] ?? 0) + 1;
  const focusBehavior = [...focusIds].map(assetId => {
    const rows = replay.signals.filter(signal => signal.assetId === assetId);
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.action] = (counts[row.action] ?? 0) + 1;
    return { assetId, ticker: rows[0]?.ticker ?? assetId, signalCounts: counts, executed: rows.filter(row => row.executed).length };
  });
  return {
    startDate: replay.startDate,
    endDate: replay.endDate,
    finalValueEur: round(replay.finalValueEur),
    totalReturnPct: round(replay.totalReturnPct),
    staticBuyHoldFinalEur: round(replay.staticBuyHoldFinalEur),
    staticBuyHoldReturnPct: round(replay.staticBuyHoldReturnPct),
    allCashFinalEur: round(replay.allCashFinalEur),
    allCashReturnPct: round(replay.allCashReturnPct),
    excessFinalEurVsStatic: round(replay.excessFinalEurVsStatic),
    excessReturnVsStaticPctPoints: round(replay.excessReturnVsStaticPctPoints),
    excessFinalEurVsCash: round(replay.excessFinalEurVsCash),
    excessReturnVsCashPctPoints: round(replay.excessReturnVsCashPctPoints),
    decisionPathMaxDrawdownPct: round(replay.decisionPathMaxDrawdownPct),
    decisions: replay.decisions,
    executedBuys: replay.executedBuys,
    executedAdds: replay.executedAdds,
    executedReductions: replay.executedReductions,
    executedExits: replay.executedExits,
    totalFeesEur: round(replay.totalFeesEur),
    cashInterestEur: round(replay.cashInterestEur),
    signalCounts,
    focusBehavior,
    executedSignals: replay.signals.filter(signal => signal.executed).map(signal => ({
      signalDate: signal.signalDate,
      executionDate: signal.executionDate,
      ticker: signal.ticker,
      action: signal.action,
      targetWeightPct: round(signal.targetWeight * 100, 1),
      currentWeightPct: round(signal.currentWeight * 100, 1),
      consensusScore: signal.consensusScore,
      favorableVotes: signal.favorableVotes,
      unfavorableVotes: signal.unfavorableVotes,
      structuralDowntrend: signal.structuralDowntrend,
      buyTheDipCandidate: signal.buyTheDipCandidate,
      notionalEur: round(signal.notionalEur),
      feeEur: round(signal.feeEur),
      executionPriceEur: round(signal.executionPriceEur),
      reason: signal.reason
    }))
  };
}
function runDynamicScenarioSet(dataset: MultiAssetDataset, catalog: AssetUniverseItem[], starts: string[], focusIds: Set<string> = new Set()) {
  const scenarios = starts.map(startDate => summarizeReplay(DynamicHistoricalReplayEngine.run({
    dataset,
    catalog,
    startDate,
    frequency: 'MONTHLY',
    initialCapitalEur: 1000,
    riskProfile: 'MEDIUM',
    horizonYears: 3,
    cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
    minimumBars: 252
  }), focusIds));
  return {
    configuration: { riskProfile: 'MEDIUM', horizonYears: 3, initialCapitalEur: 1000, frequency: 'MONTHLY', cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT, minimumBars: 252, requestedHistoricalStarts: starts },
    summary: {
      scenarioCount: scenarios.length,
      scenariosBeatingStatic: scenarios.filter(item => (item.excessFinalEurVsStatic ?? 0) > 0).length,
      scenariosBeatingCash: scenarios.filter(item => (item.excessFinalEurVsCash ?? 0) > 0).length,
      totalExecutedBuys: scenarios.reduce((sum, item) => sum + item.executedBuys, 0),
      totalExecutedAdds: scenarios.reduce((sum, item) => sum + item.executedAdds, 0),
      totalExecutedReductions: scenarios.reduce((sum, item) => sum + item.executedReductions, 0),
      totalExecutedExits: scenarios.reduce((sum, item) => sum + item.executedExits, 0)
    },
    scenarios
  };
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  if (!(await waitFor(`${base}/api/health`, 1200))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitFor(`${base}/api/health`, 30_000))) throw new Error('Servidor local no disponible en puerto 3000');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${base}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);
    const end = new Date();
    const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 7);
    const startDate = isoDate(start), endDate = isoDate(end);
    const scan = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, startDate, endDate, { forceRefresh: false, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 });

    const provenance = scan.acceptedDataset.assets.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker, sourceType: asset.provenance.sourceType, provider: asset.provenance.provider ?? null, symbol: asset.provenance.symbol ?? null, bars: asset.bars.length, firstDate: asset.bars[0]?.timestamp.slice(0, 10) ?? null, lastDate: asset.bars.at(-1)?.timestamp.slice(0, 10) ?? null, datasetFingerprint: asset.provenance.datasetFingerprint ?? null }));
    const nonReal = provenance.filter(item => item.sourceType !== 'REAL');
    if (nonReal.length) throw new Error(`La validación live exige REAL_ONLY; encontrados ${nonReal.length} activos no REAL.`);

    const baseConfig = { initialCapital: 100, commissionPct: 0.05, slippagePct: 0.02, riskProfile: 'MEDIUM' as const, horizonYears: 3 as const, rebalanceFrequency: 'MONTHLY' as const };
    const research = CausalUniverseBacktestEngine.run(scan.acceptedDataset, EUR_ASSET_UNIVERSE, baseConfig, 8);
    const capitals = [100, 334, 500, 1000, 5000, 25000];

    const lastResearchInformationDate = research.selectionHistory.at(-1)?.informationEndDate ?? null;
    const fundEligibility = EUR_ASSET_UNIVERSE.filter(x => x.instrumentType === 'MUTUAL_FUND').map(fund => {
      const candidate = scan.candidates.find(c => c.asset.assetId === fund.assetId);
      const series = scan.acceptedDataset.assets.find(a => a.assetId === fund.assetId)?.bars ?? [];
      const firstCausalEligibleDate = series.length >= CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS ? series[CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS - 1].timestamp.slice(0, 10) : null;
      const appearances = research.selectionHistory.filter(x => x.selectedAssetIds.includes(fund.assetId)).length;
      const eligibleBeforeLastMonthlyDecision = Boolean(firstCausalEligibleDate && lastResearchInformationDate && firstCausalEligibleDate <= lastResearchInformationDate);
      return { assetId: fund.assetId, ticker: fund.ticker, status: candidate?.status ?? 'NOT_SCANNED', bars: candidate?.bars ?? 0, currentScore: candidate?.score == null ? null : Number(candidate.score.toFixed(3)), currentShortlist: scan.selected.some(x => x.asset.assetId === fund.assetId), firstCausalEligibleDate, lastResearchInformationDate, eligibleBeforeLastMonthlyDecision, causalSelectionAppearances: appearances, diagnosis: candidate?.status !== 'ACCEPTED' ? `NOT_ACCEPTED:${candidate?.reason ?? 'UNKNOWN'}` : !eligibleBeforeLastMonthlyDecision ? 'NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY' : appearances === 0 ? 'ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED' : 'SELECTED_CAUSALLY' };
    });

    const adaptiveEtfSweep = capitals.map(initialCapital => {
      const policy = executionPolicyForCapital(initialCapital);
      const replay = BrokerAwareCausalReplayEngine.run({ universeDataset: scan.acceptedDataset, catalog: EUR_ASSET_UNIVERSE, researchResult: research, config: { ...baseConfig, initialCapital }, policy });
      return { initialCapitalEur: initialCapital, capitalBand: policy.capitalBand, policy: { minimumDriftPctPoints: policy.minimumDriftPctPoints, minimumOrderNotionalEur: policy.minimumOrderNotionalEur, maximumOrderFeeDragPct: policy.maximumOrderFeeDragPct, maximumRebalanceFeeDragPct: policy.maximumRebalanceFeeDragPct }, finalEquityEur: Number(replay.finalEquityEur.toFixed(2)), totalReturnPct: Number(replay.totalReturnPct.toFixed(2)), maxDrawdownPct: Number(replay.maxDrawdownPct.toFixed(2)), executedOrders: replay.executedOrders, suppressedOrders: replay.suppressedOrders, rebalanceWindows: replay.rebalanceWindows, windowsWithTrades: replay.windowsWithTrades, totalCommissionEur: Number(replay.totalCommissionEur.toFixed(2)), commissionDragPctOfInitial: Number((replay.totalCommissionEur / initialCapital * 100).toFixed(2)), residualCashEur: Number(replay.residualCashEur.toFixed(2)) };
    });

    const mixedSweep = capitals.map(initialCapital => {
      const replay = MixedInstrumentCausalReplayEngine.run({ universeDataset: scan.acceptedDataset, catalog: EUR_ASSET_UNIVERSE, researchResult: research, config: { ...baseConfig, initialCapital }, cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT });
      return { initialCapitalEur: initialCapital, finalEquityEur: Number(replay.finalEquityEur.toFixed(2)), totalReturnPct: Number(replay.totalReturnPct.toFixed(2)), maxDrawdownPct: Number(replay.maxDrawdownPct.toFixed(2)), etfOrders: replay.etfOrders, fundOperations: replay.fundOperations, transferReviewCandidates: replay.transferReviewCandidates, suppressedEtfOrders: replay.suppressedEtfOrders, suppressedFundOperations: replay.suppressedFundOperations, totalEtfCommissionEur: Number(replay.totalEtfCommissionEur.toFixed(2)), commissionDragPctOfInitial: Number(replay.commissionDragPctOfInitial.toFixed(2)), rebalanceWindows: replay.rebalanceWindows, windowsWithAnyOperation: replay.windowsWithAnyOperation, residualCashEur: Number(replay.residualCashEur.toFixed(2)), cashBenchmarkAnnualPct: replay.cashBenchmarkAnnualPct, cashInterestEarnedEur: Number(replay.cashInterestEarnedEur.toFixed(2)), allCashFinalEur: Number(replay.allCashFinalEur.toFixed(2)), allCashReturnPct: Number(replay.allCashReturnPct.toFixed(2)), excessFinalEurVsCash: Number(replay.excessFinalEurVsCash.toFixed(2)), excessReturnVsCashPctPoints: Number(replay.excessReturnVsCashPctPoints.toFixed(2)), beatsAllCashBenchmark: replay.beatsAllCashBenchmark };
    });

    const dynamicStarts = historicalStartDates(scan.acceptedDataset, 'ANNUAL').slice(-5);
    const dynamicHistoricalReplay = runDynamicScenarioSet(scan.acceptedDataset, EUR_ASSET_UNIVERSE, dynamicStarts);

    // Out-of-universe holdout validation: same REAL providers, no production-catalog overlap.
    const holdoutScan = await AssetUniverseScanner.scan(EUR_VALIDATION_HOLDOUT_UNIVERSE, startDate, endDate, { forceRefresh: false, concurrency: 2, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 });
    const productionTickers = new Set(EUR_ASSET_UNIVERSE.map(item => item.ticker.toUpperCase()));
    const overlap = holdoutScan.candidates.filter(candidate => productionTickers.has(candidate.asset.ticker.toUpperCase())).map(candidate => candidate.asset.ticker);
    if (overlap.length) throw new Error(`HOLDOUT_OVERLAP:${overlap.join(',')}`);
    const acceptedHoldoutCatalog = holdoutScan.candidates.filter(candidate => candidate.status === 'ACCEPTED').map(candidate => candidate.asset);
    if (acceptedHoldoutCatalog.length < 6) throw new Error(`HOLDOUT_TOO_SMALL:${acceptedHoldoutCatalog.length}`);
    const holdoutNonReal = holdoutScan.acceptedDataset.assets.filter(asset => asset.provenance.sourceType !== 'REAL');
    if (holdoutNonReal.length) throw new Error(`HOLDOUT_NON_REAL:${holdoutNonReal.length}`);

    const holdoutSeed = hashSeed(`${endDate}|OUT_OF_UNIVERSE_V1`);
    const randomSampleCatalog = stratifiedSample(acceptedHoldoutCatalog, Math.min(8, acceptedHoldoutCatalog.length), holdoutSeed);
    const randomSampleIds = new Set(randomSampleCatalog.map(item => item.assetId));
    const randomSampleDataset = subsetDataset(holdoutScan.acceptedDataset, randomSampleIds);
    const randomStarts = historicalStartDates(randomSampleDataset, 'ANNUAL').slice(-3);
    const randomSampleReplay = runDynamicScenarioSet(randomSampleDataset, randomSampleCatalog, randomStarts);

    const profiles = holdoutScan.acceptedDataset.assets.map(asset => {
      const prices = asset.bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
      const item = acceptedHoldoutCatalog.find(candidate => candidate.assetId === asset.assetId)!;
      return {
        assetId: asset.assetId,
        ticker: asset.ticker,
        name: item.name,
        instrumentType: item.instrumentType ?? 'ETF_ETC',
        category: item.category,
        trailing1yReturnPct: round(trailingReturn(prices, 252)),
        annualizedVolatility1yPct: round(annualizedVolatility(prices, 252)),
        maxDrawdownFullPct: round(maxDrawdown(prices)),
        currentDrawdown1yPct: round(currentDrawdown(prices, 252)),
        bars: asset.bars.length
      };
    });
    const byLoss = [...profiles].sort((a, b) => (a.trailing1yReturnPct ?? Infinity) - (b.trailing1yReturnPct ?? Infinity));
    const actualLosers = byLoss.filter(item => (item.trailing1yReturnPct ?? 0) < 0);
    const losingCases = (actualLosers.length ? actualLosers : byLoss).slice(0, 3);
    const deepDrawdownCases = [...profiles].sort((a, b) => (b.maxDrawdownFullPct ?? -Infinity) - (a.maxDrawdownFullPct ?? -Infinity)).slice(0, 3);
    const highVolatilityCases = [...profiles].sort((a, b) => (b.annualizedVolatility1yPct ?? -Infinity) - (a.annualizedVolatility1yPct ?? -Infinity)).slice(0, 3);
    const sidewaysCases = [...profiles].sort((a, b) => Math.abs(a.trailing1yReturnPct ?? Infinity) - Math.abs(b.trailing1yReturnPct ?? Infinity)).slice(0, 3);
    const stressIds = new Set([...losingCases, ...deepDrawdownCases, ...highVolatilityCases, ...sidewaysCases].map(item => item.assetId));
    const stressCatalog = acceptedHoldoutCatalog.filter(item => stressIds.has(item.assetId)).slice(0, 8);
    const limitedStressIds = new Set(stressCatalog.map(item => item.assetId));
    const stressDataset = subsetDataset(holdoutScan.acceptedDataset, limitedStressIds);
    const stressStarts = historicalStartDates(stressDataset, 'ANNUAL').slice(-3);
    const stressReplay = stressCatalog.length >= 2 && stressStarts.length ? runDynamicScenarioSet(stressDataset, stressCatalog, stressStarts, limitedStressIds) : null;

    const outOfUniverseRobustness = {
      purpose: 'CHECK_GENERALIZATION_OUTSIDE_PRODUCTION_CATALOG_WITHOUT_TUNING_ON_OUTCOMES',
      seed: holdoutSeed,
      pool: {
        requested: EUR_VALIDATION_HOLDOUT_UNIVERSE.length,
        accepted: holdoutScan.accepted,
        rejected: holdoutScan.rejected,
        rejectionCounts: holdoutScan.rejectionCounts,
        acceptedMutualFunds: acceptedHoldoutCatalog.filter(item => item.instrumentType === 'MUTUAL_FUND').map(item => item.ticker),
        acceptedEtfs: acceptedHoldoutCatalog.filter(item => item.instrumentType !== 'MUTUAL_FUND').map(item => item.ticker)
      },
      randomSample: {
        selectionRule: 'SEEDED_STRATIFIED_RANDOM_SAMPLE_INDEPENDENT_OF_SUBSEQUENT_RETURN',
        tickers: randomSampleCatalog.map(item => item.ticker),
        replay: randomSampleReplay
      },
      adversePathStress: {
        warning: 'These cohorts are selected ex-post from REAL paths only to stress behavior. They are NOT unbiased OOS performance evidence and must never be used to tune thresholds.',
        actualNegative1yAssets: actualLosers.length,
        losingCases,
        deepDrawdownCases,
        highVolatilityCases,
        sidewaysCases,
        stressTickers: stressCatalog.map(item => item.ticker),
        replay: stressReplay
      }
    };

    const result = {
      generatedAt: new Date().toISOString(),
      scope: 'INTEGRATED_REAL_EXECUTION_HISTORICAL_AND_HOLDOUT_ROBUSTNESS_VALIDATION',
      provenance,
      researchReference: { initialCapitalEur: research.initialCapital, researchTrades: research.totalTrades, researchRebalanceWindows: research.rebalanceCount, researchReturnPct: Number(research.totalReturnPct.toFixed(2)) },
      cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
      fundEligibility,
      fundEligibilitySummary: { acceptedFunds: fundEligibility.filter(x => x.status === 'ACCEPTED').length, currentlySelectedFunds: fundEligibility.filter(x => x.currentShortlist).length, fundsEverSelectedCausally: fundEligibility.filter(x => x.causalSelectionAppearances > 0).length, noMonthlyWindowAfterEligibility: fundEligibility.filter(x => x.diagnosis === 'NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY').length, eligibleButNotSelected: fundEligibility.filter(x => x.diagnosis === 'ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED').length },
      adaptiveEtfSweep,
      mixedSweep,
      dynamicHistoricalReplay,
      outOfUniverseRobustness,
      interpretation: 'ONE_INTEGRATED_REAL_VALIDATION_FOR_PRODUCTION_UNIVERSE_PLUS_OUT_OF_UNIVERSE_RANDOM_AND_ADVERSE_PATH_CHALLENGES',
      notes: [
        'One REAL production scan feeds research, execution diagnostics and dynamic historical signal replay; synthetic fallback is forbidden.',
        'The holdout catalogue is excluded from production recommendations and is sampled with a recorded pseudo-random seed.',
        'The random holdout sample is selected independently of subsequent performance and is the relevant generalization check.',
        'Loss/drawdown/volatility/sideways cohorts are selected after observing REAL paths only as behavioral stress tests; they are not OOS return evidence.',
        'Dynamic historical decisions remain causal and execute after their information date.',
        'No holdout result may be used to retune consensus thresholds without a separately defined training/validation protocol.',
        'Current-catalog survivorship bias remains and results are historical diagnostics, not forecasts.'
      ]
    };
    console.log('BROKER_AWARE_EXECUTION_SWEEP_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (ownsServer && server) server.kill('SIGTERM'); }
}

main().catch(error => { console.error('BROKER_AWARE_EXECUTION_SWEEP_ERROR', error?.message || String(error)); process.exit(1); });
