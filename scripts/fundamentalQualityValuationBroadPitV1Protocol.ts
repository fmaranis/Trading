export const FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1 = {
  version: 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1',
  researchOnly: true,
  productionAuthority: false,
  productionDefault: 'LEGACY',
  informationDate: '2021-05-03',
  outcomeDate: '2022-05-03',
  universe: {
    provider: 'EODHD',
    indexSymbol: 'GSPC.INDX',
    rule: 'HISTORICAL_COMPONENT_MEMBER_ON_INFORMATION_DATE'
  },
  fundamentals: {
    provider: 'SEC_EDGAR_COMPANYFACTS',
    filingRule: 'filed <= informationDate',
    acceptedAnnualForms: ['10-K', '10-K/A'],
    operatingProfitabilityGuard: 'LATEST_CAUSAL_ANNUAL_OPERATING_INCOME_GT_0',
    roe: 'LATEST_CAUSAL_ANNUAL_NET_INCOME / MATCHED_POSITIVE_STOCKHOLDERS_EQUITY',
    debtEquity: 'CAUSAL_TOTAL_DEBT_AT_LATEST_ANNUAL_PERIOD_END / MATCHED_POSITIVE_STOCKHOLDERS_EQUITY',
    earningsVariability: 'SAMPLE_STDDEV_OF_4_YOY_EPS_GROWTH_RATES_FROM_LAST_5_CAUSAL_ANNUAL_EPS_VALUES',
    winsorizationPct: [5, 95],
    descriptorWeights: { roe: 1, debtEquity: 1, earningsVariability: 1 },
    descriptorSigns: { roe: 1, debtEquity: -1, earningsVariability: -1 },
    missingRule: 'ROE_REQUIRED; D_E_OR_EVAR_MAY_BE_MISSING_SINGLY; BOTH_MISSING_EXCLUDES_SCORE',
    translationStatus: 'PROVIDER_INDEPENDENT_SEC_TRANSLATION_NOT_BYTE_IDENTICAL_TO_WOLFRAM_SMALL_SAMPLE'
  },
  qualityBranch: {
    highQualityRule: 'QUALITY_SCORE_AT_OR_ABOVE_CROSS_SECTIONAL_MEDIAN',
    noOutcomeTuning: true
  },
  valuation: {
    descriptor: 'SEC_CAUSAL_ANNUAL_EARNINGS_YIELD_V1',
    formula: 'LATEST_CAUSAL_ANNUAL_NET_INCOME / (RAW_CLOSE_ON_INFORMATION_DATE * LATEST_CAUSAL_SHARES_OUTSTANDING)',
    cheapReasonableRule: 'WITHIN_HIGH_QUALITY_EARNINGS_YIELD_AT_OR_ABOVE_MEDIAN',
    expensiveRule: 'WITHIN_HIGH_QUALITY_EARNINGS_YIELD_BELOW_MEDIAN',
    noOutcomeTuning: true,
    translationStatus: 'ANNUAL_CAUSAL_EARNINGS_YIELD_TRANSLATION_NOT_TRAILING_PROVIDER_REPLICATION'
  },
  outcomes: {
    priceProvider: 'YAHOO_FINANCE_REAL',
    returnTreatment: 'ADJUSTED_TOTAL_RETURN_PROXY',
    primaryBenchmark: 'SPY',
    secondaryStructuralCoreProxy: 'URTH',
    benchmarkSelectionFrozenBeforeOutcomes: true
  },
  coverageGate: {
    minimumHistoricalMembers: 400,
    minimumCikMapped: 350,
    minimumEvaluableProfitable: 250,
    minimumHighQuality: 100,
    minimumPerValuationBranch: 40
  },
  interpretation: {
    samplePromotionEligible: false,
    purpose: 'BROAD_POINT_IN_TIME_STOCK_LEVEL_CONFIRMATION_OF_QUALITY_X_VALUATION_INTERACTION',
    noRetuningAfterOutcome: true
  }
} as const;

export type QualityInput = {
  id: string;
  roe: number;
  debtEquity: number | null;
  earningsVariability: number | null;
  earningsYield: number | null;
};

export type QualityScored = QualityInput & {
  roeWinsorized: number;
  debtEquityWinsorized: number | null;
  earningsVariabilityWinsorized: number | null;
  roeZ: number;
  debtEquityZ: number | null;
  earningsVariabilityZ: number | null;
  qualityScore: number;
};

export function median(values: number[]): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) throw new Error('MEDIAN_REQUIRES_VALUES');
  const m = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[m] : (clean[m - 1] + clean[m]) / 2;
}

export function quantile(values: number[], p: number): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) throw new Error('QUANTILE_REQUIRES_VALUES');
  if (!(p >= 0 && p <= 1)) throw new Error('QUANTILE_P_OUT_OF_RANGE');
  if (clean.length === 1) return clean[0];
  const h = (clean.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return clean[lo];
  return clean[lo] + (clean[hi] - clean[lo]) * (h - lo);
}

function winsorBounds(values: number[]): { low: number; high: number } {
  return { low: quantile(values, 0.05), high: quantile(values, 0.95) };
}

function clamp(value: number, bounds: { low: number; high: number }): number {
  return Math.max(bounds.low, Math.min(bounds.high, value));
}

function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function zStats(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = sampleStd(values);
  return { mean, sd };
}

function z(value: number, stats: { mean: number; sd: number }): number {
  return stats.sd > 0 ? (value - stats.mean) / stats.sd : 0;
}

export function scoreQualityCrossSection(rows: QualityInput[]): QualityScored[] {
  const eligible = rows.filter(row =>
    Number.isFinite(row.roe)
    && (Number.isFinite(row.debtEquity as number) || Number.isFinite(row.earningsVariability as number))
  );
  if (eligible.length < 3) throw new Error('QUALITY_CROSS_SECTION_TOO_SMALL');

  const roeBounds = winsorBounds(eligible.map(row => row.roe));
  const deValues = eligible.map(row => row.debtEquity).filter((v): v is number => v != null && Number.isFinite(v));
  const evValues = eligible.map(row => row.earningsVariability).filter((v): v is number => v != null && Number.isFinite(v));
  const deBounds = deValues.length ? winsorBounds(deValues) : null;
  const evBounds = evValues.length ? winsorBounds(evValues) : null;

  const prepared = eligible.map(row => ({
    ...row,
    roeWinsorized: clamp(row.roe, roeBounds),
    debtEquityWinsorized: row.debtEquity != null && deBounds ? clamp(row.debtEquity, deBounds) : null,
    earningsVariabilityWinsorized: row.earningsVariability != null && evBounds ? clamp(row.earningsVariability, evBounds) : null
  }));

  const roeStats = zStats(prepared.map(row => row.roeWinsorized));
  const dePrepared = prepared.map(row => row.debtEquityWinsorized).filter((v): v is number => v != null);
  const evPrepared = prepared.map(row => row.earningsVariabilityWinsorized).filter((v): v is number => v != null);
  const deStats = dePrepared.length ? zStats(dePrepared) : null;
  const evStats = evPrepared.length ? zStats(evPrepared) : null;

  return prepared.map(row => {
    const roeZ = z(row.roeWinsorized, roeStats);
    const debtEquityZ = row.debtEquityWinsorized != null && deStats ? z(row.debtEquityWinsorized, deStats) : null;
    const earningsVariabilityZ = row.earningsVariabilityWinsorized != null && evStats ? z(row.earningsVariabilityWinsorized, evStats) : null;
    const components = [
      roeZ,
      ...(debtEquityZ == null ? [] : [-debtEquityZ]),
      ...(earningsVariabilityZ == null ? [] : [-earningsVariabilityZ])
    ];
    return {
      ...row,
      roeZ,
      debtEquityZ,
      earningsVariabilityZ,
      qualityScore: components.reduce((s, v) => s + v, 0) / components.length
    };
  });
}

export function splitHighQualityByValuation(rows: QualityScored[]) {
  const qualityMedian = median(rows.map(row => row.qualityScore));
  const highQuality = rows.filter(row => row.qualityScore >= qualityMedian);
  const valued = highQuality.filter(row => row.earningsYield != null && Number.isFinite(row.earningsYield));
  if (valued.length < 2) throw new Error('HIGH_QUALITY_VALUATION_COVERAGE_TOO_SMALL');
  const valuationMedian = median(valued.map(row => row.earningsYield as number));
  return {
    qualityMedian,
    valuationMedian,
    highQuality,
    cheapReasonable: valued.filter(row => (row.earningsYield as number) >= valuationMedian),
    expensive: valued.filter(row => (row.earningsYield as number) < valuationMedian)
  };
}

export function epsGrowthVariability(lastFiveAnnualEps: number[]): number | null {
  if (lastFiveAnnualEps.length !== 5 || lastFiveAnnualEps.some(value => !Number.isFinite(value))) return null;
  const growth: number[] = [];
  for (let i = 1; i < lastFiveAnnualEps.length; i++) {
    const prior = lastFiveAnnualEps[i - 1];
    if (prior === 0) return null;
    growth.push(lastFiveAnnualEps[i] / prior - 1);
  }
  return sampleStd(growth);
}
