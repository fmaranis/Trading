export const TIMESFM_PANEL_STICKY_SELECTOR_V1 = Object.freeze({
  version: 'TIMESFM_PANEL_STICKY_SELECTOR_V1',
  role: 'RESEARCH_ONLY_COST_AWARE_DIRECT_ASSET_SELECTOR',
  signalSource: 'TIMESFM_MULTIVARIATE_CONTEXT_V1_FULL_PANEL_TARGETS_ONLY',
  forecastHorizonSessions: 60,
  entryRank: 1,
  incumbentRetentionRank: 3,
  relativeReturnFloorPct: 0,
  structuralCoreAssetId: 'EUNL',
  reviewCadence: 'MONTHLY_LAST_COMMON_TRADING_SESSION',
  executionSemantics: 'NEXT_OPEN',
  sizingMode: 'FULL_SHADOW_EQUITY_TO_SELECTED_ASSET',
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export interface TimesFmPanelStickyEvidence {
  assetId: string;
  predictedRelativeReturn60Pct: number;
}

export interface TimesFmPanelStickySelection {
  selectedAssetId: string;
  previousAssetId: string | null;
  switched: boolean;
  selectedRank60: number;
  selectedPredictedRelativeReturn60Pct: number;
  reason: 'ENTER_TOP1' | 'RETAIN_TOP3_BUFFER' | 'FALLBACK_CORE' | 'RETAIN_CORE';
  ranked: Array<{ assetId: string; rank60: number; predictedRelativeReturn60Pct: number }>;
}

function rankedEvidence(rows: readonly TimesFmPanelStickyEvidence[]) {
  if (!rows.length) throw new Error('TIMESFM_PANEL_STICKY_V1_EMPTY_EVIDENCE');
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.assetId || seen.has(row.assetId)) throw new Error('TIMESFM_PANEL_STICKY_V1_INVALID_OR_DUPLICATE_ASSET:' + String(row.assetId));
    seen.add(row.assetId);
    if (!Number.isFinite(row.predictedRelativeReturn60Pct)) throw new Error('TIMESFM_PANEL_STICKY_V1_NON_FINITE:' + row.assetId);
  }
  const sorted = [...rows].sort((a,b) =>
    b.predictedRelativeReturn60Pct - a.predictedRelativeReturn60Pct
    || a.assetId.localeCompare(b.assetId)
  );
  return sorted.map((row,index)=>({
    assetId: row.assetId,
    rank60: index + 1,
    predictedRelativeReturn60Pct: row.predictedRelativeReturn60Pct
  }));
}

export function selectTimesFmPanelStickyV1(
  rows: readonly TimesFmPanelStickyEvidence[],
  previousAssetId: string | null
): TimesFmPanelStickySelection {
  const P = TIMESFM_PANEL_STICKY_SELECTOR_V1;
  const ranked = rankedEvidence(rows);
  const core = ranked.find(row=>row.assetId===P.structuralCoreAssetId);
  if (!core) throw new Error('TIMESFM_PANEL_STICKY_V1_CORE_MISSING');

  const challenger = ranked.find(row =>
    row.assetId !== P.structuralCoreAssetId
    && row.predictedRelativeReturn60Pct > P.relativeReturnFloorPct
  ) ?? null;

  const previous = previousAssetId ? ranked.find(row=>row.assetId===previousAssetId) ?? null : null;
  if (previous && previous.assetId !== P.structuralCoreAssetId
      && previous.rank60 <= P.incumbentRetentionRank
      && previous.predictedRelativeReturn60Pct >= P.relativeReturnFloorPct) {
    return {
      selectedAssetId: previous.assetId,
      previousAssetId,
      switched: false,
      selectedRank60: previous.rank60,
      selectedPredictedRelativeReturn60Pct: previous.predictedRelativeReturn60Pct,
      reason: 'RETAIN_TOP3_BUFFER',
      ranked
    };
  }

  if (challenger) {
    return {
      selectedAssetId: challenger.assetId,
      previousAssetId,
      switched: challenger.assetId !== previousAssetId,
      selectedRank60: challenger.rank60,
      selectedPredictedRelativeReturn60Pct: challenger.predictedRelativeReturn60Pct,
      reason: 'ENTER_TOP1',
      ranked
    };
  }

  return {
    selectedAssetId: P.structuralCoreAssetId,
    previousAssetId,
    switched: P.structuralCoreAssetId !== previousAssetId,
    selectedRank60: core.rank60,
    selectedPredictedRelativeReturn60Pct: core.predictedRelativeReturn60Pct,
    reason: previousAssetId === P.structuralCoreAssetId ? 'RETAIN_CORE' : 'FALLBACK_CORE',
    ranked
  };
}

export function selectTimesFmPanelNaiveTop1V1(
  rows: readonly TimesFmPanelStickyEvidence[]
): string {
  const P = TIMESFM_PANEL_STICKY_SELECTOR_V1;
  const ranked = rankedEvidence(rows);
  const challenger = ranked.find(row =>
    row.assetId !== P.structuralCoreAssetId
    && row.predictedRelativeReturn60Pct > P.relativeReturnFloorPct
  );
  return challenger?.assetId ?? P.structuralCoreAssetId;
}
