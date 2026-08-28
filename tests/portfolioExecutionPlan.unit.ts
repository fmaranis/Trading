import assert from 'node:assert/strict';
import { buildPortfolioExecutionPlan } from '../src/investment/decision/portfolioExecutionPlan';

let passed = 0;
function ok(condition: unknown, message: string) { assert.ok(condition, message); passed++; }

const portfolio: any = {
  cashEur: 300,
  holdings: [{ ticker: 'ETF1.DE', shares: 5 }],
  funds: [{ id: 'fund_old', isin: 'OLD123', name: 'Fondo antiguo', category: 'GLOBAL_EQUITY', investedEur: 500, currentValueEur: 520, transferable: true }],
  stagedCapitalPlan: { availableEur: 200, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: new Date().toISOString()
};

const scan: any = {
  candidates: [
    { asset: { assetId: 'ETF1', ticker: 'ETF1.DE', isin: 'ETFISIN1', name: 'ETF actual', category: 'EUROPE_EQUITY', instrumentType: 'ETF_ETC' }, lastClose: 50 },
    { asset: { assetId: 'ETF2', ticker: 'ETF2.DE', isin: 'ETFISIN2', name: 'ETF destino', category: 'SMALL_CAP', instrumentType: 'ETF_ETC' }, lastClose: 40 },
    { asset: { assetId: 'CHEAP', ticker: 'CHEAP.DE', isin: 'CHEAPISIN', name: 'ETF barato', category: 'HEALTHCARE', instrumentType: 'ETF_ETC' }, lastClose: 20 },
    { asset: { assetId: 'FUND2', ticker: 'FUND2', isin: 'NEW456', name: 'Fondo destino', category: 'US_EQUITY', instrumentType: 'MUTUAL_FUND' }, lastClose: 1 }
  ]
};

const portfolioDecision: any = {
  exposures: [
    { category: 'EUROPE_EQUITY', gapEur: -100 },
    { category: 'GLOBAL_EQUITY', gapEur: -200 },
    { category: 'SMALL_CAP', gapEur: 160 },
    { category: 'US_EQUITY', gapEur: 200 }
  ],
  existingPositions: [
    { id: 'ETF1.DE', label: 'ETF actual', instrumentType: 'ETF_ETC', category: 'EUROPE_EQUITY', currentValueEur: 250, action: 'REDUCE', reason: 'Sobreponderación.' },
    { id: 'fund_old', label: 'Fondo antiguo', instrumentType: 'MUTUAL_FUND', category: 'GLOBAL_EQUITY', currentValueEur: 520, action: 'REVIEW_TRANSFER', reason: 'Revisar traspaso.' }
  ],
  contributions: [
    { category: 'SMALL_CAP', assetId: 'ETF2', ticker: 'ETF2.DE', name: 'ETF destino', instrumentType: 'ETF_ETC', amountEur: 160, targetCategoryGapEur: 160, reason: 'Cubrir déficit.' },
    { category: 'US_EQUITY', assetId: 'FUND2', ticker: 'FUND2', name: 'Fondo destino', instrumentType: 'MUTUAL_FUND', amountEur: 200, targetCategoryGapEur: 200, reason: 'Cubrir déficit.' }
  ],
  warnings: []
};

const plan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-28', portfolioDecision });
ok(plan.lines.some(x => x.action === 'BUY_ETF' && x.shares === 4 && x.amountEur === 160 && x.estimatedFeeEur === 1), 'ETF contribution becomes whole-share costed buy instruction');
ok(plan.lines.some(x => x.action === 'SUBSCRIBE_FUND' && x.targetIsin === 'NEW456' && x.amountEur === 200), 'fund contribution becomes fund subscription instruction');
ok(plan.lines.some(x => x.action === 'SELL_ETF' && x.shares === 2 && x.amountEur === 100 && x.estimatedFeeEur === 1), 'ETF overweight becomes quantified costed partial sale');
const transfer = plan.lines.find(x => x.action === 'TRANSFER_FUND');
ok(!!transfer, 'transferable overweight fund prefers transfer review when a fund destination exists');
ok(transfer?.sourceIsin === 'OLD123' && transfer?.targetIsin === 'NEW456', 'fund transfer preserves source and destination ISINs');
ok(transfer?.taxNote?.includes('elegibilidad fiscal') === true, 'fund transfer carries explicit tax eligibility warning');
ok(plan.warnings.includes('PLAN_IS_MANUAL_EXECUTION_GUIDANCE_NOT_A_BROKER_ORDER'), 'plan explicitly remains manual guidance');

const smallDecision: any = {
  exposures: [{ category: 'SMALL_CAP', gapEur: 20 }], existingPositions: [],
  contributions: [{ category: 'SMALL_CAP', assetId: 'ETF2', ticker: 'ETF2.DE', name: 'ETF destino', instrumentType: 'ETF_ETC', amountEur: 20, targetCategoryGapEur: 20, reason: 'Déficit pequeño.' }], warnings: []
};
const smallPlan = buildPortfolioExecutionPlan({ portfolio: { ...portfolio, holdings: [], funds: [] }, scan, decisionAsOf: '2026-08-28', portfolioDecision: smallDecision });
ok(smallPlan.lines[0]?.action === 'REVIEW', 'ETF amount below one whole share is not emitted as an executable buy');
ok(smallPlan.warnings.some(x => x.startsWith('ETF_AMOUNT_BELOW_ONE_SHARE:')), 'whole-share affordability limitation is explicit');

const costlyDecision: any = {
  exposures: [{ category: 'HEALTHCARE', gapEur: 40 }], existingPositions: [],
  contributions: [{ category: 'HEALTHCARE', assetId: 'CHEAP', ticker: 'CHEAP.DE', name: 'ETF barato', instrumentType: 'ETF_ETC', amountEur: 40, targetCategoryGapEur: 40, reason: 'Señal válida pero pequeña.' }], warnings: []
};
const costlyPlan = buildPortfolioExecutionPlan({ portfolio: { ...portfolio, holdings: [], funds: [] }, scan, decisionAsOf: '2026-08-28', portfolioDecision: costlyDecision });
ok(costlyPlan.lines[0]?.action === 'REVIEW', 'whole-share order can still be suppressed when notional is too small');
ok(costlyPlan.warnings.some(x => x.startsWith('ETF_ORDER_SUPPRESSED_BY_COST_POLICY:')), 'cost-aware suppression is explicit in plan warnings');

console.log(`Portfolio Execution Plan: ${passed}/${passed} execution/transfer/whole-share/cost invariants passed.`);
