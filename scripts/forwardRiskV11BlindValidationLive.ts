import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PriceBar } from '../src/investment/backtesting/types';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { assessAssetSelectionQuality } from '../src/investment/decision/assetSelectionQuality';
import { AssetUniverseScanner, type AssetScanCandidate, type AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, type AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { historicalCashBenchmarkAnnualPct } from '../src/investment/decision/cashBenchmark';
import { brokerCommission } from '../src/investment/decision/costAwareExecutionPolicy';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { loadForwardRiskMacroDataV5VintageSafe } from '../src/investment/decision/forwardRiskMacroDataV5VintageSafe';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import {
  FORWARD_RISK_V11_DATA_QUALITY_GATE,
  FORWARD_RISK_V11_POLICY,
  FORWARD_RISK_V11_POLICY_FINGERPRINT,
  FORWARD_RISK_V11_VALIDATION_GATE,
  decideForwardRiskV11Sizing
} from '../src/investment/decision/forwardRiskV11SizingOverlay';
import { assertForwardRiskV11HistoricalHoldoutUnlocked, FORWARD_RISK_V11_VALIDATION_PROTOCOL } from '../src/investment/decision/forwardRiskV11ValidationProtocol';
import { PortfolioCandidateGate } from '../src/investment/decision/portfolioCandidateGate';
import { accrueRemuneratedCashScenarioAfterTax } from '../src/investment/decision/remuneratedCash';
import { estimateSpanishTaxOnCashInterest, type SpanishTaxSettings } from '../src/investment/decision/spanishTaxModel';

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };
const RESULT_PATH = path.resolve(process.cwd(), 'validation-runs/forward-risk-v11-blind-result.json');

const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const SIGNAL_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));
const BLIND_CATALOG: AssetUniverseItem[] = [
  { assetId: 'V11_BLIND_IUSQ', ticker: 'IUSQ.DE', isin: 'IE00B6R52259', name: 'iShares MSCI ACWI UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'V11_BLIND_IUSA', ticker: 'IUSA.DE', isin: 'IE0031442068', name: 'iShares Core S&P 500 UCITS ETF USD (Dist)', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'V11_BLIND_EUNM', ticker: 'EUNM.DE', isin: 'IE00B4L5YC18', name: 'iShares MSCI EM UCITS ETF USD (Acc)', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'V11_BLIND_EUNK', ticker: 'EUNK.DE', isin: 'IE00B4K48X80', name: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'V11_BLIND_SXR1', ticker: 'SXR1.DE', isin: 'IE00B52MJY50', name: 'iShares Core MSCI Pacific ex-Japan UCITS ETF', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'V11_BLIND_IQQJ', ticker: 'IQQJ.DE', isin: 'IE00B02KXH56', name: 'iShares MSCI Japan UCITS ETF USD (Dist)', category: 'JAPAN_EQUITY', currency: 'EUR' }
];

type V5Point = { informationDate: string; vulnerabilityScorePct: number };
type V7Point = { informationDate: string; signalScorePct: number };
type ScheduledDecision = {
  contributionEur: number;
  opportunityEligible: boolean;
  v5ScorePct: number | null;
  v7ScorePct: number | null;
  combinedRiskScorePct: number;
  v11DeployFraction: number;
};
type Account = {
  cashEur: number;
  shares: number;
  feesEur: number;
  cashInterestTaxEur: number;
  units: number;
  navPath: Array<{ date: string; nav: number }>;
};

type ValidCase = {
  assetId: string;
  ticker: string;
  status: 'VALID';
  sessions: number;
  monthlyDecisionEvents: number;
  eligibleDecisionEvents: number;
  riskModulatedEligibleEvents: number;
  totalContributionsEur: number;
  averageDeployFractionOnEligibleDecisions: number;
  averageDeployFractionOnRiskModulatedDecisions: number;
  baseline: { finalValueEur: number; maxDrawdownPct: number; shares: number; residualCashEur: number; feesEur: number; cashInterestTaxEur: number };
  v11: { finalValueEur: number; maxDrawdownPct: number; shares: number; residualCashEur: number; feesEur: number; cashInterestTaxEur: number };
  delta: {
    finalValueEur: number;
    finalDeltaPctOfContributions: number;
    drawdownReductionPctPoints: number;
    baselineWealthEfficiency: number;
    v11WealthEfficiency: number;
    wealthEfficiencyRatio: number;
  };
  decisionAudit: Array<{
    informationDate: string;
    executionDate: string;
    opportunityEligible: boolean;
    v5ScorePct: number | null;
    v7ScorePct: number | null;
    combinedRiskScorePct: number;
    v11DeployFraction: number;
  }>;
  individualPass: boolean;
};

type InvalidCase = { assetId: string; ticker: string; status: 'INVALID_DATA'; reason: string };

function isoDate(value: string): string { return value.slice(0, 10); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}
function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const start = prices[prices.length - 1 - lookback];
  const end = prices.at(-1)!;
  return start > 0 ? (end / start - 1) * 100 : null;
}
function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let index = 1; index < slice.length; index++) returns.push(Math.log(slice[index] / slice[index - 1]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxPriceDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  let peak = slice[0];
  let maximum = 0;
  for (const price of slice) {
    peak = Math.max(peak, price);
    if (peak > 0) maximum = Math.max(maximum, (peak - price) / peak * 100);
  }
  return maximum;
}
function maxNavDrawdown(path: Array<{ nav: number }>): number {
  if (!path.length) return 0;
  let peak = path[0].nav;
  let maximum = 0;
  for (const point of path) {
    peak = Math.max(peak, point.nav);
    if (peak > 0) maximum = Math.max(maximum, (peak - point.nav) / peak * 100);
  }
  return maximum;
}
function scannerScore(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null): number {
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  return momentum - riskPenalty;
}
function maxWholeSharesForBudget(cashEur: number, budgetEur: number, priceEur: number): number {
  const usable = Math.min(cashEur, Math.max(0, budgetEur));
  let shares = Math.floor(usable / priceEur);
  while (shares > 0) {
    const notional = shares * priceEur;
    if (notional + brokerCommission(notional) <= usable + 1e-9) return shares;
    shares--;
  }
  return 0;
}
function buyFractionOfCash(account: Account, priceEur: number, deployFraction: number): void {
  const fraction = clamp(deployFraction, 0, 1);
  const budget = account.cashEur * fraction;
  const shares = maxWholeSharesForBudget(account.cashEur, budget, priceEur);
  if (shares < 1) return;
  const notional = shares * priceEur;
  const fee = brokerCommission(notional);
  account.cashEur -= notional + fee;
  account.shares += shares;
  account.feesEur += fee;
}
function accrueCash(account: Account, fromDate: string, toDate: string): void {
  const accrued = accrueRemuneratedCashScenarioAfterTax({
    cashEur: account.cashEur,
    mode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    fixedAnnualPct: 0,
    fromDate,
    toDate,
    taxOnInterest: gross => estimateSpanishTaxOnCashInterest(gross, TAX_SETTINGS).estimatedTaxEur
  });
  account.cashEur = accrued.cashEur;
  account.cashInterestTaxEur += accrued.taxEur;
}
function addExternalContributionAtOpen(account: Account, contributionEur: number, openPrice: number): void {
  const preFlowEquity = account.cashEur + account.shares * openPrice;
  if (account.units <= 0) {
    account.units = contributionEur / 100;
  } else {
    const navOpen = preFlowEquity / account.units;
    if (!(navOpen > 0)) throw new Error('V11_NON_POSITIVE_FLOW_ADJUSTED_NAV_OPEN');
    account.units += contributionEur / navOpen;
  }
  account.cashEur += contributionEur;
}
function recordCloseNav(account: Account, date: string, closePrice: number): void {
  if (account.units <= 0) return;
  const equity = account.cashEur + account.shares * closePrice;
  account.navPath.push({ date, nav: equity / account.units });
}
function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  return new Promise(async resolve => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try { const response = await fetch(url); if (response.ok) { resolve(true); return; } } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    resolve(false);
  });
}
function latestScore<T extends { informationDate: string }>(points: T[], date: string, field: keyof T): number | null {
  let latest: number | null = null;
  for (const point of points) {
    if (point.informationDate > date) break;
    const value = point[field];
    if (typeof value === 'number' && Number.isFinite(value)) latest = value;
  }
  return latest;
}

function causalSingleAssetScan(asset: AssetUniverseItem, series: any, bars: PriceBar[]): AssetUniverseScanResult {
  const prices = bars.map(bar => bar.close);
  const asOfDate = bars.at(-1) ? isoDate(bars.at(-1)!.timestamp) : null;
  if (bars.length < 252 || !asOfDate) {
    const candidate: AssetScanCandidate = {
      asset, status: 'REJECTED', reason: 'INSUFFICIENT_HISTORY', bars: bars.length, asOfDate,
      lastClose: prices.at(-1) ?? null, momentum20Pct: null, momentum60Pct: null, momentum120Pct: null,
      annualizedVolatilityPct: null, maxDrawdownPct: null, reliabilityScore: null, opportunityScore: null,
      currentDrawdownPct: null, positiveRolling60Pct: null, positiveRolling120Pct: null, score: null
    };
    const empty = { timeframe: '1d' as const, assets: [] };
    return { scanned: 1, accepted: 0, rejected: 1, selected: [], candidates: [candidate], dataset: empty, acceptedDataset: empty, rejectionCounts: { INSUFFICIENT_HISTORY: 1 } };
  }
  const m20 = pctReturn(prices, 20);
  const m60 = pctReturn(prices, 60);
  const m120 = pctReturn(prices, 120);
  const vol = annualizedVolatility(prices, 60);
  const dd = maxPriceDrawdown(prices, 252);
  const quality = assessAssetSelectionQuality({ prices, momentum20Pct: m20, momentum60Pct: m60, momentum120Pct: m120, annualizedVolatilityPct: vol, maxDrawdownPct: dd });
  const historicalSeries = { ...series, bars };
  const dataset = { timeframe: '1d' as const, assets: [historicalSeries] };
  const candidate: AssetScanCandidate = {
    asset, status: 'ACCEPTED', bars: bars.length, asOfDate, lastClose: prices.at(-1) ?? null,
    momentum20Pct: m20, momentum60Pct: m60, momentum120Pct: m120,
    annualizedVolatilityPct: vol, maxDrawdownPct: dd, ...quality,
    score: scannerScore(m20, m60, m120, vol, dd),
    response: { bars: bars as any, provenance: historicalSeries.provenance, metadata: { currency: 'EUR' } }
  };
  return { scanned: 1, accepted: 1, rejected: 0, selected: [candidate], candidates: [candidate], dataset, acceptedDataset: dataset, rejectionCounts: {} };
}

function validateRawBars(assetId: string, ticker: string, bars: PriceBar[]): InvalidCase | null {
  if (bars.length < FORWARD_RISK_V11_DATA_QUALITY_GATE.minimumBars) return { assetId, ticker, status: 'INVALID_DATA', reason: `ONLY_${bars.length}_BARS` };
  const seen = new Set<string>();
  for (let index = 0; index < bars.length; index++) {
    const date = isoDate(bars[index].timestamp);
    if (seen.has(date)) return { assetId, ticker, status: 'INVALID_DATA', reason: `DUPLICATE_DATE:${date}` };
    seen.add(date);
    if (!(bars[index].open > 0) || !(bars[index].close > 0)) return { assetId, ticker, status: 'INVALID_DATA', reason: `NON_POSITIVE_OPEN_CLOSE:${date}` };
    if (index > 0) {
      const movePct = Math.abs((bars[index].close / bars[index - 1].close - 1) * 100);
      if (movePct > FORWARD_RISK_V11_DATA_QUALITY_GATE.maxAbsoluteOneSessionCloseReturnPct) {
        return { assetId, ticker, status: 'INVALID_DATA', reason: `ONE_SESSION_CLOSE_RETURN_${movePct.toFixed(2)}PCT:${date}` };
      }
    }
  }
  return null;
}

function evaluateAsset(asset: AssetUniverseItem, series: any, v5: V5Point[], v7: V7Point[]): ValidCase | InvalidCase {
  const allBars = [...series.bars].sort((a: PriceBar, b: PriceBar) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
  const economicBars = allBars.filter((bar: PriceBar) => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
  const invalid = validateRawBars(asset.assetId, asset.ticker, economicBars);
  if (invalid) return invalid;

  const monthlyInfoIndexes: number[] = [];
  let previousMonth = '';
  for (let index = 0; index < economicBars.length - 1; index++) {
    const month = isoDate(economicBars[index].timestamp).slice(0, 7);
    if (month !== previousMonth) { monthlyInfoIndexes.push(index); previousMonth = month; }
  }
  if (monthlyInfoIndexes.length < FORWARD_RISK_V11_DATA_QUALITY_GATE.minimumMonthlyDecisionEvents) {
    return { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA', reason: `ONLY_${monthlyInfoIndexes.length}_MONTHLY_DECISIONS` };
  }

  const monthlySet = new Set(monthlyInfoIndexes);
  const fullIndexByDate = new Map(allBars.map((bar: PriceBar, index: number) => [isoDate(bar.timestamp), index] as const));
  const opportunityCache = new Map<string, boolean>();
  const opportunityEligible = (economicIndex: number): boolean => {
    const date = isoDate(economicBars[economicIndex].timestamp);
    const cached = opportunityCache.get(date);
    if (cached != null) return cached;
    const fullIndex = fullIndexByDate.get(date);
    if (fullIndex == null) return false;
    const scan = causalSingleAssetScan(asset, series, allBars.slice(0, fullIndex + 1));
    const gate = PortfolioCandidateGate.apply(scan, historicalCashBenchmarkAnnualPct(date), 1);
    const eligible = gate.entries.find(entry => entry.assetId === asset.assetId)?.status === 'ELIGIBLE';
    opportunityCache.set(date, eligible);
    return eligible;
  };

  const baseline: Account = { cashEur: 0, shares: 0, feesEur: 0, cashInterestTaxEur: 0, units: 0, navPath: [] };
  const v11Account: Account = { cashEur: 0, shares: 0, feesEur: 0, cashInterestTaxEur: 0, units: 0, navPath: [] };
  const scheduled = new Map<number, ScheduledDecision>();
  const decisionAudit: ValidCase['decisionAudit'] = [];
  let eligibleDecisionEvents = 0;
  let riskModulatedEligibleEvents = 0;
  const eligibleDeployFractions: number[] = [];
  const modulatedDeployFractions: number[] = [];
  let previousDate = isoDate(economicBars[0].timestamp);

  for (let index = 0; index < economicBars.length; index++) {
    const bar = economicBars[index];
    const date = isoDate(bar.timestamp);
    if (index > 0) {
      accrueCash(baseline, previousDate, date);
      accrueCash(v11Account, previousDate, date);
    }

    const execution = scheduled.get(index);
    if (execution) {
      addExternalContributionAtOpen(baseline, execution.contributionEur, bar.open);
      addExternalContributionAtOpen(v11Account, execution.contributionEur, bar.open);
      if (execution.opportunityEligible) {
        buyFractionOfCash(baseline, bar.open, 1);
        buyFractionOfCash(v11Account, bar.open, execution.v11DeployFraction);
      }
      decisionAudit.push({
        informationDate: isoDate(economicBars[index - 1].timestamp),
        executionDate: date,
        opportunityEligible: execution.opportunityEligible,
        v5ScorePct: execution.v5ScorePct,
        v7ScorePct: execution.v7ScorePct,
        combinedRiskScorePct: execution.combinedRiskScorePct,
        v11DeployFraction: execution.v11DeployFraction
      });
    }

    recordCloseNav(baseline, date, bar.close);
    recordCloseNav(v11Account, date, bar.close);

    if (monthlySet.has(index) && index + 1 < economicBars.length) {
      const eligible = opportunityEligible(index);
      const v5ScorePct = latestScore(v5, date, 'vulnerabilityScorePct');
      const v7ScorePct = latestScore(v7, date, 'signalScorePct');
      const v11Decision = decideForwardRiskV11Sizing({
        opportunityEligible: eligible,
        v5VulnerabilityScorePct: v5ScorePct,
        v7OptionsScorePct: v7ScorePct
      });
      if (eligible) {
        eligibleDecisionEvents++;
        eligibleDeployFractions.push(v11Decision.deployFraction);
        if (v11Decision.deployFraction < 1 - 1e-12) {
          riskModulatedEligibleEvents++;
          modulatedDeployFractions.push(v11Decision.deployFraction);
        }
      }
      scheduled.set(index + 1, {
        contributionEur: FORWARD_RISK_V11_POLICY.economicSemantics.contributionEur,
        opportunityEligible: eligible,
        v5ScorePct,
        v7ScorePct,
        combinedRiskScorePct: v11Decision.combinedRiskScorePct,
        v11DeployFraction: v11Decision.deployFraction
      });
    }

    previousDate = date;
  }

  if (eligibleDecisionEvents < FORWARD_RISK_V11_DATA_QUALITY_GATE.minimumEligibleDecisionEvents) {
    return { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA', reason: `ONLY_${eligibleDecisionEvents}_ELIGIBLE_DECISIONS` };
  }
  if (riskModulatedEligibleEvents < FORWARD_RISK_V11_DATA_QUALITY_GATE.minimumRiskModulatedEligibleEvents) {
    return { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA', reason: `ONLY_${riskModulatedEligibleEvents}_RISK_MODULATED_ELIGIBLE_DECISIONS` };
  }

  const lastClose = economicBars.at(-1)!.close;
  const baselineFinal = baseline.cashEur + baseline.shares * lastClose;
  const v11Final = v11Account.cashEur + v11Account.shares * lastClose;
  const totalContributionsEur = monthlyInfoIndexes.length * FORWARD_RISK_V11_POLICY.economicSemantics.contributionEur;
  const baselineMaxDrawdownPct = maxNavDrawdown(baseline.navPath);
  const v11MaxDrawdownPct = maxNavDrawdown(v11Account.navPath);
  const drawdownReductionPctPoints = baselineMaxDrawdownPct - v11MaxDrawdownPct;
  const finalDeltaEur = v11Final - baselineFinal;
  const finalDeltaPctOfContributions = totalContributionsEur > 0 ? finalDeltaEur / totalContributionsEur * 100 : -Infinity;
  const baselineWealthEfficiency = totalContributionsEur > 0
    ? (baselineFinal / totalContributionsEur) / (1 + baselineMaxDrawdownPct / 100)
    : 0;
  const v11WealthEfficiency = totalContributionsEur > 0
    ? (v11Final / totalContributionsEur) / (1 + v11MaxDrawdownPct / 100)
    : 0;
  const wealthEfficiencyRatio = baselineWealthEfficiency > 0 ? v11WealthEfficiency / baselineWealthEfficiency : 0;
  const individualPass = drawdownReductionPctPoints >= FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualDrawdownReductionPctPoints
    && finalDeltaPctOfContributions >= FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualFinalDeltaPctOfContributions
    && wealthEfficiencyRatio >= FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualWealthEfficiencyRatio;

  return {
    assetId: asset.assetId,
    ticker: asset.ticker,
    status: 'VALID',
    sessions: economicBars.length,
    monthlyDecisionEvents: monthlyInfoIndexes.length,
    eligibleDecisionEvents,
    riskModulatedEligibleEvents,
    totalContributionsEur,
    averageDeployFractionOnEligibleDecisions: eligibleDeployFractions.reduce((sum, value) => sum + value, 0) / eligibleDeployFractions.length,
    averageDeployFractionOnRiskModulatedDecisions: modulatedDeployFractions.reduce((sum, value) => sum + value, 0) / modulatedDeployFractions.length,
    baseline: {
      finalValueEur: baselineFinal,
      maxDrawdownPct: baselineMaxDrawdownPct,
      shares: baseline.shares,
      residualCashEur: baseline.cashEur,
      feesEur: baseline.feesEur,
      cashInterestTaxEur: baseline.cashInterestTaxEur
    },
    v11: {
      finalValueEur: v11Final,
      maxDrawdownPct: v11MaxDrawdownPct,
      shares: v11Account.shares,
      residualCashEur: v11Account.cashEur,
      feesEur: v11Account.feesEur,
      cashInterestTaxEur: v11Account.cashInterestTaxEur
    },
    delta: {
      finalValueEur: finalDeltaEur,
      finalDeltaPctOfContributions,
      drawdownReductionPctPoints,
      baselineWealthEfficiency,
      v11WealthEfficiency,
      wealthEfficiencyRatio
    },
    decisionAudit,
    individualPass
  };
}

async function main() {
  const fingerprint = assertForwardRiskV11HistoricalHoldoutUnlocked();
  if (fingerprint !== FORWARD_RISK_V11_POLICY_FINGERPRINT) throw new Error('V11_POLICY_FINGERPRINT_MISMATCH');
  if (fs.existsSync(RESULT_PATH)) throw new Error(`V11_BLIND_ALREADY_COMPLETED:${RESULT_PATH}`);
  const expected = FORWARD_RISK_V11_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
  if (JSON.stringify(expected) !== JSON.stringify(BLIND_CATALOG.map(asset => asset.ticker))) throw new Error('V11_BLIND_CATALOG_MISMATCH');

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) throw new Error('Local server did not become healthy on port 3000');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    // Frozen Forward Risk signal is prepared without any V11 blind asset.
    const signalScan = await AssetUniverseScanner.scan(SIGNAL_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 3, maxSelected: 20, minimumBars: 252, maxDataAgeDays: 7 });
    const core = signalScan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V11_BLIND_REQUIRES_EUNL_SIGNAL_ANCHOR');
    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    if (!macro.pointInTimeVintageSafe) throw new Error('V11_BLIND_REQUIRES_VINTAGE_SAFE_MACRO');
    const v5Result = runForwardRiskVulnerabilityV5({ dataset: signalScan.acceptedDataset, diagnosticDataset: diagnostic.dataset, macroData: macro, startDate: START_DATE, endDate: FINAL_END_DATE });
    const v7Result = runForwardRiskOptionsV7({ coreBars: core.bars, optionsData: options, startDate: START_DATE, endDate: FINAL_END_DATE });
    if (v5Result.status !== 'VALID' || v7Result.status !== 'VALID') throw new Error('V11_BLIND_REQUIRES_VALID_FROZEN_V5_V7');
    const v5: V5Point[] = v5Result.points.map(point => ({ informationDate: point.informationDate, vulnerabilityScorePct: point.vulnerabilityScorePct }));
    const v7: V7Point[] = v7Result.points.map(point => ({ informationDate: point.informationDate, signalScorePct: point.signalScorePct }));

    // First and only historical V11 opening of the preregistered blind catalogue.
    const blindScan = await AssetUniverseScanner.scan(BLIND_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 2, maxSelected: BLIND_CATALOG.length, minimumBars: 252, maxDataAgeDays: 7 });
    const nonReal = blindScan.acceptedDataset.assets.filter(asset => asset.provenance.sourceType !== 'REAL');
    if (nonReal.length) throw new Error(`V11_BLIND_NON_REAL:${nonReal.map(asset => asset.ticker).join(',')}`);

    const cases = BLIND_CATALOG.map(asset => {
      const series = blindScan.acceptedDataset.assets.find(row => row.assetId === asset.assetId);
      return series ? evaluateAsset(asset, series, v5, v7) : { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA' as const, reason: 'ASSET_NOT_ACCEPTED' };
    });
    const valid = cases.filter((row): row is ValidCase => row.status === 'VALID');
    const individualPasses = valid.filter(row => row.individualPass).length;
    const medianFinalDeltaEur = median(valid.map(row => row.delta.finalValueEur));
    const medianFinalDeltaPctOfContributions = median(valid.map(row => row.delta.finalDeltaPctOfContributions));
    const medianDrawdownReductionPctPoints = median(valid.map(row => row.delta.drawdownReductionPctPoints));
    const medianWealthEfficiencyRatio = median(valid.map(row => row.delta.wealthEfficiencyRatio));
    const enoughData = valid.length === FORWARD_RISK_V11_VALIDATION_GATE.validBlindAssetsRequired;
    const aggregatePass = enoughData
      && individualPasses >= FORWARD_RISK_V11_VALIDATION_GATE.minimumIndividualPasses
      && (medianFinalDeltaPctOfContributions ?? -Infinity) >= FORWARD_RISK_V11_VALIDATION_GATE.minimumMedianFinalDeltaPctOfContributions
      && (medianDrawdownReductionPctPoints ?? -Infinity) >= FORWARD_RISK_V11_VALIDATION_GATE.minimumMedianDrawdownReductionPctPoints
      && (medianWealthEfficiencyRatio ?? -Infinity) >= FORWARD_RISK_V11_VALIDATION_GATE.minimumMedianWealthEfficiencyRatio;
    const verdict = !enoughData
      ? 'V11_BLIND_INCONCLUSIVE_NO_REPLACEMENT_ALLOWED'
      : aggregatePass
        ? 'V11_BLIND_PASS_READY_FOR_FUTURE_FORWARD_CONFIRMATION'
        : 'V11_BLIND_FAIL_RETIRE_V11_POLICY_1';

    const result = {
      methodology: 'ONE_SHOT_PRE_REGISTERED_V11_POLICY_1_CONTINUOUS_NEW_MONEY_SIZING_BLIND_VALIDATION',
      protocolVersion: FORWARD_RISK_V11_VALIDATION_PROTOCOL.protocolVersion,
      policyVersion: FORWARD_RISK_V11_POLICY.policyVersion,
      policyFingerprint: fingerprint,
      evaluatedThrough: FINAL_END_DATE,
      causality: {
        risk: 'latest V5 vulnerability and V7 options informationDate <= monthly decision date; combined score=max(V5,V7)',
        opportunity: 'PortfolioCandidateGate.apply reconstructed from each blind asset price prefix only',
        execution: 'NEXT_OPEN',
        holdings: 'NO_SELL_NO_REDUCE',
        withheldCash: 'remunerated cash with no V11-specific daily release trigger'
      },
      frozenPolicy: FORWARD_RISK_V11_POLICY,
      frozenDataQualityGate: FORWARD_RISK_V11_DATA_QUALITY_GATE,
      frozenValidationGate: FORWARD_RISK_V11_VALIDATION_GATE,
      aggregate: {
        validBlindAssets: valid.length,
        individualPasses,
        medianFinalDeltaEur,
        medianFinalDeltaPctOfContributions,
        medianDrawdownReductionPctPoints,
        medianWealthEfficiencyRatio,
        pass: aggregatePass
      },
      cases,
      verdict,
      notes: [
        'V11 cannot make a PortfolioCandidateGate REJECTED asset eligible.',
        'Existing holdings are never sold or reduced.',
        'The risk score changes deployment continuously from 100% at score <=80 to 50% at score 100.',
        'Flow-adjusted unit NAV is used for max drawdown so equal external monthly contributions do not create artificial drawdown differences.',
        'Any invalid blind asset makes the aggregate INCONCLUSIVE when fewer than six remain; replacements are forbidden.',
        'This result consumes the six historical V11 blind assets regardless of PASS, FAIL or INCONCLUSIVE.'
      ]
    };
    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log('\nFORWARD_RISK_V11_BLIND_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V11_BLIND_FATAL', error);
  process.exit(1);
});
