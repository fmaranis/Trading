import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function source(file: string): string { return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'); }

const domain = source('src/investment/decision/openMarketDiscoveryV1.ts');
const core = source('src/investment/decision/coreEligibilityV2.ts');
const routes = source('server/assetDiscoveryRoutes.ts');
const live = source('scripts/openMarketDiscoveryV1Live.ts');
const replay = source('src/investment/decision/dynamicHistoricalReplayCore.ts');
const scanner = source('src/investment/decision/assetUniverseScanner.ts');
const gate = source('src/investment/decision/portfolioCandidateGate.ts');

assert.match(domain, /OPEN_MARKET_DISCOVERY_V1_QUERIES/);
assert.match(domain, /historicalPointInTimeSafe: false/);
assert.match(domain, /Survivorship bias is not fully removed/);
assert.match(domain, /Historical replay may use only a frozen catalogue/);
assert.match(routes, /\/open-universe/);
assert.match(routes, /YAHOO_LIVE_QUERY_SWEEP/);
assert.match(routes, /OPEN_SWEEP_CACHE_MS/);
assert.match(live, /mergeOpenMarketAssets\(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, discovery\.assets\)/);
assert.match(live, /AssetUniverseScanner\.scan/);
assert.match(live, /PortfolioCandidateGate\.apply/);
assert.match(live, /auditCoreEligibilityV2/);
assert.match(live, /retrospectiveYahooSearchAllowed: false/);
assert.match(core, /SHADOW_AUDIT_NOT_PRODUCTION_GATE/);
assert.match(core, /minimumHistoryBars: 756/);
assert.match(core, /minimumMedianDailyTurnoverEur: 250_000/);
assert.match(scanner, /sourceType: 'REAL'/);
assert.match(gate, /PortfolioCandidateGate/);

// Critical anti-lookahead boundary: the historical replay engine must never call
// current Yahoo discovery to reconstruct a past universe.
assert.doesNotMatch(replay, /asset-discovery/);
assert.doesNotMatch(replay, /open-universe/);
assert.match(replay, /bars\.length < input\.minimumBars/);

console.log('openMarketDiscoveryArchitecture.unit: PASS');
