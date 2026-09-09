import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  AssetUniverseScanner,
  DYNAMIC_MARKET_SHORTLIST_TARGET,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  OPEN_MARKET_DISCOVERY_V1,
  PortfolioCandidateGate,
  type OpenMarketDiscoveryV1Snapshot
} from '../src/investment/decision';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';

const MARKER = 'DYNAMIC_MARKET_TOP64_LIVE_RESULT';
const VERSION = 'DYNAMIC_MARKET_TOP64_V1' as const;

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
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
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('DYNAMIC_MARKET_TOP64_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    // Refresh the current discovery cache once, then let the canonical scanner
    // consume that same endpoint through its normal production path.
    const discoveryResponse = await fetch(`${baseUrl}/api/alerts/asset-discovery/open-universe?refresh=1`);
    if (!discoveryResponse.ok) throw new Error(`DYNAMIC_MARKET_DISCOVERY_HTTP_${discoveryResponse.status}`);
    const discovery = await discoveryResponse.json() as OpenMarketDiscoveryV1Snapshot & {
      queryFailures?: Array<{ id: string; error: string }>;
    };
    if (discovery.version !== OPEN_MARKET_DISCOVERY_V1) throw new Error('DYNAMIC_MARKET_DISCOVERY_VERSION_MISMATCH');
    if (discovery.historicalPointInTimeSafe !== false) throw new Error('DYNAMIC_MARKET_DISCOVERY_FALSE_HISTORICAL_SAFETY_CLAIM');
    if (!Array.isArray(discovery.assets) || discovery.assets.length < 1) throw new Error('DYNAMIC_MARKET_DISCOVERY_NO_CURRENT_ASSETS');

    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(
      EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
      yearsAgo(3),
      isoDate(new Date()),
      { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
    );

    // This validation is specifically about the dynamic current/live chain. A
    // temporary Yahoo discovery failure may legitimately fall back to the seed in
    // production, but that degraded mode must never be reported here as a Top64
    // discovery PASS.
    const scannerDiscovery = scan.currentOpenDiscovery;
    if (scannerDiscovery?.attempted !== true) throw new Error('DYNAMIC_MARKET_DISCOVERY_NOT_ATTEMPTED');
    if (scannerDiscovery.error) throw new Error(`DYNAMIC_MARKET_SCANNER_DISCOVERY_ERROR:${scannerDiscovery.error}`);
    if (scannerDiscovery.promotedAssets < 1) throw new Error('DYNAMIC_MARKET_DISCOVERY_NO_NOVEL_PROMOTED_ASSETS');

    const shortlist = scan.dynamicMarketShortlist;
    if (!shortlist?.applied || shortlist.mode !== 'DYNAMIC_CURRENT_DISCOVERY') throw new Error('DYNAMIC_MARKET_SHORTLIST_NOT_APPLIED');
    if (shortlist.targetSize !== DYNAMIC_MARKET_SHORTLIST_TARGET) throw new Error('DYNAMIC_MARKET_SHORTLIST_TARGET_DRIFT');
    if (shortlist.shortlistSize !== scan.selected.length) throw new Error('DYNAMIC_MARKET_SHORTLIST_SIZE_MISMATCH');
    if (JSON.stringify(shortlist.shortlistAssetIds) !== JSON.stringify(scan.selected.map(row => row.asset.assetId))) {
      throw new Error('DYNAMIC_MARKET_SHORTLIST_ID_AUDIT_MISMATCH');
    }
    const expectedShortlistSize = Math.min(DYNAMIC_MARKET_SHORTLIST_TARGET, scan.accepted);
    if (scan.selected.length !== expectedShortlistSize) throw new Error(`DYNAMIC_MARKET_SHORTLIST_NOT_FULL:${scan.selected.length}:${expectedShortlistSize}`);

    const nonRealSelected = scan.selected.filter(row => row.response?.provenance?.sourceType !== 'REAL');
    if (nonRealSelected.length) throw new Error(`DYNAMIC_MARKET_NON_REAL_SHORTLIST:${nonRealSelected.map(row => row.asset.assetId).join(',')}`);

    const shortlistIds = new Set(shortlist.shortlistAssetIds);
    const gate = PortfolioCandidateGate.apply(scan, 2.5, 12, 'LEGACY');
    const eligibleOutsideShortlist = gate.entries.filter(entry => entry.status === 'ELIGIBLE' && !shortlistIds.has(entry.assetId));
    if (eligibleOutsideShortlist.length) throw new Error(`DYNAMIC_MARKET_GATE_LEAK:${eligibleOutsideShortlist.map(row => row.assetId).join(',')}`);

    const acceptedOutsideShortlist = scan.candidates.filter(row => row.status === 'ACCEPTED' && !shortlistIds.has(row.asset.assetId));
    const auditedOutsideShortlist = gate.entries.filter(row => row.reason === 'OUTSIDE_DYNAMIC_MARKET_SHORTLIST');
    if (auditedOutsideShortlist.length !== acceptedOutsideShortlist.length) {
      throw new Error(`DYNAMIC_MARKET_OUTSIDE_AUDIT_MISMATCH:${auditedOutsideShortlist.length}:${acceptedOutsideShortlist.length}`);
    }

    const discoveryTypeCounts = discovery.assets.reduce<Record<string, number>>((acc, row) => {
      acc[row.quoteType] = (acc[row.quoteType] ?? 0) + 1;
      return acc;
    }, {});
    const openShortlist = scan.selected.filter(row => row.asset.assetId.startsWith('OPEN_'));
    const snapshot = scan.selected.map((row, index) => ({
      rank: index + 1,
      assetId: row.asset.assetId,
      ticker: row.asset.ticker,
      name: row.asset.name,
      category: row.asset.category,
      scannerScore: row.score,
      reliabilityScore: row.reliabilityScore ?? null,
      opportunityScore: row.opportunityScore ?? null,
      momentum120Pct: row.momentum120Pct,
      annualizedVolatilityPct: row.annualizedVolatilityPct,
      maxDrawdownPct: row.maxDrawdownPct,
      asOfDate: row.asOfDate,
      provenance: row.response?.provenance?.sourceType ?? null
    }));

    const result = {
      version: VERSION,
      status: 'PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE',
      generatedAt: new Date().toISOString(),
      productInvariant: {
        marketUniverseMode: 'DYNAMIC_CURRENT_DISCOVERY',
        shortlistTarget: DYNAMIC_MARKET_SHORTLIST_TARGET,
        fixedProductUniverse: false,
        productionAllocationPolicy: 'LEGACY',
        shortlistAuthorizesPurchase: false
      },
      discovery: {
        version: discovery.version,
        currentLiveOnly: true,
        historicalPointInTimeSafe: false,
        retrospectiveYahooSearchAllowed: false,
        queryCount: discovery.queryCount,
        queryFailures: discovery.queryFailures ?? [],
        rawCandidates: discovery.rawCandidates,
        acceptedEurCandidates: discovery.acceptedEurCandidates,
        quoteTypeCounts: discoveryTypeCounts,
        promotedIntoCanonicalScan: scannerDiscovery.promotedAssets,
        scannerDiscoveryError: null,
        providerLimitation: 'Yahoo query sweep is broad current/live discovery, not an exhaustive global instrument master.'
      },
      scanner: {
        seedFallbackSize: EUR_PORTFOLIO_DISCOVERY_UNIVERSE.length,
        scannedPool: scan.scanned,
        acceptedRealPool: scan.accepted,
        rejectedPool: scan.rejected,
        shortlistSize: scan.selected.length,
        openDiscoveredInShortlist: openShortlist.length,
        rankingVersion: shortlist.rankingVersion,
        snapshotFingerprintSha256: hash(snapshot),
        snapshot
      },
      candidateGate: {
        policy: gate.selectionPolicy,
        entries: gate.entries.length,
        eligibleBeforeFinalDiversification: gate.eligibleCount,
        selectedAfterGate: gate.selectedCount,
        acceptedOutsideTop64: acceptedOutsideShortlist.length,
        outsideTop64Audited: auditedOutsideShortlist.length,
        eligibleOutsideTop64Leak: eligibleOutsideShortlist.length
      },
      architecture: {
        chain: 'current market -> AssetUniverseScanner discovery/ranking -> dynamic Top64 -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine -> execution/follow-up',
        noParallelEngine: true,
        historicalReplayModified: false,
        noActionRemainsValid: true
      },
      notes: [
        'The Top 64 is dynamic: identities come from the current discovered EUR-compatible pool and may change on every evaluation.',
        'The seed catalogue is fallback/bootstrap only; it is not the definition of the market.',
        'MARKET_SHORTLIST_LEGACY_SCORE_V1 preserves the existing production scanner score. Reliability/Opportunity are tie-breakers only; QUALITY_V1 remains research-only.',
        'PortfolioCandidateGate, cash hurdle, consensus, timing and allocation retain investment authority after discovery.',
        'This current/live validation does not claim exhaustive global-market coverage and does not alter historical replay.'
      ]
    };
    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('DYNAMIC_MARKET_TOP64_LIVE_FATAL', error);
  process.exitCode = 1;
});
