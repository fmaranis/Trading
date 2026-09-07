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
import {
  FORWARD_RISK_V10_DATA_QUALITY_GATE,
  FORWARD_RISK_V10_POLICY,
  FORWARD_RISK_V10_POLICY_FINGERPRINT,
  FORWARD_RISK_V10_VALIDATION_GATE,
  decideForwardRiskV10
} from '../src/investment/decision/forwardRiskV10Policy';
import { assertForwardRiskV10HistoricalHoldoutUnlocked, FORWARD_RISK_V10_VALIDATION_PROTOCOL } from '../src/investment/decision/forwardRiskV10ValidationProtocol';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { PortfolioCandidateGate } from '../src/investment/decision/portfolioCandidateGate';
import { accrueRemuneratedCashScenarioAfterTax } from '../src/investment/decision/remuneratedCash';
import { estimateSpanishTaxOnCashInterest, type SpanishTaxSettings } from '../src/investment/decision/spanishTaxModel';

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const V5_SIGNAL_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;
const TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };
const RESULT_PATH = path.resolve(process.cwd(), 'validation-runs/forward-risk-v10-blind-result.json');

const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const SIGNAL_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));
const BLIND_CATALOG: AssetUniverseItem[] = [
  { assetId: 'V10_BLIND_VGVF', ticker: 'VGVF.DE', isin: 'IE00BK5BQV03', name: 'Vanguard FTSE Developed World UCITS ETF Acc', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'V10_BLIND_VNRA', ticker: 'VNRA.DE', isin: 'IE00BK5BQW10', name: 'Vanguard FTSE North America UCITS ETF Acc', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'V10_BLIND_VFEM', ticker: 'VFEM.DE', isin: 'IE00B3VVMM84', name: 'Vanguard FTSE Emerging Markets UCITS ETF Dist', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'V10_BLIND_VERE', ticker: 'VERE.DE', isin: 'IE00BK5BQY34', name: 'Vanguard FTSE Developed Europe ex UK UCITS ETF Acc', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'V10_BLIND_VGEK', ticker: 'VGEK.DE', isin: 'IE00BK5BQZ41', name: 'Vanguard FTSE Developed Asia Pacific ex Japan UCITS ETF Acc', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'V10_BLIND_VJPN', ticker: 'VJPN.DE', isin: 'IE00B95PGT31', name: 'Vanguard FTSE Japan UCITS ETF Dist', category: 'JAPAN_EQUITY', currency: 'EUR' }
];

type V8Point = { informationDate: string; active: boolean };
type DeferredPathClass = 'DOWN_FIRST' | 'UP_FIRST' | 'NEITHER';
type DeferredLot = {
  id: number;
  originInfoIndex: number;
  originInformationDate: string;
  baselineExecIndex: number;
  baselineExecutionDate: string;
  baselineExecutionPrice: number;
  cashEur: number;
  status: 'ACTIVE' | 'PENDING_RELEASE' | 'RELEASED';
  releaseExecIndex: number | null;
  releaseExecutionDate: string | null;
  releaseExecutionPrice: number | null;
  forceReleased: boolean;
  pathClass: DeferredPathClass;
};

type ValidCase = {
  assetId: string;
  ticker: string;
  status: 'VALID';
  sessions: number;
  contributionEvents: number;
  deferredContributions: number;
  completedDeferredContributions: number;
  baseline: { finalValueEur: number; shares: number; residualCashEur: number; feesEur: number; cashInterestTaxEur: number };
  v10: { finalValueEur: number; shares: number; liquidCashEur: number; deferredCashEur: number; feesEur: number; cashInterestTaxEur: number };
  delta: { finalValueEur: number; medianDeferredExecutionPriceImprovementPct: number | null };
  pathEvidence: { downFirstCount: number; upFirstCount: number; neitherCount: number; deferred: Array<{ originInformationDate: string; baselineExecutionDate: string; releaseExecutionDate: string | null; baselineExecutionPrice: number; releaseExecutionPrice: number | null; executionPriceImprovementPct: number | null; forceReleased: boolean; pathClass: DeferredPathClass }> };
  individualPass: boolean;
};

type InvalidCase = { assetId: string; ticker: string; status: 'INVALID_DATA'; reason: string };

function isoDate(value: string): string { return value.slice(0, 10); }
function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}
function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const a = prices[prices.length - 1 - lookback];
  const b = prices.at(-1)!;
  return a > 0 ? (b / a - 1) * 100 : null;
}
function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(prices: number[], lookback = 252): number | null {
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
function scannerScore(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null): number {
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  return momentum - riskPenalty;
}
function maxWholeShares(cashEur: number, priceEur: number): number {
  let shares = Math.floor(cashEur / priceEur);
  while (shares > 0) {
    const notional = shares * priceEur;
    if (notional + brokerCommission(notional) <= cashEur + 1e-9) return shares;
    shares--;
  }
  return 0;
}
function buyWithAllAvailableCash(cashEur: number, shares: number, priceEur: number): { cashEur: number; shares: number; feeEur: number } {
  const toBuy = maxWholeShares(cashEur, priceEur);
  if (toBuy < 1) return { cashEur, shares, feeEur: 0 };
  const notional = toBuy * priceEur;
  const feeEur = brokerCommission(notional);
  return { cashEur: cashEur - notional - feeEur, shares: shares + toBuy, feeEur };
}
function accrueCash(cashEur: number, fromDate: string, toDate: string): { cashEur: number; taxEur: number } {
  const accrued = accrueRemuneratedCashScenarioAfterTax({
    cashEur,
    mode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    fixedAnnualPct: 0,
    fromDate,
    toDate,
    taxOnInterest: gross => estimateSpanishTaxOnCashInterest(gross, TAX_SETTINGS).estimatedTaxEur
  });
  return { cashEur: accrued.cashEur, taxEur: accrued.taxEur };
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
function latestRisk(points: V8Point[], date: string): boolean {
  let active = false;
  for (const point of points) {
    if (point.informationDate > date) break;
    active = point.active;
  }
  return active;
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
  const dd = maxDrawdown(prices, 252);
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

function classifyDeferredPath(bars: PriceBar[], baselineExecIndex: number, baselinePrice: number): DeferredPathClass {
  const end = Math.min(bars.length, baselineExecIndex + FORWARD_RISK_V10_VALIDATION_GATE.deferredPathHorizonSessions);
  for (let index = baselineExecIndex; index < end; index++) {
    const movePct = (bars[index].close / baselinePrice - 1) * 100;
    if (movePct <= FORWARD_RISK_V10_VALIDATION_GATE.downsideThresholdPct) return 'DOWN_FIRST';
    if (movePct >= FORWARD_RISK_V10_VALIDATION_GATE.upsideThresholdPct) return 'UP_FIRST';
  }
  return 'NEITHER';
}

function validateRawBars(assetId: string, ticker: string, bars: PriceBar[]): InvalidCase | null {
  if (bars.length < FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumBars) return { assetId, ticker, status: 'INVALID_DATA', reason: `ONLY_${bars.length}_BARS` };
  const seen = new Set<string>();
  for (let index = 0; index < bars.length; index++) {
    const date = isoDate(bars[index].timestamp);
    if (seen.has(date)) return { assetId, ticker, status: 'INVALID_DATA', reason: `DUPLICATE_DATE:${date}` };
    seen.add(date);
    if (!(bars[index].open > 0) || !(bars[index].close > 0)) return { assetId, ticker, status: 'INVALID_DATA', reason: `NON_POSITIVE_OPEN_CLOSE:${date}` };
    if (index > 0) {
      const move = Math.abs((bars[index].close / bars[index - 1].close - 1) * 100);
      if (move > FORWARD_RISK_V10_DATA_QUALITY_GATE.maxAbsoluteOneSessionCloseReturnPct) {
        return { assetId, ticker, status: 'INVALID_DATA', reason: `ONE_SESSION_CLOSE_RETURN_${move.toFixed(2)}PCT:${date}` };
      }
    }
  }
  return null;
}

function evaluateAsset(asset: AssetUniverseItem, series: any, v8: V8Point[]): ValidCase | InvalidCase {
  const allBars = [...series.bars].sort((a: PriceBar, b: PriceBar) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)));
  const economicBars = allBars.filter((bar: PriceBar) => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
  const invalid = validateRawBars(asset.assetId, asset.ticker, economicBars);
  if (invalid) return invalid;

  const contributionInfoIndexes: number[] = [];
  let previousMonth = '';
  for (let index = 0; index < economicBars.length - 1; index++) {
    const month = isoDate(economicBars[index].timestamp).slice(0, 7);
    if (month !== previousMonth) { contributionInfoIndexes.push(index); previousMonth = month; }
  }
  if (contributionInfoIndexes.length < FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumContributionEvents) {
    return { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA', reason: `ONLY_${contributionInfoIndexes.length}_CONTRIBUTIONS` };
  }
  const contributionSet = new Set(contributionInfoIndexes);
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

  let baselineCash = 0;
  let baselineShares = 0;
  let baselineFees = 0;
  let baselineCashTax = 0;
  let v10Cash = 0;
  let v10Shares = 0;
  let v10Fees = 0;
  let v10CashTax = 0;
  let pendingBaselineContributions = 0;
  let pendingImmediateV10Contributions = 0;
  const deferred: DeferredLot[] = [];
  let nextDeferredId = 1;
  let previousDate = isoDate(economicBars[0].timestamp);

  for (let index = 0; index < economicBars.length; index++) {
    const bar = economicBars[index];
    const date = isoDate(bar.timestamp);
    if (index > 0) {
      const baselineAccrued = accrueCash(baselineCash, previousDate, date);
      baselineCash = baselineAccrued.cashEur; baselineCashTax += baselineAccrued.taxEur;
      const v10Accrued = accrueCash(v10Cash, previousDate, date);
      v10Cash = v10Accrued.cashEur; v10CashTax += v10Accrued.taxEur;
      for (const lot of deferred.filter(row => row.status !== 'RELEASED')) {
        const accrued = accrueCash(lot.cashEur, previousDate, date);
        lot.cashEur = accrued.cashEur; v10CashTax += accrued.taxEur;
      }
    }

    if (pendingBaselineContributions > 0) {
      baselineCash += pendingBaselineContributions * FORWARD_RISK_V10_POLICY.economicSemantics.contributionEur;
      pendingBaselineContributions = 0;
      const bought = buyWithAllAvailableCash(baselineCash, baselineShares, bar.open);
      baselineCash = bought.cashEur; baselineShares = bought.shares; baselineFees += bought.feeEur;
    }

    const releaseLots = deferred.filter(row => row.status === 'PENDING_RELEASE' && row.releaseExecIndex === index);
    if (pendingImmediateV10Contributions > 0 || releaseLots.length > 0) {
      v10Cash += pendingImmediateV10Contributions * FORWARD_RISK_V10_POLICY.economicSemantics.contributionEur;
      pendingImmediateV10Contributions = 0;
      for (const lot of releaseLots) {
        v10Cash += lot.cashEur;
        lot.cashEur = 0;
        lot.status = 'RELEASED';
        lot.releaseExecutionDate = date;
        lot.releaseExecutionPrice = bar.open;
      }
      const bought = buyWithAllAvailableCash(v10Cash, v10Shares, bar.open);
      v10Cash = bought.cashEur; v10Shares = bought.shares; v10Fees += bought.feeEur;
    }

    // Re-evaluate previously deferred contributions using only information known at this close.
    for (const lot of deferred.filter(row => row.status === 'ACTIVE')) {
      if (index <= lot.originInfoIndex) continue;
      const riskActive = latestRisk(v8, date);
      const eligible = opportunityEligible(index);
      const age = index - lot.originInfoIndex;
      const decision = decideForwardRiskV10({ riskActive, opportunityEligible: eligible, hasDeferredCash: true, deferredAgeSessions: age });
      if (decision.action === 'RELEASE_100_PCT_NEXT_OPEN' && index + 1 < economicBars.length) {
        lot.status = 'PENDING_RELEASE';
        lot.releaseExecIndex = index + 1;
        lot.forceReleased = decision.forceRelease;
      }
    }

    if (contributionSet.has(index) && index + 1 < economicBars.length) {
      pendingBaselineContributions++;
      const riskActive = latestRisk(v8, date);
      const eligible = opportunityEligible(index);
      const decision = decideForwardRiskV10({ riskActive, opportunityEligible: eligible, hasDeferredCash: false, deferredAgeSessions: 0 });
      if (decision.action === 'INVEST_100_PCT_NEXT_OPEN') {
        pendingImmediateV10Contributions++;
      } else if (decision.action === 'DEFER_100_PCT_IN_REMUNERATED_CASH') {
        const baselineExecIndex = index + 1;
        const baselinePrice = economicBars[baselineExecIndex].open;
        deferred.push({
          id: nextDeferredId++, originInfoIndex: index, originInformationDate: date,
          baselineExecIndex, baselineExecutionDate: isoDate(economicBars[baselineExecIndex].timestamp), baselineExecutionPrice: baselinePrice,
          cashEur: FORWARD_RISK_V10_POLICY.economicSemantics.contributionEur,
          status: 'ACTIVE', releaseExecIndex: null, releaseExecutionDate: null, releaseExecutionPrice: null, forceReleased: false,
          pathClass: classifyDeferredPath(economicBars, baselineExecIndex, baselinePrice)
        });
      } else {
        throw new Error(`V10_UNEXPECTED_NEW_CONTRIBUTION_ACTION:${decision.action}`);
      }
    }
    previousDate = date;
  }

  const completedDeferred = deferred.filter(row => row.status === 'RELEASED' && row.releaseExecutionPrice != null);
  if (deferred.length < FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumDeferredContributionsPerAsset
    || completedDeferred.length < FORWARD_RISK_V10_DATA_QUALITY_GATE.minimumDeferredContributionsPerAsset) {
    return { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA', reason: `ONLY_${deferred.length}_DEFERRED_${completedDeferred.length}_COMPLETED` };
  }

  const lastClose = economicBars.at(-1)!.close;
  const unresolvedDeferredCash = deferred.filter(row => row.status !== 'RELEASED').reduce((sum, row) => sum + row.cashEur, 0);
  const baselineFinal = baselineCash + baselineShares * lastClose;
  const v10Final = v10Cash + unresolvedDeferredCash + v10Shares * lastClose;
  const improvements = completedDeferred.map(row => (row.baselineExecutionPrice - row.releaseExecutionPrice!) / row.baselineExecutionPrice * 100);
  const medianImprovement = median(improvements);
  const downFirstCount = deferred.filter(row => row.pathClass === 'DOWN_FIRST').length;
  const upFirstCount = deferred.filter(row => row.pathClass === 'UP_FIRST').length;
  const neitherCount = deferred.filter(row => row.pathClass === 'NEITHER').length;
  const finalDelta = v10Final - baselineFinal;
  const individualPass = finalDelta >= 0 && (medianImprovement ?? -Infinity) >= 0 && downFirstCount >= upFirstCount;

  return {
    assetId: asset.assetId,
    ticker: asset.ticker,
    status: 'VALID',
    sessions: economicBars.length,
    contributionEvents: contributionInfoIndexes.length,
    deferredContributions: deferred.length,
    completedDeferredContributions: completedDeferred.length,
    baseline: { finalValueEur: baselineFinal, shares: baselineShares, residualCashEur: baselineCash, feesEur: baselineFees, cashInterestTaxEur: baselineCashTax },
    v10: { finalValueEur: v10Final, shares: v10Shares, liquidCashEur: v10Cash, deferredCashEur: unresolvedDeferredCash, feesEur: v10Fees, cashInterestTaxEur: v10CashTax },
    delta: { finalValueEur: finalDelta, medianDeferredExecutionPriceImprovementPct: medianImprovement },
    pathEvidence: {
      downFirstCount, upFirstCount, neitherCount,
      deferred: deferred.map(row => ({
        originInformationDate: row.originInformationDate,
        baselineExecutionDate: row.baselineExecutionDate,
        releaseExecutionDate: row.releaseExecutionDate,
        baselineExecutionPrice: row.baselineExecutionPrice,
        releaseExecutionPrice: row.releaseExecutionPrice,
        executionPriceImprovementPct: row.releaseExecutionPrice == null ? null : (row.baselineExecutionPrice - row.releaseExecutionPrice) / row.baselineExecutionPrice * 100,
        forceReleased: row.forceReleased,
        pathClass: row.pathClass
      }))
    },
    individualPass
  };
}

async function main() {
  const fingerprint = assertForwardRiskV10HistoricalHoldoutUnlocked();
  if (fingerprint !== FORWARD_RISK_V10_POLICY_FINGERPRINT) throw new Error('V10_POLICY_FINGERPRINT_MISMATCH');
  if (fs.existsSync(RESULT_PATH)) throw new Error(`V10_BLIND_ALREADY_COMPLETED:${RESULT_PATH}`);
  const expected = FORWARD_RISK_V10_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
  if (JSON.stringify(expected) !== JSON.stringify(BLIND_CATALOG.map(asset => asset.ticker))) throw new Error('V10_BLIND_CATALOG_MISMATCH');

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

    const signalScan = await AssetUniverseScanner.scan(SIGNAL_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 3, maxSelected: 20, minimumBars: 252, maxDataAgeDays: 7 });
    const core = signalScan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V10_BLIND_REQUIRES_EUNL_SIGNAL_ANCHOR');
    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    if (!macro.pointInTimeVintageSafe) throw new Error('V10_BLIND_REQUIRES_VINTAGE_SAFE_MACRO');
    const v5 = runForwardRiskVulnerabilityV5({ dataset: signalScan.acceptedDataset, diagnosticDataset: diagnostic.dataset, macroData: macro, startDate: START_DATE, endDate: FINAL_END_DATE });
    const v7 = runForwardRiskOptionsV7({ coreBars: core.bars, optionsData: options, startDate: START_DATE, endDate: FINAL_END_DATE });
    if (v5.status !== 'VALID' || v7.status !== 'VALID') throw new Error('V10_BLIND_REQUIRES_VALID_FROZEN_V5_V7');
    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point] as const));
    const v8: V8Point[] = v5.points
      .filter(point => point.informationDate >= START_DATE && point.informationDate <= FINAL_END_DATE)
      .map(point => ({ informationDate: point.informationDate, active: point.vulnerabilityScorePct >= V5_SIGNAL_SCORE_PCT || (v7ByDate.get(point.informationDate)?.signalScorePct ?? -Infinity) >= V7_SIGNAL_SCORE_PCT }));

    // First and only historical V10 opening of the preregistered blind catalogue.
    const blindScan = await AssetUniverseScanner.scan(BLIND_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 2, maxSelected: BLIND_CATALOG.length, minimumBars: 252, maxDataAgeDays: 7 });
    const nonReal = blindScan.acceptedDataset.assets.filter(asset => asset.provenance.sourceType !== 'REAL');
    if (nonReal.length) throw new Error(`V10_BLIND_NON_REAL:${nonReal.map(asset => asset.ticker).join(',')}`);

    const cases = BLIND_CATALOG.map(asset => {
      const series = blindScan.acceptedDataset.assets.find(row => row.assetId === asset.assetId);
      return series ? evaluateAsset(asset, series, v8) : { assetId: asset.assetId, ticker: asset.ticker, status: 'INVALID_DATA' as const, reason: 'ASSET_NOT_ACCEPTED' };
    });
    const valid = cases.filter((row): row is ValidCase => row.status === 'VALID');
    const individualPasses = valid.filter(row => row.individualPass).length;
    const medianFinalDeltaEur = median(valid.map(row => row.delta.finalValueEur));
    const medianDeferredExecutionPriceImprovementPct = median(valid.flatMap(row => row.delta.medianDeferredExecutionPriceImprovementPct == null ? [] : [row.delta.medianDeferredExecutionPriceImprovementPct]));
    const aggregateDownFirst = valid.reduce((sum, row) => sum + row.pathEvidence.downFirstCount, 0);
    const aggregateUpFirst = valid.reduce((sum, row) => sum + row.pathEvidence.upFirstCount, 0);
    const enoughData = valid.length === FORWARD_RISK_V10_VALIDATION_GATE.validBlindAssetsRequired;
    const aggregatePass = enoughData
      && individualPasses >= FORWARD_RISK_V10_VALIDATION_GATE.minimumIndividualPasses
      && (medianFinalDeltaEur ?? -Infinity) >= 0
      && (medianDeferredExecutionPriceImprovementPct ?? -Infinity) >= 0
      && aggregateDownFirst >= aggregateUpFirst;
    const verdict = !enoughData
      ? 'V10_BLIND_INCONCLUSIVE_NO_REPLACEMENT_ALLOWED'
      : aggregatePass
        ? 'V10_BLIND_PASS_READY_FOR_FUTURE_FORWARD_CONFIRMATION'
        : 'V10_BLIND_FAIL_RETIRE_V10_POLICY_1';

    const result = {
      methodology: 'ONE_SHOT_PRE_REGISTERED_V10_POLICY_1_NEW_MONEY_RISK_PLUS_OPPORTUNITY_BLIND_VALIDATION',
      protocolVersion: FORWARD_RISK_V10_VALIDATION_PROTOCOL.protocolVersion,
      policyVersion: FORWARD_RISK_V10_POLICY.policyVersion,
      policyFingerprint: fingerprint,
      evaluatedThrough: FINAL_END_DATE,
      causality: {
        risk: 'Frozen V8, latest informationDate <= decision date',
        opportunity: 'PortfolioCandidateGate.apply reconstructed from each asset price prefix only',
        execution: 'NEXT_OPEN',
        deferredPathClassification: 'Outcome audit only; never used to make the historical decision'
      },
      frozenPolicy: FORWARD_RISK_V10_POLICY,
      frozenDataQualityGate: FORWARD_RISK_V10_DATA_QUALITY_GATE,
      frozenValidationGate: FORWARD_RISK_V10_VALIDATION_GATE,
      aggregate: {
        validBlindAssets: valid.length,
        individualPasses,
        medianFinalDeltaEur,
        medianDeferredExecutionPriceImprovementPct,
        downFirstCount: aggregateDownFirst,
        upFirstCount: aggregateUpFirst,
        neitherCount: valid.reduce((sum, row) => sum + row.pathEvidence.neitherCount, 0),
        pass: aggregatePass
      },
      cases,
      verdict,
      notes: [
        'Existing holdings are never sold or reduced in V10_POLICY_1.',
        'The positive-opportunity counterweight is the existing PortfolioCandidateGate ELIGIBLE boolean; no V10-specific upside threshold is fitted.',
        'Any invalid blind asset makes the aggregate INCONCLUSIVE when fewer than six remain; replacements are forbidden.',
        'This result consumes the six historical V10 blind assets regardless of PASS, FAIL or INCONCLUSIVE.'
      ]
    };
    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log('\nFORWARD_RISK_V10_BLIND_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FORWARD_RISK_V10_BLIND_FATAL', error);
  process.exit(1);
});
