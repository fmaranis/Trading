import type { UserHolding } from './userPortfolio';

export interface SpanishTaxSettings {
  priorSavingsTaxableBaseEur: number;
  contextConfirmed: boolean;
}

export interface SpanishTaxEstimate {
  realizedGainEur: number;
  estimatedTaxEur: number;
  effectiveRatePct: number;
  method: 'CONFIGURED_PROGRESSIVE' | 'CONSERVATIVE_MAX_RATE' | 'NO_GAIN' | 'TAX_DEFERRED_TRANSFER' | 'UNKNOWN_COST_BASIS';
  note: string;
}

export interface TaxAwareRotationAssessment {
  tax: SpanishTaxEstimate;
  transactionFeeEur: number;
  sourceAnnualProxyPct: number | null;
  destinationAnnualProxyPct: number | null;
  expectedAdvantagePctPoints: number | null;
  expectedAdvantageEurOverHorizon: number | null;
  immediateFrictionEur: number;
  passesEconomicGate: boolean | null;
  breakEvenYears: number | null;
  reason: string;
}

export const SPANISH_SAVINGS_TAX_SCALE = [
  { upToEur: 6_000, rate: 0.19 },
  { upToEur: 50_000, rate: 0.21 },
  { upToEur: 200_000, rate: 0.23 },
  { upToEur: 300_000, rate: 0.27 },
  { upToEur: Infinity, rate: 0.30 }
] as const;

export const SPANISH_TAX_SETTINGS_UPDATED_EVENT = 'custodia:spanish-tax-settings-updated';
const STORAGE_KEY = 'custodia_spanish_tax_settings_v1';
const DEFAULT_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };

export function taxOnSpanishSavingsBase(baseEur: number): number {
  let remaining = Math.max(0, baseEur);
  let lower = 0;
  let tax = 0;
  for (const bracket of SPANISH_SAVINGS_TAX_SCALE) {
    if (remaining <= 0) break;
    const width = bracket.upToEur === Infinity ? remaining : Math.max(0, bracket.upToEur - lower);
    const taxable = Math.min(remaining, width);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    lower = bracket.upToEur;
  }
  return tax;
}

export function estimateSpanishTaxOnRealizedGain(realizedGainEur: number, settings: SpanishTaxSettings, taxDeferredTransfer = false): SpanishTaxEstimate {
  const gain = Math.max(0, Number(realizedGainEur) || 0);
  if (taxDeferredTransfer) return {
    realizedGainEur: gain,
    estimatedTaxEur: 0,
    effectiveRatePct: 0,
    method: 'TAX_DEFERRED_TRANSFER',
    note: 'Traspaso tratado como fiscalmente diferido: no se realiza la plusvalía en este momento.'
  };
  if (gain <= 1e-9) return {
    realizedGainEur: 0,
    estimatedTaxEur: 0,
    effectiveRatePct: 0,
    method: 'NO_GAIN',
    note: 'No hay plusvalía positiva estimada sobre la que reservar impuesto.'
  };
  if (!settings.contextConfirmed) {
    const tax = gain * 0.30;
    return {
      realizedGainEur: gain,
      estimatedTaxEur: tax,
      effectiveRatePct: 30,
      method: 'CONSERVATIVE_MAX_RATE',
      note: 'Contexto fiscal anual no configurado: se usa el 30% como reserva conservadora máxima de la escala del ahorro.'
    };
  }
  const prior = Math.max(0, settings.priorSavingsTaxableBaseEur || 0);
  const tax = Math.max(0, taxOnSpanishSavingsBase(prior + gain) - taxOnSpanishSavingsBase(prior));
  return {
    realizedGainEur: gain,
    estimatedTaxEur: tax,
    effectiveRatePct: gain > 0 ? tax / gain * 100 : 0,
    method: 'CONFIGURED_PROGRESSIVE',
    note: `Estimación incremental aplicando la escala del ahorro sobre una base previa configurada de ${prior.toFixed(2)} €.`
  };
}

export function fifoCostBasisForSale(holding: UserHolding, sharesToSell: number): { costBasisEur: number | null; precision: 'FIFO_TRACKED' | 'UNKNOWN' } {
  const shares = Math.max(0, sharesToSell);
  if (shares <= 0) return { costBasisEur: 0, precision: 'FIFO_TRACKED' };
  const lots = [...(holding.lots ?? [])].filter(l => l.shares > 0 && l.acquisitionCostEur >= 0).sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
  const trackedShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
  const untrackedShares = Math.max(0, holding.shares - trackedShares);
  if (untrackedShares > 1e-8) return { costBasisEur: null, precision: 'UNKNOWN' };
  if (trackedShares + 1e-8 < shares) return { costBasisEur: null, precision: 'UNKNOWN' };

  let remaining = shares;
  let cost = 0;
  for (const lot of lots) {
    if (remaining <= 1e-9) break;
    const used = Math.min(remaining, lot.shares);
    cost += lot.acquisitionCostEur * (used / lot.shares);
    remaining -= used;
  }
  return remaining <= 1e-8 ? { costBasisEur: cost, precision: 'FIFO_TRACKED' } : { costBasisEur: null, precision: 'UNKNOWN' };
}

export function estimateFundRealizedGain(currentValueEur: number | null, investedEur: number, redemptionAmountEur: number): number | null {
  if (currentValueEur == null || !Number.isFinite(currentValueEur) || currentValueEur <= 0) return null;
  const amount = Math.max(0, Math.min(currentValueEur, redemptionAmountEur));
  const costPortion = Math.max(0, investedEur) * (amount / currentValueEur);
  return amount - costPortion;
}

export function assessTaxAwareRotation(input: {
  realizedGainEur: number | null;
  notionalEur: number;
  feeEur?: number | null;
  sourceAnnualProxyPct?: number | null;
  destinationAnnualProxyPct?: number | null;
  horizonYears?: number;
  settings: SpanishTaxSettings;
  taxDeferredTransfer?: boolean;
}): TaxAwareRotationAssessment {
  const fee = Math.max(0, Number(input.feeEur ?? 0));
  const notional = Math.max(0, input.notionalEur);
  const horizon = Math.max(0.25, Number(input.horizonYears) || 1);
  const unknownBasis = input.realizedGainEur == null && !input.taxDeferredTransfer;
  const tax = unknownBasis ? {
    realizedGainEur: 0,
    estimatedTaxEur: 0,
    effectiveRatePct: 0,
    method: 'UNKNOWN_COST_BASIS' as const,
    note: 'No hay coste de adquisición suficiente para estimar la plusvalía. La rotación no debe aprobarse por ventaja económica hasta completar ese dato.'
  } : estimateSpanishTaxOnRealizedGain(input.realizedGainEur ?? 0, input.settings, Boolean(input.taxDeferredTransfer));
  const source = input.sourceAnnualProxyPct == null ? null : Number(input.sourceAnnualProxyPct);
  const destination = input.destinationAnnualProxyPct == null ? null : Number(input.destinationAnnualProxyPct);
  const advantage = source == null || destination == null ? null : destination - source;
  const expectedAdvantageEur = advantage == null ? null : notional * advantage / 100 * horizon;
  const friction = tax.estimatedTaxEur + fee;
  const passes = unknownBasis ? null : expectedAdvantageEur == null ? null : expectedAdvantageEur > friction + 1e-6;
  const breakEvenYears = advantage != null && advantage > 0 && notional > 0 ? friction / (notional * advantage / 100) : null;
  const reason = input.taxDeferredTransfer
    ? 'El traspaso difiere la tributación; el gate económico no soporta coste fiscal inmediato.'
    : unknownBasis
      ? 'Coste fiscal no estimable por falta de base de adquisición/FIFO.'
      : advantage == null
        ? `Coste fiscal/comisiones estimado ${friction.toFixed(2)} €, pero falta una ventaja anual comparable para aprobar la rotación.`
        : passes
          ? `Ventaja estimada a ${horizon.toFixed(1)} años (${expectedAdvantageEur!.toFixed(2)} €) supera fricción fiscal+costes (${friction.toFixed(2)} €).`
          : `La ventaja estimada a ${horizon.toFixed(1)} años (${expectedAdvantageEur!.toFixed(2)} €) no compensa fricción fiscal+costes (${friction.toFixed(2)} €).`;

  return {
    tax,
    transactionFeeEur: fee,
    sourceAnnualProxyPct: source,
    destinationAnnualProxyPct: destination,
    expectedAdvantagePctPoints: advantage,
    expectedAdvantageEurOverHorizon: expectedAdvantageEur,
    immediateFrictionEur: friction,
    passesEconomicGate: passes,
    breakEvenYears,
    reason
  };
}

export class SpanishTaxSettingsService {
  static load(): SpanishTaxSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
      return {
        priorSavingsTaxableBaseEur: Math.max(0, Number(parsed.priorSavingsTaxableBaseEur) || 0),
        contextConfirmed: Boolean(parsed.contextConfirmed)
      };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  static save(settings: SpanishTaxSettings): SpanishTaxSettings {
    const normalized: SpanishTaxSettings = {
      priorSavingsTaxableBaseEur: Math.max(0, Number(settings.priorSavingsTaxableBaseEur) || 0),
      contextConfirmed: Boolean(settings.contextConfirmed)
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(SPANISH_TAX_SETTINGS_UPDATED_EVENT));
    }
    return normalized;
  }

  static reset(): SpanishTaxSettings {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(SPANISH_TAX_SETTINGS_UPDATED_EVENT));
    }
    return { ...DEFAULT_SETTINGS };
  }
}
