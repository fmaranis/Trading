import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { buildCurrentVsCoreCausalAttribution } from '../investment/decision/causalReplayAttribution';
import { buildV2ReductionOutcomeAudit } from '../investment/decision/v2ReductionOutcomeAudit';
import { runDynamicReplayWithQualitySizingExperiment } from '../investment/decision/replayQualitySizingExperiment';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
import { runDynamicReplayWithSelectionQualityExperiment } from '../investment/decision/replaySelectionQualityExperiment';
import { runDynamicReplayWithSlopeSelectionExperiment } from '../investment/decision/replaySlopeSelectionExperiment';
import { runDynamicReplayWithStrategicCoreHoldExperiment } from '../investment/decision/replayStrategicCoreHoldExperiment';
import {
  runDynamicReplayWithTrendProtectionV2Experiment,
  runDynamicReplayWithTrendProtectionV2MediumTermWinnerConfirmExperiment
} from '../investment/decision/replayTrendProtectionV2Experiment';
import { buildTrendProtectionV2ReplayComparison } from '../investment/decision/trendProtectionReplayComparison';
import type { MultiAssetDataset } from '../investment/portfolioBacktesting/types';
import type { AssetUniverseItem } from '../investment/decision/assetUniverse';
import type { CashBenchmarkMode } from '../investment/decision/cashBenchmark';
import type { DynamicReplayFrequency } from '../investment/decision/dynamicHistoricalReplay';
import type { InvestmentHorizonYears, InvestorRiskProfile } from '../investment/decision/types';
import type { SpanishTaxSettings } from '../investment/decision/spanishTaxModel';

interface InitMessage {
  type: 'INIT';
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  startDate: string;
  frequency: DynamicReplayFrequency;
  initialCapitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  cashBenchmarkMode: CashBenchmarkMode;
  cashBenchmarkAnnualPct: number;
  minimumBars: number;
  taxSettings: SpanishTaxSettings;
}

interface RunMessage {
  type: 'RUN';
  endDate: string;
}

interface ResetMessage { type: 'RESET'; }
type IncomingMessage = InitMessage | RunMessage | ResetMessage;

interface WorkerScope {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage: (message: unknown) => void;
}

const workerScope = self as unknown as WorkerScope;
const REPLAY_ROTATION_EXPERIMENT = 'CORE_GATE_V1' as const;
const AUDIT_BROADCAST_CHANNEL = 'historical-replay-audit-v3';
let configuration: Omit<InitMessage, 'type' | 'dataset'> | null = null;
let sourceDataset: MultiAssetDataset | null = null;

function truncateDataset(dataset: MultiAssetDataset, endDate: string): MultiAssetDataset {
  return {
    ...dataset,
    assets: dataset.assets
      .map(asset => ({
        ...asset,
        bars: asset.bars.filter(bar => bar.timestamp.slice(0, 10) <= endDate)
      }))
      .filter(asset => asset.bars.length > 0)
  };
}

function latestDatasetDate(dataset: MultiAssetDataset): string | null {
  const dates = dataset.assets.flatMap(asset => asset.bars.slice(-1).map(bar => bar.timestamp.slice(0, 10))).sort();
  return dates.at(-1) ?? null;
}

function replayInput(dataset: MultiAssetDataset) {
  if (!configuration) throw new Error('AUDIT_WORKER_NOT_INITIALIZED');
  return {
    dataset,
    catalog: configuration.catalog,
    startDate: configuration.startDate,
    frequency: configuration.frequency,
    initialCapitalEur: configuration.initialCapitalEur,
    riskProfile: configuration.riskProfile,
    horizonYears: configuration.horizonYears,
    cashBenchmarkMode: configuration.cashBenchmarkMode,
    cashBenchmarkAnnualPct: configuration.cashBenchmarkAnnualPct,
    minimumBars: configuration.minimumBars,
    taxSettings: configuration.taxSettings
  };
}

function persistCounterfactualInAuditSignal(result: any): void {
  const counterfactual = result?.trendProtectionV2Counterfactual;
  if (!counterfactual) return;

  const auditSignal = result.signals?.[0];
  if (auditSignal) {
    auditSignal.auditExtensions = {
      ...(auditSignal.auditExtensions ?? {}),
      trendProtectionV2Counterfactual: counterfactual
    };
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUDIT_BROADCAST_CHANNEL);
      channel.postMessage({ type: 'TREND_PROTECTION_V2_COUNTERFACTUAL', counterfactual });
      channel.close();
    }
  } catch {
    // UI refresh is optional; persistence above is authoritative.
  }
}

function armDelta(reference: ReturnType<typeof buildTrendProtectionV2ReplayComparison>, candidate: ReturnType<typeof buildTrendProtectionV2ReplayComparison>) {
  return {
    finalValueEur: candidate.finalValueEur - reference.finalValueEur,
    returnPctPoints: candidate.totalReturnPct - reference.totalReturnPct,
    maxDrawdownPctPoints: candidate.maxDrawdownPct - reference.maxDrawdownPct,
    feesEur: candidate.totalFeesEur - reference.totalFeesEur,
    estimatedTaxEur: candidate.totalEstimatedTaxEur - reference.totalEstimatedTaxEur,
    turnoverEur: candidate.turnoverEur - reference.turnoverEur
  };
}

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;

  if (message.type === 'RESET') {
    configuration = null;
    sourceDataset = null;
    workerScope.postMessage({ type: 'RESET_DONE' });
    return;
  }

  if (message.type === 'INIT') {
    const { dataset, type: _type, ...rest } = message;
    sourceDataset = dataset;
    configuration = rest;
    workerScope.postMessage({ type: 'READY', rotationExperiment: REPLAY_ROTATION_EXPERIMENT });
    return;
  }

  if (!configuration || !sourceDataset) {
    workerScope.postMessage({ type: 'ERROR', error: 'AUDIT_WORKER_NOT_INITIALIZED' });
    return;
  }

  try {
    const dataset = truncateDataset(sourceDataset, message.endDate);
    const input = replayInput(dataset);
    let result = appendRotationCounterfactualAudit({
      result: runDynamicReplayWithRotationExperiment(input, REPLAY_ROTATION_EXPERIMENT),
      dataset,
      catalog: configuration.catalog
    });

    const sourceEndDate = latestDatasetDate(sourceDataset);
    const isFinalCheckpoint = sourceEndDate != null && message.endDate >= sourceEndDate;
    if (isFinalCheckpoint) {
      const v2Replay = runDynamicReplayWithTrendProtectionV2Experiment(input);
      const v2Comparison = buildTrendProtectionV2ReplayComparison({ baseline: result, v2: v2Replay, riskProfile: configuration.riskProfile });
      const v2ReductionOutcomeAudit = buildV2ReductionOutcomeAudit({ dataset, v2Comparison });

      const mediumTermWinnerConfirmReplay = runDynamicReplayWithTrendProtectionV2MediumTermWinnerConfirmExperiment(input);
      const mediumTermWinnerConfirmComparison = buildTrendProtectionV2ReplayComparison({
        baseline: result,
        v2: mediumTermWinnerConfirmReplay,
        riskProfile: configuration.riskProfile
      });

      const strategicCoreReplay = runDynamicReplayWithStrategicCoreHoldExperiment(input);
      const strategicCoreComparison = buildTrendProtectionV2ReplayComparison({ baseline: result, v2: strategicCoreReplay, riskProfile: configuration.riskProfile });
      const currentVsCoreAttribution = buildCurrentVsCoreCausalAttribution({
        current: result,
        trendProtectionV2: v2Replay,
        strategicCore: strategicCoreReplay
      });

      const selectionQualityReplay = runDynamicReplayWithSelectionQualityExperiment(input);
      const selectionQualityComparison = buildTrendProtectionV2ReplayComparison({ baseline: result, v2: selectionQualityReplay, riskProfile: configuration.riskProfile });

      const qualitySizingReplay = runDynamicReplayWithQualitySizingExperiment(input);
      const qualitySizingComparison = buildTrendProtectionV2ReplayComparison({ baseline: result, v2: qualitySizingReplay, riskProfile: configuration.riskProfile });

      const slopeSelectionReplay = runDynamicReplayWithSlopeSelectionExperiment(input);
      const slopeSelectionComparison = buildTrendProtectionV2ReplayComparison({ baseline: result, v2: slopeSelectionReplay, riskProfile: configuration.riskProfile });

      result.trendProtectionV2Counterfactual = {
        ...v2Comparison,
        currentVsCoreAttribution,
        v2ReductionOutcomeAudit,
        mediumTermWinnerConfirmExperiment: {
          ...mediumTermWinnerConfirmComparison,
          policy: 'TREND_PROTECTION_V2_MEDIUM_TERM_WINNER_CONFIRM',
          methodology: 'FULL_CAUSAL_REPLAY_V2_PLUS_MEDIUM_TERM_CONFIRM_FOR_WINNER_REDUCE_ONLY',
          deltaVsTrendProtectionV2: armDelta(v2Comparison, mediumTermWinnerConfirmComparison),
          deltaVsStrategicCoreHold: armDelta(strategicCoreComparison, mediumTermWinnerConfirmComparison),
          notes: [
            ...mediumTermWinnerConfirmComparison.notes,
            'Experimento dirigido: sólo intercepta REDUCE de winner-protection. Si slope60 sigue positiva y el consenso sigue constructivo (consenso >0 y <2 votos adversos), conserva PROTECT. LOSER_FAILURE, hard EXIT, reclaim, sizing, selección, cash y CORE_GATE permanecen idénticos.'
          ]
        },
        strategicCoreHoldExperiment: {
          ...strategicCoreComparison,
          policy: 'STRATEGIC_CORE_HOLD_V1',
          methodology: 'FULL_CAUSAL_REPLAY_SAME_ENGINE_V2_WITH_STRATEGIC_CORE_NO_SELL',
          deltaVsTrendProtectionV2: armDelta(v2Comparison, strategicCoreComparison),
          notes: [
            ...strategicCoreComparison.notes,
            'STRATEGIC_CORE_HOLD_V1 conserva CURRENT_POLICY y TREND_PROTECTION_V2 sin cambios y modifica una sola semántica: el core estratégico de crecimiento ya acumulado no se vende ni rota por deterioro de corto plazo. CORE_GATE_V1 sigue enviando capital desde posiciones débiles hacia ese core.'
          ]
        },
        selectionQualityExperiment: {
          ...selectionQualityComparison,
          policy: 'SELECTION_QUALITY_V1',
          methodology: 'FULL_CAUSAL_REPLAY_STRATEGIC_CORE_HOLD_PLUS_CAUSAL_SELECTION_QUALITY_RANKING',
          deltaVsStrategicCoreHold: armDelta(strategicCoreComparison, selectionQualityComparison),
          deltaVsTrendProtectionV2: armDelta(v2Comparison, selectionQualityComparison),
          notes: [
            ...selectionQualityComparison.notes,
            'SELECTION_QUALITY_V1 cambia únicamente el ranking relativo de candidatos ya elegibles mediante ReliabilityScore + OpportunityScore causales. STARTER/BUILD, Entry Timing, cash, slots, CORE_GATE y protección permanecen congelados.'
          ]
        },
        qualitySizingExperiment: {
          ...qualitySizingComparison,
          policy: 'QUALITY_SIZING_V1',
          methodology: 'FULL_CAUSAL_REPLAY_STRATEGIC_CORE_HOLD_PLUS_CAUSAL_QUALITY_SIZING_LEGACY_SELECTION',
          deltaVsStrategicCoreHold: armDelta(strategicCoreComparison, qualitySizingComparison),
          deltaVsSelectionQuality: armDelta(selectionQualityComparison, qualitySizingComparison),
          deltaVsTrendProtectionV2: armDelta(v2Comparison, qualitySizingComparison),
          notes: [
            ...qualitySizingComparison.notes,
            'QUALITY_SIZING_V1 mantiene ranking LEGACY y STRATEGIC_CORE_HOLD_V1, y sólo modula caps STARTER/BUILD según un composite causal Reliability/Opportunity. Se conserva como experimento diagnóstico; no está promocionado.'
          ]
        },
        slopeSelectionExperiment: {
          ...slopeSelectionComparison,
          policy: 'SELECTION_SLOPE_V1',
          methodology: 'FULL_CAUSAL_REPLAY_STRATEGIC_CORE_HOLD_PLUS_BOUNDED_MULTI_HORIZON_SLOPE_RANKING_LEGACY_SIZING',
          deltaVsStrategicCoreHold: armDelta(strategicCoreComparison, slopeSelectionComparison),
          deltaVsSelectionQuality: armDelta(selectionQualityComparison, slopeSelectionComparison),
          deltaVsQualitySizing: armDelta(qualitySizingComparison, slopeSelectionComparison),
          deltaVsTrendProtectionV2: armDelta(v2Comparison, slopeSelectionComparison),
          notes: [
            ...slopeSelectionComparison.notes,
            'SELECTION_SLOPE_V1 es un brazo aislado de DÓNDE: sizing LEGACY y gestión STRATEGIC_CORE_HOLD_V1 permanecen congelados. Sólo añade al ranking un ajuste acotado por pendientes 20/60/120, aceleración y SMA20/SMA50 ya calculadas causalmente.'
          ]
        }
      } as any;
      result.notes.push(
        'A/B principal basado en FULL_CAUSAL_REPLAY: todos los brazos son carteras ejecutables y la divergencia posterior es una consecuencia económica causal.',
        'CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1 no añade otro brazo: descompone exactamente CORE−CURRENT en efecto V2 + efecto incremental STRATEGIC_CORE_HOLD y registra primera divergencia, diferencias por activo y uso de cash.',
        'V2_REDUCTION_OUTCOME_AUDIT_V1 es exclusivamente ex post: usa precios posteriores para auditar REDUCE ya ejecutados (20/60 sesiones y fin de replay) y está prohibido usarlo como input causal del motor.',
        'TREND_PROTECTION_V2_MEDIUM_TERM_WINNER_CONFIRM es un único A/B dirigido: el corto plazo puede armar PROTECT, pero un REDUCE de ganador exige también deterioro 60d o del consenso.',
        'Tercer brazo STRATEGIC_CORE_HOLD_V1: conserva el core estratégico acumulado frente a ventas/rotaciones tácticas cortas.',
        'Cuarto brazo SELECTION_QUALITY_V1: ReliabilityScore + OpportunityScore sólo para ranking.',
        'Quinto brazo QUALITY_SIZING_V1: ranking LEGACY con sizing conservador por quality; permanece diagnóstico tras resultados OOS mixtos.',
        'Sexto brazo SELECTION_SLOPE_V1: ranking LEGACY + ajuste de slope quality acotado; sizing LEGACY sin cambios.'
      );
      persistCounterfactualInAuditSignal(result);
    }

    workerScope.postMessage({
      type: 'RESULT',
      requestedEndDate: message.endDate,
      result,
      rotationExperiment: REPLAY_ROTATION_EXPERIMENT,
      trendProtectionV2Counterfactual: isFinalCheckpoint
    });
  } catch (error: any) {
    workerScope.postMessage({ type: 'ERROR', error: error?.message || String(error), requestedEndDate: message.endDate });
  }
};
