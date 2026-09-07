import { spawn } from 'node:child_process';
import {
  AssetUniverseScanner,
  CORE_ELIGIBILITY_V2,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  OPEN_MARKET_DISCOVERY_V1,
  PortfolioCandidateGate,
  auditCoreEligibilityV2,
  mergeOpenMarketAssets,
  type OpenMarketDiscoveryV1Snapshot
} from '../src/investment/decision';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';

const MARKER = 'OPEN_MARKET_DISCOVERY_V1_LIVE_RESULT';

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const baseUrl = 'http://127.0.0.1:3000';
  if (!(await waitForHealth(`${baseUrl}/api/health`, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('OPEN_MARKET_DISCOVERY_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const discoveryResponse = await fetch(`${baseUrl}/api/alerts/asset-discovery/open-universe?refresh=1`);
    if (!discoveryResponse.ok) throw new Error(`OPEN_MARKET_DISCOVERY_HTTP_${discoveryResponse.status}`);
    const discovery = await discoveryResponse.json() as OpenMarketDiscoveryV1Snapshot & { queryFailures?: Array<{ id: string; error: string }> };
    if (discovery.version !== OPEN_MARKET_DISCOVERY_V1) throw new Error('OPEN_MARKET_DISCOVERY_VERSION_MISMATCH');
    if (discovery.historicalPointInTimeSafe !== false) throw new Error('OPEN_MARKET_DISCOVERY_MUST_NOT_CLAIM_HISTORICAL_POINT_IN_TIME_SAFETY');

    const universe = mergeOpenMarketAssets(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, discovery.assets);
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const endDate = isoDate(new Date());
    const scan = await AssetUniverseScanner.scan(universe, yearsAgo(4), endDate, {
      forceRefresh: false,
      concurrency: 3,
      maxSelected: 10,
      minimumBars: 252,
      maxDataAgeDays: 7
    });
    const discoveryIds = new Set(discovery.assets.map(row => row.asset.assetId));
    const discoveredCandidates = scan.candidates.filter(candidate => discoveryIds.has(candidate.asset.assetId));
    const discoveredAccepted = discoveredCandidates.filter(candidate => candidate.status === 'ACCEPTED');
    const discoveredReal = discoveredAccepted.filter(candidate => candidate.response?.provenance?.sourceType === 'REAL');
    const coreAudit = auditCoreEligibilityV2({
      candidates: scan.candidates,
      dataset: scan.acceptedDataset,
      discovery: discovery.assets
    });
    if (coreAudit.version !== CORE_ELIGIBILITY_V2 || coreAudit.mode !== 'SHADOW_AUDIT_NOT_PRODUCTION_GATE') {
      throw new Error('CORE_ELIGIBILITY_V2_NOT_SHADOW_AUDIT');
    }
    const gate = PortfolioCandidateGate.apply(scan, 2.5, 12);
    const uniqueTickers = new Set(discovery.assets.map(row => row.asset.ticker.toUpperCase()));
    const allEur = discovery.assets.every(row => row.asset.currency === 'EUR');
    const allCurrentOnly = discovery.assets.every(row => row.historicalPointInTimeSafe === false);
    const status = discovery.assets.length > 0 && discoveredReal.length > 0 && uniqueTickers.size === discovery.assets.length && allEur && allCurrentOnly
      ? 'PASS'
      : 'INCONCLUSIVE_EXTERNAL_DISCOVERY_COVERAGE';

    const result = {
      version: OPEN_MARKET_DISCOVERY_V1,
      status,
      generatedAt: new Date().toISOString(),
      currentLiveOnly: true,
      historicalPointInTimeSafe: false,
      retrospectiveYahooSearchAllowed: false,
      discovery: {
        queryCount: discovery.queryCount,
        queryFailures: discovery.queryFailures ?? [],
        rawCandidates: discovery.rawCandidates,
        acceptedEurCandidates: discovery.acceptedEurCandidates,
        uniqueTickers: uniqueTickers.size,
        allEur
      },
      scanner: {
        mergedUniverse: universe.length,
        scanned: scan.scanned,
        accepted: scan.accepted,
        rejected: scan.rejected,
        discoveredScanned: discoveredCandidates.length,
        discoveredAccepted: discoveredAccepted.length,
        discoveredReal: discoveredReal.length,
        discoveredRejections: discoveredCandidates.filter(row => row.status === 'REJECTED').map(row => ({ ticker: row.asset.ticker, reason: row.reason ?? 'UNKNOWN' }))
      },
      coreEligibilityV2: {
        mode: coreAudit.mode,
        assessed: coreAudit.assessed,
        eligible: coreAudit.eligible,
        reviewRequired: coreAudit.reviewRequired,
        rejected: coreAudit.rejected,
        discovered: coreAudit.assessments.filter(row => discoveryIds.has(row.assetId))
      },
      candidateGate: {
        entries: gate.entries.length,
        eligible: gate.entries.filter(entry => entry.status === 'ELIGIBLE').length,
        discoveredEntries: gate.entries.filter(entry => discoveryIds.has(entry.assetId)).map(entry => ({ assetId: entry.assetId, ticker: entry.ticker, status: entry.status, reason: entry.reason }))
      },
      notes: [
        'Infrastructure audit only: PASS does not validate investment performance or promote CORE_ELIGIBILITY_V2 into production.',
        'OPEN_MARKET_DISCOVERY_V1 feeds the existing AssetUniverseScanner and PortfolioCandidateGate; it does not create a parallel decision engine.',
        'Yahoo discovery is CURRENT/LIVE only. Historical replay cannot call it retrospectively.',
        'Historical full-market survivorship remains unresolved until a point-in-time instrument master with listings and delistings is available.'
      ]
    };
    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('OPEN_MARKET_DISCOVERY_V1_LIVE_FATAL', error);
  process.exitCode = 1;
});
