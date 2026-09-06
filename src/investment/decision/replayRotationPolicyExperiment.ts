import { DynamicHistoricalReplayEngine, type DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';
import {
  applyCoreAlphaV2,
  CORE_ALPHA_V2_LIMITS,
  CORE_ALPHA_V2_THRESHOLDS,
  type CoreAlphaV2Counters
} from './coreAlphaOverlay';
import {
  applyCoreArchitectureV1,
  applyCoreGateV1,
  CORE_ARCHITECTURE_V1_LIMITS,
  CORE_GATE_V1_THRESHOLDS,
  type CoreArchitectureV1Counters,
  type CoreGateV1Counters,
  type PortfolioEvaluationInput
} from './portfolioCoreGatePolicy';
import { selectDynamicCoreV1, type DynamicCoreCandidateScore } from './dynamicCoreSelector';
import { PortfolioDecisionEngine } from './portfolioDecisionEngine';

export type ReplayRotationExperiment = 'BASELINE' | 'CORE_GATE_V1' | 'CORE_ARCHITECTURE_V1' | 'CORE_ALPHA_V2';
type ReplayRunInput = Parameters<typeof DynamicHistoricalReplayEngine.run>[0];
type ReplaySignalWithAudit = DynamicHistoricalReplayResult['signals'][number] & { auditExtensions?: Record<string, unknown> };

export interface ReplayDynamicCoreSelectionAuditEntry {
  decisionDate: string;
  selectedAssetId: string | null;
  selectedTicker: string | null;
  incumbentAssetId: string | null;
  incumbentHealthy: boolean | null;
  reason: 'HEALTHY_INCUMBENT_INERTIA' | 'BEST_HEALTHY_CORE' | 'REPLACE_UNHEALTHY_INCUMBENT' | 'INCUMBENT_EVIDENCE_INSUFFICIENT' | 'NO_HEALTHY_CORE';
  candidates: DynamicCoreCandidateScore[];
}

export type DynamicReplayExperimentResult = DynamicHistoricalReplayResult & {
  coreSelectionAudit: ReplayDynamicCoreSelectionAuditEntry[];
};

/**
 * Replay policy wrapper.
 *
 * BASELINE, CORE_GATE_V1 and CORE_ARCHITECTURE_V1 remain available for
 * attribution. CORE_ALPHA_V2 is the bounded candidate that keeps V1 intact and
 * allows only small, exceptional, atomic core-funded alpha tilts.
 *
 * CORE_ARCHITECTURE_V1/CORE_ALPHA_V2 also export a decision-by-decision audit of
 * DYNAMIC_CORE_SELECTOR_V1 so the chosen structural core is never a hidden
 * implementation detail in historical validation.
 */
export function runDynamicReplayWithRotationExperiment(
  input: ReplayRunInput,
  experiment: ReplayRotationExperiment = 'BASELINE'
): DynamicReplayExperimentResult {
  if (experiment === 'BASELINE') {
    const result = DynamicHistoricalReplayEngine.run(input) as DynamicReplayExperimentResult;
    result.coreSelectionAudit = [];
    return result;
  }

  const originalEvaluate = PortfolioDecisionEngine.evaluate;
  const gateCounters: CoreGateV1Counters = { KEEP: 0, CORE: 0, CHALLENGER: 0 };
  const architectureCounters: CoreArchitectureV1Counters = {
    protectedCoreSales: 0,
    cappedNonCoreContributions: 0,
    salesReturnedToCore: 0,
    coreTopUps: 0
  };
  const alphaCounters: CoreAlphaV2Counters = {
    coreFundedTilts: 0,
    blockedNoExceptionalCandidate: 0,
    blockedCoreFloor: 0,
    blockedExistingFreshNonCoreOrder: 0
  };
  const coreSelectionAudit: ReplayDynamicCoreSelectionAuditEntry[] = [];

  try {
    PortfolioDecisionEngine.evaluate = ((evaluationInput: PortfolioEvaluationInput) => {
      const baseline = originalEvaluate.call(PortfolioDecisionEngine, evaluationInput);
      const gated = applyCoreGateV1(evaluationInput, baseline, gateCounters);
      if (experiment === 'CORE_GATE_V1') return gated;

      const selection = selectDynamicCoreV1(evaluationInput, gated);
      coreSelectionAudit.push({
        decisionDate: evaluationInput.decision.asOfDate,
        selectedAssetId: selection.selectedAssetId,
        selectedTicker: selection.selected?.asset.ticker ?? null,
        incumbentAssetId: selection.incumbentAssetId,
        incumbentHealthy: selection.incumbentHealthy,
        reason: selection.reason,
        candidates: selection.candidateScores.map(candidate => ({ ...candidate }))
      });

      const architecture = applyCoreArchitectureV1(evaluationInput, gated, architectureCounters);
      if (experiment !== 'CORE_ALPHA_V2') return architecture;

      // Never create a core REDUCE in the same decision where V1 already emitted
      // another funded order (including a core top-up/return-to-core). The replay
      // executor keys plans by asset, so this keeps every V2 tilt unambiguous and atomic.
      if (architecture.contributions.some(row => row.amountEur > 0.01)) {
        alphaCounters.blockedExistingFreshNonCoreOrder += 1;
        return architecture;
      }
      return applyCoreAlphaV2(evaluationInput, architecture, alphaCounters);
    }) as typeof PortfolioDecisionEngine.evaluate;

    const result = DynamicHistoricalReplayEngine.run(input) as DynamicReplayExperimentResult;
    result.coreSelectionAudit = coreSelectionAudit;

    // HistoricalReplayProgressivePanel intentionally persists a compact replay
    // schema and therefore does not retain unknown result-level fields. Keep a
    // copy on the same signal audit carrier channel already used by the worker
    // for structural-core/forward-risk diagnostics so JSON export cannot silently
    // lose the core decision trail.
    const auditCarrier = (
      result.signals.find(signal => signal.executed === true)
      ?? result.signals.find(signal => signal.action === 'REDUCE' || signal.action === 'EXIT')
      ?? result.signals.find(signal => signal.action === 'BUY' || signal.action === 'ADD')
      ?? result.signals[0]
    ) as ReplaySignalWithAudit | undefined;
    if (auditCarrier) {
      auditCarrier.auditExtensions = {
        ...(auditCarrier.auditExtensions ?? {}),
        coreSelectionAudit: coreSelectionAudit.map(entry => ({
          ...entry,
          candidates: entry.candidates.map(candidate => ({ ...candidate }))
        }))
      };
    }

    result.notes.push(
      `Replay CORE_GATE_V1 compartido: KEEP ${gateCounters.KEEP}, CORE ${gateCounters.CORE}, CHALLENGER ${gateCounters.CHALLENGER}.`,
      `CORE_GATE_V1: un incumbent todavía HOLD con consenso no negativo se conserva. El challenger sólo evita el core con evidencia excepcional causal (≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinPriorStrong}/10 STRONG previos, consenso ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinConsensus}, ventaja de score ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinScoreAdvantage} y ventaja frente a cash ≥${CORE_GATE_V1_THRESHOLDS.challengerExceptionMinCashAdvantagePctPoints} pp).`
    );

    if (experiment === 'CORE_ARCHITECTURE_V1' || experiment === 'CORE_ALPHA_V2') {
      const limits = CORE_ARCHITECTURE_V1_LIMITS[input.riskProfile];
      result.notes.push(
        `CORE_ARCHITECTURE_V1: core-sales tácticas protegidas ${architectureCounters.protectedCoreSales}, contribuciones no-core limitadas ${architectureCounters.cappedNonCoreContributions}, ventas devueltas a core ${architectureCounters.salesReturnedToCore}, top-ups de core ${architectureCounters.coreTopUps}.`,
        `Guardrails ${input.riskProfile}: no-core máximo ${(limits.maximumNonCoreShare * 100).toFixed(0)}%, cash operativo ${(limits.operationalCashReserveShare * 100).toFixed(0)}%. El core global no recibe EXIT táctico y el cash residual vuelve al core sano seleccionado causalmente.`,
        `Auditoría ${experiment}: ${coreSelectionAudit.length} decisiones de core exportadas en coreSelectionAudit con candidato elegido, incumbent, motivo y scores comparativos. Ninguna prioridad fija de producto participa en la selección productiva.`
      );
    }

    if (experiment === 'CORE_ALPHA_V2') {
      const limits = CORE_ALPHA_V2_LIMITS[input.riskProfile];
      result.notes.push(
        `CORE_ALPHA_V2 candidato: tilts core→alpha ejecutables ${alphaCounters.coreFundedTilts}; bloqueados sin candidato excepcional ${alphaCounters.blockedNoExceptionalCandidate}; bloqueados por core floor/capacidad ${alphaCounters.blockedCoreFloor}; bloqueados porque V1 ya había emitido una orden financiada ${alphaCounters.blockedExistingFreshNonCoreOrder}.`,
        `CORE_ALPHA_V2 ${input.riskProfile}: core floor ${(limits.coreFloorShare * 100).toFixed(0)}%, máximo tilt nuevo por decisión ${(limits.maxCoreFundedTiltSharePerDecision * 100).toFixed(0)}%. Se exige HIGH_CONVICTION + ENTRY_STRONG, ≥${CORE_ALPHA_V2_THRESHOLDS.minPriorStrongObservations}/${CORE_ALPHA_V2_THRESHOLDS.persistenceLookbackSessions} STRONG, consenso ≥${CORE_ALPHA_V2_THRESHOLDS.minConsensusScore}, ${CORE_ALPHA_V2_THRESHOLDS.minFavorableVotes}/5 favorables, ventaja de selección vs core ≥${CORE_ALPHA_V2_THRESHOLDS.minRelativeSelectionScoreAdvantage} y ventaja relativa frente a cash ≥${CORE_ALPHA_V2_THRESHOLDS.minExcessVsCashAdvantagePctPoints} pp.`
      );
    }
    return result;
  } finally {
    PortfolioDecisionEngine.evaluate = originalEvaluate;
  }
}
