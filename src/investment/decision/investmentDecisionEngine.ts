import { MultiAssetDataAligner, MultiAssetDataset, buildPortfolioProvenance } from '../portfolioBacktesting';
import { DeterministicPortfolioAllocator, RealPortfolioAnalytics } from '../portfolioAnalytics';
import { DeterministicRegimeClassifier, MarketRegime } from '../portfolioRegimes';
import {
  AssetDecisionScore,
  DecisionConfidence,
  InvestmentDecisionRequest,
  InvestmentDecisionResult,
  InvestorRiskProfile
} from './types';

const DAY_MS = 86_400_000;

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

function normalizeWeights(weights: Record<string, number>, investable: number, caps: Record<string, number>): Record<string, number> {
  const ids = Object.keys(weights);
  let out = Object.fromEntries(ids.map(id => [id, Math.max(0, weights[id] ?? 0)]));
  for (let iteration = 0; iteration < 20; iteration++) {
    const total = Object.values(out).reduce((a, b) => a + b, 0);
    if (total <= 0) return Object.fromEntries(ids.map(id => [id, 0]));
    out = Object.fromEntries(ids.map(id => [id, out[id] / total * investable]));
    let excess = 0;
    const free: string[] = [];
    for (const id of ids) {
      const cap = caps[id] ?? investable;
      if (out[id] > cap) {
        excess += out[id] - cap;
        out[id] = cap;
      } else if (out[id] < cap - 1e-12) free.push(id);
    }
    if (excess <= 1e-12 || !free.length) break;
    const freeTotal = free.reduce((s, id) => s + out[id], 0);
    if (freeTotal <= 0) {
      const add = excess / free.length;
      for (const id of free) out[id] += add;
    } else {
      for (const id of free) out[id] += excess * (out[id] / freeTotal);
    }
  }
  return out;
}

function regimeCashOverlay(regime: MarketRegime): number {
  switch (regime) {
    case 'BEAR_HIGH_VOL': return 0.35;
    case 'BEAR_LOW_VOL': return 0.25;
    case 'SIDEWAYS_HIGH_VOL': return 0.20;
    case 'BULL_HIGH_VOL': return 0.12;
    case 'SIDEWAYS_LOW_VOL': return 0.08;
    case 'BULL_LOW_VOL': return 0.03;
    default: return 0.30;
  }
}

function profileBaseCash(profile: InvestorRiskProfile): number {
  if (profile === 'LOW') return 0.25;
  if (profile === 'MEDIUM') return 0.12;
  return 0.05;
}

function profileCaps(profile: InvestorRiskProfile, ids: string[]): Record<string, number> {
  const defaultCap = profile === 'LOW' ? 0.30 : profile === 'MEDIUM' ? 0.40 : 0.55;
  const caps = Object.fromEntries(ids.map(id => [id, defaultCap]));
  if ('EQQQ' in caps) caps.EQQQ = profile === 'LOW' ? 0.12 : profile === 'MEDIUM' ? 0.25 : 0.45;
  if ('VWCE' in caps) caps.VWCE = profile === 'LOW' ? 0.28 : profile === 'MEDIUM' ? 0.38 : 0.50;
  if ('XEON' in caps) caps.XEON = 0.45;
  return caps;
}

function confidenceFrom(dataAgeDays: number, bars: number, regime: MarketRegime): { score: number; label: DecisionConfidence } {
  // Base evidence/data confidence only: never interpreted as probability of profit.
  // The engine scores the primary REAL series for each instrument. Runtime cross-provider
  // validation is a separate evidence layer so external API availability cannot silently
  // alter portfolio weights or make deterministic tests network-dependent.
  let score = 85;
  if (dataAgeDays > 14) score -= 60;
  else if (dataAgeDays > 4) score -= 35;
  else if (dataAgeDays > 2) score -= 12;
  if (bars < 250) score -= 25;
  else if (bars < 500) score -= 10;
  if (regime === 'UNKNOWN') score -= 30;
  score = clamp(score, 0, 85);
  return { score, label: score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW' };
}

function assetRationale(assetId: string, momentum: number | null, vol: number | null, weight: number, regime: MarketRegime): string[] {
  const notes: string[] = [];
  if (momentum != null) notes.push(momentum > 5 ? `Momentum positivo (${momentum.toFixed(1)}%).` : momentum < -5 ? `Momentum negativo (${momentum.toFixed(1)}%).` : `Momentum neutral (${momentum.toFixed(1)}%).`);
  if (vol != null) notes.push(`Volatilidad anualizada ${vol.toFixed(1)}%.`);
  if (assetId === 'XEON') notes.push('Componente monetario EUR para reducir oscilación sin asumir FX.');
  if (assetId === 'VAGF') notes.push('Componente defensivo de renta fija global cubierta a EUR.');
  if (assetId === '4GLD') notes.push('Diversificador frente a renta variable y shocks de mercado.');
  if (assetId === 'EQQQ' && regime.includes('BEAR')) notes.push('Exposición growth limitada por régimen bajista.');
  if (weight === 0) notes.push('No recibe asignación con las reglas actuales.');
  return notes;
}

export class InvestmentDecisionEngine {
  static decide(dataset: MultiAssetDataset, request: InvestmentDecisionRequest, now = new Date()): InvestmentDecisionResult {
    if (!(request.capitalEur > 0)) throw new Error('El capital debe ser mayor que cero.');
    const provenance = buildPortfolioProvenance(dataset);
    if (provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('La decisión actual exige exclusivamente datos REAL.');
    const currencies = new Set(dataset.assets.map(a => a.currency).filter(Boolean));
    if (currencies.size !== 1 || !currencies.has('EUR')) throw new Error('La decisión actual exige instrumentos denominados en EUR.');

    const aligned = MultiAssetDataAligner.align(dataset, 'INTERSECTION');
    const analytics = RealPortfolioAnalytics.calculate(aligned, 60);
    const regimeSeries = DeterministicRegimeClassifier.classify(aligned);
    const currentRegime = [...regimeSeries.observations].reverse().find(x => x.regime !== 'UNKNOWN') ?? regimeSeries.observations[regimeSeries.observations.length - 1];
    const lastDate = aligned.rows[aligned.rows.length - 1].tradingDate;
    const dataAgeDays = Math.max(0, Math.floor((now.getTime() - Date.parse(`${lastDate}T00:00:00Z`)) / DAY_MS));

    const method = request.riskProfile === 'LOW'
      ? 'INVERSE_VOLATILITY'
      : request.riskProfile === 'MEDIUM'
        ? 'RISK_PARITY_ERC'
        : 'RELATIVE_MOMENTUM';
    const allocationLookback = request.horizonYears === 1 ? 60 : request.horizonYears === 3 ? 120 : 180;

    const raw = DeterministicPortfolioAllocator.allocate(aligned, {
      method,
      lookbackBars: allocationLookback,
      topK: request.riskProfile === 'HIGH' ? 3 : dataset.assets.length,
      minimumMomentumPct: 0
    });

    const allocatorCash = clamp(raw.cashWeight ?? 0, 0, 1);
    const cashWeight = allocatorCash >= 0.999999
      ? 1
      : clamp(Math.max(profileBaseCash(request.riskProfile), regimeCashOverlay(currentRegime.regime), allocatorCash), 0, 0.60);
    const investable = 1 - cashWeight;
    const caps = profileCaps(request.riskProfile, aligned.assetIds);
    let weights = normalizeWeights(raw.weights, investable, caps);

    if (request.riskProfile === 'LOW' && investable > 0) {
      const defensiveIds = ['XEON', 'VAGF', '4GLD'].filter(id => id in weights);
      const defensiveFloor = Math.min(0.45, investable);
      const currentDefensive = defensiveIds.reduce((s, id) => s + weights[id], 0);
      if (defensiveIds.length && currentDefensive < defensiveFloor) {
        const needed = Math.min(defensiveFloor - currentDefensive, investable);
        const riskIds = Object.keys(weights).filter(id => !defensiveIds.includes(id));
        const riskTotal = riskIds.reduce((s, id) => s + weights[id], 0);
        if (riskTotal > 0) {
          for (const id of riskIds) weights[id] *= Math.max(0, (riskTotal - needed) / riskTotal);
          const add = needed / defensiveIds.length;
          for (const id of defensiveIds) weights[id] += add;
        }
      }
    }

    const allocatedWeight = Object.values(weights).reduce((s, x) => s + x, 0);
    const residualCashWeight = clamp(1 - allocatedWeight, 0, 1);
    const finalCashWeight = Math.max(cashWeight, residualCashWeight);

    const stats = new Map(analytics.assetStatistics.map(x => [x.assetId, x]));
    const weighted = dataset.assets.map(asset => {
      const weight = Math.max(0, weights[asset.assetId] ?? 0);
      const stat = stats.get(asset.assetId);
      const momentum = stat?.momentumReturnPct ?? null;
      const vol = stat?.annualizedVolatilityPct ?? null;
      const score = clamp(50 + (momentum ?? 0) * 0.8 - (vol ?? 0) * 0.35 + weight * 50, 0, 100);
      const action = weight >= 0.18 ? 'PRIORITIZE' : weight >= 0.05 ? 'SECONDARY' : 'NO_ALLOCATION';
      return {
        assetId: asset.assetId,
        ticker: asset.ticker,
        name: asset.name,
        weight,
        amountEur: request.capitalEur * weight,
        action,
        score,
        momentumPct: momentum,
        annualizedVolatilityPct: vol,
        rationale: assetRationale(asset.assetId, momentum, vol, weight, currentRegime.regime)
      } satisfies AssetDecisionScore;
    }).sort((a, b) => b.weight - a.weight);

    const confidence = confidenceFrom(dataAgeDays, aligned.rows.length, currentRegime.regime);
    const warnings: string[] = [
      'La confianza mostrada mide calidad de evidencia/datos; no es una probabilidad de rentabilidad.',
      'La puntuación base usa la serie REAL primaria de cada instrumento: Yahoo para cotizados y EODHD NAV para fondos. La validación cruzada adicional se informa por separado y no modifica silenciosamente los pesos.'
    ];
    if (dataAgeDays > 4) warnings.push(`Los últimos datos tienen ${dataAgeDays} días de antigüedad; no tratar la salida como actual.`);
    if (currentRegime.regime === 'UNKNOWN') warnings.push('No hay historial suficiente para clasificar el régimen con confianza.');
    if (request.horizonYears === 1) warnings.push('Horizonte de 1 año: la dispersión de resultados puede ser elevada incluso con diversificación.');
    if (finalCashWeight >= 0.999999) warnings.push('Ningún activo supera las reglas de asignación actuales: el resultado es 100% efectivo.');

    const top = weighted.filter(x => x.weight > 0.01).slice(0, 3).map(x => `${x.ticker} ${(x.weight * 100).toFixed(0)}%`).join(' + ');
    const summary = `Con ${request.capitalEur.toFixed(0)} € y riesgo ${request.riskProfile}, la regla actual asigna ${top || 'sin activos de riesgo'} y mantiene ${(finalCashWeight * 100).toFixed(0)}% en efectivo. Régimen: ${currentRegime.regime}.`;

    return {
      generatedAt: now.toISOString(),
      asOfDate: lastDate,
      dataAgeDays,
      currency: 'EUR',
      capitalEur: request.capitalEur,
      riskProfile: request.riskProfile,
      horizonYears: request.horizonYears,
      marketRegime: currentRegime.regime,
      regimeTrendPct: currentRegime.trendReturnPct,
      regimeVolatilityPct: currentRegime.realizedVolatilityPct,
      confidence: confidence.label,
      confidenceScore: confidence.score,
      recommendedMethod: method,
      cashWeight: finalCashWeight,
      cashAmountEur: request.capitalEur * finalCashWeight,
      assets: weighted,
      portfolioDatasetFingerprint: provenance.portfolioDatasetFingerprint,
      evidence: 'REAL_ONLY',
      warnings,
      summary,
      methodology: [
        'Series históricas diarias REAL del universo EUR, sin fallback sintético.',
        `Asignación base: ${method} con lookback de ${allocationLookback} barras.`,
        'Overlay de efectivo determinado por perfil de riesgo y régimen causal actual.',
        'Los pesos se limitan por instrumento para evitar concentraciones extremas.',
        'La salida describe una asignación de investigación, no una garantía de rentabilidad.'
      ]
    };
  }
}
