import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import type { AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import type { DynamicHistoricalReplayInput } from '../src/investment/decision/dynamicHistoricalReplay';
import {
  runDynamicReplayWithRotationExperiment,
  type DynamicReplayExperimentResult
} from '../src/investment/decision/replayRotationPolicyExperiment';
import { PHASE5_WINNER_PROTECTION_V2 } from '../src/investment/decision/phase5WinnerProtectionV2Overlay';
import { saveDurableResearchValidationEvidence } from '../server/researchValidationEvidenceStore';
import {
  PHASE5_ASSETS_PER_COHORT,
  PHASE5_BLIND_MARKER,
  PHASE5_BLIND_VERSION,
  PHASE5_COHORT_COUNT,
  PHASE5_CURRENT_DISCOVERY_HISTORICAL,
  PHASE5_DATA_START_DATE,
  PHASE5_DURABLE_JOB_ID,
  PHASE5_END_DATE,
  PHASE5_FREQUENCY,
  PHASE5_HORIZON_YEARS,
  PHASE5_INITIAL_CAPITAL_EUR,
  PHASE5_MATERIALITY_CAPITAL_PCT,
  PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP,
  PHASE5_MINIMUM_CAUSAL_BARS,
  PHASE5_PASS_MIN_POSITIVE_COHORTS,
  PHASE5_REACH_MIN_COHORTS,
  PHASE5_REACH_MIN_EXECUTED_REDUCTIONS,
  PHASE5_REPLAY_START_DATE,
  PHASE5_RISK_PROFILE,
  PHASE5_SEAL_PATH,
  PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP,
  PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL
} from './phase5WinnerProtectionV2SampleProtocol';
import { PHASE5_SEALED_COHORTS, PHASE5_SEALED_SAMPLE_STATE } from './phase5WinnerProtectionV2SealedSample';

const JOB_NAME = 'Fase 5 · protección de grandes ganadores · blind V1';
const LOCAL_RECOVERY_PATH = '.runtime/phase5-winner-protection-v2-result.json';

interface Phase5Seal {
  version: string;
  sampleState: string;
  expectedGitBlobSha: Record<string, string>;
}

interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function verifyPreOpenSeal(): Phase5Seal {
  const seal = JSON.parse(readFileSync(PHASE5_SEAL_PATH, 'utf8')) as Phase5Seal;
  if (seal.version !== 'PHASE5_WINNER_PROTECTION_V2_SEAL_V1' || seal.sampleState !== 'SEALED_NOT_OPENED') {
    throw new Error('PHASE5_PREOPEN_SEAL_INVALID');
  }
  if (Object.keys(seal.expectedGitBlobSha).length < 10) throw new Error('PHASE5_PREOPEN_SEAL_INCOMPLETE');
  for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
    const actual = gitBlobSha(readFileSync(path, 'utf8'));
    if (actual !== expected) throw new Error(`PHASE5_PREOPEN_SEAL_MISMATCH:${path}:${expected}:${actual}`);
  }
  return seal;
}

function criticalFingerprints(seal: Phase5Seal): Record<string, string> {
  return Object.fromEntries(Object.keys(seal.expectedGitBlobSha).map(path => [path, sha256Text(readFileSync(path, 'utf8'))]));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function barIntegrity(asset: { bars: MarketBar[] }): boolean {
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

function equalInitialAllocations(cohort: readonly AssetUniverseItem[]) {
  if (cohort.length !== PHASE5_ASSETS_PER_COHORT) throw new Error(`PHASE5_COHORT_SIZE_INVALID:${cohort.length}`);
  const cents = Math.round(PHASE5_INITIAL_CAPITAL_EUR * 100);
  const base = Math.floor(cents / cohort.length);
  let remainder = cents - base * cohort.length;
  return cohort.map(asset => {
    const rowCents = base + (remainder-- > 0 ? 1 : 0);
    return { assetId: asset.assetId, amountEur: rowCents / 100 };
  });
}

function baseReplayInput(dataset: DynamicHistoricalReplayInput['dataset'], catalog: AssetUniverseItem[]): DynamicHistoricalReplayInput {
  return {
    dataset,
    catalog,
    startDate: PHASE5_REPLAY_START_DATE,
    frequency: PHASE5_FREQUENCY,
    initialCapitalEur: PHASE5_INITIAL_CAPITAL_EUR,
    riskProfile: PHASE5_RISK_PROFILE,
    horizonYears: PHASE5_HORIZON_YEARS,
    cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    cashBenchmarkAnnualPct: 2.5,
    minimumBars: PHASE5_MINIMUM_CAUSAL_BARS,
    taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
    simulationMode: 'CUSTODIA_ENGINE',
    initialPortfolio: {
      source: 'MANUAL',
      cashEur: 0,
      allocations: equalInitialAllocations(catalog)
    }
  };
}

function executedOperations(result: DynamicReplayExperimentResult): number {
  return result.signals.filter(signal => signal.executed && !signal.isInitialAllocation && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action)).length;
}

function incrementalCosts(candidate: DynamicReplayExperimentResult, baseline: DynamicReplayExperimentResult): number {
  return (candidate.totalFeesEur + candidate.totalEstimatedTaxEur) - (baseline.totalFeesEur + baseline.totalEstimatedTaxEur);
}

function terminalSliceEffectEur(
  signal: DynamicReplayExperimentResult['signals'][number],
  dataset: DynamicHistoricalReplayInput['dataset']
): number | null {
  if (!signal.executed || signal.action !== 'REDUCE' || !(signal.executionPriceEur && signal.executionPriceEur > 0) || !(signal.unitsDelta < 0)) return null;
  const series = dataset.assets.find(asset => asset.assetId === signal.assetId);
  const end = series?.bars.filter(bar => String(bar.timestamp).slice(0, 10) <= PHASE5_END_DATE).at(-1);
  if (!end?.close || !(end.close > 0)) return null;
  const soldUnits = Math.abs(signal.unitsDelta);
  const grossSale = soldUnits * signal.executionPriceEur;
  const hypotheticalHeldValue = soldUnits * end.close;
  return grossSale - signal.feeEur - signal.estimatedTaxEur - hypotheticalHeldValue;
}

function episodeDiagnostics(result: DynamicReplayExperimentResult, dataset: DynamicHistoricalReplayInput['dataset']) {
  const reductions = result.signals.filter(signal =>
    signal.executed
    && signal.action === 'REDUCE'
    && signal.reason.includes('[PHASE5_WINNER_PROTECTION_V2:REDUCE]')
  );
  return reductions.map(signal => {
    const decision = [...result.winnerProtectionAudit.decisions].reverse().find(row =>
      row.assetId === signal.assetId
      && row.decisionDate === signal.signalDate
      && row.economicOverrideApplied
    ) ?? null;
    const mfe = decision?.mfePct ?? null;
    const currentReturn = decision?.currentReturnPct ?? null;
    const profitCaptureRatioPct = mfe != null && mfe > 0 && currentReturn != null && currentReturn >= 0
      ? currentReturn / mfe * 100
      : null;
    const protectionArmDate = decision?.protectionArmDate ?? null;
    return {
      episodeKey: `${signal.assetId}|${protectionArmDate ?? 'UNKNOWN'}|${signal.executionDate ?? 'NO_EXECUTION'}`,
      assetId: signal.assetId,
      ticker: signal.ticker,
      protectionArmDate,
      reductionSignalDate: signal.signalDate,
      reductionExecutionDate: signal.executionDate,
      currentReturnPctAtSignal: currentReturn,
      mfePctAtSignal: mfe,
      givebackPctPointsAtSignal: decision?.givebackFromMfePctPoints ?? null,
      profitCaptureRatioPct,
      notionalEur: signal.notionalEur,
      feeEur: signal.feeEur,
      estimatedTaxEur: signal.estimatedTaxEur,
      terminalSoldSliceEffectEur: terminalSliceEffectEur(signal, dataset)
    };
  });
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
    jobId: PHASE5_DURABLE_JOB_ID,
    jobName: JOB_NAME,
    evidenceKind: 'ORIGINAL_VALIDATION',
    recordedAt,
    status: 'PASSED',
    startedAt: null,
    finishedAt: recordedAt,
    result: payload,
    note: 'Original sealed Phase 5 winner-protection validation. The sample becomes consumed when this blind runner first requests the sealed market-data sample.'
  });
  const envelope = { ...payload as any, durable };
  console.log(PHASE5_BLIND_MARKER, JSON.stringify(envelope));
  return envelope;
}

async function main() {
  if (!process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) throw new Error('PHASE5_DURABLE_GITHUB_TOKEN_REQUIRED');
  if (PHASE5_SEALED_SAMPLE_STATE !== 'SEALED_NOT_OPENED') throw new Error('PHASE5_SAMPLE_NOT_SEALED_PREOPEN');
  if (PHASE5_CURRENT_DISCOVERY_HISTORICAL !== false) throw new Error('PHASE5_CURRENT_DISCOVERY_HISTORICAL_MUST_BE_OFF');
  const seal = verifyPreOpenSeal();
  const fingerprints = criticalFingerprints(seal);

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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE5_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    process.env.MARKET_DATA_INTERNAL_BASE_URL = process.env.MARKET_DATA_INTERNAL_BASE_URL || baseUrl;
    process.env.ALERT_INTERNAL_BASE_URL = process.env.ALERT_INTERNAL_BASE_URL || baseUrl;
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    // ECONOMIC OPENING BOUNDARY. Preflight used only coverage/integrity metadata.
    // From this first sealed-sample request onward Phase 5 is consumed even if
    // later infrastructure or economic gates fail.
    const sealedUniverse = PHASE5_SEALED_COHORTS.flat();
    const scan = await AssetUniverseScanner.scan(sealedUniverse, PHASE5_DATA_START_DATE, PHASE5_END_DATE, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: sealedUniverse.length,
      minimumBars: PHASE5_MINIMUM_CAUSAL_BARS,
      maxDataAgeDays: 10,
      currentOpenDiscovery: false
    });

    const datasetById = new Map(scan.acceptedDataset.assets.map(asset => [asset.assetId, asset]));
    const candidateById = new Map(scan.candidates.map(candidate => [candidate.asset.assetId, candidate]));
    const dataGate = PHASE5_SEALED_COHORTS.map((cohort, index) => {
      const rows = cohort.map(asset => {
        const series = datasetById.get(asset.assetId);
        const candidate = candidateById.get(asset.assetId);
        const causalBars = series?.bars.filter(bar => String(bar.timestamp).slice(0, 10) < PHASE5_REPLAY_START_DATE).length ?? 0;
        const real = series?.provenance?.sourceType === 'REAL';
        const integrity = Boolean(series && barIntegrity(series as { bars: MarketBar[] }));
        const endCoverage = Boolean(series?.bars.at(-1)?.timestamp && String(series.bars.at(-1)!.timestamp).slice(0, 10) >= '2003-12-20');
        const valid = candidate?.status === 'ACCEPTED' && real && integrity && causalBars >= PHASE5_MINIMUM_CAUSAL_BARS && endCoverage;
        return {
          assetId: asset.assetId,
          ticker: asset.ticker,
          valid,
          accepted: candidate?.status === 'ACCEPTED',
          reason: candidate?.reason ?? null,
          provenance: series?.provenance ?? null,
          causalBars,
          integrity,
          endCoverage
        };
      });
      return { cohort: index + 1, valid: rows.every(row => row.valid), assets: rows };
    });

    if (dataGate.some(row => !row.valid)) {
      await persistResult({
        version: PHASE5_BLIND_VERSION,
        executedAt: new Date().toISOString(),
        sampleState: 'PHASE5_OPENED_CONSUMED',
        verdict: 'INCONCLUSIVE_INVALID_DATA',
        sealVersion: seal.version,
        fingerprints,
        dataGate,
        scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts }
      });
      return;
    }

    const cohortResults: any[] = [];
    for (let index = 0; index < PHASE5_SEALED_COHORTS.length; index++) {
      const cohort = PHASE5_SEALED_COHORTS[index];
      const ids = new Set(cohort.map(asset => asset.assetId));
      const catalog = cohort.map(asset => ({ ...asset }));
      const dataset = {
        timeframe: scan.acceptedDataset.timeframe,
        assets: scan.acceptedDataset.assets.filter(asset => ids.has(asset.assetId))
      };
      const baselineInput = baseReplayInput(dataset, catalog);
      const candidateInput = baseReplayInput(dataset, catalog);
      const baseline = runDynamicReplayWithRotationExperiment(baselineInput, 'CORE_ARCHITECTURE_V1');
      const candidate = runDynamicReplayWithRotationExperiment(candidateInput, 'CORE_ARCHITECTURE_V1', {
        winnerProtectionPolicy: PHASE5_WINNER_PROTECTION_V2
      });
      const episodes = episodeDiagnostics(candidate, dataset);
      const uniqueEpisodeKeys = [...new Set(episodes.map(row => row.episodeKey))];
      const finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur;
      const maxDrawdownDeltaPctPoints = candidate.decisionPathMaxDrawdownPct - baseline.decisionPathMaxDrawdownPct;
      const incrementalCostsEur = incrementalCosts(candidate, baseline);
      cohortResults.push({
        cohort: index + 1,
        assets: cohort.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker })),
        initialPortfolio: baselineInput.initialPortfolio,
        baseline: {
          finalValueEur: baseline.finalValueEur,
          totalReturnPct: baseline.totalReturnPct,
          maxDrawdownPct: baseline.decisionPathMaxDrawdownPct,
          totalFeesEur: baseline.totalFeesEur,
          totalEstimatedTaxEur: baseline.totalEstimatedTaxEur,
          executedOperations: executedOperations(baseline)
        },
        candidate: {
          finalValueEur: candidate.finalValueEur,
          totalReturnPct: candidate.totalReturnPct,
          maxDrawdownPct: candidate.decisionPathMaxDrawdownPct,
          totalFeesEur: candidate.totalFeesEur,
          totalEstimatedTaxEur: candidate.totalEstimatedTaxEur,
          executedOperations: executedOperations(candidate),
          winnerProtectionAudit: candidate.winnerProtectionAudit
        },
        deltas: {
          finalValueDeltaEur,
          maxDrawdownDeltaPctPoints,
          incrementalCostsEur,
          operationCountDelta: executedOperations(candidate) - executedOperations(baseline)
        },
        reach: {
          executedWinnerProtectionReductions: uniqueEpisodeKeys.length,
          uniqueEpisodeKeys
        },
        episodes
      });
    }

    const deltas = cohortResults.map(row => row.deltas.finalValueDeltaEur as number);
    const drawdownDeltas = cohortResults.map(row => row.deltas.maxDrawdownDeltaPctPoints as number);
    const positiveCosts = cohortResults.map(row => row.deltas.incrementalCostsEur as number).filter(value => value > 0);
    const positiveCohorts = cohortResults.filter(row => row.deltas.finalValueDeltaEur > 0).length;
    const cohortsWithReach = cohortResults.filter(row => row.reach.executedWinnerProtectionReductions > 0).length;
    const uniqueExecutedReductions = cohortResults.reduce((sum, row) => sum + row.reach.executedWinnerProtectionReductions, 0);
    const reachPass = uniqueExecutedReductions >= PHASE5_REACH_MIN_EXECUTED_REDUCTIONS && cohortsWithReach >= PHASE5_REACH_MIN_COHORTS;
    const medianFinalValueDeltaEur = median(deltas);
    const medianIncrementalPositiveCostsEur = median(positiveCosts);
    const materialityThresholdEur = Math.max(
      PHASE5_INITIAL_CAPITAL_EUR * PHASE5_MATERIALITY_CAPITAL_PCT / 100,
      medianIncrementalPositiveCostsEur
    );
    const medianDrawdownDeltaPctPoints = median(drawdownDeltas);
    const worstFinalValueDeltaEur = Math.min(...deltas);
    const worstDrawdownDeltaPctPoints = Math.max(...drawdownDeltas);
    const aggregateDeltaEur = deltas.reduce((sum, value) => sum + value, 0);
    const largestPositiveDeltaEur = Math.max(0, ...deltas);
    const leaveBestOutAggregateDeltaEur = aggregateDeltaEur - largestPositiveDeltaEur;
    const dominancePass = leaveBestOutAggregateDeltaEur > 0;

    const economicGates = {
      positiveCohorts: { actual: positiveCohorts, required: PHASE5_PASS_MIN_POSITIVE_COHORTS, pass: positiveCohorts >= PHASE5_PASS_MIN_POSITIVE_COHORTS },
      medianFinalValueDeltaEur: { actual: medianFinalValueDeltaEur, requiredGreaterThan: 0, pass: medianFinalValueDeltaEur > 0 },
      materiality: { actualMedianBenefitEur: medianFinalValueDeltaEur, thresholdEur: materialityThresholdEur, medianPositiveIncrementalCostsEur: medianIncrementalPositiveCostsEur, pass: medianFinalValueDeltaEur > materialityThresholdEur },
      medianMaxDrawdownDeterioration: { actualPctPoints: medianDrawdownDeltaPctPoints, maximumPctPoints: PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP, pass: medianDrawdownDeltaPctPoints <= PHASE5_MEDIAN_MAX_DRAWDOWN_WORSENING_LIMIT_PP },
      singleCohortLoss: { worstDeltaEur: worstFinalValueDeltaEur, minimumAllowedEur: -PHASE5_INITIAL_CAPITAL_EUR * PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL / 100, pass: worstFinalValueDeltaEur >= -PHASE5_INITIAL_CAPITAL_EUR * PHASE5_SINGLE_COHORT_MAX_LOSS_PCT_INITIAL / 100 },
      singleCohortDrawdown: { worstDeteriorationPctPoints: worstDrawdownDeltaPctPoints, maximumPctPoints: PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP, pass: worstDrawdownDeltaPctPoints <= PHASE5_SINGLE_COHORT_MAX_DRAWDOWN_WORSENING_PP },
      dominance: { aggregateDeltaEur, largestPositiveDeltaEur, leaveBestOutAggregateDeltaEur, rule: 'aggregate delta remains > 0 after removing the single best cohort', pass: dominancePass }
    };
    const economicsPass = Object.values(economicGates).every((gate: any) => gate.pass === true);
    const verdict = !reachPass
      ? 'INCONCLUSIVE_INSUFFICIENT_WINNER_PROTECTION_REACH'
      : economicsPass
        ? 'PASS_CANDIDATE_FOR_CONFIRMATION'
        : 'FAIL_RETIRED_AS_TESTED';

    await persistResult({
      version: PHASE5_BLIND_VERSION,
      executedAt: new Date().toISOString(),
      sampleState: 'PHASE5_OPENED_CONSUMED',
      verdict,
      productionDefault: 'LEGACY',
      researchPolicy: PHASE5_WINNER_PROTECTION_V2,
      sealVersion: seal.version,
      fingerprints,
      protocol: {
        dataStartDate: PHASE5_DATA_START_DATE,
        replayStartDate: PHASE5_REPLAY_START_DATE,
        requestedEndDate: PHASE5_END_DATE,
        frequency: PHASE5_FREQUENCY,
        initialCapitalEurPerCohort: PHASE5_INITIAL_CAPITAL_EUR,
        riskProfile: PHASE5_RISK_PROFILE,
        horizonYears: PHASE5_HORIZON_YEARS,
        initialPortfolio: 'MANUAL_EQUAL_WEIGHT_3_ASSET_STATE',
        cashBenchmark: 'HISTORICAL_ECB_DFR_FLOOR_0',
        taxContextConfirmed: false,
        externalCashFlows: 'NONE',
        execution: 'NEXT_OPEN',
        currentDiscoveryHistorical: false
      },
      dataGate,
      reach: {
        uniqueExecutedWinnerProtectionReductions: uniqueExecutedReductions,
        cohortsWithExecutedWinnerProtectionReduction: cohortsWithReach,
        requiredReductions: PHASE5_REACH_MIN_EXECUTED_REDUCTIONS,
        requiredCohorts: PHASE5_REACH_MIN_COHORTS,
        pass: reachPass
      },
      economicGates,
      cohortResults,
      scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts },
      methodology: {
        pairedBaselineCandidate: true,
        onlyDifference: 'TREND_PROTECTION_V2_WINNER_ONLY overlay before CORE_ARCHITECTURE_V1',
        sampleSelectionUsedEconomicOutcomes: false,
        preflightUsedCoverageOnly: true,
        sampleConsumed: true,
        noRetuningFromThisOutcome: true
      }
    });
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE5_WINNER_PROTECTION_V2_BLIND_ERROR', error?.stack || error);
  process.exitCode = 1;
});
