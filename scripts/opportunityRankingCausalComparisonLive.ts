import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult
} from '../src/investment/decision';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';
import { runDynamicReplayWithSelectionQualityExperiment } from '../src/investment/decision/replaySelectionQualityExperiment';
import { runDynamicReplayWithSlopeSelectionExperiment } from '../src/investment/decision/replaySlopeSelectionExperiment';

const MARKER = 'OPPORTUNITY_RANKING_CAUSAL_COMPARISON_RESULT';
const VERSION = 'OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1' as const;
const DATA_START_DATE = '2014-09-01';
const END_DATE = '2026-09-01';
const MIN_ACCEPTED_ASSETS = 30;
const WINDOWS = [
  { id: 'LONG_10Y', startDate: '2016-09-01' },
  { id: 'MEDIUM_6Y', startDate: '2020-09-01' },
  { id: 'RECENT_3Y', startDate: '2023-09-01' }
] as const;
const ARMS = ['LEGACY', 'QUALITY_V1', 'SLOPE_V1'] as const;
type Arm = typeof ARMS[number];

const PROTOCOL = {
  frozenAt: '2026-09-08',
  productionArchitecture: 'CORE_ARCHITECTURE_V1',
  dataStartDate: DATA_START_DATE,
  endDate: END_DATE,
  windows: WINDOWS,
  frequency: 'MONTHLY',
  initialCapitalEur: 13_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  cashBenchmarkAnnualPctFallback: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
  currentYahooDiscoveryInHistoricalComparison: false,
  arms: ARMS,
  onlyAllowedDifference: 'PORTFOLIO_CANDIDATE_GATE_RELATIVE_RANKING_AMONG_ALREADY_ELIGIBLE_CANDIDATES',
  productionPromotionAllowedFromThisHistoricalDiagnostic: false,
  residualLimitation: 'CURRENT_CATALOG_SURVIVORSHIP_NOT_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

function yearsBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.max(0, (end - start) / 86_400_000 / 365.2425);
}

function cagrPct(result: DynamicHistoricalReplayResult): number | null {
  const years = yearsBetween(result.startDate, result.endDate);
  if (!(years > 0) || !(result.initialCapitalEur > 0) || !(result.finalValueEur > 0)) return null;
  return (Math.pow(result.finalValueEur / result.initialCapitalEur, 1 / years) - 1) * 100;
}

function acquisitions(result: DynamicHistoricalReplayResult): string[] {
  return result.signals
    .filter(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD'))
    .map(signal => `${signal.signalDate}|${signal.action}|${signal.assetId}`);
}

function resultMetrics(result: DynamicHistoricalReplayResult) {
  return {
    finalValueEur: result.finalValueEur,
    totalReturnPct: result.totalReturnPct,
    cagrPct: cagrPct(result),
    maxDrawdownPct: result.decisionPathMaxDrawdownPct,
    totalFeesEur: result.totalFeesEur,
    totalEstimatedTaxEur: result.totalEstimatedTaxEur,
    cashInterestEur: result.cashInterestEur,
    executedBuys: result.executedBuys,
    executedAdds: result.executedAdds,
    executedReductions: result.executedReductions,
    executedExits: result.executedExits,
    materialSignals: result.materialSignals,
    structuralCoreBenchmarkTicker: result.structuralCoreBenchmarkTicker,
    structuralCoreBenchmarkFinalEur: result.structuralCoreBenchmarkFinalEur,
    excessFinalEurVsStructuralCore: result.excessFinalEurVsStructuralCore,
    beatsStructuralCoreBenchmark: result.beatsStructuralCoreBenchmark,
    acquisitionSignatures: acquisitions(result)
  };
}

function runArm(input: DynamicHistoricalReplayInput, arm: Arm): DynamicHistoricalReplayResult {
  if (arm === 'QUALITY_V1') return runDynamicReplayWithSelectionQualityExperiment(input);
  if (arm === 'SLOPE_V1') return runDynamicReplayWithSlopeSelectionExperiment(input);
  return runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
}

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function symmetricDifferenceCount(a: string[], b: string[]): number {
  const aa = new Set(a);
  const bb = new Set(b);
  let count = 0;
  for (const value of aa) if (!bb.has(value)) count++;
  for (const value of bb) if (!aa.has(value)) count++;
  return count;
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('OPPORTUNITY_RANKING_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(
      EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
      DATA_START_DATE,
      END_DATE,
      {
        forceRefresh: false,
        concurrency: 3,
        maxSelected: 12,
        minimumBars: PROTOCOL.minimumBars,
        maxDataAgeDays: 10,
        currentOpenDiscovery: false
      }
    );

    const dataset = scan.acceptedDataset;
    const nonReal = dataset.assets.filter(asset => asset.provenance?.sourceType !== 'REAL');
    const currentDiscoveryLeak = dataset.assets.filter(asset => asset.assetId.startsWith('OPEN_'));
    if (dataset.assets.length < MIN_ACCEPTED_ASSETS) throw new Error(`OPPORTUNITY_RANKING_INSUFFICIENT_REAL_ASSETS:${dataset.assets.length}`);
    if (nonReal.length) throw new Error(`OPPORTUNITY_RANKING_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (currentDiscoveryLeak.length) throw new Error(`OPPORTUNITY_RANKING_CURRENT_DISCOVERY_LEAK:${currentDiscoveryLeak.map(asset => asset.assetId).join(',')}`);

    const byWindow: any[] = [];
    for (const window of WINDOWS) {
      const input: DynamicHistoricalReplayInput = {
        dataset,
        catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        startDate: window.startDate,
        frequency: PROTOCOL.frequency,
        initialCapitalEur: PROTOCOL.initialCapitalEur,
        riskProfile: PROTOCOL.riskProfile,
        horizonYears: PROTOCOL.horizonYears,
        cashBenchmarkMode: PROTOCOL.cashBenchmarkMode,
        cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPctFallback,
        minimumBars: PROTOCOL.minimumBars,
        taxSettings: PROTOCOL.taxSettings,
        simulationMode: 'CUSTODIA_ENGINE'
      };

      const results = {} as Record<Arm, ReturnType<typeof resultMetrics>>;
      for (const arm of ARMS) results[arm] = resultMetrics(runArm(input, arm));
      const legacy = results.LEGACY;
      const comparisons = (['QUALITY_V1', 'SLOPE_V1'] as const).map(arm => ({
        arm,
        finalDeltaEurVsLegacy: results[arm].finalValueEur - legacy.finalValueEur,
        returnDeltaPctPointsVsLegacy: results[arm].totalReturnPct - legacy.totalReturnPct,
        drawdownImprovementPctPointsVsLegacy: legacy.maxDrawdownPct - results[arm].maxDrawdownPct,
        feeDeltaEurVsLegacy: results[arm].totalFeesEur - legacy.totalFeesEur,
        taxDeltaEurVsLegacy: results[arm].totalEstimatedTaxEur - legacy.totalEstimatedTaxEur,
        acquisitionSignatureSymmetricDifference: symmetricDifferenceCount(results[arm].acquisitionSignatures, legacy.acquisitionSignatures)
      }));
      byWindow.push({ id: window.id, startDate: window.startDate, endDate: END_DATE, results, comparisons });
    }

    const aggregate = (['QUALITY_V1', 'SLOPE_V1'] as const).map(arm => {
      const rows = byWindow.map(window => window.comparisons.find((row: any) => row.arm === arm));
      const finalDeltas = rows.map((row: any) => row.finalDeltaEurVsLegacy as number);
      const ddDeltas = rows.map((row: any) => row.drawdownImprovementPctPointsVsLegacy as number);
      return {
        arm,
        finalValueWinsVsLegacy: finalDeltas.filter(value => value > 0).length,
        finalValueTiesVsLegacy: finalDeltas.filter(value => Math.abs(value) < 0.01).length,
        drawdownWinsVsLegacy: ddDeltas.filter(value => value > 0).length,
        medianFinalDeltaEurVsLegacy: median(finalDeltas),
        worstFinalDeltaEurVsLegacy: Math.min(...finalDeltas),
        medianDrawdownImprovementPctPointsVsLegacy: median(ddDeltas),
        totalAcquisitionSignatureDifferenceVsLegacy: rows.reduce((sum: number, row: any) => sum + row.acquisitionSignatureSymmetricDifference, 0)
      };
    });

    const result = {
      version: VERSION,
      status: 'PASS_HISTORICAL_DIAGNOSTIC_ONLY',
      generatedAt: new Date().toISOString(),
      protocol: PROTOCOL,
      dataQuality: {
        canonicalCatalogAssets: EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length,
        scanned: scan.scanned,
        acceptedRealAssets: dataset.assets.length,
        rejected: scan.rejected,
        allAcceptedProvenanceReal: nonReal.length === 0,
        currentYahooDiscoveryUsed: false,
        currentDiscoveryLeakCount: currentDiscoveryLeak.length
      },
      byWindow,
      aggregate,
      interpretationContract: {
        comparisonPurpose: 'COMPARE_WHAT_TO_BUY_RANKING_ONLY',
        historicalResultCanChangeProduction: false,
        productionPolicyRemains: 'LEGACY',
        futureForwardRequiredBeforeAnyPromotion: true,
        noThresholdTuningOnTheseWindows: true,
        retainedForwardRiskV8Finding: 'V8_PREDICTIVE_DOWNSIDE_SIGNAL_REMAINS_AVAILABLE_FOR_LATER_SHADOW_DIAGNOSTIC_NOT_USED_HERE'
      },
      limitations: [
        'Current Yahoo discovery is disabled in the historical comparison.',
        'The catalogue is the known current canonical catalogue, so survivorship bias is not fully removed without a point-in-time instrument master including delistings.',
        'These historical windows are diagnostic and may overlap prior development evidence; they cannot authorize production promotion.',
        'QUALITY_V1 and SLOPE_V1 alter only relative ranking among candidates already eligible under the same hard gates.'
      ]
    };

    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('OPPORTUNITY_RANKING_CAUSAL_COMPARISON_FATAL', error);
  process.exitCode = 1;
});
