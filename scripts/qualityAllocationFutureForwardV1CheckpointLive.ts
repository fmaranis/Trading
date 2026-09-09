import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult
} from '../src/investment/decision';
import {
  PortfolioDecisionEngine,
  type OpportunityAllocationPolicy,
  type PortfolioDecisionResult
} from '../src/investment/decision/portfolioDecisionEngine';
import {
  QUALITY_ALLOCATION_FUTURE_FORWARD_V1 as PROTOCOL,
  QUALITY_ALLOCATION_FUTURE_FORWARD_V1_UNIVERSE as FROZEN_UNIVERSE,
  qualityAllocationFutureForwardV1ResearchFlows
} from '../src/investment/decision/qualityAllocationFutureForwardV1';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';

const MARKER = 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_RESULT';
const LOOKBACK_START_DATE = '2025-01-01';
const STATE_RELATIVE_PATH = '.runtime/quality-allocation-future-forward-v1-state.json';
type Evaluate = typeof PortfolioDecisionEngine.evaluate;

interface AllocationTrace {
  asOfDate: string;
  currentCashEur: number;
  deployableToAssetsEur: number;
  recommendedNewInvestmentEur: number;
  contributions: Array<{ assetId: string; amountEur: number }>;
}
interface ArmRun {
  policy: OpportunityAllocationPolicy;
  result: DynamicHistoricalReplayResult;
  traces: AllocationTrace[];
}
interface ForwardContinuityState {
  version: 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_STATE';
  createdAt: string;
  updatedAt: string;
  protocolFingerprint: string;
  universeFingerprint: string;
  lastLockedDataDate: string | null;
  legacyHistoryHash: string | null;
  qualityHistoryHash: string | null;
}

function todayUtc(): string { return new Date().toISOString().slice(0, 10); }
function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function round(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}
function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function protocolFingerprint(): string { return hashJson(PROTOCOL); }
function universeFingerprint(): string {
  return hashJson(FROZEN_UNIVERSE.map(asset => ({
    assetId: asset.assetId,
    ticker: asset.ticker,
    isin: asset.isin ?? null,
    name: asset.name,
    category: asset.category,
    currency: asset.currency,
    instrumentType: asset.instrumentType ?? 'ETF_ETC',
    marketDataProvider: asset.marketDataProvider ?? 'YAHOO'
  })));
}
function statePath(): string { return resolve(process.cwd(), STATE_RELATIVE_PATH); }
function loadContinuityState(): ForwardContinuityState | null {
  const path = statePath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ForwardContinuityState;
    return parsed?.version === 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_STATE' ? parsed : null;
  } catch {
    return null;
  }
}
function saveContinuityState(state: ForwardContinuityState): void {
  const path = statePath();
  const temp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
}
function newContinuityState(): ForwardContinuityState {
  const now = new Date().toISOString();
  return {
    version: 'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_STATE',
    createdAt: now,
    updatedAt: now,
    protocolFingerprint: protocolFingerprint(),
    universeFingerprint: universeFingerprint(),
    lastLockedDataDate: null,
    legacyHistoryHash: null,
    qualityHistoryHash: null
  };
}
function stateMatchesFrozenContract(state: ForwardContinuityState): boolean {
  return state.protocolFingerprint === protocolFingerprint()
    && state.universeFingerprint === universeFingerprint();
}
function latestDatasetDate(dataset: { assets: Array<{ bars: Array<{ timestamp: string }> }> }): string | null {
  const dates = dataset.assets.flatMap(asset => asset.bars.slice(-1).map(bar => isoDate(bar.timestamp))).sort();
  return dates.at(-1) ?? null;
}
function forwardTradingDates(dataset: { assets: Array<{ bars: Array<{ timestamp: string }> }> }, endDate: string): string[] {
  return [...new Set(dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))))]
    .filter(date => date >= PROTOCOL.eligibleStartDate && date <= endDate)
    .sort();
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
  const aa = acquisitionMap(a), bb = acquisitionMap(b);
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
function runArm(input: DynamicHistoricalReplayInput, policy: OpportunityAllocationPolicy): ArmRun {
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
        deployableToAssetsEur: result.deployableToAssetsEur,
        recommendedNewInvestmentEur: result.recommendedNewInvestmentEur,
        contributions: result.contributions.map(row => ({ assetId: row.assetId, amountEur: row.amountEur })).sort((a, b) => a.assetId.localeCompare(b.assetId))
      });
      return result;
    }) as Evaluate;
    return { policy, result: runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1'), traces };
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
function lockedHistoryPayload(run: ArmRun, throughDate: string) {
  return {
    policy: run.policy,
    throughDate,
    traces: run.traces
      .filter(trace => trace.asOfDate <= throughDate)
      .map(trace => [
        trace.asOfDate,
        round(trace.currentCashEur),
        round(trace.deployableToAssetsEur),
        round(trace.recommendedNewInvestmentEur),
        trace.contributions.map(row => [row.assetId, round(row.amountEur)])
      ]),
    signals: run.result.signals
      .filter(signal => signal.signalDate >= PROTOCOL.eligibleStartDate && signal.signalDate <= throughDate)
      .map(signal => [
        signal.signalDate,
        signal.executionDate,
        signal.assetId,
        signal.action,
        signal.executed,
        round(signal.targetWeight),
        round(signal.currentWeight),
        round(signal.recommendedAmountEur),
        round(signal.unitsDelta),
        round(signal.notionalEur),
        round(signal.feeEur),
        round(signal.estimatedTaxEur),
        signal.consensusScore,
        signal.timingState,
        round(signal.timingScore)
      ])
  };
}
function lockedHistoryHash(run: ArmRun, throughDate: string): string {
  return hashJson(lockedHistoryPayload(run, throughDate));
}
function summarizeArm(run: ArmRun) {
  return {
    policy: run.policy,
    finalValueEur: run.result.finalValueEur,
    cashFlowAdjustedReturnPct: run.result.cashFlowAdjustedReturnPct,
    maxDrawdownPct: run.result.decisionPathMaxDrawdownPct,
    totalFeesEur: run.result.totalFeesEur,
    totalEstimatedTaxEur: run.result.totalEstimatedTaxEur,
    totalExternalContributionsEur: run.result.totalExternalContributionsEur,
    appliedExternalCashFlows: run.result.appliedExternalCashFlows.length,
    executedAcquisitionNotionalEur: totalExecutedAcquisitionNotional(run.result),
    decisionGates: run.traces.length,
    deployableCapitalPositiveDecisionGates: run.traces.filter(row => row.deployableToAssetsEur > 0.01).length,
    contributionPlanPositiveDecisionGates: run.traces.filter(row => row.contributions.length > 0).length
  };
}
function reachPass(plan: ReturnType<typeof traceComparison>, execution: ReturnType<typeof compareAcquisitions>): boolean {
  return plan.changedDecisionGates >= PROTOCOL.reachGate.minimumAllocationPlanChangedDecisionGates
    && execution.changedDates >= PROTOCOL.reachGate.minimumExecutedAcquisitionDatesChanged
    && execution.totalAbsoluteNotionalDeltaEur >= PROTOCOL.reachGate.minimumAbsoluteExecutedNotionalDeltaEur;
}
function economicPass(input: { finalDeltaEur: number; returnDeltaPctPoints: number; drawdownImprovementPctPoints: number }): boolean {
  return input.returnDeltaPctPoints >= PROTOCOL.economicGate.minimumCashFlowAdjustedReturnDeltaPctPoints
    && (!PROTOCOL.economicGate.requirePositiveFinalValueDeltaEur || input.finalDeltaEur > 0)
    && input.drawdownImprovementPctPoints >= -PROTOCOL.economicGate.maximumAllowedDrawdownWorseningPctPoints;
}
async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}
function emit(result: unknown): void { console.log(`${MARKER}${JSON.stringify(result)}`); }

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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('QUALITY_FF_V1_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const requestedEndDate = todayUtc();
    const scan = await AssetUniverseScanner.scan([...FROZEN_UNIVERSE], LOOKBACK_START_DATE, requestedEndDate, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 12,
      minimumBars: PROTOCOL.minimumBars,
      maxDataAgeDays: 10,
      currentOpenDiscovery: false
    });
    const dataset = scan.acceptedDataset;
    const nonReal = dataset.assets.filter(asset => asset.provenance?.sourceType !== 'REAL');
    const forbidden = dataset.assets.filter(asset => asset.assetId.startsWith('OPEN_') || asset.assetId.startsWith('HOLDOUT_'));
    if (nonReal.length) throw new Error(`QUALITY_FF_V1_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (forbidden.length) throw new Error(`QUALITY_FF_V1_FORBIDDEN_UNIVERSE_LEAK:${forbidden.map(asset => asset.assetId).join(',')}`);

    const endDate = latestDatasetDate(dataset);
    const forwardDates = endDate ? forwardTradingDates(dataset, endDate) : [];
    let continuityState = loadContinuityState();
    const continuityContractValid = continuityState == null || stateMatchesFrozenContract(continuityState);
    const common = {
      version: PROTOCOL.version,
      generatedAt: new Date().toISOString(),
      protocol: PROTOCOL,
      dataQuality: {
        frozenUniverseAssets: FROZEN_UNIVERSE.length,
        scanned: scan.scanned,
        acceptedRealAssets: dataset.assets.length,
        rejected: scan.rejected,
        allAcceptedProvenanceReal: nonReal.length === 0,
        currentYahooDiscoveryUsed: false,
        forbiddenUniverseLeakCount: forbidden.length,
        latestDataDate: endDate
      },
      maturity: {
        forwardSessionsObserved: forwardDates.length,
        minimumForwardSessionsForEconomicEvaluation: PROTOCOL.minimumForwardSessionsForEconomicEvaluation,
        economicEvaluationMature: forwardDates.length >= PROTOCOL.minimumForwardSessionsForEconomicEvaluation
      },
      continuity: {
        statePath: STATE_RELATIVE_PATH,
        statePresentBeforeRun: continuityState != null,
        frozenContractMatchesPersistedState: continuityContractValid,
        lastLockedDataDateBeforeRun: continuityState?.lastLockedDataDate ?? null,
        retroactiveHistoryDriftDetected: false
      },
      interpretationContract: {
        productionAllocationPolicyRemains: 'LEGACY',
        qualityRemainsShadowResearchOnly: true,
        noEconomicInterpretationBeforeMaturity: true,
        noParameterRetuningAllowed: true,
        phaseACannotPromoteDirectly: true,
        onlyOutcomesOnOrAfter: PROTOCOL.eligibleStartDate,
        previouslyObservedForwardHistoryIsImmutable: true
      }
    };

    if (continuityState && !continuityContractValid) {
      emit({
        ...common,
        status: 'PHASE_A_INVALIDATED_FROZEN_CONTRACT_DRIFT_KEEP_LEGACY',
        reach: null,
        economics: null,
        notes: [
          'The persisted future-forward state no longer matches the frozen protocol or 64-asset universe fingerprint.',
          'The phase is invalidated rather than silently accepting a changed protocol. Production remains LEGACY.'
        ]
      });
      return;
    }

    if (!continuityState && endDate && endDate > PROTOCOL.eligibleStartDate) {
      emit({
        ...common,
        status: 'PHASE_A_INVALIDATED_MISSING_FORWARD_BASELINE_KEEP_LEGACY',
        reach: null,
        economics: null,
        notes: [
          `No continuity baseline exists, but REAL data already extend beyond ${PROTOCOL.eligibleStartDate}.`,
          'The protocol forbids creating the baseline retrospectively after forward outcomes exist. Production remains LEGACY.'
        ]
      });
      return;
    }

    if (!continuityState) {
      continuityState = newContinuityState();
      saveContinuityState(continuityState);
    }

    if (!endDate || endDate <= PROTOCOL.eligibleStartDate) {
      emit({
        ...common,
        continuity: {
          ...common.continuity,
          baselineInitializedThisRun: common.continuity.statePresentBeforeRun === false,
          lastLockedDataDateAfterRun: continuityState.lastLockedDataDate
        },
        status: 'ACCUMULATING_FUTURE_DATA',
        reach: null,
        economics: null,
        notes: [
          `Prospective baseline locked before evaluable outcomes. Latest REAL date ${endDate ?? 'N/D'} must be after ${PROTOCOL.eligibleStartDate} for an outcome checkpoint.`,
          'Historical bars before the eligible start are warmup features only and are never counted as Phase A outcome evidence.',
          'The local continuity state will reject later attempts to rewrite already-observed forward decisions.',
          'Production remains LEGACY; QUALITY remains frozen shadow-only.'
        ]
      });
      return;
    }

    const flows = qualityAllocationFutureForwardV1ResearchFlows(endDate);
    const baseInput: DynamicHistoricalReplayInput = {
      dataset,
      catalog: [...FROZEN_UNIVERSE],
      startDate: PROTOCOL.eligibleStartDate,
      frequency: PROTOCOL.frequency,
      initialCapitalEur: PROTOCOL.initialCapitalEur,
      riskProfile: PROTOCOL.riskProfile,
      horizonYears: PROTOCOL.horizonYears,
      cashBenchmarkMode: PROTOCOL.cashBenchmarkMode,
      cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPctFallback,
      minimumBars: PROTOCOL.minimumBars,
      taxSettings: PROTOCOL.taxSettings,
      simulationMode: 'CUSTODIA_ENGINE',
      externalCashFlows: flows
    };
    const legacy = runArm(baseInput, 'LEGACY');
    const quality = runArm(baseInput, 'QUALITY_ALLOCATION_BRIDGE_V1');

    const legacyFlowFingerprint = legacy.result.appliedExternalCashFlows.map(row => [row.scheduledDate, row.appliedDate, row.amountEur]);
    const qualityFlowFingerprint = quality.result.appliedExternalCashFlows.map(row => [row.scheduledDate, row.appliedDate, row.amountEur]);
    if (JSON.stringify(legacyFlowFingerprint) !== JSON.stringify(qualityFlowFingerprint)) throw new Error('QUALITY_FF_V1_FLOW_PARITY_FAILED');
    if (legacy.result.signals.some(signal => signal.signalDate < PROTOCOL.eligibleStartDate) || quality.result.signals.some(signal => signal.signalDate < PROTOCOL.eligibleStartDate)) {
      throw new Error('QUALITY_FF_V1_PRESTART_SIGNAL_LEAK');
    }

    if (continuityState.lastLockedDataDate) {
      const legacyPriorHash = lockedHistoryHash(legacy, continuityState.lastLockedDataDate);
      const qualityPriorHash = lockedHistoryHash(quality, continuityState.lastLockedDataDate);
      const drift = legacyPriorHash !== continuityState.legacyHistoryHash || qualityPriorHash !== continuityState.qualityHistoryHash;
      if (drift) {
        emit({
          ...common,
          continuity: {
            ...common.continuity,
            lastLockedDataDateBeforeRun: continuityState.lastLockedDataDate,
            retroactiveHistoryDriftDetected: true,
            legacyPriorHashMatches: legacyPriorHash === continuityState.legacyHistoryHash,
            qualityPriorHashMatches: qualityPriorHash === continuityState.qualityHistoryHash
          },
          status: 'PHASE_A_INVALIDATED_FORWARD_HISTORY_DRIFT_KEEP_LEGACY',
          reach: null,
          economics: null,
          notes: [
            `A previously locked forward decision prefix through ${continuityState.lastLockedDataDate} changed on recomputation.`,
            'The checkpoint refuses to rewrite past forward evidence. The persisted lock is not overwritten.',
            'Production remains LEGACY and the candidate cannot be promoted or retuned from this invalidated phase.'
          ]
        });
        return;
      }
    }

    const plan = traceComparison(legacy.traces, quality.traces);
    const execution = compareAcquisitions(legacy.result, quality.result);
    const reached = reachPass(plan, execution);
    const economics = {
      finalValueDeltaEurQualityVsLegacy: quality.result.finalValueEur - legacy.result.finalValueEur,
      cashFlowAdjustedReturnDeltaPctPointsQualityVsLegacy: quality.result.cashFlowAdjustedReturnPct - legacy.result.cashFlowAdjustedReturnPct,
      drawdownImprovementPctPointsQualityVsLegacy: legacy.result.decisionPathMaxDrawdownPct - quality.result.decisionPathMaxDrawdownPct,
      feeDeltaEurQualityVsLegacy: quality.result.totalFeesEur - legacy.result.totalFeesEur,
      taxDeltaEurQualityVsLegacy: quality.result.totalEstimatedTaxEur - legacy.result.totalEstimatedTaxEur
    };
    const mature = forwardDates.length >= PROTOCOL.minimumForwardSessionsForEconomicEvaluation;
    const econPass = mature && reached && economicPass({
      finalDeltaEur: economics.finalValueDeltaEurQualityVsLegacy,
      returnDeltaPctPoints: economics.cashFlowAdjustedReturnDeltaPctPointsQualityVsLegacy,
      drawdownImprovementPctPoints: economics.drawdownImprovementPctPointsQualityVsLegacy
    });
    const status = !mature
      ? 'ACCUMULATING_FUTURE_DATA'
      : !reached
        ? 'PHASE_A_INCONCLUSIVE_INSUFFICIENT_REACH_KEEP_LEGACY'
        : econPass
          ? 'PHASE_A_CANDIDATE_FOR_CONFIRMATION'
          : 'PHASE_A_FAIL_KEEP_LEGACY';

    const nextState: ForwardContinuityState = {
      ...continuityState,
      updatedAt: new Date().toISOString(),
      lastLockedDataDate: endDate,
      legacyHistoryHash: lockedHistoryHash(legacy, endDate),
      qualityHistoryHash: lockedHistoryHash(quality, endDate)
    };
    saveContinuityState(nextState);

    emit({
      ...common,
      continuity: {
        ...common.continuity,
        lastLockedDataDateAfterRun: nextState.lastLockedDataDate,
        retroactiveHistoryDriftDetected: false,
        lockedPrefixPersisted: true
      },
      status,
      flowFixture: {
        count: flows.length,
        amountEachEur: PROTOCOL.researchContributionFixtureEurPerMonth,
        firstScheduledDate: flows[0]?.date ?? null,
        appliedFlowParity: true
      },
      legacy: summarizeArm(legacy),
      quality: summarizeArm(quality),
      reach: {
        ...plan,
        executedAcquisitionDatesChanged: execution.changedDates,
        absoluteExecutedNotionalDeltaEur: execution.totalAbsoluteNotionalDeltaEur,
        reachGatePassed: reached
      },
      economics: mature ? { ...economics, economicGatePassed: econPass } : null,
      diagnosticEconomicsBeforeMaturity: mature ? null : economics,
      notes: [
        'Only sessions from 2026-09-10 onward count as forward outcome evidence. Older REAL bars are causal feature warmup only.',
        'The same frozen 64-asset universe and the same explicit research-only cash-flow fixture are used in both arms.',
        'Every completed checkpoint locks the observed LEGACY and QUALITY decision prefix with SHA-256 in .runtime; a later rewrite invalidates Phase A.',
        'QUALITY_ALLOCATION_BRIDGE_V1 remains frozen at the already-consumed coefficients/bounds; this checkpoint cannot retune it.',
        'Before 252 forward sessions, economic deltas are diagnostic telemetry only and cannot be interpreted as PASS/FAIL.',
        'Even PHASE_A_CANDIDATE_FOR_CONFIRMATION does not promote QUALITY; it only permits a separately frozen fresh confirmation phase.',
        'Production remains LEGACY throughout Phase A.'
      ]
    });
  } finally {
    if (ownsServer && server) server.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
