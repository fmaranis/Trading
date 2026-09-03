import { DynamicHistoricalReplayEngine, type DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';
import {
  applyCoreGateV1,
  CORE_GATE_V1_THRESHOLDS,
  type CoreGateV1Counters,
  type PortfolioEvaluationInput
} from './portfolioCoreGatePolicy';
import { PortfolioDecisionEngine } from './portfolioDecisionEngine';

export type ReplayRotationExperiment = 'BASELINE' | 'CORE_GATE_V1';
type ReplayRunInput = Parameters<typeof DynamicHistoricalReplayEngine.run>[0];

/**
 * Replay A/B wrapper.
 *
 * CORE_GATE_V1 ya no vive aquí: esta capa únicamente inyecta en el replay la
 * misma política compartida que usa la cartera productiva. BASELINE se conserva
 * para comparaciones históricas antiguas y atribución causal.
 */
export function runDynamicReplayWithRotationExperiment(
  input: ReplayRunInput,
  experiment: ReplayRotationExperiment = 'BASELINE'
): DynamicHistoricalReplayResult {
  if (experiment === 'BASELINE') return DynamicHistoricalReplayEngine.run(input);

  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const counters: CoreGateV1Counters = { KEEP: 0, CORE: 0, CHALLENGER: 0 };
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const baseline = originalEvaluate.call(PortfolioDecisionEngine, evaluationInput);
      return applyCoreGateV1(evaluationInput, baseline, counters);
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = DynamicHistoricalReplayEngine.run(input);
    result.notes.push(
      `Replay CORE_GATE_V1 compartido: KEEP ${counters.KEEP}, CORE ${counters.CORE}, CHALLENGER ${counters.CHALLENGER}. La política aplicada es la misma función CORE_GATE_V1 utilizada por la decisión productiva de cartera.`,
      `CORE_GATE_V1: un incumbent todavía HOLD con consenso no negativo se conserva. Si realmente está débil, el core global diversificado es el destino por defecto cuando supera cash y no presenta deterioro estructural. El challenger sólo evita el core con evidencia excepcional causal (≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong}/10 STRONG previos, consenso ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus}, ventaja de score ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage} y ventaja frente a cash ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints} pp).`
    );
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
