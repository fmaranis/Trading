import assert from 'node:assert/strict';
import { buildPortfolioExecutionPlan } from '../src/investment/decision/portfolioExecutionPlan';
import { applyPortfolioExecutionLine } from '../src/investment/decision/portfolioStateExecution';

let passed = 0;
function ok(condition: unknown, message: string) { assert.ok(condition, message); passed++; }

const portfolio: any = {
  cashEur: 300,
  holdings: [{ ticker: 'ETF1.DE', shares: 5 }],
  funds: [{ id: 'fund_old', isin: 'OLD123', name: 'Fondo antiguo', category: 'GLOBAL_EQUITY', investedEur: 500, currentValueEur: 520, units: null, transferable: true }],
  stagedCapitalPlan: { availableEur: 200, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: new Date().toISOString()
};
const scan: any = { candidates: [
  { asset: { assetId: 'ETF1', ticker: 'ETF1.DE', isin: 'ETFISIN1', name: 'ETF actual', category: 'EUROPE_EQUITY', instrumentType: 'ETF_ETC' }, lastClose: 50, momentum120Pct: 8 },
  { asset: { assetId: 'ETF2', ticker: 'ETF2.DE', isin: 'ETFISIN2', name: 'ETF destino', category: 'SMALL_CAP', instrumentType: 'ETF_ETC' }, lastClose: 40, momentum120Pct: 10 },
  { asset: { assetId: 'CHEAP', ticker: 'CHEAP.DE', isin: 'CHEAPISIN', name: 'ETF barato', category: 'HEALTHCARE', instrumentType: 'ETF_ETC' }, lastClose: 20, momentum120Pct: 10 },
  { asset: { assetId: 'WEAK', ticker: 'WEAK.DE', isin: 'WEAKISIN', name: 'ETF débil', category: 'TECHNOLOGY', instrumentType: 'ETF_ETC' }, lastClose: 50, momentum120Pct: 0.5 },
  { asset: { assetId: 'FUND2', ticker: 'FUND2', isin: 'NEW456', name: 'Fondo destino', category: 'US_EQUITY', instrumentType: 'MUTUAL_FUND' }, lastClose: 1, momentum120Pct: 8 }
]};

const portfolioDecision: any = {
  currentInvestedValueEur: 770, currentCashEur: 30, pendingCapitalEur: 200, totalPlannedCapitalEur: 1000,
  exposures: [
    { category: 'EUROPE_EQUITY', gapEur: -100 }, { category: 'GLOBAL_EQUITY', gapEur: -200 },
    { category: 'SMALL_CAP', gapEur: 160 }, { category: 'US_EQUITY', gapEur: 200 }
  ],
  existingPositions: [
    { id: 'ETF1.DE', label: 'ETF actual', instrumentType: 'ETF_ETC', category: 'EUROPE_EQUITY', currentValueEur: 250, action: 'REDUCE', reason: 'Sobreponderación.' },
    { id: 'fund_old', label: 'Fondo antiguo', instrumentType: 'MUTUAL_FUND', category: 'GLOBAL_EQUITY', currentValueEur: 520, action: 'REVIEW_TRANSFER', reason: 'Revisar traspaso.' }
  ],
  contributions: [
    { category: 'SMALL_CAP', assetId: 'ETF2', ticker: 'ETF2.DE', name: 'ETF destino', instrumentType: 'ETF_ETC', amountEur: 160, targetCategoryGapEur: 160, reason: 'Cubrir déficit.' },
    { category: 'US_EQUITY', assetId: 'FUND2', ticker: 'FUND2', name: 'Fondo destino', instrumentType: 'MUTUAL_FUND', amountEur: 200, targetCategoryGapEur: 200, reason: 'Cubrir déficit.' }
  ], warnings: []
};
const plan = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: '2026-08-28', portfolioDecision, cashBenchmarkAnnualPct: 2.5 });
ok(plan.lines.some(x => x.action === 'BUY_ETF' && x.shares === 4 && x.amountEur === 160 && x.estimatedFeeEur === 1), 'ETF contribution becomes whole-share costed buy instruction when it beats cash');
ok(plan.lines.some(x => x.action === 'SUBSCRIBE_FUND' && x.targetIsin === 'NEW456' && x.amountEur === 200), 'fund contribution becomes subscription when it beats cash');
ok(plan.lines.some(x => x.action === 'SELL_ETF' && x.shares === 2 && x.amountEur === 100 && x.estimatedFeeEur === 1), 'ETF overweight becomes quantified costed partial sale');
const transfer = plan.lines.find(x => x.action === 'TRANSFER_FUND');
ok(!!transfer, 'transferable overweight fund prefers transfer review when destination also beats cash benchmark');
ok(transfer?.sourceIsin === 'OLD123' && transfer?.targetIsin === 'NEW456', 'fund transfer preserves source and destination ISINs');
ok(transfer?.taxNote?.includes('elegibilidad fiscal') === true, 'fund transfer carries explicit tax eligibility warning');
ok(plan.warnings.some(x => x.startsWith('ADAPTIVE_EXECUTION_POLICY:MEDIUM:')), 'portfolio plan records its adaptive capital band');
ok(plan.warnings.some(x => x === 'CASH_BENCHMARK_ANNUAL_PCT:2.50'), 'portfolio plan records the cash benchmark');
ok(plan.lines.some(x => x.action === 'BUY_ETF' && Number(x.excessReturnVsCashPctPoints) > 0), 'actionable buy exposes positive excess return proxy versus cash');

const smallDecision: any = { currentInvestedValueEur: 0, currentCashEur: 100, pendingCapitalEur: 0, totalPlannedCapitalEur: 100, exposures: [{ category: 'SMALL_CAP', gapEur: 20 }], existingPositions: [], contributions: [{ category: 'SMALL_CAP', assetId: 'ETF2', ticker: 'ETF2.DE', name: 'ETF destino', instrumentType: 'ETF_ETC', amountEur: 20, targetCategoryGapEur: 20, reason: 'Déficit pequeño.' }], warnings: [] };
const smallPlan = buildPortfolioExecutionPlan({ portfolio: { ...portfolio, holdings: [], funds: [] }, scan, decisionAsOf: '2026-08-28', portfolioDecision: smallDecision, cashBenchmarkAnnualPct: 2.5 });
ok(smallPlan.lines[0]?.action === 'REVIEW', 'ETF amount below one whole share is not emitted as an executable buy');
ok(smallPlan.warnings.some(x => x.startsWith('ETF_AMOUNT_BELOW_ONE_SHARE:')), 'whole-share affordability limitation is explicit');

const costlyDecision: any = { currentInvestedValueEur: 0, currentCashEur: 100, pendingCapitalEur: 0, totalPlannedCapitalEur: 100, exposures: [{ category: 'HEALTHCARE', gapEur: 40 }], existingPositions: [], contributions: [{ category: 'HEALTHCARE', assetId: 'CHEAP', ticker: 'CHEAP.DE', name: 'ETF barato', instrumentType: 'ETF_ETC', amountEur: 40, targetCategoryGapEur: 40, reason: 'Señal válida pero pequeña.' }], warnings: [] };
const costlyPlan = buildPortfolioExecutionPlan({ portfolio: { ...portfolio, holdings: [], funds: [] }, scan, decisionAsOf: '2026-08-28', portfolioDecision: costlyDecision, cashBenchmarkAnnualPct: 2.5 });
ok(costlyPlan.lines[0]?.action === 'REVIEW', 'whole-share order can still be suppressed by MICRO capital policy');
ok(costlyPlan.warnings.some(x => x.startsWith('ETF_ORDER_SUPPRESSED_BY_ADAPTIVE_COST_POLICY:')), 'adaptive cost suppression is explicit in plan warnings');
ok(costlyPlan.warnings.some(x => x.startsWith('ADAPTIVE_EXECUTION_POLICY:MICRO:')), 'micro account uses MICRO execution band');

const weakDecision: any = { currentInvestedValueEur: 0, currentCashEur: 1000, pendingCapitalEur: 0, totalPlannedCapitalEur: 1000, exposures: [{ category: 'TECHNOLOGY', gapEur: 200 }], existingPositions: [], contributions: [{ category: 'TECHNOLOGY', assetId: 'WEAK', ticker: 'WEAK.DE', name: 'ETF débil', instrumentType: 'ETF_ETC', amountEur: 200, targetCategoryGapEur: 200, reason: 'Déficit de tecnología.' }], warnings: [] };
const weakPlan = buildPortfolioExecutionPlan({ portfolio: { ...portfolio, cashEur: 1000, holdings: [], funds: [], stagedCapitalPlan: undefined }, scan, decisionAsOf: '2026-08-28', portfolioDecision: weakDecision, cashBenchmarkAnnualPct: 2.5 });
ok(weakPlan.lines[0]?.action === 'REVIEW', 'investment that does not beat the cash benchmark is not emitted as a buy');
ok(weakPlan.lines[0]?.instruction.includes('Mantener en cuenta') === true, 'cash benchmark failure explicitly recommends keeping money in account');
ok(weakPlan.warnings.some(x => x.startsWith('CASH_BENCHMARK_HURDLE_NOT_PASSED:WEAK.DE')), 'cash benchmark suppression is explicit in warnings');

// Transactional state application: DONE is no longer a cosmetic status.
const baseState: any = {
  cashEur: 100,
  holdings: [{ ticker: 'OLD.DE', shares: 5 }],
  funds: [{ id: 'fund_source', isin: 'SRC123', name: 'Origen', category: 'GLOBAL_EQUITY', investedEur: 300, currentValueEur: 300, units: 30, transferable: true }],
  stagedCapitalPlan: { availableEur: 500, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-29T00:00:00Z'
};
const buyLine: any = { id: 'buy1', action: 'BUY_ETF', status: 'PENDING', instrumentType: 'ETF_ETC', targetTicker: 'NEW.DE', category: 'GLOBAL_EQUITY', amountEur: 200, shares: 2, estimatedPriceEur: 100, estimatedFeeEur: 1, instruction: '', rationale: '' };
const bought = applyPortfolioExecutionLine(baseState, buyLine);
ok(bought.portfolio.holdings.some((h: any) => h.ticker === 'NEW.DE' && h.shares === 2), 'executed ETF buy adds shares to the real portfolio state');
ok(bought.portfolio.stagedCapitalPlan?.availableEur === 299 && bought.portfolio.cashEur === 100, 'executed ETF buy consumes pending liquidity including fee before cash');
ok(bought.liquidityBeforeEur === 600 && bought.liquidityAfterEur === 399, 'execution receipt exposes liquidity before and after buy');

const secondBuy: any = { ...buyLine, id: 'buy2', amountEur: 350, shares: 3, estimatedFeeEur: 1 };
const mixedFunding = applyPortfolioExecutionLine(baseState, secondBuy);
ok(mixedFunding.portfolio.stagedCapitalPlan?.availableEur === 149 && mixedFunding.portfolio.cashEur === 100, 'buy consumes a deterministic total amount from unified liquidity');

let insufficientRejected = false;
try { applyPortfolioExecutionLine({ ...baseState, cashEur: 0, stagedCapitalPlan: { ...baseState.stagedCapitalPlan, availableEur: 50 } }, buyLine); } catch { insufficientRejected = true; }
ok(insufficientRejected, 'buy with insufficient unified liquidity is rejected instead of being marked done');

const sellLine: any = { id: 'sell1', action: 'SELL_ETF', status: 'PENDING', instrumentType: 'ETF_ETC', targetTicker: 'OLD.DE', category: 'GLOBAL_EQUITY', amountEur: 200, shares: 2, estimatedPriceEur: 100, estimatedFeeEur: 1, instruction: '', rationale: '' };
const sold = applyPortfolioExecutionLine(baseState, sellLine);
ok(sold.portfolio.holdings.find((h: any) => h.ticker === 'OLD.DE')?.shares === 3, 'executed ETF sale reduces real shares');
ok(sold.portfolio.cashEur === 299, 'executed ETF sale credits net proceeds to cash');

const subscribeLine: any = { id: 'sub1', action: 'SUBSCRIBE_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', targetAssetId: 'FUND_NEW', targetIsin: 'NEWFUND123', targetName: 'Fondo nuevo', category: 'US_EQUITY', amountEur: 150, shares: null, estimatedPriceEur: null, estimatedFeeEur: null, instruction: '', rationale: '' };
const subscribed = applyPortfolioExecutionLine(baseState, subscribeLine);
ok(subscribed.portfolio.funds?.some((f: any) => f.isin === 'NEWFUND123' && f.currentValueEur === 150) === true, 'executed fund subscription becomes a real fund position');
ok(subscribed.liquidityAfterEur === 450, 'fund subscription reduces unified liquidity');

const transferLine: any = { id: 'tr1', action: 'TRANSFER_FUND', status: 'PENDING', instrumentType: 'MUTUAL_FUND', sourceId: 'fund_source', sourceIsin: 'SRC123', sourceLabel: 'Origen', targetAssetId: 'FUND_DEST', targetIsin: 'DST456', targetName: 'Destino', category: 'GLOBAL_EQUITY', amountEur: 120, shares: null, estimatedPriceEur: null, estimatedFeeEur: null, instruction: '', rationale: '' };
const transferred = applyPortfolioExecutionLine(baseState, transferLine);
ok(transferred.liquidityAfterEur === transferred.liquidityBeforeEur, 'fund transfer changes holdings without fabricating cash');
ok(transferred.portfolio.funds?.some((f: any) => f.isin === 'DST456' && f.currentValueEur === 120) === true, 'fund transfer creates/increments the destination fund');

let reviewRejected = false;
try { applyPortfolioExecutionLine(baseState, { ...buyLine, id: 'review', action: 'REVIEW' }); } catch { reviewRejected = true; }
ok(reviewRejected, 'review-only line cannot be applied as an executed portfolio operation');

console.log(`Portfolio Execution Plan + state transactions: ${passed}/${passed} invariants passed.`);
