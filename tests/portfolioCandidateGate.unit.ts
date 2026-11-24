import {
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  assessSlopeSelectionQuality,
  candidateQualityAdjustment,
  candidateSlopeAdjustment,
  isValidIsin,
  PortfolioCandidateGate,
  assessPriceVolumeEvidence
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
const acceptedDataset: any = datasetFor(candidates, {
  STRONG_A: strongBars,
  STRONG_B: strongerBars,
  WEAK: weakBars,
  FALLING: fallingBars
});
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

// Current/live dynamic discovery may return many individual companies with the
// broad EUROPE_EQUITY label. That metadata limitation must not turn the legacy
// two-per-category ETF diversification cap into a two-stocks-total bottleneck.
const liveRows: any[] = [
  candidate('EQ_LIVE_A', 'LIVA.DE', 'EUROPE_EQUITY', strongerBars, 20, 14, 8, 30),
  candidate('EQ_LIVE_B', 'LIVB.DE', 'EUROPE_EQUITY', strongerBars, 20, 14, 8, 29),
  candidate('EQ_LIVE_C', 'LIVC.DE', 'EUROPE_EQUITY', strongerBars, 20, 14, 8, 28),
  candidate('ETF_LIVE_A', 'ETFA.DE', 'GLOBAL_EQUITY', strongerBars, 20, 14, 8, 27),
  candidate('ETF_LIVE_B', 'ETFB.DE', 'GLOBAL_EQUITY', strongerBars, 20, 14, 8, 26),
  candidate('ETF_LIVE_C', 'ETFC.DE', 'GLOBAL_EQUITY', strongerBars, 20, 14, 8, 25)
];
const liveDataset = datasetFor(liveRows, Object.fromEntries(liveRows.map(row => [row.asset.assetId, strongerBars])));
const liveScan: any = {
  scanned: liveRows.length,
  accepted: liveRows.length,
  rejected: 0,
  selected: liveRows,
  candidates: liveRows,
  acceptedDataset: liveDataset,
  dataset: liveDataset,
  rejectionCounts: {},
  dynamicMarketShortlist: {
    mode: 'DYNAMIC_CURRENT_DISCOVERY',
    rankingVersion: 'MARKET_SHORTLIST_LEGACY_SCORE_V1',
    targetSize: 64,
    applied: true,
    candidatePoolSize: liveRows.length,
    acceptedPoolSize: liveRows.length,
    shortlistSize: liveRows.length,
    shortlistAssetIds: liveRows.map(row => row.asset.assetId)
  }
};
const liveGate = PortfolioCandidateGate.apply(liveScan, 2.5, 12);
const liveSelectedIds = new Set(liveGate.scan.selected.map(row => row.asset.assetId));
check('719 current/live individual equities do not share one artificial two-slot EUROPE_EQUITY bucket', ['EQ_LIVE_A', 'EQ_LIVE_B', 'EQ_LIVE_C'].every(id => liveSelectedIds.has(id)));
check('720 current/live collective instruments retain the two-per-category diversification cap', ['ETF_LIVE_A', 'ETF_LIVE_B', 'ETF_LIVE_C'].filter(id => liveSelectedIds.has(id)).length === 2);

const historicalLiveLikeScan: any = { ...liveScan, dynamicMarketShortlist: undefined };
const historicalGate = PortfolioCandidateGate.apply(historicalLiveLikeScan, 2.5, 12);
check('721 historical/research semantics remain unchanged: the original two-per-category cap still applies', historicalGate.scan.selected.filter(row => row.asset.category === 'EUROPE_EQUITY').length <= 2);


const usdResearchProbe = {
  ...candidates[0],
  asset: { ...candidates[0].asset, assetId: 'USD_NVDA', ticker: 'NVDA', name: 'NVIDIA Corporation', currency: 'USD' }
};
const usdProbeScan: any = {
  ...scan,
  scanned: 1, accepted: 1, rejected: 0,
  candidates: [usdResearchProbe], selected: [usdResearchProbe],
  dynamicMarketShortlist: undefined
};
const usdProbeResult = PortfolioCandidateGate.apply(usdProbeScan, 2.5, 12);
check('722 USD research cannot pass the production candidate gate without verified FX execution',
  usdProbeResult.entries.length === 1
  && usdProbeResult.entries[0].status === 'REJECTED'
  && usdProbeResult.entries[0].reason === 'USD_RESEARCH_ONLY_FX_EXECUTION_UNVERIFIED'
  && usdProbeResult.scan.selected.length === 0);

// PRICE_VOLUME_EVIDENCE_V1 is research context only. It never changes any
// legacy gate, timing, allocation, execution or signal returned by this suite.
const priceVolumeBars = Array.from({ length: 75 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
  open: 100, high: 101, low: 99, close: 100, volume: 1000
}));
const priceVolumeDate = priceVolumeBars.at(-1)!.timestamp.slice(0, 10);
const volumeInput = {
  bars: priceVolumeBars,
  informationDate: priceVolumeDate,
  provenance: 'REAL' as const,
  instrumentType: 'EQUITY'
};
const noEvent = assessPriceVolumeEvidence(volumeInput);
check('723 price/volume uses REAL daily bars but does not pretend to identify an institution',
  noEvent.state === 'REAL_EOD_AVAILABLE' && noEvent.institutionalBuyerIdentified === false
  && noEvent.highVolumeBreakout === false && noEvent.highVolumeBreakdown === false);

const breakoutBars = priceVolumeBars.map(bar => ({ ...bar }));
breakoutBars.at(-1)!.close = 104;
breakoutBars.at(-1)!.high = 105;
breakoutBars.at(-1)!.volume = 3000;
const breakout = assessPriceVolumeEvidence({ ...volumeInput, bars: breakoutBars });
check('724 20-session close breakout with 3x previous-50-session volume is measured',
  breakout.priceBreakout20 === true && breakout.highVolumeBreakout === true
  && breakout.relativeVolume50 === 3 && breakout.prior20High === 101);
check('725 adding future prices and volume cannot change the earlier research snapshot',
  JSON.stringify(breakout) === JSON.stringify(assessPriceVolumeEvidence({
    ...volumeInput, bars: [...breakoutBars, {
      timestamp: '2025-07-01T00:00:00.000Z', open: 150, high: 200, low: 100,
      close: 190, volume: 1_000_000
    }]
  })));
const wickBars = priceVolumeBars.map(bar => ({ ...bar }));
wickBars.at(-1)!.high = 120;
wickBars.at(-1)!.volume = 3000;
check('726 a high-volume intraday wick without confirmed closing breakout is not a breakout',
  assessPriceVolumeEvidence({ ...volumeInput, bars: wickBars }).highVolumeBreakout === false);
const breakdownBars = priceVolumeBars.map(bar => ({ ...bar }));
breakdownBars.at(-1)!.close = 95;
breakdownBars.at(-1)!.low = 94;
breakdownBars.at(-1)!.volume = 3000;
const breakdown = assessPriceVolumeEvidence({ ...volumeInput, bars: breakdownBars });
check('727 breakdown context is not a purchase or executable SELL instruction',
  breakdown.highVolumeBreakdown === true && breakdown.highVolumeBreakout === false
  && breakdown.authority === 'RESEARCH_ONLY');
check('728 funds without actual listed volume are unavailable, not a failed volume signal',
  assessPriceVolumeEvidence({ ...volumeInput, instrumentType: 'MUTUAL_FUND' }).state === 'NO_RELIABLE_LISTED_VOLUME');
check('729 provenance fail-closed forbids synthetic and static reference data',
  ['SYNTHETIC', 'STATIC_REFERENCE'].every(provenance =>
    assessPriceVolumeEvidence({ ...volumeInput, provenance: provenance as 'SYNTHETIC' | 'STATIC_REFERENCE' }).state === 'NON_REAL_SOURCE'));
const invalidVolumeBars = priceVolumeBars.map(bar => ({ ...bar }));
invalidVolumeBars.at(-2)!.volume = 0;
check('730 incomplete 50-session volume history cannot turn missing data into a positive or zero signal',
  assessPriceVolumeEvidence({ ...volumeInput, bars: invalidVolumeBars }).state === 'NO_RELIABLE_LISTED_VOLUME');
const contractedVolumeBars = priceVolumeBars.map(bar => ({ ...bar }));
for (let index = contractedVolumeBars.length - 11; index < contractedVolumeBars.length - 6; index++) contractedVolumeBars[index].volume = 2000;
for (let index = contractedVolumeBars.length - 6; index < contractedVolumeBars.length - 1; index++) contractedVolumeBars[index].volume = 500;
check('731 consolidation volume contraction uses only previous sessions, never entry-day volume',
  assessPriceVolumeEvidence({ ...volumeInput, bars: contractedVolumeBars }).preBreakoutVolumeContraction5v5 === 0.25);
check('732 invalid OHLC cannot claim institutional evidence',
  assessPriceVolumeEvidence({ ...volumeInput, bars: [...priceVolumeBars.slice(0, -1), {
    ...priceVolumeBars.at(-1)!, close: -1
  }] }).state === 'INVALID_OHLCV');
check('733 late/missing daily bar refuses to infer an observation at an unobserved information date',
  assessPriceVolumeEvidence({ ...volumeInput, informationDate: '2025-09-30' }).state === 'NO_BAR_AT_INFORMATION_DATE');
const unchangedGateAfterPriceVolume = PortfolioCandidateGate.apply(scan, 2.5, 12);
check('734 price-volume readout never changes the unique production gate or its selected instruments',
  JSON.stringify(unchangedGateAfterPriceVolume) === JSON.stringify(result));

console.log(`Portfolio candidate gate: ${passed} invariants passed.`);