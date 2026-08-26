/**
 * REAL BACKTEST SMOKE TEST
 * End-to-end smoke test validating Yahoo Finance Proxy → HistoricalMarketDataService → BacktestEngine.
 */
import express from 'express';
import { marketDataRouter } from '../server/marketDataRoutes';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { MemoryMarketDataCache } from '../src/investment/data/marketData/cache';
import { BacktestEngine } from '../src/investment/backtesting/engine';
import { SmaCrossoverStrategy } from '../src/investment/strategies/standardStrategies';
import { ExecutionMode } from '../src/investment/backtesting/types';

async function runRealBacktestSmoke() {
  const app = express();
  app.use(express.json());
  app.use('/api/market-data', marketDataRouter);
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address() as import('net').AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/market-data/history`;

  try {
    const realProvider = new RealMarketDataProvider(baseUrl);
    const registry = new MarketDataProviderRegistry();
    registry.register(realProvider);
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);
    HistoricalMarketDataService.setCache(new MemoryMarketDataCache());

    const dataResponse = await HistoricalMarketDataService.getHistoricalBars({
      symbol: 'SPY', startDate: '2022-01-01', endDate: '2024-01-01', timeframe: '1d', adjusted: true
    }, { forceRefresh: true });

    const strategy = new SmaCrossoverStrategy();
    const initialCapital = 10000;
    const executionMode: ExecutionMode = 'NEXT_OPEN';
    const result = BacktestEngine.runBacktest(
      strategy,
      dataResponse.bars,
      'SPY',
      'SPDR S&P 500 ETF Trust',
      { initialCapital, executionMode },
      { fastPeriod: 10, slowPeriod: 50 },
      dataResponse.provenance
    );

    if (!Number.isFinite(result.metrics.totalReturnPct)) throw new Error('totalReturnPct inválido.');
    if (!Number.isFinite(result.metrics.maxDrawdownPct) || result.metrics.maxDrawdownPct < 0) throw new Error('maxDrawdownPct inválido.');
    if (result.equityCurve.length !== dataResponse.bars.length) throw new Error('Curva de patrimonio incompleta.');
    if (result.dataProvenance?.sourceType !== 'REAL') throw new Error('No conserva sourceType=REAL.');
    if (result.dataProvenance?.datasetFingerprint !== dataResponse.provenance.datasetFingerprint) throw new Error('Se perdió datasetFingerprint.');

    console.log({
      provider: result.dataProvenance.provider,
      fingerprint: result.dataProvenance.datasetFingerprint,
      bars: dataResponse.bars.length,
      finalEquity: result.metrics.finalEquity,
      totalReturnPct: result.metrics.totalReturnPct,
      maxDrawdownPct: result.metrics.maxDrawdownPct,
      trades: result.trades.length
    });
  } finally {
    server.close();
  }
}

runRealBacktestSmoke().catch((err) => {
  console.error('ERROR EN SMOKE TEST REAL:', err);
  process.exit(1);
});
