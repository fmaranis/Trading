import { strict as assert } from 'node:assert';
import {
  applyPortfolioExecutionLine,
  buildExecutedPurchaseLine,
  preferredBrokerSearchCode,
  resolveSecurityIsin
} from '../src/investment/decision';

let passed = 0;
function test(name: string, fn: () => void) {
  fn(); passed += 1; console.log(`✓ ${name}`);
}

const buyLine: any = {
  id: 'buy_asml',
  action: 'BUY_ETF',
  status: 'PENDING',
  instrumentType: 'ETF_ETC',
  targetAssetId: 'EQ_ASML',
  targetTicker: 'ASML.AS',
  targetName: 'ASML Holding',
  category: 'SEMICONDUCTORS',
  amountEur: 1500,
  shares: 2,
  estimatedPriceEur: 750,
  estimatedFeeEur: 2,
  instruction: 'Comprar ASML',
  rationale: 'Test'
};

const fundLine: any = {
  id: 'fund_global',
  action: 'SUBSCRIBE_FUND',
  status: 'PENDING',
  instrumentType: 'MUTUAL_FUND',
  targetAssetId: 'FUND_VANGUARD_GLOBAL',
  targetTicker: 'IE00B03HD191',
  targetName: 'Vanguard Global Stock Index Fund EUR Acc',
  targetIsin: 'IE00B03HD191',
  category: 'GLOBAL_EQUITY',
  amountEur: 1000,
  shares: null,
  estimatedPriceEur: null,
  estimatedFeeEur: 0,
  instruction: 'Suscribir fondo',
  rationale: 'Test'
};

const portfolio: any = {
  cashEur: 0,
  holdings: [],
  funds: [],
  stagedCapitalPlan: { availableEur: 5000, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00.000Z'
};

test('951 known production equity resolves to operational ISIN', () => {
  assert.equal(resolveSecurityIsin('ASML.AS'), 'NL0010273215');
  assert.equal(preferredBrokerSearchCode('ASML.AS'), 'NL0010273215');
});

test('952 explicit mutual-fund ISIN remains the preferred broker search code', () => {
  assert.equal(resolveSecurityIsin('IE00B03HD191', 'IE00B03HD191'), 'IE00B03HD191');
  assert.equal(preferredBrokerSearchCode('IE00B03HD191', 'IE00B03HD191'), 'IE00B03HD191');
});

test('953 listed purchase can replace suggested amount shares and fee with real execution', () => {
  const actual = buildExecutedPurchaseLine(buyLine, { amountEur: 1488.4, shares: 2, feeEur: 1.75 });
  assert.equal(actual.targetIsin, 'NL0010273215');
  assert.equal(actual.amountEur, 1488.4);
  assert.equal(actual.shares, 2);
  assert.equal(actual.estimatedFeeEur, 1.75);
});

test('954 actual listed purchase mutates holdings and finite liquidity consistently', () => {
  const actual = buildExecutedPurchaseLine(buyLine, { amountEur: 1488.4, shares: 2, feeEur: 1.75 });
  const receipt = applyPortfolioExecutionLine(portfolio, actual);
  assert.equal(receipt.portfolio.holdings[0]?.ticker, 'ASML.AS');
  assert.equal(receipt.portfolio.holdings[0]?.shares, 2);
  assert.ok(Math.abs(receipt.liquidityAfterEur - (5000 - 1488.4 - 1.75)) < 1e-9);
});

test('955 fund subscription can replace suggested amount with the actual executed amount', () => {
  const actual = buildExecutedPurchaseLine(fundLine, { amountEur: 873.22 });
  const receipt = applyPortfolioExecutionLine(portfolio, actual);
  assert.equal(actual.targetIsin, 'IE00B03HD191');
  assert.equal(receipt.portfolio.funds[0]?.isin, 'IE00B03HD191');
  assert.equal(receipt.portfolio.funds[0]?.investedEur, 873.22);
  assert.ok(Math.abs(receipt.liquidityAfterEur - (5000 - 873.22)) < 1e-9);
});

test('956 invalid real execution amount is rejected', () => {
  assert.throws(() => buildExecutedPurchaseLine(fundLine, { amountEur: 0 }));
});

test('957 listed purchase requires real executed shares', () => {
  assert.throws(() => buildExecutedPurchaseLine(buyLine, { amountEur: 1000, shares: 0, feeEur: 0 }));
});

console.log(`Executed purchase registration: ${passed}/7 ISIN/real-execution invariants passed.`);
