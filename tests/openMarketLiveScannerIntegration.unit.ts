import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(file: string): string { return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); }

const scanner = source('src/investment/decision/assetUniverseScanner.ts');
const replay = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const route = source('server/assetDiscoveryRoutes.ts');
const decision = source('src/components/InteractiveInvestmentDecisionCenter.tsx');
const alerts = source('server/alertAutomation.ts');

assert.match(scanner, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(scanner, /\/api\/alerts\/asset-discovery\/open-universe/);
assert.match(scanner, /universe === EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(scanner, /daysBetween\(endDate, todayIso\(\)\) <= 7/);
assert.match(scanner, /row\.quoteType === 'ETF'/);
assert.match(scanner, /row\.historicalPointInTimeSafe === false/);
assert.match(scanner, /mergeOpenMarketAssets/);
assert.match(scanner, /currentOpenDiscovery/);
assert.match(scanner, /temporary Yahoo\/search failure must not disable/);

// Existing current/live consumers keep using the same scanner and canonical
// universe, so they inherit discovery without a new screen or parallel engine.
assert.match(decision, /AssetUniverseScanner\.scan\(/);
assert.match(decision, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(alerts, /AssetUniverseScanner\.scan\(EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(alerts, /PortfolioCandidateGate\.apply/);

// Historical replay must remain isolated from current Yahoo discovery.
assert.doesNotMatch(replay, /asset-discovery/);
assert.doesNotMatch(replay, /open-universe/);
assert.doesNotMatch(replay, /currentOpenDiscovery/);
assert.match(route, /historicalPointInTimeSafe: false/);

console.log('openMarketLiveScannerIntegration.unit: PASS');
