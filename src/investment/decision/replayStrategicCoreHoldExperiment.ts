import { PortfolioDecisionEngine, type PortfolioDecisionResult, type PortfolioPositionDecision } from './portfolioDecisionEngine';
import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import {
  STRATEGIC_GROWTH_CORE_ASSET_IDS,
  isStrategicGrowthCoreAssetId,
  portfolioAssetRole
} from './portfolioAssetRole';
import { runDynamicReplayWithTrendProtectionV2Experiment } from './replayTrendProtectionV2Experiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];
type ReplayRunInput = Parameters<typeof runDynamicReplayWithTrendProtectionV2Experiment>[0];

export { isStrategicGrowthCoreAssetId } from './portfolioAssetRole';

function candidateForSnapshot(input: PortfolioEvaluationInput, snapshot: PortfolioPositionHealthSnapshot) {
  const keys = new Set([snapshot.key?.toUpperCase(), snapshot.tickerOrIsin?.toUpperCase()].filter(Boolean));
  return input.scan.candidates.find(row =>
    keys.has(row.asset.assetId.toUpperCase())
    || keys.has(row.asset.ticker.toUpperCase())
    || (row.asset.isin ? keys.has(row.asset.isin.toUpperCase()) : false)
  ) ?? null;
}

function candidateAssetIdForSnapshot(input: PortfolioEvaluationInput, snapshot: PortfolioPositionHealthSnapshot): string | null {
  return candidateForSnapshot(input, snapshot)?.asset.assetId ?? null;
}

export function adaptStrategicCoreHoldHealth(
  assetId: string | null | undefined,
  snapshot: PortfolioPositionHealthSnapshot
): PortfolioPositionHealthSnapshot {
  if (!isStrategicGrowthCoreAssetId(assetId)) return snapshot;

  const v2SellAuthorized = snapshot.reason.includes('[TREND_PROTECTION_V2:REDUCE]')
    || snapshot.reason.includes('[TREND_PROTECTION_V2:EXIT]')
    || snapshot.action === 'REDUCE'
    || snapshot.action === 'EXIT';
  if (!v2SellAuthorized) return snapshot;

  return {
    ...snapshot,
    action: 'WATCH',
    suggestedReductionPct: null,
    reason: `[PORTFOLIO_ROLE:STRATEGIC_GROWTH_CORE] [STRATEGIC_CORE_HOLD_V1] Core estratégico de crecimiento a largo plazo: la señal V2 se conserva como diagnóstico, pero no se materializa REDUCE/EXIT por deterioro de corto plazo. El capital existente permanece invertido; las reglas ordinarias de nuevas aportaciones siguen intactas. Señal observada: ${snapshot.reason}`
  };
}

function adaptStrategicCoreHealth(input: PortfolioEvaluationInput): PortfolioEvaluationInput {
  const transformed = new Map<PortfolioPositionHealthSnapshot, PortfolioPositionHealthSnapshot>();
  const next: Record<string, PortfolioPositionHealthSnapshot> = {};

  for (const [key, snapshot] of Object.entries(input.positionHealth ?? {})) {
    const cached = transformed.get(snapshot);
    if (cached) { next[key] = cached; continue; }
    const assetId = candidateAssetIdForSnapshot(input, snapshot);
    const adapted = adaptStrategicCoreHoldHealth(assetId, snapshot);
    transformed.set(snapshot, adapted);
    next[key] = adapted;
  }
  return { ...input, positionHealth: next };
}

function strategicAssetForPosition(input: PortfolioEvaluationInput, position: PortfolioPositionDecision) {
  if (position.assetId) return input.scan.candidates.find(row => row.asset.assetId === position.assetId)?.asset ?? null;
  const normalized = position.id?.toUpperCase();
  if (!normalized) return null;
  return input.scan.candidates.find(row =>
    row.asset.ticker.toUpperCase() === normalized
    || row.asset.isin?.toUpperCase() === normalized
  )?.asset ?? null;
}

function refreshPlanningTotals(result: PortfolioDecisionResult, oldRotationProceeds: number, oldRecommended: number): void {
  const newRotationProceeds = result.existingPositions
    .filter(position => position.action === 'EXIT' && position.rotationChallengerAssetId)
    .reduce((sum, position) => sum + Math.max(0, position.currentValueEur ?? 0), 0);
  const newRecommended = result.contributions.reduce((sum, row) => sum + Math.max(0, row.amountEur), 0);
  result.plannedRotationProceedsEur = newRotationProceeds;
  result.deployableToAssetsEur = Math.max(0, result.deployableToAssetsEur + newRotationProceeds - oldRotationProceeds);
  result.recommendedNewInvestmentEur = newRecommended;
  result.residualPlannedCashEur = Math.max(0, result.residualPlannedCashEur + (newRotationProceeds - oldRotationProceeds) - (newRecommended - oldRecommended));
}

function blockStrategicCoreRotations(input: PortfolioEvaluationInput, result: PortfolioDecisionResult): PortfolioDecisionResult {
  const oldRotationProceeds = result.plannedRotationProceedsEur;
  const oldRecommended = result.recommendedNewInvestmentEur;
  let changed = false;

  for (const position of result.existingPositions) {
    if (!position.rotationChallengerAssetId) continue;
    const asset = strategicAssetForPosition(input, position);
    if (!asset || portfolioAssetRole(asset) !== 'STRATEGIC_GROWTH_CORE') continue;

    const challengerAssetId = position.rotationChallengerAssetId;
    result.contributions = result.contributions.filter(row => !(row.assetId === challengerAssetId && row.positionStage === 'ROTATION_ENTRY'));
    position.action = 'HOLD';
    position.suggestedReductionPct = null;
    position.rotationChallengerAssetId = null;
    position.rotationChallengerTicker = null;
    position.rotationAdvantageScore = null;
    position.rotationChallengerRecentStrongCount = null;
    position.rotationChallengerPersistenceLookbackSessions = null;
    position.reason = `[PORTFOLIO_ROLE:STRATEGIC_GROWTH_CORE] [STRATEGIC_CORE_HOLD_V1] ${position.label} pertenece al core estratégico de crecimiento. Se bloquea la rotación competitiva de corto plazo; CORE_GATE_V1 puede seguir enviando capital DESDE otras posiciones hacia el core, pero no usar el propio core como fuente táctica de financiación.`;
    changed = true;
  }

  if (changed) refreshPlanningTotals(result, oldRotationProceeds, oldRecommended);
  return result;
}

export function runDynamicReplayWithStrategicCoreHoldExperiment(input: ReplayRunInput): DynamicHistoricalReplayResult {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const adaptedInput = adaptStrategicCoreHealth(evaluationInput);
      const result = originalEvaluate.call(PortfolioDecisionEngine, adaptedInput);
      return blockStrategicCoreRotations(adaptedInput, result);
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = runDynamicReplayWithTrendProtectionV2Experiment(input);
    result.notes.push(
      'STRATEGIC_CORE_HOLD_V1: validación causal del rol canónico STRATEGIC_GROWTH_CORE sobre TREND_PROTECTION_V2. CORE_GATE_V1 permanece intacto como destino de capital: las posiciones débiles pueden seguir rotando hacia el core global. La única diferencia es que el core estratégico ya acumulado no ejecuta REDUCE/EXIT ni rotación competitiva por deterioro de corto plazo.',
      `Core estratégico canónico: ${STRATEGIC_GROWTH_CORE_ASSET_IDS.join(', ')}. Regionales, bonos y satélites mantienen exactamente la lógica V2 vigente. No se ha modificado ningún threshold de MFE, giveback, streak, Entry Timing, STARTER/BUILD o challenger.`
    );
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
