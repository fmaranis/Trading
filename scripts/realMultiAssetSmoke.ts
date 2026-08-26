import express from 'express';
import { marketDataRouter } from '../server/marketDataRoutes';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { MemoryMarketDataCache } from '../src/investment/data/marketData/cache';
import { PortfolioBacktestEngine } from '../src/investment/portfolioBacktesting';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/market-data', marketDataRouter);
  const server = await new Promise<import('http').Server>(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address() as import('net').AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/market-data/history`;

  try {
    const provider = new RealMarketDataProvider(baseUrl);
    const registry = new MarketDataProviderRegistry();
    registry.register(provider);
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);
    HistoricalMarketDataService.setCache(new MemoryMarketDataCache());

    const [spy, gld] = await Promise.all([
      HistoricalMarketDataService.getHistoricalBars({symbol:'SPY',startDate:'2022-01-01',endDate:'2024-01-01',timeframe:'1d',adjusted:true},{forceRefresh:true}),
      HistoricalMarketDataService.getHistoricalBars({symbol:'GLD',startDate:'2022-01-01',endDate:'2024-01-01',timeframe:'1d',adjusted:true},{forceRefresh:true})
    ]);

    const result = PortfolioBacktestEngine.run({
      timeframe: '1d',
      assets: [
        { assetId:'SPY', ticker:'SPY', name:'SPDR S&P 500 ETF Trust', currency:'USD', bars:spy.bars, provenance:spy.provenance },
        { assetId:'GLD', ticker:'GLD', name:'SPDR Gold Shares', currency:'USD', bars:gld.bars, provenance:gld.provenance }
      ]
    }, {
      initialCapital: 10000,
      commissionPct: 0.05,
      slippagePct: 0.02,
      rebalanceFrequency: 'MONTHLY',
      executionMode: 'NEXT_OPEN',
      targetWeights: { SPY:0.5, GLD:0.5 },
      rebalanceTolerancePct: 0.25,
      alignmentPolicy: 'INTERSECTION'
    });

    console.log('============================================================');
    console.log('REAL MULTI-ASSET SMOKE — SPY + GLD — 50/50 MONTHLY');
    console.log('============================================================');
    console.log(`Assets: SPY, GLD`);
    console.log(`SPY fingerprint: ${result.provenance.assetDatasetFingerprints.SPY}`);
    console.log(`GLD fingerprint: ${result.provenance.assetDatasetFingerprints.GLD}`);
    console.log(`Portfolio fingerprint: ${result.provenance.portfolioDatasetFingerprint}`);
    console.log(`Aligned bars: ${result.alignedBarsCount}`);
    console.log(`Initial capital: ${result.config.initialCapital.toFixed(2)}`);
    console.log(`Final equity: ${result.metrics.financial.finalEquity.toFixed(2)}`);
    console.log(`Total return: ${result.metrics.financial.totalReturnPct.toFixed(2)}%`);
    console.log(`Max drawdown: ${result.metrics.financial.maxDrawdownPct.toFixed(2)}%`);
    console.log(`Trades: ${result.trades.length}`);
    console.log(`Trading costs: ${result.metrics.totalTradingCostsEur.toFixed(2)}`);
    if (result.provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('Expected REAL_ONLY evidence');
    if (result.alignedBarsCount < 100) throw new Error('Insufficient aligned real bars');
    if (!Number.isFinite(result.metrics.financial.finalEquity)) throw new Error('Invalid final equity');
    console.log('✅ REAL MULTI-ASSET SMOKE PASSED');
  } finally {
    server.close();
  }
}

main().catch(err => { console.error('❌ REAL MULTI-ASSET SMOKE FAILED', err); process.exit(1); });
