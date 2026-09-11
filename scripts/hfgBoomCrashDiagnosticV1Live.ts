import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  DynamicHistoricalReplayEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  type AssetUniverseItem,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult,
  type DynamicReplayInitialPortfolio
} from '../src/investment/decision';
import {
  PortfolioDecisionEngine,
  type PortfolioDecisionResult
} from '../src/investment/decision/portfolioDecisionEngine';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';

const MARKER = 'HFG_BOOM_CRASH_DIAGNOSTIC_V1_RESULT';
const VERSION = 'HFG_BOOM_CRASH_DIAGNOSTIC_V1' as const;
const DATA_START_DATE = '2017-01-01';
const START_DATE = '2019-01-01';
const END_DATE = '2022-12-30';
const HFG_ASSET_ID = 'EQ_HFG';
const HFG_TICKER = 'HFG.DE';
const INITIAL_CAPITAL_EUR = 26_000;
const INITIAL_HFG_EUR = 13_000;
const INITIAL_CASH_EUR = 13_000;
const MIN_ACCEPTED_ASSETS = 30;

/**
 * Research-only metadata needed to reproduce the already-consumed HFG case.
 * It is intentionally local to this script: it does not extend the production
 * discovery seed and it never reconstructs a historical universe from current
 * Yahoo discovery. Market bars themselves must still be REAL.
 */
const HFG_RESEARCH_ITEM: AssetUniverseItem = {
  assetId: HFG_ASSET_ID,
  ticker: HFG_TICKER,
  name: 'HelloFresh SE',
  category: 'EUROPE_EQUITY',
  currency: 'EUR'
};

const RESEARCH_CATALOG: AssetUniverseItem[] = [
  ...EUR_PORTFOLIO_DISCOVERY_UNIVERSE.filter(item => item.ticker.toUpperCase() !== HFG_TICKER),
  HFG_RESEARCH_ITEM
];

const INITIAL_PORTFOLIO: DynamicReplayInitialPortfolio = {
  source: 'MANUAL',
  cashEur: INITIAL_CASH_EUR,
  allocations: [{ assetId: HFG_ASSET_ID, amountEur: INITIAL_HFG_EUR }]
};

const PROTOCOL = {
  version: VERSION,
  sampleStatus: 'CONSUMED_DIAGNOSTIC_ONLY',
  promotionAllowed: false,
  retuningAllowed: false,
  purpose: 'SEPARATE_SIGNAL_QUALITY_FROM_ECONOMIC_POLICY_FOR_INITIAL_EXIT_REENTRY_FUNDING_AND_WINNER_PROTECTION',
  productionArchitectureRemains: 'CORE_ARCHITECTURE_V1',
  productionAllocationPolicyRemains: 'LEGACY',
  productionCodeChangedByThisDiagnostic: false,
  currentYahooDiscoveryInHistoricalReplay: false,
  researchOnlyHfgMetadata: HFG_RESEARCH_ITEM,
  dataStartDate: DATA_START_DATE,
  startDate: START_DATE,
  endDate: END_DATE,
  frequency: 'MONTHLY',
  initialCapitalEur: INITIAL_CAPITAL_EUR,
  initialPortfolio: INITIAL_PORTFOLIO,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  cashBenchmarkAnnualPctFallback: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
  execution: 'NEXT_OPEN_CAUSAL_REPLAY_ENGINE',
  residualLimitation: 'CURRENT_CATALOG_SURVIVORSHIP_NOT_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

type Evaluate = typeof PortfolioDecisionEngine.evaluate;
type Signal = DynamicHistoricalReplayResult['signals'][number];

interface AllocationTrace {
  asOfDate: string;
  currentCashEur: number;
  pendingCapitalEur: number;
  deployableToAssetsEur: number;
  recommendedNewInvestmentEur: number;
  residualPlannedCashEur: number;
  hfgContributionEur: number;
  contributions: Array<{ assetId: string; ticker: string; amountEur: number; timingState: string | null }>;
  hfgExistingAction: string | null;
}

function runCustodiaWithBaselineAllocationTrace(input: DynamicHistoricalReplayInput): { result: DynamicHistoricalReplayResult; traces: AllocationTrace[] } {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const traces: AllocationTrace[] = [];
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput) => {
      const result: PortfolioDecisionResult = originalEvaluate.call(PortfolioDecisionEngine, {
        ...evaluationInput,
        opportunityAllocationPolicy: 'LEGACY'
      });
      const hfgContribution = result.contributions.find(row => row.assetId === HFG_ASSET_ID);
      const hfgPosition = result.existingPositions.find(row => row.assetId === HFG_ASSET_ID || row.id.toUpperCase() === HFG_TICKER);
      traces.push({
        asOfDate: evaluationInput.decision.asOfDate,
        currentCashEur: result.currentCashEur,
        pendingCapitalEur: result.pendingCapitalEur,
        deployableToAssetsEur: result.deployableToAssetsEur,
        recommendedNewInvestmentEur: result.recommendedNewInvestmentEur,
        residualPlannedCashEur: result.residualPlannedCashEur,
        hfgContributionEur: hfgContribution?.amountEur ?? 0,
        contributions: result.contributions.map(row => ({
          assetId: row.assetId,
          ticker: row.ticker,
          amountEur: row.amountEur,
          timingState: row.timingState ?? null
        })),
        hfgExistingAction: hfgPosition?.action ?? null
      });
      return result;
    }) as Evaluate;
    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    return { result, traces };
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}

function signalSummary(signal: Signal | null) {
  if (!signal) return null;
  return {
    signalDate: signal.signalDate,
    executionDate: signal.executionDate,
    action: signal.action,
    executed: signal.executed,
    recommendedAmountEur: signal.recommendedAmountEur,
    notionalEur: signal.notionalEur,
    executionPriceEur: signal.executionPriceEur,
    consensusScore: signal.consensusScore,
    favorableVotes: signal.favorableVotes,
    unfavorableVotes: signal.unfavorableVotes,
    structuralDowntrend: signal.structuralDowntrend,
    timingState: signal.timingState,
    timingSetup: signal.timingSetup,
    timingScore: signal.timingScore,
    suggestedInitialFraction: signal.suggestedInitialFraction,
    positionCurrentReturnPct: signal.positionCurrentReturnPct ?? null,
    positionMfePct: signal.positionMfePct ?? null,
    positionGivebackFromMfePctPoints: signal.positionGivebackFromMfePctPoints ?? null,
    positionDeteriorationStreakSessions: signal.positionDeteriorationStreakSessions ?? null,
    trendProtectionV1Action: signal.trendProtectionV1Action ?? null,
    trendProtectionV1WinnerProtectionArmed: signal.trendProtectionV1WinnerProtectionArmed ?? null,
    trendProtectionV1LoserFailureArmed: signal.trendProtectionV1LoserFailureArmed ?? null,
    trendStructureState: signal.trendStructureState ?? null,
    trendSlope20AnnualizedPct: signal.trendSlope20AnnualizedPct ?? null,
    trendSlope60AnnualizedPct: signal.trendSlope60AnnualizedPct ?? null,
    trendSlopeAccelerationPctPoints: signal.trendSlopeAccelerationPctPoints ?? null,
    trendBreakdown20: signal.trendBreakdown20 ?? null,
    reason: signal.reason
  };
}

function latestPathPointOnOrBefore(result: DynamicHistoricalReplayResult, date: string) {
  return result.equityPath.filter(point => point.date <= date).at(-1) ?? null;
}

function traceOnDate(traces: AllocationTrace[], date: string): AllocationTrace | null {
  return traces.find(trace => trace.asOfDate === date) ?? null;
}

function closeSeries(resultDataset: DynamicHistoricalReplayInput['dataset']) {
  const series = resultDataset.assets.find(asset => asset.assetId === HFG_ASSET_ID);
  if (!series) throw new Error('HFG_DIAGNOSTIC_REAL_SERIES_MISSING');
  return series.bars
    .filter(bar => bar.timestamp.slice(0, 10) >= START_DATE && bar.timestamp.slice(0, 10) <= END_DATE && Number.isFinite(bar.close) && bar.close > 0)
    .map(bar => ({ date: bar.timestamp.slice(0, 10), close: bar.close }));
}

function pct(a: number | null | undefined, b: number | null | undefined): number | null {
  return a != null && b != null && a > 0 ? (b / a - 1) * 100 : null;
}

function classifyUnfundedReady(signal: Signal, trace: AllocationTrace | null, cashEur: number | null) {
  if (signal.executed) return 'EXECUTED';
  if (signal.timingState === 'WAIT') return 'ENTRY_TIMING_WAIT';
  if (signal.timingState !== 'ENTRY_READY' && signal.timingState !== 'ENTRY_STRONG') return 'NOT_ENTRY_READY';
  if ((trace?.hfgContributionEur ?? 0) > 0.01) return 'BASELINE_ALLOCATOR_FUNDED_BUT_LATER_POLICY_OR_EXECUTION_SUPPRESSED';
  if ((trace?.deployableToAssetsEur ?? 0) <= 0.01) return 'NO_DEPLOYABLE_CAPITAL_AT_BASELINE_ALLOCATOR';
  if ((cashEur ?? 0) > 0.01) return 'ALLOCATOR_DID_NOT_ASSIGN_AVAILABLE_CAPITAL_TO_HFG';
  return 'NO_CASH_AND_NO_FUNDED_HFG_CONTRIBUTION';
}

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const baseUrl = 'http://127.0.0.1:3000';
  if (!(await waitForHealth(`${baseUrl}/api/health`, 1500))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('HFG_DIAGNOSTIC_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(RESEARCH_CATALOG, DATA_START_DATE, END_DATE, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 12,
      minimumBars: PROTOCOL.minimumBars,
      maxDataAgeDays: 10,
      currentOpenDiscovery: false
    });
    const dataset = scan.acceptedDataset;
    const nonReal = dataset.assets.filter(asset => asset.provenance?.sourceType !== 'REAL');
    const currentDiscoveryLeak = dataset.assets.filter(asset => asset.assetId.startsWith('OPEN_'));
    const hfgSeries = dataset.assets.find(asset => asset.assetId === HFG_ASSET_ID);
    if (dataset.assets.length < MIN_ACCEPTED_ASSETS) throw new Error(`HFG_DIAGNOSTIC_INSUFFICIENT_REAL_ASSETS:${dataset.assets.length}`);
    if (nonReal.length) throw new Error(`HFG_DIAGNOSTIC_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (currentDiscoveryLeak.length) throw new Error(`HFG_DIAGNOSTIC_CURRENT_DISCOVERY_LEAK:${currentDiscoveryLeak.map(asset => asset.assetId).join(',')}`);
    if (!hfgSeries || hfgSeries.provenance?.sourceType !== 'REAL') throw new Error('HFG_DIAGNOSTIC_HFG_REAL_DATA_REQUIRED');

    const baseInput: DynamicHistoricalReplayInput = {
      dataset,
      catalog: RESEARCH_CATALOG,
      startDate: START_DATE,
      frequency: PROTOCOL.frequency,
      initialCapitalEur: INITIAL_CAPITAL_EUR,
      riskProfile: PROTOCOL.riskProfile,
      horizonYears: PROTOCOL.horizonYears,
      cashBenchmarkMode: PROTOCOL.cashBenchmarkMode,
      cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPctFallback,
      minimumBars: PROTOCOL.minimumBars,
      taxSettings: PROTOCOL.taxSettings,
      initialPortfolio: INITIAL_PORTFOLIO,
      simulationMode: 'CUSTODIA_ENGINE'
    };

    const custodia = runCustodiaWithBaselineAllocationTrace(baseInput);
    const holdOnly = DynamicHistoricalReplayEngine.run({ ...baseInput, simulationMode: 'HOLD_ONLY' });
    const hfgSignals = custodia.result.signals.filter(signal => signal.assetId === HFG_ASSET_ID || signal.ticker.toUpperCase() === HFG_TICKER);
    const initialSignal = hfgSignals.find(signal => signal.isInitialAllocation === true) ?? null;
    const firstExecutedSale = hfgSignals.find(signal => signal.executed && (signal.action === 'REDUCE' || signal.action === 'EXIT')) ?? null;
    const firstExecutedReentry = hfgSignals.find(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD') && !signal.isInitialAllocation && (!firstExecutedSale?.executionDate || (signal.executionDate ?? signal.signalDate) > firstExecutedSale.executionDate)) ?? null;
    const exitSignalDate = firstExecutedSale?.signalDate ?? null;
    const postExitSignals = hfgSignals.filter(signal => !signal.isInitialAllocation && (!exitSignalDate || signal.signalDate > exitSignalDate));
    const readyAfterExit = postExitSignals.filter(signal => signal.timingState === 'ENTRY_READY' || signal.timingState === 'ENTRY_STRONG');
    const unfundedReady = readyAfterExit.filter(signal => !signal.executed).map(signal => {
      const trace = traceOnDate(custodia.traces, signal.signalDate);
      const path = latestPathPointOnOrBefore(custodia.result, signal.signalDate);
      return {
        ...signalSummary(signal),
        cashEur: path?.cashEur ?? null,
        investedEur: path?.investedEur ?? null,
        equityEur: path?.equityEur ?? null,
        baselineAllocator: trace,
        blocker: classifyUnfundedReady(signal, trace, path?.cashEur ?? null)
      };
    });

    const prices = closeSeries(baseInput.dataset);
    const firstPrice = prices[0] ?? null;
    const finalPrice = prices.at(-1) ?? null;
    const postExitPrices = firstExecutedSale?.executionDate ? prices.filter(row => row.date > firstExecutedSale.executionDate!) : [];
    const postExitPeak = postExitPrices.reduce<{ date: string; close: number } | null>((best, row) => !best || row.close > best.close ? row : best, null);
    const exitPrice = firstExecutedSale?.executionPriceEur ?? null;
    const hfgPriceOutcome = {
      firstReplayCloseDate: firstPrice?.date ?? null,
      firstReplayClose: firstPrice?.close ?? null,
      finalCloseDate: finalPrice?.date ?? null,
      finalClose: finalPrice?.close ?? null,
      fullWindowPriceReturnPct: pct(firstPrice?.close, finalPrice?.close),
      exitExecutionPrice: exitPrice,
      postExitPeakDate: postExitPeak?.date ?? null,
      postExitPeakClose: postExitPeak?.close ?? null,
      postExitPeakUpsideVsExitPct: pct(exitPrice, postExitPeak?.close),
      finalPriceReturnVsExitPct: pct(exitPrice, finalPrice?.close)
    };

    const firstSaleTrace = firstExecutedSale ? traceOnDate(custodia.traces, firstExecutedSale.signalDate) : null;
    const firstSalePath = firstExecutedSale ? latestPathPointOnOrBefore(custodia.result, firstExecutedSale.signalDate) : null;
    const diagnosis = {
      initialAllocation: signalSummary(initialSignal),
      initialExit: {
        signal: signalSummary(firstExecutedSale),
        baselineAllocator: firstSaleTrace,
        portfolioAtSignal: firstSalePath ? { cashEur: firstSalePath.cashEur, investedEur: firstSalePath.investedEur, equityEur: firstSalePath.equityEur } : null,
        deteriorationStreakSemantics: {
          implementationMeasuresAssetWeaknessBeforeHoldingStart: true,
          initialManualPositionCanThereforeStartWithNonZeroStreak: true,
          fullStructuralExitRuleRequiresStreak: false,
          note: 'El streak es contexto de mercado del activo y no antigüedad de la posición. Se informa para separar causalidad; no se retunea aquí.'
        }
      },
      reentry: {
        firstExecutedReentry: signalSummary(firstExecutedReentry),
        hfgSignalsAfterFirstExit: postExitSignals.map(signalSummary),
        readyOrStrongAfterExitCount: readyAfterExit.length,
        unfundedReadyOrStrongCount: unfundedReady.length,
        unfundedReadyOrStrong: unfundedReady
      },
      winnerProtection: {
        signalsWithWinnerProtectionArmed: hfgSignals.filter(signal => signal.trendProtectionV1WinnerProtectionArmed === true).map(signalSummary),
        signalsWithTrendProtectionReduceOrExit: hfgSignals.filter(signal => signal.trendProtectionV1Action === 'REDUCE' || signal.trendProtectionV1Action === 'EXIT').map(signalSummary),
        interpretation: 'Descriptivo sobre muestra consumida. No autoriza modificar thresholds de MFE/giveback/protección.'
      },
      economicPolicyCounterfactual: {
        custodiaFinalValueEur: custodia.result.finalValueEur,
        custodiaReturnPct: custodia.result.totalReturnPct,
        custodiaMaxDrawdownPct: custodia.result.decisionPathMaxDrawdownPct,
        holdInitialPortfolioFinalValueEur: holdOnly.finalValueEur,
        holdInitialPortfolioReturnPct: holdOnly.totalReturnPct,
        holdInitialPortfolioMaxDrawdownPct: holdOnly.decisionPathMaxDrawdownPct,
        holdMinusCustodiaFinalEur: holdOnly.finalValueEur - custodia.result.finalValueEur,
        holdMinusCustodiaReturnPctPoints: holdOnly.totalReturnPct - custodia.result.totalReturnPct,
        meaning: 'Contrafactual descriptivo de política económica sobre una muestra ya consumida; no es evidencia de promoción.'
      },
      hfgPriceOutcome
    };

    const result = {
      version: VERSION,
      status: 'DIAGNOSTIC_COMPLETE_CONSUMED_SAMPLE_NO_PROMOTION',
      generatedAt: new Date().toISOString(),
      protocol: PROTOCOL,
      dataQuality: {
        catalogAssets: RESEARCH_CATALOG.length,
        scanned: scan.scanned,
        acceptedRealAssets: dataset.assets.length,
        rejected: scan.rejected,
        allAcceptedProvenanceReal: nonReal.length === 0,
        currentYahooDiscoveryUsed: false,
        currentDiscoveryLeakCount: currentDiscoveryLeak.length,
        hfgRealBars: hfgSeries.bars.length,
        hfgProvenance: hfgSeries.provenance
      },
      replaySummary: {
        decisions: custodia.result.decisions,
        materialSignals: custodia.result.materialSignals,
        executedBuys: custodia.result.executedBuys,
        executedAdds: custodia.result.executedAdds,
        executedReductions: custodia.result.executedReductions,
        executedExits: custodia.result.executedExits,
        totalFeesEur: custodia.result.totalFeesEur,
        totalEstimatedTaxEur: custodia.result.totalEstimatedTaxEur,
        cashInterestEur: custodia.result.cashInterestEur,
        operationalParity: custodia.result.operationalParity
      },
      diagnosis,
      interpretationContract: {
        sampleIsConsumed: true,
        canDiagnoseArchitectureSignalAndPolicy: true,
        canRetuneThresholds: false,
        canPromoteProductionPolicy: false,
        productionAllocationPolicyRemains: 'LEGACY',
        productionArchitectureRemains: 'CORE_ARCHITECTURE_V1',
        forwardRiskProductionStateUnchanged: true,
        futureForwardFrozenFilesTouched: false,
        nextStepIfHypothesisEmerges: 'Freeze a candidate rule before opening a fresh/blind/out-of-sample validation; do not optimize it on HFG.'
      },
      notes: [
        'HFG is injected only as research metadata for this consumed historical case. It is not added to the production seed/universe.',
        'All market bars must be REAL. Current Yahoo Search/Lookup discovery is disabled, so this diagnostic does not pretend to reconstruct a historical market universe.',
        'Custodia uses the existing causal replay and CORE_ARCHITECTURE_V1 wrapper; execution remains after signal/NEXT_OPEN.',
        'The HOLD_ONLY arm preserves the same initial HFG + cash state and cash remuneration, but disables Custodia decisions. It is a descriptive economic-policy counterfactual only.',
        'Outcome-informed post-exit peak statistics are explicitly diagnostic on a consumed sample and cannot be used to tune or promote a new rule.'
      ]
    };
    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
