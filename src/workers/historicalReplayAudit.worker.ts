import { beginReplayCashContext, endReplayCashContext, type CashBenchmarkMode } from '../investment/decision/cashBenchmark';
import { HistoricalDecisionReplayEngine } from '../investment/decision/historicalDecisionReplay';
import { accrueRemuneratedCashScenarioAfterTax, allCashBenchmarkScenarioAfterTax } from '../investment/decision/remuneratedCash';
import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
import type { MultiAssetDataset } from '../investment/portfolioBacktesting/types';
import type { AssetUniverseItem } from '../investment/decision/assetUniverse';
import type {
  DynamicHistoricalReplayResult,
  DynamicReplayDeploymentHorizon,
  DynamicReplayFrequency,
  DynamicReplaySignal,
  DynamicReplayTimingStateCounts,
  DynamicReplayTrendProtectionV1Counts
} from '../investment/decision/dynamicHistoricalReplay';
import { estimateSpanishTaxOnCashInterest, type SpanishTaxSettings } from '../investment/decision/spanishTaxModel';
import type { InvestmentHorizonYears, InvestorRiskProfile } from '../investment/decision/types';

interface InitMessage {
  type: 'INIT';
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  startDate: string;
  frequency: DynamicReplayFrequency;
  initialCapitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  cashBenchmarkMode: CashBenchmarkMode;
  cashBenchmarkAnnualPct: number;
  minimumBars: number;
  taxSettings: SpanishTaxSettings;
}

interface RunMessage {
  type: 'RUN';
  endDate: string;
}

interface ResetMessage { type: 'RESET'; }
type IncomingMessage = InitMessage | RunMessage | ResetMessage;

interface WorkerScope {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage: (message: unknown) => void;
}

const workerScope = self as unknown as WorkerScope;
const REPLAY_ROTATION_EXPERIMENT = 'CORE_GATE_V1' as const;
const MATERIAL_ACTIONS = new Set(['BUY', 'ADD', 'REDUCE', 'EXIT']);
const PARITY_EPS = 1e-6;
let configuration: Omit<InitMessage, 'type' | 'dataset'> | null = null;
let sourceDataset: MultiAssetDataset | null = null;
let cachedFullResult: DynamicHistoricalReplayResult | null = null;
let projectionValidated = false;
let projectionDisabled = false;

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function addMonthsLikeCore(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function truncateDataset(dataset: MultiAssetDataset, endDate: string): MultiAssetDataset {
  return {
    ...dataset,
    assets: dataset.assets
      .map(asset => ({ ...asset, bars: asset.bars.filter(bar => isoDate(bar.timestamp) <= endDate) }))
      .filter(asset => asset.bars.length > 0)
  };
}
function latestDatasetDate(dataset: MultiAssetDataset): string {
  const dates = dataset.assets.flatMap(asset => asset.bars.slice(-1).map(bar => isoDate(bar.timestamp))).sort();
  if (!dates.length) throw new Error('AUDIT_WORKER_EMPTY_DATASET');
  return dates.at(-1)!;
}
function closeOnOrBefore(dataset: MultiAssetDataset, assetId: string, date: string): number | null {
  const asset = dataset.assets.find(row => row.assetId === assetId);
  if (!asset) return null;
  for (let index = asset.bars.length - 1; index >= 0; index--) {
    const bar = asset.bars[index];
    if (isoDate(bar.timestamp) <= date && bar.close > 0) return bar.close;
  }
  return null;
}
function replayInput(dataset: MultiAssetDataset) {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  return {
    dataset,
    catalog: configuration.catalog,
    startDate: configuration.startDate,
    frequency: configuration.frequency,
    initialCapitalEur: configuration.initialCapitalEur,
    riskProfile: configuration.riskProfile,
    horizonYears: configuration.horizonYears,
    cashBenchmarkMode: configuration.cashBenchmarkMode,
    cashBenchmarkAnnualPct: configuration.cashBenchmarkAnnualPct,
    minimumBars: configuration.minimumBars,
    taxSettings: configuration.taxSettings
  };
}

/** UI/persistence compaction only. Engine totals are finalized beforehand. */
function compactAuditSignals(signals: DynamicReplaySignal[]): DynamicReplaySignal[] {
  const retained: DynamicReplaySignal[] = [];
  const lastStateByAsset = new Map<string, string>();
  for (const signal of signals) {
    if (signal.executed || MATERIAL_ACTIONS.has(signal.action)) {
      retained.push(signal);
      lastStateByAsset.delete(signal.assetId);
      continue;
    }
    const stateKey = [
      signal.action,
      signal.timingState ?? '',
      signal.structuralDowntrend ? 'DOWN' : 'OK',
      signal.buyTheDipCandidate ? 'DIP' : 'NO_DIP',
      signal.trendProtectionV1Action ?? ''
    ].join('|');
    if (lastStateByAsset.get(signal.assetId) === stateKey) continue;
    retained.push(signal);
    lastStateByAsset.set(signal.assetId, stateKey);
  }
  return retained;
}

function requestedDecisionDates(dataset: MultiAssetDataset, startDate: string, endDate: string, frequency: DynamicReplayFrequency): string[] {
  const tradingDates = [...new Set(dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))))]
    .filter(date => date >= startDate && date <= endDate)
    .sort();
  if (frequency === 'DAILY') return tradingDates.filter(date => date < endDate);
  if (frequency === 'WEEKLY') {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const date of tradingDates) {
      if (date >= endDate) continue;
      const key = weekKey(date);
      if (!seen.has(key)) { seen.add(key); out.push(date); }
    }
    return out;
  }
  const step = frequency === 'MONTHLY' ? 1 : 3;
  const out = [startDate];
  let cursor = addMonthsLikeCore(startDate, step);
  while (cursor < endDate) { out.push(cursor); cursor = addMonthsLikeCore(cursor, step); }
  return [...new Set(out)];
}

function earliestEligibleDate(dataset: MultiAssetDataset): string | null {
  if (!configuration) return null;
  let earliest: string | null = null;
  const catalogIds = new Set(configuration.catalog.map(item => item.assetId));
  for (const asset of dataset.assets) {
    if (!catalogIds.has(asset.assetId) || asset.bars.length < configuration.minimumBars) continue;
    const barThreshold = isoDate(asset.bars[configuration.minimumBars - 1].timestamp);
    let valid = 0;
    let validThreshold: string | null = null;
    for (const bar of asset.bars) {
      if (Number.isFinite(bar.close) && bar.close > 0 && ++valid === configuration.minimumBars) {
        validThreshold = isoDate(bar.timestamp);
        break;
      }
    }
    if (!validThreshold) continue;
    const eligible = barThreshold > validThreshold ? barThreshold : validThreshold;
    if (earliest == null || eligible < earliest) earliest = eligible;
  }
  return earliest;
}

function decisionDatesThrough(endDate: string): string[] {
  if (!configuration || !sourceDataset) return [];
  const earliest = earliestEligibleDate(sourceDataset);
  return requestedDecisionDates(sourceDataset, configuration.startDate, endDate, configuration.frequency)
    .filter(date => earliest == null || date >= earliest);
}

function timingCounts(signals: DynamicReplaySignal[]): DynamicReplayTimingStateCounts {
  const counts: DynamicReplayTimingStateCounts = { WAIT: 0, ENTRY_READY: 0, ENTRY_STRONG: 0 };
  for (const signal of signals) if (signal.timingState) counts[signal.timingState] += 1;
  return counts;
}
function trendProtectionCounts(signals: DynamicReplaySignal[]): DynamicReplayTrendProtectionV1Counts {
  const counts: DynamicReplayTrendProtectionV1Counts = {
    HOLD: 0, WATCH: 0, REDUCE: 0, EXIT: 0,
    winnerProtectionArmed: 0, loserFailureArmed: 0, earlierProtectionCandidates: 0
  };
  for (const signal of signals) {
    const action = signal.trendProtectionV1Action;
    if (action) counts[action] += 1;
    if (signal.trendProtectionV1WinnerProtectionArmed) counts.winnerProtectionArmed += 1;
    if (signal.trendProtectionV1LoserFailureArmed) counts.loserFailureArmed += 1;
    if ((action === 'REDUCE' || action === 'EXIT') && signal.action !== 'REDUCE' && signal.action !== 'EXIT') counts.earlierProtectionCandidates += 1;
  }
  return counts;
}
function pathMaxDrawdown(path: DynamicHistoricalReplayResult['equityPath']): number {
  let peak = 0, max = 0;
  for (const point of path) {
    peak = Math.max(peak, point.equityEur);
    if (peak > 0) max = Math.max(max, (peak - point.equityEur) / peak * 100);
  }
  return max;
}
function deploymentHorizons(path: DynamicHistoricalReplayResult['equityPath'], signals: DynamicReplaySignal[], initialCapitalEur: number): DynamicReplayDeploymentHorizon[] {
  return ([1, 5, 20, 60] as const).map(sessionsFromStart => {
    const point = path[sessionsFromStart] ?? null;
    if (!point) return { sessionsFromStart, date: null, netCommittedEur: null, netCommittedPctOfInitialCapital: null, investedMarketValueEur: null, investedPctOfEquity: null };
    let netCommittedEur = 0;
    for (const signal of signals) {
      if (!signal.executed || !signal.executionDate || signal.executionDate > point.date) continue;
      if (signal.unitsDelta > 0) netCommittedEur += signal.notionalEur + signal.feeEur;
      else if (signal.unitsDelta < 0) netCommittedEur -= Math.max(0, signal.notionalEur - signal.feeEur - signal.estimatedTaxEur);
    }
    netCommittedEur = Math.max(0, netCommittedEur);
    return {
      sessionsFromStart,
      date: point.date,
      netCommittedEur,
      netCommittedPctOfInitialCapital: initialCapitalEur > 0 ? netCommittedEur / initialCapitalEur * 100 : null,
      investedMarketValueEur: point.investedEur,
      investedPctOfEquity: point.equityEur > 0 ? point.investedEur / point.equityEur * 100 : null
    };
  });
}

function makeInterestTaxer(settings: SpanishTaxSettings) {
  const grossByTaxYear = new Map<string, number>();
  return (grossInterestEur: number, taxDate: string): number => {
    const year = taxDate.slice(0, 4);
    const prior = grossByTaxYear.get(year) ?? 0;
    const tax = estimateSpanishTaxOnCashInterest(grossInterestEur, settings, prior).estimatedTaxEur;
    grossByTaxYear.set(year, prior + Math.max(0, grossInterestEur));
    return tax;
  };
}

function simulateEngineCash(signals: DynamicReplaySignal[], endDate: string, firstDecisionDate: string) {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  const taxOnInterest = makeInterestTaxer(configuration.taxSettings);
  const bySignalDate = new Map<string, DynamicReplaySignal[]>();
  for (const signal of signals.filter(row => row.executed && row.executionDate && row.executionDate <= endDate)) {
    bySignalDate.set(signal.signalDate, [...(bySignalDate.get(signal.signalDate) ?? []), signal]);
  }
  let cashEur = configuration.initialCapitalEur;
  let grossInterestEur = 0;
  let interestTaxEur = 0;
  let lastCashDate: string | null = null;

  for (const decisionDate of decisionDatesThrough(endDate)) {
    if (decisionDate < firstDecisionDate) continue;
    if (!lastCashDate) lastCashDate = decisionDate;
    else if (decisionDate > lastCashDate) {
      const accrued = accrueRemuneratedCashScenarioAfterTax({
        cashEur,
        mode: configuration.cashBenchmarkMode,
        fixedAnnualPct: configuration.cashBenchmarkAnnualPct,
        fromDate: lastCashDate,
        toDate: decisionDate,
        taxOnInterest
      });
      cashEur = accrued.cashEur;
      grossInterestEur += accrued.grossInterestEur;
      interestTaxEur += accrued.taxEur;
      lastCashDate = decisionDate;
    }
    const operations = bySignalDate.get(decisionDate) ?? [];
    for (const signal of operations.filter(row => row.unitsDelta < 0)) {
      cashEur += Math.max(0, signal.notionalEur - signal.feeEur);
      cashEur = Math.max(0, cashEur - signal.estimatedTaxEur);
    }
    for (const signal of operations.filter(row => row.unitsDelta > 0)) {
      cashEur = Math.max(0, cashEur - signal.notionalEur - signal.feeEur);
    }
  }
  if (lastCashDate && endDate > lastCashDate) {
    const accrued = accrueRemuneratedCashScenarioAfterTax({
      cashEur,
      mode: configuration.cashBenchmarkMode,
      fixedAnnualPct: configuration.cashBenchmarkAnnualPct,
      fromDate: lastCashDate,
      toDate: endDate,
      taxOnInterest
    });
    cashEur = accrued.cashEur;
    grossInterestEur += accrued.grossInterestEur;
    interestTaxEur += accrued.taxEur;
  }
  return { cashEur, grossInterestEur, interestTaxEur, netInterestEur: grossInterestEur - interestTaxEur };
}

function allCashThrough(firstDecisionDate: string, endDate: string) {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  return allCashBenchmarkScenarioAfterTax({
    initialCapitalEur: configuration.initialCapitalEur,
    mode: configuration.cashBenchmarkMode,
    fixedAnnualPct: configuration.cashBenchmarkAnnualPct,
    fromDate: firstDecisionDate,
    toDate: endDate,
    taxOnInterest: makeInterestTaxer(configuration.taxSettings)
  });
}

function staticBenchmark(dataset: MultiAssetDataset): { finalValueEur: number | null; returnPct: number | null } {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  beginReplayCashContext({
    mode: configuration.cashBenchmarkMode,
    fixedAnnualPct: configuration.cashBenchmarkAnnualPct,
    startDate: configuration.startDate,
    taxSettings: configuration.taxSettings
  });
  try {
    const row = HistoricalDecisionReplayEngine.run({
      dataset,
      catalog: configuration.catalog,
      requestedDates: [configuration.startDate],
      initialCapitalEur: configuration.initialCapitalEur,
      riskProfile: configuration.riskProfile,
      horizonYears: configuration.horizonYears,
      cashBenchmarkAnnualPct: configuration.cashBenchmarkAnnualPct,
      minimumBars: configuration.minimumBars
    }).cases[0] ?? null;
    return { finalValueEur: row?.finalValueEur ?? null, returnPct: row?.totalReturnPct ?? null };
  } finally {
    endReplayCashContext();
  }
}

function projectedSignal(signal: DynamicReplaySignal, endDate: string): DynamicReplaySignal {
  const clone = { ...signal };
  if (clone.executed && clone.executionDate && clone.executionDate > endDate) {
    Object.assign(clone, {
      executed: false,
      executionDate: null,
      unitsDelta: 0,
      notionalEur: 0,
      feeEur: 0,
      realizedGainEur: 0,
      estimatedTaxEur: 0,
      taxDeferredTransferEur: 0,
      executionPriceEur: null
    });
  }
  return clone;
}

function projectFullResult(full: DynamicHistoricalReplayResult, requestedEndDate: string): DynamicHistoricalReplayResult {
  if (!configuration || !sourceDataset) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  const dataset = truncateDataset(sourceDataset, requestedEndDate);
  const endDate = latestDatasetDate(dataset);
  if (endDate === full.endDate) return { ...full, signals: full.signals.map(signal => ({ ...signal })), events: full.events.map(event => ({ ...event })), equityPath: full.equityPath.map(point => ({ ...point })) };

  const signals = full.signals.filter(signal => signal.signalDate < endDate).map(signal => projectedSignal(signal, endDate));
  const events = full.events.filter(event => event.date <= endDate).map(event => ({ ...event }));
  const equityPath = full.equityPath.filter(point => point.date <= endDate).map(point => ({ ...point }));
  const cash = simulateEngineCash(signals, endDate, full.startDate);
  const unitsByAsset = new Map<string, number>();
  for (const signal of signals) {
    if (!signal.executed || !signal.executionDate || signal.executionDate > endDate) continue;
    unitsByAsset.set(signal.assetId, Math.max(0, (unitsByAsset.get(signal.assetId) ?? 0) + signal.unitsDelta));
  }
  let investedEur = 0;
  for (const [assetId, units] of unitsByAsset) investedEur += units * (closeOnOrBefore(sourceDataset, assetId, endDate) ?? 0);
  const finalValueEur = cash.cashEur + investedEur;
  const totalReturnPct = (finalValueEur / configuration.initialCapitalEur - 1) * 100;
  const allCash = allCashThrough(full.startDate, endDate);
  const staticResult = staticBenchmark(dataset);
  const saleTaxEur = signals.filter(signal => signal.executed).reduce((sum, signal) => sum + Math.max(0, signal.estimatedTaxEur), 0);
  const totalFeesEur = signals.filter(signal => signal.executed).reduce((sum, signal) => sum + Math.max(0, signal.feeEur), 0);
  const totalTransferredEur = signals
    .filter(signal => signal.executed && (signal.action === 'BUY' || signal.action === 'ADD'))
    .reduce((sum, signal) => sum + Math.max(0, signal.taxDeferredTransferEur), 0);
  const material = signals.filter(signal => MATERIAL_ACTIONS.has(signal.action));
  const notes = full.notes.filter(note => !note.startsWith('Replay experimental CORE_GATE_V1:'));

  return {
    ...full,
    requestedStartDate: configuration.startDate,
    startDate: full.startDate,
    endDate,
    initialCapitalEur: configuration.initialCapitalEur,
    finalValueEur,
    totalReturnPct,
    staticBuyHoldFinalEur: staticResult.finalValueEur,
    staticBuyHoldReturnPct: staticResult.returnPct,
    allCashFinalEur: allCash.finalEur,
    allCashReturnPct: allCash.returnPct,
    excessFinalEurVsStatic: staticResult.finalValueEur == null ? null : finalValueEur - staticResult.finalValueEur,
    excessReturnVsStaticPctPoints: staticResult.returnPct == null ? null : totalReturnPct - staticResult.returnPct,
    excessFinalEurVsCash: finalValueEur - allCash.finalEur,
    excessReturnVsCashPctPoints: totalReturnPct - allCash.returnPct,
    decisionPathMaxDrawdownPct: pathMaxDrawdown(equityPath),
    decisions: decisionDatesThrough(endDate).filter(date => date >= full.startDate).length,
    materialSignals: material.length,
    executedBuys: signals.filter(signal => signal.action === 'BUY' && signal.executed).length,
    executedAdds: signals.filter(signal => signal.action === 'ADD' && signal.executed).length,
    executedReductions: signals.filter(signal => signal.action === 'REDUCE' && signal.executed).length,
    executedExits: signals.filter(signal => signal.action === 'EXIT' && signal.executed).length,
    timingStateCounts: timingCounts(signals),
    trendProtectionV1Counts: trendProtectionCounts(signals),
    deploymentHorizons: deploymentHorizons(equityPath, signals, configuration.initialCapitalEur),
    totalFeesEur,
    totalEstimatedTaxEur: saleTaxEur + cash.interestTaxEur,
    totalTransferredEur,
    cashInterestEur: cash.grossInterestEur,
    cashInterestTaxEur: cash.interestTaxEur,
    cashInterestNetEur: cash.netInterestEur,
    cashBenchmarkMode: configuration.cashBenchmarkMode,
    cashBenchmarkFixedAnnualPct: configuration.cashBenchmarkAnnualPct,
    signals,
    events,
    equityPath,
    notes: [...notes, 'SINGLE_PASS_CHECKPOINT_PROJECTION_V1: checkpoint derivado sólo del prefijo causal de un replay completo; la primera proyección de cada sesión se valida contra el cálculo legacy exacto antes de habilitar este modo.']
  };
}

function closeEnough(a: number | null | undefined, b: number | null | undefined, eps = PARITY_EPS): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}
function signalParitySignature(signal: DynamicReplaySignal): string {
  const n = (value: number | null | undefined) => value == null ? '' : Number(value).toFixed(8);
  return [
    signal.id, signal.action, signal.signalDate, signal.executionDate ?? '', signal.executed ? '1' : '0',
    signal.timingState ?? '', n(signal.targetWeight), n(signal.currentWeight), n(signal.recommendedAmountEur),
    n(signal.unitsDelta), n(signal.notionalEur), n(signal.feeEur), n(signal.realizedGainEur),
    n(signal.estimatedTaxEur), n(signal.taxDeferredTransferEur), n(signal.executionPriceEur)
  ].join('|');
}
function projectionParity(projected: DynamicHistoricalReplayResult, exact: DynamicHistoricalReplayResult): { pass: boolean; reason: string } {
  const numericFields: Array<keyof DynamicHistoricalReplayResult> = [
    'finalValueEur', 'totalReturnPct', 'staticBuyHoldFinalEur', 'staticBuyHoldReturnPct',
    'allCashFinalEur', 'allCashReturnPct', 'decisionPathMaxDrawdownPct', 'totalFeesEur',
    'totalEstimatedTaxEur', 'totalTransferredEur', 'cashInterestEur', 'cashInterestTaxEur', 'cashInterestNetEur'
  ];
  for (const field of numericFields) {
    if (!closeEnough(projected[field] as number | null, exact[field] as number | null)) return { pass: false, reason: `FIELD_${String(field)}` };
  }
  for (const field of ['endDate', 'startDate', 'decisions', 'materialSignals', 'executedBuys', 'executedAdds', 'executedReductions', 'executedExits'] as const) {
    if (projected[field] !== exact[field]) return { pass: false, reason: `FIELD_${field}` };
  }
  const projectedSignals = projected.signals.map(signalParitySignature).sort();
  const exactSignals = exact.signals.map(signalParitySignature).sort();
  if (projectedSignals.length !== exactSignals.length) return { pass: false, reason: 'SIGNAL_COUNT' };
  for (let index = 0; index < exactSignals.length; index++) if (projectedSignals[index] !== exactSignals[index]) return { pass: false, reason: `SIGNAL_${index}` };
  if (projected.equityPath.length !== exact.equityPath.length) return { pass: false, reason: 'PATH_COUNT' };
  for (let index = 0; index < exact.equityPath.length; index++) {
    const a = projected.equityPath[index], b = exact.equityPath[index];
    if (a.date !== b.date || !closeEnough(a.equityEur, b.equityEur) || !closeEnough(a.cashEur, b.cashEur) || !closeEnough(a.investedEur, b.investedEur)) return { pass: false, reason: `PATH_${index}` };
  }
  return { pass: true, reason: 'PASS' };
}

function exactLegacyResult(requestedEndDate: string): { dataset: MultiAssetDataset; result: DynamicHistoricalReplayResult } {
  if (!sourceDataset || !configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  const dataset = truncateDataset(sourceDataset, requestedEndDate);
  return { dataset, result: runDynamicReplayWithRotationExperiment(replayInput(dataset), REPLAY_ROTATION_EXPERIMENT) };
}

function finalizeForUi(result: DynamicHistoricalReplayResult, dataset: MultiAssetDataset) {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  const audited = appendRotationCounterfactualAudit({ result, dataset, catalog: configuration.catalog });
  const fullSignalCount = audited.signals.length;
  audited.signals = compactAuditSignals(audited.signals);
  return { audited, fullSignalCount, retainedSignalCount: audited.signals.length };
}

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  if (message.type === 'RESET') {
    configuration = null;
    sourceDataset = null;
    cachedFullResult = null;
    projectionValidated = false;
    projectionDisabled = false;
    workerScope.postMessage({ type: 'RESET_DONE' });
    return;
  }

  if (message.type === 'INIT') {
    const { dataset, type: _type, ...rest } = message;
    sourceDataset = dataset;
    configuration = rest;
    cachedFullResult = null;
    projectionValidated = false;
    projectionDisabled = false;
    workerScope.postMessage({ type: 'READY', rotationExperiment: REPLAY_ROTATION_EXPERIMENT, checkpointExecutionMode: 'GUARDED_SINGLE_PASS_V1' });
    return;
  }

  if (!configuration || !sourceDataset) {
    workerScope.postMessage({ type: 'ERROR', error: 'AUDIT_WORKER_NOT_INITIALIZED' });
    return;
  }

  try {
    const requestedDataset = truncateDataset(sourceDataset, message.endDate);
    const requestedEffectiveEnd = latestDatasetDate(requestedDataset);
    const sourceEndDate = latestDatasetDate(sourceDataset);
    const isFinalCheckpoint = requestedEffectiveEnd >= sourceEndDate;
    let result: DynamicHistoricalReplayResult;
    let datasetForAudit = requestedDataset;
    let executionMode: 'LEGACY_EXACT' | 'SINGLE_PASS_EXACT_FIRST' | 'SINGLE_PASS_PROJECTED' | 'SINGLE_PASS_FINAL_EXACT' = 'LEGACY_EXACT';
    let parityReason = projectionDisabled ? 'DISABLED_AFTER_PARITY_MISMATCH' : 'NOT_CHECKED';

    if (projectionDisabled) {
      result = exactLegacyResult(message.endDate).result;
    } else {
      if (!cachedFullResult) cachedFullResult = runDynamicReplayWithRotationExperiment(replayInput(sourceDataset), REPLAY_ROTATION_EXPERIMENT);
      if (isFinalCheckpoint) {
        result = { ...cachedFullResult, signals: cachedFullResult.signals.map(signal => ({ ...signal })), events: cachedFullResult.events.map(event => ({ ...event })), equityPath: cachedFullResult.equityPath.map(point => ({ ...point })) };
        executionMode = 'SINGLE_PASS_FINAL_EXACT';
        parityReason = projectionValidated ? 'VALIDATED_ON_PRIOR_CHECKPOINT' : 'FINAL_RESULT_IS_DIRECT_FULL_REPLAY';
      } else if (!projectionValidated) {
        const projected = projectFullResult(cachedFullResult, message.endDate);
        const exact = exactLegacyResult(message.endDate);
        const parity = projectionParity(projected, exact.result);
        parityReason = parity.reason;
        if (!parity.pass) {
          projectionDisabled = true;
          cachedFullResult = null;
          result = exact.result;
          datasetForAudit = exact.dataset;
          executionMode = 'LEGACY_EXACT';
        } else {
          projectionValidated = true;
          result = exact.result;
          datasetForAudit = exact.dataset;
          executionMode = 'SINGLE_PASS_EXACT_FIRST';
        }
      } else {
        result = projectFullResult(cachedFullResult, message.endDate);
        executionMode = 'SINGLE_PASS_PROJECTED';
        parityReason = 'VALIDATED_ON_FIRST_CHECKPOINT';
      }
    }

    const { audited, fullSignalCount, retainedSignalCount } = finalizeForUi(result, datasetForAudit);
    workerScope.postMessage({
      type: 'RESULT',
      requestedEndDate: message.endDate,
      result: audited,
      rotationExperiment: REPLAY_ROTATION_EXPERIMENT,
      trendProtectionV2Counterfactual: false,
      fullSignalCount,
      retainedSignalCount,
      checkpointExecutionMode: executionMode,
      checkpointProjectionParity: parityReason
    });

    if (isFinalCheckpoint) cachedFullResult = null;
  } catch (error: any) {
    workerScope.postMessage({ type: 'ERROR', error: error?.message || String(error), requestedEndDate: message.endDate });
  }
};