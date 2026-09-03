import type { AssetUniverseCategory, AssetUniverseItem, InvestmentInstrumentType } from './assetUniverse';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { CashBenchmarkService } from './cashBenchmark';
import { brokerCommission } from './costAwareExecutionPolicy';
import { CurrentOpportunityAlertEngine, type CurrentOpportunityAlert } from './currentOpportunityAlerts';
import { EntryTimingEngine, type EntryTimingPersistenceAssessment } from './entryTiming';
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
  assetId: string | null;
  label: string;
  instrumentType: InvestmentInstrumentType;
  category: AssetUniverseCategory | 'UNKNOWN';
  currentValueEur: number | null;
  action: PortfolioPositionAction;
  reason: string;
  suggestedReductionPct?: number | null;
  healthSource?: PortfolioPositionHealthSnapshot['source'] | null;
  relativeSelectionScore?: number | null;
  rotationChallengerAssetId?: string | null;
  rotationChallengerTicker?: string | null;
  rotationAdvantageScore?: number | null;
  rotationChallengerRecentStrongCount?: number | null;
  rotationChallengerPersistenceLookbackSessions?: number | null;
}

export type ContributionPositionStage = 'STARTER' | 'BUILD' | 'ROTATION_ENTRY';

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
  currentAssetValueEur?: number;
  targetAssetValueEur?: number;
  executableTargetAssetValueEur?: number;
  timingState?: CurrentOpportunityAlert['timingState'];
  suggestedInitialFraction?: number;
  positionStage?: ContributionPositionStage;
  portfolioShareCapPct?: number;
  reason: string;
}

export interface PortfolioDecisionResult {
  currentInvestedValueEur: number;
  currentCashEur: number;
  pendingCapitalEur: number;
  totalPlannedCapitalEur: number;
  targetCashEur: number;
  deployableToAssetsEur: number;
  plannedRotationProceedsEur: number;
  maxPortfolioPositions: number;
  occupiedPortfolioPositions: number;
  availablePortfolioSlots: number;
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
  return risk === 'LOW' ? 8 : risk === 'HIGH' ? 16 : 12;
}

function maxPortfolioPositionsForRisk(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 8 : risk === 'HIGH' ? 16 : 12;
}

function maxNewPositionsPerDecision(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 1 : risk === 'HIGH' ? 3 : 2;
}

function maxBootstrapNewPositionsPerDecision(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 2 : risk === 'HIGH' ? 5 : 4;
}

function starterPortfolioShare(risk: InvestmentDecisionResult['riskProfile'], timingState: CurrentOpportunityAlert['timingState']): number {
  if (risk === 'LOW') return timingState === 'ENTRY_READY' ? 0.02 : 0.035;
  if (risk === 'HIGH') return timingState === 'ENTRY_READY' ? 0.04 : 0.07;
  return timingState === 'ENTRY_READY' ? 0.03 : 0.05;
}

function buildPortfolioShare(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 0.06 : risk === 'HIGH' ? 0.12 : 0.08;
}

function maxAssetShare(risk: InvestmentDecisionResult['riskProfile'], level: CurrentOpportunityAlert['level']): number {
  if (risk === 'LOW') return level === 'HIGH_CONVICTION' ? 0.35 : level === 'GOOD_ENTRY' ? 0.28 : 0.20;
  if (risk === 'HIGH') return level === 'HIGH_CONVICTION' ? 0.65 : level === 'GOOD_ENTRY' ? 0.50 : 0.40;
  return level === 'HIGH_CONVICTION' ? 0.50 : level === 'GOOD_ENTRY' ? 0.40 : 0.30;
}

function maxCategoryShare(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 0.50 : risk === 'HIGH' ? 0.70 : 0.60;
}

function rotationPriorityMargin(risk: InvestmentDecisionResult['riskProfile']): number {
  return risk === 'LOW' ? 15 : risk === 'HIGH' ? 10 : 12;
}

const ROTATION_PERSISTENCE_LOOKBACK_SESSIONS = 10;
const ROTATION_MIN_PRIOR_STRONG_OBSERVATIONS = 3;
const SYSTEMIC_DISTRESS_MIN_POSITIONS = 3;
const SYSTEMIC_DISTRESS_MIN_FRACTION = 0.50;
const BOOTSTRAP_INVESTED_SHARE_THRESHOLD = 0.50;

function incumbentSelectionScore(candidate: AssetUniverseScanResult['candidates'][number] | undefined, health: PortfolioPositionHealthSnapshot | undefined): number | null {
  if (!candidate || candidate.score == null || !Number.isFinite(candidate.score)) return null;
  const consensus = Number.isFinite(health?.consensusScore) ? Number(health?.consensusScore) : 0;
  const excess = Number.isFinite(health?.excessVsCashPctPoints) ? Number(health?.excessVsCashPctPoints) : 0;
  return candidate.score + consensus * 5 + Math.max(-20, Math.min(20, excess)) * 0.5;
}

function estimatedRotationRoundTripFeeDragPct(notionalEur: number, type: InvestmentInstrumentType): number {
  if (!(notionalEur > 0) || type === 'MUTUAL_FUND') return 0;
  return brokerCommission(notionalEur) * 2 / notionalEur * 100;
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
    const currentByAsset = new Map<string, number>();
    const existingPositions: PortfolioPositionDecision[] = [];
    const unresolvedPositions: Array<{ index: number; assetId: string | null; category: AssetUniverseCategory | 'UNKNOWN'; health?: PortfolioPositionHealthSnapshot }> = [];

    let currentInvestedValueEur = 0;

    for (const fund of portfolio.funds ?? []) {
      const asset = assets.get(fund.isin.toUpperCase()) ?? assets.get(fund.id);
      const category = asset?.category ?? (fund.category === 'GLOBAL_EQUITY' || fund.category === 'EMERGING_EQUITY' ? fund.category : 'UNKNOWN');
      const health = healthFor(healthMap, fund.id, fund.isin, asset?.assetId);
      const value = fundMarketValue(fund, fundValues) ?? health?.currentValueEur ?? null;
      if (value != null) {
        currentInvestedValueEur += value;
        if (category !== 'UNKNOWN') currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
        if (asset) currentByAsset.set(asset.assetId, (currentByAsset.get(asset.assetId) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: fund.id,
        assetId: asset?.assetId ?? null,
        label: fund.name || fund.isin,
        instrumentType: 'MUTUAL_FUND',
        category,
        currentValueEur: value,
        action: value == null ? 'DATA_MISSING' : 'HOLD',
        reason: value == null
          ? health?.reason ?? 'Falta una valoración actual del fondo; no se fuerza una decisión usando únicamente el coste aportado.'
          : 'Pendiente de reconciliar la salud propia del activo con el objetivo de cartera.',
        suggestedReductionPct: null,
        healthSource: health?.source ?? null,
        relativeSelectionScore: null,
        rotationChallengerAssetId: null,
        rotationChallengerTicker: null,
        rotationAdvantageScore: null,
        rotationChallengerRecentStrongCount: null,
        rotationChallengerPersistenceLookbackSessions: null
      }) - 1;
      unresolvedPositions.push({ index, assetId: asset?.assetId ?? null, category, health });
    }

    for (const holding of portfolio.holdings) {
      const asset = assets.get(holding.ticker.toUpperCase());
      const category = asset?.category ?? 'UNKNOWN';
      const health = healthFor(healthMap, holding.ticker, asset?.assetId);
      const price = prices.get(holding.ticker.toUpperCase());
      const value = price != null ? holding.shares * price : health?.currentValueEur ?? null;
      if (value != null) {
        currentInvestedValueEur += value;
        if (category !== 'UNKNOWN') currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + value);
        if (asset) currentByAsset.set(asset.assetId, (currentByAsset.get(asset.assetId) ?? 0) + value);
      }
      const index = existingPositions.push({
        id: holding.ticker.toUpperCase(),
        assetId: asset?.assetId ?? null,
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
        healthSource: health?.source ?? null,
        relativeSelectionScore: null,
        rotationChallengerAssetId: null,
        rotationChallengerTicker: null,
        rotationAdvantageScore: null,
        rotationChallengerRecentStrongCount: null,
        rotationChallengerPersistenceLookbackSessions: null
      }) - 1;
      unresolvedPositions.push({ index, assetId: asset?.assetId ?? null, category, health });
    }

    const hasMissingValuation = existingPositions.some(x => x.action === 'DATA_MISSING');
    const currentCashEur = Math.max(0, portfolio.cashEur);
    const pendingCapitalEur = Math.max(0, portfolio.stagedCapitalPlan?.availableEur ?? 0);
    const totalPlannedCapitalEur = currentInvestedValueEur + currentCashEur + pendingCapitalEur;
    const systemicHealthRows = unresolvedPositions
      .map(unresolved => ({ row: existingPositions[unresolved.index], health: unresolved.health }))
      .filter(item => (item.row.currentValueEur ?? 0) > 0 && Number.isFinite(item.health?.consensusScore) && Number.isFinite(item.health?.unfavorableVotes));
    const systemicDistressedCount = systemicHealthRows.filter(item =>
      (item.health?.consensusScore ?? Infinity) <= -3 && (item.health?.unfavorableVotes ?? 0) >= 3
    ).length;
    const systemicDistressFraction = systemicHealthRows.length > 0 ? systemicDistressedCount / systemicHealthRows.length : 0;
    const systemicStress = systemicDistressedCount >= SYSTEMIC_DISTRESS_MIN_POSITIONS && systemicDistressFraction >= SYSTEMIC_DISTRESS_MIN_FRACTION;
    const systemicCoreShare = starterPortfolioShare(decision.riskProfile, 'ENTRY_READY');
    const systemicCoreValueEur = totalPlannedCapitalEur * systemicCoreShare;

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
          if (systemicStress) {
            const currentValue = Math.max(0, row.currentValueEur ?? 0);
            if (currentValue > systemicCoreValueEur + 0.01 && systemicCoreValueEur > 0) {
              const reductionPct = Math.max(0, Math.min(100, (1 - systemicCoreValueEur / currentValue) * 100));
              row.action = 'REDUCE';
              row.suggestedReductionPct = reductionPct;
              row.reason = `Estrés sistémico detectado (${systemicDistressedCount}/${systemicHealthRows.length} posiciones con consenso ≤-3 y ≥3 señales adversas). La señal individual justificaría EXIT, pero no se liquida una posición junto con media cartera. Se reduce sólo hasta el núcleo ENTRY_READY del ${(systemicCoreShare * 100).toFixed(1)}% del patrimonio; el EXIT completo volverá a exigirse cuando el deterioro deje de ser sistémico y siga siendo específico del activo. Señal individual: ${health.reason}`;
            } else {
              row.action = 'WATCH';
              row.suggestedReductionPct = null;
              row.reason = `Estrés sistémico detectado (${systemicDistressedCount}/${systemicHealthRows.length} posiciones con consenso ≤-3 y ≥3 señales adversas). La posición ya está en o por debajo del núcleo ENTRY_READY del ${(systemicCoreShare * 100).toFixed(1)}% del patrimonio, por lo que no se cristaliza un EXIT 100% durante una venta sincronizada. Se mantiene en WATCH y recuperará la gestión individual normal cuando la amplitud se normalice. Señal individual: ${health.reason}`;
            }
          } else {
            row.action = 'EXIT';
            row.reason = health.reason;
            row.suggestedReductionPct = 100;
          }
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
    const baseDeployableToAssetsEur = Math.max(0, deployablePool - targetCashEur);
    const opportunities = CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmarkAnnualPct);
    const executionPolicy = executionPolicyForCapital(totalPlannedCapitalEur);
    const heldAssetIds = new Set(currentByAsset.keys());
    const maxPortfolioPositions = maxPortfolioPositionsForRisk(decision.riskProfile);
    const occupiedPortfolioPositions = existingPositions.filter(row => (row.currentValueEur ?? 0) > 0).length;
    const availablePortfolioSlots = Math.max(0, maxPortfolioPositions - occupiedPortfolioPositions);
    const investedShareOfPlanned = totalPlannedCapitalEur > 0 ? currentInvestedValueEur / totalPlannedCapitalEur : 0;
    const bootstrapDeploymentActive =
      !hasMissingValuation
      && !systemicStress
      && availablePortfolioSlots > 0
      && investedShareOfPlanned < BOOTSTRAP_INVESTED_SHARE_THRESHOLD
      && baseDeployableToAssetsEur >= executionPolicy.minimumOrderNotionalEur - 1e-9;
    const newPositionDecisionLimit = bootstrapDeploymentActive
      ? maxBootstrapNewPositionsPerDecision(decision.riskProfile)
      : maxNewPositionsPerDecision(decision.riskProfile);

    // A full-slot competitive replacement requires evidence that the challenger was
    // already strong before today. ENTRY_STRONG remains a fast entry-timing signal for
    // ordinary cash/new-slot entries, but one isolated STRONG is not enough to evict an
    // incumbent. During broad systemic distress the engine does not churn one stressed
    // incumbent into another asset; health protection takes precedence until breadth normalizes.
    const rotationPersistenceByAsset = new Map<string, EntryTimingPersistenceAssessment>();
    const rotationChallengers = availablePortfolioSlots === 0 && !systemicStress
      ? opportunities
        .filter(alert => !heldAssetIds.has(alert.assetId) && alert.timingState === 'ENTRY_STRONG' && alert.consensusScore >= 3 && alert.favorableVotes >= 4)
        .filter(alert => {
          const persistence = EntryTimingEngine.assessRecentPersistence(
            scan,
            alert.assetId,
            cashBenchmarkAnnualPct,
            ROTATION_PERSISTENCE_LOOKBACK_SESSIONS
          );
          rotationPersistenceByAsset.set(alert.assetId, persistence);
          return persistence.observedSessions >= ROTATION_PERSISTENCE_LOOKBACK_SESSIONS
            && persistence.strongCount >= ROTATION_MIN_PRIOR_STRONG_OBSERVATIONS;
        })
        .sort((a, b) => b.rankingScore - a.rankingScore)
      : [];
    const rotationIncumbents = unresolvedPositions
      .map(unresolved => {
        const row = existingPositions[unresolved.index];
        const candidate = unresolved.assetId ? scan.candidates.find(c => c.asset.assetId === unresolved.assetId) : undefined;
        const score = incumbentSelectionScore(candidate, unresolved.health);
        row.relativeSelectionScore = score;
        return { unresolved, row, score };
      })
      .filter(item => item.row.currentValueEur != null && (item.row.currentValueEur ?? 0) > 0 && item.score != null && (
        item.row.action === 'WATCH' ||
        (item.row.action === 'HOLD' && (item.unresolved.health?.consensusScore ?? 99) <= 0)
      ))
      .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));

    let plannedRotationProceedsEur = 0;
    let rotationActions = 0;
    const rotationChallengerIds = new Set<string>();
    const rotationRestoreByChallenger = new Map<string, {
      row: PortfolioPositionDecision;
      action: PortfolioPositionAction;
      reason: string;
      suggestedReductionPct: number | null | undefined;
      proceedsEur: number;
    }>();
    outerRotation:
    for (const challenger of rotationChallengers) {
      for (const incumbent of rotationIncumbents) {
        if (rotationActions >= 1) break outerRotation;
        const currentValue = incumbent.row.currentValueEur ?? 0;
        if (currentValue < executionPolicy.minimumOrderNotionalEur - 1e-9) continue;
        const incumbentExcess = incumbent.unresolved.health?.excessVsCashPctPoints ?? 0;
        const challengerExcess = challenger.excessVsCashPctPoints ?? -Infinity;
        const feeDrag = estimatedRotationRoundTripFeeDragPct(currentValue, incumbent.row.instrumentType);
        const advantageScore = challenger.rankingScore - (incumbent.score ?? challenger.rankingScore);
        const requiredExcessMargin = Math.max(2, feeDrag * 2);
        if (advantageScore < rotationPriorityMargin(decision.riskProfile) - 1e-9) continue;
        if (!(challengerExcess >= incumbentExcess + requiredExcessMargin)) continue;
        const persistence = rotationPersistenceByAsset.get(challenger.assetId);
        if (!persistence) continue;

        rotationRestoreByChallenger.set(challenger.assetId, {
          row: incumbent.row,
          action: incumbent.row.action,
          reason: incumbent.row.reason,
          suggestedReductionPct: incumbent.row.suggestedReductionPct,
          proceedsEur: currentValue
        });
        incumbent.row.action = 'EXIT';
        incumbent.row.suggestedReductionPct = 100;
        incumbent.row.rotationChallengerAssetId = challenger.assetId;
        incumbent.row.rotationChallengerTicker = challenger.ticker;
        incumbent.row.rotationAdvantageScore = advantageScore;
        incumbent.row.rotationChallengerRecentStrongCount = persistence.strongCount;
        incumbent.row.rotationChallengerPersistenceLookbackSessions = persistence.lookbackSessions;
        incumbent.row.reason = `Rotación competitiva persistente 1:1: ${challenger.ticker} aparece como ENTRY_STRONG hoy y ya había sido ENTRY_STRONG ${persistence.strongCount}/${persistence.lookbackSessions} sesiones previas. Además supera claramente a esta posición (${advantageScore.toFixed(1)} puntos de ranking; ventaja frente a cash ${challengerExcess.toFixed(1)} pp vs ${incumbentExcess.toFixed(1)} pp). La cartera está llena, por lo que se libera realmente esta plaza antes de introducir el challenger. Coste ETF ida/vuelta estimado ~${feeDrag.toFixed(2)}% antes de fiscalidad. Un STRONG aislado no puede expulsar un incumbent.`;
        plannedRotationProceedsEur += currentValue;
        rotationChallengerIds.add(challenger.assetId);
        rotationActions++;
      }
    }

    let deployableToAssetsEur = baseDeployableToAssetsEur + plannedRotationProceedsEur;
    const effectiveNewSlots = availablePortfolioSlots + rotationActions;

    let contributions: ContributionRecommendation[] = [];
    if (!hasMissingValuation && deployableToAssetsEur > 0.01 && opportunities.length > 0) {
      const existingOpportunities = opportunities.filter(alert => heldAssetIds.has(alert.assetId));
      const newOpportunities = opportunities.filter(alert => !heldAssetIds.has(alert.assetId));
      const shortlistLimit = maxOpportunityPositions(decision.riskProfile);
      const shortlist = [...existingOpportunities, ...newOpportunities]
        .filter((alert, index, all) => all.findIndex(other => other.assetId === alert.assetId) === index)
        .sort((a, b) => {
          const rotationDelta = Number(rotationChallengerIds.has(b.assetId)) - Number(rotationChallengerIds.has(a.assetId));
          return rotationDelta || b.rankingScore - a.rankingScore;
        })
        .slice(0, Math.max(shortlistLimit, existingOpportunities.length));
      const priorities = shortlist.map(alert => ({ alert, priority: opportunityPriority(alert) }));
      const totalPriority = priorities.reduce((sum, row) => sum + Math.max(0.01, row.priority), 0);
      const currentOpportunityValueEur = shortlist.reduce((sum, alert) => sum + Math.max(0, currentByAsset.get(alert.assetId) ?? 0), 0);
      const stableOpportunityPoolEur = deployableToAssetsEur + currentOpportunityValueEur;
      const categoryAdded = new Map<AssetUniverseCategory, number>();
      const categoryLimit = totalPlannedCapitalEur * maxCategoryShare(decision.riskProfile);
      let allocatedBaseEur = 0;
      let allocatedRotationEur = 0;
      let newPositionsAllocated = 0;
      const newPositionBudget = Math.min(effectiveNewSlots, newPositionDecisionLimit);

      const allocated = priorities.map<ContributionRecommendation | null>(({ alert, priority }) => {
        const asset = assets.get(alert.assetId) ?? assets.get(alert.ticker.toUpperCase());
        if (!asset) return null;
        const currentAssetValueEur = Math.max(0, currentByAsset.get(alert.assetId) ?? 0);
        const isExisting = currentAssetValueEur > 0.01;
        const isRotationEntry = rotationChallengerIds.has(alert.assetId);
        if (!isExisting && newPositionsAllocated >= newPositionBudget) return null;
        if (!isExisting && availablePortfolioSlots === 0 && !isRotationEntry) return null;

        const rawTargetValueEur = stableOpportunityPoolEur * Math.max(0.01, priority) / totalPriority;
        const assetCapValueEur = stableOpportunityPoolEur * maxAssetShare(decision.riskProfile, alert.level);
        const targetAssetValueEur = Math.max(0, Math.min(rawTargetValueEur, assetCapValueEur));
        const suggestedInitialFraction = Math.max(0, Math.min(1, alert.suggestedInitialFraction));
        const timingAuthorizedTargetEur = targetAssetValueEur * suggestedInitialFraction;
        const starterShare = starterPortfolioShare(decision.riskProfile, alert.timingState);
        const starterCapValueEur = totalPlannedCapitalEur * starterShare;
        const assetHealth = healthFor(healthMap, alert.assetId, alert.ticker, asset.isin);
        const confirmedBuild = isExisting
          && alert.timingState === 'ENTRY_STRONG'
          && assetHealth?.action === 'ADD'
          && currentAssetValueEur >= starterCapValueEur * 0.80;
        const portfolioShareCap = confirmedBuild ? buildPortfolioShare(decision.riskProfile) : starterShare;
        const portfolioCapValueEur = totalPlannedCapitalEur * portfolioShareCap;
        const executableTargetAssetValueEur = Math.max(0, Math.min(timingAuthorizedTargetEur, portfolioCapValueEur));
        const targetGapEur = Math.max(0, executableTargetAssetValueEur - currentAssetValueEur);
        const candidate = scan.candidates.find(row => row.asset.assetId === alert.assetId);
        const lastClose = candidate?.lastClose ?? null;
        const wholeShareFloorEur = instrumentType(asset) === 'ETF_ETC' && lastClose != null && lastClose > 0
          ? lastClose + brokerCommission(lastClose)
          : 0;
        const minimumMeaningfulGapEur = Math.max(executionPolicy.minimumOrderNotionalEur, wholeShareFloorEur);
        if (targetGapEur < minimumMeaningfulGapEur - 1e-9) return null;

        const alreadyInCategory = currentByCategory.get(asset.category) ?? 0;
        const alreadyAdded = categoryAdded.get(asset.category) ?? 0;
        const categoryCapacity = Math.max(0, categoryLimit - alreadyInCategory - alreadyAdded);
        const remainingBase = Math.max(0, baseDeployableToAssetsEur - allocatedBaseEur);
        const remainingRotation = Math.max(0, plannedRotationProceedsEur - allocatedRotationEur);
        const availableForRow = isRotationEntry ? remainingBase + remainingRotation : remainingBase;
        const amountEur = Math.max(0, Math.min(targetGapEur, categoryCapacity, availableForRow));
        if (amountEur < minimumMeaningfulGapEur - 1e-9) return null;

        const baseUse = Math.min(amountEur, remainingBase);
        allocatedBaseEur += baseUse;
        if (isRotationEntry) allocatedRotationEur += Math.max(0, amountEur - baseUse);
        categoryAdded.set(asset.category, alreadyAdded + amountEur);
        if (!isExisting) newPositionsAllocated++;
        const theoreticalGap = exposureByCategory.get(asset.category)?.gapEur ?? 0;
        const positionStage: ContributionPositionStage = isRotationEntry
          ? 'ROTATION_ENTRY'
          : confirmedBuild
            ? 'BUILD'
            : 'STARTER';
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
          currentAssetValueEur,
          targetAssetValueEur,
          executableTargetAssetValueEur,
          timingState: alert.timingState,
          suggestedInitialFraction,
          positionStage,
          portfolioShareCapPct: portfolioShareCap * 100,
          reason: `${positionStage === 'ROTATION_ENTRY' ? 'Entrada por rotación persistente' : positionStage === 'BUILD' ? 'Construcción confirmada' : 'Starter'}: ${alert.level === 'HIGH_CONVICTION' ? 'ALTA CONVICCIÓN' : alert.level === 'GOOD_ENTRY' ? 'buena oportunidad' : 'entrada válida'}, consenso ${alert.consensusScore >= 0 ? '+' : ''}${alert.consensusScore}, ${alert.favorableVotes}/5 favorables y ${alert.excessVsCashPctPoints?.toFixed(1) ?? 'N/D'} pp frente a cash. Objetivo estratégico ${targetAssetValueEur.toFixed(2)} €; timing ${alert.timingState} autoriza hasta ${(suggestedInitialFraction * 100).toFixed(0)}%, pero la etapa ${positionStage} limita la posición al ${portfolioShareCap * 100}% del patrimonio (${portfolioCapValueEur.toFixed(2)} €). Ya hay ${currentAssetValueEur.toFixed(2)} €; orden pendiente ${amountEur.toFixed(2)} €.`
        };
      });
      contributions = allocated.filter((row): row is ContributionRecommendation => row != null);
    }

    // A full-slot rotation is only valid if the paired challenger itself received an
    // executable contribution. Otherwise restore the incumbent and do not treat the
    // theoretical sale proceeds as deployable capital.
    for (const [challengerAssetId, restore] of rotationRestoreByChallenger) {
      const pairedContribution = contributions.find(row => row.assetId === challengerAssetId && row.positionStage === 'ROTATION_ENTRY');
      if (pairedContribution) continue;
      restore.row.action = restore.action;
      restore.row.reason = restore.reason;
      restore.row.suggestedReductionPct = restore.suggestedReductionPct;
      restore.row.rotationChallengerAssetId = null;
      restore.row.rotationChallengerTicker = null;
      restore.row.rotationAdvantageScore = null;
      restore.row.rotationChallengerRecentStrongCount = null;
      restore.row.rotationChallengerPersistenceLookbackSessions = null;
      plannedRotationProceedsEur = Math.max(0, plannedRotationProceedsEur - restore.proceedsEur);
      rotationActions = Math.max(0, rotationActions - 1);
      rotationChallengerIds.delete(challengerAssetId);
    }
    deployableToAssetsEur = baseDeployableToAssetsEur + plannedRotationProceedsEur;

    // No-opportunity means no operational new-money order. Theoretical target gaps remain
    // visible in exposures, but they must never be converted into a fallback purchase.
    contributions.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || b.amountEur - a.amountEur);
    const recommendedNewInvestmentEur = contributions.reduce((sum, row) => sum + row.amountEur, 0);
    const residualPlannedCashEur = Math.max(0, deployablePool + plannedRotationProceedsEur - recommendedNewInvestmentEur);
    const warnings: string[] = [];
    if (hasMissingValuation) warnings.push('Hay posiciones sin valoración REAL utilizable: se bloquea temporalmente la asignación de capital nuevo para no calcular el patrimonio como si esas posiciones valieran cero.');
    if (systemicStress) warnings.push(`Estrés sistémico de cartera: ${systemicDistressedCount}/${systemicHealthRows.length} posiciones observadas tienen consenso ≤-3 y ≥3 señales adversas. Los EXIT estructurales se convierten temporalmente en WATCH o REDUCE hasta el núcleo ENTRY_READY (${(systemicCoreShare * 100).toFixed(1)}%); se bloquea la rotación competitiva mientras persista esta amplitud.`);
    if (exposures.some(x => x.gapEur < -0.01)) warnings.push('Una sobreponderación por sí sola NO genera una venta. REDUCE/EXIT proceden de salud o de una rotación challenger/incumbent con ventaja material; nunca de peso aislado.');
    if (existingPositions.some(x => x.category === 'UNKNOWN' && x.currentValueEur != null)) warnings.push('Hay posiciones fuera del universo clasificado que se valoran y vigilan individualmente; no se inventa una categoría para forzar su peso objetivo.');
    warnings.push(`Cartera dinámica: máximo ${maxPortfolioPositions} plazas para riesgo ${decision.riskProfile}; ocupadas ${occupiedPortfolioPositions}, libres ${availablePortfolioSlots}. Nuevas plazas por evaluación: máximo ${newPositionDecisionLimit}.`);
    if (bootstrapDeploymentActive) warnings.push(`Despliegue inicial diversificado activo: la cartera está ${(investedShareOfPlanned * 100).toFixed(1)}% invertida (<${(BOOTSTRAP_INVESTED_SHARE_THRESHOLD * 100).toFixed(0)}%). Se amplía sólo el número de starters simultáneos; no cambian los caps individuales, el cash objetivo, consenso, timing, costes ni límites de categoría.`);
    warnings.push(`Sizing por etapas: ENTRY_READY/ENTRY_STRONG abren starters pequeños; en riesgo ${decision.riskProfile} los caps son ${(starterPortfolioShare(decision.riskProfile, 'ENTRY_READY') * 100).toFixed(1)}% / ${(starterPortfolioShare(decision.riskProfile, 'ENTRY_STRONG') * 100).toFixed(1)}%. Sólo una posición ya confirmada como ADD y todavía ENTRY_STRONG puede construir hasta ${(buildPortfolioShare(decision.riskProfile) * 100).toFixed(1)}%.`);
    warnings.push(`Persistencia de rotación: un challenger que quiera expulsar un incumbent debe ser ENTRY_STRONG hoy y haber sido ENTRY_STRONG al menos ${ROTATION_MIN_PRIOR_STRONG_OBSERVATIONS} veces en las ${ROTATION_PERSISTENCE_LOOKBACK_SESSIONS} sesiones previas. Esta exigencia no se aplica a entradas normales con cash/plaza libre.`);
    if (rotationActions > 0) warnings.push(`Rotación competitiva persistente 1:1 activa: ${rotationActions} incumbent(s) liberan realmente su plaza para challenger(s) con fuerza reciente repetida y ventaja material. Proceeds teóricos liberados: ${plannedRotationProceedsEur.toFixed(2)} €; la ejecución real sigue sujeta a comisión, fiscalidad y efectivo realmente obtenido.`);
    if (opportunities.length > 0) warnings.push(`La asignación efectiva usa oportunidades que pasan cash + consenso + timing. El 25%/50% sigue siendo techo por timing, pero ya no obliga a construir una posición grande: starter/build y plazas de cartera añaden límites más estrictos.`);
    else warnings.push('No hay oportunidades actuales que pasen el gate: no se genera ninguna compra fallback. Los pesos teóricos quedan sólo como diagnóstico.');

    return {
      currentInvestedValueEur,
      currentCashEur,
      pendingCapitalEur,
      totalPlannedCapitalEur,
      targetCashEur,
      deployableToAssetsEur,
      plannedRotationProceedsEur,
      maxPortfolioPositions,
      occupiedPortfolioPositions,
      availablePortfolioSlots,
      recommendedNewInvestmentEur,
      residualPlannedCashEur,
      exposures,
      existingPositions,
      contributions,
      warnings
    };
  }
}
