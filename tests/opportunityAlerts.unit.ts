import { assessCrossProviderEvidence, OpportunityAlertEngine } from '../src/investment/decision';
import type { PriceBar } from '../src/investment/backtesting/types';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

function risingBars(multiplier = 1.001): PriceBar[] {
  const bars: PriceBar[] = [];
  let price = 100;
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 320; i++) {
    price *= multiplier;
    const timestamp = new Date(start + i * 86_400_000).toISOString();
    bars.push({ timestamp, open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price, volume: 1000 });
  }
  return bars;
}

const confirmed = assessCrossProviderEvidence({ primaryProvider: 'Yahoo', secondaryProvider: 'EODHD', requested: 8, checked: 8, matched: 8, divergent: 0, summaryState: 'AVAILABLE', checkedAt: '2026-08-26T22:00:00Z' });
check('201 full provider agreement is confirmed', confirmed.state === 'CROSS_PROVIDER_CONFIRMED');
check('202 confirmed coverage is 100 percent', confirmed.coveragePct === 100);
check('203 evidence never blocks deterministic decision', confirmed.isDecisionBlocking === false);

const divergence = assessCrossProviderEvidence({ primaryProvider: 'Yahoo', secondaryProvider: 'EODHD', requested: 8, checked: 8, matched: 7, divergent: 1, summaryState: 'AVAILABLE', checkedAt: '2026-08-26T22:00:00Z' });
check('204 any material provider divergence is explicit', divergence.state === 'CROSS_PROVIDER_DIVERGENCE');

const candidate = (id: string, ticker: string, score: number, momentum120Pct: number, vol: number) => ({
  asset: { assetId: id, ticker, name: ticker, category: 'GLOBAL_EQUITY', instrumentType: 'ETF_ETC', currency: 'EUR' },
  status: 'ACCEPTED', bars: 320, asOfDate: '2026-08-26', lastClose: 130,
  momentum20Pct: momentum120Pct / 5, momentum60Pct: momentum120Pct / 2, momentum120Pct,
  annualizedVolatilityPct: vol, maxDrawdownPct: 5, score,
  response: { provenance: { sourceType: 'REAL', provider: 'fixture', isReproducible: true } }
});
const candidates: any[] = [
  candidate('A', 'AAA.DE', 18, 18, 10),
  candidate('B', 'BBB.DE', 11, 10, 11),
  candidate('C', 'CCC.DE', 8, 7, 12),
  candidate('D', 'DDD.DE', 25, -3, 9)
];
const assets = candidates.map(c => ({ assetId: c.asset.assetId, ticker: c.asset.ticker, name: c.asset.name, bars: risingBars(), provenance: c.response.provenance }));
const scan: any = {
  scanned: 4, accepted: 4, rejected: 0, rejectionCounts: {},
  // Deliberately omit AAA from selected: alerts must inspect the full candidate set,
  // not just the final diversified allocator shortlist.
  selected: [candidates[1], candidates[2]],
  candidates,
  acceptedDataset: { timeframe: '1d', assets },
  dataset: { timeframe: '1d', assets: assets.slice(1, 3) }
};
const decision: any = {
  asOfDate: '2026-08-26', marketRegime: 'BULL_LOW_VOL', regimeVolatilityPct: 10, cashWeight: 0.12,
  assets: [{ assetId: 'B', ticker: 'BBB.DE', weight: 0.45 }, { assetId: 'C', ticker: 'CCC.DE', weight: 0.43 }]
};
const previousDecision: any = {
  asOfDate: '2026-08-25', marketRegime: 'SIDEWAYS_LOW_VOL', cashWeight: 0.30,
  allocations: [{ assetId: 'B', ticker: 'BBB.DE', weight: 0.20 }, { assetId: 'C', ticker: 'CCC.DE', weight: 0.50 }]
};

const baseline = OpportunityAlertEngine.evaluate({ scan, decision, evidence: confirmed, cashBenchmarkAnnualPct: 2.5 });
check('205 first snapshot does not manufacture opportunity alerts', !baseline.some(a => a.type === 'OPPORTUNITY'));

const gateAwarePrevious: any = {
  asOfDate: '2026-08-25',
  shortlist: [
    { ticker: 'AAA.DE', score: 17, momentum120Pct: 17, annualizedVolatilityPct: 10, eligibleForNewMoney: false, gateReason: 'CONSENSUS_WATCH', consensusScore: 1, excessVsCashPctPoints: 30, rankingScore: null },
    { ticker: 'BBB.DE', score: 10.5, momentum120Pct: 9, annualizedVolatilityPct: 11, eligibleForNewMoney: true, gateReason: 'BEATS_CASH_AND_CONSENSUS_BUY', consensusScore: 4, excessVsCashPctPoints: 18, rankingScore: 38 },
    { ticker: 'CCC.DE', score: 7.8, momentum120Pct: 7, annualizedVolatilityPct: 12, eligibleForNewMoney: true, gateReason: 'BEATS_CASH_AND_CONSENSUS_BUY', consensusScore: 3, excessVsCashPctPoints: 12, rankingScore: 29 }
  ]
};
const changedAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousDecision, previousSnapshot: gateAwarePrevious, evidence: confirmed, cashBenchmarkAnnualPct: 2.5 });
check('206 candidate outside allocator shortlist can create opportunity alert', changedAlerts.some(a => a.type === 'OPPORTUNITY' && a.ticker === 'AAA.DE'));
check('207 opportunity transition is based on cash plus consensus gate', changedAlerts.some(a => a.ticker === 'AAA.DE' && a.reasons.some(r => r.includes('cash + consenso'))));
check('208 regime change creates material alert', changedAlerts.some(a => a.type === 'REGIME_CHANGE' && a.severity === 'MATERIAL'));
check('209 material allocation change creates rebalance review', changedAlerts.some(a => a.type === 'REBALANCE'));
check('210 opportunities remain review-only', changedAlerts.filter(a => a.type === 'OPPORTUNITY').every(a => a.severity === 'REVIEW' && a.action === 'REVIEW'));

const oldFormatSnapshot: any = {
  asOfDate: '2026-08-25',
  shortlist: [{ ticker: 'AAA.DE', score: 17, momentum120Pct: 17, annualizedVolatilityPct: 10 }]
};
const migrationAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousSnapshot: oldFormatSnapshot, evidence: confirmed, cashBenchmarkAnnualPct: 2.5 });
check('211 legacy snapshots establish baseline instead of flooding alerts', !migrationAlerts.some(a => a.type === 'OPPORTUNITY'));

const dataAlerts = OpportunityAlertEngine.evaluate({ scan, decision, evidence: divergence, cashBenchmarkAnnualPct: 2.5 });
check('212 provider divergence creates data warning', dataAlerts.some(a => a.type === 'DATA_WARNING'));
check('213 alerts never become automatic buy orders', [...dataAlerts, ...changedAlerts].every(a => a.action !== ('BUY' as any)));

console.log(`Opportunity/Evidence: ${passed}/13 invariants passed.`);
