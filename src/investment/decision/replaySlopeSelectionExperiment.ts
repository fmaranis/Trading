import { PortfolioCandidateGate } from './portfolioCandidateGate';
import { runDynamicReplayWithStrategicCoreHoldExperiment } from './replayStrategicCoreHoldExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type ReplayRunInput = Parameters<typeof runDynamicReplayWithStrategicCoreHoldExperiment>[0];
type GateApply = typeof PortfolioCandidateGate.apply;

/**
 * SELECTION_SLOPE_V1 isolates the DÓNDE question using the existing causal
 * trend-structure diagnostics. It keeps LEGACY sizing and STRATEGIC_CORE_HOLD_V1
 * management fixed; only the relative rank of already-eligible candidates gets
 * a bounded slope-quality adjustment.
 */
export function runDynamicReplayWithSlopeSelectionExperiment(input: ReplayRunInput): DynamicHistoricalReplayResult {
  const originalApply = PortfolioCandidateGate.apply;
  try {
    PortfolioCandidateGate.apply = ((scan, cashBenchmarkAnnualPct, maxSelected = 12) =>
      originalApply.call(PortfolioCandidateGate, scan, cashBenchmarkAnnualPct, maxSelected, 'SLOPE_V1')) as GateApply;

    const result = runDynamicReplayWithStrategicCoreHoldExperiment(input);
    result.notes.push(
      'SELECTION_SLOPE_V1: mismo motor causal, mismo sizing LEGACY y misma gestión STRATEGIC_CORE_HOLD_V1; sólo cambia el ranking entre candidatos que ya han pasado REAL + cash + consenso BUY + Entry Timing.',
      'SlopeQuality usa las pendientes de regresión log-precio 20/60/120, aceleración 20-vs-60 y pendientes SMA20/SMA50 ya calculadas por StrategyConsensusEngine. El ajuste queda acotado a ±10 puntos y no introduce nuevos gates.'
    );
    return result;
  } finally {
    PortfolioCandidateGate.apply = originalApply;
  }
}
