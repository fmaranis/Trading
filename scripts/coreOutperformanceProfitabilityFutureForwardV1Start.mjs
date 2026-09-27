import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SNAPSHOT_PATH = 'validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-snapshot.json';
const SEAL_PATH = 'validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-seal.json';
const EXPECTED_FIRST_SESSION = '2026-09-28';

function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function yahooSymbol(symbol) {
  const [exchange, tickerRaw] = String(symbol).split(':');
  const ticker = tickerRaw ?? exchange;
  return ticker.replace(/./g, '-');
}

async function chart(symbol, start, end) {
  const p1 = Math.floor(Date.parse(start + 'T00:00:00Z') / 1000);
  const p2 = Math.floor(Date.parse(end + 'T00:00:00Z') / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS) || 30000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`YAHOO_HTTP_${response.status}:${symbol}:${text.slice(0,120)}`);
  const payload = JSON.parse(text);
  const r = payload?.chart?.result?.[0];
  if (!r) throw new Error(`YAHOO_NO_RESULT:${symbol}`);
  const q = r.indicators?.quote?.[0] ?? {};
  const adj = r.indicators?.adjclose?.[0]?.adjclose ?? [];
  return (r.timestamp ?? []).map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0,10),
    open: q.open?.[i],
    close: q.close?.[i],
    adjClose: adj[i]
  }));
}

function adjustedOpen(bar) {
  if (!finitePositive(bar?.open) || !finitePositive(bar?.close) || !finitePositive(bar?.adjClose)) return null;
  return Number(bar.open) * (Number(bar.adjClose) / Number(bar.close));
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function main() {
  const snapshotText = readFileSync(SNAPSHOT_PATH, 'utf8');
  const snapshot = JSON.parse(snapshotText);
  const seal = JSON.parse(readFileSync(SEAL_PATH, 'utf8'));

  if (snapshot.study !== 'CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1') {
    throw new Error('PROFITABILITY_FF_START_SNAPSHOT_VERSION_INVALID');
  }
  if (snapshot.outcome?.outcomeOpened !== false) {
    throw new Error('PROFITABILITY_FF_START_OUTCOME_ALREADY_OPENED');
  }
  if (seal.outcomeOpened !== false || seal.productionDefault !== 'LEGACY' || seal.productionAuthority !== false) {
    throw new Error('PROFITABILITY_FF_START_SEAL_INVALID');
  }

  const selected = snapshot.selected ?? [];
  if (!selected.length) throw new Error('PROFITABILITY_FF_START_SELECTED_EMPTY');

  const symbols = [...selected.map(row => yahooSymbol(row.symbol)), 'SPY', 'URTH'];
  const uniqueSymbols = [...new Set(symbols)];
  if (uniqueSymbols.length !== symbols.length) throw new Error('PROFITABILITY_FF_START_DUPLICATE_SYMBOL');

  const searchEnd = '2026-10-06';
  const barsBySymbol = new Map();
  for (const symbol of uniqueSymbols) {
    barsBySymbol.set(symbol, await chart(symbol, EXPECTED_FIRST_SESSION, searchEnd));
  }

  const candidateDates = [...new Set(
    (barsBySymbol.get('SPY') ?? []).map(bar => bar.date).filter(date => date >= EXPECTED_FIRST_SESSION)
  )].sort();

  const commonDate = candidateDates.find(date =>
    uniqueSymbols.every(symbol => {
      const bar = (barsBySymbol.get(symbol) ?? []).find(row => row.date === date);
      return finitePositive(adjustedOpen(bar));
    })
  );

  if (!commonDate) {
    throw new Error('PROFITABILITY_FF_START_NO_COMMON_TRADABLE_SESSION');
  }

  const adjustedOpenBySymbol = {};
  const rawAudit = {};
  for (const symbol of uniqueSymbols) {
    const bar = (barsBySymbol.get(symbol) ?? []).find(row => row.date === commonDate);
    const ao = adjustedOpen(bar);
    if (!finitePositive(ao)) throw new Error(`PROFITABILITY_FF_START_MISSING_ADJUSTED_OPEN:${symbol}:${commonDate}`);
    adjustedOpenBySymbol[symbol] = ao;
    rawAudit[symbol] = { open: Number(bar.open), close: Number(bar.close), adjustedClose: Number(bar.adjClose) };
  }

  const selectedStartAdjustedPrices = Object.fromEntries(
    selected.map(row => [row.symbol, adjustedOpenBySymbol[yahooSymbol(row.symbol)]])
  );

  const result = {
    schemaVersion: 1,
    study: snapshot.study,
    status: 'START_PRICES_LOCKED',
    snapshotDate: snapshot.snapshotDate,
    expectedFirstSession: EXPECTED_FIRST_SESSION,
    startDate: commonDate,
    startPriceSemantics: 'ADJUSTED_OPEN = raw open * adjustedClose / raw close on same completed session',
    selectedCount: selected.length,
    selectedStartAdjustedPrices,
    benchmarkStartAdjustedPrices: {
      SPY: adjustedOpenBySymbol.SPY,
      URTH: adjustedOpenBySymbol.URTH
    },
    rawAudit,
    source: {
      provider: 'YAHOO_REAL',
      fetchedAfterCompletedSession: true,
      snapshotSha256: sha256(snapshotText)
    },
    productionDefault: 'LEGACY',
    productionAuthority: false,
    nextCheckpoints: {
      descriptive3m: 'approximately 2026-12-28',
      descriptive6m: 'approximately 2027-03-28',
      primary12m: 'approximately 2027-09-28'
    }
  };

  console.log('CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_START', JSON.stringify(result));
}

main().catch(error => {
  console.error('CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_START', JSON.stringify({
    status: 'START_CAPTURE_BLOCKED',
    reason: error?.message ?? String(error),
    productionDefault: 'LEGACY',
    productionAuthority: false
  }));
  process.exitCode = 1;
});
