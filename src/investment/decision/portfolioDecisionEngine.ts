import type { AssetUniverseCategory, AssetUniverseItem, InvestmentInstrumentType } from './assetUniverse';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { CashBenchmarkService } from './cashBenchmark';
import { CurrentOpportunityAlertEngine, type CurrentOpportunityAlert } from './currentOpportunityAlerts';
import type { InvestmentDecisionResult } from './types';
import type { FundPosition } from './fundPortfolio';
import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import type { UserPortfolioState } from './userPortfolio';

export type PortfolioPositionAction =
  | 'HOLD'
  | 'WATCH'
  | 'ADD'
  | 'REDUCE'
  | 'EXIT'
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
  suggestedReductionPct?: number | null;
  healthSource?: PortfolioPositionHealthSnapshot['source'] | null;
}

export interface ContributionRecommendation {
  category: AssetUniverseCategory;
  assetId: string;
  ticker: string;
  name: string;
  instrumentType: InvestmentInstrumentType;
  amountEur: number;
  targetCategoryGapEur: number;
  opportunityLevel?: CurrentOpportunityAlert['level'];
  priorityScore?: number;
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

function healthFor(map: Record<string, PortfolioPositionHealthSnapshot | undefined>, ...keys: Array<string | undefined>): PortfolioPositionHealthSnapshot | undefined {
  for (const key of keys) {
    if (!key) continue;
    const found = map[key] ?? map[key.toUpperCase()];
    if (found) return found;
  }
  return undefined;
}

function opportunityLevelWeight(level: CurrentOpportunityAlert['level']): number {
  return level === 'HIGH_CONVICTION' ? 4 : level === 'GOOD_ENTRY' ? 2.5 : 1;
}

function opportunityPriority(alert: CurrentOpportunityAlert): number {
  const excess = Math.max(0, Math.min(25, alert.excessVsCashPctPoints ?? 0));
  const consensus = Math.max(0, alert.consensusScore);
  const volatilityPenalty = Math.max(1, (alert.annualizedVolatilityPct ?? 20) / 20);
  return (opportunityLevelWeight(alert.level) + consensus * 0.35 + excess * 0.08) / volatilityPenalty;
}

function maxOpportunityPositions(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 3 : risk === 'HIGH' ? 5 : 4;
}

function maxAssetShare(risk: InvestmentDecisionResult['riskProfile'], level: CurrentOpportunityAlert['level']): number {
  if (risk === 'LOW') return level === 'HIGH_CONVICTION' ? 0.35 : level === 'GOOD_ENTRY' ? 0.28 : 0.20;
  if (risk === 'HIGH') return level === 'HIGH_CONVICTION' ? 0.65 : level === 'GOOD_ENTRY' ? 0.50 : 0.40;
  return level === 'HIGH_CONVICTION' ? 0.50 : level === 'GOOD_ENTRY' ? 0.40 : 0.30;
}

function maxCategoryShare(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 0.50 : risk === 'HIGH' ? 0.70 : 0.60;
}

export class PortfolioDecisionEngine {
  static evaluate(input: {
    portfolio: UserPortfolioState;
    scan: AssetUniverseScanResult;
    decision: InvestmentDecisionResult;
    fundMarketValues?: Record<string, number | null | undefined>;
    positionHealth?: Record<string, PortfolioPositionHealthSnapshot | undefined>;
    materialDriftPctPoints?: number;
    cashBenchmarkAnnualPct?: number;
  }): PortfolioDecisionResult {
    const { portfolio, scan, decision } = input;
    const materialDrift = input.materialDriftPctPoints ?? 5;
    const fundValues = input.fundMarketValues ?? {};
    const healthMap = input.positionHealth ?? {};
    const cashBenchmarkAnnualPct = input.cashBenchmarkAnnualPct ?? CashBenchmarkService.load();
    const assets = categoryMap(scan);
    const prices = new Map(
      scan.candidates
        .filter(c => c.lastClose != null && Number.isFinite(c.lastClose) && (c.lastClose ?? 0) > 0)
        .map(c => [c.asset.ticker.toUpperCase(), Number(c.lastClose)])
    );

    const currentByCategory = new Map<AssetUniverseCategory, number>();
    const existingPositions: PortfolioPositionDecision[] = [];
    const unresolvedPositions: Array<{ index: number; category: AssetUniverseCategory | 'UNKNOWN'; health?: PortfolioPositionHealthSnapshot }> = [];

    let currentInvestedValueEur = 0;

    for (const fund of portfolio.funds ?? []) {
      const asset = assets.get(fund.isin.toUpperCase()) ?? assets.get(fund.id);
      const category = asset?.category ?? (fund.category === 'GLOBAL_EQUITY' || fund.category === 'EMERGING_EQUITY' ? fund.category : 'UNKNOWN');
      const health = healthFor(healthMap, fund.id, fund.isin);
      const value = fundMarketValue(fund, fundValues) ?? health?.currentValueEur ?? null;
      if (value != null) {
        currentInvestedValueEur += value;
        if (category !== 'UNKNOWN') currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: fund.id,
        label: fund.name || fund.isin,
        instrumentType: 'MUTUAL_FUND',
        category,
        currentValueEur: value,
        action: value == null ? 'DATA_MISSING' : 'HOLD',
        reason: value == null
          ? health?.reason ?? 'Falta una valoración actual del fondo; no se fuerza una decisión usando únicamente el coste aportado.'
          : 'Pendiente de reconciliar la salud propia del activo con el objetivo de cartera.',
        suggestedReductionPct: null,
        healthSource: health?.source ?? null
      }) - 1;
      unresolvedPositions.push({ index, category, health });
    }

    for (const holding of portfolio.holdings) {
      const asset = assets.get(holding.ticker.toUpperCase());
      const category = asset?.category ?? 'UNKNOWN';
      const health = healthFor(healthMap, holding.ticker);
      const price = prices.get(holding.ticker.toUpperCase());
      const value = price != null ? holding.shares * price : health?.currentValueEur ?? null;
      if (value != null) {
        currentInvestedValueEur += value;
        if (category !== 'UNKNOWN') currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: holding.ticker.toUpperCase(),
        label: asset?.name ?? holding.ticker.toUpperCase(),
        instrumentType: instrumentType(asset),
        category,
        currentValueEur: value,
        action: value == null ? 'DATA_MISSING' : 'HOLD',
        reason: value == null
          ? health?.reason ?? 'No hay valoración REAL utilizable para integrar esta posición en el patrimonio.'
          : category === 'UNKNOWN'
            ? 'Posición valorada y vigilada individualmente; no se fuerza una categoría artificial para el asignador.'
            : 'Pendiente de reconciliar la salud propia del activo con el objetivo de cartera.',
        suggestedReductionPct: null,
        healthSource: health?.source ?? null
      }) - 1;
      unresolvedPositions.push({ index, category, health });
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
      const health = unresolved.health;
      if (row.action === 'DATA_MISSING') continue;

      if (health) {
        row.healthSource = health.source;
        if (health.action === 'EXIT') {
          row.action = 'EXIT';
          row.reason = health.reason;
          row.suggestedReductionPct = 100;
          continue;
        }
        if (health.action === 'REDUCE') {
          row.action = 'REDUCE';
          row.reason = health.reason;
          row.suggestedReductionPct = health.suggestedReductionPct ?? 50;
          continue;
        }
        if (health.action === 'WATCH') {
          row.action = 'WATCH';
          row.reason = health.reason;
          continue;
        }
        if (health.action === 'ADD') {
          const exposure = unresolved.category === 'UNKNOWN' ? undefined : exposureByCategory.get(unresolved.category);
          if (!exposure || exposure.gapPctPoints >= -materialDrift) {
            row.action = 'ADD';
            row.reason = health.reason;
          } else {
            row.action = 'HOLD';
            row.reason = `${health.reason} No se añade ahora porque la categoría ya está materialmente sobreponderada.`;
          }
          continue;
        }
        if (health.action === 'HOLD') {
          row.action = 'HOLD';
          row.reason = health.reason;
          continue;
        }
      }

      if (unresolved.category === 'UNKNOWN') {
        row.action = 'HOLD';
        row.reason = 'La posición está valorada, pero no tiene clasificación de cartera y no hay todavía una señal independiente de deterioro que justifique reducirla.';
        continue;
      }

      const exposure = exposureByCategory.get(unresolved.category);
      if (!exposure) continue;
      if (exposure.gapPctPoints < -materialDrift) {
        row.action = 'HOLD';
        row.reason = `La categoría está sobreponderada ${Math.abs(exposure.gapPctPoints).toFixed(1)} pp respecto al objetivo teórico. Es una desviación de cartera, no una señal de venta: mantener salvo deterioro confirmado por el motor de salud individual o una rotación neta claramente superior.`;
      } else if (exposure.gapPctPoints > materialDrift) {
        const asset = assets.get(row.id) ?? assets.get((portfolio.funds ?? []).find(f => f.id === row.id)?.isin?.toUpperCase() ?? '');
        if (asset && preferredIds.has(asset.assetId)) {
          row.action = 'ADD';
          row.reason = `La categoría está infraponderada ${exposure.gapPctPoints.toFixed(1)} pp y este instrumento es el candidato preferente teórico de la categoría. La aportación efectiva se decidirá por oportunidades actuales y capital disponible.`;
        } else {
          row.action = 'HOLD';
          row.reason = 'La categoría está infraponderada, pero eso no constituye por sí solo una orden de compra o venta.';
        }
      } else {
        row.action = 'HOLD';
        row.reason = `La exposición de la categoría está dentro del umbral material de ±${materialDrift.toFixed(1)} pp.`;
      }
    }

    const targetCashEur = totalPlannedCapitalEur * Math.max(0, Math.min(1, decision.cashWeight));
    const deployablePool = currentCashEur + pendingCapitalEur;
    const deployableToAssetsEur = Math.max(0, deployablePool - targetCashEur);
    const opportunities = CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmarkAnnualPct);

    let contributions: ContributionRecommendation[] = [];
    if (!hasMissingValuation && deployableToAssetsEur > 0.01 && opportunities.length > 0) {
      const shortlist = opportunities.slice(0, maxOpportunityPositions(decision.riskProfile));
      const priorities = shortlist.map(alert => ({ alert, priority: opportunityPriority(alert) }));
      const totalPriority = priorities.reduce((sum, row) => sum + Math.max(0.01, row.priority), 0);
      const categoryAdded = new Map<AssetUniverseCategory, number>();
      const categoryLimit = totalPlannedCapitalEur * maxCategoryShare(decision.riskProfile);

      const allocated = priorities.map<ContributionRecommendation | null>(({ alert, priority }) => {
        const asset = assets.get(alert.assetId) ?? assets.get(alert.ticker.toUpperCase());
        if (!asset) return null;
        const rawAmount = deployableToAssetsEur * Math.max(0.01, priority) / totalPriority;
        const assetCap = deployableToAssetsEur * maxAssetShare(decision.riskProfile, alert.level);
        const alreadyInCategory = currentByCategory.get(asset.category) ?? 0;
        const alreadyAdded = categoryAdded.get(asset.category) ?? 0;
        const categoryCapacity = Math.max(0, categoryLimit - alreadyInCategory - alreadyAdded);
        const amountEur = Math.max(0, Math.min(rawAmount, assetCap, categoryCapacity));
        if (amountEur <= 0.01) return null;
        categoryAdded.set(asset.category, alreadyAdded + amountEur);
        const theoreticalGap = exposureByCategory.get(asset.category)?.gapEur ?? 0;
        return {
          category: asset.category,
          assetId: alert.assetId,
          ticker: alert.ticker,
          name: alert.name,
          instrumentType: instrumentType(asset),
          amountEur,
          targetCategoryGapEur: theoreticalGap,
          opportunityLevel: alert.level,
          priorityScore: priority,
          reason: `${alert.level === 'HIGH_CONVICTION' ? 'Entrada de ALTA CONVICCIÓN' : alert.level === 'GOOD_ENTRY' ? 'Buena oportunidad actual' : 'Entrada válida actual'}: consenso ${alert.consensusScore >= 0 ? '+' : ''}${alert.consensusScore}, ${alert.favorableVotes}/5 favorables y ${alert.excessVsCashPctPoints?.toFixed(1) ?? 'N/D'} pp frente a cash. El importe sale del capital REAL disponible y respeta límites de concentración; no procede del diagnóstico teórico de pesos.`
        };
      });
      contributions = allocated.filter((row): row is ContributionRecommendation => row != null);
    }

    if (!hasMissingValuation && contributions.length === 0 && opportunities.length === 0) {
      const positiveGaps = exposures.filter(x => x.gapEur > 0.01 && preferredByCategory.has(x.category));
      const totalPositiveGap = positiveGaps.reduce((s, x) => s + x.gapEur, 0);
      const fallbackBudget = Math.min(deployableToAssetsEur, totalPositiveGap);
      contributions = positiveGaps.map(exposure => {
        const preferred = preferredByCategory.get(exposure.category)!;
        const asset = assets.get(preferred.assetId) ?? assets.get(preferred.ticker.toUpperCase())!;
        const amountEur = totalPositiveGap > 0 ? Math.min(exposure.gapEur, fallbackBudget * exposure.gapEur / totalPositiveGap) : 0;
        return {
          category: exposure.category,
          assetId: preferred.assetId,
          ticker: preferred.ticker,
          name: preferred.name,
          instrumentType: instrumentType(asset),
          amountEur,
          targetCategoryGapEur: exposure.gapEur,
          reason: `Fallback teórico: no existe hoy ninguna oportunidad que supere el gate actual; este cálculo se conserva solo como diagnóstico de distribución y no debe contradecir una alerta de entrada.`
        };
      }).filter(x => x.amountEur > 0.01);
    }

    contributions.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || b.amountEur - a.amountEur);
    const recommendedNewInvestmentEur = contributions.reduce((sum, row) => sum + row.amountEur, 0);
    const residualPlannedCashEur = Math.max(0, deployablePool - recommendedNewInvestmentEur);
    const warnings: string[] = [];
    if (hasMissingValuation) warnings.push('Hay posiciones sin valoración REAL utilizable: se bloquea temporalmente la asignación de capital nuevo para no calcular el patrimonio como si esas posiciones valieran cero.');
    if (exposures.some(x => x.gapEur < -0.01)) warnings.push('Una sobreponderación por sí sola NO genera una venta. REDUCE/EXIT proceden de salud; una rotación voluntaria adicional debe demostrar ventaja neta tras impuestos y costes.');
    if (existingPositions.some(x => x.category === 'UNKNOWN' && x.currentValueEur != null)) warnings.push('Hay posiciones fuera del universo clasificado que se valoran y vigilan individualmente; no se inventa una categoría para forzar su peso objetivo.');
    if (opportunities.length > 0) warnings.push(`La asignación efectiva usa ${opportunities.length} oportunidad(es) actual(es) que pasan cash + consenso; el capital sugerido nunca supera la liquidez realmente disponible y aplica límites de concentración.`);
    else warnings.push('No hay oportunidades actuales que pasen el gate; los pesos teóricos quedan solo como diagnóstico secundario y no son una orden de compra.');

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