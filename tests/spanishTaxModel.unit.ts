import {
  assessTaxAwareRotation,
  estimateFundRealizedGain,
  estimateSpanishTaxOnRealizedGain,
  taxOnSpanishSavingsBase
} from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++; console.log(`✓ ${name}`);
}

check('911 first 6000 EUR of savings base taxes at 19 percent', Math.abs(taxOnSpanishSavingsBase(6000) - 1140) < 1e-9);
check('912 first 50000 EUR produces 10380 EUR tax', Math.abs(taxOnSpanishSavingsBase(50000) - 10380) < 1e-9);
check('913 400000 EUR includes the 30 percent top bracket', Math.abs(taxOnSpanishSavingsBase(400000) - 101880) < 1e-9);

const conservative = estimateSpanishTaxOnRealizedGain(1000, { priorSavingsTaxableBaseEur: 0, contextConfirmed: false });
check('914 unconfigured annual context reserves conservative 30 percent', conservative.method === 'CONSERVATIVE_MAX_RATE' && conservative.estimatedTaxEur === 300);

const configured = estimateSpanishTaxOnRealizedGain(3000, { priorSavingsTaxableBaseEur: 5000, contextConfirmed: true });
check('915 configured progressive estimate crosses 19 to 21 percent bracket correctly', Math.abs(configured.estimatedTaxEur - 610) < 1e-9);

const deferred = estimateSpanishTaxOnRealizedGain(5000, { priorSavingsTaxableBaseEur: 0, contextConfirmed: false }, true);
check('916 eligible transfer has zero immediate tax estimate', deferred.method === 'TAX_DEFERRED_TRANSFER' && deferred.estimatedTaxEur === 0);

const fundGain = estimateFundRealizedGain(12000, 10000, 6000);
check('917 partial fund redemption estimates proportional realized gain', Math.abs((fundGain ?? 0) - 1000) < 1e-9);

const blocked = assessTaxAwareRotation({ realizedGainEur: 1000, notionalEur: 6000, feeEur: 5, sourceAnnualProxyPct: 4, destinationAnnualProxyPct: 5, horizonYears: 1, settings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false } });
check('918 small expected improvement does not beat tax plus fees', blocked.passesEconomicGate === false);

const justified = assessTaxAwareRotation({ realizedGainEur: 200, notionalEur: 6000, feeEur: 5, sourceAnnualProxyPct: -10, destinationAnnualProxyPct: 8, horizonYears: 1, settings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false } });
check('919 large expected improvement can beat tax plus fees', justified.passesEconomicGate === true);

const unknown = assessTaxAwareRotation({ realizedGainEur: null, notionalEur: 6000, feeEur: 5, sourceAnnualProxyPct: 4, destinationAnnualProxyPct: 10, horizonYears: 1, settings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false } });
check('920 missing cost basis never fabricates tax precision', unknown.tax.method === 'UNKNOWN_COST_BASIS' && unknown.passesEconomicGate === null);

console.log(`Spanish tax model: ${passed}/10 invariants passed.`);
