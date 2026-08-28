import type { BrokerExecutionPlan } from './brokerExecution';

export type ExecutionFidelityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ExecutionFidelityResult {
  score: number;
  level: ExecutionFidelityLevel;
  allocationDistancePct: number;
  targetWeightCoveragePct: number;
  executableTargetCount: number;
  targetCount: number;
  theoreticalCashWeightPct: number;
  executedCashWeightPct: number;
  cashDeviationPct: number;
  reasons: string[];
}

export function assessExecutionFidelity(
  capitalEur: number,
  allocations: Array<{ assetId: string; ticker: string; weight: number }>,
  theoreticalCashWeight: number,
  plan: BrokerExecutionPlan
): ExecutionFidelityResult {
  const capital = Math.max(0, capitalEur);
  const targets = allocations.filter(a => a.weight > 0.000001);
  const actualById = Object.fromEntries(
    plan.orders
      .filter(o => o.executable && o.grossNotionalEur > 0)
      .map(o => [o.assetId, capital > 0 ? o.grossNotionalEur / capital : 0])
  );
  const executableIds = new Set(plan.orders.filter(o => o.executable && o.grossNotionalEur > 0).map(o => o.assetId));

  const theoreticalCash = Math.max(0, Math.min(1, theoreticalCashWeight));
  const executedCash = capital > 0 ? Math.max(0, Math.min(1, plan.residualCashEur / capital)) : 1;
  const assetDistance = targets.reduce((sum, a) => sum + Math.abs(a.weight - (actualById[a.assetId] ?? 0)), 0);
  const cashDistance = Math.abs(theoreticalCash - executedCash);
  const allocationDistance = Math.min(1, (assetDistance + cashDistance) / 2);
  const targetWeightTotal = targets.reduce((s, a) => s + a.weight, 0);
  const coveredWeight = targets.filter(a => executableIds.has(a.assetId)).reduce((s, a) => s + a.weight, 0);
  const targetWeightCoveragePct = targetWeightTotal > 0 ? coveredWeight / targetWeightTotal * 100 : 100;
  const executableTargetCount = targets.filter(a => executableIds.has(a.assetId)).length;

  // Distance is the primary penalty; incomplete target coverage is a secondary penalty.
  const rawScore = 100 - allocationDistance * 75 - (100 - targetWeightCoveragePct) * 0.25;
  const score = Math.max(0, Math.min(100, rawScore));
  const level: ExecutionFidelityLevel = score >= 85 ? 'HIGH' : score >= 65 ? 'MEDIUM' : 'LOW';
  const reasons: string[] = [];
  if (!plan.executable) reasons.push('NO_EXECUTABLE_ORDER');
  if (targetWeightCoveragePct < 75) reasons.push(`LOW_TARGET_COVERAGE:${targetWeightCoveragePct.toFixed(1)}%`);
  if (allocationDistance * 100 > 20) reasons.push(`HIGH_ALLOCATION_DISTANCE:${(allocationDistance * 100).toFixed(1)}%`);
  if (Math.abs(theoreticalCash - executedCash) * 100 > 15) reasons.push(`HIGH_CASH_DEVIATION:${(Math.abs(theoreticalCash - executedCash) * 100).toFixed(1)}pp`);

  return {
    score,
    level,
    allocationDistancePct: allocationDistance * 100,
    targetWeightCoveragePct,
    executableTargetCount,
    targetCount: targets.length,
    theoreticalCashWeightPct: theoreticalCash * 100,
    executedCashWeightPct: executedCash * 100,
    cashDeviationPct: Math.abs(theoreticalCash - executedCash) * 100,
    reasons
  };
}
