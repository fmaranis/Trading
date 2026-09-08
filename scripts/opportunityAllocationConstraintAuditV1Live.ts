import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  CashBenchmarkService,
  CurrentOpportunityAlertEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  type CurrentOpportunityAlert,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult
} from '../src/investment/decision';
import {
  PortfolioDecisionEngine,
  qualityAllocationMultiplierV1,
  type OpportunityAllocationPolicy,
  type PortfolioDecisionResult
} from '../src/investment/decision/portfolioDecisionEngine';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';

const MARKER = 'OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1_RESULT';
const VERSION = 'OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1' as const;
const DIAGNOSTIC_STAGE = 'ALLOCATION_CONSTRAINT_AUDIT_V1' as const;
const DATA_START_DATE = '2014-09-01';
const END_DATE = '2026-09-01';
const MIN_ACCEPTED_ASSETS = 30;
const WINDOWS = [
  { id: 'LONG_10Y', startDate: '2016-09-01' },
  { id: 'MEDIUM_6Y', startDate: '2020-09-01' },
  { id: 'RECENT_3Y', startDate: '2023-09-01' }
] as const;
const POLICIES: readonly OpportunityAllocationPolicy[] = ['LEGACY', 'QUALITY_ALLOCATION_BRIDGE_V1'];

type Policy = typeof POLICIES[number];
type Evaluate = typeof PortfolioDecisionEngine.evaluate;

type BindingConstraint =
  | 'TIMING_CAP'
  | 'STAGE_CAP'
  | 'TIMING_AND_STAGE_EQUAL'
  | 'TARGET_GAP'
  | 'DOWNSTREAM_CAPITAL_OR_CATEGORY_LIMIT'
  | 'UNCLASSIFIED';

interface ContributionTraceRow {
  assetId: string;
  amountEur: number;
  multiplier: number;
  priorityScore: number | null;
  currentAssetValueEur: number;
  targetAssetValueEur: number | null;
  executableTargetAssetValueEur: number | null;
  suggestedInitialFraction: number | null;
  portfolioShareCapPct: number | null;
  positionStage: string | null;
  bindingConstraint: BindingConstraint;
}

interface AllocationTrace {
  sequence: number;
  asOfDate: string;
  currentCashEur: number;
  pendingCapitalEur: number;
  totalPlannedCapitalEur: number;
  targetCashEur: number;
  deployableToAssetsEur: number;
  plannedRotationProceedsEur: number;
  recommendedNewInvestmentEur: number;
  residualPlannedCashEur: number;
  availablePortfolioSlots: number;
  opportunityCount: number;
  qualityModulatedOpportunityCount: number;
  qualityChangedOpportunityOrder: boolean;
  legacyTopOpportunityAssetId: string | null;
  qualityTopOpportunityAssetId: string | null;
  contributions: ContributionTraceRow[];
}

interface PolicyRun {
  policy: Policy;
  result: DynamicHistoricalReplayResult;
  traces: AllocationTrace[];
}

const PROTOCOL = {
  frozenAt: '2026-09-08',
  purpose: 'MEASURE_WHICH_EXISTING_ALLOCATOR_CONSTRAINTS_COMPRESS_QUALITY_SIGNAL_REACH',
  productionArchitecture: 'CORE_ARCHITECTURE_V1',
  productionPolicy: 'LEGACY',
  experimentalPolicy: 'QUALITY_ALLOCATION_BRIDGE_V1',
  bridgeFormulaUnchanged: 'clamp(1 + candidateQualityAdjustment(reliability, opportunity)/100, 0.85, 1.15)',
  gateSelectionPolicy: 'LEGACY_UNCHANGED',
  hardGatesUnchanged: true,
  starterBuildCapsSlotsRotationUnchanged: true,
  monthlyDecisionCadenceIsNotRecurringContribution: true,
  replayHistoricalPortfolioPendingCapitalSource: 'stagedCapitalPlan.availableEur',
  replayHistoricalPortfolioCurrentlySetsPendingCapitalEur: 0,
  noPolicyParameterChangesForThisAudit: true,
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
  currentYahooDiscoveryInHistoricalDiagnostic: false,
  productionPromotionAllowedFromConsumedWindows: false,
  noCoefficientOrThresholdTuningOnConsumedWindows: true,
  residualLimitation: 'CURRENT_CATALOG_SURVIVORSHIP_NOT_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function mean(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function opportunityLevelWeight(level: CurrentOpportunityAlert['level']): number {
  return level === 'HIGH_CONVICTION' ? 4 : level === 'GOOD_ENTRY' ? 2.5 : 1;
}

function legacyOpportunityPriority(alert: CurrentOpportunityAlert): number {
  const excess = Math.max(0, Math.min(25, alert.excessVsCashPctPoints ?? 0));
  const consensus = Math.max(0, alert.consensusScore);
  const volatilityPenalty = Math.max(1, (alert.annualizedVolatilityPct ?? 20) / 20);
  return (opportunityLevelWeight(alert.level) + consensus * 0.35 + excess * 0.08) / volatilityPenalty;
}

function opportunityOrderAudit(alerts: CurrentOpportunityAlert[]) {
  const legacy = [...alerts]
    .map(alert => ({ assetId: alert.assetId, priority: legacyOpportunityPriority(alert) }))
    .sort((a, b) => b.priority - a.priority || a.assetId.localeCompare(b.assetId));
  const quality = [...alerts]
    .map(alert => ({
      assetId: alert.assetId,
      priority: legacyOpportunityPriority(alert) * qualityAllocationMultiplierV1(alert.reliabilityScore, alert.opportunityScore),
      multiplier: qualityAllocationMultiplierV1(alert.reliabilityScore, alert.opportunityScore)
    }))
    .sort((a, b) => b.priority - a.priority || a.assetId.localeCompare(b.assetId));
  return {
    opportunityCount: alerts.length,
    qualityModulatedOpportunityCount: quality.filter(row => Math.abs(row.multiplier - 1) > 1e-9).length,
    qualityChangedOpportunityOrder: JSON.stringify(legacy.map(row => row.assetId)) !== JSON.stringify(quality.map(row => row.assetId)),
    legacyTopOpportunityAssetId: legacy[0]?.assetId ?? null,
    qualityTopOpportunityAssetId: quality[0]?.assetId ?? null
  };
}

function classifyContributionConstraint(row: PortfolioDecisionResult['contributions'][number], totalPlannedCapitalEur: number): BindingConstraint {
  const target = row.targetAssetValueEur;
  const executable = row.executableTargetAssetValueEur;
  const timingFraction = row.suggestedInitialFraction;
  const stagePct = row.portfolioShareCapPct;
  const current = Math.max(0, row.currentAssetValueEur ?? 0);
  if (target == null || executable == null || timingFraction == null || stagePct == null) return 'UNCLASSIFIED';
  const timingCap = Math.max(0, target * timingFraction);
  const stageCap = Math.max(0, totalPlannedCapitalEur * stagePct / 100);
  const expected = Math.min(timingCap, stageCap);
  const tolerance = Math.max(0.02, expected * 1e-6);
  if (Math.abs(executable - expected) <= tolerance) {
    if (Math.abs(timingCap - stageCap) <= tolerance) return 'TIMING_AND_STAGE_EQUAL';
    if (timingCap < stageCap) return 'TIMING_CAP';
    return 'STAGE_CAP';
  }
  const targetGap = Math.max(0, executable - current);
  if (Math.abs(row.amountEur - targetGap) <= Math.max(0.02, targetGap * 1e-6)) return 'TARGET_GAP';
  if (row.amountEur < targetGap - 0.02) return 'DOWNSTREAM_CAPITAL_OR_CATEGORY_LIMIT';
  return 'UNCLASSIFIED';
}

function acquisitionMap(result: DynamicHistoricalReplayResult, executedOnly: boolean): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const signal of result.signals) {
    if (signal.action !== 'BUY' && signal.action !== 'ADD') continue;
    if (!(signal.recommendedAmountEur > 0.01)) continue;
    if (executedOnly && !signal.executed) continue;
    const amount = executedOnly ? signal.notionalEur : signal.recommendedAmountEur;
    const row = out.get(signal.signalDate) ?? new Map<string, number>();
    row.set(signal.assetId, (row.get(signal.assetId) ?? 0) + amount);
    out.set(signal.signalDate, row);
  }
  return out;
}

function mapSetEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a.keys()) if (!b.has(key)) return false;
  return true;
}

function mapAmountEqual(a: Map<string, number>, b: Map<string, number>, tolerance = 0.01): boolean {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) if (Math.abs((a.get(key) ?? 0) - (b.get(key) ?? 0)) > tolerance) return false;
  return true;
}

function totalAbsoluteMapDelta(a: Map<string, number>, b: Map<string, number>): number {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let total = 0;
  for (const key of keys) total += Math.abs((a.get(key) ?? 0) - (b.get(key) ?? 0));
  return total;
}

function compareAcquisitionMaps(a: Map<string, Map<string, number>>, b: Map<string, Map<string, number>>) {
  const dates = [...new Set([...a.keys(), ...b.keys()])].sort();
  const changedDates: string[] = [];
  let assetSetChangedDates = 0;
  let amountOnlyChangedDates = 0;
  let totalAbsoluteAmountDeltaEur = 0;
  let maxDateAbsoluteAmountDeltaEur = 0;
  for (const date of dates) {
    const aa = a.get(date) ?? new Map<string, number>();
    const bb = b.get(date) ?? new Map<string, number>();
    if (mapAmountEqual(aa, bb)) continue;
    changedDates.push(date);
    if (!mapSetEqual(aa, bb)) assetSetChangedDates += 1;
    else amountOnlyChangedDates += 1;
    const delta = totalAbsoluteMapDelta(aa, bb);
    totalAbsoluteAmountDeltaEur += delta;
    maxDateAbsoluteAmountDeltaEur = Math.max(maxDateAbsoluteAmountDeltaEur, delta);
  }
  return { changedDates: changedDates.length, assetSetChangedDates, amountOnlyChangedDates, totalAbsoluteAmountDeltaEur, maxDateAbsoluteAmountDeltaEur, changedDatesSample: changedDates.slice(0, 16) };
}

function traceMap(trace: AllocationTrace): Map<string, number> {
  return new Map(trace.contributions.map(row => [row.assetId, row.amountEur]));
}

function compareTraces(legacy: AllocationTrace[], bridge: AllocationTrace[]) {
  const length = Math.min(legacy.length, bridge.length);
  let decisionCountParityViolations = Math.abs(legacy.length - bridge.length);
  let changedDecisionGates = 0;
  let assetSetChangedDecisionGates = 0;
  let amountOnlyChangedDecisionGates = 0;
  let totalAbsolutePlanDeltaEur = 0;
  let maxDecisionAbsolutePlanDeltaEur = 0;
  const changedDates: string[] = [];
  for (let index = 0; index < length; index++) {
    const aa = traceMap(legacy[index]);
    const bb = traceMap(bridge[index]);
    if (legacy[index].asOfDate !== bridge[index].asOfDate) decisionCountParityViolations += 1;
    if (mapAmountEqual(aa, bb)) continue;
    changedDecisionGates += 1;
    changedDates.push(legacy[index].asOfDate);
    if (!mapSetEqual(aa, bb)) assetSetChangedDecisionGates += 1;
    else amountOnlyChangedDecisionGates += 1;
    const delta = totalAbsoluteMapDelta(aa, bb);
    totalAbsolutePlanDeltaEur += delta;
    maxDecisionAbsolutePlanDeltaEur = Math.max(maxDecisionAbsolutePlanDeltaEur, delta);
  }
  return { decisionCountParityViolations, changedDecisionGates, assetSetChangedDecisionGates, amountOnlyChangedDecisionGates, totalAbsolutePlanDeltaEur, maxDecisionAbsolutePlanDeltaEur, changedDatesSample: changedDates.slice(0, 16) };
}

function constraintStats(traces: AllocationTrace[]) {
  const rows = traces.flatMap(trace => trace.contributions);
  const counts: Record<BindingConstraint, number> = {
    TIMING_CAP: 0,
    STAGE_CAP: 0,
    TIMING_AND_STAGE_EQUAL: 0,
    TARGET_GAP: 0,
    DOWNSTREAM_CAPITAL_OR_CATEGORY_LIMIT: 0,
    UNCLASSIFIED: 0
  };
  for (const row of rows) counts[row.bindingConstraint] += 1;
  const utilization = traces
    .filter(trace => trace.deployableToAssetsEur > 0.01)
    .map(trace => Math.min(1, trace.recommendedNewInvestmentEur / trace.deployableToAssetsEur));
  return {
    decisionGates: traces.length,
    pendingCapitalPositiveDecisionGates: traces.filter(trace => trace.pendingCapitalEur > 0.01).length,
    totalPendingCapitalEurAcrossDecisionObservations: traces.reduce((sum, trace) => sum + trace.pendingCapitalEur, 0),
    deployableCapitalPositiveDecisionGates: traces.filter(trace => trace.deployableToAssetsEur > 0.01).length,
    opportunityPositiveDecisionGates: traces.filter(trace => trace.opportunityCount > 0).length,
    qualityChangedOpportunityOrderDecisionGates: traces.filter(trace => trace.qualityChangedOpportunityOrder).length,
    contributionPositiveDecisionGates: traces.filter(trace => trace.contributions.length > 0).length,
    noContributionDespiteDeployableAndOpportunityDecisionGates: traces.filter(trace => trace.deployableToAssetsEur > 0.01 && trace.opportunityCount > 0 && trace.contributions.length === 0).length,
    contributionRows: rows.length,
    bindingConstraintCounts: counts,
    meanDeployableUtilizationPct: mean(utilization.map(value => value * 100)),
    medianDeployableUtilizationPct: median(utilization.map(value => value * 100)),
    opportunityObservations: traces.reduce((sum, trace) => sum + trace.opportunityCount, 0),
    qualityModulatedOpportunityObservations: traces.reduce((sum, trace) => sum + trace.qualityModulatedOpportunityCount, 0)
  };
}

function resultMetrics(result: DynamicHistoricalReplayResult) {
  return {
    finalValueEur: result.finalValueEur,
    totalReturnPct: result.totalReturnPct,
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
    beatsStructuralCoreBenchmark: result.beatsStructuralCoreBenchmark
  };
}

function runPolicy(input: DynamicHistoricalReplayInput, policy: Policy): PolicyRun {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const traces: AllocationTrace[] = [];
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput) => {
      const effectiveCash = evaluationInput.cashBenchmarkAnnualPct ?? CashBenchmarkService.load();
      const opportunityAudit = opportunityOrderAudit(CurrentOpportunityAlertEngine.evaluate(evaluationInput.scan, effectiveCash));
      const result: PortfolioDecisionResult = originalEvaluate.call(PortfolioDecisionEngine, { ...evaluationInput, opportunityAllocationPolicy: policy });
      traces.push({
        sequence: traces.length,
        asOfDate: evaluationInput.decision.asOfDate,
        currentCashEur: result.currentCashEur,
        pendingCapitalEur: result.pendingCapitalEur,
        totalPlannedCapitalEur: result.totalPlannedCapitalEur,
        targetCashEur: result.targetCashEur,
        deployableToAssetsEur: result.deployableToAssetsEur,
        plannedRotationProceedsEur: result.plannedRotationProceedsEur,
        recommendedNewInvestmentEur: result.recommendedNewInvestmentEur,
        residualPlannedCashEur: result.residualPlannedCashEur,
        availablePortfolioSlots: result.availablePortfolioSlots,
        ...opportunityAudit,
        contributions: result.contributions
          .map(row => ({
            assetId: row.assetId,
            amountEur: row.amountEur,
            multiplier: row.qualityAllocationMultiplier ?? 1,
            priorityScore: row.priorityScore ?? null,
            currentAssetValueEur: Math.max(0, row.currentAssetValueEur ?? 0),
            targetAssetValueEur: row.targetAssetValueEur ?? null,
            executableTargetAssetValueEur: row.executableTargetAssetValueEur ?? null,
            suggestedInitialFraction: row.suggestedInitialFraction ?? null,
            portfolioShareCapPct: row.portfolioShareCapPct ?? null,
            positionStage: row.positionStage ?? null,
            bindingConstraint: classifyContributionConstraint(row, result.totalPlannedCapitalEur)
          }))
          .sort((a, b) => a.assetId.localeCompare(b.assetId))
      });
      return result;
    }) as Evaluate;
    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    return { policy, result, traces };
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
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
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('OPPORTUNITY_ALLOCATION_CONSTRAINT_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);
    const scan = await AssetUniverseScanner.scan(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, DATA_START_DATE, END_DATE, {
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
    if (dataset.assets.length < MIN_ACCEPTED_ASSETS) throw new Error(`OPPORTUNITY_ALLOCATION_CONSTRAINT_INSUFFICIENT_REAL_ASSETS:${dataset.assets.length}`);
    if (nonReal.length) throw new Error(`OPPORTUNITY_ALLOCATION_CONSTRAINT_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (currentDiscoveryLeak.length) throw new Error(`OPPORTUNITY_ALLOCATION_CONSTRAINT_CURRENT_DISCOVERY_LEAK:${currentDiscoveryLeak.map(asset => asset.assetId).join(',')}`);

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
      const legacy = runPolicy(input, 'LEGACY');
      const bridge = runPolicy(input, 'QUALITY_ALLOCATION_BRIDGE_V1');
      const traceComparison = compareTraces(legacy.traces, bridge.traces);
      const plannedComparison = compareAcquisitionMaps(acquisitionMap(legacy.result, false), acquisitionMap(bridge.result, false));
      const executedComparison = compareAcquisitionMaps(acquisitionMap(legacy.result, true), acquisitionMap(bridge.result, true));
      byWindow.push({
        id: window.id,
        startDate: window.startDate,
        endDate: END_DATE,
        legacy: resultMetrics(legacy.result),
        bridge: resultMetrics(bridge.result),
        legacyConstraintStats: constraintStats(legacy.traces),
        bridgeConstraintStats: constraintStats(bridge.traces),
        traceComparison,
        plannedAcquisitionComparison: plannedComparison,
        executedAcquisitionComparison: executedComparison,
        economics: {
          finalDeltaEurVsLegacy: bridge.result.finalValueEur - legacy.result.finalValueEur,
          returnDeltaPctPointsVsLegacy: bridge.result.totalReturnPct - legacy.result.totalReturnPct,
          drawdownImprovementPctPointsVsLegacy: legacy.result.decisionPathMaxDrawdownPct - bridge.result.decisionPathMaxDrawdownPct,
          feeDeltaEurVsLegacy: bridge.result.totalFeesEur - legacy.result.totalFeesEur,
          taxDeltaEurVsLegacy: bridge.result.totalEstimatedTaxEur - legacy.result.totalEstimatedTaxEur
        }
      });
    }

    const finalDeltas = byWindow.map(window => window.economics.finalDeltaEurVsLegacy as number);
    const ddDeltas = byWindow.map(window => window.economics.drawdownImprovementPctPointsVsLegacy as number);
    const result = {
      version: VERSION,
      diagnosticStage: DIAGNOSTIC_STAGE,
      status: 'PASS_ALLOCATION_CONSTRAINT_AUDIT_ONLY',
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
      aggregate: {
        allocationPlanChangedDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.traceComparison.changedDecisionGates, 0),
        allocationAssetSetChangedDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.traceComparison.assetSetChangedDecisionGates, 0),
        allocationAmountOnlyChangedDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.traceComparison.amountOnlyChangedDecisionGates, 0),
        plannedAcquisitionDatesChangedAcrossWindows: byWindow.reduce((sum, window) => sum + window.plannedAcquisitionComparison.changedDates, 0),
        executedAcquisitionDatesChangedAcrossWindows: byWindow.reduce((sum, window) => sum + window.executedAcquisitionComparison.changedDates, 0),
        totalAbsoluteExecutedNotionalDeltaEurAcrossWindows: byWindow.reduce((sum, window) => sum + window.executedAcquisitionComparison.totalAbsoluteAmountDeltaEur, 0),
        pendingCapitalPositiveDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.pendingCapitalPositiveDecisionGates, 0),
        deployableCapitalPositiveDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.deployableCapitalPositiveDecisionGates, 0),
        opportunityPositiveDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.opportunityPositiveDecisionGates, 0),
        contributionPositiveDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.contributionPositiveDecisionGates, 0),
        noContributionDespiteDeployableAndOpportunityDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.noContributionDespiteDeployableAndOpportunityDecisionGates, 0),
        qualityChangedOpportunityOrderDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyConstraintStats.qualityChangedOpportunityOrderDecisionGates, 0),
        finalValueWinsVsLegacy: finalDeltas.filter(value => value > 0).length,
        finalValueLossesVsLegacy: finalDeltas.filter(value => value < 0).length,
        medianFinalDeltaEurVsLegacy: median(finalDeltas),
        worstFinalDeltaEurVsLegacy: Math.min(...finalDeltas),
        bestFinalDeltaEurVsLegacy: Math.max(...finalDeltas),
        medianDrawdownImprovementPctPointsVsLegacy: median(ddDeltas),
        decisionCountParityViolations: byWindow.reduce((sum, window) => sum + window.traceComparison.decisionCountParityViolations, 0)
      },
      interpretationContract: {
        productionPolicyRemains: 'LEGACY',
        historicalAuditCanChangeProduction: false,
        bridgeAlreadyClosedAsInsufficientFromPriorRun: true,
        thisRunOnlyDiagnosesConstraints: true,
        monthlyDecisionCadenceMustNotBeDescribedAsMonthlyContribution: true,
        noBridgeAmplificationOrRetuningAllowed: true,
        retainedForwardRiskV8Finding: 'PREDICTIVE_DOWNSIDE_INFORMATION_RETAINED_BUT_NOT_USED_IN_THIS_AUDIT'
      },
      notes: [
        'This reuses the existing QUALITY bridge validation button; no new product section or productive engine is created.',
        'The historical portfolio builder currently sets stagedCapitalPlan.availableEur = 0, so MONTHLY is a decision cadence, not recurring external monthly capital.',
        'The audit measures how deployable cash, timing/stage caps, portfolio/category limits and final execution compress a bounded QUALITY priority modulation.',
        'The QUALITY multiplier and all production gates/caps remain frozen; this audit cannot authorize promotion or tuning.'
      ]
    };
    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('OPPORTUNITY_ALLOCATION_CONSTRAINT_AUDIT_FATAL', error);
  process.exitCode = 1;
});
