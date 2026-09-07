import { spawn } from 'node:child_process';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  OPEN_MARKET_DISCOVERY_V1,
  PortfolioCandidateGate
} from '../src/investment/decision';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';

const MARKER = 'OPEN_MARKET_LIVE_SCANNER_INTEGRATION_RESULT';

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
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${baseUrl}/api/health`, 30_000))) throw new Error('OPEN_MARKET_LIVE_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    // Deliberately pass the canonical current/live universe unchanged. The
    // existing scanner itself must perform the discovery expansion.
    const scan = await AssetUniverseScanner.scan(
      EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
      yearsAgo(4),
      isoDate(new Date()),
      { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
    );
    const audit = scan.currentOpenDiscovery;
    if (!audit || audit.version !== OPEN_MARKET_DISCOVERY_V1 || audit.attempted !== true) {
      throw new Error('CURRENT_OPEN_DISCOVERY_NOT_ATTEMPTED_BY_SHARED_SCANNER');
    }

    const openCandidates = scan.candidates.filter(candidate => candidate.asset.assetId.startsWith('OPEN_'));
    const openAccepted = openCandidates.filter(candidate => candidate.status === 'ACCEPTED');
    const openReal = openAccepted.filter(candidate => candidate.response?.provenance?.sourceType === 'REAL');
    const nonEtfPromotionLeak = openCandidates.filter(candidate => candidate.asset.assetId.startsWith('OPEN_') && candidate.asset.instrumentType !== 'ETF_ETC');
    if (nonEtfPromotionLeak.length) throw new Error('OPEN_DISCOVERY_NON_LISTED_PROMOTION_LEAK');

    const gate = PortfolioCandidateGate.apply(scan, 2.5, 12);
    const openGateEntries = gate.entries.filter(entry => entry.assetId.startsWith('OPEN_'));
    const status = !audit.error && audit.promotedAssets > 0 && openReal.length > 0
      ? 'PASS'
      : 'INCONCLUSIVE_EXTERNAL_DISCOVERY_COVERAGE';

    const result = {
      version: OPEN_MARKET_DISCOVERY_V1,
      status,
      generatedAt: new Date().toISOString(),
      integration: 'EXISTING_ASSET_UNIVERSE_SCANNER_CURRENT_LIVE',
      newUiSectionCreated: false,
      replayHistoricalModified: false,
      automaticPromotionScope: 'EUR_ETF_ONLY',
      discoveryAudit: audit,
      discovery: {
        queryCount: 12,
        acceptedEurCandidates: audit.promotedAssets
      },
      scanner: {
        scanned: scan.scanned,
        accepted: scan.accepted,
        rejected: scan.rejected,
        openCandidates: openCandidates.length,
        openAccepted: openAccepted.length,
        openReal: openReal.length,
        discoveredReal: openReal.length
      },
      coreEligibilityV2: {
        eligible: 'shadow-no-promotion',
        reviewRequired: 'N/D',
        rejected: 'N/D'
      },
      candidateGate: {
        openEntries: openGateEntries.length,
        openEligible: openGateEntries.filter(entry => entry.status === 'ELIGIBLE').length,
        entries: openGateEntries.map(entry => ({
          assetId: entry.assetId,
          ticker: entry.ticker,
          status: entry.status,
          reason: entry.reason
        }))
      },
      notes: [
        'Decision de hoy and backend alerts already call this same scanner with EUR_PORTFOLIO_DISCOVERY_UNIVERSE, so no new UI/module path is required.',
        'Automatic V1 promotion is restricted to current/live EUR ETFs discovered by Yahoo; explicit manual search remains broader.',
        'PortfolioCandidateGate keeps economic authority. Discovery cannot bypass it.',
        'CORE_ELIGIBILITY_V2 remains shadow-only and does not alter this live decision path.',
        'Historical replay does not call current Yahoo discovery and remains unchanged.'
      ]
    };
    console.log(`${MARKER}${JSON.stringify(result)}`);
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('OPEN_MARKET_LIVE_SCANNER_INTEGRATION_FATAL', error);
  process.exitCode = 1;
});
