export const CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1 = Object.freeze({
  version: 'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1',
  researchOnly: true,
  productionAuthority: false,
  productionDefault: 'LEGACY',
  source: {
    repository: 'chinobing/historical_sp500_constituents',
    commit: '019beba2644764db88219cee6a8c43b8aae4904e',
    currentPath: 'sp500_constituents.csv',
    changesPath: 'sp500_changes_since_1996.csv',
    currentBlobSha: '1431476ddf0f0389afa175d010116d96c8371975',
    changesBlobSha: 'ccdcb9d50c588a198c2eecdf0f7c38a7f205c75e',
    provenance: 'STATIC_REFERENCE'
  },
  anchors: ['2016-06-30','2017-06-30','2018-06-30','2019-06-30','2020-06-30','2021-06-30'],
  fundamentals: {
    provider: 'SEC_EDGAR_COMPANYFACTS',
    acceptedForms: ['10-K','10-K/A'],
    filingRule: 'filed <= signalDate',
    formula: '(Revenue - COGS - SGA - InterestExpense) / PositiveBookEquity',
    revenueTags: ['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],
    cogsTags: ['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold'],
    sgaTags: ['SellingGeneralAndAdministrativeExpense'],
    interestTags: ['InterestExpenseNonOperating','InterestExpense'],
    equityTags: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest','StockholdersEquity'],
    sharesTags: ['EntityCommonStockSharesOutstanding','CommonStockSharesOutstanding'],
    noOperatingIncomeFallback: true
  },
  selection: {
    rule: 'TOP_DECILE_DESC_OP_SEC',
    count: 'ceil(N/10)',
    tieBreak: 'NORMALIZED_TICKER_ASC',
    weighting: 'CAUSAL_MARKET_CAP_VALUE_WEIGHTED',
    noEqualWeightFallback: true
  },
  execution: {
    signalDate: 'LAST_REAL_SESSION_ON_OR_BEFORE_JUNE_30',
    executionDate: 'FIRST_REAL_SESSION_AFTER_SIGNAL_DATE',
    outcome: 'ADJUSTED_OPEN_TO_NEXT_ADJUSTED_OPEN',
    missingSelectedOutcome: 'INCONCLUSIVE_NO_SURVIVOR_RENORMALIZATION'
  },
  benchmarks: ['SPY','URTH'],
  coverage: {
    minimumHistoricalMembers: 450,
    minimumCikMapped: 350,
    minimumEvaluable: 250,
    minimumSelected: 25,
    selectedMarketCapCoveragePct: 100,
    selectedOutcomeCoveragePct: 100
  },
  stageC1Gate: {
    requiredPeriods: 5,
    grossCagrVsSpyPositive: true,
    grossCagrVsUrthPositive: true
  }
});

export function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function topDecileCount(n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('TOP_DECILE_REQUIRES_POSITIVE_INTEGER');
  return Math.ceil(n / 10);
}

export function selectTopDecile(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('TOP_DECILE_REQUIRES_ROWS');
  const clean = rows
    .filter(row => Number.isFinite(Number(row.operatingProfitability)))
    .map(row => ({ ...row, operatingProfitability: Number(row.operatingProfitability) }))
    .sort((a,b) => b.operatingProfitability - a.operatingProfitability
      || normalizeTicker(a.ticker).localeCompare(normalizeTicker(b.ticker)));
  if (!clean.length) throw new Error('TOP_DECILE_NO_EVALUABLE_ROWS');
  return clean.slice(0, topDecileCount(clean.length));
}

export function reconstructHistoricalMembers(currentSymbols, changes, targetDate) {
  const members = new Set(currentSymbols.map(normalizeTicker).filter(Boolean));
  const later = [...changes]
    .filter(row => String(row.date) > targetDate)
    .sort((a,b) => String(b.date).localeCompare(String(a.date)));
  for (const row of later) {
    for (const ticker of row.added ?? []) members.delete(normalizeTicker(ticker));
    for (const ticker of row.removed ?? []) members.add(normalizeTicker(ticker));
  }
  return [...members].filter(Boolean).sort();
}
