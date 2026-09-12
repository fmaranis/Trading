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

function detachReturnToCore(result: PortfolioDecisionResult): { qualifyingExitAssetIds: string[]; detachedReturnToCoreEur: number } {
  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  const qualifyingExitAssetIds: string[] = [];
  let detachedReturnToCoreEur = 0;

  for (const position of result.existingPositions) {
    if (position.action !== 'EXIT' || !position.assetId || isStrategicGrowthCoreAssetId(position.assetId)) continue;

    const routedToCore = Boolean(
      position.rotationChallengerAssetId
      && isStrategicGrowthCoreAssetId(position.rotationChallengerAssetId)
      && position.reason.includes('[CORE_ARCHITECTURE_V1:RETURN_TO_CORE]')
    );
    const ordinaryHealthExit = !position.rotationChallengerAssetId;
    if (!routedToCore && !ordinaryHealthExit) continue;

    const exitValueEur = Math.max(0, position.currentValueEur ?? 0);
    if (routedToCore && position.rotationChallengerAssetId && exitValueEur > 0) {
      const coreContribution = result.contributions.find(row => row.assetId === position.rotationChallengerAssetId);
      if (coreContribution) {
        const removed = reduceContributionAmount(coreContribution, exitValueEur);
        detachedReturnToCoreEur += removed;
        coreContribution.reason += ` [${EXIT_PROCEEDS_CUSTODY_V1}] Se desacopla únicamente el importe procedente de este EXIT no-core; el resto de la contribución core conserva su semántica original.`;
      }
      position.rotationChallengerAssetId = null;
      position.rotationChallengerTicker = null;
      position.rotationAdvantageScore = null;
      position.rotationChallengerRecentStrongCount = null;
      position.rotationChallengerPersistenceLookbackSessions = null;
    }

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
 * to other assets. `dedicatedProceedsEur` is cash that was generated by the plan's
 * own atomic paired sale in the same execution batch. It must remain spendable by
 * that paired buy even when pre-existing cash is fully reserved; otherwise the
 * executor could sell an incumbent after the atomic precheck and then block its
 * challenger, violating the 1:1 rotation invariant.
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

function minimumExecutableAmount(
  contribution: ContributionRecommendation,
  scan: AssetUniverseScanResult,
  totalPlannedCapitalEur: number
): number {
  const policy = executionPolicyForCapital(totalPlannedCapitalEur);
  if (contribution.instrumentType === 'MUTUAL_FUND') return policy.minimumOrderNotionalEur;
  const candidate = scan.candidates.find(row => row.asset.assetId === contribution.assetId);
  const price = candidate?.lastClose ?? null;
  const wholeShareFloor = price != null && price > 0 ? price + brokerCommission(price) : 0;
  return Math.max(policy.minimumOrderNotionalEur, wholeShareFloor);
}

/**
 * Research-only funding overlay for Phase 4.
 *
 * It never creates a contribution, never increases one above the canonical
 * decision and never changes eligibility/timing. It only withholds cash already
 * reserved by prior full non-core EXITs and lets a matching ordinary contribution
 * use its own reservation.
 */
export function applyExitProceedsCustodyV1(input: {
  result: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
  reservations: readonly ReentryCashReservation[];
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
        reservedCashAuthorizedForReentryEur: 0,
        matchedReentryAssetIds: []
      }
    };
  }

  const result = cloneDecision(input.result);
  const detached = detachReturnToCore(result);
  const reservations = [...input.reservations].filter(row => row.amountEur > 0.01);
  const nominalReservedCashEur = reservations.reduce((sum, row) => sum + row.amountEur, 0);
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

  let remainingRotationEur = Math.max(0, result.plannedRotationProceedsEur);
  const rows = result.contributions.map(row => ({
    row,
    originalAmount: Math.max(0, row.amountEur),
    rotationCoverage: 0,
    reentryCoverage: 0,
    residualDemand: 0
  }));

  for (const item of rows) {
    let remaining = item.originalAmount;
    if (item.row.positionStage === 'ROTATION_ENTRY' && remainingRotationEur > 0.01) {
      item.rotationCoverage = Math.min(remaining, remainingRotationEur);
      remaining -= item.rotationCoverage;
      remainingRotationEur -= item.rotationCoverage;
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
    const finalAmount = Math.min(
      item.originalAmount,
      item.rotationCoverage + item.reentryCoverage + item.residualDemand * freeScale
    );
    const minimum = minimumExecutableAmount(item.row, input.scan, result.totalPlannedCapitalEur);
    if (finalAmount < minimum - 1e-9) continue;
    const row = { ...item.row, amountEur: finalAmount };
    if (row.targetAssetValueEur != null) row.targetAssetValueEur = Math.max(0, row.currentAssetValueEur ?? 0) + finalAmount;
    if (row.executableTargetAssetValueEur != null) row.executableTargetAssetValueEur = Math.max(0, row.currentAssetValueEur ?? 0) + finalAmount;
    if (item.reentryCoverage > 0.01) {
      reservedCashAuthorizedForReentryEur += item.reentryCoverage;
      matchedReentryAssetIds.push(row.assetId);
      row.reason += ` [${EXIT_PROCEEDS_CUSTODY_V1}:REENTRY_FUNDED] Hasta ${item.reentryCoverage.toFixed(2)} € proceden de la reserva del EXIT previo; la elegibilidad y el sizing máximo siguen siendo los de la cadena canónica.`;
    }
    adjusted.push(row);
  }

  const oldRecommended = result.recommendedNewInvestmentEur;
  result.contributions = adjusted;
  result.recommendedNewInvestmentEur = adjusted.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + oldRecommended - result.recommendedNewInvestmentEur);
  result.warnings.push(
    `${EXIT_PROCEEDS_CUSTODY_V1} research-only: ${nominalReservedCashEur.toFixed(2)} € nominales reservados; ${effectiveReservedCashEur.toFixed(2)} € afectan al cash desplegable de esta decisión. La reserva no crea señal ni aumenta sizing; sólo financia la primera reentrada normal del mismo activo.`
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
      reservedCashAuthorizedForReentryEur,
      matchedReentryAssetIds: [...new Set(matchedReentryAssetIds)].sort()
    }
  };
}
