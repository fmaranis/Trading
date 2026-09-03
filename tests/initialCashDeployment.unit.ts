import { CurrentOpportunityAlertEngine, PortfolioDecisionEngine } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

function bars(multiplier: number, count = 320) {
  const out: any[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price *= multiplier;
    out.push({
      timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      open: price * 0.999,
      high: price * 1.002,
      low: price * 0.998,
      close: price,
      volume: 1000
    });
  }
  return out;
}

function candidate(assetId: string, ticker: string, category: string, series: any[], m120: number, vol: number, score: number): any {
  return {
    asset: { assetId, ticker, name: ticker, category, currency: 'EUR' },
    status: 'ACCEPTED',
    bars: series.length,
    asOfDate: series.at(-1).timestamp.slice(0, 10),
    lastClose: series.at(-1).close,
    momentum20Pct: m120 / 4,
    momentum60Pct: m120 / 2,
    momentum120Pct: m120,
    annualizedVolatilityPct: vol,
    maxDrawdownPct: 8,
    score
  };
}

function scanFrom(rows: any[], seriesByAsset: Record<string, any[]>): any {
  const acceptedDataset: any = {
    timeframe: '1d',
    assets: rows.map(c => ({
      assetId: c.asset.assetId,
      ticker: c.asset.ticker,
      name: c.asset.name,
      currency: 'EUR',
      bars: seriesByAsset[c.asset.assetId],
      provenance: { sourceType: 'REAL', provider: 'unit', symbol: c.asset.ticker, isReproducible: true }
    }))
  };
  return {
    scanned: rows.length,
    accepted: rows.length,
    rejected: 0,
    rejectionCounts: {},
    selected: rows,
    candidates: rows,
    acceptedDataset,
    dataset: acceptedDataset
  };
}

const strongBars = bars(1.0024);
const strongCandidates = [
  candidate('BOOT_A', 'BOOTA.DE', 'TECHNOLOGY', strongBars, 26, 15, 25),
  candidate('BOOT_B', 'BOOTB.DE', 'TECHNOLOGY', strongBars, 25, 15, 24),
  candidate('BOOT_C', 'BOOTC.DE', 'TECHNOLOGY', strongBars, 24, 15, 23),
  candidate('BOOT_D', 'BOOTD.DE', 'TECHNOLOGY', strongBars, 23, 15, 22),
  candidate('BOOT_E', 'BOOTE.DE', 'TECHNOLOGY', strongBars, 22, 15, 21)
];
const strongSeries = Object.fromEntries(strongCandidates.map(row => [row.asset.assetId, strongBars]));
const bootstrapScan = scanFrom(strongCandidates, strongSeries);
const decision: any = { cashWeight: 0.10, riskProfile: 'MEDIUM', horizonYears: 3, assets: [] };

const alerts = CurrentOpportunityAlertEngine.evaluate(bootstrapScan, 2.5);
check('bootstrap fixture exposes at least four actionable opportunities', alerts.length >= 4);

const emptyPortfolio: any = {
  cashEur: 10000,
  holdings: [],
  funds: [],
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00Z'
};
const bootstrapResult = PortfolioDecisionEngine.evaluate({
  portfolio: emptyPortfolio,
  scan: bootstrapScan,
  decision,
  cashBenchmarkAnnualPct: 2.5
});
const bootstrapNew = bootstrapResult.contributions.filter(row => (row.currentAssetValueEur ?? 0) <= 0.01);
const bootstrapSpend = bootstrapNew.reduce((sum, row) => sum + row.amountEur, 0);
check('medium-risk portfolio below 50% invested may open four diversified starters', bootstrapNew.length === 4);
check('bootstrap never raises the existing five-percent ENTRY_STRONG starter cap', bootstrapNew.every(row => (row.portfolioShareCapPct ?? Infinity) <= 5 + 1e-9 && (row.executableTargetAssetValueEur ?? Infinity) <= 500 + 1e-6));
check('bootstrap remains bounded by finite deployable capital', bootstrapSpend <= bootstrapResult.deployableToAssetsEur + 1e-9);
check('bootstrap state is explicitly auditable in warnings', bootstrapResult.warnings.some(warning => warning.includes('Despliegue inicial diversificado activo')));

const anchorBars = bars(1.00005);
const anchor = candidate('ANCHOR', 'ANCHOR.DE', 'GOV_BONDS', anchorBars, 0.5, 7, 5);
const matureScan = scanFrom(
  [anchor, ...strongCandidates],
  { ANCHOR: anchorBars, ...strongSeries }
);
const anchorPrice = anchor.lastClose;
const maturePortfolio: any = {
  cashEur: 4000,
  holdings: [{ ticker: 'ANCHOR.DE', shares: 6000 / anchorPrice }],
  funds: [],
  stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
  updatedAt: '2026-08-30T00:00:00Z'
};
const matureResult = PortfolioDecisionEngine.evaluate({
  portfolio: maturePortfolio,
  scan: matureScan,
  decision,
  cashBenchmarkAnnualPct: 2.5
});
const matureNew = matureResult.contributions.filter(row => (row.currentAssetValueEur ?? 0) <= 0.01);
check('at 60% invested the engine automatically returns to the normal two-new-position medium-risk limit', matureNew.length <= 2);
check('mature portfolio no longer reports bootstrap deployment mode', !matureResult.warnings.some(warning => warning.includes('Despliegue inicial diversificado activo')));

console.log(`Initial cash deployment: ${passed}/7 invariants passed.`);
