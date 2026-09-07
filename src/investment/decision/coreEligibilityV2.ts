import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseCategory } from './assetUniverse';
import type { AssetScanCandidate } from './assetUniverseScanner';
import type { OpenMarketDiscoveryV1Asset } from './openMarketDiscoveryV1';

export const CORE_ELIGIBILITY_V2 = 'CORE_ELIGIBILITY_V2' as const;

export type CoreEligibilityV2Status = 'CORE_ELIGIBLE' | 'REJECTED' | 'REVIEW_REQUIRED';
export type CoreEligibilityV2Scope = 'GLOBAL_BROAD' | 'REGIONAL_BROAD' | 'NOT_CORE' | 'UNKNOWN';
export type CoreLiquidityEvidence = 'PASS' | 'FAIL' | 'FUND_NAV_NOT_EXCHANGE_VOLUME' | 'UNKNOWN';

export interface CoreEligibilityV2Assessment {
  version: typeof CORE_ELIGIBILITY_V2;
  assetId: string;
  ticker: string;
  status: CoreEligibilityV2Status;
  scope: CoreEligibilityV2Scope;
  historyBars: number;
  realData: boolean;
  liquidityEvidence: CoreLiquidityEvidence;
  medianDailyTurnoverEur: number | null;
  positiveVolumeCoveragePct: number | null;
  reasons: string[];
}

export interface CoreEligibilityV2Report {
  version: typeof CORE_ELIGIBILITY_V2;
  mode: 'SHADOW_AUDIT_NOT_PRODUCTION_GATE';
  assessed: number;
  eligible: number;
  reviewRequired: number;
  rejected: number;
  assessments: CoreEligibilityV2Assessment[];
  policy: typeof CORE_ELIGIBILITY_V2_POLICY;
}

const GLOBAL_CATEGORIES = new Set<AssetUniverseCategory>(['GLOBAL_EQUITY']);
const REGIONAL_BROAD_CATEGORIES = new Set<AssetUniverseCategory>(['US_EQUITY', 'EUROPE_EQUITY', 'JAPAN_EQUITY', 'EMERGING_EQUITY']);

/**
 * Structural policy only. It is intentionally a SHADOW audit until validated;
 * it does not replace PortfolioCandidateGate or DynamicCoreSelectorV1.
 */
export const CORE_ELIGIBILITY_V2_POLICY = {
  minimumHistoryBars: 756,
  minimumPositiveVolumeCoveragePct: 80,
  minimumMedianDailyTurnoverEur: 250_000,
  requiredCurrency: 'EUR',
  requiredProvenance: 'REAL',
  broadCategories: ['GLOBAL_EQUITY', 'US_EQUITY', 'EUROPE_EQUITY', 'JAPAN_EQUITY', 'EMERGING_EQUITY'] as const,
  discoveredStructureRule: 'OPEN/DYNAMIC discoveries require explicit BROAD discovery evidence; unknown structure is REVIEW_REQUIRED',
  mutualFundLiquidityRule: 'Direct REAL NAV series are not rejected for missing exchange volume; broker availability remains a separate operational gate.'
} as const;

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function scopeFor(category: AssetUniverseCategory): CoreEligibilityV2Scope {
  if (GLOBAL_CATEGORIES.has(category)) return 'GLOBAL_BROAD';
  if (REGIONAL_BROAD_CATEGORIES.has(category)) return 'REGIONAL_BROAD';
  return 'NOT_CORE';
}

function recentLiquidity(series: MultiAssetDataset['assets'][number] | undefined): {
  evidence: CoreLiquidityEvidence;
  medianTurnoverEur: number | null;
  positiveVolumeCoveragePct: number | null;
} {
  if (!series?.bars.length) return { evidence: 'UNKNOWN', medianTurnoverEur: null, positiveVolumeCoveragePct: null };
  const rows = series.bars.slice(-60);
  const volumes = rows.map(row => Number(row.volume ?? 0));
  const positive = volumes.filter(value => value > 0).length;
  const coverage = rows.length ? positive / rows.length * 100 : 0;
  const turnover = rows
    .map(row => Number(row.close) * Number(row.volume ?? 0))
    .filter(value => Number.isFinite(value) && value > 0);
  const medianTurnoverEur = median(turnover);
  const pass = coverage >= CORE_ELIGIBILITY_V2_POLICY.minimumPositiveVolumeCoveragePct
    && (medianTurnoverEur ?? 0) >= CORE_ELIGIBILITY_V2_POLICY.minimumMedianDailyTurnoverEur;
  return {
    evidence: pass ? 'PASS' : 'FAIL',
    medianTurnoverEur,
    positiveVolumeCoveragePct: coverage
  };
}

function isDiscoveryAsset(assetId: string): boolean {
  return assetId.startsWith('OPEN_') || assetId.startsWith('DYNAMIC_');
}

export function assessCoreEligibilityV2(input: {
  candidate: AssetScanCandidate;
  series?: MultiAssetDataset['assets'][number];
  discovery?: OpenMarketDiscoveryV1Asset | null;
}): CoreEligibilityV2Assessment {
  const { candidate } = input;
  const reasons: string[] = [];
  const categoryScope = scopeFor(candidate.asset.category);
  const realData = candidate.response?.provenance?.sourceType === 'REAL'
    || input.series?.provenance?.sourceType === 'REAL';

  if (candidate.status !== 'ACCEPTED') reasons.push(`SCANNER_${candidate.reason ?? 'REJECTED'}`);
  if (candidate.asset.currency !== CORE_ELIGIBILITY_V2_POLICY.requiredCurrency) reasons.push('NON_EUR');
  if (!realData) reasons.push('NON_REAL_OR_UNKNOWN_PROVENANCE');
  if (candidate.bars < CORE_ELIGIBILITY_V2_POLICY.minimumHistoryBars) reasons.push('INSUFFICIENT_3Y_HISTORY');
  if (categoryScope === 'NOT_CORE') reasons.push('NOT_BROAD_CORE_CATEGORY');
  if (candidate.asset.assetId.startsWith('EQ_')) reasons.push('SINGLE_EQUITY_NOT_CORE');

  let structuralReview = false;
  if (isDiscoveryAsset(candidate.asset.assetId)) {
    if (!input.discovery) {
      structuralReview = true;
      reasons.push('DISCOVERED_STRUCTURE_METADATA_MISSING');
    } else if (input.discovery.breadth !== 'BROAD') {
      reasons.push(`DISCOVERED_BREADTH_${input.discovery.breadth}_NOT_CORE`);
    }
  }

  const isFund = candidate.asset.instrumentType === 'MUTUAL_FUND';
  const liquidity = isFund
    ? { evidence: 'FUND_NAV_NOT_EXCHANGE_VOLUME' as const, medianTurnoverEur: null, positiveVolumeCoveragePct: null }
    : recentLiquidity(input.series);
  if (!isFund && liquidity.evidence === 'FAIL') reasons.push('LISTED_LIQUIDITY_BELOW_STRUCTURAL_FLOOR');
  if (!isFund && liquidity.evidence === 'UNKNOWN') {
    structuralReview = true;
    reasons.push('LISTED_LIQUIDITY_EVIDENCE_MISSING');
  }

  const hardReject = candidate.status !== 'ACCEPTED'
    || candidate.asset.currency !== 'EUR'
    || !realData
    || candidate.bars < CORE_ELIGIBILITY_V2_POLICY.minimumHistoryBars
    || categoryScope === 'NOT_CORE'
    || candidate.asset.assetId.startsWith('EQ_')
    || (!isFund && liquidity.evidence === 'FAIL')
    || Boolean(input.discovery && input.discovery.breadth !== 'BROAD');

  return {
    version: CORE_ELIGIBILITY_V2,
    assetId: candidate.asset.assetId,
    ticker: candidate.asset.ticker,
    status: hardReject ? 'REJECTED' : structuralReview ? 'REVIEW_REQUIRED' : 'CORE_ELIGIBLE',
    scope: categoryScope,
    historyBars: candidate.bars,
    realData,
    liquidityEvidence: liquidity.evidence,
    medianDailyTurnoverEur: liquidity.medianTurnoverEur,
    positiveVolumeCoveragePct: liquidity.positiveVolumeCoveragePct,
    reasons
  };
}

export function auditCoreEligibilityV2(input: {
  candidates: AssetScanCandidate[];
  dataset: MultiAssetDataset;
  discovery?: readonly OpenMarketDiscoveryV1Asset[];
}): CoreEligibilityV2Report {
  const discoveryById = new Map((input.discovery ?? []).map(row => [row.asset.assetId, row] as const));
  const seriesById = new Map(input.dataset.assets.map(series => [series.assetId, series] as const));
  const assessments = input.candidates.map(candidate => assessCoreEligibilityV2({
    candidate,
    series: seriesById.get(candidate.asset.assetId),
    discovery: discoveryById.get(candidate.asset.assetId) ?? null
  }));
  return {
    version: CORE_ELIGIBILITY_V2,
    mode: 'SHADOW_AUDIT_NOT_PRODUCTION_GATE',
    assessed: assessments.length,
    eligible: assessments.filter(row => row.status === 'CORE_ELIGIBLE').length,
    reviewRequired: assessments.filter(row => row.status === 'REVIEW_REQUIRED').length,
    rejected: assessments.filter(row => row.status === 'REJECTED').length,
    assessments,
    policy: CORE_ELIGIBILITY_V2_POLICY
  };
}
