import { spawn } from 'node:child_process';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting/types';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, EUR_VALIDATION_HOLDOUT_UNIVERSE, type AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { runForwardRiskRegimeShiftV4 } from '../src/investment/decision/forwardRiskRegimeShiftV4';

const RANDOM_SEED = 4062026;
const START_YEAR = 2011;
const END_YEAR = 2026;
const DATA_FROM = '2008-01-01';
const FINAL_END_DATE = '2026-09-01';
const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const ANCHOR_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));
const RESEARCH_CATALOG = [...ANCHOR_CATALOG, ...EUR_VALIDATION_HOLDOUT_UNIVERSE];

function isoDate(value: string): string { return value.slice(0, 10); }
function mean(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function hashString(value: string): number {
  let h = RANDOM_SEED | 0;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
function deterministicShuffle<T extends { assetId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => hashString(a.assetId) - hashString(b.assetId) || a.assetId.localeCompare(b.assetId));
}
function subsetDataset(dataset: MultiAssetDataset, ids: Set<string>): MultiAssetDataset {
  return { timeframe: dataset.timeframe, assets: dataset.assets.filter(asset => ids.has(asset.assetId)) };
}
function subsetCatalog(ids: Set<string>): AssetUniverseItem[] { return RESEARCH_CATALOG.filter(asset => ids.has(asset.assetId)); }
function years(): Array<{ id: string; startDate: string; endDate: string }> {
  const out: Array<{ id: string; startDate: string; endDate: string }> = [];
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    out.push({
      id: `YEAR_${year}`,
      startDate: `${year}-01-01`,
      endDate: year === END_YEAR ? FINAL_END_DATE : `${year}-12-31`
    });
  }
  return out;
}
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
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
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

    const scan = await AssetUniverseScanner.scan(RESEARCH_CATALOG, DATA_FROM, FINAL_END_DATE, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 80,
      minimumBars: 252,
      maxDataAgeDays: 7
    });
    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const acceptedIds = new Set(scan.acceptedDataset.assets.map(asset => asset.assetId));
    const anchorIds = new Set(ANCHOR_CATALOG.filter(asset => acceptedIds.has(asset.assetId)).map(asset => asset.assetId));
    if (!anchorIds.has('EUNL')) throw new Error('V4_ROLLING_GATE_REQUIRES_EUNL_ANCHOR');

    const holdout = deterministicShuffle(EUR_VALIDATION_HOLDOUT_UNIVERSE.filter(asset => acceptedIds.has(asset.assetId) && !asset.defensive));
    if (holdout.length < 10) throw new Error('V4_ROLLING_GATE_INSUFFICIENT_HOLDOUT');
    const split = Math.ceil(holdout.length / 2);
    const cohorts = [
      { id: 'HOLDOUT_ALL', assets: holdout },
      { id: 'HOLDOUT_A', assets: holdout.slice(0, split) },
      { id: 'HOLDOUT_B', assets: holdout.slice(split) }
    ];

    const cases = years().flatMap(period => cohorts.flatMap(cohort => {
      if (cohort.assets.length < 5) return [];
      const ids = new Set([...anchorIds, ...cohort.assets.map(asset => asset.assetId)]);
      const result = runForwardRiskRegimeShiftV4({
        dataset: subsetDataset(scan.acceptedDataset, ids),
        diagnosticDataset: diagnostic.dataset,
        startDate: period.startDate,
        endDate: period.endDate
      });
      return [{
        ...period,
        cohortId: cohort.id,
        cohortAssetIds: cohort.assets.map(asset => asset.assetId),
        status: result.status,
        forecastsEvaluated: result.forecastsEvaluated,
        observations20d: result.observations20d,
        eventRatePct: result.eventRatePct,
        auc20d: result.auc20d,
        orientation20d: result.orientation20d,
        highRiskForecasts: result.highRiskForecasts,
        highRiskPrecisionPct: result.highRiskPrecisionPct,
        highRiskFalsePositivePct: result.highRiskFalsePositivePct,
        auditableEpisodes: result.auditableEpisodes,
        anticipatedEpisodes: result.anticipatedEpisodes,
        anticipationRatePct: result.anticipationRatePct,
        medianLeadSessionsBeforePeak: result.medianLeadSessionsBeforePeak
      }];
    }));

    const valid = cases.filter(row => row.status === 'VALID' && row.auc20d != null);
    const aucs = valid.map(row => row.auc20d!);
    const directRatePct = valid.length ? valid.filter(row => row.orientation20d === 'DIRECT').length / valid.length * 100 : null;
    const fprs = valid.flatMap(row => row.highRiskFalsePositivePct == null ? [] : [row.highRiskFalsePositivePct]);
    const anticipation = valid.flatMap(row => row.anticipationRatePct == null ? [] : [row.anticipationRatePct]);
    const medianAuc = median(aucs);
    const meanFpr = mean(fprs);
    const meanAnticipation = mean(anticipation);

    const verdict = valid.length < 20
      ? 'INSUFFICIENT_ROLLING_HOLDOUT_DATA'
      : (medianAuc ?? 0) <= 0.50 || (directRatePct ?? 0) < 50
        ? 'RETIRE_V4_ARCHITECTURE'
        : (medianAuc ?? 0) < 0.55 || (meanFpr ?? 100) > 80
          ? 'V4_WEAK_OR_NOT_ACTIONABLE'
          : (directRatePct ?? 0) >= 60 && (meanAnticipation ?? 0) >= 50
            ? 'V4_CANDIDATE_FOR_ECONOMIC_GATE'
            : 'V4_RESEARCH_ONLY';

    console.log('\nFORWARD_RISK_V4_ROLLING_HOLDOUT_RESULT');
    console.log(JSON.stringify({
      methodology: 'LABEL_FREE_REGIME_SHIFT_ROLLING_ANNUAL_HOLDOUT_2011_2026',
      randomSeed: RANDOM_SEED,
      dataFrom: DATA_FROM,
      finalEndDate: FINAL_END_DATE,
      acceptedResearchAssets: scan.accepted,
      acceptedHoldoutAssets: holdout.length,
      annualWindowCount: years().length,
      cohortCount: cohorts.length,
      cases,
      aggregate: {
        caseCount: cases.length,
        validCases: valid.length,
        median20dAuc: medianAuc,
        mean20dAuc: mean(aucs),
        direct20dCaseRatePct: directRatePct,
        mean20dHighRiskFalsePositivePct: meanFpr,
        meanEpisodeAnticipationPct: meanAnticipation,
        totalAuditableEpisodes: valid.reduce((sum, row) => sum + row.auditableEpisodes, 0),
        totalAnticipatedEpisodes: valid.reduce((sum, row) => sum + row.anticipatedEpisodes, 0)
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        retireIf: 'median 20d AUC <= 0.50 OR DIRECT orientation in fewer than 50% of valid cases',
        weakIf: 'median 20d AUC < 0.55 OR mean high-risk false-positive rate > 80%',
        economicGateCandidateIf: 'median AUC >= 0.55, DIRECT rate >= 60%, false positives <= 80%, mean episode anticipation >= 50%',
        rationale: 'V4 has no supervised label fitting. This rolling gate covers every calendar year rather than cherry-picking named crises.'
      },
      notes: [
        'V4 score construction never reads future drawdown labels.',
        'The same fixed holdout cohorts are reused in every year; cohort membership is independent of annual outcomes.',
        'Every component is normalized only against its preceding history.',
        'No V4 result feeds Custodia, replay decisions, sizing or production alerts.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V4_ROLLING_HOLDOUT_FATAL', error);
  process.exit(1);
});
