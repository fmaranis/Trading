export const TIMESFM_RELATIVE_RANK_V1 = Object.freeze({
  version: 'TIMESFM_RELATIVE_RANK_V1',
  role: 'RESEARCH_ONLY_SHADOW_ECONOMIC_POLICY',
  primaryHorizons: Object.freeze([20, 60]),
  aggregation: 'MEAN_ORDINAL_RANK_ACROSS_20_60',
  tieBreak: 'LEGACY_RANKING_SCORE_THEN_ASSET_ID',
  coverageRule: 'ALL_ELIGIBLE_CANDIDATES_REQUIRE_FROZEN_FORECAST_EVIDENCE',
  gateAuthority: false,
  sizingAuthority: false,
  cashAuthority: false,
  timingAuthority: false,
  productionDefault: 'LEGACY',
  productionAuthority: false
});

export function timesFmRelativeRankEvidenceByAsset(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const assetId = String(row?.assetId ?? '').trim();
    if (!assetId) throw new Error('TIMESFM_RELATIVE_RANK_V1_ASSET_ID_MISSING');
    if (map.has(assetId)) throw new Error('TIMESFM_RELATIVE_RANK_V1_DUPLICATE_ASSET:' + assetId);
    const r20 = Number(row?.predictedRelativeReturn20Pct);
    const r60 = Number(row?.predictedRelativeReturn60Pct);
    if (!Number.isFinite(r20) || !Number.isFinite(r60)) {
      throw new Error('TIMESFM_RELATIVE_RANK_V1_FORECAST_NON_FINITE:' + assetId);
    }
    map.set(assetId, {
      assetId,
      predictedRelativeReturn20Pct: r20,
      predictedRelativeReturn60Pct: r60
    });
  }
  return map;
}

function averageOrdinalRanks(valuesById) {
  const rows = [...valuesById.entries()]
    .map(([assetId, value]) => ({ assetId, value }))
    .sort((a, b) => b.value - a.value || a.assetId.localeCompare(b.assetId));
  const ranks = new Map();
  let index = 0;
  while (index < rows.length) {
    let end = index + 1;
    while (end < rows.length && rows[end].value === rows[index].value) end++;
    const averageRank = (index + 1 + end) / 2;
    for (let i = index; i < end; i++) ranks.set(rows[i].assetId, averageRank);
    index = end;
  }
  return ranks;
}

export function rankEligibleCandidatesWithTimesFmRelativeV1(eligibleRows, evidenceRows) {
  const evidence = timesFmRelativeRankEvidenceByAsset(evidenceRows);
  const ids = eligibleRows.map(row => String(row.assetId));
  for (const assetId of ids) {
    if (!evidence.has(assetId)) throw new Error('TIMESFM_RELATIVE_RANK_V1_ELIGIBLE_FORECAST_MISSING:' + assetId);
  }
  const eligibleIdSet = new Set(ids);
  const e20 = new Map();
  const e60 = new Map();
  for (const [assetId, row] of evidence.entries()) {
    if (!eligibleIdSet.has(assetId)) continue;
    e20.set(assetId, row.predictedRelativeReturn20Pct);
    e60.set(assetId, row.predictedRelativeReturn60Pct);
  }
  const rank20 = averageOrdinalRanks(e20);
  const rank60 = averageOrdinalRanks(e60);

  const ranked = eligibleRows.map(row => {
    const assetId = String(row.assetId);
    const meanRank = ((rank20.get(assetId) ?? Number.POSITIVE_INFINITY) + (rank60.get(assetId) ?? Number.POSITIVE_INFINITY)) / 2;
    const evidenceRow = evidence.get(assetId);
    return {
      ...row,
      timesFmRelativeRankMean: meanRank,
      timesFmPredictedRelativeReturn20Pct: evidenceRow.predictedRelativeReturn20Pct,
      timesFmPredictedRelativeReturn60Pct: evidenceRow.predictedRelativeReturn60Pct
    };
  }).sort((a, b) =>
    a.timesFmRelativeRankMean - b.timesFmRelativeRankMean
    || b.legacyRankingScore - a.legacyRankingScore
    || String(a.assetId).localeCompare(String(b.assetId))
  );

  return ranked.map((row, index) => ({
    ...row,
    timesFmRelativeRankPosition: index + 1
  }));
}
