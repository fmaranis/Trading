import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  PortfolioCandidateGate,
  type CandidateSelectionPolicy,
  type DynamicHistoricalReplayInput,
  type DynamicHistoricalReplayResult
} from '../src/investment/decision';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';

const MARKER = 'OPPORTUNITY_RANKING_REACH_AUDIT_RESULT';
const VERSION = 'OPPORTUNITY_RANKING_REACH_AUDIT_V1' as const;
const DATA_START_DATE = '2014-09-01';
const END_DATE = '2026-09-01';
const MIN_ACCEPTED_ASSETS = 30;
const WINDOWS = [
  { id: 'LONG_10Y', startDate: '2016-09-01' },
  { id: 'MEDIUM_6Y', startDate: '2020-09-01' },
  { id: 'RECENT_3Y', startDate: '2023-09-01' }
] as const;
const POLICIES: readonly CandidateSelectionPolicy[] = ['LEGACY', 'QUALITY_V1', 'SLOPE_V1'];

type Policy = typeof POLICIES[number];
type GateApply = typeof PortfolioCandidateGate.apply;

interface GateTrace {
  sequence: number;
  dataAsOfDate: string | null;
  eligibleCount: number;
  selectedCount: number;
  excludedEligibleCount: number;
  selectionCompetition: boolean;
  categoryCompetition: boolean;
  eligibleOrder: string[];
  selectedOrder: string[];
  selectedSet: string[];
}

interface PolicyRun {
  policy: Policy;
  result: DynamicHistoricalReplayResult;
  gates: GateTrace[];
}

const PROTOCOL = {
  frozenAt: '2026-09-08',
  purpose: 'MEASURE_WHERE_RANKING_INFORMATION_REACHES_OR_DIES_INSIDE_EXISTING_CORE_ARCHITECTURE_V1',
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
  currentYahooDiscoveryInHistoricalAudit: false,
  policies: POLICIES,
  maxSelected: 12,
  productionPolicyRemains: 'LEGACY',
  productionPromotionAllowed: false,
  noThresholdTuningOnConsumedWindows: true,
  residualLimitation: 'CURRENT_CATALOG_SURVIVORSHIP_NOT_FULL_POINT_IN_TIME_INSTRUMENT_MASTER'
} as const;

function setEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const bb = new Set(b);
  return a.every(value => bb.has(value));
}

function symmetricDifferenceCount(a: readonly string[], b: readonly string[]): number {
  const aa = new Set(a);
  const bb = new Set(b);
  let count = 0;
  for (const value of aa) if (!bb.has(value)) count++;
  for (const value of bb) if (!aa.has(value)) count++;
  return count;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function rankShift(legacy: readonly string[], variant: readonly string[]): { meanAbsoluteRankShift: number | null; maxAbsoluteRankShift: number | null } {
  if (!setEqual(legacy, variant) || !legacy.length) return { meanAbsoluteRankShift: null, maxAbsoluteRankShift: null };
  const variantPosition = new Map(variant.map((assetId, index) => [assetId, index]));
  const shifts = legacy.map((assetId, index) => Math.abs(index - (variantPosition.get(assetId) ?? index)));
  return { meanAbsoluteRankShift: mean(shifts), maxAbsoluteRankShift: Math.max(...shifts) };
}

function signalMap(result: DynamicHistoricalReplayResult, executedOnly: boolean): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const signal of result.signals) {
    if (signal.action !== 'BUY' && signal.action !== 'ADD') continue;
    if (!(signal.recommendedAmountEur > 0.01)) continue;
    if (executedOnly && !signal.executed) continue;
    const amount = executedOnly ? signal.notionalEur : signal.recommendedAmountEur;
    const signature = `${signal.assetId}|${signal.action}|${amount.toFixed(2)}|${signal.targetWeight.toFixed(6)}`;
    const rows = out.get(signal.signalDate) ?? [];
    rows.push(signature);
    out.set(signal.signalDate, rows);
  }
  for (const rows of out.values()) rows.sort();
  return out;
}

function changedSignalDates(a: Map<string, string[]>, b: Map<string, string[]>): { count: number; dates: string[] } {
  const dates = [...new Set([...a.keys(), ...b.keys()])].sort();
  const changed = dates.filter(date => JSON.stringify(a.get(date) ?? []) !== JSON.stringify(b.get(date) ?? []));
  return { count: changed.length, dates: changed };
}

function gateTraceFromResult(result: ReturnType<typeof PortfolioCandidateGate.apply>, sequence: number): GateTrace {
  const eligibleRows = result.entries
    .filter(entry => entry.status === 'ELIGIBLE')
    .sort((a, b) => (b.rankingScore ?? Number.NEGATIVE_INFINITY) - (a.rankingScore ?? Number.NEGATIVE_INFINITY));
  const candidateById = new Map(result.scan.candidates.map(candidate => [candidate.asset.assetId, candidate]));
  const categoryCounts = new Map<string, number>();
  for (const entry of eligibleRows) {
    const category = candidateById.get(entry.assetId)?.asset.category ?? 'UNKNOWN';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const dates = result.scan.candidates.map(candidate => candidate.asOfDate).filter((date): date is string => Boolean(date)).sort();
  const selectedOrder = result.scan.selected.map(candidate => candidate.asset.assetId);
  return {
    sequence,
    dataAsOfDate: dates.at(-1) ?? null,
    eligibleCount: eligibleRows.length,
    selectedCount: selectedOrder.length,
    excludedEligibleCount: Math.max(0, eligibleRows.length - selectedOrder.length),
    selectionCompetition: eligibleRows.length > selectedOrder.length,
    categoryCompetition: [...categoryCounts.values()].some(count => count > 2),
    eligibleOrder: eligibleRows.map(entry => entry.assetId),
    selectedOrder,
    selectedSet: [...selectedOrder].sort()
  };
}

function runPolicy(input: DynamicHistoricalReplayInput, policy: Policy): PolicyRun {
  const originalApply = PortfolioCandidateGate.apply;
  const gates: GateTrace[] = [];
  try {
    PortfolioCandidateGate.apply = ((scan, cashBenchmarkAnnualPct, maxSelected = 12) => {
      const result = originalApply.call(PortfolioCandidateGate, scan, cashBenchmarkAnnualPct, maxSelected, policy);
      gates.push(gateTraceFromResult(result, gates.length));
      return result;
    }) as GateApply;
    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    return { policy, result, gates };
  } finally {
    PortfolioCandidateGate.apply = originalApply;
  }
}

function gateStats(gates: GateTrace[]) {
  return {
    decisionGates: gates.length,
    meanEligibleCount: mean(gates.map(gate => gate.eligibleCount)),
    medianEligibleCount: median(gates.map(gate => gate.eligibleCount)),
    meanSelectedCount: mean(gates.map(gate => gate.selectedCount)),
    selectionCompetitionDecisionGates: gates.filter(gate => gate.selectionCompetition).length,
    selectionCompetitionPct: gates.length ? gates.filter(gate => gate.selectionCompetition).length / gates.length * 100 : 0,
    categoryCompetitionDecisionGates: gates.filter(gate => gate.categoryCompetition).length,
    totalExcludedEligibleSlots: gates.reduce((sum, gate) => sum + gate.excludedEligibleCount, 0),
    maxEligibleCount: gates.length ? Math.max(...gates.map(gate => gate.eligibleCount)) : 0
  };
}

function comparePolicy(legacy: PolicyRun, variant: PolicyRun) {
  const length = Math.min(legacy.gates.length, variant.gates.length);
  let eligibleSetParityViolations = Math.abs(legacy.gates.length - variant.gates.length);
  let rankOrderChangedDecisionGates = 0;
  let selectedOrderChangedDecisionGates = 0;
  let selectedSetChangedDecisionGates = 0;
  let rankChangedButSelectedSetSameDecisionGates = 0;
  let selectedSetSymmetricDifferenceTotal = 0;
  const meanRankShifts: number[] = [];
  const maxRankShifts: number[] = [];
  const selectedSetChanges: any[] = [];

  for (let index = 0; index < length; index++) {
    const base = legacy.gates[index];
    const next = variant.gates[index];
    if (!setEqual(base.eligibleOrder, next.eligibleOrder)) eligibleSetParityViolations += 1;
    const rankChanged = JSON.stringify(base.eligibleOrder) !== JSON.stringify(next.eligibleOrder);
    const selectedOrderChanged = JSON.stringify(base.selectedOrder) !== JSON.stringify(next.selectedOrder);
    const selectedSetChanged = !setEqual(base.selectedSet, next.selectedSet);
    if (rankChanged) rankOrderChangedDecisionGates += 1;
    if (selectedOrderChanged) selectedOrderChangedDecisionGates += 1;
    if (selectedSetChanged) {
      selectedSetChangedDecisionGates += 1;
      const symmetric = symmetricDifferenceCount(base.selectedSet, next.selectedSet);
      selectedSetSymmetricDifferenceTotal += symmetric;
      if (selectedSetChanges.length < 12) selectedSetChanges.push({
        sequence: index,
        legacyDataAsOfDate: base.dataAsOfDate,
        variantDataAsOfDate: next.dataAsOfDate,
        eligibleCount: base.eligibleCount,
        legacySelected: base.selectedOrder,
        variantSelected: next.selectedOrder,
        selectedSetSymmetricDifference: symmetric
      });
    } else if (rankChanged) {
      rankChangedButSelectedSetSameDecisionGates += 1;
    }
    const shift = rankShift(base.eligibleOrder, next.eligibleOrder);
    if (shift.meanAbsoluteRankShift != null) meanRankShifts.push(shift.meanAbsoluteRankShift);
    if (shift.maxAbsoluteRankShift != null) maxRankShifts.push(shift.maxAbsoluteRankShift);
  }

  const planned = changedSignalDates(signalMap(legacy.result, false), signalMap(variant.result, false));
  const executed = changedSignalDates(signalMap(legacy.result, true), signalMap(variant.result, true));

  return {
    policy: variant.policy,
    gateDecisionCountParity: legacy.gates.length === variant.gates.length,
    eligibleSetParityViolations,
    rankOrderChangedDecisionGates,
    selectedOrderChangedDecisionGates,
    selectedSetChangedDecisionGates,
    rankChangedButSelectedSetSameDecisionGates,
    selectedSetSymmetricDifferenceTotal,
    meanAbsoluteRankShiftWhenComparable: mean(meanRankShifts),
    maximumObservedAbsoluteRankShift: maxRankShifts.length ? Math.max(...maxRankShifts) : null,
    plannedAcquisitionDecisionDatesChanged: planned.count,
    executedAcquisitionDecisionDatesChanged: executed.count,
    plannedAcquisitionChangedDatesSample: planned.dates.slice(0, 12),
    executedAcquisitionChangedDatesSample: executed.dates.slice(0, 12),
    finalDeltaEurVsLegacy: variant.result.finalValueEur - legacy.result.finalValueEur,
    returnDeltaPctPointsVsLegacy: variant.result.totalReturnPct - legacy.result.totalReturnPct,
    drawdownImprovementPctPointsVsLegacy: legacy.result.decisionPathMaxDrawdownPct - variant.result.decisionPathMaxDrawdownPct,
    selectedSetChangesSample: selectedSetChanges
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('OPPORTUNITY_RANKING_REACH_LOCAL_SERVER_UNAVAILABLE');
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
    if (dataset.assets.length < MIN_ACCEPTED_ASSETS) throw new Error(`OPPORTUNITY_RANKING_REACH_INSUFFICIENT_REAL_ASSETS:${dataset.assets.length}`);
    if (nonReal.length) throw new Error(`OPPORTUNITY_RANKING_REACH_NON_REAL_DATA:${nonReal.map(asset => asset.assetId).join(',')}`);
    if (currentDiscoveryLeak.length) throw new Error(`OPPORTUNITY_RANKING_REACH_CURRENT_DISCOVERY_LEAK:${currentDiscoveryLeak.map(asset => asset.assetId).join(',')}`);

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

      const runs = {} as Record<Policy, PolicyRun>;
      for (const policy of POLICIES) runs[policy] = runPolicy(input, policy);
      const legacy = runs.LEGACY;
      byWindow.push({
        id: window.id,
        startDate: window.startDate,
        endDate: END_DATE,
        legacyGateStats: gateStats(legacy.gates),
        comparisons: [comparePolicy(legacy, runs.QUALITY_V1), comparePolicy(legacy, runs.SLOPE_V1)]
      });
    }

    const aggregate = {
      legacy: {
        decisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyGateStats.decisionGates, 0),
        selectionCompetitionDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyGateStats.selectionCompetitionDecisionGates, 0),
        categoryCompetitionDecisionGatesAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyGateStats.categoryCompetitionDecisionGates, 0),
        totalExcludedEligibleSlotsAcrossWindows: byWindow.reduce((sum, window) => sum + window.legacyGateStats.totalExcludedEligibleSlots, 0)
      },
      variants: (['QUALITY_V1', 'SLOPE_V1'] as const).map(policy => {
        const rows = byWindow.map(window => window.comparisons.find((row: any) => row.policy === policy));
        return {
          policy,
          eligibleSetParityViolations: rows.reduce((sum: number, row: any) => sum + row.eligibleSetParityViolations, 0),
          rankOrderChangedDecisionGatesAcrossWindows: rows.reduce((sum: number, row: any) => sum + row.rankOrderChangedDecisionGates, 0),
          selectedSetChangedDecisionGatesAcrossWindows: rows.reduce((sum: number, row: any) => sum + row.selectedSetChangedDecisionGates, 0),
          rankChangedButSelectedSetSameDecisionGatesAcrossWindows: rows.reduce((sum: number, row: any) => sum + row.rankChangedButSelectedSetSameDecisionGates, 0),
          plannedAcquisitionDecisionDatesChangedAcrossWindows: rows.reduce((sum: number, row: any) => sum + row.plannedAcquisitionDecisionDatesChanged, 0),
          executedAcquisitionDecisionDatesChangedAcrossWindows: rows.reduce((sum: number, row: any) => sum + row.executedAcquisitionDecisionDatesChanged, 0),
          medianFinalDeltaEurVsLegacy: median(rows.map((row: any) => row.finalDeltaEurVsLegacy)),
          worstFinalDeltaEurVsLegacy: Math.min(...rows.map((row: any) => row.finalDeltaEurVsLegacy)),
          medianDrawdownImprovementPctPointsVsLegacy: median(rows.map((row: any) => row.drawdownImprovementPctPointsVsLegacy))
        };
      })
    };

    const result = {
      version: VERSION,
      status: 'PASS_REACH_DIAGNOSTIC_ONLY',
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
        auditQuestion: 'HOW_OFTEN_DOES_RANKING_CHANGE_ORDER_SELECTION_PLAN_AND_EXECUTED_ACQUISITIONS',
        productionPolicyRemains: 'LEGACY',
        historicalAuditCanChangeProduction: false,
        noThresholdTuningOnConsumedWindows: true,
        priorComparisonOutcome: {
          quality: 'RESEARCH_ONLY_INFORMATIONALLY_INTERESTING_INSUFFICIENT_EFFECT',
          slope: 'NOT_A_PROMOTION_CANDIDATE_IN_CURRENT_FORM'
        },
        nextArchitectureDecisionMustUseAuditEvidence: true,
        retainedForwardRiskV8Finding: 'PREDICTIVE_DOWNSIDE_INFORMATION_RETAINED_BUT_NOT_USED_IN_THIS_AUDIT'
      },
      notes: [
        'This audit does not add a new product screen or production engine.',
        'All policies use the same hard eligibility gates and CORE_ARCHITECTURE_V1; only relative ranking among ELIGIBLE candidates changes.',
        'Eligible-set parity violations must be zero. Any non-zero value means a supposed ranking-only policy leaked into eligibility and invalidates interpretation.',
        'Selection competition means eligibleCount > selectedCount; when false, relative rank cannot change which assets reach the downstream allocator.',
        'Current Yahoo discovery remains disabled in historical audit; full point-in-time instrument-master survivorship remains unresolved.'
      ]
    };

    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('OPPORTUNITY_RANKING_REACH_AUDIT_FATAL', error);
  process.exitCode = 1;
});
