import assert from 'node:assert/strict';
import { MixedInstrumentCausalReplayEngine } from '../src/investment/decision/mixedInstrumentCausalReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string { return new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10); }
function bars(start: number, drift: number, n = 340) {
  let price = start;
  return Array.from({ length: n }, (_, i) => {
    price *= 1 + drift + Math.sin(i / 19) * 0.0004;
    return { timestamp: `${dateAt(i)}T00:00:00.000Z`, open: price * 0.999, high: price * 1.003, low: price * 0.997, close: price, volume: 1000 + i };
  });
}

const catalog: AssetUniverseItem[] = [
  { assetId: 'ETF_A', ticker: 'ETFA.DE', name: 'ETF A', category: 'GLOBAL_EQUITY', currency: 'EUR', instrumentType: 'ETF_ETC' },
  { assetId: 'ETF_B', ticker: 'ETFB.DE', name: 'ETF B', category: 'GOV_BONDS', currency: 'EUR', instrumentType: 'ETF_ETC', defensive: true },
  { assetId: 'FUND_A', ticker: 'FUND-A', isin: 'IE000TESTFUND', name: 'Fund A', category: 'US_EQUITY', currency: 'EUR', instrumentType: 'MUTUAL_FUND', marketDataProvider: 'EODHD_FUND' }
];
const dataset: MultiAssetDataset = {
  timeframe: '1d', assets: [
    { assetId: 'ETF_A', ticker: 'ETFA.DE', name: 'ETF A', currency: 'EUR', bars: bars(80, 0.0006), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'ETFA.DE', isReproducible: false, datasetFingerprint: 'fp_etfa' } },
    { assetId: 'ETF_B', ticker: 'ETFB.DE', name: 'ETF B', currency: 'EUR', bars: bars(100, 0.00015), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'ETFB.DE', isReproducible: false, datasetFingerprint: 'fp_etfb' } },
    { assetId: 'FUND_A', ticker: 'FUND-A', name: 'Fund A', currency: 'EUR', bars: bars(25, 0.00045), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'IE000TESTFUND', isReproducible: false, datasetFingerprint: 'fp_fund' } }
  ]
};
const config = { initialCapital: 5000, commissionPct: 0.05, slippagePct: 0.02, riskProfile: 'MEDIUM' as const, horizonYears: 3 as const, rebalanceFrequency: 'MONTHLY' as const };
const research: any = { selectionHistory: [
  { informationEndDate: dateAt(299), executionDate: dateAt(300), selectedAssetIds: ['ETF_A', 'FUND_A'], selectedTickers: ['ETFA.DE', 'FUND-A'], scores: {}, regime: 'BULL_LOW_VOL', method: 'RISK_PARITY_ERC' },
  { informationEndDate: dateAt(319), executionDate: dateAt(320), selectedAssetIds: ['ETF_A', 'ETF_B'], selectedTickers: ['ETFA.DE', 'ETFB.DE'], scores: {}, regime: 'BULL_LOW_VOL', method: 'RISK_PARITY_ERC' }
] };

const result = MixedInstrumentCausalReplayEngine.run({ universeDataset: dataset, catalog, researchResult: research, config, cashBenchmarkAnnualPct: 2.5 });
assert.equal(result.rebalanceWindows, 2);
assert.ok(result.fundOperations > 0);
assert.ok(result.events[0].fundOperations.some(op => op.type === 'SUBSCRIBE'));
assert.ok(result.events[1].fundOperations.some(op => op.type === 'REDEEM' || op.type === 'TRANSFER_REVIEW'));
assert.ok(result.equityCurve.every(point => point.cash >= -1e-8));
assert.ok(result.totalEtfCommissionEur >= 0);
assert.ok(result.cashInterestEarnedEur > 0, 'idle cash must earn remunerated-cash interest');
assert.equal(result.cashBenchmarkAnnualPct, 2.5);
assert.ok(Number.isFinite(result.excessReturnVsCashPctPoints));

const cashOnly = MixedInstrumentCausalReplayEngine.run({ universeDataset: dataset, catalog, researchResult: { selectionHistory: [] } as any, config: { ...config, initialCapital: 100 }, cashBenchmarkAnnualPct: 2.5 });
assert.equal(cashOnly.etfOrders, 0);
assert.equal(cashOnly.fundOperations, 0);
assert.ok(Math.abs(cashOnly.finalEquityEur - cashOnly.allCashFinalEur) < 1e-8, 'no-trade replay must exactly track the remunerated all-cash benchmark');
assert.ok(Math.abs(cashOnly.totalReturnPct - cashOnly.allCashReturnPct) < 1e-8);
assert.ok(Math.abs(cashOnly.excessReturnVsCashPctPoints) < 1e-8);

const zeroRate = MixedInstrumentCausalReplayEngine.run({ universeDataset: dataset, catalog, researchResult: { selectionHistory: [] } as any, config: { ...config, initialCapital: 100 }, cashBenchmarkAnnualPct: 0 });
assert.equal(zeroRate.finalEquityEur, 100, '0% cash benchmark must preserve legacy no-trade cash result');
assert.equal(zeroRate.cashInterestEarnedEur, 0);

console.log('Mixed Instrument Causal Replay: 15/15 ETF/fund/remunerated-cash invariants passed.');
