import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PriceBar } from '../src/investment/backtesting/types';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, type AssetUniverseItem } from '../src/investment/decision/assetUniverse';
import { brokerCommission } from '../src/investment/decision/costAwareExecutionPolicy';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { loadForwardRiskMacroDataV5VintageSafe } from '../src/investment/decision/forwardRiskMacroDataV5VintageSafe';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { accrueRemuneratedCashScenarioAfterTax } from '../src/investment/decision/remuneratedCash';
import { estimateSpanishTaxOnCashInterest, estimateSpanishTaxOnRealizedGain, type SpanishTaxSettings } from '../src/investment/decision/spanishTaxModel';
import { assertForwardRiskV9HistoricalHoldoutUnlocked, FORWARD_RISK_V9_VALIDATION_PROTOCOL } from '../src/investment/decision/forwardRiskV9ValidationProtocol';
import {
  FORWARD_RISK_V9_ECONOMIC_GATE,
  FORWARD_RISK_V9_POLICY,
  FORWARD_RISK_V9_PREDICTIVE_GATE,
  runForwardRiskV9StateMachine,
  type ForwardRiskV9StatePoint
} from '../src/investment/decision/forwardRiskV9StateMachine';

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const V5_SIGNAL_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;
const TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };
const RESULT_PATH = path.resolve(process.cwd(), 'validation-runs/forward-risk-v9-blind-result.json');

const ANCHOR_IDS = new Set(['EUNL', 'VAGF', 'EUNA', 'IBCI', 'EUN6', 'DBX0AN', 'XEON', '4GLD', 'SGLD', 'AIGC', 'WCOA']);
const SIGNAL_CATALOG = EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId));

const BLIND_CATALOG: AssetUniverseItem[] = [
  { assetId: 'V9_BLIND_SPPW', ticker: 'SPPW.DE', name: 'State Street SPDR MSCI World UCITS ETF (Acc)', category: 'GLOBAL_EQUITY', currency: 'EUR' },
  { assetId: 'V9_BLIND_SPY5', ticker: 'SPY5.DE', name: 'State Street SPDR S&P 500 UCITS ETF (Dist)', category: 'US_EQUITY', currency: 'EUR' },
  { assetId: 'V9_BLIND_SPYM', ticker: 'SPYM.DE', name: 'State Street SPDR MSCI Emerging Markets UCITS ETF', category: 'EMERGING_EQUITY', currency: 'EUR' },
  { assetId: 'V9_BLIND_ZPRS', ticker: 'ZPRS.DE', name: 'State Street SPDR MSCI World Small Cap UCITS ETF (Acc)', category: 'SMALL_CAP', currency: 'EUR' },
  { assetId: 'V9_BLIND_VGEU', ticker: 'VGEU.DE', name: 'Vanguard FTSE Developed Europe UCITS ETF', category: 'EUROPE_EQUITY', currency: 'EUR' },
  { assetId: 'V9_BLIND_ZPDJ', ticker: 'ZPDJ.DE', name: 'State Street SPDR MSCI Japan UCITS ETF', category: 'JAPAN_EQUITY', currency: 'EUR' }
];

type Lot = { shares: number; costEur: number; acquisitionDate: string };
type EquityPoint = { date: string; equityEur: number };
type Cycle = { entryInformationDate: string; reductionExecutionDate: string; recoveryInformationDate: string | null; buybackExecutionDate: string | null; deltaAtStartEur: number; deltaAtEndEur: number; marginalDeltaEur: number };

type PredictiveValid = {
  assetId: string;
  ticker: string;
  status: 'VALID';
  sessions: number;
  auditableEpisodes: number;
  anticipatedEpisodes: number;
  anticipationRatePct: number | null;
  medianLeadSessionsBeforePeak: number | null;
  falseProtectedTimePct: number | null;
  episodeAudits: Array<{ peakDate: string; breachDate: string; firstProtectionDate: string | null; leadSessionsBeforePeak: number | null }>;
};

type EconomicValid = {
  assetId: string;
  ticker: string;
  status: 'VALID';
  baseline: { finalValueEur: number; maxDrawdownPct: number };
  protected: { finalValueEur: number; maxDrawdownPct: number; reductions: number; reentries: number; totalFeesEur: number; capitalGainsTaxEur: number; turnoverEur: number; protectedTimePct: number };
  delta: { finalValueEur: number; drawdownReductionPctPoints: number; netBreachProtectionEur: number; moneySavedAtBreachesEur: number; moneyLostAtBreachesEur: number; netCycleBenefitEur: number };
  economicPass: boolean;
};

function isoDate(value: string): string { return value.slice(0, 10); }
function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}
function maxDrawdown(path: EquityPoint[]): number {
  let peak = 0;
  let maximum = 0;
  for (const point of path) {
    peak = Math.max(peak, point.equityEur);
    if (peak > 0) maximum = Math.max(maximum, (peak - point.equityEur) / peak * 100);
  }
  return maximum;
}
function detectEpisodes(closes: number[]): Array<{ peakIndex: number; breachIndex: number }> {
  const out: Array<{ peakIndex: number; breachIndex: number }> = [];
  if (!closes.length) return out;
  let peak = closes[0];
  let peakIndex = 0;
  let inEpisode = false;
  for (let i = 1; i < closes.length; i++) {
    const value = closes[i];
    if (!inEpisode) {
      if (value >= peak) { peak = value; peakIndex = i; continue; }
      if ((value / peak - 1) * 100 <= -FORWARD_RISK_V9_PREDICTIVE_GATE.eventThresholdPct) {
        out.push({ peakIndex, breachIndex: i });
        inEpisode = true;
      }
    } else if (value >= peak) {
      peak = value;
      peakIndex = i;
      inEpisode = false;
    }
  }
  return out;
}
function consumeLots(lots: Lot[], sharesToSell: number): number {
  let remaining = sharesToSell;
  let basis = 0;
  const next: Lot[] = [];
  for (const lot of lots) {
    if (remaining <= 1e-12) { next.push(lot); continue; }
    const used = Math.min(remaining, lot.shares);
    basis += lot.costEur * used / lot.shares;
    const left = lot.shares - used;
    if (left > 1e-12) next.push({ ...lot, shares: left, costEur: lot.costEur * left / lot.shares });
    remaining -= used;
  }
  lots.splice(0, lots.length, ...next);
  return basis;
}
function maximumWholeSharesAffordable(cashEur: number, priceEur: number): number {
  let shares = Math.floor(cashEur / priceEur);
  while (shares > 0) {
    const notional = shares * priceEur;
    if (notional + brokerCommission(notional) <= cashEur + 1e-9) return shares;
    shares--;
  }
  return 0;
}
function accrueCash(cashEur: number, fromDate: string, toDate: string) {
  return accrueRemuneratedCashScenarioAfterTax({
    cashEur,
    mode: 'HISTORICAL_ECB_DFR_FLOOR_0',
    fixedAnnualPct: 0,
    fromDate,
    toDate,
    taxOnInterest: grossInterestEur => estimateSpanishTaxOnCashInterest(grossInterestEur, TAX_SETTINGS).estimatedTaxEur
  });
}
function latestV9State(points: ForwardRiskV9StatePoint[], date: string, strict: boolean): ForwardRiskV9StatePoint | null {
  let latest: ForwardRiskV9StatePoint | null = null;
  for (const point of points) {
    if (strict ? point.informationDate >= date : point.informationDate > date) break;
    latest = point;
  }
  return latest;
}
function firstProtectionInWindow(points: ForwardRiskV9StatePoint[], fromDate: string, toDate: string): string | null {
  return points.find(point => point.action === 'SELL_25_PCT_NEXT_OPEN' && point.informationDate >= fromDate && point.informationDate <= toDate)?.informationDate ?? null;
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

function evaluatePredictive(assetId: string, ticker: string, barsInput: PriceBar[], v9: ForwardRiskV9StatePoint[]): PredictiveValid | { assetId: string; ticker: string; status: 'INSUFFICIENT_DATA'; reason: string } {
  const bars = [...barsInput].filter(bar => bar.open > 0 && bar.close > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp))).filter(bar => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
  if (bars.length < 756) return { assetId, ticker, status: 'INSUFFICIENT_DATA', reason: `ONLY_${bars.length}_BARS` };
  const dates = bars.map(bar => isoDate(bar.timestamp));
  const episodes = detectEpisodes(bars.map(bar => bar.close));
  const prePeakSessionDates = new Set<string>();
  const episodeAudits: PredictiveValid['episodeAudits'] = [];
  const leads: number[] = [];
  let anticipated = 0;

  for (const episode of episodes) {
    const startIndex = Math.max(0, episode.peakIndex - FORWARD_RISK_V9_PREDICTIVE_GATE.prePeakLookbackSessions);
    for (let i = startIndex; i <= episode.peakIndex; i++) prePeakSessionDates.add(dates[i]);
    const firstProtectionDate = firstProtectionInWindow(v9, dates[startIndex], dates[episode.peakIndex]);
    let lead: number | null = null;
    if (firstProtectionDate) {
      const sessionIndex = dates.findIndex(date => date >= firstProtectionDate);
      if (sessionIndex >= startIndex && sessionIndex <= episode.peakIndex) {
        lead = episode.peakIndex - sessionIndex;
        anticipated++;
        leads.push(lead);
      }
    }
    episodeAudits.push({ peakDate: dates[episode.peakIndex], breachDate: dates[episode.breachIndex], firstProtectionDate, leadSessionsBeforePeak: lead });
  }

  let protectedSessions = 0;
  let falseProtectedSessions = 0;
  for (const date of dates) {
    const state = latestV9State(v9, date, false);
    if (!state?.protectedCapital) continue;
    protectedSessions++;
    if (!prePeakSessionDates.has(date)) falseProtectedSessions++;
  }

  return {
    assetId,
    ticker,
    status: 'VALID',
    sessions: dates.length,
    auditableEpisodes: episodeAudits.length,
    anticipatedEpisodes: anticipated,
    anticipationRatePct: episodeAudits.length ? anticipated / episodeAudits.length * 100 : null,
    medianLeadSessionsBeforePeak: median(leads),
    falseProtectedTimePct: dates.length ? falseProtectedSessions / dates.length * 100 : null,
    episodeAudits
  };
}

function evaluateEconomic(assetId: string, ticker: string, barsInput: PriceBar[], v9: ForwardRiskV9StatePoint[]): EconomicValid | { assetId: string; ticker: string; status: 'INSUFFICIENT_DATA'; reason: string } {
  const bars = [...barsInput].filter(bar => bar.open > 0 && bar.close > 0).sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp))).filter(bar => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
  if (bars.length < 756) return { assetId, ticker, status: 'INSUFFICIENT_DATA', reason: `ONLY_${bars.length}_BARS` };

  const first = bars[0];
  const firstDate = isoDate(first.timestamp);
  const initialShares = maximumWholeSharesAffordable(FORWARD_RISK_V9_ECONOMIC_GATE.initialCapitalEur, first.open);
  if (initialShares < 1) return { assetId, ticker, status: 'INSUFFICIENT_DATA', reason: 'INITIAL_CAPITAL_CANNOT_BUY_ONE_SHARE' };
  const initialNotional = initialShares * first.open;
  const initialFee = brokerCommission(initialNotional);

  const baselineShares = initialShares;
  let baselineCash = FORWARD_RISK_V9_ECONOMIC_GATE.initialCapitalEur - initialNotional - initialFee;
  let protectedShares = initialShares;
  let protectedCash = baselineCash;
  const lots: Lot[] = [{ shares: initialShares, costEur: initialNotional + initialFee, acquisitionDate: firstDate }];
  const baselinePath: EquityPoint[] = [{ date: firstDate, equityEur: baselineCash + baselineShares * first.close }];
  const protectedPath: EquityPoint[] = [{ date: firstDate, equityEur: protectedCash + protectedShares * first.close }];
  const cycles: Cycle[] = [];
  let activeCycle: { entryInformationDate: string; reductionExecutionDate: string; deltaAtStartEur: number } | null = null;
  let appliedProtection = false;
  let reductions = 0;
  let reentries = 0;
  let totalFeesEur = initialFee;
  let totalCapitalGainsTaxEur = 0;
  let turnoverEur = initialNotional;
  let protectedSessions = 0;
  let previousDate = firstDate;

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const date = isoDate(bar.timestamp);
    baselineCash = accrueCash(baselineCash, previousDate, date).cashEur;
    protectedCash = accrueCash(protectedCash, previousDate, date).cashEur;

    const desiredPoint = latestV9State(v9, date, true);
    const desiredProtection = desiredPoint?.protectedCapital ?? false;
    if (desiredProtection !== appliedProtection && desiredPoint) {
      if (desiredProtection) {
        const beforeBaseline = baselineCash + baselineShares * bar.open;
        const beforeProtected = protectedCash + protectedShares * bar.open;
        const sharesToSell = Math.floor(protectedShares * FORWARD_RISK_V9_ECONOMIC_GATE.protectionReductionPct / 100);
        if (sharesToSell >= 1) {
          const notional = sharesToSell * bar.open;
          const fee = brokerCommission(notional);
          const basis = consumeLots(lots, sharesToSell);
          const realizedGain = notional - fee - basis;
          const tax = estimateSpanishTaxOnRealizedGain(realizedGain, TAX_SETTINGS, false).estimatedTaxEur;
          protectedShares -= sharesToSell;
          protectedCash += notional - fee - tax;
          totalFeesEur += fee;
          totalCapitalGainsTaxEur += tax;
          turnoverEur += notional;
          reductions++;
          activeCycle = { entryInformationDate: desiredPoint.informationDate, reductionExecutionDate: date, deltaAtStartEur: beforeProtected - beforeBaseline };
          appliedProtection = true;
        }
      } else {
        const sharesToBuy = maximumWholeSharesAffordable(protectedCash, bar.open);
        if (sharesToBuy >= 1) {
          const notional = sharesToBuy * bar.open;
          const fee = brokerCommission(notional);
          protectedCash -= notional + fee;
          protectedShares += sharesToBuy;
          lots.push({ shares: sharesToBuy, costEur: notional + fee, acquisitionDate: date });
          totalFeesEur += fee;
          turnoverEur += notional;
          reentries++;
        }
        if (activeCycle) {
          const afterBaseline = baselineCash + baselineShares * bar.open;
          const afterProtected = protectedCash + protectedShares * bar.open;
          const deltaAtEndEur = afterProtected - afterBaseline;
          cycles.push({ ...activeCycle, recoveryInformationDate: desiredPoint.informationDate, buybackExecutionDate: date, deltaAtEndEur, marginalDeltaEur: deltaAtEndEur - activeCycle.deltaAtStartEur });
          activeCycle = null;
        }
        appliedProtection = false;
      }
    }

    if (appliedProtection) protectedSessions++;
    baselinePath.push({ date, equityEur: baselineCash + baselineShares * bar.close });
    protectedPath.push({ date, equityEur: protectedCash + protectedShares * bar.close });
    previousDate = date;
  }

  if (activeCycle) {
    const deltaAtEndEur = protectedPath.at(-1)!.equityEur - baselinePath.at(-1)!.equityEur;
    cycles.push({ ...activeCycle, recoveryInformationDate: null, buybackExecutionDate: null, deltaAtEndEur, marginalDeltaEur: deltaAtEndEur - activeCycle.deltaAtStartEur });
  }

  const baselineFinalValueEur = baselinePath.at(-1)!.equityEur;
  const protectedFinalValueEur = protectedPath.at(-1)!.equityEur;
  const baselineMaxDrawdownPct = maxDrawdown(baselinePath);
  const protectedMaxDrawdownPct = maxDrawdown(protectedPath);
  const drawdownReductionPctPoints = baselineMaxDrawdownPct - protectedMaxDrawdownPct;
  const protectedByDate = new Map(protectedPath.map(point => [point.date, point.equityEur] as const));
  const baselineByDate = new Map(baselinePath.map(point => [point.date, point.equityEur] as const));
  const dates = bars.map(bar => isoDate(bar.timestamp));
  const breaches = detectEpisodes(bars.map(bar => bar.close)).map(episode => {
    const breachDate = dates[episode.breachIndex];
    return (protectedByDate.get(breachDate) ?? 0) - (baselineByDate.get(breachDate) ?? 0);
  });
  const moneySavedAtBreachesEur = breaches.reduce((sum, delta) => sum + Math.max(0, delta), 0);
  const moneyLostAtBreachesEur = breaches.reduce((sum, delta) => sum + Math.max(0, -delta), 0);
  const netBreachProtectionEur = moneySavedAtBreachesEur - moneyLostAtBreachesEur;
  const netCycleBenefitEur = cycles.reduce((sum, cycle) => sum + cycle.marginalDeltaEur, 0);
  const finalDeltaEur = protectedFinalValueEur - baselineFinalValueEur;
  const economicPass = finalDeltaEur >= 0
    && drawdownReductionPctPoints >= FORWARD_RISK_V9_ECONOMIC_GATE.minimumDrawdownReductionPctPoints
    && netBreachProtectionEur > 0;

  return {
    assetId,
    ticker,
    status: 'VALID',
    baseline: { finalValueEur: baselineFinalValueEur, maxDrawdownPct: baselineMaxDrawdownPct },
    protected: {
      finalValueEur: protectedFinalValueEur,
      maxDrawdownPct: protectedMaxDrawdownPct,
      reductions,
      reentries,
      totalFeesEur,
      capitalGainsTaxEur: totalCapitalGainsTaxEur,
      turnoverEur,
      protectedTimePct: protectedSessions / bars.length * 100
    },
    delta: { finalValueEur: finalDeltaEur, drawdownReductionPctPoints, netBreachProtectionEur, moneySavedAtBreachesEur, moneyLostAtBreachesEur, netCycleBenefitEur },
    economicPass
  };
}

async function main() {
  const fingerprint = assertForwardRiskV9HistoricalHoldoutUnlocked();
  if (fs.existsSync(RESULT_PATH)) throw new Error(`V9_BLIND_ALREADY_COMPLETED:${RESULT_PATH}`);

  const expectedTickers = FORWARD_RISK_V9_VALIDATION_PROTOCOL.historicalBlindHoldout.assets.map(asset => asset.ticker);
  if (JSON.stringify(expectedTickers) !== JSON.stringify(BLIND_CATALOG.map(asset => asset.ticker))) throw new Error('V9_BLIND_CATALOG_MISMATCH');
  if (FORWARD_RISK_V9_POLICY.policyVersion !== 'V9_POLICY_1') throw new Error('V9_POLICY_VERSION_CHANGED');

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

    // Signal generation stays isolated from the blind assets.
    const signalScan = await AssetUniverseScanner.scan(SIGNAL_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 3, maxSelected: 20, minimumBars: 252, maxDataAgeDays: 7 });
    const core = signalScan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V9_BLIND_REQUIRES_EUNL_SIGNAL_ANCHOR');
    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    if (!macro.pointInTimeVintageSafe) throw new Error('V9_BLIND_REQUIRES_VINTAGE_SAFE_MACRO');
    const v5 = runForwardRiskVulnerabilityV5({ dataset: signalScan.acceptedDataset, diagnosticDataset: diagnostic.dataset, macroData: macro, startDate: START_DATE, endDate: FINAL_END_DATE });
    const v7 = runForwardRiskOptionsV7({ coreBars: core.bars, optionsData: options, startDate: START_DATE, endDate: FINAL_END_DATE });
    if (v5.status !== 'VALID' || v7.status !== 'VALID') throw new Error('V9_BLIND_REQUIRES_VALID_FROZEN_V5_V7');

    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point] as const));
    const v8Signal = v5.points
      .filter(point => point.informationDate >= START_DATE && point.informationDate <= FINAL_END_DATE)
      .map(point => ({ informationDate: point.informationDate, active: point.vulnerabilityScorePct >= V5_SIGNAL_SCORE_PCT || (v7ByDate.get(point.informationDate)?.signalScorePct ?? -Infinity) >= V7_SIGNAL_SCORE_PCT }));
    const v9 = runForwardRiskV9StateMachine(v8Signal);

    // This is the first V9 historical opening of the pre-registered blind catalogue.
    const blindScan = await AssetUniverseScanner.scan(BLIND_CATALOG, DATA_FROM, FINAL_END_DATE, { forceRefresh: false, concurrency: 2, maxSelected: BLIND_CATALOG.length, minimumBars: 252, maxDataAgeDays: 7 });
    const blindNonReal = blindScan.acceptedDataset.assets.filter(asset => asset.provenance.sourceType !== 'REAL');
    if (blindNonReal.length) throw new Error(`V9_BLIND_NON_REAL:${blindNonReal.map(asset => asset.ticker).join(',')}`);

    const predictiveCases = BLIND_CATALOG.map(item => {
      const asset = blindScan.acceptedDataset.assets.find(row => row.assetId === item.assetId);
      return asset ? evaluatePredictive(item.assetId, item.ticker, asset.bars, v9) : { assetId: item.assetId, ticker: item.ticker, status: 'INSUFFICIENT_DATA' as const, reason: 'ASSET_NOT_ACCEPTED' };
    });
    const economicCases = BLIND_CATALOG.map(item => {
      const asset = blindScan.acceptedDataset.assets.find(row => row.assetId === item.assetId);
      return asset ? evaluateEconomic(item.assetId, item.ticker, asset.bars, v9) : { assetId: item.assetId, ticker: item.ticker, status: 'INSUFFICIENT_DATA' as const, reason: 'ASSET_NOT_ACCEPTED' };
    });

    const predictiveValid = predictiveCases.filter((row): row is PredictiveValid => row.status === 'VALID');
    const economicValid = economicCases.filter((row): row is EconomicValid => row.status === 'VALID');
    const totalEpisodes = predictiveValid.reduce((sum, row) => sum + row.auditableEpisodes, 0);
    const totalAnticipated = predictiveValid.reduce((sum, row) => sum + row.anticipatedEpisodes, 0);
    const anticipationRatePct = totalEpisodes ? totalAnticipated / totalEpisodes * 100 : null;
    const allLeads = predictiveValid.flatMap(row => row.episodeAudits.flatMap(ep => ep.leadSessionsBeforePeak == null ? [] : [ep.leadSessionsBeforePeak]));
    const medianLeadSessionsBeforePeak = median(allLeads);
    const totalSessions = predictiveValid.reduce((sum, row) => sum + row.sessions, 0);
    const falseProtectedSessionEstimate = predictiveValid.reduce((sum, row) => sum + (row.falseProtectedTimePct ?? 0) / 100 * row.sessions, 0);
    const falseProtectedTimePct = totalSessions ? falseProtectedSessionEstimate / totalSessions * 100 : null;
    const predictivePass = predictiveValid.length === FORWARD_RISK_V9_PREDICTIVE_GATE.validBlindAssetsRequired
      && (anticipationRatePct ?? 0) >= FORWARD_RISK_V9_PREDICTIVE_GATE.minimumAnticipationRatePct
      && (medianLeadSessionsBeforePeak ?? 0) >= FORWARD_RISK_V9_PREDICTIVE_GATE.minimumMedianLeadSessionsBeforePeak
      && (falseProtectedTimePct ?? 100) <= FORWARD_RISK_V9_PREDICTIVE_GATE.maximumFalseProtectedTimePct;

    const economicPasses = economicValid.filter(row => row.economicPass).length;
    const medianFinalDeltaEur = median(economicValid.map(row => row.delta.finalValueEur));
    const medianDrawdownReductionPctPoints = median(economicValid.map(row => row.delta.drawdownReductionPctPoints));
    const economicPass = economicValid.length === FORWARD_RISK_V9_ECONOMIC_GATE.validBlindAssetsRequired
      && economicPasses >= FORWARD_RISK_V9_ECONOMIC_GATE.minimumIndividualPasses
      && (medianFinalDeltaEur ?? -Infinity) >= 0
      && (medianDrawdownReductionPctPoints ?? -Infinity) >= FORWARD_RISK_V9_ECONOMIC_GATE.minimumMedianDrawdownReductionPctPoints;

    const enoughData = predictiveValid.length === 6 && economicValid.length === 6;
    const verdict = !enoughData
      ? 'V9_BLIND_INCONCLUSIVE_NO_REPLACEMENT_ALLOWED'
      : predictivePass && economicPass
        ? 'V9_BLIND_PASS_READY_FOR_FUTURE_FORWARD_CONFIRMATION'
        : 'V9_BLIND_FAIL_RETIRE_V9_POLICY_1';

    const result = {
      methodology: 'ONE_SHOT_PRE_REGISTERED_V9_POLICY_1_BLIND_VALIDATION',
      protocolVersion: FORWARD_RISK_V9_VALIDATION_PROTOCOL.protocolVersion,
      policyVersion: FORWARD_RISK_V9_POLICY.policyVersion,
      policyFingerprint: fingerprint,
      evaluatedThrough: FINAL_END_DATE,
      blindAssets: BLIND_CATALOG.map(asset => ({ assetId: asset.assetId, ticker: asset.ticker, category: asset.category })),
      signal: { definition: 'V5 vulnerability >=80 OR V7 options >=80', v5ThresholdPct: V5_SIGNAL_SCORE_PCT, v7ThresholdPct: V7_SIGNAL_SCORE_PCT, macroSource: macro.source, macroPointInTimeVintageSafe: macro.pointInTimeVintageSafe },
      stateMachine: FORWARD_RISK_V9_POLICY,
      predictiveGate: {
        frozen: FORWARD_RISK_V9_PREDICTIVE_GATE,
        validBlindAssets: predictiveValid.length,
        totalEpisodes,
        totalAnticipated,
        anticipationRatePct,
        medianLeadSessionsBeforePeak,
        falseProtectedTimePct,
        pass: predictivePass,
        cases: predictiveCases
      },
      economicGate: {
        frozen: FORWARD_RISK_V9_ECONOMIC_GATE,
        validBlindAssets: economicValid.length,
        individualPasses: economicPasses,
        medianFinalDeltaEur,
        medianDrawdownReductionPctPoints,
        pass: economicPass,
        cases: economicCases
      },
      verdict,
      decisionRule: {
        parameterGridUsed: false,
        thresholdsRetuned: false,
        policyRetuned: false,
        holdoutReplacementAllowed: false,
        productionPromotionAllowed: false,
        nextIfPass: 'Keep research-only and begin/continue future-forward confirmation from 2026-09-08.',
        nextIfFail: 'Retire V9_POLICY_1. Do not retune on these six assets; a successor requires a new sealed holdout.',
        nextIfInconclusive: 'Do not replace insufficient cases. Preserve result as inconclusive and use future-forward evidence only under the frozen policy.'
      }
    };

    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
    console.log('\nFORWARD_RISK_V9_BLIND_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => { console.error('FORWARD_RISK_V9_BLIND_FATAL', error); process.exit(1); });
