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
    { asset: { assetId: 'C', ticker: 'CCC.DE' }, score: 2.5, momentum120Pct: 4, annualizedVolatilityPct: 7 },
    { asset: { assetId: 'D', ticker: 'DDD.DE' }, score: 2.2, momentum120Pct: 3, annualizedVolatilityPct: 9 }
  ]
};
const decision: any = {
  asOfDate: '2026-08-26', marketRegime: 'BULL_LOW_VOL', regimeVolatilityPct: 10, cashWeight: 0.12,
  assets: [{ assetId: 'A', ticker: 'AAA.DE', weight: 0.45 }, { assetId: 'B', ticker: 'BBB.DE', weight: 0.43 }]
};
const previousDecision: any = {
  asOfDate: '2026-08-25', marketRegime: 'SIDEWAYS_LOW_VOL', cashWeight: 0.30,
  allocations: [{ assetId: 'A', ticker: 'AAA.DE', weight: 0.20 }, { assetId: 'B', ticker: 'BBB.DE', weight: 0.50 }]
};

const baseline = OpportunityAlertEngine.evaluate({ scan, decision, evidence: confirmed });
check('205 first snapshot does not manufacture opportunity alerts', !baseline.some(a => a.type === 'OPPORTUNITY'));

const unchangedSnapshot: any = {
  asOfDate: '2026-08-25',
  shortlist: [
    { ticker: 'AAA.DE', score: 5.8, momentum120Pct: 11, annualizedVolatilityPct: 10 },
    { ticker: 'BBB.DE', score: 2.9, momentum120Pct: 5, annualizedVolatilityPct: 8 },
    { ticker: 'CCC.DE', score: 2.4, momentum120Pct: 4, annualizedVolatilityPct: 7 },
    { ticker: 'DDD.DE', score: 2.1, momentum120Pct: 3, annualizedVolatilityPct: 9 }
  ]
};
const stableAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousSnapshot: unchangedSnapshot, evidence: confirmed });
check('206 unchanged top-three snapshot does not repeat opportunity alerts', !stableAlerts.some(a => a.type === 'OPPORTUNITY'));

const changedSnapshot: any = {
  asOfDate: '2026-08-25',
  shortlist: [
    { ticker: 'BBB.DE', score: 4.0, momentum120Pct: 5, annualizedVolatilityPct: 8 },
    { ticker: 'CCC.DE', score: 3.5, momentum120Pct: 4, annualizedVolatilityPct: 7 },
    { ticker: 'DDD.DE', score: 3.0, momentum120Pct: 3, annualizedVolatilityPct: 9 },
    { ticker: 'AAA.DE', score: 4.5, momentum120Pct: 10, annualizedVolatilityPct: 10 }
  ]
};
const changedAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousDecision, previousSnapshot: changedSnapshot, evidence: confirmed });
check('207 entry into top three creates opportunity review', changedAlerts.some(a => a.type === 'OPPORTUNITY' && a.ticker === 'AAA.DE'));
check('208 regime change creates material alert', changedAlerts.some(a => a.type === 'REGIME_CHANGE' && a.severity === 'MATERIAL'));
check('209 material allocation change creates rebalance review', changedAlerts.some(a => a.type === 'REBALANCE'));
check('210 opportunities remain review-only with confirmed market data', changedAlerts.filter(a => a.type === 'OPPORTUNITY').every(a => a.severity === 'REVIEW'));

const scoreJumpSnapshot: any = {
  asOfDate: '2026-08-25',
  shortlist: [
    { ticker: 'AAA.DE', score: 4.7, momentum120Pct: 10, annualizedVolatilityPct: 10 },
    { ticker: 'BBB.DE', score: 2.9, momentum120Pct: 5, annualizedVolatilityPct: 8 },
    { ticker: 'CCC.DE', score: 2.4, momentum120Pct: 4, annualizedVolatilityPct: 7 }
  ]
};
const scoreJumpAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousSnapshot: scoreJumpSnapshot, evidence: confirmed });
check('211 score improvement of at least one point creates review', scoreJumpAlerts.some(a => a.type === 'OPPORTUNITY' && a.ticker === 'AAA.DE'));

const transitionSnapshot: any = {
  asOfDate: '2026-08-25',
  shortlist: [
    { ticker: 'AAA.DE', score: 6, momentum120Pct: -1, annualizedVolatilityPct: 10 },
    { ticker: 'BBB.DE', score: 2.9, momentum120Pct: 5, annualizedVolatilityPct: 8 },
    { ticker: 'CCC.DE', score: 2.4, momentum120Pct: 4, annualizedVolatilityPct: 7 }
  ]
};
const transitionAlerts = OpportunityAlertEngine.evaluate({ scan, decision, previousSnapshot: transitionSnapshot, evidence: confirmed });
check('212 eligibility transition creates review', transitionAlerts.some(a => a.type === 'OPPORTUNITY' && a.ticker === 'AAA.DE'));

const dataAlerts = OpportunityAlertEngine.evaluate({ scan, decision, evidence: divergence });
check('213 provider divergence creates data warning', dataAlerts.some(a => a.type === 'DATA_WARNING'));
check('214 alerts are review signals, never automatic buy orders', [...dataAlerts, ...changedAlerts].every(a => a.action !== ('BUY' as any)));

console.log(`Opportunity/Evidence: ${passed}/14 invariants passed.`);
