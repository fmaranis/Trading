import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
import { appendTrendProtectionV2Counterfactual } from '../investment/decision/trendProtectionCounterfactual';
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
    let result = appendRotationCounterfactualAudit({
      result: runDynamicReplayWithRotationExperiment({
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
      }, REPLAY_ROTATION_EXPERIMENT),
      dataset,
      catalog: configuration.catalog
    });

    const sourceEndDate = latestDatasetDate(sourceDataset);
    const isFinalCheckpoint = sourceEndDate != null && message.endDate >= sourceEndDate;
    if (isFinalCheckpoint) {
      result = appendTrendProtectionV2Counterfactual({
        result,
        dataset,
        catalog: configuration.catalog,
        cashBenchmarkAnnualPct: configuration.cashBenchmarkAnnualPct,
        minimumBars: configuration.minimumBars,
        taxSettings: configuration.taxSettings
      });
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
