import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { brokerCommission } from './costAwareExecutionPolicy';
import { DEFAULT_REPLAY_CASH_BENCHMARK_MODE, type CashBenchmarkMode } from './cashBenchmark';
import { DynamicHistoricalReplayEngine, type DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';
import {
  applyCoreAlphaV2,
  CORE_ALPHA_V2_LIMITS,
  CORE_ALPHA_V2_THRESHOLDS,
  type CoreAlphaV2Counters
} from './coreAlphaOverlay';
import {
  applyCoreArchitectureV1,
  applyCoreGateV1,
  CORE_ARCHITECTURE_V1_LIMITS,
  CORE_GATE_V1_THRESHOLDS,
  type CoreArchitectureV1Counters,
  type CoreGateV1Counters,
  type PortfolioEvaluationInput
} from './portfolioCoreGatePolicy';
import { selectDynamicCoreV1, type DynamicCoreCandidateScore, type DynamicCoreIncumbentState, type DynamicCoreSelectionReason } from './dynamicCoreSelector';
import { PortfolioDecisionEngine, type PortfolioDecisionResult, type PortfolioPositionDecision } from './portfolioDecisionEngine';
import {
  applyExitProceedsCustodyV1,
  EXIT_PROCEEDS_CUSTODY_V1,
  prepareExitProceedsCustodyV1,
  type ReentryCashReservation,
  type ReentryFundingPolicy
} from './reentryCashCustodyPolicy';
import { accrueRemuneratedCashScenarioAfterTax } from './remuneratedCash';

export type ReplayRotationExperiment = 'BASELINE' | 'CORE_GATE_V1' | 'CORE_ARCHITECTURE_V1' | 'CORE_ALPHA_V2';
type ReplayRunInput = Parameters<typeof DynamicHistoricalReplayEngine.run>[0];
type ReplaySignalWithAudit = DynamicHistoricalReplayResult['signals'][number] & { auditExtensions?: Record<string, unknown> };

export interface ReplayDynamicCoreSelectionAuditEntry {
  decisionDate: string;
  selectedAssetId: string | null;
  selectedTicker: string | null;
  incumbentAssetId: string | null;
  incumbentHealthy: boolean | null;
  incumbentState: DynamicCoreIncumbentState;
  reason: DynamicCoreSelectionReason;
  candidates: DynamicCoreCandidateScore[];
}

export interface ReplayReentryCustodyEpisodeAudit {
  assetId: string;
  ticker: string;
  exitDecisionDate: string;
  exitExecutionDate: string;
  exitSignalId: string;
  netProceedsEur: number;
  reentryDecisionDate: string | null;
  reentryExecutionDate: string | null;
  reentrySignalId: string | null;
  reservedCashAtReentryEur: number;
  reservedCashUsedEur: number;
  releasedRemainderEur: number;
}

export interface ReplayReentryCustodyAudit {
  policy: ReentryFundingPolicy;
  reservationsCreated: number;
  reentriesExecuted: number;
  netProceedsReservedEur: number;
  reservedCashUsedEur: number;
  releasedRemainderEur: number;
  peakReservedCashEur: number;
  finalReservedCashEur: number;
  episodes: ReplayReentryCustodyEpisodeAudit[];
}

export interface ReplayRotationExperimentOptions {
  /** Research-only. Production/canonical replay omits this and therefore stays LEGACY. */
  reentryFundingPolicy?: ReentryFundingPolicy;
}

export type DynamicReplayExperimentResult = DynamicHistoricalReplayResult & {
  coreSelectionAudit: ReplayDynamicCoreSelectionAuditEntry[];
  reentryCustodyAudit: ReplayReentryCustodyAudit;
};

interface PendingExitReservation {
  assetId: string;
  ticker: string;
  decisionDate: string;
  executionDate: string;
  signalId: string;
  netProceedsEur: number;
}

interface ActiveReservationState {
  reservation: ReentryCashReservation;
  ticker: string;
  sourceDecisionDate: string;
  sourceExitSignalId: string;
  originalNetProceedsEur: number;
  lastAccruedAt: string;
  pendingReentryDecisionDate: string | null;
  pendingReentryExecutionDate: string | null;
}

interface ReentryAuthorization {
  assetId: string;
  sourceExitSignalId: string;
  decisionDate: string;
  executionDate: string;
  authorizedReserveSpendEur: number;
}

function emptyReentryAudit(policy: ReentryFundingPolicy): ReplayReentryCustodyAudit {
  return {
    policy,
    reservationsCreated: 0,
    reentriesExecuted: 0,
    netProceedsReservedEur: 0,
    reservedCashUsedEur: 0,
    releasedRemainderEur: 0,
    peakReservedCashEur: 0,
    finalReservedCashEur: 0,
    episodes: []
  };
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }

function replayDecisionDate(evaluationInput: PortfolioEvaluationInput): string {
  const updatedAtDate = String(evaluationInput.portfolio.updatedAt ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(updatedAtDate) ? updatedAtDate : evaluationInput.decision.asOfDate;
}

function catalogItem(input: ReplayRunInput, assetId: string) {
  return input.catalog.find(asset => asset.assetId === assetId) ?? null;
}

function nextBarAfter(input: ReplayRunInput, assetId: string, date: string) {
  return input.dataset.assets.find(asset => asset.assetId === assetId)?.bars.find(bar => isoDate(bar.timestamp) > date) ?? null;
}

function executionBarOnOrAfter(input: ReplayRunInput, assetId: string, date: string) {
  return input.dataset.assets.find(asset => asset.assetId === assetId)?.bars.find(bar => isoDate(bar.timestamp) >= date) ?? null;
}

function healthSnapshot(evaluationInput: PortfolioEvaluationInput, assetId: string): any | null {
  return evaluationInput.positionHealth?.[assetId] ?? null;
}

function listedShares(evaluationInput: PortfolioEvaluationInput, input: ReplayRunInput, assetId: string): number {
  const item = catalogItem(input, assetId);
  if (!item) return 0;
  return Math.max(0, evaluationInput.portfolio.holdings.find(row => row.ticker.toUpperCase() === item.ticker.toUpperCase())?.shares ?? 0);
}

function fundValue(evaluationInput: PortfolioEvaluationInput, assetId: string): number {
  return Math.max(0, (evaluationInput.portfolio.funds ?? []).find(row => row.id === assetId)?.currentValueEur ?? 0);
}

function hasPosition(evaluationInput: PortfolioEvaluationInput, input: ReplayRunInput, assetId: string): boolean {
  const item = catalogItem(input, assetId);
  if (!item) return false;
  return item.instrumentType === 'MUTUAL_FUND'
    ? fundValue(evaluationInput, assetId) > 0.01
    : listedShares(evaluationInput, input, assetId) > 1e-12;
}

function orderEconomicallyExecutable(notionalEur: number, totalCapitalEur: number): boolean {
  if (!(notionalEur > 0)) return false;
  const policy = executionPolicyForCapital(totalCapitalEur);
  if (notionalEur < policy.minimumOrderNotionalEur - 1e-9) return false;
  const fee = brokerCommission(notionalEur);
  return fee / notionalEur * 100 <= policy.maximumOrderFeeDragPct + 1e-9;
}

function tradeAssetIds(result: PortfolioDecisionResult): string[] {
  const ids = [
    ...result.existingPositions
      .filter(position => (position.action === 'REDUCE' || position.action === 'EXIT') && position.assetId)
      .map(position => position.assetId!),
    ...result.contributions.filter(row => row.amountEur > 0.01).map(row => row.assetId)
  ];
  return [...new Set(ids)];
}

function commonExecutionDate(input: ReplayRunInput, decisionDate: string, result: PortfolioDecisionResult): string | null {
  const ids = tradeAssetIds(result);
  if (!ids.length) return null;
  const dates = ids.map(assetId => nextBarAfter(input, assetId, decisionDate)).filter(Boolean).map(bar => isoDate(bar!.timestamp));
  return dates.length === ids.length ? [...dates].sort().at(-1)! : null;
}

function basisFromHealth(snapshot: any | null, fallbackCurrentValueEur: number): number {
  const currentValue = Math.max(0, Number(snapshot?.currentValueEur ?? fallbackCurrentValueEur) || 0);
  const returnPct = Number(snapshot?.currentReturnPct);
  if (currentValue > 0 && Number.isFinite(returnPct) && returnPct > -99.999999) {
    return currentValue / (1 + returnPct / 100);
  }
  return currentValue;
}

function predictedListedSale(input: {
  replayInput: ReplayRunInput;
  evaluationInput: PortfolioEvaluationInput;
  result: PortfolioDecisionResult;
  position: PortfolioPositionDecision;
  executionDate: string;
}): { grossEur: number; feeEur: number; taxEur: number; netEur: number } | null {
  const assetId = input.position.assetId;
  if (!assetId) return null;
  const item = catalogItem(input.replayInput, assetId);
  if (!item || item.instrumentType === 'MUTUAL_FUND') return null;
  const shares = listedShares(input.evaluationInput, input.replayInput, assetId);
  const bar = executionBarOnOrAfter(input.replayInput, assetId, input.executionDate);
  if (!(shares > 1e-12) || !bar || !(bar.open > 0)) return null;
  const unitsToSell = input.position.action === 'EXIT'
    ? shares
    : Math.floor(Math.min(shares, Math.max(0, input.position.currentValueEur ?? 0) * Math.max(0, Math.min(100, input.position.suggestedReductionPct ?? 50)) / 100 / bar.open) + 1e-9);
  if (!(unitsToSell > 1e-12)) return null;
  const grossEur = unitsToSell * bar.open;
  const feeEur = brokerCommission(grossEur);
  if (!orderEconomicallyExecutable(grossEur, input.result.totalPlannedCapitalEur)) return null;

  let taxEur = 0;
  if (input.position.action === 'EXIT') {
    const snapshot = healthSnapshot(input.evaluationInput, assetId);
    const totalBasis = basisFromHealth(snapshot, Math.max(0, input.position.currentValueEur ?? 0));
    const realizedGain = grossEur - feeEur - totalBasis;
    taxEur = Math.max(0, realizedGain) * 0.30;
  } else {
    taxEur = Math.max(0, grossEur - feeEur) * 0.30;
  }
  return { grossEur, feeEur, taxEur, netEur: Math.max(0, grossEur - feeEur - taxEur) };
}

function predictedRotationFunding(
  replayInput: ReplayRunInput,
  evaluationInput: PortfolioEvaluationInput,
  result: PortfolioDecisionResult
): Record<string, number> {
  const executionDate = commonExecutionDate(replayInput, replayDecisionDate(evaluationInput), result);
  if (!executionDate) return {};
  const funding: Record<string, number> = {};
  for (const position of result.existingPositions) {
    if ((position.action !== 'REDUCE' && position.action !== 'EXIT') || !position.assetId || !position.rotationChallengerAssetId) continue;
    const challenger = result.contributions.find(row => row.assetId === position.rotationChallengerAssetId && row.amountEur > 0.01);
    if (!challenger) continue;
    const sourceItem = catalogItem(replayInput, position.assetId);
    const targetItem = catalogItem(replayInput, position.rotationChallengerAssetId);
    if (!sourceItem || !targetItem) continue;

    let net = 0;
    if (sourceItem.instrumentType === 'MUTUAL_FUND') {
      const gross = Math.max(0, position.currentValueEur ?? 0) * (position.action === 'EXIT' ? 1 : Math.max(0, Math.min(100, position.suggestedReductionPct ?? 50)) / 100);
      net = targetItem.instrumentType === 'MUTUAL_FUND' ? gross : gross * 0.70;
    } else {
      net = predictedListedSale({ replayInput, evaluationInput, result, position, executionDate })?.netEur ?? 0;
    }
    if (net > 0.01) funding[position.rotationChallengerAssetId] = (funding[position.rotationChallengerAssetId] ?? 0) + net;
  }
  return funding;
}

function executionPricesForContributions(
  replayInput: ReplayRunInput,
  evaluationInput: PortfolioEvaluationInput,
  result: PortfolioDecisionResult
): Record<string, number> {
  const executionDate = commonExecutionDate(replayInput, replayDecisionDate(evaluationInput), result);
  if (!executionDate) return {};
  const prices: Record<string, number> = {};
  for (const contribution of result.contributions) {
    if (!(contribution.amountEur > 0.01) || contribution.instrumentType === 'MUTUAL_FUND') continue;
    const bar = executionBarOnOrAfter(replayInput, contribution.assetId, executionDate);
    if (bar?.open != null && bar.open > 0) prices[contribution.assetId] = bar.open;
  }
  return prices;
}

function predictEligibleExit(
  replayInput: ReplayRunInput,
  evaluationInput: PortfolioEvaluationInput,
  result: PortfolioDecisionResult,
  assetId: string
): PendingExitReservation | null {
  const decisionDate = replayDecisionDate(evaluationInput);
  const executionDate = commonExecutionDate(replayInput, decisionDate, result);
  const position = result.existingPositions.find(row => row.assetId === assetId && row.action === 'EXIT' && !row.rotationChallengerAssetId);
  const item = catalogItem(replayInput, assetId);
  if (!executionDate || !position || !item || item.instrumentType === 'MUTUAL_FUND') return null;
  const sale = predictedListedSale({ replayInput, evaluationInput, result, position, executionDate });
  if (!sale || !(sale.netEur > 0.01)) return null;
  return {
    assetId,
    ticker: item.ticker,
    decisionDate,
    executionDate,
    signalId: `${decisionDate}_${assetId}_EXIT`,
    netProceedsEur: sale.netEur
  };
}

function accrueReservedAmount(amountEur: number, fromDate: string, toDate: string, input: ReplayRunInput): number {
  if (!(amountEur > 0) || toDate <= fromDate) return Math.max(0, amountEur);
  const mode: CashBenchmarkMode = input.cashBenchmarkMode ?? DEFAULT_REPLAY_CASH_BENCHMARK_MODE;
  const fixedAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : 2.5;
  return accrueRemuneratedCashScenarioAfterTax({
    cashEur: amountEur,
    mode,
    fixedAnnualPct,
    fromDate,
    toDate,
    taxOnInterest: gross => Math.max(0, gross) * 0.19
  }).cashEur;
}

function resultSignal(result: DynamicHistoricalReplayResult, id: string) {
  return result.signals.find(signal => signal.id === id) ?? null;
}

function finalizeReentryAudit(
  replayInput: ReplayRunInput,
  result: DynamicHistoricalReplayResult,
  predictedExits: PendingExitReservation[],
  authorizations: ReentryAuthorization[]
): ReplayReentryCustodyAudit {
  const episodes: ReplayReentryCustodyEpisodeAudit[] = [];
  for (const predicted of predictedExits) {
    const exitSignal = resultSignal(result, predicted.signalId);
    if (!exitSignal?.executed || exitSignal.action !== 'EXIT' || !exitSignal.executionDate) {
      throw new Error(`PHASE4_REENTRY_EXIT_EXECUTION_PREDICTION_MISMATCH:${predicted.signalId}`);
    }
    const actualNet = Math.max(0, exitSignal.notionalEur - exitSignal.feeEur - exitSignal.estimatedTaxEur);
    if (Math.abs(actualNet - predicted.netProceedsEur) > 0.02) {
      throw new Error(`PHASE4_REENTRY_EXIT_NET_MISMATCH:${predicted.signalId}:${predicted.netProceedsEur.toFixed(2)}:${actualNet.toFixed(2)}`);
    }

    const candidateAuthorizations = authorizations
      .filter(row => row.sourceExitSignalId === predicted.signalId && row.executionDate > exitSignal.executionDate!)
      .sort((a, b) => a.executionDate.localeCompare(b.executionDate) || a.decisionDate.localeCompare(b.decisionDate));
    let reentry: DynamicHistoricalReplayResult['signals'][number] | null = null;
    let authorization: ReentryAuthorization | null = null;
    for (const candidate of candidateAuthorizations) {
      const signal = result.signals.find(row =>
        row.assetId === predicted.assetId
        && row.action === 'BUY'
        && row.executed
        && row.signalDate === candidate.decisionDate
        && row.executionDate === candidate.executionDate
      ) ?? null;
      if (!signal) continue;
      reentry = signal;
      authorization = candidate;
      break;
    }

    const reservedAtReentry = reentry?.executionDate
      ? accrueReservedAmount(actualNet, exitSignal.executionDate, reentry.executionDate, replayInput)
      : 0;
    const actualSpend = reentry ? Math.max(0, reentry.notionalEur + reentry.feeEur) : 0;
    const used = reentry && authorization
      ? Math.min(reservedAtReentry, authorization.authorizedReserveSpendEur, actualSpend)
      : 0;
    episodes.push({
      assetId: predicted.assetId,
      ticker: predicted.ticker,
      exitDecisionDate: predicted.decisionDate,
      exitExecutionDate: exitSignal.executionDate,
      exitSignalId: exitSignal.id,
      netProceedsEur: actualNet,
      reentryDecisionDate: reentry?.signalDate ?? null,
      reentryExecutionDate: reentry?.executionDate ?? null,
      reentrySignalId: reentry?.id ?? null,
      reservedCashAtReentryEur: reservedAtReentry,
      reservedCashUsedEur: used,
      releasedRemainderEur: reentry ? Math.max(0, reservedAtReentry - used) : 0
    });
  }

  const events = episodes.flatMap((episode, index) => [
    { date: episode.exitExecutionDate, order: 1, type: 'EXIT' as const, index },
    ...(episode.reentryExecutionDate ? [{ date: episode.reentryExecutionDate, order: 0, type: 'REENTRY' as const, index }] : [])
  ]).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.index - b.index);
  const active = new Map<number, { amount: number; lastDate: string }>();
  let peakReservedCashEur = 0;
  for (const event of events) {
    for (const state of active.values()) {
      state.amount = accrueReservedAmount(state.amount, state.lastDate, event.date, replayInput);
      state.lastDate = event.date;
    }
    peakReservedCashEur = Math.max(peakReservedCashEur, [...active.values()].reduce((sum, row) => sum + row.amount, 0));
    if (event.type === 'REENTRY') active.delete(event.index);
    else active.set(event.index, { amount: episodes[event.index].netProceedsEur, lastDate: event.date });
    peakReservedCashEur = Math.max(peakReservedCashEur, [...active.values()].reduce((sum, row) => sum + row.amount, 0));
  }
  for (const state of active.values()) {
    state.amount = accrueReservedAmount(state.amount, state.lastDate, result.endDate, replayInput);
    state.lastDate = result.endDate;
  }
  const finalReservedCashEur = [...active.values()].reduce((sum, row) => sum + row.amount, 0);
  peakReservedCashEur = Math.max(peakReservedCashEur, finalReservedCashEur);

  return {
    policy: EXIT_PROCEEDS_CUSTODY_V1,
    reservationsCreated: episodes.length,
    reentriesExecuted: episodes.filter(row => row.reentryExecutionDate != null && row.reservedCashUsedEur > 0.01).length,
    netProceedsReservedEur: episodes.reduce((sum, row) => sum + row.netProceedsEur, 0),
    reservedCashUsedEur: episodes.reduce((sum, row) => sum + row.reservedCashUsedEur, 0),
    releasedRemainderEur: episodes.reduce((sum, row) => sum + row.releasedRemainderEur, 0),
    peakReservedCashEur,
    finalReservedCashEur,
    episodes
  };
}

export function runDynamicReplayWithRotationExperiment(
  input: ReplayRunInput,
  experiment: ReplayRotationExperiment = 'BASELINE',
  options: ReplayRotationExperimentOptions = {}
): DynamicReplayExperimentResult {
  const reentryFundingPolicy: ReentryFundingPolicy = options.reentryFundingPolicy ?? 'LEGACY';
  if (reentryFundingPolicy === EXIT_PROCEEDS_CUSTODY_V1) {
    if (experiment !== 'CORE_ARCHITECTURE_V1') throw new Error('PHASE4_REENTRY_REQUIRES_CORE_ARCHITECTURE_V1');
    if (input.simulationMode === 'HOLD_ONLY') throw new Error('PHASE4_REENTRY_REQUIRES_CUSTODIA_ENGINE');
    if (input.externalCashFlows?.length) throw new Error('PHASE4_REENTRY_V1_EXTERNAL_CASH_FLOWS_NOT_IN_PROTOCOL');
    if (input.taxSettings?.contextConfirmed) throw new Error('PHASE4_REENTRY_V1_REQUIRES_FROZEN_UNCONFIRMED_TAX_CONTEXT');
  }

  if (experiment === 'BASELINE') {
    const result = DynamicHistoricalReplayEngine.run(input) as DynamicReplayExperimentResult;
    result.coreSelectionAudit = [];
    result.reentryCustodyAudit = emptyReentryAudit('LEGACY');
    return result;
  }

  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const gateCounters: CoreGateV1Counters = { KEEP: 0, CORE: 0, CHALLENGER: 0 };
  const architectureCounters: CoreArchitectureV1Counters = {
    protectedCoreSales: 0,
    cappedNonCoreContributions: 0,
    salesReturnedToCore: 0,
    coreTopUps: 0
  };
  const alphaCounters: CoreAlphaV2Counters = {
    coreFundedTilts: 0,
    blockedNoExceptionalCandidate: 0,
    blockedCoreFloor: 0,
    blockedExistingFreshNonCoreOrder: 0
  };
  const coreSelectionAudit: ReplayDynamicCoreSelectionAuditEntry[] = [];
  const activeReservations = new Map<string, ActiveReservationState>();
  const pendingExits: PendingExitReservation[] = [];
  const allPredictedExits: PendingExitReservation[] = [];
  const reentryAuthorizations: ReentryAuthorization[] = [];

  const advanceResearchState = (evaluationInput: PortfolioEvaluationInput) => {
    if (reentryFundingPolicy !== EXIT_PROCEEDS_CUSTODY_V1) return;
    const date = replayDecisionDate(evaluationInput);

    for (let index = pendingExits.length - 1; index >= 0; index--) {
      const pending = pendingExits[index];
      if (pending.executionDate > date) continue;
      pendingExits.splice(index, 1);
      if (hasPosition(evaluationInput, input, pending.assetId)) continue;
      activeReservations.set(pending.assetId, {
        reservation: { assetId: pending.assetId, amountEur: pending.netProceedsEur, createdAt: pending.executionDate },
        ticker: pending.ticker,
        sourceDecisionDate: pending.decisionDate,
        sourceExitSignalId: pending.signalId,
        originalNetProceedsEur: pending.netProceedsEur,
        lastAccruedAt: pending.executionDate,
        pendingReentryDecisionDate: null,
        pendingReentryExecutionDate: null
      });
    }

    for (const [assetId, state] of [...activeReservations]) {
      state.reservation.amountEur = accrueReservedAmount(state.reservation.amountEur, state.lastAccruedAt, date, input);
      state.lastAccruedAt = date;
      if (state.pendingReentryExecutionDate && state.pendingReentryExecutionDate <= date && hasPosition(evaluationInput, input, assetId)) {
        activeReservations.delete(assetId);
      }
    }
  };

  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      advanceResearchState(evaluationInput);
      const baseline = originalEvaluate.call(PortfolioDecisionEngine, evaluationInput);
      const gated = applyCoreGateV1(evaluationInput, baseline, gateCounters);
      if (experiment === 'CORE_GATE_V1') return gated;

      const selection = selectDynamicCoreV1(evaluationInput, gated);
      coreSelectionAudit.push({
        decisionDate: evaluationInput.decision.asOfDate,
        selectedAssetId: selection.selectedAssetId,
        selectedTicker: selection.selected?.asset.ticker ?? null,
        incumbentAssetId: selection.incumbentAssetId,
        incumbentHealthy: selection.incumbentHealthy,
        incumbentState: selection.incumbentState,
        reason: selection.reason,
        candidates: selection.candidateScores.map(candidate => ({ ...candidate }))
      });

      const architecture = applyCoreArchitectureV1(evaluationInput, gated, architectureCounters);
      if (experiment === 'CORE_ARCHITECTURE_V1' && reentryFundingPolicy === EXIT_PROCEEDS_CUSTODY_V1) {
        const eligibleHealthExitAssetIds = architecture.existingPositions
          .filter(position => {
            if (!position.assetId || position.action !== 'EXIT') return false;
            const item = catalogItem(input, position.assetId);
            return item != null
              && item.instrumentType !== 'MUTUAL_FUND'
              && healthSnapshot(evaluationInput, position.assetId)?.action === 'EXIT';
          })
          .map(position => position.assetId!);
        const prepared = prepareExitProceedsCustodyV1(architecture, eligibleHealthExitAssetIds);
        const decisionDate = replayDecisionDate(evaluationInput);
        const activeReservationRows = [...activeReservations.values()].map(row => ({ ...row.reservation }));
        if (!commonExecutionDate(input, decisionDate, prepared.decision)) return prepared.decision;

        let referenceDecision = prepared.decision;
        let overlay = applyExitProceedsCustodyV1({
          result: architecture,
          prepared,
          scan: evaluationInput.scan,
          reservations: activeReservationRows,
          eligibleHealthExitAssetIds,
          rotationFundingByAssetId: predictedRotationFunding(input, evaluationInput, referenceDecision),
          executionPriceByAssetId: executionPricesForContributions(input, evaluationInput, referenceDecision),
          policy: reentryFundingPolicy
        });
        let executionDateStable = commonExecutionDate(input, decisionDate, referenceDecision)
          === commonExecutionDate(input, decisionDate, overlay.decision);

        for (let attempt = 0; !executionDateStable && attempt < 3; attempt++) {
          referenceDecision = overlay.decision;
          if (!commonExecutionDate(input, decisionDate, referenceDecision)) return referenceDecision;
          overlay = applyExitProceedsCustodyV1({
            result: architecture,
            prepared,
            scan: evaluationInput.scan,
            reservations: activeReservationRows,
            eligibleHealthExitAssetIds,
            rotationFundingByAssetId: predictedRotationFunding(input, evaluationInput, referenceDecision),
            executionPriceByAssetId: executionPricesForContributions(input, evaluationInput, referenceDecision),
            policy: reentryFundingPolicy
          });
          executionDateStable = commonExecutionDate(input, decisionDate, referenceDecision)
            === commonExecutionDate(input, decisionDate, overlay.decision);
        }
        if (!executionDateStable) throw new Error(`PHASE4_REENTRY_EXECUTION_DATE_NOT_STABLE:${decisionDate}`);

        for (const assetId of overlay.telemetry.qualifyingExitAssetIds) {
          if (activeReservations.has(assetId) || pendingExits.some(row => row.assetId === assetId)) continue;
          const predicted = predictEligibleExit(input, evaluationInput, overlay.decision, assetId);
          if (!predicted) throw new Error(`PHASE4_REENTRY_ELIGIBLE_EXIT_PREDICTION_REQUIRED:${assetId}`);
          pendingExits.push(predicted);
          allPredictedExits.push(predicted);
        }
        const executionDate = commonExecutionDate(input, decisionDate, overlay.decision);
        if (executionDate) {
          for (const assetId of overlay.telemetry.matchedReentryAssetIds) {
            const state = activeReservations.get(assetId);
            const authorizedReserveSpendEur = overlay.telemetry.reservedCashAuthorizedByAssetEur[assetId] ?? 0;
            if (!state || !(authorizedReserveSpendEur > 0.01)) continue;
            state.pendingReentryDecisionDate = decisionDate;
            state.pendingReentryExecutionDate = executionDate;
            const authorization: ReentryAuthorization = {
              assetId,
              sourceExitSignalId: state.sourceExitSignalId,
              decisionDate,
              executionDate,
              authorizedReserveSpendEur
            };
            const duplicate = reentryAuthorizations.some(row =>
              row.sourceExitSignalId === authorization.sourceExitSignalId
              && row.decisionDate === authorization.decisionDate
              && row.executionDate === authorization.executionDate
            );
            if (!duplicate) reentryAuthorizations.push(authorization);
          }
        }
        return overlay.decision;
      }
      if (experiment !== 'CORE_ALPHA_V2') return architecture;

      if (architecture.contributions.some(row => row.amountEur > 0.01)) {
        alphaCounters.blockedExistingFreshNonCoreOrder += 1;
        return architecture;
      }
      return applyCoreAlphaV2(evaluationInput, architecture, alphaCounters);
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = DynamicHistoricalReplayEngine.run(input) as DynamicReplayExperimentResult;
    result.coreSelectionAudit = coreSelectionAudit;
    result.reentryCustodyAudit = reentryFundingPolicy === EXIT_PROCEEDS_CUSTODY_V1
      ? finalizeReentryAudit(input, result, allPredictedExits, reentryAuthorizations)
      : emptyReentryAudit('LEGACY');

    const auditCarrier = (
      result.signals.find(signal => signal.executed === true)
      ?? result.signals.find(signal => signal.action === 'REDUCE' || signal.action === 'EXIT')
      ?? result.signals.find(signal => signal.action === 'BUY' || signal.action === 'ADD')
      ?? result.signals[0]
    ) as ReplaySignalWithAudit | undefined;
    if (auditCarrier) {
      auditCarrier.auditExtensions = {
        ...(auditCarrier.auditExtensions ?? {}),
        coreSelectionAudit: coreSelectionAudit.map(entry => ({
          ...entry,
          candidates: entry.candidates.map(candidate => ({ ...candidate }))
        })),
        ...(reentryFundingPolicy === EXIT_PROCEEDS_CUSTODY_V1 ? { reentryCustodyAudit: result.reentryCustodyAudit } : {})
      };
    }

    result.notes.push(
      `Replay CORE_GATE_V1 compartido: KEEP ${gateCounters.KEEP}, CORE ${gateCounters.CORE}, CHALLENGER ${gateCounters.CHALLENGER}.`,
      `CORE_GATE_V1: un incumbent todavía HOLD con consenso no negativo se conserva. El challenger sólo evita el core con evidencia excepcional causal (≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong}/10 STRONG previos, consenso ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus}, ventaja de score ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage} y ventaja frente a cash ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints} pp).`
    );

    if (experiment === 'CORE_ARCHITECTURE_V1' || experiment === 'CORE_ALPHA_V2') {
      const limits = CORE_ARCHITECTURE_V1_LIMITS[input.riskProfile];
      result.notes.push(
        `CORE_ARCHITECTURE_V1: core-sales tácticas protegidas ${architectureCounters.protectedCoreSales}, contribuciones no-core limitadas ${architectureCounters.cappedNonCoreContributions}, ventas devueltas a core ${architectureCounters.salesReturnedToCore}, top-ups de core ${architectureCounters.coreTopUps}.`,
        `Guardrails ${input.riskProfile}: no-core máximo ${(limits.maximumNonCoreShare * 100).toFixed(0)}%, cash operativo ${(limits.operationalCashReserveShare * 100).toFixed(0)}%. Core HEALTHY se mantiene; DEGRADED no recibe dinero nuevo; BROKEN se sustituye por un core sano o pasa a cash si ninguno existe.`,
        `Auditoría ${experiment}: ${coreSelectionAudit.length} decisiones de core exportadas en coreSelectionAudit con candidato elegido, estado incumbent, motivo y scores comparativos. Ninguna prioridad fija de producto participa en la selección productiva.`
      );
    }

    if (reentryFundingPolicy === EXIT_PROCEEDS_CUSTODY_V1) {
      result.notes.push(
        `${EXIT_PROCEEDS_CUSTODY_V1} research-only: ${result.reentryCustodyAudit.reservationsCreated} reservas creadas y ${result.reentryCustodyAudit.reentriesExecuted} reentradas realmente financiadas por custodia. El default productivo/replay continúa LEGACY.`,
        'La custodia V1 aplica sólo a EXIT completos de instrumentos cotizados no-core, usa neto de ejecución verificado post-run, protege notional+comisión, activa la protección desde la misma tanda donde nace la reserva y estabiliza la fecha NEXT_OPEN después de desacoplar RETURN_TO_CORE. El reach sólo cuenta BUY ejecutadas con autorización estructurada positiva de la reserva correspondiente.'
      );
    }

    if (experiment === 'CORE_ALPHA_V2') {
      const limits = CORE_ALPHA_V2_LIMITS[input.riskProfile];
      result.notes.push(
        `CORE_ALPHA_V2 candidato: tilts core→alpha ejecutables ${alphaCounters.coreFundedTilts}; bloqueados sin candidato excepcional ${alphaCounters.blockedNoExceptionalCandidate}; bloqueados por core floor/capacidad ${alphaCounters.blockedCoreFloor}; bloqueados porque V1 ya había emitido una orden financiada ${alphaCounters.blockedExistingFreshNonCoreOrder}.`,
        `CORE_ALPHA_V2 ${input.riskProfile}: core floor ${(limits.coreFloorShare * 100).toFixed(0)}%, máximo tilt nuevo por decisión ${(limits.maxCoreFundedTiltSharePerDecision * 100).toFixed(0)}%. Se exige HIGH_CONVICTION + ENTRY_STRONG, ≥${CORE_ALPHA_V2_THRESHOLDS.minPriorStrongObservations}/${CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions} STRONG, consenso ≥${CORE_ALPHA_V2_THRESHOLDS.minConsensusScore}, ${CORE_ALPHA_V2_THRESHOLDS.minFavorableVotes}/5 favorables, ventaja de selección vs core ≥${CORE_ALPHA_V2_THRESHOLDS.minRelativeSelectionScoreAdvantage} y ventaja relativa frente a cash ≥${CORE_ALPHA_V2_THRESHOLDS.minExcessVsCashAdvantagePctPoints} pp.`
      );
    }
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
