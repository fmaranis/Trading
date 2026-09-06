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

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const EVENT_THRESHOLD_PCT = 5;
const PRE_PEAK_LOOKBACK_SESSIONS = 63;
const V5_SIGNAL_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;

// Fixed before results. These are validation-only global-equity instruments that do
// not participate in production allocation. They are used only as independent
// outcome benchmarks; they do not generate V8 signals.
const BENCHMARK_IDS = [
  'HOLDOUT_XDEM',
  'HOLDOUT_XDEV',
  'HOLDOUT_XDEQ',
  'HOLDOUT_XDEB',
  'HOLDOUT_IS3R',
  'HOLDOUT_IS3S'
] as const;

const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const RESEARCH_CATALOG = [
  ...EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId)),
  ...EUR_VALIDATION_HOLDOUT_UNIVERSE.filter(asset => BENCHMARK_IDS.includes(asset.assetId as (typeof BENCHMARK_IDS)[number]))
];

function isoDate(value: string): string { return value.slice(0, 10); }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function detectEpisodes(closes: number[]): Array<{ peakIndex: number; breachIndex: number }> {
  const out: Array<{ peakIndex: number; breachIndex: number }> = [];
  if (!closes.length) return out;
  let peak = closes[0];
  let peakIndex = 0;
  let inEpisode = false;
  for (let i = 1; i < closes.length; i++) {
    const value = closes[i];
    if (!inEpisode) {
      if (value >= peak) { peak = value; peakIndex = i; continue; }
      if ((value / peak - 1) * 100 <= -EVENT_THRESHOLD_PCT) {
        out.push({ peakIndex, breachIndex: i });
        inEpisode = true;
      }
    } else if (value >= peak) {
      peak = value;
      peakIndex = i;
      inEpisode = false;
    }
  }
  return out;
}
function firstSignalInBenchmarkWindow(signalDates: string[], dates: string[], startIndex: number, peakIndex: number): { date: string; lead: number } | null {
  const fromDate = dates[startIndex];
  const peakDate = dates[peakIndex];
  const signal = signalDates.find(date => date >= fromDate && date <= peakDate);
  if (!signal) return null;
  let signalSessionIndex = dates.findIndex(date => date >= signal);
  if (signalSessionIndex < startIndex) signalSessionIndex = startIndex;
  if (signalSessionIndex < 0 || signalSessionIndex > peakIndex) return null;
  return { date: signal, lead: peakIndex - signalSessionIndex };
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
      maxSelected: 40,
      minimumBars: 252,
      maxDataAgeDays: 7
    });
    const core = scan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V8_TRANSFER_REQUIRES_EUNL_SIGNAL_ANCHOR');

    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    const v5 = runForwardRiskVulnerabilityV5({
      dataset: scan.acceptedDataset,
      diagnosticDataset: diagnostic.dataset,
      macroData: macro,
      startDate: START_DATE,
      endDate: FINAL_END_DATE
    });
    const v7 = runForwardRiskOptionsV7({
      coreBars: core.bars,
      optionsData: options,
      startDate: START_DATE,
      endDate: FINAL_END_DATE
    });
    if (v5.status !== 'VALID' || v7.status !== 'VALID') throw new Error('V8_TRANSFER_REQUIRES_VALID_FROZEN_V5_V7');

    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point] as const));
    const signalDates = v5.points
      .filter(point => point.informationDate >= START_DATE && point.informationDate <= FINAL_END_DATE)
      .filter(point => {
        const optionPoint = v7ByDate.get(point.informationDate);
        return point.vulnerabilityScorePct >= V5_SIGNAL_SCORE_PCT || (optionPoint?.signalScorePct ?? -Infinity) >= V7_SIGNAL_SCORE_PCT;
      })
      .map(point => point.informationDate)
      .sort();

    const cases = BENCHMARK_IDS.map(assetId => {
      const asset = scan.acceptedDataset.assets.find(row => row.assetId === assetId);
      const catalog = EUR_VALIDATION_HOLDOUT_UNIVERSE.find(row => row.assetId === assetId)!;
      if (!asset) return { assetId, ticker: catalog.ticker, name: catalog.name, status: 'INSUFFICIENT_DATA' as const, reason: 'BENCHMARK_NOT_ACCEPTED' };
      const bars = [...asset.bars]
        .filter(bar => bar.open > 0 && bar.close > 0)
        .sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)))
        .filter(bar => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
      if (bars.length < 756) return { assetId, ticker: catalog.ticker, name: catalog.name, status: 'INSUFFICIENT_DATA' as const, reason: `ONLY_${bars.length}_BARS` };
      const dates = bars.map(bar => isoDate(bar.timestamp));
      const closes = bars.map(bar => bar.close);
      const episodes = detectEpisodes(closes);
      const prePeakSessionDates = new Set<string>();
      const episodeAudits: Array<{ peakDate: string; breachDate: string; firstSignalDate: string | null; leadSessionsBeforePeak: number | null }> = [];
      const leads: number[] = [];
      let anticipated = 0;
      for (const episode of episodes) {
        const start = Math.max(0, episode.peakIndex - PRE_PEAK_LOOKBACK_SESSIONS);
        for (let i = start; i <= episode.peakIndex; i++) prePeakSessionDates.add(dates[i]);
        const first = firstSignalInBenchmarkWindow(signalDates, dates, start, episode.peakIndex);
        if (first) { anticipated++; leads.push(first.lead); }
        episodeAudits.push({
          peakDate: dates[episode.peakIndex],
          breachDate: dates[episode.breachIndex],
          firstSignalDate: first?.date ?? null,
          leadSessionsBeforePeak: first?.lead ?? null
        });
      }
      const signalSessions = signalDates.filter(date => dates.includes(date));
      const falseSignalSessions = signalSessions.filter(date => !prePeakSessionDates.has(date));
      const anticipationRatePct = episodeAudits.length ? anticipated / episodeAudits.length * 100 : null;
      const medianLeadSessionsBeforePeak = median(leads);
      const falseSignalTimePct = dates.length ? falseSignalSessions.length / dates.length * 100 : null;
      const gatePass = (anticipationRatePct ?? 0) >= 50
        && (medianLeadSessionsBeforePeak ?? 0) >= 10
        && (falseSignalTimePct ?? 100) <= 35;
      return {
        assetId,
        ticker: catalog.ticker,
        name: catalog.name,
        status: 'VALID' as const,
        firstDate: dates[0],
        lastDate: dates.at(-1),
        sessions: dates.length,
        auditableEpisodes: episodeAudits.length,
        anticipatedEpisodes: anticipated,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseSignalTimePct,
        gatePass,
        episodeAudits
      };
    });

    const valid = cases.filter((row): row is Extract<(typeof cases)[number], { status: 'VALID' }> => row.status === 'VALID');
    const totalAuditableEpisodes = valid.reduce((sum, row) => sum + row.auditableEpisodes, 0);
    const totalAnticipatedEpisodes = valid.reduce((sum, row) => sum + row.anticipatedEpisodes, 0);
    const anticipationRatePct = totalAuditableEpisodes ? totalAnticipatedEpisodes / totalAuditableEpisodes * 100 : null;
    const leads = valid.flatMap(row => row.episodeAudits.flatMap(ep => ep.leadSessionsBeforePeak == null ? [] : [ep.leadSessionsBeforePeak]));
    const medianLeadSessionsBeforePeak = median(leads);
    const totalSessions = valid.reduce((sum, row) => sum + row.sessions, 0);
    const estimatedFalseSignals = valid.reduce((sum, row) => sum + (row.falseSignalTimePct == null ? 0 : row.falseSignalTimePct / 100 * row.sessions), 0);
    const falseSignalTimePct = totalSessions ? estimatedFalseSignals / totalSessions * 100 : null;
    const transferPass = valid.length >= 3
      && (anticipationRatePct ?? 0) >= 50
      && (medianLeadSessionsBeforePeak ?? 0) >= 10
      && (falseSignalTimePct ?? 100) <= 35;

    const verdict = valid.length < 3
      ? 'INSUFFICIENT_V8_BENCHMARK_TRANSFER_DATA'
      : transferPass
        ? 'V8_CROSS_BENCHMARK_CONFIRMATION_PASS_STILL_REQUIRES_VINTAGE_SAFE_MACRO'
        : 'V8_CROSS_BENCHMARK_CONFIRMATION_FAIL';

    console.log('\nFORWARD_RISK_V8_BENCHMARK_TRANSFER_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V8_SIGNAL_TRANSFER_TO_PREDECLARED_HOLDOUT_GLOBAL_EQUITY_BENCHMARKS',
      signalDefinition: 'V5 vulnerability >=80 OR V7 options >=80; unchanged from V8.',
      outcomeBenchmarks: [...BENCHMARK_IDS],
      dataFrom: DATA_FROM,
      startDate: START_DATE,
      finalEndDate: FINAL_END_DATE,
      macroSource: macro.source,
      macroPointInTimeVintageSafe: macro.pointInTimeVintageSafe,
      optionsSource: options.source,
      combinedSignalDates: signalDates.length,
      cases,
      aggregate: {
        validBenchmarks: valid.length,
        totalAuditableEpisodes,
        totalAnticipatedEpisodes,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseSignalTimePct,
        benchmarkGatePasses: valid.filter(row => row.gatePass).length
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        transferPassIf: 'at least 3 valid benchmarks AND aggregate anticipation >=50% AND median lead >=10 sessions AND false signal time <=35%',
        thresholdsRetuned: false,
        caveat: 'This is independent outcome-benchmark confirmation, not a new temporal holdout. Current-vintage FRED macro still blocks production/economic promotion.'
      },
      notes: [
        'The six benchmark IDs were fixed before this transfer result and come from EUR_VALIDATION_HOLDOUT_UNIVERSE, outside production allocation.',
        'Benchmark prices are outcomes only; they do not generate or tune V5/V7/V8 signals.',
        'No V8 output feeds Custodia, replay decisions, sizing, alerts or production.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V8_BENCHMARK_TRANSFER_FATAL', error);
  process.exit(1);
});
