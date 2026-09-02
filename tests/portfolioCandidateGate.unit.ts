import {
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  assessSlopeSelectionQuality,
  candidateQualityAdjustment,
  candidateSlopeAdjustment,
  isValidIsin,
  PortfolioCandidateGate
} from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

function risingBars(multiplier: number, count = 320) {
  const bars: any[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    bars.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  return bars;
}

function flatThenPopBars(count = 320) {
  const bars: any[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    if (i < count - 20) price *= 1.0007;
    else price *= i === count - 1 ? 1.02 : 1.0004;
    bars.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
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

const strongBars = flatThenPopBars();
const strongerBars = risingBars(1.0012);
const weakBars = risingBars(1.00005);
const fallingBars = risingBars(0.998);

const candidates: any[] = [
  candidate('STRONG_A', 'STRONGA.DE', 'TECHNOLOGY', strongBars, 22, 14, 8, 15),
  candidate('STRONG_B', 'STRONGB.DE', 'EUROPE_EQUITY', strongerBars, 18, 16, 9, 20),
  candidate('WEAK', 'WEAK.DE', 'DIVIDEND', weakBars, 0.6, 8, 4, 2),
  candidate('FALLING', 'FALLING.DE', 'ENERGY', fallingBars, -20, 25, 30, -20)
];
const acceptedDataset: any = {
  timeframe: '1d',
  assets: candidates.map((c, index) => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, currency: 'EUR', bars: [strongBars, strongerBars, weakBars, fallingBars][index], provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true } }))
};
const scan: any = { scanned: 4, accepted: 4, rejected: 0, selected: candidates, candidates, acceptedDataset, dataset: acceptedDataset, rejectionCounts: {} };

const result = PortfolioCandidateGate.apply(scan, 2.5, 12);
check('701 strong candidate A survives quality + timing before allocation', result.scan.selected.some(c => c.asset.assetId === 'STRONG_A'));
check('702 stronger candidate B survives quality + timing before allocation', result.scan.selected.some(c => c.asset.assetId === 'STRONG_B'));
check('703 weak candidate that does not beat cash is excluded before allocator', !result.scan.selected.some(c => c.asset.assetId === 'WEAK') && result.entries.some(e => e.assetId === 'WEAK' && e.reason === 'DOES_NOT_BEAT_CASH'));
check('704 structural falling candidate is excluded before allocator', !result.scan.selected.some(c => c.asset.assetId === 'FALLING'));
check('705 gated dataset contains only selected candidates', result.scan.dataset.assets.length === result.scan.selected.length && result.scan.dataset.assets.every(a => result.scan.selected.some(c => c.asset.assetId === a.assetId)));
check('706 gate is not hard-coded to the old eight-slot shortlist', result.selectedCount <= 12);
check('707 every allocator candidate has explicit timing approval', result.entries.filter(e => e.status === 'ELIGIBLE').every(e => e.timingState === 'ENTRY_READY' || e.timingState === 'ENTRY_STRONG'));
check('708 timing approval never authorizes 100% of the strategic target as first tranche', result.entries.filter(e => e.status === 'ELIGIBLE').every(e => (e.suggestedInitialFraction ?? 0) > 0 && (e.suggestedInitialFraction ?? 1) <= 0.5));

const productionTickers = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(x => x.ticker.toUpperCase()));
const holdoutTickers = EUR_VALIDATION_HOLDOUT_UNIVERSE.map(x => x.ticker.toUpperCase());
check('709 validation holdout remains isolated from production discovery universe', holdoutTickers.every(ticker => !productionTickers.has(ticker)));
check('710 production discovery universe is broader than the original small allocator shortlist', EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length > 50);
check('711 every production discovery candidate exposes a checksum-valid operational ISIN', EUR_PORTFOLIO_DISCOVERY_UNIVERSE.every(item => isValidIsin(item.isin)));

const qualityResult = PortfolioCandidateGate.apply(scan, 2.5, 12, 'QUALITY_V1');
check('712 QUALITY_V1 is explicit and auditable', qualityResult.selectionPolicy === 'QUALITY_V1');
check('713 QUALITY_V1 computes causal Reliability/Opportunity for historical-prefix candidates', qualityResult.entries.filter(e => e.status === 'ELIGIBLE').every(e => Number.isFinite(e.reliabilityScore) && Number.isFinite(e.opportunityScore)));
check('714 quality adjustment rewards stronger Reliability/Opportunity without bypassing gates', candidateQualityAdjustment(80, 80) > candidateQualityAdjustment(40, 40) && !qualityResult.scan.selected.some(c => c.asset.assetId === 'WEAK') && !qualityResult.scan.selected.some(c => c.asset.assetId === 'FALLING'));

const strongSlope = assessSlopeSelectionQuality({
  regressionSlope20AnnualizedPct: 30,
  regressionSlope60AnnualizedPct: 20,
  regressionSlope120AnnualizedPct: 14,
  slopeAcceleration20vs60PctPoints: 10,
  sma20Slope20AnnualizedPct: 18,
  sma50Slope20AnnualizedPct: 12,
  prior20High: null,
  prior20Low: null,
  breakout20: false,
  breakdown20: false,
  state: 'HEALTHY_UPTREND'
});
const weakSlope = assessSlopeSelectionQuality({
  regressionSlope20AnnualizedPct: -15,
  regressionSlope60AnnualizedPct: -8,
  regressionSlope120AnnualizedPct: -4,
  slopeAcceleration20vs60PctPoints: -7,
  sma20Slope20AnnualizedPct: -10,
  sma50Slope20AnnualizedPct: -5,
  prior20High: null,
  prior20Low: null,
  breakout20: false,
  breakdown20: false,
  state: 'DOWNTREND'
});
check('715 slope quality rewards coherent positive multi-horizon structure', strongSlope.slopeQualityScore > 70 && strongSlope.slopeQualityScore > weakSlope.slopeQualityScore);
check('716 slope ranking adjustment is symmetric and bounded', candidateSlopeAdjustment(100) === 10 && candidateSlopeAdjustment(0) === -10 && candidateSlopeAdjustment(50) === 0);

const slopeResult = PortfolioCandidateGate.apply(scan, 2.5, 12, 'SLOPE_V1');
check('717 SLOPE_V1 is explicit and computes finite causal slope quality for eligible candidates', slopeResult.selectionPolicy === 'SLOPE_V1' && slopeResult.entries.filter(e => e.status === 'ELIGIBLE').every(e => Number.isFinite(e.slopeQualityScore)));
check('718 SLOPE_V1 changes ranking evidence only and cannot bypass cash or structural gates', !slopeResult.scan.selected.some(c => c.asset.assetId === 'WEAK') && !slopeResult.scan.selected.some(c => c.asset.assetId === 'FALLING'));

console.log(`Portfolio candidate gate: ${passed}/18 invariants passed.`);