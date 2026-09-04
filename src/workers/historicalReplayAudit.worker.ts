import { appendRotationCounterfactualAudit } from '../investment/decision/rotationCounterfactualAudit';
import { runDynamicReplayWithRotationExperiment } from '../investment/decision/replayRotationPolicyExperiment';
import type { MultiAssetDataset } from '../investment/portfolioBacktesting/types';
import type { AssetUniverseItem } from '../investment/decision/assetUniverse';
import type { CashBenchmarkMode } from '../investment/decision/cashBenchmark';
import type {
  DynamicReplayFrequency,
  DynamicReplayInitialPortfolio,
  DynamicReplaySignal,
  DynamicReplaySimulationMode
} from '../investment/decision/dynamicHistoricalReplay';
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
  simulationMode?: DynamicReplaySimulationMode;
  initialPortfolio?: DynamicReplayInitialPortfolio;
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
const MATERIAL_ACTIONS = new Set(['BUY', 'ADD', 'REDUCE', 'EXIT']);
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
    taxSettings: configuration.taxSettings,
    simulationMode: configuration.simulationMode ?? 'CUSTODIA_ENGINE',
    initialPortfolio: configuration.initialPortfolio
  };
}

/**
 * The replay engine may emit one HOLD/WATCH/AVOID observation per asset and
 * decision date. Those observations are useful while calculating, but sending
 * and persisting every repeated state makes long browser audits unnecessarily
 * large. Keep every material action and only state transitions for non-material
 * observations. Financial results and engine counters are already finalized
 * before this UI-only compaction runs.
 */
function compactAuditSignals(signals: DynamicReplaySignal[]): DynamicReplaySignal[] {
  const retained: DynamicReplaySignal[] = [];
  const lastStateByAsset = new Map<string, string>();

  for (const signal of signals) {
    if (signal.executed || MATERIAL_ACTIONS.has(signal.action)) {
      retained.push(signal);
      lastStateByAsset.delete(signal.assetId);
      continue;
    }

    const stateKey = [
      signal.action,
      signal.timingState ?? '',
      signal.structuralDowntrend ? 'DOWN' : 'OK',
      signal.buyTheDipCandidate ? 'DIP' : 'NO_DIP',
      signal.trendProtectionV1Action ?? ''
    ].join('|');

    if (lastStateByAsset.get(signal.assetId) === stateKey) continue;
    retained.push(signal);
    lastStateByAsset.set(signal.assetId, stateKey);
  }

  return retained;
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
    const baseline = runDynamicReplayWithRotationExperiment(input, REPLAY_ROTATION_EXPERIMENT);
    const result = input.simulationMode === 'HOLD_ONLY'
      ? baseline
      : appendRotationCounterfactualAudit({ result: baseline, dataset, catalog: configuration.catalog });

    const fullSignalCount = result.signals.length;
    result.signals = compactAuditSignals(result.signals);

    workerScope.postMessage({
      type: 'RESULT',
      requestedEndDate: message.endDate,
      result,
      rotationExperiment: REPLAY_ROTATION_EXPERIMENT,
      trendProtectionV2Counterfactual: false,
      fullSignalCount,
      retainedSignalCount: result.signals.length
    });
  } catch (error: any) {
    workerScope.postMessage({ type: 'ERROR', error: error?.message || String(error), requestedEndDate: message.endDate });
  }
};
