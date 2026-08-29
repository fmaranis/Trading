import { CurrentOpportunityAlertEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}
function bars(multiplier: number, count = 320) {
  const out: any[] = []; let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    out.push({ timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  return out;
}
function candidate(assetId: string, ticker: string, series: any[], m120: number, vol: number, score: number): any {
  return { asset: { assetId, ticker, name: ticker, category: 'TECHNOLOGY', currency: 'EUR' }, status: 'ACCEPTED', bars: series.length, asOfDate: series.at(-1).timestamp.slice(0,10), lastClose: series.at(-1).close, momentum20Pct: m120 / 4, momentum60Pct: m120 / 2, momentum120Pct: m120, annualizedVolatilityPct: vol, maxDrawdownPct: 8, score };
}
const strongBars = bars(1.0022);
const weakBars = bars(1.00005);
const fallingBars = bars(0.998);
const candidates: any[] = [
  candidate('STRONG', 'STRONG.DE', strongBars, 22, 14, 18),
  candidate('WEAK', 'WEAK.DE', weakBars, 0.5, 8, 8),
  { ...candidate('FALL', 'FALL.DE', fallingBars, -20, 25, -15), momentum20Pct: -5, momentum60Pct: -10 }
];
const acceptedDataset: any = { timeframe: '1d', assets: candidates.map((c, i) => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, currency: 'EUR', bars: [strongBars, weakBars, fallingBars][i], provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true } })) };
const scan: any = { scanned: 3, accepted: 3, rejected: 0, selected: candidates, candidates, acceptedDataset, dataset: acceptedDataset, rejectionCounts: {} };

const alerts = CurrentOpportunityAlertEngine.evaluate(scan, 2.5);
check('901 strong candidate creates a current opportunity alert', alerts.some(a => a.assetId === 'STRONG'));
check('902 aligned strong candidate reaches HIGH_CONVICTION', alerts.find(a => a.assetId === 'STRONG')?.level === 'HIGH_CONVICTION');
check('903 below-cash weak candidate never creates an entry alert', !alerts.some(a => a.assetId === 'WEAK'));
check('904 structural falling candidate never creates an entry alert', !alerts.some(a => a.assetId === 'FALL'));
check('905 every emitted alert already has BUY-grade consensus', alerts.every(a => a.consensusScore >= 2 && a.favorableVotes >= 3));
check('906 high conviction requires at least four favorable votes', alerts.filter(a => a.level === 'HIGH_CONVICTION').every(a => a.favorableVotes >= 4));

console.log(`Current opportunity alerts: ${passed}/6 invariants passed.`);
