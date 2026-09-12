import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

const MARKER = 'PHASE4_REENTRY_CASH_CUSTODY_V1_RESULT';
const VERSION = 'PHASE4_REENTRY_CASH_CUSTODY_V1_R2' as const;
const DATA_START_DATE = '2002-12-10';
const REPLAY_START_DATE = '2004-01-02';
const END_DATE = '2014-08-31';
const INITIAL_CAPITAL_EUR = 13_000;
const MINIMUM_BARS = 252;
const COHORT_COUNT = 6;
const FRESH_PER_COHORT = 5;
const MIN_VALID_FRESH_PER_COHORT = 4;

const CORE: AssetUniverseItem = {
  assetId: 'FUND_VANGUARD_GLOBAL',
  ticker: 'IE00B03HD191',
  isin: 'IE00B03HD191',
  name: 'Vanguard Global Stock Index Fund EUR Acc',
  category: 'GLOBAL_EQUITY',
  currency: 'EUR',
  instrumentType: 'MUTUAL_FUND',
  marketDataProvider: 'EODHD_FUND'
};

const R2_FRESH: AssetUniverseItem[] = [
  { assetId: 'EQ_PH4_R2_BAS', ticker: 'BAS.DE', name: 'BASF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_BMW', ticker: 'BMW.DE', name: 'BMW', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_MUV2', ticker: 'MUV2.DE', name: 'Munich Re', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_HEN3', ticker: 'HEN3.DE', name: 'Henkel', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_BEI', ticker: 'BEI.DE', name: 'Beiersdorf', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_RWE', ticker: 'RWE.DE', name: 'RWE', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_IFX', ticker: 'IFX.DE', name: 'Infineon', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_VOW3', ticker: 'VOW3.DE', name: 'Volkswagen', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_MRK', ticker: 'MRK.DE', name: 'Merck KGaA', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_CON', ticker: 'CON.DE', name: 'Continental', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_DG', ticker: 'DG.PA', name: 'Vinci', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_CAP', ticker: 'CAP.PA', name: 'Capgemini', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_RI', ticker: 'RI.PA', name: 'Pernod Ricard', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_KER', ticker: 'KER.PA', name: 'Kering', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_HO', ticker: 'HO.PA', name: 'Thales', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_EN', ticker: 'EN.PA', name: 'Bouygues', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_VIV', ticker: 'VIV.PA', name: 'Vivendi', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_CS', ticker: 'CS.PA', name: 'AXA', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_GLE', ticker: 'GLE.PA', name: 'Societe Generale', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_RNO', ticker: 'RNO.PA', name: 'Renault', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_ACS', ticker: 'ACS.MC', name: 'ACS', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_TEF', ticker: 'TEF.MC', name: 'Telefonica', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_ELE', ticker: 'ELE.MC', name: 'Endesa', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_ANA', ticker: 'ANA.MC', name: 'Acciona', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_ACX', ticker: 'ACX.MC', name: 'Acerinox', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_FCC', ticker: 'FCC.MC', name: 'FCC', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_G', ticker: 'G.MI', name: 'Generali', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_TIT', ticker: 'TIT.MI', name: 'Telecom Italia', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_LDO', ticker: 'LDO.MI', name: 'Leonardo', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'EQ_PH4_R2_STM', ticker: 'STM.MI', name: 'STMicroelectronics', category: 'EUROPE_EQUITY', currency: 'EUR' }
];

const CRITICAL_FILES = [
  'docs/phase4_reentry_cash_custody_v1_preregistration.md',
  'src/investment/decision/reentryCashCustodyPolicy.ts',
  'src/investment/decision/replayRotationPolicyExperiment.ts',
  'src/investment/decision/dynamicHistoricalReplayCore.ts',
  'src/investment/decision/portfolioCoreGatePolicy.ts',
  'src/investment/decision/cashBenchmark.ts',
  'scripts/phase4ReentryCashCustodyV1BlindLive.ts'
] as const;

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function criticalFingerprints(): Record<string, string> {
  return Object.fromEntries(CRITICAL_FILES.map(path => [path, sha256Text(readFileSync(path, 'utf8'))]));
}

function cohortOrder(asset: AssetUniverseItem): string {
  return sha256Text(`PHASE4_REENTRY_BLIND_R2:${asset.assetId}`);
}

function buildCohorts(): AssetUniverseItem[][] {
  const sorted = [...R2_FRESH].sort((a, b) => cohortOrder(a).localeCompare(cohortOrder(b)) || a.assetId.localeCompare(b.assetId));
  assertStaticSample(sorted);
  return Array.from({ length: COHORT_COUNT }, (_, index) => sorted.slice(index * FRESH_PER_COHORT, (index + 1) * FRESH_PER_COHORT));
}

function assertStaticSample(sorted: AssetUniverseItem[]): void {
  if (sorted.length !== COHORT_COUNT * FRESH_PER_COHORT) throw new Error(`PHASE4_R2_SAMPLE_SIZE_MISMATCH:${sorted.length}`);
  const ids = new Set(sorted.map(row => row.assetId));
  const tickers = new Set(sorted.map(row => row.ticker.toUpperCase()));
  if (ids.size !== sorted.length || tickers.size !== sorted.length) throw new Error('PHASE4_R2_DUPLICATE_SAMPLE_ID_OR_TICKER');
  const productTickers = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(row => row.ticker.toUpperCase()));
  const contaminated = sorted.filter(row => productTickers.has(row.ticker.toUpperCase()));
  if (contaminated.length) throw new Error(`PHASE4_R2_PREOPEN_PRODUCT_CATALOG_CONTAMINATION:${contaminated.map(row => row.ticker).join(',')}`);
}

function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function executedTradeCount(result: DynamicReplayExperimentResult): number {
  return result.signals.filter(signal => signal.executed && !signal.isInitialAllocation && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action)).length;
}

function barIntegrity(asset: { bars: Array<{ timestamp: string; open: number; high: number; low: number; close: number }> }): boolean {
  const dates = new Set<string>();
  for (const bar of asset.bars) {
    const date = String(bar.timestamp).slice(0, 10);
    if (dates.has(date)) return false;
    dates.add(date);
    if (![bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0)) return false;
    if (bar.high + 1e-9 < Math.max(bar.open, bar.close) || bar.low - 1e-9 > Math.min(bar.open, bar.close)) return false;
  }
  return true;
}

function baseReplayInput(dataset: DynamicHistoricalReplayInput['dataset'], catalog: AssetUniverseItem[]): DynamicHistoricalReplayInput {
  return {
    dataset,
    catalog,
    startDate: REPLAY_START_DATE,
    frequency: 'MONTHLY',
    initialCapitalEur: INITIAL_CAPITAL_EUR,
    riskProfile: 'MEDIUM',
    horizonYears: 3,
    cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    cashBenchmarkAnnualPct: 2.5,
    minimumBars: MINIMUM_BARS,
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

async function main() {
  const fingerprints = criticalFingerprints();
  const cohorts = buildCohorts();
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
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('PHASE4_R2_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    process.env.MARKET_DATA_INTERNAL_BASE_URL = process.env.MARKET_DATA_INTERNAL_BASE_URL || baseUrl;
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    // This is the one-shot boundary: the first call below opens R2. Nothing above
    // reads historical outcomes for the sealed names.
    const universe = [CORE, ...R2_FRESH];
    const scan = await AssetUniverseScanner.scan(universe, DATA_START_DATE, END_DATE, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 10,
      minimumBars: MINIMUM_BARS,
      maxDataAgeDays: 10,
      currentOpenDiscovery: false
    });

    const acceptedById = new Map(scan.candidates.filter(row => row.status === 'ACCEPTED').map(row => [row.asset.assetId, row]));
    const datasetById = new Map(scan.acceptedDataset.assets.map(asset => [asset.assetId, asset]));
    const nonReal = scan.acceptedDataset.assets.filter(asset => asset.provenance?.sourceType !== 'REAL');
    const currentDiscoveryLeak = scan.acceptedDataset.assets.filter(asset => asset.assetId.startsWith('OPEN_'));
    const malformed = scan.acceptedDataset.assets.filter(asset => !barIntegrity(asset));
    const coreSeries = datasetById.get(CORE.assetId);
    const coreBarsBeforeReplay = coreSeries?.bars.filter(bar => String(bar.timestamp).slice(0, 10) <= REPLAY_START_DATE).length ?? 0;

    const dataGate = cohorts.map((fresh, index) => {
      const acceptedFresh = fresh.filter(asset => acceptedById.has(asset.assetId));
      const rejectedFresh = fresh.filter(asset => !acceptedById.has(asset.assetId)).map(asset => ({
        assetId: asset.assetId,
        ticker: asset.ticker,
        reason: scan.candidates.find(row => row.asset.assetId === asset.assetId)?.reason ?? 'MISSING_FROM_SCAN'
      }));
      const valid = Boolean(acceptedById.has(CORE.assetId))
        && coreBarsBeforeReplay >= MINIMUM_BARS
        && acceptedFresh.length >= MIN_VALID_FRESH_PER_COHORT
        && nonReal.length === 0
        && currentDiscoveryLeak.length === 0
        && malformed.length === 0;
      return {
        cohort: index + 1,
        valid,
        coreAccepted: acceptedById.has(CORE.assetId),
        coreBarsBeforeReplay,
        freshRequested: fresh.map(asset => asset.ticker),
        freshAccepted: acceptedFresh.map(asset => asset.ticker),
        rejectedFresh
      };
    });

    if (dataGate.some(row => !row.valid)) {
      console.log(MARKER, JSON.stringify({
        version: VERSION,
        executedAt: new Date().toISOString(),
        sampleState: 'R2_OPENED_CONSUMED',
        verdict: 'INCONCLUSIVE_INVALID_DATA',
        fingerprints,
        scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts },
        dataGate,
        nonRealAssetIds: nonReal.map(row => row.assetId),
        currentDiscoveryLeakAssetIds: currentDiscoveryLeak.map(row => row.assetId),
        malformedAssetIds: malformed.map(row => row.assetId)
      }));
      return;
    }

    const cohortResults: any[] = [];
    for (let index = 0; index < cohorts.length; index++) {
      const fresh = cohorts[index];
      const ids = new Set([CORE.assetId, ...fresh.map(row => row.assetId)]);
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
        if (episode.reentryExecutionDate) reentryKeys.add(`${episode.assetId}|${episode.exitExecutionDate}|${episode.reentryExecutionDate}`);
      }
    }
    const reach = { uniqueExitReservations: exitKeys.size, uniqueReentries: reentryKeys.size, pass: exitKeys.size >= 12 && reentryKeys.size >= 6 };
    const deltas = cohortResults.map(row => row.finalValueDeltaEur as number);
    const ddDeteriorations = cohortResults.map(row => row.drawdownDeteriorationPctPoints as number);
    const frictionIncreases = cohortResults.map(row => row.frictionIncreaseEur as number);
    const positiveCohorts = deltas.filter(value => value > 0).length;
    const medianFinalValueDeltaEur = median(deltas);
    const medianDrawdownDeteriorationPctPoints = median(ddDeteriorations);
    const medianPositiveFrictionIncreaseEur = median(frictionIncreases);
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

    console.log(MARKER, JSON.stringify({
      version: VERSION,
      executedAt: new Date().toISOString(),
      sampleState: 'R2_OPENED_CONSUMED',
      verdict,
      fingerprints,
      protocol: {
        dataStartDate: DATA_START_DATE,
        replayStartDate: REPLAY_START_DATE,
        requestedEndDate: END_DATE,
        frequency: 'MONTHLY',
        initialCapitalEur: INITIAL_CAPITAL_EUR,
        riskProfile: 'MEDIUM',
        horizonYears: 3,
        cashBenchmarkMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
        taxContextConfirmed: false,
        productionDefault: 'LEGACY'
      },
      scanner: { scanned: scan.scanned, accepted: scan.accepted, rejected: scan.rejected, rejectionCounts: scan.rejectionCounts },
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
    }));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('PHASE4_REENTRY_CASH_CUSTODY_V1_ERROR', error?.stack || error);
  process.exitCode = 1;
});
