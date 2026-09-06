import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, EUR_VALIDATION_HOLDOUT_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { loadForwardRiskMacroDataV5 } from '../src/investment/decision/forwardRiskMacroDataV5';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { runForwardRiskComplementarityV8 } from '../src/investment/decision/forwardRiskComplementarityV8';

const START_YEAR = 2011;
const END_YEAR = 2026;
const DATA_FROM = '2008-01-01';
const FINAL_END_DATE = '2026-09-01';
const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const RESEARCH_CATALOG = [
  ...EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId)),
  ...EUR_VALIDATION_HOLDOUT_UNIVERSE
];

function years(): Array<{ id: string; startDate: string; endDate: string }> {
  const out: Array<{ id: string; startDate: string; endDate: string }> = [];
  for (let year = START_YEAR; year <= END_YEAR; year++) out.push({
    id: `YEAR_${year}`,
    startDate: `${year}-01-01`,
    endDate: year === END_YEAR ? FINAL_END_DATE : `${year}-12-31`
  });
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
      maxSelected: 80,
      minimumBars: 252,
      maxDataAgeDays: 7
    });
    const core = scan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V8_REQUIRES_EUNL_ANCHOR');

    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();

    const cases = years().map(period => {
      const v5 = runForwardRiskVulnerabilityV5({
        dataset: scan.acceptedDataset,
        diagnosticDataset: diagnostic.dataset,
        macroData: macro,
        startDate: period.startDate,
        endDate: period.endDate
      });
      const v7 = runForwardRiskOptionsV7({
        coreBars: core.bars,
        optionsData: options,
        startDate: period.startDate,
        endDate: period.endDate
      });
      const v8 = runForwardRiskComplementarityV8({ v5, v7 });
      return {
        ...period,
        status: v8.status,
        forecastsEvaluated: v8.forecastsEvaluated,
        combinedSignalForecasts: v8.combinedSignalForecasts,
        auditableEpisodes: v8.auditableEpisodes,
        anticipatedEpisodes: v8.anticipatedEpisodes,
        anticipationRatePct: v8.anticipationRatePct,
        medianLeadSessionsBeforePeak: v8.medianLeadSessionsBeforePeak,
        falseSignalTimePct: v8.falseSignalTimePct,
        v5OnlyEpisodes: v8.v5OnlyEpisodes,
        v7OnlyEpisodes: v8.v7OnlyEpisodes,
        bothEpisodes: v8.bothEpisodes,
        researchGatePass: v8.researchGatePass,
        episodeAudits: v8.episodeAudits
      };
    });

    const valid = cases.filter(row => row.status === 'VALID');
    const totalAuditableEpisodes = valid.reduce((sum, row) => sum + row.auditableEpisodes, 0);
    const totalAnticipatedEpisodes = valid.reduce((sum, row) => sum + row.anticipatedEpisodes, 0);
    const anticipationRatePct = totalAuditableEpisodes ? totalAnticipatedEpisodes / totalAuditableEpisodes * 100 : null;
    const leads = valid.flatMap(row => row.episodeAudits.flatMap(ep => ep.leadSessionsBeforePeak == null ? [] : [ep.leadSessionsBeforePeak]));
    const medianLeadSessionsBeforePeak = median(leads);
    const totalForecasts = valid.reduce((sum, row) => sum + row.forecastsEvaluated, 0);
    const estimatedFalseSignals = valid.reduce((sum, row) => sum + (row.falseSignalTimePct == null ? 0 : row.falseSignalTimePct / 100 * row.forecastsEvaluated), 0);
    const falseSignalTimePct = totalForecasts ? estimatedFalseSignals / totalForecasts * 100 : null;
    const v5OnlyEpisodes = valid.reduce((sum, row) => sum + row.v5OnlyEpisodes, 0);
    const v7OnlyEpisodes = valid.reduce((sum, row) => sum + row.v7OnlyEpisodes, 0);
    const bothEpisodes = valid.reduce((sum, row) => sum + row.bothEpisodes, 0);

    const diagnosticPass = valid.length >= 12
      && (anticipationRatePct ?? 0) >= 50
      && (medianLeadSessionsBeforePeak ?? 0) >= 10
      && (falseSignalTimePct ?? 100) <= 35;

    const verdict = valid.length < 12
      ? 'INSUFFICIENT_V8_DATA'
      : diagnosticPass
        ? 'V8_COMPLEMENTARITY_SIGNAL_FOUND_REQUIRES_INDEPENDENT_CONFIRMATION'
        : 'RETIRE_V5_V7_COMPLEMENTARITY_PATH';

    console.log('\nFORWARD_RISK_V8_COMPLEMENTARITY_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V5_OR_V7_COMPLEMENTARITY_ANNUAL_2011_2026',
      dataFrom: DATA_FROM,
      finalEndDate: FINAL_END_DATE,
      macroSource: macro.source,
      macroPointInTimeVintageSafe: macro.pointInTimeVintageSafe,
      optionsSource: options.source,
      annualWindowCount: years().length,
      cases,
      aggregate: {
        validCases: valid.length,
        totalAuditableEpisodes,
        totalAnticipatedEpisodes,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseSignalTimePct,
        v5OnlyEpisodes,
        v7OnlyEpisodes,
        bothEpisodes,
        gatePassYears: valid.filter(row => row.researchGatePass).length
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        diagnosticPassIf: 'anticipation >= 50% AND median lead >= 10 sessions AND false signal time <= 35%',
        thresholds: 'V5 >=80 OR V7 >=80; both inherited frozen thresholds with no retuning.',
        nextIfPass: 'Do NOT run an economic gate yet. First obtain independent confirmation because V8 was conceived after observing V5 and V7 on 2011-2026; macro also requires point-in-time vintage safety.',
        nextIfFail: 'Retire the V5+V7 complementarity path and move to a genuinely different information family.'
      },
      notes: [
        'V8 is a complementarity diagnostic, not a newly fitted predictor.',
        'No crisis years are selected by hand; every calendar year from 2011 through 2026 YTD is evaluated once.',
        'No threshold, lookback or component weight is changed from the frozen V5 and V7 architectures.',
        'No V8 output feeds Custodia, replay decisions, sizing, alerts or production.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V8_COMPLEMENTARITY_FATAL', error);
  process.exit(1);
});