import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner, DecisionBacktestEngine, EUR_ASSET_UNIVERSE, InvestmentDecisionEngine, InvestorRiskProfile } from '../src/investment/decision';

function runCommand(label: string, command: string, args: string[]): Promise<{ ok: boolean; exitCode: number | null; ms: number; tail: string }> {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', d => { output += String(d); });
    child.stderr.on('data', d => { output += String(d); });
    child.on('close', code => {
      const lines = output.trim().split(/\r?\n/).filter(Boolean);
      resolve({ ok: code === 0, exitCode: code, ms: Date.now() - started, tail: lines.slice(-12).join('\n') });
    });
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

async function main() {
  const report: any = { generatedAt: new Date().toISOString(), mode: 'ZERO_LLM_DETERMINISTIC_VALIDATION', commands: {}, universeScan: null, decisions: {}, backtest: null, blockers: [] as string[] };

  for (const [key, script] of [
    ['lint', 'lint'], ['decisionTests', 'test:decision'], ['decisionBacktestTests', 'test:decision-backtest'], ['multiAssetTests', 'test:multi-asset'], ['portfolioAnalyticsTests', 'test:portfolio-analytics'], ['regimeTests', 'test:regimes'], ['build', 'build']
  ] as const) {
    const result = await runCommand(key, 'npm', ['run', script]);
    report.commands[key] = result;
    if (!result.ok) report.blockers.push(`${key} failed (exit ${result.exitCode})`);
  }
  if (report.blockers.length) {
    console.log('\nAI_STUDIO_VALIDATION_RESULT'); console.log(JSON.stringify(report, null, 2)); process.exitCode = 1; return;
  }

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) {
      report.blockers.push('Local server did not become healthy on port 3000');
      server.kill('SIGTERM'); console.log('\nAI_STUDIO_VALIDATION_RESULT'); console.log(JSON.stringify(report, null, 2)); process.exitCode = 1; return;
    }
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const end = new Date();
    const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 7);
    const scan = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, isoDate(start), isoDate(end), { forceRefresh: true, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 });

    report.universeScan = {
      catalogSize: EUR_ASSET_UNIVERSE.length,
      scanned: scan.scanned,
      accepted: scan.accepted,
      rejected: scan.rejected,
      rejectionCounts: scan.rejectionCounts,
      selected: scan.selected.map(c => ({ ticker: c.asset.ticker, category: c.asset.category, score: c.score == null ? null : Number(c.score.toFixed(3)), bars: c.bars, asOf: c.asOfDate, lastClose: c.lastClose, momentum120Pct: c.momentum120Pct == null ? null : Number(c.momentum120Pct.toFixed(2)), annualizedVolatilityPct: c.annualizedVolatilityPct == null ? null : Number(c.annualizedVolatilityPct.toFixed(2)), maxDrawdownPct: c.maxDrawdownPct == null ? null : Number(c.maxDrawdownPct.toFixed(2)), fingerprint: c.response?.provenance.datasetFingerprint ?? null })),
      top15: scan.candidates.filter(c => c.status === 'ACCEPTED').sort((a,b)=>(b.score ?? -999)-(a.score ?? -999)).slice(0,15).map(c => ({ ticker: c.asset.ticker, category: c.asset.category, score: c.score == null ? null : Number(c.score.toFixed(3)) }))
    };

    const prices = Object.fromEntries(scan.selected.map(c => [c.asset.assetId, c.lastClose ?? 0]));
    for (const profile of ['LOW', 'MEDIUM', 'HIGH'] as InvestorRiskProfile[]) {
      const decision = InvestmentDecisionEngine.decide(scan.dataset, { capitalEur: 100, riskProfile: profile, horizonYears: 3 });
      report.decisions[profile] = {
        asOfDate: decision.asOfDate, dataAgeDays: decision.dataAgeDays, regime: decision.marketRegime, confidence: decision.confidence, confidenceScore: decision.confidenceScore, method: decision.recommendedMethod, cashEur: Number(decision.cashAmountEur.toFixed(2)),
        allocations: decision.assets.filter(a => a.amountEur >= 0.01).map(a => ({ ticker: a.ticker, amountEur: Number(a.amountEur.toFixed(2)), weightPct: Number((a.weight * 100).toFixed(2)), lastClose: Number((prices[a.assetId] || 0).toFixed(4)), estimatedShares: prices[a.assetId] ? Number((a.amountEur / prices[a.assetId]).toFixed(6)) : null, requiresFractionalShares: prices[a.assetId] ? a.amountEur + 1e-9 < prices[a.assetId] : null })),
        fingerprint: decision.portfolioDatasetFingerprint, warnings: decision.warnings
      };
    }

    const bt = DecisionBacktestEngine.run(scan.dataset, { initialCapital: 100, commissionPct: 0.05, slippagePct: 0.02, riskProfile: 'MEDIUM', horizonYears: 3, rebalanceFrequency: 'MONTHLY' });
    report.backtest = { initialCapital: bt.initialCapital, finalEquity: Number(bt.finalEquity.toFixed(2)), totalReturnPct: Number(bt.totalReturnPct.toFixed(2)), maxDrawdownPct: Number(bt.maxDrawdownPct.toFixed(2)), totalTrades: bt.totalTrades, rebalanceCount: bt.rebalanceCount, totalTradingCostsEur: Number(bt.totalTradingCostsEur.toFixed(4)), fingerprint: bt.portfolioDatasetFingerprint };
  } catch (err: any) {
    report.blockers.push(`live validation failed: ${err?.message || String(err)}`);
  } finally { if (ownsServer && server) server.kill('SIGTERM'); }

  report.readyForManualPilot = report.blockers.length === 0 && report.commands.lint?.ok && report.commands.build?.ok && (report.universeScan?.selected?.length ?? 0) >= 2 && !!report.backtest;
  console.log('\nAI_STUDIO_VALIDATION_RESULT'); console.log(JSON.stringify(report, null, 2));
  if (!report.readyForManualPilot) process.exitCode = 1;
}
main().catch(err => { console.error('AI_STUDIO_VALIDATION_FATAL', err); process.exit(1); });
