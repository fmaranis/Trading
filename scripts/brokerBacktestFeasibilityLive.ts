import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  assessBrokerBacktestCostFeasibility,
  CausalUniverseBacktestEngine,
  EUR_ASSET_UNIVERSE,
  MYINVESTOR_BROKER_PROFILE
} from '../src/investment/decision';

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;

  if (!(await waitFor(`${base}/api/health`, 1200))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitFor(`${base}/api/health`, 30_000))) {
      throw new Error('Servidor local no disponible en puerto 3000');
    }
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${base}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const end = new Date();
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 7);

    const scan = await AssetUniverseScanner.scan(
      EUR_ASSET_UNIVERSE,
      isoDate(start),
      isoDate(end),
      { forceRefresh: false, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 }
    );

    const causal = CausalUniverseBacktestEngine.run(
      scan.acceptedDataset,
      EUR_ASSET_UNIVERSE,
      {
        initialCapital: 100,
        commissionPct: 0.05,
        slippagePct: 0.02,
        riskProfile: 'MEDIUM',
        horizonYears: 3,
        rebalanceFrequency: 'MONTHLY'
      },
      8
    );

    const feasibility = assessBrokerBacktestCostFeasibility({
      initialCapitalEur: causal.initialCapital,
      totalTrades: causal.totalTrades,
      modeledCommissionEur: causal.totalCommissionEur,
      modeledSlippageEur: causal.totalSlippageEur
    }, MYINVESTOR_BROKER_PROFILE, 2);

    const result = {
      generatedAt: new Date().toISOString(),
      scope: 'CURRENT_CAUSAL_BACKTEST_BROKER_COST_DIAGNOSTIC',
      researchBacktest: {
        initialCapitalEur: causal.initialCapital,
        finalEquityEur: Number(causal.finalEquity.toFixed(2)),
        totalReturnPct: Number(causal.totalReturnPct.toFixed(2)),
        maxDrawdownPct: Number(causal.maxDrawdownPct.toFixed(2)),
        totalTrades: causal.totalTrades,
        rebalanceCount: causal.rebalanceCount,
        modeledCommissionEur: Number(causal.totalCommissionEur.toFixed(4)),
        modeledSlippageEur: Number(causal.totalSlippageEur.toFixed(4)),
        modeledTradingCostsEur: Number(causal.totalTradingCostsEur.toFixed(4)),
        selectionWindows: causal.selectionHistory.length
      },
      brokerDiagnostic: {
        broker: feasibility.broker,
        minimumCommissionLowerBoundEur: Number(feasibility.minimumCommissionLowerBoundEur.toFixed(2)),
        minimumTradingCostLowerBoundEur: Number(feasibility.minimumTradingCostLowerBoundEur.toFixed(2)),
        minimumCommissionDragPct: Number(feasibility.minimumCommissionDragPct.toFixed(2)),
        modeledCommissionUnderstatementEur: Number(feasibility.modeledCommissionUnderstatementEur.toFixed(2)),
        modeledCommissionUnderstatementFactor: feasibility.modeledCommissionUnderstatementFactor == null
          ? null
          : Number(feasibility.modeledCommissionUnderstatementFactor.toFixed(2)),
        brokerCommissionModelCompatible: feasibility.brokerCommissionModelCompatible,
        commissionDragTargetPct: feasibility.commissionDragTargetPct,
        minimumCapitalForCommissionDragTargetEur: Number(feasibility.minimumCapitalForCommissionDragTargetEur.toFixed(2)),
        warnings: feasibility.warnings
      },
      interpretation: feasibility.brokerCommissionModelCompatible
        ? 'RESEARCH_COMMISSION_NOT_BELOW_BROKER_MINIMUM_LOWER_BOUND'
        : 'RESEARCH_BACKTEST_NOT_DIRECTLY_EXECUTABLE_UNDER_MODELED_MYINVESTOR_MINIMUM_FEES',
      manualPilotBlocker: !feasibility.brokerCommissionModelCompatible,
      note: 'This is an execution-economics diagnostic, not a profitability forecast. The broker lower bound uses one minimum commission per executed backtest trade/order.'
    };

    console.log('BROKER_BACKTEST_FEASIBILITY_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('BROKER_BACKTEST_FEASIBILITY_ERROR', error?.message || String(error));
  process.exit(1);
});
