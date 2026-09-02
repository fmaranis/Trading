import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { assessAssetSelectionQuality } from './assetSelectionQuality';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { brokerCommission } from './costAwareExecutionPolicy';
import type { ContributionRecommendation, PortfolioDecisionResult } from './portfolioDecisionEngine';

export type QualitySizingTier = 'FULL_CAP' | 'STRONG' | 'ADEQUATE' | 'FRAGILE' | 'QUALITY_UNAVAILABLE';

export interface QualitySizingAssessment {
  reliabilityScore: number | null;
  opportunityScore: number | null;
  compositeScore: number | null;
  multiplier: number;
  tier: QualitySizingTier;
  evidenceAvailable: boolean;
}

function qualityForAsset(scan: AssetUniverseScanResult, assetId: string) {
  const candidate = scan.candidates.find(row => row.asset.assetId === assetId);
  if (!candidate || candidate.status !== 'ACCEPTED') return null;
  if (Number.isFinite(candidate.reliabilityScore) && Number.isFinite(candidate.opportunityScore)) {
    return {
      reliabilityScore: Number(candidate.reliabilityScore),
      opportunityScore: Number(candidate.opportunityScore)
    };
  }
  const series = scan.acceptedDataset.assets.find(asset => asset.assetId === assetId);
  if (!series) return null;
  const prices = series.bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
  if (prices.length < 121) return null;
  const quality = assessAssetSelectionQuality({
    prices,
    momentum20Pct: candidate.momentum20Pct,
    momentum60Pct: candidate.momentum60Pct,
    momentum120Pct: candidate.momentum120Pct,
    annualizedVolatilityPct: candidate.annualizedVolatilityPct,
    maxDrawdownPct: candidate.maxDrawdownPct
  });
  return {
    reliabilityScore: quality.reliabilityScore,
    opportunityScore: quality.opportunityScore
  };
}

/**
 * Conservative sizing only: quality can reduce an existing STARTER/BUILD cap,
 * never raise it. Thresholds are design tiers, not fitted historical optima.
 * High-quality opportunities retain the complete pre-existing cap; weaker
 * opportunities receive progressively smaller fractions of that same cap.
 */
export function assessQualitySizing(reliabilityScore: number | null | undefined, opportunityScore: number | null | undefined): QualitySizingAssessment {
  if (!Number.isFinite(reliabilityScore) || !Number.isFinite(opportunityScore)) {
    return {
      reliabilityScore: null,
      opportunityScore: null,
      compositeScore: null,
      multiplier: 1,
      tier: 'QUALITY_UNAVAILABLE',
      evidenceAvailable: false
    };
  }
  const reliability = Math.max(0, Math.min(100, Number(reliabilityScore)));
  const opportunity = Math.max(0, Math.min(100, Number(opportunityScore)));
  const composite = reliability * 0.45 + opportunity * 0.55;
  if (composite >= 80) return { reliabilityScore: reliability, opportunityScore: opportunity, compositeScore: composite, multiplier: 1, tier: 'FULL_CAP', evidenceAvailable: true };
  if (composite >= 70) return { reliabilityScore: reliability, opportunityScore: opportunity, compositeScore: composite, multiplier: 0.90, tier: 'STRONG', evidenceAvailable: true };
  if (composite >= 60) return { reliabilityScore: reliability, opportunityScore: opportunity, compositeScore: composite, multiplier: 0.80, tier: 'ADEQUATE', evidenceAvailable: true };
  return { reliabilityScore: reliability, opportunityScore: opportunity, compositeScore: composite, multiplier: 0.65, tier: 'FRAGILE', evidenceAvailable: true };
}

function minimumMeaningfulOrderEur(input: {
  result: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
  contribution: ContributionRecommendation;
}): number {
  const policy = executionPolicyForCapital(input.result.totalPlannedCapitalEur);
  const candidate = input.scan.candidates.find(row => row.asset.assetId === input.contribution.assetId);
  const lastClose = candidate?.lastClose ?? null;
  const wholeShareFloor = input.contribution.instrumentType === 'ETF_ETC' && lastClose != null && lastClose > 0
    ? lastClose + brokerCommission(lastClose)
    : 0;
  return Math.max(policy.minimumOrderNotionalEur, wholeShareFloor);
}

function qualityAdjustedStageTargetEur(input: {
  result: PortfolioDecisionResult;
  contribution: ContributionRecommendation;
  multiplier: number;
}): number | null {
  const capPct = input.contribution.portfolioShareCapPct;
  if (!Number.isFinite(capPct) || Number(capPct) <= 0) return null;
  const originalStageCapEur = input.result.totalPlannedCapitalEur * Number(capPct) / 100;
  return Math.max(0, originalStageCapEur * input.multiplier);
}

/**
 * Apply QUALITY_SIZING_V1 after the normal allocator has selected candidates and
 * stages. Rotation entries remain unchanged so the experiment isolates STARTER /
 * BUILD sizing from competitive-rotation semantics.
 *
 * The quality multiplier is applied to the absolute stage cap, not to the order
 * remainder. This is essential: applying 80% to today's remainder would cause the
 * allocator to try to fill the remaining 20% again on later sessions and would
 * turn a conservative sizing rule into repeated micro-builds. The adjusted cap is
 * recomputed causally each evaluation; quality can later authorize more capital if
 * it genuinely improves, but a stable score does not repeatedly refill the old cap.
 */
export function applyQualitySizingOverlay(input: {
  result: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
}): PortfolioDecisionResult {
  const result = input.result;
  const beforeRecommended = result.recommendedNewInvestmentEur;
  let missingQuality = 0;
  let missingStageCap = 0;
  let reducedRows = 0;
  let droppedRows = 0;
  let alreadyAtAdjustedCap = 0;

  const contributions = result.contributions.flatMap(row => {
    if (row.positionStage === 'ROTATION_ENTRY') return [row];
    const quality = qualityForAsset(input.scan, row.assetId);
    const sizing = assessQualitySizing(quality?.reliabilityScore, quality?.opportunityScore);
    if (!sizing.evidenceAvailable) {
      missingQuality++;
      return [{
        ...row,
        reason: `${row.reason} QUALITY_SIZING_V1: quality no disponible; se conserva explícitamente el sizing LEGACY sin fallback oculto.`
      }];
    }

    const adjustedStageTargetEur = qualityAdjustedStageTargetEur({ result, contribution: row, multiplier: sizing.multiplier });
    if (adjustedStageTargetEur == null) {
      missingStageCap++;
      return [{
        ...row,
        reason: `${row.reason} QUALITY_SIZING_V1: falta portfolioShareCapPct auditable; se conserva sizing LEGACY en lugar de inventar un cap.`
      }];
    }

    const currentValue = Math.max(0, row.currentAssetValueEur ?? 0);
    const remainingToAdjustedCap = Math.max(0, adjustedStageTargetEur - currentValue);
    const adjustedAmount = Math.min(Math.max(0, row.amountEur), remainingToAdjustedCap);

    if (adjustedAmount <= 1e-9) {
      alreadyAtAdjustedCap++;
      return [];
    }

    const minimum = minimumMeaningfulOrderEur({ result, scan: input.scan, contribution: row });
    if (adjustedAmount < minimum - 1e-9) {
      droppedRows++;
      return [];
    }
    if (adjustedAmount < row.amountEur - 1e-9) reducedRows++;

    return [{
      ...row,
      amountEur: adjustedAmount,
      executableTargetAssetValueEur: currentValue + adjustedAmount,
      portfolioShareCapPct: Number(row.portfolioShareCapPct) * sizing.multiplier,
      reason: `${row.reason} QUALITY_SIZING_V1: Reliability ${sizing.reliabilityScore?.toFixed(1)}/100 · Opportunity ${sizing.opportunityScore?.toFixed(1)}/100 · composite ${sizing.compositeScore?.toFixed(1)}/100 (${sizing.tier}); cap persistente de etapa ${(Number(row.portfolioShareCapPct) * sizing.multiplier).toFixed(2)}% del patrimonio frente a ${Number(row.portfolioShareCapPct).toFixed(2)}% LEGACY. Nunca se aumenta el cap original.`
    }];
  });

  result.contributions = contributions;
  result.recommendedNewInvestmentEur = contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  const releasedBySizing = Math.max(0, beforeRecommended - result.recommendedNewInvestmentEur);
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + releasedBySizing);
  result.warnings.push(
    `QUALITY_SIZING_V1 experimental: ${reducedRows} STARTER/BUILD reducidos, ${alreadyAtAdjustedCap} ya cubrían el cap quality y ${droppedRows} órdenes quedaron bajo el mínimo ejecutable. El cap quality es persistente por etapa; ROTATION_ENTRY conserva sizing original.`
  );
  if (missingQuality > 0) result.warnings.push(`QUALITY_SIZING_V1: ${missingQuality} contribuciones no tenían quality causal utilizable y conservaron explícitamente sizing LEGACY.`);
  if (missingStageCap > 0) result.warnings.push(`QUALITY_SIZING_V1: ${missingStageCap} contribuciones no exponían portfolioShareCapPct y conservaron explícitamente sizing LEGACY.`);
  return result;
}
