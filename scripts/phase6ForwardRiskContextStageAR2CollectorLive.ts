import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, type AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { historicalCashBenchmarkAnnualPct } from '../src/investment/decision/cashBenchmark';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { resolveForwardRiskContextV1 } from '../src/investment/decision/forwardRiskContextV1';
import { loadForwardRiskMacroDataV5VintageSafe } from '../src/investment/decision/forwardRiskMacroDataV5VintageSafe';
import { loadForwardRiskOptionsDataV7, type ForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROTOCOL as STAGE_A } from '../src/investment/decision/phase6ForwardRiskContextStageAR2Protocol';
import { PortfolioCandidateGate } from '../src/investment/decision/portfolioCandidateGate';
import {
  appendPhase6StageAR2Observations,
  markPhase6StageAR2Opened,
  type Phase6StageAR2ProspectiveState,
  type Phase6StageAR2SignalObservation
} from './phase6ForwardRiskContextStageAR2ProspectiveProtocol';
import { loadPhase6StageAR2DurableState, savePhase6StageAR2DurableState } from './phase6ForwardRiskContextStageAR2StateStore';

const MAX_CATCH_UP_SESSIONS_PER_RUN = 5;
const SIGNAL_ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const SAMPLE_ASSET_IDS = new Set<string>(STAGE_A.sample.assets.map(row => row.assetId));
const SIGNAL_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => SIGNAL_ANCHOR_IDS.has(asset.assetId));
const SAMPLE_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => SAMPLE_ASSET_IDS.has(asset.assetId));

type DraftObservation = Omit<Phase6StageAR2SignalObservation, 'previousObservationHashSha256' | 'observationHashSha256'>;

function isoDate(value: string): string { return value.slice(0, 10); }
function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function assertFrozenCatalog(catalog: AssetUniverseItem[], expected: readonly { assetId: string; ticker: string }[], label: string): void {
  const actual = new Map(catalog.map(row => [row.assetId, row.ticker] as const));
  for (const row of expected) if (actual.get(row.assetId) !== row.ticker) throw new Error(`${label}_CATALOG_MISMATCH:${row.assetId}`);
  if (actual.size !== expected.length) throw new Error(`${label}_CATALOG_SIZE_MISMATCH:${actual.size}:${expected.length}`);
}
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
function filterOptionsToDate(data: ForwardRiskOptionsDataV7, endDate: string): ForwardRiskOptionsDataV7 {
  const entries = Object.entries(data.series).map(([key, series]) => {
    const points = series.points.filter(point => point.date <= endDate);
    return [key, { ...series, points, firstDate: points[0]?.date ?? null, lastDate: points.at(-1)?.date ?? null }] as const;
  });
  return { ...data, series: Object.fromEntries(entries) as ForwardRiskOptionsDataV7['series'] };
}
function completedInformationSessions(anchorDates: string[], existingState: Phase6StageAR2ProspectiveState): Array<{ informationDate: string; successorDate: string }> {
  const expectedPerDate = STAGE_A.sample.assets.length;
  const counts = new Map<string, number>();
  for (const row of existingState.observations) counts.set(row.informationDate, (counts.get(row.informationDate) ?? 0) + 1);
  for (const [date, count] of counts) if (count !== expectedPerDate) throw new Error(`PHASE6_STAGE_A_R2_PARTIAL_DURABLE_SESSION:${date}:${count}`);
  const sessions: Array<{ informationDate: string; successorDate: string }> = [];
  for (let i = 0; i < anchorDates.length - 1; i++) {
    const informationDate = anchorDates[i];
    if (informationDate < STAGE_A.sample.predictionStartDate || informationDate > STAGE_A.sample.predictionEndDate) continue;
    if (counts.has(informationDate)) continue;
    sessions.push({ informationDate, successorDate: anchorDates[i + 1] });
    if (sessions.length >= MAX_CATCH_UP_SESSIONS_PER_RUN) break;
  }
  return sessions;
}

async function main() {
  assertFrozenCatalog(SAMPLE_CATALOG, STAGE_A.sample.assets, 'PHASE6_STAGE_A_R2_SAMPLE');
  if (!SIGNAL_CATALOG.some(row => row.assetId === 'EUNL')) throw new Error('PHASE6_STAGE_A_R2_EUNL_SIGNAL_ANCHOR_MISSING');

  const nowIso = new Date().toISOString();
  let durable = await loadPhase6StageAR2DurableState(nowIso);
  let state = durable.state;
  let remoteBlobSha = durable.remoteBlobSha;

  // The durable OPENED marker is committed before the first market request. If
  // a provider fails afterwards, the sample is still correctly recorded as
  // opened/consumed and the missing session remains eligible only for the
  // deterministic post-freeze causal catch-up frozen in Stage A.
  if (state.sampleState === 'NOT_OPENED') {
    state = markPhase6StageAR2Opened(state, nowIso);
    const opened = await savePhase6StageAR2DurableState(state, remoteBlobSha);
    remoteBlobSha = opened.remoteBlobSha;
  }
  if (state.sampleState !== 'OPENED_COLLECTING') throw new Error(`PHASE6_STAGE_A_R2_COLLECTION_NOT_OPEN:${state.sampleState}`);

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) throw new Error('PHASE6_STAGE_A_R2_LOCAL_SERVER_NOT_HEALTHY');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const marketEndDate = todayIso() < STAGE_A.sample.predictionEndDate ? todayIso() : STAGE_A.sample.predictionEndDate;
    const anchorScan = await AssetUniverseScanner.scan(
      SAMPLE_CATALOG.filter(asset => asset.assetId === STAGE_A.observationContinuity.anchorAssetId),
      STAGE_A.sample.historyWarmupStartDate,
      marketEndDate,
      { forceRefresh: false, concurrency: 1, maxSelected: 1, minimumBars: STAGE_A.sample.minimumCandidateHistoryBarsAtInformationDate, maxDataAgeDays: 7, currentOpenDiscovery: false }
    );
    const anchor = anchorScan.acceptedDataset.assets.find(row => row.assetId === STAGE_A.observationContinuity.anchorAssetId);
    if (!anchor) throw new Error('PHASE6_STAGE_A_R2_REAL_ANCHOR_UNAVAILABLE');
    const anchorDates = anchor.bars.map(bar => isoDate(bar.timestamp)).filter((date, index, all) => index === 0 || date !== all[index - 1]);
    const pendingSessions = completedInformationSessions(anchorDates, state);

    if (!pendingSessions.length) {
      console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_COLLECTOR_RESULT');
      console.log(JSON.stringify({
        version: STAGE_A.version,
        status: 'NO_MATURE_INFORMATION_SESSION_TO_COLLECT',
        sampleState: state.sampleState,
        openedAt: state.openedAt,
        observationCount: state.observationCount,
        lastInformationDate: state.lastInformationDate,
        productionDefault: STAGE_A.productionDefault,
        economicPolicyDefined: STAGE_A.economicPolicyDefined,
        outcomeAccessed: false,
        persistence: durable.persistence
      }, null, 2));
      return;
    }

    const lastInformationDate = pendingSessions.at(-1)!.informationDate;
    const signalMaterializationEndDate = pendingSessions.at(-1)!.successorDate;
    const signalScan = await AssetUniverseScanner.scan(
      SIGNAL_CATALOG,
      STAGE_A.sample.historyWarmupStartDate,
      signalMaterializationEndDate,
      { forceRefresh: false, concurrency: 3, maxSelected: 10, minimumBars: 252, maxDataAgeDays: 7, currentOpenDiscovery: false }
    );
    const signalCore = signalScan.acceptedDataset.assets.find(row => row.assetId === 'EUNL');
    if (!signalCore) throw new Error('PHASE6_STAGE_A_R2_SIGNAL_EUNL_UNAVAILABLE');
    const diagnostic = await loadForwardRiskDiagnosticData(STAGE_A.sample.historyWarmupStartDate, lastInformationDate);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(STAGE_A.sample.historyWarmupStartDate, lastInformationDate);
    if (!macro.pointInTimeVintageSafe) throw new Error('PHASE6_STAGE_A_R2_V5_NOT_VINTAGE_SAFE');
    const options = filterOptionsToDate(await loadForwardRiskOptionsDataV7(), lastInformationDate);
    const v5 = runForwardRiskVulnerabilityV5({
      dataset: signalScan.acceptedDataset,
      diagnosticDataset: diagnostic.dataset,
      macroData: macro,
      startDate: STAGE_A.sample.predictionStartDate,
      endDate: lastInformationDate
    });
    const v7 = runForwardRiskOptionsV7({
      coreBars: signalCore.bars,
      optionsData: options,
      startDate: STAGE_A.sample.predictionStartDate,
      endDate: lastInformationDate
    });
    const v5ByDate = new Map(v5.points.map(point => [point.informationDate, point.vulnerabilityScorePct] as const));
    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point.signalScorePct] as const));
    for (const { informationDate } of pendingSessions) {
      if (!v5ByDate.has(informationDate)) throw new Error(`PHASE6_STAGE_A_R2_V5_POINT_NOT_MATERIALIZED:${informationDate}`);
      if (!v7ByDate.has(informationDate)) throw new Error(`PHASE6_STAGE_A_R2_V7_POINT_NOT_MATERIALIZED:${informationDate}`);
    }

    let sessionsCollected = 0;
    for (const { informationDate } of pendingSessions) {
      const v5Score = v5ByDate.get(informationDate) ?? null;
      const v7Score = v7ByDate.get(informationDate) ?? null;
      const context = resolveForwardRiskContextV1({ v5VulnerabilityScorePct: v5Score, v7OptionsScorePct: v7Score });
      const scan = await AssetUniverseScanner.scan(
        SAMPLE_CATALOG,
        STAGE_A.sample.historyWarmupStartDate,
        informationDate,
        { forceRefresh: false, concurrency: 3, maxSelected: 10, minimumBars: STAGE_A.sample.minimumCandidateHistoryBarsAtInformationDate, maxDataAgeDays: 7, currentOpenDiscovery: false }
      );
      const gate = PortfolioCandidateGate.apply(scan, historicalCashBenchmarkAnnualPct(informationDate), 10, 'LEGACY');
      const candidateById = new Map(scan.candidates.map(candidate => [candidate.asset.assetId, candidate] as const));
      const gateById = new Map(gate.entries.map(entry => [entry.assetId, entry] as const));
      const collectedAt = new Date().toISOString();
      const rows: DraftObservation[] = STAGE_A.sample.assets.map(frozen => {
        const candidate = candidateById.get(frozen.assetId);
        const entry = gateById.get(frozen.assetId);
        const real = candidate?.status === 'ACCEPTED' && candidate.response?.provenance?.sourceType === 'REAL';
        return {
          id: `${informationDate}:${frozen.assetId}`,
          informationDate,
          assetId: frozen.assetId,
          ticker: frozen.ticker,
          gateStatus: real && entry?.status === 'ELIGIBLE' ? 'ELIGIBLE' : 'REJECTED',
          gateReason: real ? (entry?.reason ?? 'GATE_ENTRY_MISSING') : (candidate?.reason ?? 'REAL_DATA_UNAVAILABLE'),
          contextStatus: context.status,
          v5VulnerabilityScorePct: context.v5VulnerabilityScorePct,
          v7OptionsScorePct: context.v7OptionsScorePct,
          contextScorePct: context.contextScorePct,
          highRiskContext: context.highRiskContext,
          source: context.source,
          marketDataSourceType: real ? 'REAL' : 'UNAVAILABLE',
          collectedAt
        };
      });
      state = appendPhase6StageAR2Observations(state, rows, collectedAt);
      const saved = await savePhase6StageAR2DurableState(state, remoteBlobSha);
      remoteBlobSha = saved.remoteBlobSha;
      durable = { ...durable, state, existed: true, remoteBlobSha, persistence: saved.persistence };
      sessionsCollected++;
    }

    console.log('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_COLLECTOR_RESULT');
    console.log(JSON.stringify({
      version: STAGE_A.version,
      status: 'PROSPECTIVE_SIGNAL_COLLECTION_UPDATED',
      sampleState: state.sampleState,
      openedAt: state.openedAt,
      sessionsCollected,
      collectedInformationDates: pendingSessions.map(row => row.informationDate),
      observationsAdded: sessionsCollected * STAGE_A.sample.assets.length,
      observationCount: state.observationCount,
      lastInformationDate: state.lastInformationDate,
      productionDefault: STAGE_A.productionDefault,
      economicPolicyDefined: STAGE_A.economicPolicyDefined,
      outcomeAccessed: false,
      deterministicPostFreezeCausalCatchUp: true,
      successorSessionUsedOnlyForSignalMaterialization: true,
      persistence: durable.persistence
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_COLLECTOR_FATAL', error);
  process.exit(1);
});
