import { spawn } from 'node:child_process';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { InvestmentDecisionEngine, DecisionBacktestEngine, InvestorRiskProfile } from '../src/investment/decision';
import type { MultiAssetDataset } from '../src/investment/portfolioBacktesting';

const UNIVERSE = [
  { assetId: 'VWCE', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', currency: 'EUR' },
  { assetId: 'EQQQ', ticker: 'EQQQ.DE', name: 'Invesco EQQQ Nasdaq-100 UCITS ETF', currency: 'EUR' },
  { assetId: '4GLD', ticker: '4GLD.DE', name: 'Xetra-Gold / Gold ETC EUR listing', currency: 'EUR' },
  { assetId: 'VAGF', ticker: 'VAGF.DE', name: 'Vanguard Global Aggregate Bond UCITS EUR Hedged', currency: 'EUR' },
  { assetId: 'XEON', ticker: 'XEON.DE', name: 'Xtrackers EUR Overnight Rate Swap UCITS ETF', currency: 'EUR' }
] as const;

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
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

async function main() {
  const report: any = {
    generatedAt: new Date().toISOString(),
    mode: 'ZERO_LLM_DETERMINISTIC_VALIDATION',
    commands: {},
    liveMarket: null,
    decisions: {},
    backtest: null,
    blockers: [] as string[]
  };

  for (const [key, script] of [
    ['lint', 'lint'],
    ['decisionTests', 'test:decision'],
    ['decisionBacktestTests', 'test:decision-backtest'],
    ['multiAssetTests', 'test:multi-asset'],
    ['portfolioAnalyticsTests', 'test:portfolio-analytics'],
    ['regimeTests', 'test:regimes'],
    ['build', 'build']
  ] as const) {
    const result = await runCommand(key, 'npm', ['run', script]);
    report.commands[key] = result;
    if (!result.ok) report.blockers.push(`${key} failed (exit ${result.exitCode})`);
  }

  if (report.blockers.length) {
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
    const ready = await waitForHealth(healthUrl, 30_000);
    if (!ready) {
      report.blockers.push('Local server did not become healthy on port 3000');
      server.kill('SIGTERM');
      console.log('\nAI_STUDIO_VALIDATION_RESULT');
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  try {
    const provider = new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history');
    const end = new Date();
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 7);

    const responses = [] as Awaited<ReturnType<RealMarketDataProvider['getHistoricalBars']>>[];
    for (const asset of UNIVERSE) {
      responses.push(await provider.getHistoricalBars({ symbol: asset.ticker, startDate: isoDate(start), endDate: isoDate(end), timeframe: '1d', adjusted: true }, { timeoutMs: 20_000 }));
    }

    const dataset: MultiAssetDataset = {
      timeframe: '1d',
      assets: UNIVERSE.map((asset, i) => ({
        assetId: asset.assetId,
        ticker: asset.ticker,
        name: asset.name,
        currency: asset.currency,
        bars: responses[i].bars,
        provenance: responses[i].provenance
      }))
    };

    report.liveMarket = {
      assets: UNIVERSE.map((asset, i) => ({
        ticker: asset.ticker,
        bars: responses[i].bars.length,
        asOf: responses[i].bars.at(-1)?.timestamp.slice(0, 10) ?? null,
        lastClose: responses[i].bars.at(-1)?.close ?? null,
        currency: responses[i].metadata.currency ?? null,
        exchange: responses[i].metadata.exchange ?? null,
        fingerprint: responses[i].provenance.datasetFingerprint ?? null
      }))
    };

    for (const profile of ['LOW', 'MEDIUM', 'HIGH'] as InvestorRiskProfile[]) {
      const decision = InvestmentDecisionEngine.decide(dataset, { capitalEur: 100, riskProfile: profile, horizonYears: 3 });
      const lastPrices = Object.fromEntries(UNIVERSE.map((a, i) => [a.assetId, responses[i].bars.at(-1)!.close]));
      report.decisions[profile] = {
        asOfDate: decision.asOfDate,
        dataAgeDays: decision.dataAgeDays,
        regime: decision.marketRegime,
        confidence: decision.confidence,
        confidenceScore: decision.confidenceScore,
        method: decision.recommendedMethod,
        cashEur: Number(decision.cashAmountEur.toFixed(2)),
        allocations: decision.assets.filter(a => a.amountEur >= 0.01).map(a => ({
          ticker: a.ticker,
          amountEur: Number(a.amountEur.toFixed(2)),
          weightPct: Number((a.weight * 100).toFixed(2)),
          lastClose: Number(lastPrices[a.assetId].toFixed(4)),
          estimatedShares: Number((a.amountEur / lastPrices[a.assetId]).toFixed(6)),
          requiresFractionalShares: a.amountEur + 1e-9 < lastPrices[a.assetId]
        })),
        fingerprint: decision.portfolioDatasetFingerprint,
        warnings: decision.warnings
      };
    }

    const bt = DecisionBacktestEngine.run(dataset, { initialCapital: 100, commissionPct: 0.05, slippagePct: 0.02, riskProfile: 'MEDIUM', horizonYears: 3, rebalanceFrequency: 'MONTHLY' });
    report.backtest = {
      initialCapital: bt.initialCapital,
      finalEquity: Number(bt.finalEquity.toFixed(2)),
      totalReturnPct: Number(bt.totalReturnPct.toFixed(2)),
      maxDrawdownPct: Number(bt.maxDrawdownPct.toFixed(2)),
      totalTrades: bt.totalTrades,
      rebalanceCount: bt.rebalanceCount,
      totalTradingCostsEur: Number(bt.totalTradingCostsEur.toFixed(4)),
      fingerprint: bt.portfolioDatasetFingerprint
    };
  } catch (err: any) {
    report.blockers.push(`live validation failed: ${err?.message || String(err)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }

  report.readyForManualPilot = report.blockers.length === 0 && report.commands.lint?.ok && report.commands.build?.ok && !!report.liveMarket && !!report.backtest;
  console.log('\nAI_STUDIO_VALIDATION_RESULT');
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForManualPilot) process.exitCode = 1;
}

main().catch(err => {
  console.error('AI_STUDIO_VALIDATION_FATAL', err);
  process.exit(1);
});
