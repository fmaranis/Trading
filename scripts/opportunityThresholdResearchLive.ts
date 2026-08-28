import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  EUR_ASSET_UNIVERSE,
  OpportunityOutcomeBacktestEngine,
  OpportunityThresholdResearchEngine
} from '../src/investment/decision';

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 500));
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

    const end = new Date();
    const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 7);
    const scan = await AssetUniverseScanner.scan(EUR_ASSET_UNIVERSE, isoDate(start), isoDate(end), {
      forceRefresh: false, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7
    });
    const outcomes = OpportunityOutcomeBacktestEngine.run(scan.acceptedDataset, EUR_ASSET_UNIVERSE, 8);
    const research = OpportunityThresholdResearchEngine.run(outcomes, 0.70);

    console.log('\nOPPORTUNITY_THRESHOLD_RESEARCH_RESULT');
    console.log(JSON.stringify({
      acceptedUniverse: scan.accepted,
      rejectedUniverse: scan.rejected,
      baselineEvents: outcomes.eventCount,
      baselineObservationWindows: outcomes.observationWindows,
      methodology: research.methodology,
      trainSharePct: research.trainSharePct,
      trainEndDate: research.trainEndDate,
      holdoutStartDate: research.holdoutStartDate,
      candidateCount: research.candidateCount,
      baseline: research.baseline,
      selected: research.selected,
      train: research.train,
      holdout: research.holdout,
      holdoutAssessment: research.holdoutAssessment,
      deploymentRecommendation: research.deploymentRecommendation,
      notes: research.notes
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('OPPORTUNITY_THRESHOLD_RESEARCH_FATAL', err);
  process.exit(1);
});
