import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  EUR_ASSET_UNIVERSE,
  OpportunityOutcomeBacktestEngine,
  OpportunityThresholdResearchEngine,
  OpportunityThresholdWalkForward
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
    const holdout = OpportunityThresholdResearchEngine.run(outcomes, 0.70);
    const walkForward = OpportunityThresholdWalkForward.run(outcomes, {
      minimumTrainWindows: 24,
      testWindows: 12,
      stepWindows: 12,
      minimumTrainEvents: 12
    });

    const promote = holdout.deploymentRecommendation === 'PROMOTE_FOR_REVIEW'
      && walkForward.assessment === 'POSITIVE_RELATIVE_EVIDENCE';

    console.log('\nOPPORTUNITY_THRESHOLD_RESEARCH_RESULT');
    console.log(JSON.stringify({
      acceptedUniverse: scan.accepted,
      rejectedUniverse: scan.rejected,
      baselineEvents: outcomes.eventCount,
      baselineObservationWindows: outcomes.observationWindows,
      baselineMetrics: outcomes.metrics,
      holdoutResearch: {
        methodology: holdout.methodology,
        trainSharePct: holdout.trainSharePct,
        trainEndDate: holdout.trainEndDate,
        holdoutStartDate: holdout.holdoutStartDate,
        candidateCount: holdout.candidateCount,
        baseline: holdout.baseline,
        selected: holdout.selected,
        train: holdout.train,
        holdout: holdout.holdout,
        holdoutAssessment: holdout.holdoutAssessment,
        deploymentRecommendation: holdout.deploymentRecommendation
      },
      walkForwardResearch: {
        scope: walkForward.scope,
        folds: walkForward.folds,
        testEventCount: walkForward.testEventCount,
        aggregateMetrics: walkForward.aggregateMetrics,
        assessment: walkForward.assessment
      },
      finalRecommendation: promote
        ? 'CANDIDATE_THRESHOLDS_MAY_BE_PROMOTED_FOR_REVIEW_NOT_AUTOMATIC_DEPLOYMENT'
        : 'KEEP_CURRENT_SIGNALS_REVIEW_ONLY_DO_NOT_PROMOTE_THRESHOLDS',
      notes: [
        'La validación de precios (Yahoo/EODHD) es independiente de la evidencia de rentabilidad relativa.',
        'Los umbrales no se despliegan automáticamente aunque un estudio resulte positivo.',
        'Se exige coherencia entre holdout temporal y walk-forward antes de considerar promoción.',
        ...walkForward.notes
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('OPPORTUNITY_THRESHOLD_RESEARCH_FATAL', err);
  process.exit(1);
});
