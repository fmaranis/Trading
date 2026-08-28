import assert from 'node:assert/strict';
import {
  BrokerAwareCausalReplayEngine,
  CausalUniverseBacktestEngine,
  DEFAULT_COST_AWARE_EXECUTION_POLICY,
  rebalanceCostAware,
  type AssetUniverseItem
} from '../src/investment/decision';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting';

let passed = 0;
function ok(condition: unknown, message: string) { assert.ok(condition, message); passed++; }

const positions = {
  A: { assetId: 'A', ticker: 'A.DE', shares: 4 },
  B: { assetId: 'B', ticker: 'B.DE', shares: 0 }
};
const first = rebalanceCostAware({
  positions,
  cashEur: 100,
  pricesEur: { A: 50, B: 40 },
  targetWeights: { A: 0.5, B: 0.5 },
  policy: { minimumDriftPctPoints: 5, maximumOrderFeeDragPct: 2, maximumRebalanceFeeDragPct: 2, minimumOrderNotionalEur: 50 }
});
ok(first.cashEur >= 0, 'cash never goes negative');
ok(first.orders.every(o => Number.isInteger(o.shares) && o.shares > 0), 'orders use whole shares');
ok(first.orders.every(o => o.commissionEur >= 1), 'broker minimum commission is applied');
ok(first.orders.every(o => o.feeDragPct <= 2 + 1e-9), 'executed orders respect maximum fee drag');
ok(first.rebalanceFeeDragPct <= 2 + 1e-9, 'rebalance respects fee budget');

const tiny = rebalanceCostAware({
  positions: { A: { assetId: 'A', ticker: 'A.DE', shares: 1 } },
  cashEur: 10,
  pricesEur: { A: 50 },
  targetWeights: { A: 0.95 },
  policy: { minimumDriftPctPoints: 5, maximumOrderFeeDragPct: 2, maximumRebalanceFeeDragPct: 2, minimumOrderNotionalEur: 50 }
});
ok(tiny.orders.length === 0, 'tiny rebalance does not force a trade');
ok(tiny.suppressed.length > 0, 'suppressed trade is observable');

const smallDrift = rebalanceCostAware({
  positions: { A: { assetId: 'A', ticker: 'A.DE', shares: 2 }, B: { assetId: 'B', ticker: 'B.DE', shares: 2 } },
  cashEur: 0,
  pricesEur: { A: 50, B: 50 },
  targetWeights: { A: 0.52, B: 0.48 },
  policy: { ...DEFAULT_COST_AWARE_EXECUTION_POLICY, minimumDriftPctPoints: 5 }
});
ok(smallDrift.orders.length === 0, 'small drift is suppressed by hysteresis threshold');
ok(smallDrift.suppressed.some(x => x.reason === 'DRIFT_BELOW_THRESHOLD'), 'drift suppression reason is explicit');

function dateAt(i: number): string {
  const d = new Date(Date.UTC(2019, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}
function series(start: number, drift: number, wobble: number, n = 760) {
  let p = start;
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + drift + Math.sin(i / 17) * wobble;
    return { timestamp: `${dateAt(i)}T00:00:00.000Z`, open: p * 0.999, high: p * 1.004, low: p * 0.996, close: p, volume: 1000 + i };
  });
}
const catalog: AssetUniverseItem[] = [
  { assetId: 'A', ticker: 'A.DE', name: 'A', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'B', ticker: 'B.DE', name: 'B', category: 'US_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'C', ticker: 'C.DE', name: 'C', category: 'EUROPE_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'D', ticker: 'D.DE', name: 'D', category: 'GOV_BONDS', currency: 'EUR', defensive: true, instrumentType: 'ETF_ETC' },
  { assetId: 'E', ticker: 'E.DE', name: 'E', category: 'MONEY_MARKET', currency: 'EUR', defensive: true, instrumentType: 'ETF_ETC' },
  { assetId: 'F', ticker: 'FUND', name: 'Fund', category: 'HEALTHCARE', currency: 'EUR', instrumentType: 'MUTUAL_FUND' }
];
const defs = [
  ['A', 100, 0.00055, 0.0016], ['B', 80, 0.00075, 0.0022], ['C', 65, 0.00035, 0.0014],
  ['D', 100, 0.00010, 0.00035], ['E', 140, 0.00004, 0.00010], ['F', 50, 0.00045, 0.0018]
] as const;
const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: defs.map(([id, start, drift, wobble], idx) => ({
    assetId: id, ticker: id === 'F' ? 'FUND' : `${id}.DE`, name: id, currency: 'EUR', bars: series(start, drift, wobble),
    provenance: { sourceType: 'REAL' as const, provider: 'test', symbol: id, isReproducible: false, datasetFingerprint: `fp_cost_${idx}` }
  }))
};
const researchConfig = { initialCapital: 1000, riskProfile: 'MEDIUM' as const, horizonYears: 3 as const, commissionPct: 0.05, slippagePct: 0.02, rebalanceFrequency: 'MONTHLY' as const };
const research = CausalUniverseBacktestEngine.run(dataset, catalog, researchConfig, 4);
const replay = BrokerAwareCausalReplayEngine.run({ universeDataset: dataset, catalog, researchResult: research, config: researchConfig });
ok(replay.rebalanceWindows === research.selectionHistory.length, 'replay uses exactly causal research decision windows');
ok(replay.executedOrders < research.totalTrades, 'cost-aware whole-share replay reduces order count versus fractional research backtest');
ok(replay.totalCommissionEur >= 0, 'replay commission is explicit');
ok(replay.residualCashEur >= 0, 'replay residual cash never goes negative');
ok(replay.notes.some(x => x.includes('fondos')), 'fund execution limitation is explicit');

console.log(`Cost-aware execution: ${passed}/${passed} no-trade/whole-share/replay invariants passed.`);
