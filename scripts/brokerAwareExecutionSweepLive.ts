import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  BrokerAwareCausalReplayEngine,
  CausalUniverseBacktestEngine,
  CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS,
  EUR_ASSET_UNIVERSE,
  MixedInstrumentCausalReplayEngine,
  executionPolicyForCapital,
  DEFAULT_CASH_BENCHMARK_ANNUAL_PCT
} from '../src/investment/decision';

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }

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
    const scan = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, isoDate(start), isoDate(end), { forceRefresh: false, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 });

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
      return {
        assetId: fund.assetId, ticker: fund.ticker, status: candidate?.status ?? 'NOT_SCANNED', bars: candidate?.bars ?? 0,
        currentScore: candidate?.score == null ? null : Number(candidate.score.toFixed(3)), currentShortlist: scan.selected.some(x => x.asset.assetId === fund.assetId),
        firstCausalEligibleDate, lastResearchInformationDate, eligibleBeforeLastMonthlyDecision, causalSelectionAppearances: appearances,
        diagnosis: candidate?.status !== 'ACCEPTED' ? `NOT_ACCEPTED:${candidate?.reason ?? 'UNKNOWN'}` : !eligibleBeforeLastMonthlyDecision ? 'NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY' : appearances === 0 ? 'ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED' : 'SELECTED_CAUSALLY'
      };
    });

    const adaptiveEtfSweep = capitals.map(initialCapital => {
      const policy = executionPolicyForCapital(initialCapital);
      const replay = BrokerAwareCausalReplayEngine.run({ universeDataset: scan.acceptedDataset, catalog: EUR_ASSET_UNIVERSE, researchResult: research, config: { ...baseConfig, initialCapital }, policy });
      return {
        initialCapitalEur: initialCapital, capitalBand: policy.capitalBand,
        policy: { minimumDriftPctPoints: policy.minimumDriftPctPoints, minimumOrderNotionalEur: policy.minimumOrderNotionalEur, maximumOrderFeeDragPct: policy.maximumOrderFeeDragPct, maximumRebalanceFeeDragPct: policy.maximumRebalanceFeeDragPct },
        finalEquityEur: Number(replay.finalEquityEur.toFixed(2)), totalReturnPct: Number(replay.totalReturnPct.toFixed(2)), maxDrawdownPct: Number(replay.maxDrawdownPct.toFixed(2)),
        executedOrders: replay.executedOrders, suppressedOrders: replay.suppressedOrders, rebalanceWindows: replay.rebalanceWindows, windowsWithTrades: replay.windowsWithTrades,
        totalCommissionEur: Number(replay.totalCommissionEur.toFixed(2)), commissionDragPctOfInitial: Number((replay.totalCommissionEur / initialCapital * 100).toFixed(2)), residualCashEur: Number(replay.residualCashEur.toFixed(2))
      };
    });

    const mixedSweep = capitals.map(initialCapital => {
      const replay = MixedInstrumentCausalReplayEngine.run({ universeDataset: scan.acceptedDataset, catalog: EUR_ASSET_UNIVERSE, researchResult: research, config: { ...baseConfig, initialCapital }, cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT });
      return {
        initialCapitalEur: initialCapital,
        finalEquityEur: Number(replay.finalEquityEur.toFixed(2)), totalReturnPct: Number(replay.totalReturnPct.toFixed(2)), maxDrawdownPct: Number(replay.maxDrawdownPct.toFixed(2)),
        etfOrders: replay.etfOrders, fundOperations: replay.fundOperations, transferReviewCandidates: replay.transferReviewCandidates,
        suppressedEtfOrders: replay.suppressedEtfOrders, suppressedFundOperations: replay.suppressedFundOperations,
        totalEtfCommissionEur: Number(replay.totalEtfCommissionEur.toFixed(2)), commissionDragPctOfInitial: Number(replay.commissionDragPctOfInitial.toFixed(2)),
        rebalanceWindows: replay.rebalanceWindows, windowsWithAnyOperation: replay.windowsWithAnyOperation, residualCashEur: Number(replay.residualCashEur.toFixed(2)),
        cashBenchmarkAnnualPct: replay.cashBenchmarkAnnualPct, cashInterestEarnedEur: Number(replay.cashInterestEarnedEur.toFixed(2)),
        allCashFinalEur: Number(replay.allCashFinalEur.toFixed(2)), allCashReturnPct: Number(replay.allCashReturnPct.toFixed(2)),
        excessFinalEurVsCash: Number(replay.excessFinalEurVsCash.toFixed(2)), excessReturnVsCashPctPoints: Number(replay.excessReturnVsCashPctPoints.toFixed(2)), beatsAllCashBenchmark: replay.beatsAllCashBenchmark
      };
    });

    const result = {
      generatedAt: new Date().toISOString(), scope: 'ADAPTIVE_AND_MIXED_EXECUTION_CAPITAL_SWEEP',
      researchReference: { initialCapitalEur: research.initialCapital, researchTrades: research.totalTrades, researchRebalanceWindows: research.rebalanceCount, researchReturnPct: Number(research.totalReturnPct.toFixed(2)) },
      cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
      fundEligibility,
      fundEligibilitySummary: {
        acceptedFunds: fundEligibility.filter(x => x.status === 'ACCEPTED').length, currentlySelectedFunds: fundEligibility.filter(x => x.currentShortlist).length,
        fundsEverSelectedCausally: fundEligibility.filter(x => x.causalSelectionAppearances > 0).length,
        noMonthlyWindowAfterEligibility: fundEligibility.filter(x => x.diagnosis === 'NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY').length,
        eligibleButNotSelected: fundEligibility.filter(x => x.diagnosis === 'ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED').length
      },
      adaptiveEtfSweep, mixedSweep,
      interpretation: 'COMPARE_RESEARCH_SIGNAL_WITH_EXECUTABLE_MIXED_REPLAY_AND_REMUNERATED_ALL_CASH_BENCHMARK',
      notes: [
        'Adaptive ETF replay changes execution thresholds by capital band but not research targets.',
        'Mixed replay models ETFs as whole-share broker orders and funds by EUR/NAV with fractional units.',
        'Residual cash inside the mixed strategy earns the configured annual cash rate using calendar days/365.',
        'All-cash benchmark keeps the full initial capital remunerated over the identical replay dates.',
        'Fund eligibility diagnostics distinguish insufficient causal history from genuine ranking/category exclusion; funds are never forced into the shortlist.',
        'Results are historical execution diagnostics, not profitability forecasts.'
      ]
    };
    console.log('BROKER_AWARE_EXECUTION_SWEEP_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (ownsServer && server) server.kill('SIGTERM'); }
}

main().catch(error => { console.error('BROKER_AWARE_EXECUTION_SWEEP_ERROR', error?.message || String(error)); process.exit(1); });
