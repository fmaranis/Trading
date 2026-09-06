import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';

const START_YEAR = 2011;
const END_YEAR = 2026;
const DATA_FROM = '2008-01-01';
const FINAL_END_DATE = '2026-09-01';
const CORE_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => asset.assetId === 'EUNL' || asset.ticker === 'EUNL.DE');

function years(): Array<{ id: string; startDate: string; endDate: string }> {
  const out: Array<{ id: string; startDate: string; endDate: string }> = [];
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    out.push({ id: `YEAR_${year}`, startDate: `${year}-01-01`, endDate: year === END_YEAR ? FINAL_END_DATE : `${year}-12-31` });
  }
  return out;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  if (CORE_CATALOG.length !== 1) throw new Error(`V7_REQUIRES_ONE_EUNL_CORE:${CORE_CATALOG.length}`);
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

    const scan = await AssetUniverseScanner.scan(CORE_CATALOG, DATA_FROM, FINAL_END_DATE, {
      forceRefresh: false,
      concurrency: 1,
      maxSelected: 1,
      minimumBars: 80,
      maxDataAgeDays: 7
    });
    const core = scan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V7_REQUIRES_EUNL_ANCHOR');

    const optionsData = await loadForwardRiskOptionsDataV7({ timeoutMs: 20_000 });
    const cases = years().map(period => {
      const result = runForwardRiskOptionsV7({
        coreBars: core.bars,
        optionsData,
        startDate: period.startDate,
        endDate: period.endDate
      });
      return {
        ...period,
        status: result.status,
        forecastsEvaluated: result.forecastsEvaluated,
        signalForecasts: result.signalForecasts,
        auditableEpisodes: result.auditableEpisodes,
        anticipatedEpisodes: result.anticipatedEpisodes,
        anticipationRatePct: result.anticipationRatePct,
        medianLeadSessionsBeforePeak: result.medianLeadSessionsBeforePeak,
        falseSignalTimePct: result.falseSignalTimePct,
        researchGatePass: result.researchGatePass,
        episodeAudits: result.episodeAudits
      };
    });

    const valid = cases.filter(row => row.status === 'VALID');
    const totalAuditableEpisodes = valid.reduce((sum, row) => sum + row.auditableEpisodes, 0);
    const totalAnticipatedEpisodes = valid.reduce((sum, row) => sum + row.anticipatedEpisodes, 0);
    const anticipationRatePct = totalAuditableEpisodes ? totalAnticipatedEpisodes / totalAuditableEpisodes * 100 : null;
    const leads = valid.flatMap(row => row.episodeAudits.flatMap(episode => episode.leadSessionsBeforePeak == null ? [] : [episode.leadSessionsBeforePeak]));
    const medianLeadSessionsBeforePeak = median(leads);
    const totalForecasts = valid.reduce((sum, row) => sum + row.forecastsEvaluated, 0);
    const estimatedFalseForecasts = valid.reduce((sum, row) => sum + (row.falseSignalTimePct == null ? 0 : row.falseSignalTimePct / 100 * row.forecastsEvaluated), 0);
    const falseSignalTimePct = totalForecasts ? estimatedFalseForecasts / totalForecasts * 100 : null;

    const screeningPass = valid.length >= 12
      && (anticipationRatePct ?? 0) >= 50
      && (medianLeadSessionsBeforePeak ?? 0) >= 10
      && (falseSignalTimePct ?? 100) <= 35;

    const verdict = valid.length < 12
      ? 'INSUFFICIENT_V7_DATA'
      : screeningPass
        ? 'V7_CANDIDATE_FOR_ECONOMIC_GATE'
        : 'RETIRE_V7_OPTIONS_IMPLIED_ARCHITECTURE';

    console.log('\nFORWARD_RISK_V7_OPTIONS_RESULT');
    console.log(JSON.stringify({
      methodology: 'PAST_ONLY_OPTIONS_IMPLIED_STRESS_ANNUAL_2011_2026',
      dataFrom: DATA_FROM,
      finalEndDate: FINAL_END_DATE,
      coreAssetId: core.assetId,
      coreTicker: core.ticker,
      optionsSource: optionsData.source,
      optionsSeries: Object.fromEntries(Object.entries(optionsData.series).map(([id, series]) => [id, {
        firstDate: series.firstDate,
        lastDate: series.lastDate,
        observations: series.points.length,
        source: series.source
      }])),
      annualWindowCount: years().length,
      cases,
      aggregate: {
        validCases: valid.length,
        totalAuditableEpisodes,
        totalAnticipatedEpisodes,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseSignalTimePct,
        gatePassYears: valid.filter(row => row.researchGatePass).length
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        screeningPassIf: 'anticipation >= 50% AND median lead >= 10 sessions AND false signal time <= 35%',
        nextIfPass: 'Build a causal economic protection counterfactual only after the anticipation gate passes.',
        rationale: 'V7 must show genuinely leading information from options-implied expectations; reactive volatility spikes are not enough.'
      },
      notes: [
        'No crisis years are selected by hand; every calendar year from 2011 through 2026 YTD is evaluated once.',
        'V7 uses no V4, V5 or V6 scores and no future drawdown labels, fitted coefficients or optimization grid.',
        'VIX, VIX9D and VVIX are official observed Cboe volatility-index histories; no synthetic fallback is allowed.',
        'The screening gate is identical to V6 and was frozen before V7 results exist.',
        'No V7 output feeds Custodia, replay decisions, sizing, alerts or production.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V7_OPTIONS_FATAL', error);
  process.exit(1);
});
