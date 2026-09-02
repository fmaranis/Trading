import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { runDynamicReplayWithQualitySizingExperiment } from '../investment/decision/replayQualitySizingExperiment';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
import { runDynamicReplayWithSelectionQualityExperiment } from '../investment/decision/replaySelectionQualityExperiment';
import { runDynamicReplayWithStrategicCoreHoldExperiment } from '../investment/decision/replayStrategicCoreHoldExperiment';
import { runDynamicReplayWithTrendProtectionV2Experiment } from '../investment/decision/replayTrendProtectionV2Experiment';
import { buildTrendProtectionV2ReplayComparison } from '../investment/decision/trendProtectionReplayComparison';
import type { MultiAssetDataset } from '../investment/portfolioBacktesting/types';
import type { AssetUniverseItem } from '../investment/decision/assetUniverse';
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
    cashBenchmarkAnnualPct: configuration.cashBenchmarkAnnualPct,
    minimumBars: configuration.minimumBars,
    taxSettings: configuration.taxSettings
  };
}

function persistCounterfactualInAuditSignal(result: any): void {
  const counterfactual = result?.trendProtectionV2Counterfactual;
  if (!counterfactual) return;

  // HistoricalReplayProgressivePanel preserves the complete signal object in v3.
  // One audit extension therefore persists the complete multi-arm comparison.
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
      const v2Comparison = buildTrendProtectionV2ReplayComparison({
        baseline: result,
        v2: v2Replay,
        riskProfile: configuration.riskProfile
      });

      const strategicCoreReplay = runDynamicReplayWithStrategicCoreHoldExperiment(input);
      const strategicCoreComparison = buildTrendProtectionV2ReplayComparison({
        baseline: result,
        v2: strategicCoreReplay,
        riskProfile: configuration.riskProfile
      });

      const selectionQualityReplay = runDynamicReplayWithSelectionQualityExperiment(input);
      const selectionQualityComparison = buildTrendProtectionV2ReplayComparison({
        baseline: result,
        v2: selectionQualityReplay,
        riskProfile: configuration.riskProfile
      });

      const qualitySizingReplay = runDynamicReplayWithQualitySizingExperiment(input);
      const qualitySizingComparison = buildTrendProtectionV2ReplayComparison({
        baseline: result,
        v2: qualitySizingReplay,
        riskProfile: configuration.riskProfile
      });

      result.trendProtectionV2Counterfactual = {
        ...v2Comparison,
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
            'QUALITY_SIZING_V1 es un brazo separado de selección: mantiene ranking LEGACY y STRATEGIC_CORE_HOLD_V1, y sólo reduce importes STARTER/BUILD según un composite causal Reliability/Opportunity. Los caps originales nunca aumentan y ROTATION_ENTRY queda sin cambios.'
          ]
        }
      } as any;
      result.notes.push(
        'A/B V2 principal sustituido por FULL_CAUSAL_REPLAY: todos los brazos son carteras ejecutables y la divergencia posterior de entradas es una consecuencia económica causal.',
        'Tercer brazo STRATEGIC_CORE_HOLD_V1: conserva el core estratégico acumulado frente a ventas/rotaciones tácticas cortas.',
        'Cuarto brazo SELECTION_QUALITY_V1: añade ReliabilityScore + OpportunityScore sólo al ranking de candidatos ya aprobados.',
        'Quinto brazo QUALITY_SIZING_V1: vuelve al ranking LEGACY y usa ReliabilityScore + OpportunityScore sólo para reducir de forma conservadora STARTER/BUILD; no amplifica caps ni modifica entradas por rotación.'
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
