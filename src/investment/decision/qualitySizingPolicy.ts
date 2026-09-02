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

/**
 * Apply QUALITY_SIZING_V1 after the normal allocator has selected candidates and
 * stages. Rotation entries remain unchanged so the experiment isolates STARTER /
 * BUILD sizing from competitive-rotation semantics.
 */
export function applyQualitySizingOverlay(input: {
  result: PortfolioDecisionResult;
  scan: AssetUniverseScanResult;
}): PortfolioDecisionResult {
  const result = input.result;
  const beforeRecommended = result.recommendedNewInvestmentEur;
  let missingQuality = 0;
  let reducedRows = 0;
  let droppedRows = 0;

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

    const adjustedAmount = row.amountEur * sizing.multiplier;
    const minimum = minimumMeaningfulOrderEur({ result, scan: input.scan, contribution: row });
    if (adjustedAmount < minimum - 1e-9) {
      droppedRows++;
      return [];
    }
    if (sizing.multiplier < 1 - 1e-9) reducedRows++;
    const currentValue = Math.max(0, row.currentAssetValueEur ?? 0);
    return [{
      ...row,
      amountEur: adjustedAmount,
      executableTargetAssetValueEur: currentValue + adjustedAmount,
      reason: `${row.reason} QUALITY_SIZING_V1: Reliability ${sizing.reliabilityScore?.toFixed(1)}/100 · Opportunity ${sizing.opportunityScore?.toFixed(1)}/100 · composite ${sizing.compositeScore?.toFixed(1)}/100 (${sizing.tier}); se utiliza ${(sizing.multiplier * 100).toFixed(0)}% del importe previamente autorizado. El cap STARTER/BUILD original no aumenta.`
    }];
  });

  result.contributions = contributions;
  result.recommendedNewInvestmentEur = contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  const releasedBySizing = Math.max(0, beforeRecommended - result.recommendedNewInvestmentEur);
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + releasedBySizing);
  result.warnings.push(
    `QUALITY_SIZING_V1 experimental: ${reducedRows} STARTER/BUILD reducidos y ${droppedRows} órdenes descartadas por quedar bajo el mínimo ejecutable. Ningún cap aumenta; ROTATION_ENTRY conserva sizing original.`
  );
  if (missingQuality > 0) result.warnings.push(`QUALITY_SIZING_V1: ${missingQuality} contribuciones no tenían quality causal utilizable y conservaron explícitamente sizing LEGACY.`);
  return result;
}
