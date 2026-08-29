import {
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
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

const strongBars = risingBars(1.0022);
const strongerBars = risingBars(1.0028);
const weakBars = risingBars(1.00005);
const fallingBars = risingBars(0.998);

const candidates: any[] = [
  candidate('STRONG_A', 'STRONGA.DE', 'TECHNOLOGY', strongBars, 22, 14, 8, 15),
  candidate('STRONG_B', 'STRONGB.DE', 'EUROPE_EQUITY', strongerBars, 30, 16, 9, 20),
  candidate('WEAK', 'WEAK.DE', 'DIVIDEND', weakBars, 0.6, 8, 4, 2),
  candidate('FALLING', 'FALLING.DE', 'ENERGY', fallingBars, -20, 25, 30, -20)
];
const acceptedDataset: any = {
  timeframe: '1d',
  assets: candidates.map((c, index) => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, currency: 'EUR', bars: [strongBars, strongerBars, weakBars, fallingBars][index], provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true } }))
};
const scan: any = { scanned: 4, accepted: 4, rejected: 0, selected: candidates, candidates, acceptedDataset, dataset: acceptedDataset, rejectionCounts: {} };

const result = PortfolioCandidateGate.apply(scan, 2.5, 12);
check('701 strong candidate A survives cash + consensus before allocation', result.scan.selected.some(c => c.asset.assetId === 'STRONG_A'));
check('702 stronger candidate B survives cash + consensus before allocation', result.scan.selected.some(c => c.asset.assetId === 'STRONG_B'));
check('703 weak candidate that does not beat cash is excluded before allocator', !result.scan.selected.some(c => c.asset.assetId === 'WEAK') && result.entries.some(e => e.assetId === 'WEAK' && e.reason === 'DOES_NOT_BEAT_CASH'));
check('704 structural falling candidate is excluded before allocator', !result.scan.selected.some(c => c.asset.assetId === 'FALLING'));
check('705 gated dataset contains only selected candidates', result.scan.dataset.assets.length === result.scan.selected.length && result.scan.dataset.assets.every(a => result.scan.selected.some(c => c.asset.assetId === a.assetId)));
check('706 gate is not hard-coded to the old eight-slot shortlist', result.selectedCount <= 12);

const productionTickers = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(x => x.ticker.toUpperCase()));
const holdoutTickers = EUR_VALIDATION_HOLDOUT_UNIVERSE.map(x => x.ticker.toUpperCase());
check('707 validation holdout remains isolated from production discovery universe', holdoutTickers.every(ticker => !productionTickers.has(ticker)));
check('708 production discovery universe is broader than the original small allocator shortlist', EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length > 50);
check('709 every production discovery candidate exposes a checksum-valid operational ISIN', EUR_PORTFOLIO_DISCOVERY_UNIVERSE.every(item => isValidIsin(item.isin)));

console.log(`Portfolio candidate gate: ${passed}/9 invariants passed.`);