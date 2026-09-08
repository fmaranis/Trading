import { PortfolioCandidateGate } from './portfolioCandidateGate';
import { runDynamicReplayWithRotationExperiment } from './replayRotationPolicyExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type ReplayRunInput = Parameters<typeof runDynamicReplayWithRotationExperiment>[0];
type GateApply = typeof PortfolioCandidateGate.apply;

/**
 * SELECTION_QUALITY_V1 changes only the relative ranking of assets that already
 * pass REAL data, cash hurdle, BUY consensus and causal Entry Timing. Research
 * now runs on top of the same CORE_ARCHITECTURE_V1 used by the current replay so
 * the DÓNDE question is isolated without changing portfolio-management policy.
 *
 * No threshold is fitted to historical outcomes here. Reliability/Opportunity
 * scores use only the price prefix available at each replay date and the existing
 * gate remains mandatory.
 */
export function runDynamicReplayWithSelectionQualityExperiment(input: ReplayRunInput): DynamicHistoricalReplayResult {
  const originalApply = PortfolioCandidateGate.apply;
  try {
    PortfolioCandidateGate.apply = ((scan, cashBenchmarkAnnualPct, maxSelected = 12) =>
      originalApply.call(PortfolioCandidateGate, scan, cashBenchmarkAnnualPct, maxSelected, 'QUALITY_V1')) as GateApply;

    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    result.notes.push(
      'SELECTION_QUALITY_V1: mismo replay CORE_ARCHITECTURE_V1; sólo cambia el ranking entre candidatos que ya han pasado REAL + cash + consenso BUY + Entry Timing.',
      'ReliabilityScore prioriza persistencia histórica del prefijo (rolling 60/120, drawdown y volatilidad). OpportunityScore combina esa fiabilidad con momentum 20/60/120, aceleración y drawdown actual. No se cambia ningún gate, sizing ni regla de gestión de cartera.'
    );
    return result;
  } finally {
    PortfolioCandidateGate.apply = originalApply;
  }
}
