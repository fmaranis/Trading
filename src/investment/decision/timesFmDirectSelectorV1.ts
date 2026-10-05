export const TIMESFM_DIRECT_SELECTOR_V1 = Object.freeze({
  version: 'TIMESFM_DIRECT_SELECTOR_V1',
  role: 'RESEARCH_ONLY_DIRECT_ASSET_SELECTOR',
  candidatePool: 'FROZEN_TIMESFM_PANEL_PLUS_STRUCTURAL_CORE',
  primaryHorizons: Object.freeze([20, 60]),
  selectionRule: 'LOWEST_MEAN_ORDINAL_RANK_20_60',
  tieBreak: 'HIGHER_MEAN_PREDICTED_RELATIVE_RETURN_THEN_ASSET_ID',
  structuralCoreRelativeForecastPct: 0,
  gateAuthority: 'DIRECT_RESEARCH_ARM_BYPASSES_LEGACY_SIGNAL_GATES',
  executionAuthority: false,
  sizingMode: 'FULL_SHADOW_EQUITY_TO_SELECTED_ASSET',
  executionSemantics: 'NEXT_OPEN',
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export interface TimesFmDirectSelectorEvidence {
  assetId: string;
  predictedRelativeReturn20Pct: number;
  predictedRelativeReturn60Pct: number;
}

export interface TimesFmDirectSelection {
  assetId: string;
  rank20: number;
  rank60: number;
  meanOrdinalRank: number;
  meanPredictedRelativeReturnPct: number;
  predictedRelativeReturn20Pct: number;
  predictedRelativeReturn60Pct: number;
}

function ordinalRanks(rows: readonly TimesFmDirectSelectorEvidence[], key: 'predictedRelativeReturn20Pct' | 'predictedRelativeReturn60Pct'): Map<string, number> {
  const sorted = [...rows].sort((a,b) => b[key] - a[key] || a.assetId.localeCompare(b.assetId));
  const out = new Map<string, number>();
  let index = 0;
  while (index < sorted.length) {
    let end = index + 1;
    while (end < sorted.length && sorted[end][key] === sorted[index][key]) end++;
    const rank = (index + 1 + end) / 2;
    for (let i = index; i < end; i++) out.set(sorted[i].assetId, rank);
    index = end;
  }
  return out;
}

export function selectTimesFmDirectWinnerV1(
  rows: readonly TimesFmDirectSelectorEvidence[]
): TimesFmDirectSelection {
  if (!rows.length) throw new Error('TIMESFM_DIRECT_SELECTOR_V1_EMPTY_EVIDENCE');
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.assetId || seen.has(row.assetId)) throw new Error('TIMESFM_DIRECT_SELECTOR_V1_INVALID_OR_DUPLICATE_ASSET:' + String(row.assetId));
    seen.add(row.assetId);
    if (!Number.isFinite(row.predictedRelativeReturn20Pct) || !Number.isFinite(row.predictedRelativeReturn60Pct)) {
      throw new Error('TIMESFM_DIRECT_SELECTOR_V1_NON_FINITE_FORECAST:' + row.assetId);
    }
  }
  const r20 = ordinalRanks(rows, 'predictedRelativeReturn20Pct');
  const r60 = ordinalRanks(rows, 'predictedRelativeReturn60Pct');
  const ranked = rows.map(row => {
    const rank20 = r20.get(row.assetId);
    const rank60 = r60.get(row.assetId);
    if (rank20 == null || rank60 == null) throw new Error('TIMESFM_DIRECT_SELECTOR_V1_INTERNAL_RANK:' + row.assetId);
    return {
      assetId: row.assetId,
      rank20,
      rank60,
      meanOrdinalRank: (rank20 + rank60) / 2,
      meanPredictedRelativeReturnPct: (row.predictedRelativeReturn20Pct + row.predictedRelativeReturn60Pct) / 2,
      predictedRelativeReturn20Pct: row.predictedRelativeReturn20Pct,
      predictedRelativeReturn60Pct: row.predictedRelativeReturn60Pct
    };
  }).sort((a,b) =>
    a.meanOrdinalRank - b.meanOrdinalRank
    || b.meanPredictedRelativeReturnPct - a.meanPredictedRelativeReturnPct
    || a.assetId.localeCompare(b.assetId)
  );
  return ranked[0];
}
