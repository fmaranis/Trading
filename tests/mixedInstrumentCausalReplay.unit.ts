import assert from 'node:assert/strict';
import { MixedInstrumentCausalReplayEngine } from '../src/investment/decision/mixedInstrumentCausalReplay';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';

function dateAt(i: number): string {
  return new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
}

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
  timeframe: '1d',
  assets: [
    { assetId: 'ETF_A', ticker: 'ETFA.DE', name: 'ETF A', currency: 'EUR', bars: bars(80, 0.0006), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'ETFA.DE', isReproducible: false, datasetFingerprint: 'fp_etfa' } },
    { assetId: 'ETF_B', ticker: 'ETFB.DE', name: 'ETF B', currency: 'EUR', bars: bars(100, 0.00015), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'ETFB.DE', isReproducible: false, datasetFingerprint: 'fp_etfb' } },
    { assetId: 'FUND_A', ticker: 'FUND-A', name: 'Fund A', currency: 'EUR', bars: bars(25, 0.00045), provenance: { sourceType: 'REAL', provider: 'test', symbol: 'IE000TESTFUND', isReproducible: false, datasetFingerprint: 'fp_fund' } }
  ]
};

const research: any = {
  selectionHistory: [
    {
      informationEndDate: dateAt(299), executionDate: dateAt(300),
      selectedAssetIds: ['ETF_A', 'FUND_A'], selectedTickers: ['ETFA.DE', 'FUND-A'], scores: {}, regime: 'BULL_LOW_VOL', method: 'RISK_PARITY_ERC'
    },
    {
      informationEndDate: dateAt(319), executionDate: dateAt(320),
      selectedAssetIds: ['ETF_A', 'ETF_B'], selectedTickers: ['ETFA.DE', 'ETFB.DE'], scores: {}, regime: 'BULL_LOW_VOL', method: 'RISK_PARITY_ERC'
    }
  ]
};

const result = MixedInstrumentCausalReplayEngine.run({
  universeDataset: dataset,
  catalog,
  researchResult: research,
  config: { initialCapital: 5000, commissionPct: 0.05, slippagePct: 0.02, riskProfile: 'MEDIUM', horizonYears: 3, rebalanceFrequency: 'MONTHLY' }
});

assert.equal(result.rebalanceWindows, 2, 'replay must use both causal windows');
assert.ok(result.fundOperations > 0, 'a selected mutual fund must generate at least one fund operation');
assert.ok(result.events[0].fundOperations.some(op => op.type === 'SUBSCRIBE'), 'first mixed allocation must subscribe the selected fund');
assert.ok(result.events[1].fundOperations.some(op => op.type === 'REDEEM' || op.type === 'TRANSFER_REVIEW'), 'removing the fund from target must release/review its position');
assert.ok(result.equityCurve.every(point => point.cash >= -1e-8), 'mixed replay must never produce negative cash');
assert.ok(result.totalEtfCommissionEur >= 0, 'ETF commissions must remain explicit');
assert.ok(result.notes.some(note => note.includes('Fondos')), 'fund semantics must remain documented in replay notes');

console.log('Mixed Instrument Causal Replay: 7/7 ETF/fund lifecycle/accounting invariants passed.');
