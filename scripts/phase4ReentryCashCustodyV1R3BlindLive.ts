import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { EUR_PORTFOLIO_DISCOVERY_UNIVERSE } from '../src/investment/decision/portfolioDiscoveryUniverse';
import type { DynamicHistoricalReplayInput } from '../src/investment/decision/dynamicHistoricalReplay';
import {
  runDynamicReplayWithRotationExperiment,
  type DynamicReplayExperimentResult
} from '../src/investment/decision/replayRotationPolicyExperiment';
import { EXIT_PROCEEDS_CUSTODY_V1 } from '../src/investment/decision/reentryCashCustodyPolicy';
import { saveDurableResearchValidationEvidence } from '../server/researchValidationEvidenceStore';
import {
  PHASE4_R2_CONSUMED_TICKERS,
  PHASE4_R3_CANDIDATE_POOL,
  PHASE4_R3_CORE,
  PHASE4_R3_DATA_START_DATE,
  PHASE4_R3_DURABLE_JOB_ID,
  PHASE4_R3_END_DATE,
  PHASE4_R3_INITIAL_CAPITAL_EUR,
  PHASE4_R3_MARKER,
  PHASE4_R3_MINIMUM_BARS,
  PHASE4_R3_MIN_VALID_FRESH_PER_COHORT,
  PHASE4_R3_REPLAY_START_DATE,
  PHASE4_R3_SEAL_PATH,
  PHASE4_R3_TARGET_FRESH_ASSETS,
  PHASE4_R3_VERSION,
  buildPhase4R3Cohorts,
  selectPhase4R3FreshAssets
} from './phase4ReentryCashCustodyV1R3Protocol';

const JOB_NAME = 'Fase 4 · reentrada · custodia de proceeds · R3';
const LOCAL_RECOVERY_PATH = '.runtime/phase4-reentry-cash-custody-v1-r3-result.json';

interface Phase4R3Seal {
  version: string;
  sampleState: string;
  expectedGitBlobSha: Record<string, string>;
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function verifyPreOpenSeal(): Phase4R3Seal {
  const seal = JSON.parse(readFileSync(PHASE4_R3_SEAL_PATH, 'utf8')) as Phase4R3Seal;
  if (seal.version !== 'PHASE4_REENTRY_CASH_CUSTODY_V1_R3_SEAL' || seal.sampleState !== 'R3_SEALED_NOT_OPENED') {
    throw new Error('PHASE4_R3_PREOPEN_SEAL_INVALID');
  }
  if (Object.keys(seal.expectedGitBlobSha).length < 10) throw new Error('PHASE4_R3_PREOPEN_SEAL_INCOMPLETE');
  for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
    const actual = gitBlobSha(readFileSync(path, 'utf8'));
    if (actual !== expected) throw new Error(`PHASE4_R3_PREOPEN_SEAL_MISMATCH:${path}:${expected}:${actual}`);
  }
  return seal;
}

function criticalFingerprints(seal: Phase4R3Seal): Record<string, string> {
  return Object.fromEntries(Object.keys(seal.expectedGitBlobSha).map(path => [path, sha256Text(readFileSync(path, 'utf8'))]));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function executedTradeCount(result: DynamicReplayExperimentResult): number {
  return result.signals.filter(signal => signal.executed && !signal.isInitialAllocation && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action)).length;
}

function barIntegrity(asset: { bars: Array<{ timestamp: string; open: number; high: number; low: number; close: number }> }): boolean {
  const dates = new Set<string>();
  let previous = '';
  for (const bar of asset.bars) {
    const date = String(bar.timestamp).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dates.has(date) || (previous && date <= previous)) return false;
    dates.add(date);
    previous = date;
    if (![bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0)) return false;
    if (bar.high + 1e-9 < Math.max(bar.open, bar.close) || bar.low - 1e-9 > Math.min(bar.open, bar.close)) return false;
  }
  return true;
}

function baseReplayInput(dataset: DynamicHistoricalReplayInput['dataset'], catalog: AssetUniverseItem[]): DynamicHistoricalReplayInput {
  return {
    dataset,
    catalog,
    startDate: PHASE4_R3_REPLAY_START_DATE,
    frequency: 'MONTHLY',
    initialCapitalEur: PHASE4_R3_INITIAL_CAPITAL_EUR,
    riskProfile: 'MEDIUM',
    horizonYears: 3,
    cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    cashBenchmarkAnnualPct: 2.5,
    minimumBars: PHASE4_R3_MINIMUM_BARS,
    taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
    simulationMode: 'CUSTODIA_ENGINE'
  };
}

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

function persistLocalRecovery(payload: unknown): void {
  mkdirSync(dirname(LOCAL_RECOVERY_PATH), { recursive: true });
  writeFileSync(LOCAL_RECOVERY_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function persistResult(payload: unknown): Promise<unknown> {
  persistLocalRecovery(payload);
  const recordedAt = new Date().toISOString();
  const durable = await saveDurableResearchValidationEvidence({
    schemaVersion: 1,
    jobId: PHASE4_R3_DURABLE_JOB_ID,
    jobName: JOB_NAME,
    evidenceKind: 'ORIGINAL_VALIDATION',
    recordedAt,
    status: 'PASSED',
    startedAt: null,
    finishedAt: recordedAt,
    result: payload,
    note: 'Original sealed R3 validation evidence. R3 becomes consumed at the first fresh EQ_PH4_R3 market-data request.'
  });
  const envelope = { ...payload as any, durable };
  console.log(PHASE4_R3_MARKER, JSON.stringify(envelope));
  return envelope;
}

async function main() {
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) throw new Error('PHASE4_R3_DURABLE_GITHUB_TOKEN_REQUIRED');
  const seal = verifyPreOpenSeal();
  const fingerprints = criticalFingerprints(seal);

  const productTickers = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(row => row.ticker.toUpperCase()));
  const contaminated = PHASE4_R3_CANDIDATE_POOL.filter(row => productTickers.has(row.ticker.toUpperCase()) || PHASE4_R2_CONSUMED_TICKERS.has(row.ticker.toUpperCase()));
  if (contaminated.length) throw new Error(`PHASE4_R3_PREOPEN_CATALOG_CONTAMINATION:${contaminated.map(row => row.ticker).join(',')}`);

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const baseUrl = 'http://127.0.0.1:3000';
  if (!(await waitForHealth(`${baseUrl}/api/health`, 1500))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE4_R3_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    process.env.MARKET_DATA_INTERNAL_BASE_URL = process.env.MARKET_DATA_INTERNAL_BASE_URL || baseUrl;
    process.env.ALERT_INTERNAL_BASE_URL = process.env.ALERT_INTERNAL_BASE_URL || baseUrl;
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    // R3 OPENING BOUNDARY: the first scan below touches EQ_PH4_R3 fresh assets.
    // The separate core-only preflight is executed by the job before this runner.
    const universe = [PHASE4_R3_CORE, ...PHASE4_R3_CANDIDATE_POOL];
    const scan = await AssetUniverseScanner.scan(universe, PHASE4_R3_DATA_START_DATE, PHASE4_R3_END_DATE, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 10,
      minimumBars: PHASE4_R3_MINIMUM_BARS,
      maxDataAgeDays: 10,
      currentOpenDiscovery: false
    });

    const candidateById = new Map(scan.candidates.map(row => [row.asset.assetId, row]));
    const datasetById = new Map(scan.acceptedDataset.assets.map(asset => [asset.assetId, asset]));
    const coreCandidate = candidateById.get(PHASE4_R3_CORE.assetId);
    const coreSeries = datasetById.get(PHASE4_R3_CORE.assetId);
    const coreBarsBeforeReplay = coreSeries?.bars.filter(bar => String(bar.timestamp).slice(0, 10) <= PHASE4_R3_REPLAY_START_DATE).length ?? 0;
    const coreValid = coreCandidate?.status === 'ACCEPTED'
      && coreSeries?.provenance?.sourceType === 'REAL'
      && coreBarsBeforeReplay >= PHASE4_R3_MINIMUM_BARS
      && barIntegrity(coreSeries);

    const coverageRows = PHASE4_R3_CANDIDATE_POOL.map(asset => {
      const candidate = candidateById.get(asset.assetId);
      const series = datasetById.get(asset.assetId);
      const causalBars = series?.bars.filter(bar => String(bar.timestamp).slice(0, 10) <= PHASE4_R3_REPLAY_START_DATE).length ?? 0;
      const real = series?.provenance?.sourceType === 'REAL';
      const integrity = Boolean(series && barIntegrity(series));
      const eligible = candidate?.status === 'ACCEPTED' && real && integrity && causalBars >= PHASE4_R3_MINIMUM_BARS;
      return {
        asset,
        eligible,
        causalBars,
        reason: eligible ? null : candidate?.reason ?? (!real ? 'NON_REAL' : !integrity ? 'INTEGRITY' : causalBars < PHASE4_R3_MINIMUM_BARS ? 'INSUFFICIENT_CAUSAL_HISTORY' : 'MISSING')
      };
    });
    const coverageEligible = coverageRows.filter(row => row.eligible).map(row => row.asset);
    const selectedFresh = selectPhase4R3FreshAssets(coverageEligible);

    if (!coreValid || selectedFresh.length < PHASE4_R3_TARGET_FRESH_ASSETS) {
      await persistResult({
        version: PHASE4_R3_VERSION,
        executedAt: new Date().toISOString(),
        sampleState: 'R3_OPENED_CONSUMED',
        verdict: 'INCONCLUSIVE_INVALID_DATA',
        sealVersion: seal.version,
        fingerprints,
        coreGate: {
          valid: Boolean(coreValid),
          accepted: coreCandidate?.status === 'ACCEPTED',
          reason: coreCandidate?.reason ?? null,
          causalBarsBeforeReplay: coreBarsBeforeReplay,
          provenance: coreSeries?.provenance ?? null
        },
        coverageGate: {
          requested: PHASE4_R3_CANDIDATE_POOL.length,
          eligible: coverageEligible.length,
          required: PHASE4_R3_TARGET_FRESH_ASSETS,
          rejected: coverageRows.filter(row => !row.eligible).map(row => ({ assetId: row.asset.assetId, ticker: row.asset.ticker, reason: row.reason, causalBars: row.causalBars }))
        },
        scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts }
      });
      return;
    }

    const cohorts = buildPhase4R3Cohorts(selectedFresh);
    const nonReal = scan.acceptedDataset.assets.filter(asset => asset.provenance?.sourceType !== 'REAL');
    const currentDiscoveryLeak = scan.acceptedDataset.assets.filter(asset => asset.assetId.startsWith('OPEN_'));
    const malformed = scan.acceptedDataset.assets.filter(asset => !barIntegrity(asset));
    const dataGate = cohorts.map((fresh, index) => {
      const acceptedFresh = fresh.filter(asset => datasetById.has(asset.assetId));
      const rejectedFresh = fresh.filter(asset => !datasetById.has(asset.assetId)).map(asset => ({
        assetId: asset.assetId,
        ticker: asset.ticker,
        reason: candidateById.get(asset.assetId)?.reason ?? 'MISSING_FROM_SCAN'
      }));
      const valid = coreValid
        && acceptedFresh.length >= PHASE4_R3_MIN_VALID_FRESH_PER_COHORT
        && nonReal.length === 0
        && currentDiscoveryLeak.length === 0
        && malformed.length === 0;
      return {
        cohort: index + 1,
        valid,
        coreAccepted: coreCandidate?.status === 'ACCEPTED',
        coreBarsBeforeReplay,
        freshRequested: fresh.map(asset => asset.ticker),
        freshAccepted: acceptedFresh.map(asset => asset.ticker),
        rejectedFresh
      };
    });

    if (dataGate.some(row => !row.valid)) {
      await persistResult({
        version: PHASE4_R3_VERSION,
        executedAt: new Date().toISOString(),
        sampleState: 'R3_OPENED_CONSUMED',
        verdict: 'INCONCLUSIVE_INVALID_DATA',
        sealVersion: seal.version,
        fingerprints,
        selectedFresh: selectedFresh.map(row => ({ assetId: row.assetId, ticker: row.ticker })),
        dataGate,
        nonRealAssetIds: nonReal.map(row => row.assetId),
        currentDiscoveryLeakAssetIds: currentDiscoveryLeak.map(row => row.assetId),
        malformedAssetIds: malformed.map(row => row.assetId),
        scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts }
      });
      return;
    }

    const cohortResults: any[] = [];
    for (let index = 0; index < cohorts.length; index++) {
      const fresh = cohorts[index];
      const ids = new Set([PHASE4_R3_CORE.assetId, ...fresh.map(row => row.assetId)]);
      const catalog = universe.filter(asset => ids.has(asset.assetId));
      const dataset = {
        timeframe: scan.acceptedDataset.timeframe,
        assets: scan.acceptedDataset.assets.filter(asset => ids.has(asset.assetId))
      };
      const replayInput = baseReplayInput(dataset, catalog);
      const baseline = runDynamicReplayWithRotationExperiment(replayInput, 'CORE_ARCHITECTURE_V1');
      const candidate = runDynamicReplayWithRotationExperiment(replayInput, 'CORE_ARCHITECTURE_V1', {
        reentryFundingPolicy: EXIT_PROCEEDS_CUSTODY_V1
      });
      const finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur;
      const drawdownDeteriorationPctPoints = candidate.decisionPathMaxDrawdownPct - baseline.decisionPathMaxDrawdownPct;
      const frictionIncreaseEur = Math.max(0, (candidate.totalFeesEur + candidate.totalEstimatedTaxEur) - (baseline.totalFeesEur + baseline.totalEstimatedTaxEur));
      cohortResults.push({
        cohort: index + 1,
        freshAssets: fresh.map(row => ({ assetId: row.assetId, ticker: row.ticker })),
        baseline: {
          finalValueEur: baseline.finalValueEur,
          totalReturnPct: baseline.totalReturnPct,
          cashFlowAdjustedReturnPct: baseline.cashFlowAdjustedReturnPct,
          maxDrawdownPct: baseline.decisionPathMaxDrawdownPct,
          totalFeesEur: baseline.totalFeesEur,
          totalEstimatedTaxEur: baseline.totalEstimatedTaxEur,
          cashInterestEur: baseline.cashInterestEur,
          executedBuys: baseline.executedBuys,
          executedAdds: baseline.executedAdds,
          executedReductions: baseline.executedReductions,
          executedExits: baseline.executedExits,
          executedTrades: executedTradeCount(baseline)
        },
        candidate: {
          finalValueEur: candidate.finalValueEur,
          totalReturnPct: candidate.totalReturnPct,
          cashFlowAdjustedReturnPct: candidate.cashFlowAdjustedReturnPct,
          maxDrawdownPct: candidate.decisionPathMaxDrawdownPct,
          totalFeesEur: candidate.totalFeesEur,
          totalEstimatedTaxEur: candidate.totalEstimatedTaxEur,
          cashInterestEur: candidate.cashInterestEur,
          executedBuys: candidate.executedBuys,
          executedAdds: candidate.executedAdds,
          executedReductions: candidate.executedReductions,
          executedExits: candidate.executedExits,
          executedTrades: executedTradeCount(candidate),
          reentryCustodyAudit: candidate.reentryCustodyAudit
        },
        finalValueDeltaEur,
        returnDeltaPctPoints: candidate.totalReturnPct - baseline.totalReturnPct,
        drawdownDeteriorationPctPoints,
        frictionIncreaseEur,
        operationCountDelta: executedTradeCount(candidate) - executedTradeCount(baseline)
      });
    }

    const exitKeys = new Set<string>();
    const reentryKeys = new Set<string>();
    for (const cohort of cohortResults) {
      for (const episode of cohort.candidate.reentryCustodyAudit.episodes as Array<any>) {
        exitKeys.add(`${episode.assetId}|${episode.exitExecutionDate}`);
        if (episode.reentryExecutionDate && episode.reservedCashUsedEur > 0.01) {
          reentryKeys.add(`${episode.assetId}|${episode.exitExecutionDate}|${episode.reentryExecutionDate}`);
        }
      }
    }

    const reach = {
      uniqueExitReservations: exitKeys.size,
      uniqueReentries: reentryKeys.size,
      pass: exitKeys.size >= 12 && reentryKeys.size >= 6
    };
    const deltas = cohortResults.map(row => row.finalValueDeltaEur as number);
    const ddDeteriorations = cohortResults.map(row => row.drawdownDeteriorationPctPoints as number);
    const positiveFrictionIncreases = cohortResults.map(row => row.frictionIncreaseEur as number).filter(value => value > 0);
    const positiveCohorts = deltas.filter(value => value > 0).length;
    const medianFinalValueDeltaEur = median(deltas);
    const medianDrawdownDeteriorationPctPoints = median(ddDeteriorations);
    const medianPositiveFrictionIncreaseEur = median(positiveFrictionIncreases);
    const materialityFloorEur = Math.max(65, medianPositiveFrictionIncreaseEur);
    const catastrophicLoss = cohortResults.some(row => row.finalValueDeltaEur < -650 || row.drawdownDeteriorationPctPoints > 3);
    const passCandidate = reach.pass
      && positiveCohorts >= 4
      && medianFinalValueDeltaEur > 0
      && medianFinalValueDeltaEur > materialityFloorEur
      && medianDrawdownDeteriorationPctPoints <= 0.5
      && !catastrophicLoss;
    const verdict = !reach.pass
      ? 'INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH'
      : passCandidate
        ? 'PASS_CANDIDATE_FOR_CONFIRMATION'
        : 'FAIL_RETIRED_AS_TESTED';

    await persistResult({
      version: PHASE4_R3_VERSION,
      executedAt: new Date().toISOString(),
      sampleState: 'R3_OPENED_CONSUMED',
      verdict,
      sealVersion: seal.version,
      fingerprints,
      protocol: {
        dataStartDate: PHASE4_R3_DATA_START_DATE,
        replayStartDate: PHASE4_R3_REPLAY_START_DATE,
        requestedEndDate: PHASE4_R3_END_DATE,
        frequency: 'MONTHLY',
        initialCapitalEur: PHASE4_R3_INITIAL_CAPITAL_EUR,
        riskProfile: 'MEDIUM',
        horizonYears: 3,
        cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
        taxContextConfirmed: false,
        productionDefault: 'LEGACY',
        coreAssetId: PHASE4_R3_CORE.assetId,
        coreIsin: PHASE4_R3_CORE.isin
      },
      scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts },
      coverageSelection: {
        poolSize: PHASE4_R3_CANDIDATE_POOL.length,
        coverageEligible: coverageEligible.length,
        selectedFresh: selectedFresh.map(row => ({ assetId: row.assetId, ticker: row.ticker })),
        rule: 'REAL_COVERAGE_AND_252_PRE_REPLAY_BARS_THEN_SHA256_ORDER_FIRST_30'
      },
      dataGate,
      reach,
      aggregate: {
        positiveCohorts,
        medianFinalValueDeltaEur,
        medianDrawdownDeteriorationPctPoints,
        medianPositiveFrictionIncreaseEur,
        materialityFloorEur,
        catastrophicLoss,
        passCandidate
      },
      cohorts: cohortResults
    });
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE4_REENTRY_CASH_CUSTODY_V1_R3_ERROR', error?.stack || error);
  process.exitCode = 1;
});
