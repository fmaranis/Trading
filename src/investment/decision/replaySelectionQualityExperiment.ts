import { PortfolioCandidateGate } from './portfolioCandidateGate';
import { runDynamicReplayWithStrategicCoreHoldExperiment } from './replayStrategicCoreHoldExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type ReplayRunInput = Parameters<typeof runDynamicReplayWithStrategicCoreHoldExperiment>[0];
type GateApply = typeof PortfolioCandidateGate.apply;

/**
 * SELECTION_QUALITY_V1 changes only the relative ranking of assets that already
 * pass REAL data, cash hurdle, BUY consensus and causal Entry Timing. It runs on
 * top of STRATEGIC_CORE_HOLD_V1 so the management architecture stays fixed while
 * we isolate the DÓNDE question.
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

    const result = runDynamicReplayWithStrategicCoreHoldExperiment(input);
    result.notes.push(
      'SELECTION_QUALITY_V1: mismo motor causal y misma gestión STRATEGIC_CORE_HOLD_V1; sólo cambia el ranking entre candidatos que ya han pasado REAL + cash + consenso BUY + Entry Timing.',
      'ReliabilityScore prioriza persistencia histórica del prefijo (rolling 60/120, drawdown y volatilidad). OpportunityScore combina esa fiabilidad con momentum 20/60/120, aceleración y drawdown actual. No se cambian todavía los caps STARTER/BUILD ni el suggestedInitialFraction de Entry Timing.'
    );
    return result;
  } finally {
    PortfolioCandidateGate.apply = originalApply;
  }
}
