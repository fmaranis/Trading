import {
  PortfolioCandidateGate,
  TIMESFM_RELATIVE_RANK_V1,
  rankEligibleCandidatesWithTimesFmRelativeV1
} from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

check('TimesFM shadow policy is research-only', TIMESFM_RELATIVE_RANK_V1.productionAuthority === false && TIMESFM_RELATIVE_RANK_V1.productionDefault === 'LEGACY');
check('TimesFM shadow has no sizing/cash/timing authority', TIMESFM_RELATIVE_RANK_V1.sizingAuthority === false && TIMESFM_RELATIVE_RANK_V1.cashAuthority === false && TIMESFM_RELATIVE_RANK_V1.timingAuthority === false);

const pureRanked = rankEligibleCandidatesWithTimesFmRelativeV1([
  { assetId: 'A', legacyRankingScore: 10 },
  { assetId: 'B', legacyRankingScore: 30 },
  { assetId: 'C', legacyRankingScore: 20 }
], [
  { assetId: 'A', predictedRelativeReturn20Pct: 5, predictedRelativeReturn60Pct: 7 },
  { assetId: 'B', predictedRelativeReturn20Pct: 1, predictedRelativeReturn60Pct: 2 },
  { assetId: 'C', predictedRelativeReturn20Pct: 3, predictedRelativeReturn60Pct: 4 }
]);
check('pure policy ranks by mean 20/60 ordinal rank, not LEGACY magnitude', pureRanked.map(row => row.assetId).join('|') === 'A|C|B');
check('rank position is explicit and auditable', pureRanked.map(row => row.timesFmRelativeRankPosition).join('|') === '1|2|3');

const tied = rankEligibleCandidatesWithTimesFmRelativeV1([
  { assetId: 'A', legacyRankingScore: 5 },
  { assetId: 'B', legacyRankingScore: 10 }
], [
  { assetId: 'A', predictedRelativeReturn20Pct: 2, predictedRelativeReturn60Pct: 1 },
  { assetId: 'B', predictedRelativeReturn20Pct: 1, predictedRelativeReturn60Pct: 2 }
]);
check('LEGACY is only the deterministic tie-break when mean ordinal rank ties', tied.map(row => row.assetId).join('|') === 'B|A');

let missingFailed = false;
try {
  rankEligibleCandidatesWithTimesFmRelativeV1(
    [{ assetId: 'A', legacyRankingScore: 10 }, { assetId: 'B', legacyRankingScore: 9 }],
    [{ assetId: 'A', predictedRelativeReturn20Pct: 3, predictedRelativeReturn60Pct: 4 }]
  );
} catch (error) {
  missingFailed = String((error as Error).message).includes('TIMESFM_RELATIVE_RANK_V1_ELIGIBLE_FORECAST_MISSING:B');
}
check('missing forecast for an eligible candidate fails closed', missingFailed);

function risingBars(multiplier: number, count = 320) {
  const bars: any[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    bars.push({
      timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      open: price * 0.999,
      high: price * 1.002,
      low: price * 0.998,
      close: price,
      volume: 1000
    });
  }
  return bars;
}

function flatThenPopBars(count = 320) {
  const bars: any[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    if (i < count - 20) price *= 1.0007;
    else price *= i === count - 1 ? 1.02 : 1.0004;
    bars.push({
      timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      open: price * 0.999,
      high: price * 1.002,
      low: price * 0.998,
      close: price,
      volume: 1000
    });
  }
  return bars;
}

function candidate(assetId: string, ticker: string, category: string, bars: any[], momentum120Pct: number, vol: number, dd: number, score: number): any {
  return {
    asset: { assetId, ticker, name: ticker, category, currency: 'EUR' },
    status: 'ACCEPTED',
    bars: bars.length,
    asOfDate: bars.at(-1).timestamp.slice(0, 10),
    lastClose: bars.at(-1).close,
    momentum20Pct: momentum120Pct / 4,
    momentum60Pct: momentum120Pct / 2,
    momentum120Pct,
    annualizedVolatilityPct: vol,
    maxDrawdownPct: dd,
    score
  };
}

function datasetFor(rows: any[], barsById: Record<string, any[]>): any {
  return {
    timeframe: '1d',
    assets: rows.map(c => ({
      assetId: c.asset.assetId,
      ticker: c.asset.ticker,
      name: c.asset.name,
      currency: 'EUR',
      bars: barsById[c.asset.assetId],
      provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true }
    }))
  };
}

const barsA = flatThenPopBars();
const barsB = risingBars(1.0012);
const weakBars = risingBars(1.00005);
const fallingBars = risingBars(0.998);
const rows: any[] = [
  candidate('A', 'A.DE', 'TECHNOLOGY', barsA, 22, 14, 8, 15),
  candidate('B', 'B.DE', 'EUROPE_EQUITY', barsB, 18, 16, 9, 20),
  candidate('WEAK', 'WEAK.DE', 'DIVIDEND', weakBars, 0.6, 8, 4, 2),
  candidate('FALLING', 'FALLING.DE', 'ENERGY', fallingBars, -20, 25, 30, -20)
];
const acceptedDataset = datasetFor(rows, { A: barsA, B: barsB, WEAK: weakBars, FALLING: fallingBars });
const scan: any = {
  scanned: rows.length,
  accepted: rows.length,
  rejected: 0,
  selected: rows,
  candidates: rows,
  acceptedDataset,
  dataset: acceptedDataset,
  rejectionCounts: {}
};

const legacy = PortfolioCandidateGate.apply(scan, 2.5, 1, 'LEGACY');
check('LEGACY baseline selects one eligible candidate', legacy.scan.selected.length === 1);
const legacySelected = legacy.scan.selected[0]?.asset.assetId;

const timesfm = PortfolioCandidateGate.apply(scan, 2.5, 1, 'TIMESFM_RELATIVE_RANK_V1', {
  timesFmRelativeRankEvidence: [
    { assetId: 'A', predictedRelativeReturn20Pct: 8, predictedRelativeReturn60Pct: 12 },
    { assetId: 'B', predictedRelativeReturn20Pct: 1, predictedRelativeReturn60Pct: 2 }
  ]
});
check('TimesFM policy is explicit at gate result', timesfm.selectionPolicy === 'TIMESFM_RELATIVE_RANK_V1');
check('TimesFM can change the selected eligible candidate without changing gates', timesfm.scan.selected[0]?.asset.assetId === 'A' && legacySelected !== 'A');
check('TimesFM cannot rescue weak/falling rejected candidates', !timesfm.scan.selected.some(row => row.asset.assetId === 'WEAK' || row.asset.assetId === 'FALLING'));
check('TimesFM gate preserves timing approval requirement', timesfm.entries.filter(row => row.status === 'ELIGIBLE').every(row => row.timingState === 'ENTRY_READY' || row.timingState === 'ENTRY_STRONG'));
check('TimesFM rank metadata is persisted on eligible gate entries', timesfm.entries.filter(row => row.status === 'ELIGIBLE').every(row => Number.isFinite(row.timesFmRelativeRankPosition) && Number.isFinite(row.legacyRankingScore)));

let gateCoverageFailed = false;
try {
  PortfolioCandidateGate.apply(scan, 2.5, 1, 'TIMESFM_RELATIVE_RANK_V1', {
    timesFmRelativeRankEvidence: [{ assetId: 'A', predictedRelativeReturn20Pct: 8, predictedRelativeReturn60Pct: 12 }]
  });
} catch (error) {
  gateCoverageFailed = String((error as Error).message).includes('TIMESFM_RELATIVE_RANK_V1_ELIGIBLE_FORECAST_MISSING');
}
check('gate fails closed when TimesFM coverage is incomplete for eligible set', gateCoverageFailed);

console.log(`TimesFM relative rank V1: ${passed}/12 invariants passed.`);
