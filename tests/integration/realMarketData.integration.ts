/** REAL MARKET DATA INTEGRATION TEST — Yahoo Finance, no fixtures/synthetic fallback. */
import express from 'express';
import { marketDataRouter } from '../../server/marketDataRoutes';
import { RealMarketDataProvider } from '../../src/investment/data/marketData/providers/realMarketDataProvider';
import { HistoricalMarketDataService } from '../../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../../src/investment/data/marketData/registry';
import { MemoryMarketDataCache } from '../../src/investment/data/marketData/cache';

async function runIntegrationTests() {
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

    const adjustedResponse = await HistoricalMarketDataService.getHistoricalBars({
      symbol: 'SPY', startDate: '2023-01-01', endDate: '2024-01-01', timeframe: '1d', adjusted: true
    }, { forceRefresh: true });

    if (!adjustedResponse.bars.length) throw new Error('Sin barras para SPY.');
    if (adjustedResponse.provenance.sourceType !== 'REAL') throw new Error('sourceType no es REAL.');
    if (adjustedResponse.provenance.isReproducible !== false) throw new Error('isReproducible debe ser false.');
    if (!adjustedResponse.provenance.datasetFingerprint?.startsWith('fp_')) throw new Error('Fingerprint inválido.');
    if (adjustedResponse.metadata.adjustmentMethod !== 'PROVIDER_ADJCLOSE_RATIO') throw new Error('Adjustment method inesperado.');
    if (adjustedResponse.metadata.adjustmentStatus !== 'ADJUSTED_DERIVED') throw new Error('Adjustment status inesperado.');

    for (let i = 0; i < adjustedResponse.bars.length; i++) {
      const b = adjustedResponse.bars[i];
      if (b.high < b.low || b.high < b.open || b.high < b.close || b.low > b.open || b.low > b.close) throw new Error(`OHLC inválido en ${i}`);
      if (i > 0 && Date.parse(b.timestamp) <= Date.parse(adjustedResponse.bars[i - 1].timestamp)) throw new Error('Barras no ordenadas.');
    }

    const unadjustedResponse = await HistoricalMarketDataService.getHistoricalBars({
      symbol: 'SPY', startDate: '2023-01-01', endDate: '2024-01-01', timeframe: '1d', adjusted: false
    }, { forceRefresh: true });
    if (unadjustedResponse.metadata.adjustmentMethod !== 'NONE' || unadjustedResponse.metadata.adjustmentStatus !== 'UNADJUSTED') throw new Error('Serie unadjusted inválida.');

    let caught = false;
    try {
      await HistoricalMarketDataService.getHistoricalBars({
        symbol: 'INVALID_SYMBOL_NONEXISTENT_99999', startDate: '2023-01-01', endDate: '2023-06-01', timeframe: '1d'
      }, { forceRefresh: true });
    } catch { caught = true; }
    if (!caught) throw new Error('Posible fallback sintético silencioso.');
  } finally {
    server.close();
  }
}

runIntegrationTests().catch((err) => { console.error(err); process.exit(1); });
