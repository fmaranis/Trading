import assert from 'node:assert/strict';
import { InvestmentDecisionEngine } from '../src/investment/decision';
import { MultiAssetDataset } from '../src/investment/portfolioBacktesting';

function dateAt(i: number): string {
  const d = new Date(Date.UTC(2024, 0, 1 + i));
  return d.toISOString().slice(0, 10);
}

function series(start: number, drift: number, wobble: number, n = 320) {
  let p = start;
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + drift + Math.sin(i / 9) * wobble;
    return { timestamp: `${dateAt(i)}T00:00:00.000Z`, open: p * 0.999, high: p * 1.003, low: p * 0.997, close: p, volume: 1000 + i };
  });
}

function dataset(sourceType: 'REAL' | 'SYNTHETIC' = 'REAL', currency = 'EUR'): MultiAssetDataset {
  const defs = [
    ['VWCE', 'VWCE.DE', 100, 0.0007, 0.0020],
    ['EQQQ', 'EQQQ.DE', 80, 0.0010, 0.0035],
    ['4GLD', '4GLD.DE', 50, 0.0003, 0.0015],
    ['VAGF', 'VAGF.DE', 25, 0.00015, 0.0008],
    ['XEON', 'XEON.DE', 140, 0.00008, 0.0002]
  ] as const;
  return {
    timeframe: '1d',
    assets: defs.map(([assetId, ticker, start, drift, wobble], index) => ({
      assetId,
      ticker,
      name: ticker,
      currency,
      bars: series(start, drift, wobble),
      provenance: sourceType === 'REAL'
        ? { sourceType: 'REAL', provider: 'test', symbol: ticker, isReproducible: false, datasetFingerprint: `fp_${index}` }
        : { sourceType: 'SYNTHETIC', isReproducible: true, seed: index }
    }))
  };
}

const current = new Date(`${dateAt(321)}T12:00:00.000Z`);

const medium = InvestmentDecisionEngine.decide(dataset(), { capitalEur: 100, riskProfile: 'MEDIUM', horizonYears: 3 }, current);
assert.equal(medium.recommendedMethod, 'RISK_PARITY_ERC');
assert.equal(medium.evidence, 'REAL_ONLY');
assert.ok(Math.abs(medium.assets.reduce((s, a) => s + a.amountEur, 0) + medium.cashAmountEur - 100) < 0.02);
assert.ok(medium.cashWeight >= 0.12);
assert.equal(medium.confidence, 'HIGH');
assert.ok(medium.confidenceScore >= 80);
assert.equal(medium.dataQualityDiagnostics?.minimumAssetBars, 320);
assert.equal(medium.dataQualityDiagnostics?.commonCoveragePct, 100);

const low = InvestmentDecisionEngine.decide(dataset(), { capitalEur: 1000, riskProfile: 'LOW', horizonYears: 5 }, current);
assert.equal(low.recommendedMethod, 'INVERSE_VOLATILITY');
assert.ok(low.cashWeight >= 0.25);
assert.ok(low.assets.find(a => a.assetId === 'EQQQ')!.weight <= 0.1200001);

const high = InvestmentDecisionEngine.decide(dataset(), { capitalEur: 250, riskProfile: 'HIGH', horizonYears: 1 }, current);
assert.equal(high.recommendedMethod, 'RELATIVE_MOMENTUM');
assert.ok(high.warnings.some(x => x.includes('Horizonte de 1 año')));
assert.ok(high.assets.every(a => a.amountEur >= 0));

const stale = InvestmentDecisionEngine.decide(dataset(), { capitalEur: 100, riskProfile: 'MEDIUM', horizonYears: 3 }, new Date('2026-01-01T00:00:00Z'));
assert.equal(stale.confidence, 'LOW');
assert.ok(stale.dataQualityDiagnostics && stale.dataQualityDiagnostics.marketSessionAge > 10);
assert.ok(stale.warnings.some(x => x.includes('sesiones hábiles')));

assert.throws(() => InvestmentDecisionEngine.decide(dataset('SYNTHETIC'), { capitalEur: 100, riskProfile: 'MEDIUM', horizonYears: 3 }, current));
assert.throws(() => InvestmentDecisionEngine.decide(dataset('REAL', 'USD'), { capitalEur: 100, riskProfile: 'MEDIUM', horizonYears: 3 }, current));
assert.throws(() => InvestmentDecisionEngine.decide(dataset(), { capitalEur: 0, riskProfile: 'MEDIUM', horizonYears: 3 }, current));

console.log('Investment Decision: 11/11 invariants passed.');
