import type { AssetUniverseCategory, AssetUniverseItem, InvestmentInstrumentType } from './assetUniverse';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import type { InvestmentDecisionResult } from './types';
import type { FundPosition } from './fundPortfolio';
import type { UserPortfolioState } from './userPortfolio';

export type PortfolioPositionAction =
  | 'HOLD'
  | 'ADD'
  | 'REDUCE'
  | 'REVIEW_TRANSFER'
  | 'DATA_MISSING';

export interface PortfolioExposureLine {
  category: AssetUniverseCategory;
  currentValueEur: number;
  currentWeightPct: number;
  targetValueEur: number;
  targetWeightPct: number;
  gapEur: number;
  gapPctPoints: number;
}

export interface PortfolioPositionDecision {
  id: string;
  label: string;
  instrumentType: InvestmentInstrumentType;
  category: AssetUniverseCategory | 'UNKNOWN';
  currentValueEur: number | null;
  action: PortfolioPositionAction;
  reason: string;
}

export interface ContributionRecommendation {
  category: AssetUniverseCategory;
  assetId: string;
  ticker: string;
  name: string;
  instrumentType: InvestmentInstrumentType;
  amountEur: number;
  targetCategoryGapEur: number;
  reason: string;
}

export interface PortfolioDecisionResult {
  currentInvestedValueEur: number;
  currentCashEur: number;
  pendingCapitalEur: number;
  totalPlannedCapitalEur: number;
  targetCashEur: number;
  deployableToAssetsEur: number;
  recommendedNewInvestmentEur: number;
  residualPlannedCashEur: number;
  exposures: PortfolioExposureLine[];
  existingPositions: PortfolioPositionDecision[];
  contributions: ContributionRecommendation[];
  warnings: string[];
}

function instrumentType(asset?: AssetUniverseItem): InvestmentInstrumentType {
  return asset?.instrumentType ?? 'ETF_ETC';
}

function categoryMap(scan: AssetUniverseScanResult): Map<string, AssetUniverseItem> {
  const out = new Map<string, AssetUniverseItem>();
  for (const candidate of scan.candidates) {
    out.set(candidate.asset.assetId, candidate.asset);
    out.set(candidate.asset.ticker.toUpperCase(), candidate.asset);
    if (candidate.asset.isin) out.set(candidate.asset.isin.toUpperCase(), candidate.asset);
  }
  return out;
}

function fundMarketValue(fund: FundPosition, marketValues: Record<string, number | null | undefined>): number | null {
  const runtime = marketValues[fund.id];
  if (runtime != null && Number.isFinite(runtime) && runtime >= 0) return runtime;
  if (fund.currentValueEur != null && Number.isFinite(fund.currentValueEur) && fund.currentValueEur >= 0) return fund.currentValueEur;
  return null;
}

export class PortfolioDecisionEngine {
  static evaluate(input: {
    portfolio: UserPortfolioState;
    scan: AssetUniverseScanResult;
    decision: InvestmentDecisionResult;
    fundMarketValues?: Record<string, number | null | undefined>;
    materialDriftPctPoints?: number;
  }): PortfolioDecisionResult {
    const { portfolio, scan, decision } = input;
    const materialDrift = input.materialDriftPctPoints ?? 5;
    const fundValues = input.fundMarketValues ?? {};
    const assets = categoryMap(scan);
    const prices = new Map(
      scan.candidates
        .filter(c => c.lastClose != null && Number.isFinite(c.lastClose) && (c.lastClose ?? 0) > 0)
        .map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])
    );

    const currentByCategory = new Map<AssetUniverseCategory, number>();
    const existingPositions: PortfolioPositionDecision[] = [];
    const unresolvedPositions: Array<{ index: number; category: AssetUniverseCategory | 'UNKNOWN' }> = [];

    let currentInvestedValueEur = 0;

    for (const fund of portfolio.funds ?? []) {
      const asset = assets.get(fund.isin.toUpperCase()) ?? assets.get(fund.id);
      const category = asset?.category ?? (fund.category === 'GLOBAL_EQUITY' || fund.category === 'EMERGING_EQUITY' ? fund.category : 'UNKNOWN');
      const value = fundMarketValue(fund, fundValues);
      if (value != null && category !== 'UNKNOWN') {
        currentInvestedValueEur += value;
        currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: fund.id,
        label: fund.name || fund.isin,
        instrumentType: 'MUTUAL_FUND',
        category,
        currentValueEur: value,
        action: value == null ? 'DATA_MISSING' : 'HOLD',
        reason: value == null
          ? 'Falta una valoración actual del fondo; no se fuerza una decisión usando únicamente el coste aportado.'
          : 'Pendiente de reconciliar la exposición actual con el objetivo de cartera.'
      }) - 1;
      unresolvedPositions.push({ index, category });
    }

    for (const holding of portfolio.holdings) {
      const asset = assets.get(holding.ticker.toUpperCase());
      const category = asset?.category ?? 'UNKNOWN';
      const price = prices.get(holding.ticker.toUpperCase());
      const value = price != null ? holding.shares * price : null;
      if (value != null && category !== 'UNKNOWN') {
        currentInvestedValueEur += value;
        currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: holding.ticker.toUpperCase(),
        label: asset?.name ?? holding.ticker.toUpperCase(),
        instrumentType: instrumentType(asset),
        category,
        currentValueEur: value,
        action: value == null || category === 'UNKNOWN' ? 'DATA_MISSING' : 'HOLD',
        reason: value == null
          ? 'No hay precio REAL disponible para valorar esta posición.'
          : category === 'UNKNOWN'
            ? 'La posición no está clasificada dentro del universo unificado.'
            : 'Pendiente de reconciliar la exposición actual con el objetivo de cartera.'
      }) - 1;
      unresolvedPositions.push({ index, category });
    }

    const hasMissingValuation = existingPositions.some(x => x.action === 'DATA_MISSING');
    const currentCashEur = Math.max(0, portfolio.cashEur);
    const pendingCapitalEur = Math.max(0, portfolio.stagedCapitalPlan?.availableEur ?? 0);
    const totalPlannedCapitalEur = currentInvestedValueEur + currentCashEur + pendingCapitalEur;

    const targetWeightByCategory = new Map<AssetUniverseCategory, number>();
    const preferredByCategory = new Map<AssetUniverseCategory, InvestmentDecisionResult['assets'][number]>();
    for (const recommendation of decision.assets) {
      const asset = assets.get(recommendation.assetId) ?? assets.get(recommendation.ticker.toUpperCase());
      if (!asset || recommendation.weight <= 0) continue;
      targetWeightByCategory.set(asset.category, (targetWeightByCategory.get(asset.category) ?? 0) + recommendation.weight);
      const preferred = preferredByCategory.get(asset.category);
      if (!preferred || recommendation.weight > preferred.weight) preferredByCategory.set(asset.category, recommendation);
    }

    const categories = new Set<AssetUniverseCategory>([...currentByCategory.keys(), ...targetWeightByCategory.keys()]);
    const exposures: PortfolioExposureLine[] = [...categories].map(category => {
      const currentValueEur = currentByCategory.get(category) ?? 0;
      const targetWeight = targetWeightByCategory.get(category) ?? 0;
      const targetValueEur = totalPlannedCapitalEur * targetWeight;
      const currentWeightPct = totalPlannedCapitalEur > 0 ? currentValueEur / totalPlannedCapitalEur * 100 : 0;
      const targetWeightPct = targetWeight * 100;
      return {
        category,
        currentValueEur,
        currentWeightPct,
        targetValueEur,
        targetWeightPct,
        gapEur: targetValueEur - currentValueEur,
        gapPctPoints: targetWeightPct - currentWeightPct
      };
    }).sort((a, b) => b.gapEur - a.gapEur);
    const exposureByCategory = new Map(exposures.map(x => [x.category, x]));

    const preferredIds = new Set([...preferredByCategory.values()].map(x => x.assetId));
    for (const unresolved of unresolvedPositions) {
      const row = existingPositions[unresolved.index];
      if (row.action === 'DATA_MISSING' || unresolved.category === 'UNKNOWN') continue;
      const exposure = exposureByCategory.get(unresolved.category);
      if (!exposure) continue;

      if (exposure.gapPctPoints < -materialDrift) {
        // Critical distinction: allocation drift is not a sell signal. Previously this branch
        // emitted REDUCE/REVIEW_TRANSFER and the execution-plan layer converted it into a real
        // sell/redeem instruction. Existing holdings now remain HOLD until an independent
        // deterioration/consensus layer explicitly authorises a reduction.
        row.action = 'HOLD';
        row.reason = `La categoría está sobreponderada ${Math.abs(exposure.gapPctPoints).toFixed(1)} pp respecto al objetivo teórico. Es una desviación de cartera, no una señal de venta: mantener salvo deterioro confirmado por el motor de consenso.`;
      } else if (exposure.gapPctPoints > materialDrift) {
        const asset = assets.get(row.id) ?? assets.get((portfolio.funds ?? []).find(f => f.id === row.id)?.isin?.toUpperCase() ?? '');
        if (asset && preferredIds.has(asset.assetId)) {
          row.action = 'ADD';
          row.reason = `La categoría está infraponderada ${exposure.gapPctPoints.toFixed(1)} pp y este instrumento es el candidato preferente actual de la categoría. Cualquier aportación sigue sujeta a los gates de efectivo, coste y consenso.`;
        } else {
          row.action = 'HOLD';
          row.reason = `La categoría está infraponderada, pero el motor prioriza otro instrumento equivalente para las nuevas aportaciones. No implica vender esta posición.`;
        }
      } else {
        row.action = 'HOLD';
        row.reason = `La exposición de la categoría está dentro del umbral material de ±${materialDrift.toFixed(1)} pp.`;
      }
    }

    const targetCashEur = totalPlannedCapitalEur * Math.max(0, Math.min(1, decision.cashWeight));
    const deployablePool = currentCashEur + pendingCapitalEur;
    const deployableToAssetsEur = Math.max(0, deployablePool - targetCashEur);
    const positiveGaps = exposures.filter(x => x.gapEur > 0.01 && preferredByCategory.has(x.category));
    const totalPositiveGap = positiveGaps.reduce((s, x) => s + x.gapEur, 0);
    const recommendedNewInvestmentEur = hasMissingValuation ? 0 : Math.min(deployableToAssetsEur, totalPositiveGap);

    const contributions: ContributionRecommendation[] = hasMissingValuation ? [] : positiveGaps.map(exposure => {
      const preferred = preferredByCategory.get(exposure.category)!;
      const asset = assets.get(preferred.assetId) ?? assets.get(preferred.ticker.toUpperCase())!;
      const amountEur = totalPositiveGap > 0
        ? Math.min(exposure.gapEur, recommendedNewInvestmentEur * exposure.gapEur / totalPositiveGap)
        : 0;
      return {
        category: exposure.category,
        assetId: preferred.assetId,
        ticker: preferred.ticker,
        name: preferred.name,
        instrumentType: instrumentType(asset),
        amountEur,
        targetCategoryGapEur: exposure.gapEur,
        reason: `Objetivo teórico dirigido al déficit de ${exposure.category}; no es una orden de compra hasta superar los gates de consenso, efectivo, coste y broker.`
      };
    }).filter(x => x.amountEur > 0.01).sort((a, b) => b.amountEur - a.amountEur);

    const residualPlannedCashEur = Math.max(0, deployablePool - contributions.reduce((s, x) => s + x.amountEur, 0));
    const warnings: string[] = [];
    if (hasMissingValuation) warnings.push('Hay posiciones sin valoración REAL: se bloquea temporalmente la asignación de capital nuevo para no calcular como si esas posiciones valieran cero.');
    if (exposures.some(x => x.gapEur < -0.01)) warnings.push('Existen categorías sobreponderadas, pero una sobreponderación por sí sola NO genera una venta. La reducción requiere una señal independiente de deterioro/consenso.');
    warnings.push('Las aportaciones mostradas aquí son objetivos teóricos de distribución. La acción ejecutable se decide después mediante consenso, efectivo, costes, títulos enteros y disponibilidad broker.');

    return {
      currentInvestedValueEur,
      currentCashEur,
      pendingCapitalEur,
      totalPlannedCapitalEur,
      targetCashEur,
      deployableToAssetsEur,
      recommendedNewInvestmentEur,
      residualPlannedCashEur,
      exposures,
      existingPositions,
      contributions,
      warnings
    };
  }
}
