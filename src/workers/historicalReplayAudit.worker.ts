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

function persistCounterfactualInAuditSignal(result: any): void {
  const counterfactual = result?.trendProtectionV2Counterfactual;
  if (!counterfactual) return;

  // HistoricalReplayProgressivePanel intentionally preserves the complete signal
  // object in storage/export. Attaching one audit extension to one signal keeps the
  // existing v3 envelope compatible while avoiding a second persistence system.
  const auditSignal = result.signals?.[0];
  if (auditSignal) {
    auditSignal.auditExtensions = {
      ...(auditSignal.auditExtensions ?? {}),
      trendProtectionV2Counterfactual: counterfactual
    };
  }

  // UI side-channel only. Persistence does not depend on BroadcastChannel; the
  // signal extension above remains the source used by exported/reloaded audits.
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUDIT_BROADCAST_CHANNEL);
      channel.postMessage({ type: 'TREND_PROTECTION_V2_COUNTERFACTUAL', counterfactual });
      channel.close();
    }
  } catch {
    // A missing BroadcastChannel must never invalidate the replay itself.
  }
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
