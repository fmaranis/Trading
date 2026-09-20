type EodhdExchange = {
  Code?: string;
  Name?: string;
  Country?: string;
  Currency?: string;
  OperatingMIC?: string;
};

type EodhdSymbol = {
  Code?: string;
  Name?: string;
  Country?: string;
  Exchange?: string;
  Currency?: string;
  Type?: string;
  Isin?: string | null;
};

const TARGETS = [
  { yahooSuffix: '.DE', preferredCodes: ['XETRA'] },
  { yahooSuffix: '.PA', preferredCodes: ['PA', 'XPAR'] },
  { yahooSuffix: '.MC', preferredCodes: ['MC', 'BMEX'] },
  { yahooSuffix: '.MI', preferredCodes: ['MI'] },
  { yahooSuffix: '.AS', preferredCodes: ['AS', 'XAMS'] },
  { yahooSuffix: '.BR', preferredCodes: ['BR'] },
  { yahooSuffix: '.VI', preferredCodes: ['VI'] },
  { yahooSuffix: '.HE', preferredCodes: ['HE'] },
  { yahooSuffix: '.LS', preferredCodes: ['LS'] },
  { yahooSuffix: '.IR', preferredCodes: ['IR'] }
] as const;

function apiKey(): string {
  const key = process.env.EODHD_API_KEY?.trim();
  if (!key) throw new Error('PHASE8_EODHD_API_KEY_REQUIRED');
  return key;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Custodia/1.0 Phase8PIT' },
    signal: AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS) || 15000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`PHASE8_EODHD_HTTP_${response.status}:${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { throw new Error('PHASE8_EODHD_INVALID_JSON'); }
}

function usableInstrument(row: EodhdSymbol): boolean {
  const currency = String(row.Currency ?? '').toUpperCase();
  const type = String(row.Type ?? '').toUpperCase();
  if (currency !== 'EUR') return false;
  return type.includes('ETF') || type.includes('STOCK') || type.includes('EQUITY') || type.includes('COMMON');
}

async function symbolList(code: string, delisted: boolean, key: string): Promise<EodhdSymbol[]> {
  const url = `https://eodhd.com/api/exchange-symbol-list/${encodeURIComponent(code)}?api_token=${encodeURIComponent(key)}&fmt=json&delisted=${delisted ? 1 : 0}`;
  const payload = await fetchJson(url);
  if (!Array.isArray(payload)) throw new Error(`PHASE8_EODHD_SYMBOL_LIST_INVALID:${code}:${delisted ? 'DELISTED' : 'ACTIVE'}`);
  return (payload as EodhdSymbol[]).filter(usableInstrument);
}

async function main() {
  const key = apiKey();
  const exchangesPayload = await fetchJson(`https://eodhd.com/api/exchanges-list/?api_token=${encodeURIComponent(key)}&fmt=json`);
  if (!Array.isArray(exchangesPayload)) throw new Error('PHASE8_EODHD_EXCHANGES_INVALID');

  const exchanges = exchangesPayload as EodhdExchange[];
  const byCode = new Map(exchanges.map(row => [String(row.Code ?? '').toUpperCase(), row] as const));
  const resolved = TARGETS.map(target => {
    const code = target.preferredCodes.find(candidate => byCode.has(candidate.toUpperCase())) ?? null;
    return { yahooSuffix: target.yahooSuffix, eodhdCode: code };
  });

  const available = resolved.filter(row => row.eodhdCode != null) as Array<{ yahooSuffix: string; eodhdCode: string }>;
  if (!available.length) throw new Error('PHASE8_EODHD_NO_TARGET_EXCHANGES_RESOLVED');

  const rows: any[] = [];
  for (const target of available) {
    const active = await symbolList(target.eodhdCode, false, key);
    const delisted = await symbolList(target.eodhdCode, true, key);
    rows.push({
      yahooSuffix: target.yahooSuffix,
      eodhdCode: target.eodhdCode,
      activeEurStocksEtfs: active.length,
      delistedEurStocksEtfs: delisted.length,
      activeWithIsin: active.filter(row => String(row.Isin ?? '').trim()).length,
      delistedWithIsin: delisted.filter(row => String(row.Isin ?? '').trim()).length
    });
  }

  const totals = rows.reduce((acc, row) => ({
    activeEurStocksEtfs: acc.activeEurStocksEtfs + row.activeEurStocksEtfs,
    delistedEurStocksEtfs: acc.delistedEurStocksEtfs + row.delistedEurStocksEtfs,
    activeWithIsin: acc.activeWithIsin + row.activeWithIsin,
    delistedWithIsin: acc.delistedWithIsin + row.delistedWithIsin
  }), { activeEurStocksEtfs: 0, delistedEurStocksEtfs: 0, activeWithIsin: 0, delistedWithIsin: 0 });

  console.log('PHASE8_EODHD_INSTRUMENT_INVENTORY_RESULT');
  console.log(JSON.stringify({
    status: 'SOURCE_INVENTORY_COLLECTED',
    provider: 'EODHD',
    targetYahooPrimarySuffixes: TARGETS.map(row => row.yahooSuffix),
    resolvedMarkets: rows,
    unresolvedYahooSuffixes: resolved.filter(row => row.eodhdCode == null).map(row => row.yahooSuffix),
    totals,
    activeAndDelistedListsQueried: true,
    listingDatesFetched: false,
    delistingDatesFetched: false,
    tickerHistoryFetched: false,
    pointInTimeMasterPromoted: false,
    coverageClassification: 'SOURCE_INVENTORY_ONLY_NOT_PIT_MASTER',
    note: 'This inventory proves provider coverage only. It does not infer listing dates from price history and cannot by itself authorize COMPLETE_POINT_IN_TIME.'
  }, null, 2));
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('PHASE8_EODHD_HTTP_402') && message.toLowerCase().includes('daily api requests limit')) {
    console.log('PHASE8_EODHD_INSTRUMENT_INVENTORY_RESULT');
    console.log(JSON.stringify({
      status: 'SOURCE_DAILY_LIMIT_EXCEEDED',
      provider: 'EODHD',
      inventoryCollected: false,
      pointInTimeMasterPromoted: false,
      coverageClassification: 'SOURCE_TEMPORARILY_UNAVAILABLE_NOT_PIT_MASTER',
      retryRequiredForStructuralClosure: false,
      productionImpact: 'NONE',
      note: 'EODHD daily request quota was exhausted. Phase 8 structural PIT architecture remains valid; source inventory is informational and must not block structural closure.'
    }, null, 2));
    process.exit(0);
  }
  console.error('PHASE8_EODHD_INSTRUMENT_INVENTORY_FATAL', error);
  process.exit(1);
});
