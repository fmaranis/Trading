import { OpportunityOutcomeBacktestEngine } from '../src/investment/decision';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting';
import type { AssetUniverseItem } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

const start = Date.UTC(2024, 0, 1);
const dates = Array.from({ length: 360 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
function bars(base: number, dailyGrowth: number) {
  return dates.map((timestamp, i) => {
    const close = base * Math.exp(dailyGrowth * i);
    return { timestamp, open: close * 0.999, high: close * 1.002, low: close * 0.998, close };
  });
}
function asset(assetId: string, ticker: string, growth: number) {
  return {
    assetId, ticker, name: ticker, currency: 'EUR', bars: bars(100, growth),
    provenance: { sourceType: 'REAL' as const, provider: 'TEST', isReproducible: true, datasetFingerprint: `fp_${assetId}` }
  };
}
const dataset: MultiAssetDataset = {
  timeframe: '1d',
  assets: [asset('A','AAA.DE',0.0020), asset('B','BBB.DE',0.0010), asset('C','CCC.DE',0.0005), asset('D','DDD.DE',0.0001)]
};
const catalog: AssetUniverseItem[] = [
  { assetId: 'A', ticker: 'AAA.DE', name: 'A', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'B', ticker: 'BBB.DE', name: 'B', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'C', ticker: 'CCC.DE', name: 'C', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'D', ticker: 'DDD.DE', name: 'D', category: 'MONEY_MARKET', currency: 'EUR', defensive: true }
];

const result = OpportunityOutcomeBacktestEngine.run(dataset, catalog, 4);
check('301 scope is explicitly causal', result.scope === 'CAUSAL_OPPORTUNITY_SIGNALS_WITHIN_CURRENTLY_VALIDATED_UNIVERSE');
check('302 monthly observation windows are generated', result.observationWindows > 0);
check('303 qualifying opportunity events are generated', result.eventCount > 0);
check('304 metrics cover 5 20 and 60 sessions', result.metrics.map(m => m.horizonSessions).join(',') === '5,20,60');
check('305 every event was top three at information date', result.events.every(e => e.rank >= 1 && e.rank <= 3));
check('306 every event satisfied score threshold', result.events.every(e => e.score >= 2));
check('307 every event had positive 120d momentum', result.events.every(e => e.momentum120Pct > 0));
check('308 every event stayed below volatility gate', result.events.every(e => e.annualizedVolatilityPct <= 30));
check('309 longer horizons cannot have more evaluated events', (result.metrics.find(m=>m.horizonSessions===60)?.evaluated ?? 0) <= (result.metrics.find(m=>m.horizonSessions===5)?.evaluated ?? 0));
const invalid: MultiAssetDataset = { ...dataset, assets: dataset.assets.map((a,i) => i === 0 ? { ...a, provenance: { ...a.provenance, sourceType: 'SYNTHETIC' as const } } : a) };
let rejectedSynthetic = false;
try { OpportunityOutcomeBacktestEngine.run(invalid, catalog, 4); } catch { rejectedSynthetic = true; }
check('310 synthetic data is rejected', rejectedSynthetic);

console.log(`Opportunity outcome backtest: ${passed}/10 invariants passed.`);
