import express from 'express';
import { spawn, ChildProcess } from 'child_process';
import { marketDataRouter } from '../server/marketDataRoutes';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { MemoryMarketDataCache } from '../src/investment/data/marketData/cache';
import { BacktestEngine } from '../src/investment/backtesting/engine';
import { SmaCrossoverStrategy } from '../src/investment/strategies/standardStrategies';
import { ExecutionMode } from '../src/investment/backtesting/types';

async function waitForServerReady(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runEngineComparison() {
  console.log('========================================================================');
  console.log('⚖️  COMPARACIÓN DUAL DE MOTORES: TypeScript BacktestEngine vs Python vectorbt');
  console.log('========================================================================\n');

  const nodeApp = express();
  nodeApp.use(express.json());
  nodeApp.use('/api/market-data', marketDataRouter);
  const nodeServer = await new Promise<import('http').Server>((resolve) => {
    const s = nodeApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const nodeAddress = nodeServer.address() as import('net').AddressInfo;
  const marketDataBaseUrl = `http://127.0.0.1:${nodeAddress.port}/api/market-data/history`;

  const pythonPort = 8877;
  const pythonProc: ChildProcess = spawn(
    'python3',
    ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', String(pythonPort)],
    { env: { ...process.env, PYTHONPATH: '.' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const cleanup = () => { nodeServer.close(); pythonProc.kill('SIGTERM'); };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  const pythonReady = await waitForServerReady(`http://127.0.0.1:${pythonPort}/api/quant/health`);
  if (!pythonReady) {
    cleanup();
    throw new Error('El backend Python no respondió a tiempo.');
  }

  try {
    const realProvider = new RealMarketDataProvider(marketDataBaseUrl);
    const registry = new MarketDataProviderRegistry();
    registry.register(realProvider);
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);
    HistoricalMarketDataService.setCache(new MemoryMarketDataCache());

    const dataResponse = await HistoricalMarketDataService.getHistoricalBars({
      symbol: 'SPY', startDate: '2022-01-01', endDate: '2023-12-31', timeframe: '1d', adjusted: true
    }, { forceRefresh: true });

    const tsStrategy = new SmaCrossoverStrategy();
    const initialCapital = 10000;
    const executionMode: ExecutionMode = 'NEXT_OPEN';
    const tsResult = BacktestEngine.runBacktest(
      tsStrategy,
      dataResponse.bars,
      'SPY',
      'SPDR S&P 500 ETF Trust',
      { initialCapital, commissionPct: 0.05, slippagePct: 0.02, executionMode, stopLossPct: 0, trailingStopPct: 0 },
      { fastPeriod: 10, slowPeriod: 50 },
      dataResponse.provenance
    );

    const pyPayload = {
      assetTicker: 'SPY', assetName: 'SPDR S&P 500 ETF Trust', bars: dataResponse.bars,
      strategy: { id: 'SMA_CROSSOVER', name: 'SMA Crossover', parameters: { fastPeriod: 10, slowPeriod: 50 } },
      config: { initialCapital, commissionPct: 0.05, slippagePct: 0.02, riskFreeRateAnnualPct: 3.0, positionSizingPct: 100.0, executionMode: 'NEXT_OPEN' },
      dataProvenance: dataResponse.provenance,
      datasetFingerprint: dataResponse.provenance.datasetFingerprint
    };

    const pyResponse = await fetch(`http://127.0.0.1:${pythonPort}/api/quant/backtest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pyPayload)
    });
    if (!pyResponse.ok) throw new Error(`Fallo en vectorbt backend (${pyResponse.status}): ${await pyResponse.text()}`);
    const pyResult = await pyResponse.json();

    if (pyResult.inputDatasetFingerprint !== dataResponse.provenance.datasetFingerprint) throw new Error('Input fingerprint no coincide.');
    if (pyResult.outputDatasetFingerprint !== pyResult.inputDatasetFingerprint) throw new Error('vectorbt alteró el fingerprint.');

    console.log(`TS final: ${tsResult.metrics.finalEquity.toFixed(2)} | Python final: ${pyResult.metrics.finalEquity.toFixed(2)}`);
    console.log(`Fingerprint: ${pyResult.outputDatasetFingerprint}`);
  } finally {
    cleanup();
  }
}

runEngineComparison().catch((err) => {
  console.error('❌ Error en comparación de motores:', err);
  process.exit(1);
});
