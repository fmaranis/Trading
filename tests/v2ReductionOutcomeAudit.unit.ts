import assert from 'node:assert/strict';
import { buildV2ReductionOutcomeAudit } from '../src/investment/decision/v2ReductionOutcomeAudit';

function bars(prices: number[]) {
  return prices.map((close, index) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000
  }));
}

const prices = Array.from({ length: 90 }, (_, index) => {
  if (index <= 20) return 100 - index * 0.5; // 20 sessions later => 90
  if (index <= 60) return 90 + (index - 20) * 0.5; // 60 sessions later => 110
  return 110 + (index - 60) * 0.2;
});

const dataset: any = {
  timeframe: '1d',
  assets: [{
    assetId: 'TEST',
    ticker: 'TEST.DE',
    name: 'Test',
    currency: 'EUR',
    bars: bars(prices),
    provenance: { sourceType: 'REAL', provider: 'unit', symbol: 'TEST.DE', isReproducible: true }
  }]
};

const comparison: any = {
  trades: [
    {
      id: 'reduce-1',
      source: 'TREND_PROTECTION_V2',
      signalDate: '2025-01-01',
      executionDate: '2025-01-01',
      assetId: 'TEST',
      ticker: 'TEST.DE',
      action: 'REDUCE',
      unitsDelta: -2,
      notionalEur: 200,
      feeEur: 1,
      realizedGainEur: 20,
      realizedReturnPct: 10,
      estimatedTaxEur: 5,
      taxDeferredTransferEur: 0,
      executionPriceEur: 100,
      positionReturnPctAtSignal: 10,
      positionMfePctAtSignal: 20,
      givebackFromMfePctPointsAtSignal: 10,
      profitCaptureRatioPct: 50,
      reason: '[TREND_PROTECTION_V2:REDUCE] Protección de beneficio confirmada.'
    },
    {
      id: 'exit-ignored',
      source: 'TREND_PROTECTION_V2',
      signalDate: '2025-01-01',
      executionDate: '2025-01-01',
      assetId: 'TEST',
      ticker: 'TEST.DE',
      action: 'EXIT',
      unitsDelta: -1,
      notionalEur: 100,
      feeEur: 1,
      realizedGainEur: -10,
      realizedReturnPct: -10,
      estimatedTaxEur: 0,
      taxDeferredTransferEur: 0,
      executionPriceEur: 100,
      positionReturnPctAtSignal: -10,
      positionMfePctAtSignal: 0,
      givebackFromMfePctPointsAtSignal: 10,
      profitCaptureRatioPct: null,
      reason: '[TREND_PROTECTION_V2:EXIT] Tesis fallida.'
    }
  ]
};

const audit = buildV2ReductionOutcomeAudit({ dataset, v2Comparison: comparison });
assert.equal(audit.policy, 'V2_REDUCTION_OUTCOME_AUDIT_V1');
assert.equal(audit.methodology, 'EX_POST_DIAGNOSTIC_ONLY_NEVER_DECISION_INPUT');
assert.equal(audit.valid, true);
assert.equal(audit.reductions, 1, 'only REDUCE trades are audited');
assert.equal(audit.rows[0].cause, 'WINNER_PROTECTION');
assert.ok(Math.abs((audit.rows[0].forward20SessionsReturnPct ?? 0) - (-10)) < 1e-9);
assert.ok(Math.abs((audit.rows[0].forward60SessionsReturnPct ?? 0) - 10) < 1e-9);
assert.ok((audit.rows[0].maxAdverse20SessionsPct ?? 0) <= -10 + 1e-9);
assert.ok((audit.rows[0].maxFavorable60SessionsPct ?? 0) >= 10 - 1e-9);
assert.equal(audit.rows[0].realizedFrictionEur, 6);
assert.ok(Math.abs((audit.rows[0].markToMarketProtectionProxy20Eur ?? 0) - 14) < 1e-9, 'sale helps by 20 EUR avoided decline minus 6 EUR friction');
assert.ok(Math.abs((audit.rows[0].markToMarketProtectionProxy60Eur ?? 0) - (-26)) < 1e-9, 'sale hurts by 20 EUR missed recovery plus 6 EUR friction');
assert.equal(audit.aggregate.winnerProtectionReductions, 1);
assert.equal(audit.aggregate.loserFailureReductions, 0);
assert.equal(audit.aggregate.totalReducedNotionalEur, 200);
assert.equal(audit.aggregate.totalRealizedFrictionEur, 6);

console.log('V2_REDUCTION_OUTCOME_AUDIT_RESULT', JSON.stringify({
  valid: audit.valid,
  reductions: audit.reductions,
  forward20: audit.rows[0].forward20SessionsReturnPct,
  forward60: audit.rows[0].forward60SessionsReturnPct,
  proxy20: audit.rows[0].markToMarketProtectionProxy20Eur,
  proxy60: audit.rows[0].markToMarketProtectionProxy60Eur
}));
