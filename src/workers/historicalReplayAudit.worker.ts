import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
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
  // One audit extension therefore persists the complete A/B without a second store.
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

function strategicCoreDelta(currentV2: ReturnType<typeof buildTrendProtectionV2ReplayComparison>, strategic: ReturnType<typeof buildTrendProtectionV2ReplayComparison>) {
  return {
    finalValueEur: strategic.finalValueEur - currentV2.finalValueEur,
    returnPctPoints: strategic.totalReturnPct - currentV2.totalReturnPct,
    maxDrawdownPctPoints: strategic.maxDrawdownPct - currentV2.maxDrawdownPct,
    feesEur: strategic.totalFeesEur - currentV2.totalFeesEur,
    estimatedTaxEur: strategic.totalEstimatedTaxEur - currentV2.totalEstimatedTaxEur,
    turnoverEur: strategic.turnoverEur - currentV2.turnoverEur
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

      result.trendProtectionV2Counterfactual = {
        ...v2Comparison,
        strategicCoreHoldExperiment: {
          ...strategicCoreComparison,
          policy: 'STRATEGIC_CORE_HOLD_V1',
          methodology: 'FULL_CAUSAL_REPLAY_SAME_ENGINE_V2_WITH_STRATEGIC_CORE_NO_SELL',
          deltaVsTrendProtectionV2: strategicCoreDelta(v2Comparison, strategicCoreComparison),
          notes: [
            ...strategicCoreComparison.notes,
            'STRATEGIC_CORE_HOLD_V1 es un tercer brazo experimental. Conserva CURRENT_POLICY y TREND_PROTECTION_V2 sin cambios y modifica una sola semántica: el core estratégico de crecimiento ya acumulado no se vende ni rota por deterioro de corto plazo. CORE_GATE_V1 sigue enviando capital desde posiciones débiles hacia ese core.'
          ]
        }
      } as any;
      result.notes.push(
        'A/B V2 principal sustituido por FULL_CAUSAL_REPLAY: ambos brazos son carteras ejecutables con el mismo motor de selección/timing; la paridad de entradas queda como diagnóstico, no como requisito de validez.',
        'Tercer brazo experimental STRATEGIC_CORE_HOLD_V1 añadido en trendProtectionV2Counterfactual.strategicCoreHoldExperiment. No cambia CORE_GATE_V1 ni thresholds; sólo prueba si conservar el core estratégico acumulado mejora la robustez frente a venderlo por tendencia corta.'
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
