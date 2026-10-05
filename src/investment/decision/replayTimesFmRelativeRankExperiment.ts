import { PortfolioCandidateGate, type CandidateSelectionContext, type TimesFmRelativeRankEvidence } from './portfolioCandidateGate';
import { PortfolioDecisionEngine } from './portfolioDecisionEngine';
import { runDynamicReplayWithRotationExperiment } from './replayRotationPolicyExperiment';
import type { DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';

type ReplayRunInput = Parameters<typeof runDynamicReplayWithRotationExperiment>[0];
type GateApply = typeof PortfolioCandidateGate.apply;
type PortfolioEvaluate = typeof PortfolioDecisionEngine.evaluate;

export interface TimesFmRelativeRankEvidenceByDate {
  [informationDate: string]: TimesFmRelativeRankEvidence[];
}

function scanInformationDate(scan: Parameters<GateApply>[0]): string {
  const dates = scan.candidates.map(row => row.asOfDate).filter(Boolean).sort();
  const date = dates.at(-1);
  if (!date) throw new Error('TIMESFM_RELATIVE_RANK_V1_SCAN_DATE_MISSING');
  return date;
}

function contextForDate(evidenceByDate: TimesFmRelativeRankEvidenceByDate, informationDate: string): CandidateSelectionContext {
  const evidence = evidenceByDate[informationDate];
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error('TIMESFM_RELATIVE_RANK_V1_DATE_EVIDENCE_MISSING:' + informationDate);
  }
  return { timesFmRelativeRankEvidence: evidence };
}

/**
 * Research-only economic shadow.
 *
 * This uses the exact CORE_ARCHITECTURE_V1 replay and exact production classes.
 * The only intervention is the ordering among candidates that already pass
 * REAL + cash + BUY consensus + EntryTiming. TimesFM rank cannot open a gate,
 * modify target cash, sizing, costs, taxation, execution timing or portfolio
 * risk controls. Missing frozen forecast evidence fails closed.
 */
export function runDynamicReplayWithTimesFmRelativeRankV1(
  input: ReplayRunInput,
  evidenceByDate: TimesFmRelativeRankEvidenceByDate
): DynamicHistoricalReplayResult {
  const originalApply = PortfolioCandidateGate.apply;
  const originalEvaluate = PortfolioDecisionEngine.evaluate;

  try {
    PortfolioCandidateGate.apply = ((scan, cashBenchmarkAnnualPct, maxSelected = 12, policy = 'LEGACY', selectionContext = {}) => {
      const informationDate = scanInformationDate(scan);
      const context = policy === 'TIMESFM_RELATIVE_RANK_V1' && selectionContext.timesFmRelativeRankEvidence?.length
        ? selectionContext
        : contextForDate(evidenceByDate, informationDate);
      return originalApply.call(
        PortfolioCandidateGate,
        scan,
        cashBenchmarkAnnualPct,
        maxSelected,
        'TIMESFM_RELATIVE_RANK_V1',
        context
      );
    }) as GateApply;

    PortfolioDecisionEngine.evaluate = ((portfolioInput) => {
      const informationDate = portfolioInput.decision.asOfDate || scanInformationDate(portfolioInput.scan);
      return originalEvaluate.call(PortfolioDecisionEngine, {
        ...portfolioInput,
        candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1',
        candidateSelectionContext: contextForDate(evidenceByDate, informationDate)
      });
    }) as PortfolioEvaluate;

    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    result.notes.push(
      'TIMESFM_RELATIVE_RANK_V1 shadow: mismo replay CORE_ARCHITECTURE_V1, misma ejecución NEXT_OPEN, cash, sizing, caps, costes y fiscalidad. Sólo cambia el orden ordinal 20/60 entre candidatos ya elegibles.',
      'La evidencia TimesFM debe existir para todos los candidatos elegibles en cada informationDate; ausencia de forecast => FAIL CLOSED. Producción permanece LEGACY.'
    );
    return result;
  } finally {
    PortfolioCandidateGate.apply = originalApply;
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}


/**
 * Post-hoc architecture diagnostic only.
 * Materially different from TIMESFM_RELATIVE_RANK_V1: TimesFM receives ordering
 * authority at the allocator queue, but not sizing authority. LEGACY still computes
 * opportunity priority magnitudes/targets; TimesFM only decides which already-eligible
 * rows consume scarce slots/base deployable cash first.
 */
export function runDynamicReplayWithTimesFmAllocationBridgeV1(
  input: ReplayRunInput,
  evidenceByDate: TimesFmRelativeRankEvidenceByDate
): DynamicHistoricalReplayResult {
  const originalApply = PortfolioCandidateGate.apply;
  const originalEvaluate = PortfolioDecisionEngine.evaluate;

  try {
    PortfolioCandidateGate.apply = ((scan, cashBenchmarkAnnualPct, maxSelected = 12, policy = 'LEGACY', selectionContext = {}) => {
      const informationDate = scanInformationDate(scan);
      const context = policy === 'TIMESFM_RELATIVE_RANK_V1' && selectionContext.timesFmRelativeRankEvidence?.length
        ? selectionContext
        : contextForDate(evidenceByDate, informationDate);
      return originalApply.call(
        PortfolioCandidateGate,
        scan,
        cashBenchmarkAnnualPct,
        maxSelected,
        'TIMESFM_RELATIVE_RANK_V1',
        context
      );
    }) as GateApply;

    PortfolioDecisionEngine.evaluate = ((portfolioInput) => {
      const informationDate = portfolioInput.decision.asOfDate || scanInformationDate(portfolioInput.scan);
      return originalEvaluate.call(PortfolioDecisionEngine, {
        ...portfolioInput,
        candidateSelectionPolicy: 'TIMESFM_RELATIVE_RANK_V1',
        candidateSelectionContext: contextForDate(evidenceByDate, informationDate),
        opportunityAllocationPolicy: 'TIMESFM_ALLOCATION_BRIDGE_V1'
      });
    }) as PortfolioEvaluate;

    const result = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
    result.notes.push(
      'TIMESFM_ALLOCATION_BRIDGE_V1 POST-HOC ARCHITECTURE DIAGNOSTIC: TimesFM ordena únicamente el consumo de slots/cash entre oportunidades ya elegibles.',
      'Sizing/targets permanecen calculados por la prioridad económica LEGACY. Sin autoridad de producción ni promoción sobre esta muestra consumida.'
    );
    return result;
  } finally {
    PortfolioCandidateGate.apply = originalApply;
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
