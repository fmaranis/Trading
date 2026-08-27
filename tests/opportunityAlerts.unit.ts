import { assessCrossProviderEvidence, OpportunityAlertEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const confirmed = assessCrossProviderEvidence({ primaryProvider: 'Yahoo', secondaryProvider: 'EODHD', requested: 8, checked: 8, matched: 8, divergent: 0, summaryState: 'AVAILABLE', checkedAt: '2026-08-26T22:00:00Z' });
check('201 full provider agreement is confirmed', confirmed.state === 'CROSS_PROVIDER_CONFIRMED');
check('202 confirmed coverage is 100 percent', confirmed.coveragePct === 100);
check('203 evidence never blocks deterministic decision', confirmed.isDecisionBlocking === false);

const divergence = assessCrossProviderEvidence({ primaryProvider: 'Yahoo', secondaryProvider: 'EODHD', requested: 8, checked: 8, matched: 7, divergent: 1, summaryState: 'AVAILABLE', checkedAt: '2026-08-26T22:00:00Z' });
check('204 any material provider divergence is explicit', divergence.state === 'CROSS_PROVIDER_DIVERGENCE');

const scan: any = {
  selected: [
    { asset: { assetId: 'A', ticker: 'AAA.DE' }, score: 6, momentum120Pct: 12, annualizedVolatilityPct: 10 },
    { asset: { assetId: 'B', ticker: 'BBB.DE' }, score: 3, momentum120Pct: 5, annualizedVolatilityPct: 8 },
    { asset: { assetId: 'C', ticker: 'CCC.DE' }, score: 1, momentum120Pct: 2, annualizedVolatilityPct: 7 }
  ]
};
const decision: any = {
  asOfDate: '2026-08-26', marketRegime: 'BULL_LOW_VOL', regimeVolatilityPct: 10, cashWeight: 0.12,
  assets: [{ assetId: 'A', ticker: 'AAA.DE', weight: 0.45 }, { assetId: 'B', ticker: 'BBB.DE', weight: 0.43 }]
};
const previous: any = {
  marketRegime: 'SIDEWAYS_LOW_VOL', cashWeight: 0.30,
  allocations: [{ assetId: 'A', ticker: 'AAA.DE', weight: 0.20 }, { assetId: 'B', ticker: 'BBB.DE', weight: 0.50 }]
};
const alerts = OpportunityAlertEngine.evaluate({ scan, decision, previousDecision: previous, evidence: confirmed });
check('205 regime change creates material alert', alerts.some(a => a.type === 'REGIME_CHANGE' && a.severity === 'MATERIAL'));
check('206 material allocation change creates rebalance review', alerts.some(a => a.type === 'REBALANCE'));
check('207 strong top-three candidate creates opportunity review', alerts.some(a => a.type === 'OPPORTUNITY' && a.ticker === 'AAA.DE'));
check('208 confirmed strong opportunity may be material', alerts.some(a => a.ticker === 'AAA.DE' && a.severity === 'MATERIAL'));

const dataAlerts = OpportunityAlertEngine.evaluate({ scan, decision, evidence: divergence });
check('209 provider divergence creates data warning', dataAlerts.some(a => a.type === 'DATA_WARNING'));
check('210 alerts are review signals, never automatic buy orders', dataAlerts.every(a => a.action !== ('BUY' as any)));

console.log(`Opportunity/Evidence: ${passed}/10 invariants passed.`);
