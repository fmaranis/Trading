import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner, EUR_ASSET_UNIVERSE } from '../src/investment/decision';

type CrossCheckResult = {
  ticker: string;
  eodhdSymbol?: string;
  status: string;
  yahooDate?: string;
  yahooClose?: number;
  eodhdDate?: string;
  eodhdClose?: number;
  differencePct?: number;
  tolerancePct?: number;
  cached?: boolean;
  message?: string;
};

type CrossCheckResponse = {
  configured?: boolean;
  provider?: string;
  primaryProvider?: string;
  nonBlocking?: boolean;
  summaryState?: string;
  requested?: number;
  checked?: number;
  matched?: number;
  divergent?: number;
  coveragePct?: number;
  cacheHits?: number;
  upstreamCalls?: number;
  cacheTtlHours?: number;
  results?: CrossCheckResult[];
  error?: string;
};

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function compactResults(response: CrossCheckResponse) {
  return (response.results ?? []).map(item => ({
    ticker: item.ticker,
    eodhdSymbol: item.eodhdSymbol ?? null,
    yahooDate: item.yahooDate ?? null,
    yahooClose: item.yahooClose == null ? null : Number(item.yahooClose.toFixed(6)),
    eodhdDate: item.eodhdDate ?? null,
    eodhdClose: item.eodhdClose == null ? null : Number(item.eodhdClose.toFixed(6)),
    differencePct: item.differencePct == null ? null : Number(item.differencePct.toFixed(4)),
    status: item.status,
    cached: Boolean(item.cached),
    message: item.message ?? null
  }));
}

function cacheableFirstPassCount(response: CrossCheckResponse): number {
  const nonCacheable = new Set(['QUOTA_EXHAUSTED', 'SKIPPED_QUOTA_EXHAUSTED', 'TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR', 'AUTH_ERROR']);
  return (response.results ?? []).filter(item => !nonCacheable.has(item.status)).length;
}

async function postCrossCheck(base: string, assets: Array<{ ticker: string; asOfDate: string; lastClose: number }>) {
  const response = await fetch(`${base}/api/eodhd/cross-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets })
  });
  const body = await response.json() as CrossCheckResponse;
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;

  if (!(await waitFor(`${base}/api/health`, 1200))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: process.env
    });
    ownsServer = true;
    if (!(await waitFor(`${base}/api/health`, 30_000))) {
      throw new Error('Servidor local no disponible en puerto 3000');
    }
  }

  try {
    const statusResponse = await fetch(`${base}/api/eodhd/status`);
    const status = await statusResponse.json() as { configured?: boolean; cacheTtlHours?: number; cachedEntries?: number; nonBlocking?: boolean };
    if (!status.configured) {
      console.log('EODHD_SHORTLIST_VALIDATION_RESULT');
      console.log(JSON.stringify({
        configured: false,
        primaryProviderOperational: true,
        secondaryProviderBlocking: false,
        validationPassed: false,
        blocker: 'EODHD_API_KEY_NOT_CONFIGURED'
      }, null, 2));
      return;
    }

    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${base}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const end = new Date();
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 7);

    const scan = await AssetUniverseScanner.scan(
      EUR_ASSET_UNIVERSE,
      isoDate(start),
      isoDate(end),
      { forceRefresh: true, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 }
    );

    const assets = scan.selected.map(candidate => ({
      ticker: candidate.asset.ticker,
      asOfDate: candidate.asOfDate!,
      lastClose: candidate.lastClose!
    }));

    const first = await postCrossCheck(base, assets);
    if (!first.ok) {
      throw new Error(`EODHD shortlist cross-check HTTP ${first.status}: ${first.body.error ?? 'unknown error'}`);
    }

    const second = await postCrossCheck(base, assets);
    if (!second.ok) {
      throw new Error(`EODHD shortlist cache rerun HTTP ${second.status}: ${second.body.error ?? 'unknown error'}`);
    }

    const expectedCacheHits = cacheableFirstPassCount(first.body);
    const cacheReuseProven = expectedCacheHits > 0
      && (second.body.cacheHits ?? 0) >= expectedCacheHits
      && (second.body.upstreamCalls ?? 0) === 0;

    const providerUnavailableStates = new Set(['UNAVAILABLE', 'QUOTA_EXHAUSTED']);
    const firstUsable = !providerUnavailableStates.has(first.body.summaryState ?? '') && (first.body.checked ?? 0) > 0;
    const validationPassed = assets.length >= 2 && firstUsable && cacheReuseProven;

    console.log('EODHD_SHORTLIST_VALIDATION_RESULT');
    console.log(JSON.stringify({
      configured: true,
      primaryProvider: 'yahoo_finance',
      primaryProviderOperational: true,
      secondaryProvider: 'eodhd',
      secondaryProviderBlocking: false,
      selectedCount: assets.length,
      selectedTickers: assets.map(asset => asset.ticker),
      scan: {
        catalogSize: EUR_ASSET_UNIVERSE.length,
        scanned: scan.scanned,
        accepted: scan.accepted,
        rejected: scan.rejected,
        rejectionCounts: scan.rejectionCounts
      },
      firstPass: {
        summaryState: first.body.summaryState,
        requested: first.body.requested,
        checked: first.body.checked,
        matched: first.body.matched,
        divergent: first.body.divergent,
        coveragePct: first.body.coveragePct == null ? null : Number(first.body.coveragePct.toFixed(2)),
        upstreamCalls: first.body.upstreamCalls,
        cacheHits: first.body.cacheHits,
        results: compactResults(first.body)
      },
      immediateRerun: {
        summaryState: second.body.summaryState,
        requested: second.body.requested,
        checked: second.body.checked,
        matched: second.body.matched,
        divergent: second.body.divergent,
        coveragePct: second.body.coveragePct == null ? null : Number(second.body.coveragePct.toFixed(2)),
        upstreamCalls: second.body.upstreamCalls,
        cacheHits: second.body.cacheHits,
        results: compactResults(second.body)
      },
      cache: {
        ttlHours: second.body.cacheTtlHours ?? status.cacheTtlHours ?? null,
        expectedCacheHitsOnRerun: expectedCacheHits,
        cacheReuseProven
      },
      validationPassed,
      notes: [
        'Yahoo Finance remains the primary provider; EODHD is secondary and non-blocking.',
        'A PRICE_DIVERGENCE is reported as evidence and does not disable the Yahoo primary path.',
        'Cache proof requires the immediate rerun to serve all cacheable first-pass results without new EODHD upstream calls.'
      ]
    }, null, 2));

    if (!validationPassed) process.exitCode = 1;
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('EODHD_SHORTLIST_VALIDATION_ERROR', error?.message || String(error));
  process.exit(1);
});
