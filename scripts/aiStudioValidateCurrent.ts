import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  CurrentOpportunityAlertEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  PortfolioCandidateGate
} from '../src/investment/decision';

function runCommand(label: string, script: string): Promise<{ ok: boolean; exitCode: number | null; ms: number; tail: string }> {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn('npm', ['run', script], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', d => { output += String(d); });
    child.stderr.on('data', d => { output += String(d); });
    child.on('close', code => resolve({ ok: code === 0, exitCode: code, ms: Date.now() - started, tail: output.trim().split(/\r?\n/).filter(Boolean).slice(-10).join('\n') }));
    child.on('error', err => resolve({ ok: false, exitCode: null, ms: Date.now() - started, tail: `${label}: ${err.message}` }));
  });
}
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function sevenYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 7); return isoDate(d); }

async function main() {
  const report: any = {
    generatedAt: new Date().toISOString(),
    mode: 'CURRENT_ARCHITECTURE_ZERO_LLM_VALIDATION',
    commands: {},
    productionDiscovery: null,
    currentOpportunityAlerts: null,
    brokerAvailabilityPolicy: 'ASSUME_AVAILABLE_UNLESS_USER_MARKS_UNAVAILABLE',
    technicalBlockers: [] as string[],
    researchReady: false,
    readyForManualPilot: false
  };

  for (const [key, script] of [
    ['lint', 'lint'],
    ['build', 'build'],
    ['decisionTests', 'test:decision'],
    ['decisionBacktestTests', 'test:decision-backtest'],
    ['causalUniverseBacktestTests', 'test:causal-universe-backtest'],
    ['brokerExecutionTests', 'test:broker-execution'],
    ['executionFidelityTests', 'test:execution-fidelity'],
    ['opportunityOutcomeTests', 'test:opportunity-outcomes'],
    ['multiAssetTests', 'test:multi-asset'],
    ['portfolioAnalyticsTests', 'test:portfolio-analytics'],
    ['regimeTests', 'test:regimes']
  ] as const) {
    const result = await runCommand(key, script);
    report.commands[key] = result;
    if (!result.ok) report.technicalBlockers.push(`${key} failed (exit ${result.exitCode})`);
  }
  if (report.technicalBlockers.length) {
    console.log('\nAI_STUDIO_VALIDATION_RESULT');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) {
      report.technicalBlockers.push('Local server did not become healthy on port 3000');
      server.kill('SIGTERM');
      console.log('\nAI_STUDIO_VALIDATION_RESULT');
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, sevenYearsAgo(), isoDate(new Date()), {
      forceRefresh: true, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7
    });
    const gate = PortfolioCandidateGate.apply(scan, 2.5, 12);
    const alerts = CurrentOpportunityAlertEngine.evaluate(scan, 2.5);
    report.productionDiscovery = {
      configured: EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length,
      scanned: scan.scanned,
      accepted: scan.accepted,
      rejected: scan.rejected,
      cashConsensusEligible: gate.eligibleCount,
      allocatorSelected: gate.selectedCount,
      selected: gate.scan.selected.map(c => ({ ticker: c.asset.ticker, score: c.score, momentum120Pct: c.momentum120Pct }))
    };
    report.currentOpportunityAlerts = {
      totalValidEntries: alerts.length,
      highConviction: alerts.filter(a => a.level === 'HIGH_CONVICTION').length,
      goodEntries: alerts.filter(a => a.level === 'GOOD_ENTRY').length,
      top: alerts.slice(0, 10).map(a => ({ ticker: a.ticker, level: a.level, consensusScore: a.consensusScore, favorableVotes: a.favorableVotes, excessVsCashPctPoints: a.excessVsCashPctPoints }))
    };
    if (scan.accepted < 2) report.technicalBlockers.push('Expanded production discovery returned fewer than two accepted REAL assets.');
  } catch (err: any) {
    report.technicalBlockers.push(`current live validation failed: ${err?.message || String(err)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }

  report.researchReady = report.technicalBlockers.length === 0;
  report.readyForManualPilot = report.researchReady;
  console.log('\nAI_STUDIO_VALIDATION_RESULT');
  console.log(JSON.stringify(report, null, 2));
  if (!report.researchReady) process.exitCode = 1;
}

main().catch(err => { console.error('AI_STUDIO_VALIDATION_FATAL', err); process.exit(1); });
