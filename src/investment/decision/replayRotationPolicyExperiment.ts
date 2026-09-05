import { DynamicHistoricalReplayEngine, type DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';
import {
  applyCoreArchitectureV1,
  applyCoreGateV1,
  CORE_ARCHITECTURE_V1_LIMITS,
  CORE_GATE_V1_THRESHOLDS,
  type CoreArchitectureV1Counters,
  type CoreGateV1Counters,
  type PortfolioEvaluationInput
} from './portfolioCoreGatePolicy';
import { PortfolioDecisionEngine } from './portfolioDecisionEngine';

export type ReplayRotationExperiment = 'BASELINE' | 'CORE_GATE_V1' | 'CORE_ARCHITECTURE_V1';
type ReplayRunInput = Parameters<typeof DynamicHistoricalReplayEngine.run>[0];

/**
 * Replay policy wrapper.
 *
 * BASELINE and the old CORE_GATE_V1 remain available for attribution, but the
 * productive replay uses CORE_ARCHITECTURE_V1: exactly the same pure chain used
 * by evaluatePortfolioDecision in live portfolio decisions.
 */
export function runDynamicReplayWithRotationExperiment(
  input: ReplayRunInput,
  experiment: ReplayRotationExperiment = 'BASELINE'
): DynamicHistoricalReplayResult {
  if (experiment === 'BASELINE') return DynamicHistoricalReplayEngine.run(input);

  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const gateCounters: CoreGateV1Counters = { KEEP: 0, CORE: 0, CHALLENGER: 0 };
  const architectureCounters: CoreArchitectureV1Counters = {
    protectedCoreSales: 0,
    cappedNonCoreContributions: 0,
    salesReturnedToCore: 0,
    coreTopUps: 0
  };

  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const baseline = originalEvaluate.call(PortfolioDecisionEngine, evaluationInput);
      const gated = applyCoreGateV1(evaluationInput, baseline, gateCounters);
      return experiment === 'CORE_ARCHITECTURE_V1'
        ? applyCoreArchitectureV1(evaluationInput, gated, architectureCounters)
        : gated;
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = DynamicHistoricalReplayEngine.run(input);
    result.notes.push(
      `Replay CORE_GATE_V1 compartido: KEEP ${gateCounters.KEEP}, CORE ${gateCounters.CORE}, CHALLENGER ${gateCounters.CHALLENGER}. La política aplicada es la misma función CORE_GATE_V1 utilizada por la decisión productiva de cartera.`,
      `CORE_GATE_V1: un incumbent todavía HOLD con consenso no negativo se conserva. Si realmente está débil, el core global diversificado es el destino por defecto cuando supera cash y no presenta deterioro estructural. El challenger sólo evita el core con evidencia excepcional causal (≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong}/10 STRONG previos, consenso ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus}, ventaja de score ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage} y ventaja frente a cash ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints} pp).`
    );

    if (experiment === 'CORE_ARCHITECTURE_V1') {
      const limits = CORE_ARCHITECTURE_V1_LIMITS[input.riskProfile];
      result.notes.push(
        `CORE_ARCHITECTURE_V1 compartido: core-sales protegidas ${architectureCounters.protectedCoreSales}, contribuciones no-core limitadas ${architectureCounters.cappedNonCoreContributions}, ventas devueltas a core ${architectureCounters.salesReturnedToCore}, top-ups de core ${architectureCounters.coreTopUps}.`,
        `Guardrails ${input.riskProfile}: no-core máximo ${(limits.maximumNonCoreShare * 100).toFixed(0)}%, cash operativo ${(limits.operationalCashReserveShare * 100).toFixed(0)}%. El core global no recibe REDUCE/EXIT táctico y el cash residual por encima de esa reserva vuelve al core. No se persigue el índice regional ganador con el 100% del patrimonio.`
      );
    }
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
