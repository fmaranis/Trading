import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { loadForwardRiskMacroDataV5VintageSafe } from '../src/investment/decision/forwardRiskMacroDataV5VintageSafe';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const V5_SIGNAL_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;
const ANCHOR_IDS = new Set(['EUNL','VAGF','EUNA','IBCI','EUN6','DBX0AN','XEON','4GLD','SGLD','AIGC','WCOA']);
const RESEARCH_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));

function isoDate(value: string): string { return value.slice(0, 10); }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b); const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
}
function mean(values: number[]): number | null { return values.length ? values.reduce((a,b) => a+b,0) / values.length : null; }
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

type SessionState = { date: string; active: boolean; v5: number | null; v7: number | null; source: 'NONE'|'V5_ONLY'|'V7_ONLY'|'BOTH' };
type Run = { state: 'ON'|'OFF'; startDate: string; endDate: string; sessions: number };
function buildRuns(states: SessionState[]): Run[] {
  if (!states.length) return [];
  const out: Run[] = [];
  let start = 0;
  for (let i = 1; i <= states.length; i++) {
    if (i === states.length || states[i].active !== states[start].active) {
      out.push({ state: states[start].active ? 'ON' : 'OFF', startDate: states[start].date, endDate: states[i-1].date, sessions: i-start });
      start = i;
    }
  }
  return out;
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run','dev'], { stdio: ['ignore','pipe','pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) throw new Error('Local server did not become healthy on port 3000');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(RESEARCH_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 3, maxSelected: 20, minimumBars: 252, maxDataAgeDays: 7 });
    const core = scan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V8_FRAGMENTATION_REQUIRES_EUNL');

    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    const v5 = runForwardRiskVulnerabilityV5({ dataset: scan.acceptedDataset, diagnosticDataset: diagnostic.dataset, macroData: macro, startDate: START_DATE, endDate: FINAL_END_DATE });
    const v7 = runForwardRiskOptionsV7({ coreBars: core.bars, optionsData: options, startDate: START_DATE, endDate: FINAL_END_DATE });
    if (v5.status !== 'VALID' || v7.status !== 'VALID' || !macro.pointInTimeVintageSafe) throw new Error('V8_FRAGMENTATION_REQUIRES_VALID_VINTAGE_SAFE_V5_V7');

    const v5ByDate = new Map(v5.points.map(point => [point.informationDate, point.vulnerabilityScorePct] as const));
    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point.signalScorePct] as const));
    const dates = core.bars.map(bar => isoDate(bar.timestamp)).filter(date => date >= START_DATE && date <= FINAL_END_DATE);
    const states: SessionState[] = dates.map(date => {
      const s5 = v5ByDate.get(date) ?? null; const s7 = v7ByDate.get(date) ?? null;
      const a5 = (s5 ?? -Infinity) >= V5_SIGNAL_SCORE_PCT; const a7 = (s7 ?? -Infinity) >= V7_SIGNAL_SCORE_PCT;
      return { date, active: a5 || a7, v5: s5, v7: s7, source: a5 && a7 ? 'BOTH' : a5 ? 'V5_ONLY' : a7 ? 'V7_ONLY' : 'NONE' };
    });
    const runs = buildRuns(states);
    const onRuns = runs.filter(run => run.state === 'ON');
    const offRuns = runs.filter(run => run.state === 'OFF');
    const activeSessions = states.filter(row => row.active);
    const transitions = Math.max(0, runs.length - 1);
    const activationsByYear: Record<string, number> = {};
    for (const run of onRuns) activationsByYear[run.startDate.slice(0,4)] = (activationsByYear[run.startDate.slice(0,4)] ?? 0) + 1;
    const sourceCounts = activeSessions.reduce((acc,row) => { acc[row.source] = (acc[row.source] ?? 0) + 1; return acc; }, {} as Record<string,number>);
    const short = (n: number) => onRuns.filter(run => run.sessions <= n).length;
    const shortOff = (n: number) => offRuns.filter(run => run.sessions <= n).length;
    const verdict = onRuns.length >= 20 && short(3) / Math.max(1,onRuns.length) >= 0.40
      ? 'V8_SIGNAL_FRAGMENTATION_CONFIRMED_DIAGNOSTIC_ONLY'
      : 'V8_SIGNAL_FRAGMENTATION_NOT_DOMINANT_DIAGNOSTIC_ONLY';

    console.log('\nFORWARD_RISK_V8_FRAGMENTATION_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V8_VINTAGE_SAFE_SIGNAL_STATE_FRAGMENTATION_DIAGNOSTIC_NO_POLICY_TUNING',
      signalDefinition: 'V5 vulnerability >=80 OR V7 options >=80; unchanged.',
      macroSource: macro.source,
      macroPointInTimeVintageSafe: macro.pointInTimeVintageSafe,
      sessions: states.length,
      activeSessions: activeSessions.length,
      activeTimePct: states.length ? activeSessions.length / states.length * 100 : null,
      transitions,
      activationRuns: onRuns.length,
      onRunSessions: {
        median: median(onRuns.map(run => run.sessions)),
        mean: mean(onRuns.map(run => run.sessions)),
        max: onRuns.length ? Math.max(...onRuns.map(run => run.sessions)) : null,
        oneSessionRuns: short(1),
        upTo3SessionRuns: short(3),
        upTo5SessionRuns: short(5),
        upTo3Pct: onRuns.length ? short(3) / onRuns.length * 100 : null,
        upTo5Pct: onRuns.length ? short(5) / onRuns.length * 100 : null
      },
      offRunSessions: {
        median: median(offRuns.map(run => run.sessions)),
        mean: mean(offRuns.map(run => run.sessions)),
        oneSessionRuns: shortOff(1),
        upTo3SessionRuns: shortOff(3),
        upTo5SessionRuns: shortOff(5)
      },
      activeSignalSourceSessions: sourceCounts,
      activationsByYear,
      runs,
      verdict,
      decisionRule: {
        diagnosticOnly: true,
        thresholdsRetuned: false,
        policyRetuned: false,
        productionPromotionAllowed: false,
        fragmentationFlagIf: 'at least 20 ON runs AND at least 40% of ON runs last <=3 market sessions',
        nextIfConfirmed: 'Treat V8 as potentially informative regime evidence but not as a direct transaction switch; design any future state-machine/hysteresis concept only on a new predeclared validation protocol.'
      },
      notes: [
        'This job measures the frozen V8 boolean state on actual EUNL market sessions; it does not simulate trades or optimize any parameter.',
        'Short ON/OFF runs quantify chattering around the frozen 80/80 thresholds without changing those thresholds.',
        'A fragmentation diagnosis does not rehabilitate the failed 25% economic policy and cannot promote V8 to production.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => { console.error('FORWARD_RISK_V8_FRAGMENTATION_FATAL', error); process.exit(1); });
