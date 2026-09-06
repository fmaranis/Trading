import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const controls = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ReplayInitialPortfolioControls.tsx'), 'utf8');
const discoveryRoutes = fs.readFileSync(path.resolve(process.cwd(), 'server/assetDiscoveryRoutes.ts'), 'utf8');
const registry = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/dynamicPortfolioDiscovery.ts'), 'utf8');
const scanner = fs.readFileSync(path.resolve(process.cwd(), 'src/investment/decision/assetUniverseScanner.ts'), 'utf8');

assert.match(controls, /Buscar mercado/);
assert.match(controls, /asset-discovery\/search/);
assert.match(controls, /registerLiveDiscoveredAsset/);
assert.match(discoveryRoutes, /YAHOO_LIVE_DISCOVERY/);
assert.match(discoveryRoutes, /MUTUALFUND/);
assert.match(discoveryRoutes, /ETF/);
assert.match(discoveryRoutes, /EQUITY/);
assert.match(discoveryRoutes, /usableInEurEngine: currency === 'EUR'/);
assert.match(registry, /custodia_dynamic_market_assets_v1/);
assert.match(registry, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE\.push\(asset\)/);
assert.match(scanner, /HistoricalMarketDataService\.getHistoricalBars/);
assert.match(scanner, /FundMarketDataService\.history/);
assert.doesNotMatch(controls, /No existe coincidencia en el catálogo operativo actual/);

console.log('openMarketReplayDiscovery.unit: PASS');
