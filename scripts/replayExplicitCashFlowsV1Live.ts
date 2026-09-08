import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult,
  type DynamicReplayExternalCashFlow
} from '../src/investment/decision';
import {
  PortfolioDecisionEngine,
  type OpportunityAllocationPolicy,
  type PortfolioDecisionResult
} from '../src/investment/decision/portfolioDecisionEngine';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';

const MARKER = 'REPLAY_EXPLICIT_CASH_FLOWS_V1_RESULT';
const VERSION = 'REPLAY_EXPLICIT_CASH_FLOWS_V1' as const;
const DATA_START_DATE = '2014-09-01';
const END_DATE = '2026-09-01';
const MIN_ACCEPTED_ASSETS = 30;
const EXPLICIT_MONTHLY_CONTRIBUTION_EUR = 1_000;
const WINDOWS = [
  { id: 'LONG_10Y', startDate: '2016-09-01' },
  { id: 'MEDIUM_6Y', startDate: '2020-09-01' },
  { id: 'RECENT_3Y', startDate: '2023-09-01' }
] as const;

type Evaluate = typeof PortfolioDecisionEngine.evaluate;
type ArmId = 'CLOSED_LEGACY' | 'EXPLICIT_LEGACY' | 'EXPLICIT_QUALITY';

interface AllocationTrace {
  asOfDate: string;
  currentCashEur: number;
  pendingCapitalEur: number;
  deployableToAssetsEur: number;
  recommendedNewInvestmentEur: number;
  contributions: Array<{ assetId: string; amountEur: number }>;
}

interface ArmRun {
  arm: ArmId;
  policy: OpportunityAllocationPolicy;
  result: DynamicHistoricalReplayResult;
  traces: AllocationTrace[];
}

const PROTOCOL = {
  frozenAt: '2026-09-08',
  purpose: 'VALIDATE_EXPLICIT_EXTERNAL_CASH_FLOWS_AND_MEASURE_ALLOCATION_REACH',
  productionArchitecture: 'CORE_ARCHITECTURE_V1',
  productionAllocationPolicy: 'LEGACY',
  currentYahooDiscoveryInHistoricalReplay: false,
  flowsAreExplicitOnly: true,
  monthlyDecisionCadenceCreatesImplicitCash: false,
  stagedCapitalPlanMeaning: 'ALREADY_AVAILABLE_CAPITAL_FOR_STAGED_DEPLOYMENT_NOT_EXTERNAL_RECURRING_CASH_FLOW',
  withdrawalPolicyV1: 'CASH_ONLY_FAIL_EXPLICITLY_IF_INSUFFICIENT_NO_HIDDEN_FORCED_SALE',
  researchContributionFixtureEurPerMonth: EXPLICIT_MONTHLY_CONTRIBUTION_EUR,
  researchContributionFixtureIsProductionDefault: false,
  researchContributionFixtureIsUserCashFlowAssumption: false,
  firstFixtureContribution: 'ONE_CALENDAR_MONTH_AFTER_WINDOW_START',
  endDate: END_DATE,
  dataStartDate: DATA_START_DATE,
  windows: WINDOWS,
  frequency: 'MONTHLY',
  initialCapitalEur: 13_000,
  riskProfile: 'MEDIUM',
  horizonYears: 3,
  cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
  cashBenchmarkAnnualPctFallback: 2.5,
  minimumBars: 252,
  taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
  consumedHistoricalWindowsCannotPromoteQuality: true,
  noQualityRetuning: true,
  qualityBridgeBoundsRemainFrozen: '0.85x..1.15x',
  residualLimitation: 'CURRENT_CATALOG_SURVIVORSHIP_NOT_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function explicitMonthlyFlows(startDate: string): DynamicReplayExternalCashFlow[] {
  const rows: DynamicReplayExternalCashFlow[] = [];
  let index = 1;
  let date = addMonths(startDate, 1);
  while (date < END_DATE) {
    rows.push({
      id: `research_contribution_${date}`,
      date,
      amountEur: EXPLICIT_MONTHLY_CONTRIBUTION_EUR,
      kind: 'CONTRIBUTION',
      label: `Fixture research: aportación externa explícita ${EXPLICIT_MONTHLY_CONTRIBUTION_EUR.toFixed(0)} EUR`
    });
    index += 1;
    date = addMonths(startDate, index);
  }
  return rows;
}

function totalExecutedAcquisitionNotional(result: DynamicHistoricalReplayResult): number {
  return result.signals
    .filter(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD') && !signal.isInitialAllocation)
    .reduce((sum, signal) => sum + signal.notionalEur, 0);
}

function acquisitionMap(result: DynamicHistoricalReplayResult): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const signal of result.signals) {
    if (!signal.executed || (signal.action !== 'BUY' && signal.action !== 'ADD') || signal.isInitialAllocation) continue;
    const date = signal.executionDate ?? signal.signalDate;
    const row = out.get(date) ?? new Map<string, number>();
    row.set(signal.assetId, (row.get(signal.assetId) ?? 0) + signal.notionalEur);
    out.set(date, row);
  }
  return out;
}

function compareAcquisitions(a: DynamicHistoricalReplayResult, b: DynamicHistoricalReplayResult) {
  const aa = acquisitionMap(a);
  const bb = acquisitionMap(b);
  const dates = [...new Set([...aa.keys(), ...bb.keys()])].sort();
  let changedDates = 0;
  let totalAbsoluteNotionalDeltaEur = 0;
  for (const date of dates) {
    const left = aa.get(date) ?? new Map<string, number>();
    const right = bb.get(date) ?? new Map<string, number>();
    const keys = new Set([...left.keys(), ...right.keys()]);
    let dateDelta = 0;
    for (const key of keys) dateDelta += Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0));
    if (dateDelta > 0.01) changedDates += 1;
    totalAbsoluteNotionalDeltaEur += dateDelta;
  }
  return { changedDates, totalAbsoluteNotionalDeltaEur };
}

function preFlowSignalFingerprint(result: DynamicHistoricalReplayResult, firstFlowDate: string): unknown[] {
  return result.signals
    .filter(signal => signal.signalDate < firstFlowDate)
    .map(signal => [
      signal.signalDate,
      signal.assetId,
      signal.action,
      signal.executed,
      signal.executionDate,
      Number(signal.recommendedAmountEur.toFixed(6)),
      signal.consensusScore,
      signal.timingState,
      signal.timingScore == null ? null : Number(signal.timingScore.toFixed(6))
    ]);
}

function traceComparison(a: AllocationTrace[], b: AllocationTrace[]) {
  const count = Math.min(a.length, b.length);
  let changedDecisionGates = Math.abs(a.length - b.length);
  let totalAbsolutePlanDeltaEur = 0;
  for (let i = 0; i < count; i++) {
    const left = new Map(a[i].contributions.map(row => [row.assetId, row.amountEur]));
    const right = new Map(b[i].contributions.map(row => [row.assetId, row.amountEur]));
    const keys = new Set([...left.keys(), ...right.keys()]);
    let delta = 0;
    for (const key of keys) delta += Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0));
    if (delta > 0.01 || a[i].asOfDate !== b[i].asOfDate) changedDecisionGates += 1;
    totalAbsolutePlanDeltaEur += delta;
  }
  return { changedDecisionGates, totalAbsolutePlanDeltaEur };
}

function runArm(input: DynamicHistoricalReplayInput, arm: ArmId, policy: OpportunityAllocationPolicy): ArmRun {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const traces: AllocationTrace[] = [];
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput) => {
      const result: PortfolioDecisionResult = originalEvaluate.call(PortfolioDecisionEngine, {
        ...evaluationInput,
        opportunityAllocationPolicy: policy
      });
      traces.push({
        asOfDate: evaluationInput.decision.asOfDate,
        currentCashEur: result.currentCashEur,
        pendingCapitalEur: result.pendingCapitalEur,
        deployableToAssetsEur: result.deployableToAssetsEur,
        recommendedNewInvestmentEur: result.recommendedNewInvestmentEur,
        contributions: result.contributions.map(row => ({ assetId: row.assetId, amountEur: row.amountEur })).sort((a, b) => a.assetId.localeCompare(b.assetId))
      });
      return result;
    }) as Evaluate;
    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    return { arm, policy, result, traces };
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}

function metrics(run: ArmRun) {
  const result = run.result;
  return {
    externalCashFlowMode: result.externalCashFlowMode,
    appliedExternalCashFlows: result.appliedExternalCashFlows.length,
    totalExternalContributionsEur: result.totalExternalContributionsEur,
    totalExternalWithdrawalsEur: result.totalExternalWithdrawalsEur,
    netExternalCashFlowEur: result.netExternalCashFlowEur,
    finalValueEur: result.finalValueEur,
    cashFlowAdjustedProfitEur: result.cashFlowAdjustedProfitEur,
    cashFlowAdjustedReturnPct: result.cashFlowAdjustedReturnPct,
    totalReturnPct: result.totalReturnPct,
    maxDrawdownPct: result.decisionPathMaxDrawdownPct,
    totalFeesEur: result.totalFeesEur,
    totalEstimatedTaxEur: result.totalEstimatedTaxEur,
    cashInterestEur: result.cashInterestEur,
    executedBuys: result.executedBuys,
    executedAdds: result.executedAdds,
    executedReductions: result.executedReductions,
    executedExits: result.executedExits,
    executedAcquisitionNotionalEur: totalExecutedAcquisitionNotional(result),
    decisionGates: run.traces.length,
    deployableCapitalPositiveDecisionGates: run.traces.filter(trace => trace.deployableToAssetsEur > 0.01).length,
    contributionPlanPositiveDecisionGates: run.traces.filter(trace => trace.contributions.length > 0).length,
    pendingCapitalPositiveDecisionGates: run.traces.filter(trace => trace.pendingCapitalEur > 0.01).length,
    structuralCoreBenchmarkFinalEur: result.structuralCoreBenchmarkFinalEur,
    structuralCoreBenchmarkTicker: result.structuralCoreBenchmarkTicker
  };
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('REPLAY_EXPLICIT_CASH_FLOWS_LOCAL_SERVER_UNAVAILABLE');
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
    if (dataset.assets.length < MIN_ACCEPTED_ASSETS) throw new Error(`REPLAY_EXPLICIT_CASH_FLOWS_INSUFFICIENT_REAL_ASSETS:${dataset.assets.length}`);
    if (nonReal.length) throw new Error(`REPLAY_EXPLICIT_CASH_FLOWS_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (currentDiscoveryLeak.length) throw new Error(`REPLAY_EXPLICIT_CASH_FLOWS_CURRENT_DISCOVERY_LEAK:${currentDiscoveryLeak.map(asset => asset.assetId).join(',')}`);

    const byWindow: any[] = [];
    for (const window of WINDOWS) {
      const flows = explicitMonthlyFlows(window.startDate);
      const baseInput: DynamicHistoricalReplayInput = {
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
      const closed = runArm(baseInput, 'CLOSED_LEGACY', 'LEGACY');
      const explicitLegacy = runArm({ ...baseInput, externalCashFlows: flows }, 'EXPLICIT_LEGACY', 'LEGACY');
      const explicitQuality = runArm({ ...baseInput, externalCashFlows: flows }, 'EXPLICIT_QUALITY', 'QUALITY_ALLOCATION_BRIDGE_V1');
      const firstFlowDate = flows[0]?.date ?? END_DATE;
      const noLookaheadParity = JSON.stringify(preFlowSignalFingerprint(closed.result, firstFlowDate)) === JSON.stringify(preFlowSignalFingerprint(explicitLegacy.result, firstFlowDate));
      const expectedContributionTotalEur = flows.length * EXPLICIT_MONTHLY_CONTRIBUTION_EUR;
      const flowAccountingPass = explicitLegacy.result.appliedExternalCashFlows.length === flows.length
        && Math.abs(explicitLegacy.result.totalExternalContributionsEur - expectedContributionTotalEur) < 0.01
        && explicitLegacy.result.totalExternalWithdrawalsEur === 0
        && explicitLegacy.result.externalCashFlowMode === 'EXPLICIT'
        && Number.isFinite(explicitLegacy.result.cashFlowAdjustedReturnPct)
        && explicitLegacy.result.structuralCoreBenchmarkFinalEur == null;
      const fundingReachDeltaEur = totalExecutedAcquisitionNotional(explicitLegacy.result) - totalExecutedAcquisitionNotional(closed.result);
      byWindow.push({
        id: window.id,
        startDate: window.startDate,
        endDate: END_DATE,
        flowFixture: {
          count: flows.length,
          amountEachEur: EXPLICIT_MONTHLY_CONTRIBUTION_EUR,
          expectedContributionTotalEur,
          firstScheduledDate: flows[0]?.date ?? null,
          firstAppliedDate: explicitLegacy.result.appliedExternalCashFlows[0]?.appliedDate ?? null,
          lastScheduledDate: flows.at(-1)?.date ?? null,
          lastAppliedDate: explicitLegacy.result.appliedExternalCashFlows.at(-1)?.appliedDate ?? null
        },
        closedLegacy: metrics(closed),
        explicitLegacy: metrics(explicitLegacy),
        explicitQuality: metrics(explicitQuality),
        causalChecks: {
          noLookaheadParityBeforeFirstExternalFlow: noLookaheadParity,
          flowAccountingPass,
          monthlyClosedArmImplicitContributionCount: closed.result.appliedExternalCashFlows.length,
          closedArmExternalContributionEur: closed.result.totalExternalContributionsEur,
          explicitStructuralBenchmarkCorrectlyUnavailable: explicitLegacy.result.structuralCoreBenchmarkFinalEur == null
        },
        fundingReach: {
          executedAcquisitionNotionalDeltaEurExplicitVsClosed: fundingReachDeltaEur,
          additionalExecutedAcquisitionCapitalObserved: fundingReachDeltaEur > 100
        },
        qualityReachWithExplicitCapital: {
          allocationPlanComparison: traceComparison(explicitLegacy.traces, explicitQuality.traces),
          executedAcquisitionComparison: compareAcquisitions(explicitLegacy.result, explicitQuality.result),
          finalValueDeltaEurVsExplicitLegacy: explicitQuality.result.finalValueEur - explicitLegacy.result.finalValueEur,
          adjustedReturnDeltaPctPointsVsExplicitLegacy: explicitQuality.result.cashFlowAdjustedReturnPct - explicitLegacy.result.cashFlowAdjustedReturnPct,
          drawdownImprovementPctPointsVsExplicitLegacy: explicitLegacy.result.decisionPathMaxDrawdownPct - explicitQuality.result.decisionPathMaxDrawdownPct,
          feeDeltaEurVsExplicitLegacy: explicitQuality.result.totalFeesEur - explicitLegacy.result.totalFeesEur,
          taxDeltaEurVsExplicitLegacy: explicitQuality.result.totalEstimatedTaxEur - explicitLegacy.result.totalEstimatedTaxEur
        }
      });
    }

    const accountingPass = byWindow.every(row => row.causalChecks.flowAccountingPass && row.causalChecks.noLookaheadParityBeforeFirstExternalFlow && row.causalChecks.monthlyClosedArmImplicitContributionCount === 0 && row.causalChecks.closedArmExternalContributionEur === 0);
    const fundingReachWindows = byWindow.filter(row => row.fundingReach.additionalExecutedAcquisitionCapitalObserved).length;
    const result = {
      version: VERSION,
      status: accountingPass && fundingReachWindows >= 1 ? 'PASS_EXPLICIT_CASH_FLOW_INTEGRATION' : accountingPass ? 'PASS_ACCOUNTING_REACH_INCONCLUSIVE' : 'FAIL_EXPLICIT_CASH_FLOW_INTEGRATION',
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
        accountingAndCausalChecksPass: accountingPass,
        fundingReachWindows,
        totalExplicitContributionsEurAcrossWindows: byWindow.reduce((sum, row) => sum + row.explicitLegacy.totalExternalContributionsEur, 0),
        closedDeployableDecisionGatesAcrossWindows: byWindow.reduce((sum, row) => sum + row.closedLegacy.deployableCapitalPositiveDecisionGates, 0),
        explicitDeployableDecisionGatesAcrossWindows: byWindow.reduce((sum, row) => sum + row.explicitLegacy.deployableCapitalPositiveDecisionGates, 0),
        closedContributionPlanDecisionGatesAcrossWindows: byWindow.reduce((sum, row) => sum + row.closedLegacy.contributionPlanPositiveDecisionGates, 0),
        explicitContributionPlanDecisionGatesAcrossWindows: byWindow.reduce((sum, row) => sum + row.explicitLegacy.contributionPlanPositiveDecisionGates, 0),
        executedAcquisitionNotionalDeltaEurExplicitVsClosedAcrossWindows: byWindow.reduce((sum, row) => sum + row.fundingReach.executedAcquisitionNotionalDeltaEurExplicitVsClosed, 0),
        qualityAllocationPlanChangedDecisionGatesAcrossWindows: byWindow.reduce((sum, row) => sum + row.qualityReachWithExplicitCapital.allocationPlanComparison.changedDecisionGates, 0),
        qualityExecutedAcquisitionDatesChangedAcrossWindows: byWindow.reduce((sum, row) => sum + row.qualityReachWithExplicitCapital.executedAcquisitionComparison.changedDates, 0),
        qualityAbsoluteExecutedNotionalDeltaEurAcrossWindows: byWindow.reduce((sum, row) => sum + row.qualityReachWithExplicitCapital.executedAcquisitionComparison.totalAbsoluteNotionalDeltaEur, 0)
      },
      interpretationContract: {
        productionArchitectureRemains: 'CORE_ARCHITECTURE_V1',
        productionAllocationPolicyRemains: 'LEGACY',
        explicitMonthlyFixtureIsNotProductionBehavior: true,
        consumedHistoricalWindowsCannotPromoteQuality: true,
        noQualityRetuningAllowed: true,
        nextDecisionDependsOnResult: 'If explicit flows materially increase allocator reach, future validation can test opportunity allocation on fresh data. If not, do not amplify QUALITY parameters.'
      },
      notes: [
        'MONTHLY remains decision cadence only. The explicit 1,000 EUR/month arm passes dated CONTRIBUTION rows to the existing replay input.',
        'The fixture is a research stress/coverage scenario, not a statement about the user actual savings plan and not a production default.',
        'Every arm uses the same REAL dataset, same historical dates, same CORE_ARCHITECTURE_V1, same cash/tax semantics and the same current catalogue limitation.',
        'Closed capital and explicit-flow LEGACY must be identical before the first scheduled external contribution; otherwise the run fails the causal check.',
        'Structural-core benchmark V1 is intentionally N/D under external flows until that benchmark can receive the same dated flows.',
        'QUALITY remains research-only. This consumed historical diagnostic can measure reach but cannot promote or retune the bridge.'
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
