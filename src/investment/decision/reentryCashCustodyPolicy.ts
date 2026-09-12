import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { brokerCommission } from './costAwareExecutionPolicy';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { isStrategicGrowthCoreAssetId } from './portfolioAssetRole';
import type { ContributionRecommendation, PortfolioDecisionResult, PortfolioPositionDecision } from './portfolioDecisionEngine';

export type ReentryFundingPolicy = 'LEGACY' | 'EXIT_PROCEEDS_CUSTODY_V1';

export const EXIT_PROCEEDS_CUSTODY_V1 = 'EXIT_PROCEEDS_CUSTODY_V1' as const;
export const REENTRY_CUSTODY_EXIT_MARKER = `[${EXIT_PROCEEDS_CUSTODY_V1}:RESERVE_EXIT_PROCEEDS]` as const;

export interface ReentryCashReservation {
  assetId: string;
  amountEur: number;
  createdAt: string;
}

export interface ReentryCashCustodyDecisionTelemetry {
  policy: ReentryFundingPolicy;
  qualifyingExitAssetIds: string[];
  detachedReturnToCoreEur: number;
  nominalReservedCashEur: number;
  effectiveReservedCashEur: number;
  freeBaseDeployableEur: number;
  dedicatedRotationFundingEur: number;
  reservedCashAuthorizedForReentryEur: number;
  matchedReentryAssetIds: string[];
}

export interface ReentryCashCustodyDecisionResult {
  decision: PortfolioDecisionResult;
  telemetry: ReentryCashCustodyDecisionTelemetry;
}

function cloneDecision(result: PortfolioDecisionResult): PortfolioDecisionResult {
  return {
    ...result,
    exposures: result.exposures.map(row => ({ ...row })),
    existingPositions: result.existingPositions.map(row => ({ ...row })),
    contributions: result.contributions.map(row => ({ ...row })),
    warnings: [...result.warnings]
  };
}

function plannedSaleValue(position: PortfolioPositionDecision): number {
  const value = Math.max(0, position.currentValueEur ?? 0);
  if (position.action === 'EXIT') return value;
  if (position.action === 'REDUCE') return value * Math.max(0, Math.min(100, position.suggestedReductionPct ?? 50)) / 100;
  return 0;
}

function refreshPlanningTotals(result: PortfolioDecisionResult, oldRotationProceeds: number, oldRecommended: number): void {
  const newRotationProceeds = result.existingPositions
    .filter(position => (position.action === 'EXIT' || position.action === 'REDUCE') && position.rotationChallengerAssetId)
    .reduce((sum, position) => sum + plannedSaleValue(position), 0);
  const newRecommended = result.contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.plannedRotationProceedsEur = newRotationProceeds;
  result.deployableToAssetsEur = Math.max(0, result.deployableToAssetsEur + newRotationProceeds - oldRotationProceeds);
  result.recommendedNewInvestmentEur = newRecommended;
  result.residualPlannedCashEur = Math.max(
    0,
    result.residualPlannedCashEur + (newRotationProceeds - oldRotationProceeds) - (newRecommended - oldRecommended)
  );
}

function reduceContributionAmount(row: ContributionRecommendation, reductionEur: number): number {
  const previous = Math.max(0, row.amountEur);
  const next = Math.max(0, previous - Math.max(0, reductionEur));
  const actualReduction = previous - next;
  row.amountEur = next;
  if (row.targetAssetValueEur != null) {
    const floor = Math.max(0, row.currentAssetValueEur ?? 0);
    row.targetAssetValueEur = Math.max(floor, row.targetAssetValueEur - actualReduction);
  }
  if (row.executableTargetAssetValueEur != null) {
    const floor = Math.max(0, row.currentAssetValueEur ?? 0);
    row.executableTargetAssetValueEur = Math.max(floor, row.executableTargetAssetValueEur - actualReduction);
  }
  return actualReduction;
}

function detachEligibleHealthExits(
  result: PortfolioDecisionResult,
  eligibleHealthExitAssetIds: ReadonlySet<string>
): { qualifyingExitAssetIds: string[]; detachedReturnToCoreEur: number } {
  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  const qualifyingExitAssetIds: string[] = [];
  let detachedReturnToCoreEur = 0;

  for (const position of result.existingPositions) {
    if (
      position.action !== 'EXIT'
      || !position.assetId
      || isStrategicGrowthCoreAssetId(position.assetId)
      || !eligibleHealthExitAssetIds.has(position.assetId)
    ) continue;

    const routedToStrategicCore = Boolean(
      position.rotationChallengerAssetId
      && isStrategicGrowthCoreAssetId(position.rotationChallengerAssetId)
    );
    const ordinaryHealthExit = !position.rotationChallengerAssetId;
    if (!routedToStrategicCore && !ordinaryHealthExit) continue;

    const exitValueEur = Math.max(0, position.currentValueEur ?? 0);
    if (routedToStrategicCore && position.rotationChallengerAssetId && exitValueEur > 0) {
      const coreContribution = result.contributions.find(row => row.assetId === position.rotationChallengerAssetId);
      if (coreContribution) {
        const removed = reduceContributionAmount(coreContribution, exitValueEur);
        detachedReturnToCoreEur += removed;
        coreContribution.reason += ` [${EXIT_PROCEEDS_CUSTODY_V1}] Se desacopla únicamente el importe procedente de este EXIT de salud; el resto de la contribución core conserva su semántica original.`;
      }
      position.rotationChallengerAssetId = null;
      position.rotationChallengerTicker = null;
      position.rotationAdvantageScore = null;
      position.rotationChallengerRecentStrongCount = null;
      position.rotationChallengerPersistenceLookbackSessions = null;
    }

    // Audit-only text. Eligibility has already been decided exclusively from the
    // structured `eligibleHealthExitAssetIds` set above.
    position.reason = `${position.reason} ${REENTRY_CUSTODY_EXIT_MARKER} El neto realmente ejecutado quedará en cash remunerado y reservado para una primera reentrada normal del mismo activo; no se relaja ningún gate.`;
    qualifyingExitAssetIds.push(position.assetId);
  }

  result.contributions = result.contributions.filter(row => row.amountEur > 0.01);
  refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
  return { qualifyingExitAssetIds, detachedReturnToCoreEur };
}

/**
 * Convert nominal reservations into the portion that is economically protectable
 * on the current decision date. If withdrawals or other cash uses make the real
 * cash insufficient to protect every reservation in full, all active reservations
 * are reduced pro-rata. No reservation gets a hidden first-in/first-out priority.
 */
export function effectiveReentryReservations(input: {
  reservations: readonly ReentryCashReservation[];
  currentCashEur: number;
  pendingCapitalEur: number;
  targetCashEur: number;
  baseDeployableToAssetsEur: number;
}): Map<string, number> {
  const active = [...input.reservations]
    .filter(row => row.amountEur > 0.01)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.assetId.localeCompare(b.assetId));
  const out = new Map<string, number>();
  if (!active.length) return out;

  const cashNeededForTargetAfterPending = Math.max(0, input.targetCashEur - Math.max(0, input.pendingCapitalEur));
  const cashAboveTarget = Math.max(0, input.currentCashEur - cashNeededForTargetAfterPending);
  const protectableCapacity = Math.min(Math.max(0, input.baseDeployableToAssetsEur), cashAboveTarget);
  const totalNominal = active.reduce((sum, reservation) => sum + reservation.amountEur, 0);
  if (protectableCapacity <= 0.01 || totalNominal <= 0.01) return out;

  const scale = Math.min(1, protectableCapacity / totalNominal);
  for (const reservation of active) {
    const amount = reservation.amountEur * scale;
    if (amount > 0.01) out.set(reservation.assetId, amount);
  }
  return out;
}

/**
 * Cash available to one executable plan while respecting reservations belonging
 * to other assets. `dedicatedProceedsEur` is cash generated by the plan's own
 * atomic paired sale. It remains spendable by that paired buy while reservations
 * belonging to other assets stay protected.
 */
export function availableCashRespectingReentryReservations(
  cashEur: number,
  reservations: readonly ReentryCashReservation[],
  matchingAssetId?: string | null,
  dedicatedProceedsEur = 0
): number {
  const cash = Math.max(0, cashEur);
  const dedicated = Math.min(cash, Math.max(0, dedicatedProceedsEur));
  const sharedCash = Math.max(0, cash - dedicated);
  const protectedOtherReservations = reservations
    .filter(row => row.amountEur > 0.01 && (!matchingAssetId || row.assetId !== matchingAssetId))
    .reduce((sum, row) => sum + row.amountEur, 0);
  const protectedFromSharedCash = Math.min(sharedCash, protectedOtherReservations);
  return Math.max(0, Math.min(cash, dedicated + sharedCash - protectedFromSharedCash));
}

function minimumExecutableNotional(
  contribution: ContributionRecommendation,
  scan: AssetUniverseScanResult,
  totalPlannedCapitalEur: number,
  executionPriceEur?: number | null
): number {
  const policy = executionPolicyForCapital(totalPlannedCapitalEur);
  if (contribution.instrumentType === 'MUTUAL_FUND') return policy.minimumOrderNotionalEur;
  const candidate = scan.candidates.find(row => row.asset.assetId === contribution.assetId);
  const price = executionPriceEur != null && executionPriceEur > 0 ? executionPriceEur : candidate?.lastClose ?? null;
  const wholeShareNotional = price != null && price > 0 ? price : 0;
  return Math.max(policy.minimumOrderNotionalEur, wholeShareNotional);
}

function maxNotionalWithinSpendBudget(input: {
  contribution: ContributionRecommendation;
  originalNotionalEur: number;
  spendBudgetEur: number;
  executionPriceEur?: number | null;
  totalPlannedCapitalEur: number;
}): number {
  const original = Math.max(0, input.originalNotionalEur);
  const budget = Math.max(0, input.spendBudgetEur);
  if (input.contribution.instrumentType === 'MUTUAL_FUND') return Math.min(original, budget);

  const price = Number(input.executionPriceEur);
  if (!(price > 0)) throw new Error(`PHASE4_REENTRY_EXECUTION_PRICE_REQUIRED:${input.contribution.assetId}`);
  const policy = executionPolicyForCapital(input.totalPlannedCapitalEur);
  let units = Math.floor(Math.min(original, budget) / price + 1e-9);
  while (units > 0) {
    const notional = units * price;
    const fee = brokerCommission(notional);
    const feeDragPct = notional > 0 ? fee / notional * 100 : Infinity;
    if (
      notional <= original + 1e-9
      && notional + fee <= budget + 1e-9
      && notional >= policy.minimumOrderNotionalEur - 1e-9
      && feeDragPct <= policy.maximumOrderFeeDragPct + 1e-9
    ) return notional;
    units--;
  }
  return 0;
}

function spendForNotional(contribution: ContributionRecommendation, notionalEur: number): number {
  const notional = Math.max(0, notionalEur);
  return contribution.instrumentType === 'MUTUAL_FUND' ? notional : notional + brokerCommission(notional);
}

/**
 * Research-only funding overlay for Phase 4.
 *
 * It never creates a contribution, never increases one above the canonical
 * decision and never changes eligibility/timing. It only withholds cash reserved
 * by prior full listed non-core health EXITs and lets a matching ordinary
 * contribution use its own reservation.
 *
 * When custody is economically active, every funding allowance is a total cash
 * spend allowance, not merely a notional allowance. Therefore listed purchases
 * must fit `notional + commission` inside their authorised cash. This prevents an
 * unrelated order from paying its fee with another asset's protected reserve.
 */
export function applyExitProceedsCustodyV1(input: {
  result: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
  reservations: readonly ReentryCashReservation[];
  eligibleHealthExitAssetIds: readonly string[];
  rotationFundingByAssetId?: Readonly<Record<string, number>>;
  executionPriceByAssetId?: Readonly<Record<string, number>>;
  policy: ReentryFundingPolicy;
}): ReentryCashCustodyDecisionResult {
  if (input.policy !== EXIT_PROCEEDS_CUSTODY_V1) {
    return {
      decision: input.result,
      telemetry: {
        policy: input.policy,
        qualifyingExitAssetIds: [],
        detachedReturnToCoreEur: 0,
        nominalReservedCashEur: 0,
        effectiveReservedCashEur: 0,
        freeBaseDeployableEur: Math.max(0, input.result.deployableToAssetsEur - input.result.plannedRotationProceedsEur),
        dedicatedRotationFundingEur: 0,
        reservedCashAuthorizedForReentryEur: 0,
        matchedReentryAssetIds: []
      }
    };
  }

  const result = cloneDecision(input.result);
  const detached = detachEligibleHealthExits(result, new Set(input.eligibleHealthExitAssetIds));
  const reservations = [...input.reservations].filter(row => row.amountEur > 0.01);
  const custodyAffectsExecution = reservations.length > 0 || detached.qualifyingExitAssetIds.length > 0;
  const nominalReservedCashEur = reservations.reduce((sum, row) => sum + row.amountEur, 0);

  // Exact baseline parity until custody actually exists or a qualifying EXIT is
  // being created in this same batch. Structured funding diagnostics have no
  // economic authority before that boundary.
  if (!custodyAffectsExecution) {
    return {
      decision: result,
      telemetry: {
        policy: input.policy,
        qualifyingExitAssetIds: [],
        detachedReturnToCoreEur: 0,
        nominalReservedCashEur: 0,
        effectiveReservedCashEur: 0,
        freeBaseDeployableEur: Math.max(0, result.deployableToAssetsEur - result.plannedRotationProceedsEur),
        dedicatedRotationFundingEur: 0,
        reservedCashAuthorizedForReentryEur: 0,
        matchedReentryAssetIds: []
      }
    };
  }

  const baseDeployable = Math.max(0, result.deployableToAssetsEur - result.plannedRotationProceedsEur);
  const effectiveByAsset = effectiveReentryReservations({
    reservations,
    currentCashEur: result.currentCashEur,
    pendingCapitalEur: result.pendingCapitalEur,
    targetCashEur: result.targetCashEur,
    baseDeployableToAssetsEur: baseDeployable
  });
  const effectiveReservedCashEur = [...effectiveByAsset.values()].reduce((sum, amount) => sum + amount, 0);
  const freeBaseDeployableEur = Math.max(0, baseDeployable - effectiveReservedCashEur);

  const hasRotationEntries = result.contributions.some(row => row.positionStage === 'ROTATION_ENTRY' && row.amountEur > 0.01);
  if (hasRotationEntries && input.rotationFundingByAssetId == null) {
    throw new Error('PHASE4_REENTRY_ROTATION_FUNDING_REQUIRED_WHILE_CUSTODY_ACTIVE');
  }
  const structuredRotationFunding = input.rotationFundingByAssetId == null
    ? null
    : new Map(Object.entries(input.rotationFundingByAssetId).map(([assetId, amount]) => [assetId, Math.max(0, Number(amount) || 0)]));

  let remainingLegacyRotationEur = Math.max(0, result.plannedRotationProceedsEur);
  let dedicatedRotationFundingEur = 0;
  const rows = result.contributions.map(row => ({
    row,
    originalAmount: Math.max(0, row.amountEur),
    rotationCoverage: 0,
    reentryCoverage: 0,
    residualDemand: 0
  }));

  for (const item of rows) {
    let remaining = item.originalAmount;
    if (item.row.positionStage === 'ROTATION_ENTRY') {
      const availableRotationFunding = structuredRotationFunding == null
        ? remainingLegacyRotationEur
        : (structuredRotationFunding.get(item.row.assetId) ?? 0);
      if (availableRotationFunding > 0.01) {
        item.rotationCoverage = Math.min(remaining, availableRotationFunding);
        remaining -= item.rotationCoverage;
        dedicatedRotationFundingEur += item.rotationCoverage;
        if (structuredRotationFunding == null) remainingLegacyRotationEur -= item.rotationCoverage;
      }
    }
    const ownReservation = effectiveByAsset.get(item.row.assetId) ?? 0;
    if (remaining > 0.01 && ownReservation > 0.01 && (item.row.currentAssetValueEur ?? 0) <= 0.01) {
      item.reentryCoverage = Math.min(remaining, ownReservation);
      remaining -= item.reentryCoverage;
    }
    item.residualDemand = Math.max(0, remaining);
  }

  const totalResidualDemand = rows.reduce((sum, item) => sum + item.residualDemand, 0);
  const freeScale = totalResidualDemand > 0.01 ? Math.min(1, freeBaseDeployableEur / totalResidualDemand) : 0;
  let reservedCashAuthorizedForReentryEur = 0;
  const matchedReentryAssetIds: string[] = [];

  const adjusted: ContributionRecommendation[] = [];
  for (const item of rows) {
    // Funding components are cash-spend budgets. A listed order's commission must
    // fit inside this amount; otherwise it would borrow from protected cash.
    const spendBudget = Math.min(
      item.originalAmount,
      item.rotationCoverage + item.reentryCoverage + item.residualDemand * freeScale
    );
    const executionPrice = input.executionPriceByAssetId?.[item.row.assetId] ?? null;
    const finalAmount = maxNotionalWithinSpendBudget({
      contribution: item.row,
      originalNotionalEur: item.originalAmount,
      spendBudgetEur: spendBudget,
      executionPriceEur: executionPrice,
      totalPlannedCapitalEur: result.totalPlannedCapitalEur
    });
    const minimum = minimumExecutableNotional(item.row, input.scan, result.totalPlannedCapitalEur, executionPrice);
    if (finalAmount < minimum - 1e-9) continue;

    const row = { ...item.row, amountEur: finalAmount };
    if (row.targetAssetValueEur != null) row.targetAssetValueEur = Math.max(0, row.currentAssetValueEur ?? 0) + finalAmount;
    if (row.executableTargetAssetValueEur != null) row.executableTargetAssetValueEur = Math.max(0, row.currentAssetValueEur ?? 0) + finalAmount;
    if (item.reentryCoverage > 0.01) {
      const actualSpend = spendForNotional(row, finalAmount);
      reservedCashAuthorizedForReentryEur += Math.min(item.reentryCoverage, actualSpend);
      matchedReentryAssetIds.push(row.assetId);
      row.reason += ` [${EXIT_PROCEEDS_CUSTODY_V1}:REENTRY_FUNDED] La reserva propia puede financiar hasta ${Math.min(item.reentryCoverage, actualSpend).toFixed(2)} € de gasto total (notional + comisión cuando aplique); la elegibilidad y el sizing máximo siguen siendo los de la cadena canónica.`;
    }
    adjusted.push(row);
  }

  const oldRecommended = result.recommendedNewInvestmentEur;
  result.contributions = adjusted;
  result.recommendedNewInvestmentEur = adjusted.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + oldRecommended - result.recommendedNewInvestmentEur);
  result.warnings.push(
    `${EXIT_PROCEEDS_CUSTODY_V1} research-only: ${nominalReservedCashEur.toFixed(2)} € nominales ya reservados; ${effectiveReservedCashEur.toFixed(2)} € afectan al cash desplegable de esta decisión. Si nace una reserva en esta misma ejecución, sus proceeds quedan fuera de otras compras desde esa tanda. Los límites de financiación de compras cotizadas incluyen comisión.`
  );

  return {
    decision: result,
    telemetry: {
      policy: input.policy,
      qualifyingExitAssetIds: detached.qualifyingExitAssetIds,
      detachedReturnToCoreEur: detached.detachedReturnToCoreEur,
      nominalReservedCashEur,
      effectiveReservedCashEur,
      freeBaseDeployableEur,
      dedicatedRotationFundingEur,
      reservedCashAuthorizedForReentryEur,
      matchedReentryAssetIds: [...new Set(matchedReentryAssetIds)].sort()
    }
  };
}
