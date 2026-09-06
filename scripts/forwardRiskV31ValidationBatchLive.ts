import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { runForwardRiskForecastV31 } from '../src/investment/decision/forwardRiskForecastV31';

const WARMUP_YEARS = 7;
const PERIODS = [
  { id: 'Q4_2018_CORRECTION', startDate: '2018-06-01', endDate: '2019-05-31', kind: 'STRESS' },
  { id: 'PRE_COVID_CALM', startDate: '2019-01-01', endDate: '2019-12-31', kind: 'CONTROL' },
  { id: 'COVID_2020', startDate: '2019-09-01', endDate: '2020-08-31', kind: 'STRESS' },
  { id: 'BEAR_2022', startDate: '2021-09-01', endDate: '2022-08-31', kind: 'STRESS' },
  { id: 'CALM_RECOVERY_2023', startDate: '2023-01-01', endDate: '2023-12-31', kind: 'CONTROL' }
] as const;

function yearsBefore(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

    // One shared historical scan and one diagnostic-data load for the whole batch.
    // This avoids repeating the expensive seven-year warm-up for every validation period.
    const requestedFrom = yearsBefore(PERIODS[0].startDate, WARMUP_YEARS);
    const finalEndDate = PERIODS.at(-1)!.endDate;
    const scan = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, requestedFrom, finalEndDate, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 60,
      minimumBars: 252,
      maxDataAgeDays: 7
    });
    const diagnostic = await loadForwardRiskDiagnosticData(requestedFrom, finalEndDate);

    const cases = PERIODS.map(period => {
      const forecast = runForwardRiskForecastV31({
        dataset: scan.acceptedDataset,
        diagnosticDataset: diagnostic.dataset,
        catalog: EUR_ASSET_UNIVERSE,
        startDate: period.startDate,
        endDate: period.endDate
      });
      const metrics = forecast.metrics.map(metric => ({
        horizonSessions: metric.horizonSessions,
        observations: metric.observations,
        eventRatePct: metric.eventRatePct,
        auc: metric.auc,
        orientation: metric.orientation,
        highRiskForecasts: metric.highRiskForecasts,
        highRiskPrecisionPct: metric.highRiskPrecisionPct,
        highRiskFalsePositivePct: metric.highRiskFalsePositivePct
      }));
      const anticipated = forecast.episodeAudits.filter(row => row.anticipatedBeforePeak);
      return {
        ...period,
        status: forecast.status,
        coreTicker: forecast.coreTicker,
        forecastsEvaluated: forecast.forecastsEvaluated,
        predictiveSignalPass: forecast.predictiveSignalPass,
        anticipationPass: forecast.anticipationPass,
        anticipatedEpisodeRatePct: forecast.anticipatedEpisodeRatePct,
        medianLeadSessionsBeforePeak: forecast.medianLeadSessionsBeforePeak,
        metrics,
        episodes: forecast.episodeAudits,
        anticipatedEpisodes: anticipated.length
      };
    });

    const allMetrics = cases.flatMap(row => row.metrics);
    const directAucs = allMetrics.filter(row => row.orientation === 'DIRECT' && row.auc != null).map(row => row.auc!);
    const falsePositiveRates = allMetrics.filter(row => row.highRiskFalsePositivePct != null).map(row => row.highRiskFalsePositivePct!);
    const stressCases = cases.filter(row => row.kind === 'STRESS');
    const controlCases = cases.filter(row => row.kind === 'CONTROL');
    const stressEpisodes = stressCases.flatMap(row => row.episodes);
    const controlHighRiskForecasts = controlCases.reduce((sum, row) => sum + row.metrics.reduce((s, metric) => s + metric.highRiskForecasts, 0), 0);

    console.log('\nFORWARD_RISK_V31_VALIDATION_BATCH_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V3_1_MULTI_PERIOD_OOS_RESEARCH_ONLY',
      warmupYears: WARMUP_YEARS,
      requestedFrom,
      finalEndDate,
      sharedAcceptedUniverse: scan.accepted,
      sharedRejectedUniverse: scan.rejected,
      periods: cases,
      aggregate: {
        periodCount: cases.length,
        stressPeriodCount: stressCases.length,
        controlPeriodCount: controlCases.length,
        predictivePassCases: cases.filter(row => row.predictiveSignalPass).length,
        anticipationPassCases: cases.filter(row => row.anticipationPass).length,
        stressEpisodes: stressEpisodes.length,
        stressEpisodesAnticipated: stressEpisodes.filter(row => row.anticipatedBeforePeak).length,
        stressEpisodeAnticipationRatePct: stressEpisodes.length ? stressEpisodes.filter(row => row.anticipatedBeforePeak).length / stressEpisodes.length * 100 : null,
        medianStressLeadSessions: median(stressEpisodes.flatMap(row => row.leadSessionsBeforePeak == null ? [] : [row.leadSessionsBeforePeak])),
        meanDirectAuc: mean(directAucs),
        meanHighRiskFalsePositivePct: mean(falsePositiveRates),
        controlHighRiskForecasts
      },
      decisionRule: {
        productionPromotionAllowed: false,
        rationale: 'Research batch only. V3.1 remains isolated from Custodia regardless of result; promotion requires robust multi-period OOS evidence plus an economic counterfactual.'
      },
      notes: [
        'The V3.1 model and thresholds are frozen for this batch; no parameter is fitted to these periods.',
        'Stress and control periods are declared in code before outcomes are calculated.',
        'The expensive historical universe scan and VIX/VIX3M diagnostic load are shared across all cases.',
        'The batch measures anticipation and false positives. Economic money-saved validation remains a separate required gate.',
        'No result from this script feeds live decisions, Custodia, or replay portfolio actions.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V31_VALIDATION_BATCH_FATAL', error);
  process.exit(1);
});
