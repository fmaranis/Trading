import { spawn } from 'node:child_process';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import {
  EUR_ASSET_UNIVERSE,
  EUR_VALIDATION_HOLDOUT_UNIVERSE,
  type AssetUniverseItem
} from '../src/investment/decision/assetUniverse';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { runForwardRiskForecastV31 } from '../src/investment/decision/forwardRiskForecastV31';

const WARMUP_YEARS = 7;
const RANDOM_SEED = 31082026;
const COHORT_SIZE = 10;

// Deliberately excludes every period used by forwardRiskV31ValidationBatchLive.ts.
const UNSEEN_PERIODS = [
  { id: 'CHINA_OIL_2015_16', startDate: '2015-06-01', endDate: '2016-05-31', kind: 'STRESS' },
  { id: 'CALM_2017', startDate: '2017-01-01', endDate: '2017-12-31', kind: 'CONTROL' },
  { id: 'POST_TRAIN_2024', startDate: '2024-01-01', endDate: '2024-12-31', kind: 'OOS_RECENT' },
  { id: 'POST_TRAIN_2025', startDate: '2025-01-01', endDate: '2025-12-31', kind: 'OOS_RECENT' },
  { id: 'POST_TRAIN_2026_YTD', startDate: '2026-01-01', endDate: '2026-09-01', kind: 'OOS_RECENT' }
] as const;

const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const ANCHOR_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));
const RESEARCH_CATALOG = [...ANCHOR_CATALOG, ...EUR_VALIDATION_HOLDOUT_UNIVERSE];

function yearsBefore(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}
function isoDate(value: string): string { return value.slice(0, 10); }
function mean(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function hashString(value: string): number {
  let h = RANDOM_SEED | 0;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
function deterministicShuffle<T extends { assetId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hashString(a.assetId) - hashString(b.assetId) || a.assetId.localeCompare(b.assetId));
}
function trailingReturnPct(dataset: MultiAssetDataset, assetId: string, beforeDate: string, sessions = 252): number | null {
  const asset = dataset.assets.find(row => row.assetId === assetId);
  if (!asset) return null;
  const bars = asset.bars
    .filter(bar => isoDate(bar.timestamp) < beforeDate && bar.close > 0)
    .sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
  if (bars.length <= sessions) return null;
  const start = bars[bars.length - 1 - sessions].close;
  const end = bars[bars.length - 1].close;
  return start > 0 ? (end / start - 1) * 100 : null;
}
function subsetDataset(dataset: MultiAssetDataset, ids: Set<string>): MultiAssetDataset {
  return { timeframe: dataset.timeframe, assets: dataset.assets.filter(asset => ids.has(asset.assetId)) };
}
function cohortCatalog(ids: Set<string>): AssetUniverseItem[] { return RESEARCH_CATALOG.filter(asset => ids.has(asset.assetId)); }
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) throw new Error('Local server did not become healthy on port 3000');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const requestedFrom = yearsBefore(UNSEEN_PERIODS[0].startDate, WARMUP_YEARS);
    const finalEndDate = UNSEEN_PERIODS.at(-1)!.endDate;
    const scan = await AssetUniverseScanner.scan(RESEARCH_CATALOG, requestedFrom, finalEndDate, {
      forceRefresh: false, concurrency: 3, maxSelected: 80, minimumBars: 252, maxDataAgeDays: 7
    });
    const diagnostic = await loadForwardRiskDiagnosticData(requestedFrom, finalEndDate);

    const acceptedIds = new Set(scan.acceptedDataset.assets.map(asset => asset.assetId));
    const anchorIds = new Set(ANCHOR_CATALOG.filter(asset => acceptedIds.has(asset.assetId)).map(asset => asset.assetId));
    if (!anchorIds.has('EUNL')) throw new Error('HOLDOUT_VALIDATION_REQUIRES_EUNL_ANCHOR');

    const acceptedHoldout = deterministicShuffle(
      EUR_VALIDATION_HOLDOUT_UNIVERSE.filter(asset => acceptedIds.has(asset.assetId) && !asset.defensive)
    );
    const randomA = acceptedHoldout.slice(0, COHORT_SIZE);
    const randomB = acceptedHoldout.slice(COHORT_SIZE, COHORT_SIZE * 2);

    const cases = UNSEEN_PERIODS.flatMap(period => {
      const adverse = acceptedHoldout
        .map(asset => ({ asset, trailing: trailingReturnPct(scan.acceptedDataset, asset.assetId, period.startDate) }))
        .filter((row): row is { asset: AssetUniverseItem; trailing: number } => row.trailing != null)
        .sort((a, b) => a.trailing - b.trailing)
        .slice(0, COHORT_SIZE)
        .map(row => row.asset);

      const cohorts = [
        { id: 'RANDOM_A', selectionBasis: `DETERMINISTIC_SEED_${RANDOM_SEED}`, assets: randomA },
        { id: 'RANDOM_B', selectionBasis: `DETERMINISTIC_SEED_${RANDOM_SEED}`, assets: randomB },
        { id: 'PRE_PERIOD_WORST_12M', selectionBasis: 'WORST_TRAILING_252_BEFORE_PERIOD_START_NO_FUTURE_OUTCOME', assets: adverse }
      ];

      return cohorts.flatMap(cohort => {
        if (cohort.assets.length < 5) return [];
        const ids = new Set([...anchorIds, ...cohort.assets.map(asset => asset.assetId)]);
        const dataset = subsetDataset(scan.acceptedDataset, ids);
        const catalog = cohortCatalog(ids);
        const forecast = runForwardRiskForecastV31({
          dataset,
          diagnosticDataset: diagnostic.dataset,
          catalog,
          startDate: period.startDate,
          endDate: period.endDate
        });
        const metric20 = forecast.metrics.find(metric => metric.horizonSessions === 20) ?? null;
        const metric5 = forecast.metrics.find(metric => metric.horizonSessions === 5) ?? null;
        const metric60 = forecast.metrics.find(metric => metric.horizonSessions === 60) ?? null;
        return [{
          ...period,
          cohortId: cohort.id,
          selectionBasis: cohort.selectionBasis,
          cohortAssetIds: cohort.assets.map(asset => asset.assetId),
          status: forecast.status,
          forecastsEvaluated: forecast.forecastsEvaluated,
          predictiveSignalPass: forecast.predictiveSignalPass,
          anticipationPass: forecast.anticipationPass,
          anticipatedEpisodeRatePct: forecast.anticipatedEpisodeRatePct,
          medianLeadSessionsBeforePeak: forecast.medianLeadSessionsBeforePeak,
          metrics: { fiveDay: metric5, twentyDay: metric20, sixtyDay: metric60 }
        }];
      });
    });

    const valid20 = cases.flatMap(row => row.metrics.twentyDay?.auc == null ? [] : [row.metrics.twentyDay]);
    const direct20 = valid20.filter(metric => metric.orientation === 'DIRECT');
    const fpr20 = valid20.flatMap(metric => metric.highRiskFalsePositivePct == null ? [] : [metric.highRiskFalsePositivePct]);
    const anticipationRows = cases.filter(row => row.anticipatedEpisodeRatePct != null);
    const median20Auc = median(valid20.map(metric => metric.auc!));
    const direct20RatePct = valid20.length ? direct20.length / valid20.length * 100 : null;
    const mean20FalsePositivePct = mean(fpr20);
    const meanAnticipationPct = mean(anticipationRows.map(row => row.anticipatedEpisodeRatePct!));

    const verdict = valid20.length < 6
      ? 'INSUFFICIENT_HOLDOUT_DATA'
      : (median20Auc ?? 0) <= 0.5 || (direct20RatePct ?? 0) < 50
        ? 'RETIRE_V3_1_ARCHITECTURE'
        : (mean20FalsePositivePct ?? 100) > 80
          ? 'RESEARCH_SIGNAL_EXISTS_BUT_NOT_ACTIONABLE'
          : 'CANDIDATE_FOR_NEXT_RESEARCH_GATE';

    console.log('\nFORWARD_RISK_V31_ADVERSARIAL_HOLDOUT_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V3_1_ADVERSARIAL_HOLDOUT_UNSEEN_WINDOWS',
      warmupYears: WARMUP_YEARS,
      randomSeed: RANDOM_SEED,
      cohortSize: COHORT_SIZE,
      requestedFrom,
      finalEndDate,
      acceptedResearchAssets: scan.accepted,
      rejectedResearchAssets: scan.rejected,
      acceptedHoldoutAssets: acceptedHoldout.length,
      periods: UNSEEN_PERIODS,
      cases,
      aggregate: {
        caseCount: cases.length,
        valid20dCases: valid20.length,
        median20dAuc: median20Auc,
        direct20dCaseRatePct: direct20RatePct,
        mean20dHighRiskFalsePositivePct: mean20FalsePositivePct,
        meanEpisodeAnticipationPct: meanAnticipationPct,
        predictivePassCases: cases.filter(row => row.predictiveSignalPass).length,
        anticipationPassCases: cases.filter(row => row.anticipationPass).length
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        retireIf: 'median 20d AUC <= 0.50 OR fewer than 50% of valid 20d cases have DIRECT orientation',
        researchOnlyIf: 'direction survives holdout but mean 20d high-risk false-positive rate remains >80%',
        rationale: 'This gate changes universe and dates simultaneously. It is intended to decide whether V3.1 deserves more work, not to tune it.'
      },
      notes: [
        'None of the five windows from the previous V3.1 batch are reused.',
        'RANDOM_A and RANDOM_B are deterministic holdout cohorts selected independently of returns.',
        'PRE_PERIOD_WORST_12M uses only trailing data available before each evaluation window, so poor performers are selected without evaluation-period lookahead.',
        'Holdout instruments are excluded from the production universe and cannot influence live recommendations.',
        'V3.1 code, coefficients constraints, thresholds and production wiring remain untouched.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V31_ADVERSARIAL_HOLDOUT_FATAL', error);
  process.exit(1);
});
