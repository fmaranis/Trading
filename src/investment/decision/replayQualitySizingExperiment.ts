import { PortfolioDecisionEngine } from './portfolioDecisionEngine';
import { applyQualitySizingOverlay } from './qualitySizingPolicy';
import { runDynamicReplayWithStrategicCoreHoldExperiment } from './replayStrategicCoreHoldExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type ReplayRunInput = Parameters<typeof runDynamicReplayWithStrategicCoreHoldExperiment>[0];
type PortfolioEvaluationInput = Parameters<typeof PortfolioDecisionEngine.evaluate>[0];

/**
 * QUALITY_SIZING_V1 isolates CUÁNTO from DÓNDE.
 *
 * Candidate selection remains LEGACY and management remains
 * STRATEGIC_CORE_HOLD_V1. The only intervention is a conservative post-allocation
 * overlay on STARTER/BUILD sizes using causal ReliabilityScore/OpportunityScore.
 * Existing caps can only stay equal or shrink; ROTATION_ENTRY is untouched.
 */
export function runDynamicReplayWithQualitySizingExperiment(input: ReplayRunInput): DynamicHistoricalReplayResult {
  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const result = originalEvaluate.call(PortfolioDecisionEngine, evaluationInput);
      return applyQualitySizingOverlay({ result, scan: evaluationInput.scan });
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = runDynamicReplayWithStrategicCoreHoldExperiment(input);
    result.notes.push(
      'QUALITY_SIZING_V1: quinto brazo causal y experimento aislado de CUÁNTO. Mantiene selección LEGACY, Entry Timing, CORE_GATE, slots, Trend Protection y STRATEGIC_CORE_HOLD_V1; sólo reduce STARTER/BUILD cuando Reliability/Opportunity no justifican usar todo el importe previamente autorizado.',
      'Sizing conservador por composite causal 45% Reliability + 55% Opportunity: >=80 usa 100% del cap preexistente; >=70 90%; >=60 80%; <60 65%. Nunca amplifica un cap y ROTATION_ENTRY no se modifica. Quality no disponible conserva LEGACY de forma explícita y auditable.'
    );
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
