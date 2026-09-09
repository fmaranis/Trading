import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(file: string): string { return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); }

const scanner = source('src/investment/decision/assetUniverseScanner.ts');
const replay = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const route = source('server/assetDiscoveryRoutes.ts');
const decision = source('src/components/InteractiveInvestmentDecisionCenter.tsx');
const alerts = source('server/alertAutomation.ts');
const gate = source('src/investment/decision/portfolioCandidateGate.ts');
const universe = source('src/investment/decision/portfolioDiscoveryUniverse.ts');
const live = source('scripts/dynamicMarketTop64Live.ts');

assert.match(scanner, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(scanner, /\/api\/alerts\/asset-discovery\/open-universe/);
assert.match(scanner, /universe === EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(scanner, /daysBetween\(endDate, todayIso\(\)\) <= 7/);
assert.match(scanner, /row\.quoteType === 'ETF' \|\| row\.quoteType === 'EQUITY'/);
assert.match(scanner, /row\.historicalPointInTimeSafe === false/);
assert.match(scanner, /mergeOpenMarketAssets/);
assert.match(scanner, /currentOpenDiscovery/);
assert.match(scanner, /temporary Yahoo\/search failure must not disable/);
assert.match(scanner, /dynamicCurrentMarket \? DYNAMIC_MARKET_SHORTLIST_TARGET/);
assert.match(scanner, /dynamicMarketShortlist: dynamicCurrentMarket/);
assert.match(scanner, /MARKET_SHORTLIST_LEGACY_SCORE_V1/);
assert.match(scanner, /dynamicCurrentMarket\s*\? rankDynamicMarketShortlist\(candidates, requestedMax\)\s*:\s*chooseDiversifiedLegacy\(candidates, Math\.min\(requestedMax, 10\)\)/s);
assert.match(scanner, /function chooseDiversifiedLegacy/);
assert.match(scanner, /usedCategories/);
assert.match(gate, /OUTSIDE_DYNAMIC_MARKET_SHORTLIST/);
assert.match(gate, /scan\.dynamicMarketShortlist\?\.applied/);
assert.match(universe, /DYNAMIC_MARKET_SHORTLIST_TARGET = 64/);
assert.match(universe, /FIXED_PRODUCT_UNIVERSE_FORBIDDEN = true/);

// Current discovery combines the structural Yahoo Search sweep with Yahoo Lookup
// enumeration of primary EUR listings. Lookup remains current/live only and is a
// candidate source, never a second decision engine.
assert.match(route, /OPEN_SWEEP_TYPES = new Set\(\['ETF', 'EQUITY'\]\)/);
assert.match(route, /OPEN_SWEEP_ROWS_PER_QUERY/);
assert.match(route, /\/v1\/finance\/lookup/);
assert.match(route, /EUR_PRIMARY_LISTING_SUFFIXES/);
assert.match(route, /LOOKUP_MIN_RAW_CANDIDATES = 96/);
assert.match(route, /LOOKUP_MAX_RAW_CANDIDATES = 192/);
assert.match(route, /LOOKUP_PREFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'\.split\(''\)/);
assert.match(route, /queryFamily: row\.mechanism === 'LOOKUP'/);
assert.match(route, /category: isEquity \? 'EUROPE_EQUITY' : classified\.category/);
assert.match(route, /historicalPointInTimeSafe: false/);

// A final live PASS must prove independence from the 64-name seed: current open
// discovery must add at least one complete shortlist worth of novel candidates.
assert.match(live, /MIN_INDEPENDENT_OPEN_CANDIDATES = 64/);
assert.match(live, /DYNAMIC_MARKET_DISCOVERY_BREADTH_INSUFFICIENT/);
assert.match(live, /DYNAMIC_MARKET_NOVEL_BREADTH_INSUFFICIENT/);
assert.match(live, /scannerDiscovery\.promotedAssets < MIN_INDEPENDENT_OPEN_CANDIDATES/);

// Node/server discovery must address the internal API router, not APP_URL. In
// preview environments APP_URL can be the SPA host and return index.html for
// an API path, which is not a valid discovery snapshot.
assert.match(scanner, /OPEN_MARKET_DISCOVERY_INTERNAL_BASE_URL/);
assert.match(scanner, /ALERT_INTERNAL_BASE_URL/);
assert.match(scanner, /127\.0\.0\.1:3000/);
assert.match(scanner, /OPEN_MARKET_DISCOVERY_NON_JSON_RESPONSE/);
const baseUrlFunction = scanner.slice(scanner.indexOf('function currentDiscoveryBaseUrl'), scanner.indexOf('function promotableCurrentDiscovery'));
assert.doesNotMatch(baseUrlFunction, /process\.env\.APP_URL/);

// Existing current/live consumers keep using the same scanner and canonical
// universe, so they inherit dynamic discovery without a new screen or engine.
assert.match(decision, /AssetUniverseScanner\.scan\(/);
assert.match(decision, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(alerts, /AssetUniverseScanner\.scan\(EUR_PORTFOLIO_DISCOVERY_UNIVERSE/);
assert.match(alerts, /PortfolioCandidateGate\.apply/);

// Historical replay remains isolated from current Yahoo discovery and the
// scanner explicitly preserves its pre-existing diversified selection branch.
assert.doesNotMatch(replay, /asset-discovery/);
assert.doesNotMatch(replay, /open-universe/);
assert.doesNotMatch(replay, /currentOpenDiscovery/);

console.log('openMarketLiveScannerIntegration.unit: PASS');
