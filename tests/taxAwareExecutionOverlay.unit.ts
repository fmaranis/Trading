import { applyTaxAwareExecutionOverlay } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const portfolio: any = {
  cashEur: 0,
  holdings: [],
  funds: [{ id: 'fund_a', isin: 'IE0000000001', name: 'Fund A', category: 'OTHER', investedEur: 1000, currentValueEur: 1200, units: 10, acquisitionDate: '2025-01-01', transferable: false }],
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-29T00:00:00Z'
};
const candidates: any[] = [
  { asset: { assetId: 'SRC', ticker: 'IE0000000001', isin: 'IE0000000001', name: 'Fund A', category: 'OTHER', instrumentType: 'MUTUAL_FUND' }, status: 'ACCEPTED', momentum120Pct: 2 },
  { asset: { assetId: 'DST', ticker: 'IE0000000002', isin: 'IE0000000002', name: 'Fund B', category: 'OTHER', instrumentType: 'MUTUAL_FUND' }, status: 'ACCEPTED', momentum120Pct: 4 }
];
const scan: any = { candidates, selected: candidates, acceptedDataset: { timeframe: '1d', assets: [] }, dataset: { timeframe: '1d', assets: [] } };
const basePlan: any = {
  id: 'plan', createdAt: '2026-08-29T00:00:00Z', decisionAsOf: '2026-08-29', cashBenchmarkAnnualPct: 2.5, warnings: [],
  lines: [
    { id: 'sell', action: 'REDEEM_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', sourceId: 'fund_a', sourceIsin: 'IE0000000001', sourceLabel: 'Fund A', category: 'OTHER', amountEur: 600, shares: null, estimatedPriceEur: null, estimatedFeeEur: 0, instruction: 'Reducir', rationale: 'Deterioro moderado' },
    { id: 'buy', action: 'SUBSCRIBE_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', targetAssetId: 'DST', targetIsin: 'IE0000000002', targetTicker: 'IE0000000002', category: 'OTHER', amountEur: 600, shares: null, estimatedPriceEur: null, estimatedFeeEur: 0, estimatedAnnualReturnProxyPct: 5, instruction: 'Comprar', rationale: 'Destino' }
  ]
};
const reduceDecision: any = { existingPositions: [{ id: 'fund_a', action: 'REDUCE' }], exposures: [], contributions: [], currentInvestedValueEur: 1200, currentCashEur: 0, pendingCapitalEur: 0, totalPlannedCapitalEur: 1200 };
const reduced = applyTaxAwareExecutionOverlay({ plan: basePlan, portfolio, portfolioDecision: reduceDecision, scan, horizonYears: 1, taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }, currentValueByKey: { fund_a: 1200 } });
check('921 partial rotation is vetoed when tax friction is not justified', reduced.lines[0].action === 'REVIEW');
check('922 tax-aware veto is explicitly recorded', reduced.warnings.some((w: string) => w.startsWith('TAX_AWARE_ROTATION_VETO:')));
check('923 tax note remains visible on a vetoed rotation', Boolean(reduced.lines[0].taxNote));

const exitDecision: any = { ...reduceDecision, existingPositions: [{ id: 'fund_a', action: 'EXIT' }] };
const exited = applyTaxAwareExecutionOverlay({ plan: basePlan, portfolio, portfolioDecision: exitDecision, scan, horizonYears: 1, taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }, currentValueByKey: { fund_a: 1200 } });
check('924 structural EXIT is not blocked by tax friction', exited.lines[0].action === 'REDEEM_FUND');
check('925 structural EXIT still shows estimated tax friction', Boolean(exited.lines[0].taxNote));

const transferPlan: any = { ...basePlan, lines: [{ ...basePlan.lines[0], id: 'transfer', action: 'TRANSFER_FUND', targetAssetId: 'DST', targetIsin: 'IE0000000002', targetTicker: 'IE0000000002' }] };
const transferred = applyTaxAwareExecutionOverlay({ plan: transferPlan, portfolio, portfolioDecision: reduceDecision, scan, horizonYears: 1, taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }, currentValueByKey: { fund_a: 1200 } });
check('926 fund transfer remains executable', transferred.lines[0].action === 'TRANSFER_FUND');
check('927 fund transfer reports zero/immediate deferred-tax treatment', transferred.lines[0].taxNote?.includes('coste fiscal inmediato estimado 0') === true);

console.log(`Tax-aware execution overlay: ${passed}/7 invariants passed.`);
