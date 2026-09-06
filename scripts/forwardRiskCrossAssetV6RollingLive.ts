import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, EUR_VALIDATION_HOLDOUT_UNIVERSE, type AssetUniverseCategory } from '../src/investment/decision/assetUniverse';
import { runForwardRiskCrossAssetV6 } from '../src/investment/decision/forwardRiskCrossAssetV6';

const START_YEAR = 2011;
const END_YEAR = 2026;
const DATA_FROM = '2008-01-01';
const FINAL_END_DATE = '2026-09-01';

const RISK_SENSITIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'US_EQUITY',
  'EUROPE_EQUITY',
  'JAPAN_EQUITY',
  'EMERGING_EQUITY',
  'SMALL_CAP',
  'TECHNOLOGY',
  'SEMICONDUCTORS',
  'ENERGY'
]);
const DEFENSIVE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GOV_BONDS',
  'CORP_BONDS',
  'AGG_BONDS',
  'MONEY_MARKET',
  'GOLD',
  'COMMODITIES'
]);
const RESEARCH_CATALOG = [...EUR_ASSET_UNIVERSE, ...EUR_VALIDATION_HOLDOUT_UNIVERSE];

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
      maxSelected: 100,
      minimumBars: 80,
      maxDataAgeDays: 7
    });
    if (!scan.acceptedDataset.assets.some(asset => asset.assetId === 'EUNL')) throw new Error('V6_REQUIRES_EUNL_ANCHOR');

    const acceptedIds = new Set(scan.acceptedDataset.assets.map(asset => asset.assetId));
    const riskSensitiveAssetIds = RESEARCH_CATALOG
      .filter(asset => acceptedIds.has(asset.assetId) && RISK_SENSITIVE_CATEGORIES.has(asset.category))
      .map(asset => asset.assetId);
    const defensiveAssetIds = RESEARCH_CATALOG
      .filter(asset => acceptedIds.has(asset.assetId) && (asset.defensive === true || DEFENSIVE_CATEGORIES.has(asset.category)))
      .map(asset => asset.assetId);

    if (riskSensitiveAssetIds.length < 4) throw new Error(`V6_INSUFFICIENT_RISK_ASSETS:${riskSensitiveAssetIds.length}`);
    if (defensiveAssetIds.length < 3) throw new Error(`V6_INSUFFICIENT_DEFENSIVE_ASSETS:${defensiveAssetIds.length}`);

    const cases = years().map(period => {
      const result = runForwardRiskCrossAssetV6({
        dataset: scan.acceptedDataset,
        startDate: period.startDate,
        endDate: period.endDate,
        riskSensitiveAssetIds,
        defensiveAssetIds
      });
      return {
        ...period,
        status: result.status,
        forecastsEvaluated: result.forecastsEvaluated,
        divergenceForecasts: result.divergenceForecasts,
        auditableEpisodes: result.auditableEpisodes,
        anticipatedEpisodes: result.anticipatedEpisodes,
        anticipationRatePct: result.anticipationRatePct,
        medianLeadSessionsBeforePeak: result.medianLeadSessionsBeforePeak,
        falseDivergenceTimePct: result.falseDivergenceTimePct,
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
    const estimatedFalseForecasts = valid.reduce((sum, row) => sum + (row.falseDivergenceTimePct == null ? 0 : row.falseDivergenceTimePct / 100 * row.forecastsEvaluated), 0);
    const falseDivergenceTimePct = totalForecasts ? estimatedFalseForecasts / totalForecasts * 100 : null;

    const screeningPass = valid.length >= 12
      && (anticipationRatePct ?? 0) >= 50
      && (medianLeadSessionsBeforePeak ?? 0) >= 10
      && (falseDivergenceTimePct ?? 100) <= 35;

    const verdict = valid.length < 12
      ? 'INSUFFICIENT_V6_DATA'
      : screeningPass
        ? 'V6_CANDIDATE_FOR_COMPLEMENTARITY_GATE'
        : 'RETIRE_V6_CROSS_ASSET_ARCHITECTURE';

    console.log('\nFORWARD_RISK_V6_CROSS_ASSET_RESULT');
    console.log(JSON.stringify({
      methodology: 'PAST_ONLY_CROSS_ASSET_DIVERGENCE_ANNUAL_2011_2026',
      dataFrom: DATA_FROM,
      finalEndDate: FINAL_END_DATE,
      acceptedResearchAssets: scan.accepted,
      riskSensitiveAssetCount: riskSensitiveAssetIds.length,
      defensiveAssetCount: defensiveAssetIds.length,
      riskSensitiveAssetIds,
      defensiveAssetIds,
      annualWindowCount: years().length,
      cases,
      aggregate: {
        validCases: valid.length,
        totalAuditableEpisodes,
        totalAnticipatedEpisodes,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseDivergenceTimePct,
        gatePassYears: valid.filter(row => row.researchGatePass).length
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        screeningPassIf: 'anticipation >= 50% AND median lead >= 10 sessions AND false divergence time <= 35%',
        nextIfPass: 'Compare V6 episode coverage against the already-frozen V5 vulnerability episode coverage before any economic gate.',
        rationale: 'V6 must add genuinely leading cross-asset information. It is not allowed to pass merely because it reacts during an equity drawdown.'
      },
      notes: [
        'No crisis years are selected by hand; every calendar year from 2011 through 2026 YTD is evaluated once.',
        'V6 uses no future drawdown labels, fitted coefficients, optimization grid, V4 score or V5 score.',
        'Risk-sensitive weakness and defensive outperformance are measured relative to the global core, then normalized only against preceding history.',
        'No V6 output feeds Custodia, replay decisions, sizing, alerts or production.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V6_CROSS_ASSET_FATAL', error);
  process.exit(1);
});
