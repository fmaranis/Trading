import type { PortfolioPositionHealthSnapshot } from './portfolioPositionHealth';
import { isStrategicGrowthCoreAssetId } from './portfolioAssetRole';

export const STRATEGIC_CORE_POLICY = 'STRATEGIC_CORE_HOLD_V1' as const;

export function strategicCoreBlocksTacticalRotation(assetId: string | null | undefined): boolean {
  return isStrategicGrowthCoreAssetId(assetId);
}

/**
 * Strategic-growth-core policy boundary.
 *
 * Short-horizon trend/health deterioration remains visible as a diagnostic but
 * is not itself a sufficient thesis to crystallize a REDUCE/EXIT in the
 * structural market core. A future structural-exit policy must be separate and
 * explicit rather than smuggled through the tactical trend state machine.
 */
export function applyStrategicCoreShortTermProtection(
  assetId: string | null | undefined,
  snapshot: PortfolioPositionHealthSnapshot
): PortfolioPositionHealthSnapshot {
  if (!isStrategicGrowthCoreAssetId(assetId)) return snapshot;

  const tacticalSellAuthorized = snapshot.reason.includes('[TREND_PROTECTION_V2:REDUCE]')
    || snapshot.reason.includes('[TREND_PROTECTION_V2:EXIT]')
    || snapshot.action === 'REDUCE'
    || snapshot.action === 'EXIT';
  if (!tacticalSellAuthorized) return snapshot;

  return {
    ...snapshot,
    action: 'WATCH',
    suggestedReductionPct: null,
    reason: `[PORTFOLIO_ROLE:STRATEGIC_GROWTH_CORE] [${STRATEGIC_CORE_POLICY}] Core estratégico de crecimiento a largo plazo: la señal táctica se conserva como diagnóstico, pero no se materializa REDUCE/EXIT por deterioro de corto plazo. Una eventual salida del core requiere una tesis estructural independiente. Señal observada: ${snapshot.reason}`
  };
}
