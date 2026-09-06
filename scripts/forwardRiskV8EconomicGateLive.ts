import { spawn } from 'node:child_process';
import type { PriceBar } from '../src/investment/backtesting/types';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { AssetUniverseScanner } from '../src/investment/decision/assetUniverseScanner';
import { EUR_ASSET_UNIVERSE, EUR_VALIDATION_HOLDOUT_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { brokerCommission } from '../src/investment/decision/costAwareExecutionPolicy';
import { loadForwardRiskDiagnosticData } from '../src/investment/decision/forwardRiskDiagnosticData';
import { loadForwardRiskMacroDataV5VintageSafe } from '../src/investment/decision/forwardRiskMacroDataV5VintageSafe';
import { runForwardRiskVulnerabilityV5 } from '../src/investment/decision/forwardRiskVulnerabilityV5';
import { loadForwardRiskOptionsDataV7 } from '../src/investment/decision/forwardRiskOptionsDataV7';
import { runForwardRiskOptionsV7 } from '../src/investment/decision/forwardRiskOptionsV7';
import { accrueRemuneratedCashScenarioAfterTax } from '../src/investment/decision/remuneratedCash';
import { estimateSpanishTaxOnCashInterest, estimateSpanishTaxOnRealizedGain, type SpanishTaxSettings } from '../src/investment/decision/spanishTaxModel';

const DATA_FROM = '2008-01-01';
const START_DATE = '2011-01-01';
const FINAL_END_DATE = '2026-09-01';
const INITIAL_CAPITAL_EUR = 13_000;
const PROTECTION_REDUCTION_PCT = 25;
const V5_SIGNAL_SCORE_PCT = 80;
const V7_SIGNAL_SCORE_PCT = 80;
const EVENT_THRESHOLD_PCT = 5;
const MIN_DRAWDOWN_REDUCTION_PCT_POINTS = 1;
const MIN_HOLDOUT_ECONOMIC_PASSES = 4;
const TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };
const BENCHMARK_IDS = ['HOLDOUT_XDEM','HOLDOUT_XDEV','HOLDOUT_XDEQ','HOLDOUT_XDEB','HOLDOUT_IS3R','HOLDOUT_IS3S'] as const;
const ANCHOR_IDS = new Set(['EUNL','VAGF','EUNA','IBCI','EUN6','DBX0AN','XEON','4GLD','SGLD','AIGC','WCOA']);
const RESEARCH_CATALOG = [
  ...EUR_ASSET_UNIVERSE.filter(asset => ANCHOR_IDS.has(asset.assetId)),
  ...EUR_VALIDATION_HOLDOUT_UNIVERSE.filter(asset => BENCHMARK_IDS.includes(asset.assetId as (typeof BENCHMARK_IDS)[number]))
];

type SignalStatePoint = { informationDate: string; active: boolean };
type Lot = { shares: number; costEur: number; acquisitionDate: string };
type EquityPoint = { date: string; equityEur: number };
type Trade = {
  signalDate: string;
  executionDate: string;
  side: 'SELL_25_PCT' | 'BUY_BACK';
  shares: number;
  executionPriceEur: number;
  notionalEur: number;
  feeEur: number;
  realizedGainEur: number;
  estimatedTaxEur: number;
};
type Cycle = {
  signalOnDate: string;
  reductionExecutionDate: string;
  signalOffDate: string | null;
  reentryExecutionDate: string | null;
  deltaAtStartEur: number;
  deltaAtEndEur: number;
  marginalDeltaEur: number;
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
      if ((value / peak - 1) * 100 <= -EVENT_THRESHOLD_PCT) { out.push({ peakIndex, breachIndex: i }); inEpisode = true; }
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
function activeSignalStrictlyBefore(points: SignalStatePoint[], executionDate: string): { active: boolean; informationDate: string | null } {
  let active = false;
  let informationDate: string | null = null;
  for (const point of points) {
    if (point.informationDate >= executionDate) break;
    active = point.active;
    informationDate = point.informationDate;
  }
  return { active, informationDate };
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
async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

function evaluateEconomicAsset(input: { assetId: string; ticker: string; name: string; bars: PriceBar[]; signalState: SignalStatePoint[] }) {
  const bars = [...input.bars]
    .filter(bar => bar.open > 0 && bar.close > 0)
    .sort((a, b) => isoDate(a.timestamp).localeCompare(isoDate(b.timestamp)))
    .filter(bar => isoDate(bar.timestamp) >= START_DATE && isoDate(bar.timestamp) <= FINAL_END_DATE);
  if (bars.length < 756) return { assetId: input.assetId, ticker: input.ticker, name: input.name, status: 'INSUFFICIENT_DATA' as const, reason: `ONLY_${bars.length}_BARS` };

  const first = bars[0];
  const firstDate = isoDate(first.timestamp);
  const initialShares = maximumWholeSharesAffordable(INITIAL_CAPITAL_EUR, first.open);
  if (initialShares < 1) return { assetId: input.assetId, ticker: input.ticker, name: input.name, status: 'INSUFFICIENT_DATA' as const, reason: 'INITIAL_CAPITAL_CANNOT_BUY_ONE_SHARE' };
  const initialNotional = initialShares * first.open;
  const initialFee = brokerCommission(initialNotional);

  let baselineShares = initialShares;
  let baselineCash = INITIAL_CAPITAL_EUR - initialNotional - initialFee;
  let protectedShares = initialShares;
  let protectedCash = baselineCash;
  const protectedLots: Lot[] = [{ shares: initialShares, costEur: initialNotional + initialFee, acquisitionDate: firstDate }];
  const baselinePath: EquityPoint[] = [];
  const protectedPath: EquityPoint[] = [];
  const trades: Trade[] = [];
  const cycles: Cycle[] = [];
  let activeCycle: { signalOnDate: string; reductionExecutionDate: string; deltaAtStartEur: number } | null = null;
  let appliedProtection = false;
  let protectedSessions = 0;
  let totalFeesEur = initialFee;
  let totalCapitalGainsTaxEur = 0;
  let baselineGrossCashInterestEur = 0;
  let baselineCashInterestTaxEur = 0;
  let protectedGrossCashInterestEur = 0;
  let protectedCashInterestTaxEur = 0;
  let turnoverEur = initialNotional;
  let reductions = 0;
  let reentries = 0;

  baselinePath.push({ date: firstDate, equityEur: baselineCash + baselineShares * first.close });
  protectedPath.push({ date: firstDate, equityEur: protectedCash + protectedShares * first.close });
  let previousDate = firstDate;

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const date = isoDate(bar.timestamp);
    const baseAccrued = accrueCash(baselineCash, previousDate, date);
    baselineCash = baseAccrued.cashEur;
    baselineGrossCashInterestEur += baseAccrued.grossInterestEur;
    baselineCashInterestTaxEur += baseAccrued.taxEur;
    const protectedAccrued = accrueCash(protectedCash, previousDate, date);
    protectedCash = protectedAccrued.cashEur;
    protectedGrossCashInterestEur += protectedAccrued.grossInterestEur;
    protectedCashInterestTaxEur += protectedAccrued.taxEur;

    // Strict NEXT_OPEN causality: only an information date strictly earlier than
    // this asset's execution date may change the protection state at this open.
    const desired = activeSignalStrictlyBefore(input.signalState, date);
    if (desired.active !== appliedProtection && desired.informationDate) {
      if (desired.active) {
        const beforeBaseline = baselineCash + baselineShares * bar.open;
        const beforeProtected = protectedCash + protectedShares * bar.open;
        const sharesToSell = Math.floor(protectedShares * PROTECTION_REDUCTION_PCT / 100);
        if (sharesToSell >= 1) {
          const notional = sharesToSell * bar.open;
          const fee = brokerCommission(notional);
          const basis = consumeLots(protectedLots, sharesToSell);
          const realizedGain = notional - fee - basis;
          const tax = estimateSpanishTaxOnRealizedGain(realizedGain, TAX_SETTINGS, false).estimatedTaxEur;
          protectedShares -= sharesToSell;
          protectedCash += notional - fee - tax;
          totalFeesEur += fee;
          totalCapitalGainsTaxEur += tax;
          turnoverEur += notional;
          reductions++;
          trades.push({ signalDate: desired.informationDate, executionDate: date, side: 'SELL_25_PCT', shares: sharesToSell, executionPriceEur: bar.open, notionalEur: notional, feeEur: fee, realizedGainEur: realizedGain, estimatedTaxEur: tax });
          activeCycle = { signalOnDate: desired.informationDate, reductionExecutionDate: date, deltaAtStartEur: beforeProtected - beforeBaseline };
          appliedProtection = true;
        }
      } else {
        const sharesToBuy = maximumWholeSharesAffordable(protectedCash, bar.open);
        if (sharesToBuy >= 1) {
          const notional = sharesToBuy * bar.open;
          const fee = brokerCommission(notional);
          protectedCash -= notional + fee;
          protectedShares += sharesToBuy;
          protectedLots.push({ shares: sharesToBuy, costEur: notional + fee, acquisitionDate: date });
          totalFeesEur += fee;
          turnoverEur += notional;
          reentries++;
          trades.push({ signalDate: desired.informationDate, executionDate: date, side: 'BUY_BACK', shares: sharesToBuy, executionPriceEur: bar.open, notionalEur: notional, feeEur: fee, realizedGainEur: 0, estimatedTaxEur: 0 });
        }
        if (activeCycle) {
          const afterBaseline = baselineCash + baselineShares * bar.open;
          const afterProtected = protectedCash + protectedShares * bar.open;
          const deltaAtEnd = afterProtected - afterBaseline;
          cycles.push({ ...activeCycle, signalOffDate: desired.informationDate, reentryExecutionDate: date, deltaAtEndEur: deltaAtEnd, marginalDeltaEur: deltaAtEnd - activeCycle.deltaAtStartEur });
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
    const baselineEnd = baselinePath.at(-1)!.equityEur;
    const protectedEnd = protectedPath.at(-1)!.equityEur;
    cycles.push({ ...activeCycle, signalOffDate: null, reentryExecutionDate: null, deltaAtEndEur: protectedEnd - baselineEnd, marginalDeltaEur: protectedEnd - baselineEnd - activeCycle.deltaAtStartEur });
  }

  const baselineFinalValueEur = baselinePath.at(-1)!.equityEur;
  const protectedFinalValueEur = protectedPath.at(-1)!.equityEur;
  const baselineMaxDrawdownPct = maxDrawdown(baselinePath);
  const protectedMaxDrawdownPct = maxDrawdown(protectedPath);
  const drawdownReductionPctPoints = baselineMaxDrawdownPct - protectedMaxDrawdownPct;
  const pathByDate = new Map(protectedPath.map(point => [point.date, point.equityEur] as const));
  const baselineByDate = new Map(baselinePath.map(point => [point.date, point.equityEur] as const));
  const dates = bars.map(bar => isoDate(bar.timestamp));
  const episodes = detectEpisodes(bars.map(bar => bar.close));
  const breachDeltas = episodes.map(episode => {
    const breachDate = dates[episode.breachIndex];
    const deltaEur = (pathByDate.get(breachDate) ?? 0) - (baselineByDate.get(breachDate) ?? 0);
    return { peakDate: dates[episode.peakIndex], breachDate, deltaEur };
  });
  const moneySavedAtBreachesEur = breachDeltas.reduce((sum, row) => sum + Math.max(0, row.deltaEur), 0);
  const moneyLostAtBreachesEur = breachDeltas.reduce((sum, row) => sum + Math.max(0, -row.deltaEur), 0);
  const netBreachProtectionEur = moneySavedAtBreachesEur - moneyLostAtBreachesEur;
  const cycleBenefitEur = cycles.reduce((sum, row) => sum + Math.max(0, row.marginalDeltaEur), 0);
  const cycleOpportunityCostEur = cycles.reduce((sum, row) => sum + Math.max(0, -row.marginalDeltaEur), 0);
  const finalDeltaEur = protectedFinalValueEur - baselineFinalValueEur;
  const economicPass = finalDeltaEur >= 0
    && drawdownReductionPctPoints >= MIN_DRAWDOWN_REDUCTION_PCT_POINTS
    && netBreachProtectionEur > 0;

  return {
    assetId: input.assetId,
    ticker: input.ticker,
    name: input.name,
    status: 'VALID' as const,
    sessions: bars.length,
    policy: {
      initialCapitalEur: INITIAL_CAPITAL_EUR,
      reductionPct: PROTECTION_REDUCTION_PCT,
      executionMode: 'NEXT_OPEN',
      cashMode: 'HISTORICAL_ECB_DFR_FLOOR_0',
      wholeShares: true,
      broker: 'MYINVESTOR',
      taxContext: 'UNCONFIRMED_CONSERVATIVE_30_PCT_GAINS_19_PCT_CASH_INTEREST'
    },
    baseline: {
      finalValueEur: baselineFinalValueEur,
      totalReturnPct: (baselineFinalValueEur / INITIAL_CAPITAL_EUR - 1) * 100,
      maxDrawdownPct: baselineMaxDrawdownPct,
      grossCashInterestEur: baselineGrossCashInterestEur,
      cashInterestTaxEur: baselineCashInterestTaxEur,
      initialFeeEur: initialFee
    },
    protected: {
      finalValueEur: protectedFinalValueEur,
      totalReturnPct: (protectedFinalValueEur / INITIAL_CAPITAL_EUR - 1) * 100,
      maxDrawdownPct: protectedMaxDrawdownPct,
      grossCashInterestEur: protectedGrossCashInterestEur,
      cashInterestTaxEur: protectedCashInterestTaxEur,
      capitalGainsTaxEur: totalCapitalGainsTaxEur,
      totalFeesEur,
      turnoverEur,
      reductions,
      reentries,
      protectedSessions,
      protectedTimePct: protectedSessions / bars.length * 100
    },
    delta: {
      finalValueEur: finalDeltaEur,
      finalValuePctOfInitial: finalDeltaEur / INITIAL_CAPITAL_EUR * 100,
      returnPctPoints: (protectedFinalValueEur - baselineFinalValueEur) / INITIAL_CAPITAL_EUR * 100,
      drawdownReductionPctPoints,
      economicBenefitVsHoldEur: Math.max(0, finalDeltaEur),
      opportunityCostVsHoldEur: Math.max(0, -finalDeltaEur),
      moneySavedAtBreachesEur,
      moneyLostAtBreachesEur,
      netBreachProtectionEur,
      medianBreachDeltaEur: median(breachDeltas.map(row => row.deltaEur)),
      cycleBenefitEur,
      cycleOpportunityCostEur,
      netCycleBenefitEur: cycleBenefitEur - cycleOpportunityCostEur
    },
    economicPass,
    gateRule: `finalDeltaEur >= 0 AND drawdownReductionPctPoints >= ${MIN_DRAWDOWN_REDUCTION_PCT_POINTS} AND netBreachProtectionEur > 0`,
    breachAudits: breachDeltas,
    protectionCycles: cycles,
    trades
  };
}

async function main() {
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  const healthUrl = 'http://127.0.0.1:3000/api/health';
  if (!(await waitForHealth(healthUrl, 1500))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore','pipe','pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' } });
    ownsServer = true;
    if (!(await waitForHealth(healthUrl, 30_000))) throw new Error('Local server did not become healthy on port 3000');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider('http://127.0.0.1:3000/api/market-data/history'));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(RESEARCH_CATALOG, DATA_FROM, FINAL_END_DATE, {
      forceRefresh: false, concurrency: 3, maxSelected: 40, minimumBars: 252, maxDataAgeDays: 7
    });
    const core = scan.acceptedDataset.assets.find(asset => asset.assetId === 'EUNL');
    if (!core) throw new Error('V8_ECONOMIC_GATE_REQUIRES_EUNL');

    const diagnostic = await loadForwardRiskDiagnosticData(DATA_FROM, FINAL_END_DATE);
    const macro = await loadForwardRiskMacroDataV5VintageSafe(DATA_FROM, FINAL_END_DATE);
    const options = await loadForwardRiskOptionsDataV7();
    if (!macro.pointInTimeVintageSafe) throw new Error('V8_ECONOMIC_GATE_REQUIRES_VINTAGE_SAFE_MACRO');
    const v5 = runForwardRiskVulnerabilityV5({ dataset: scan.acceptedDataset, diagnosticDataset: diagnostic.dataset, macroData: macro, startDate: START_DATE, endDate: FINAL_END_DATE });
    const v7 = runForwardRiskOptionsV7({ coreBars: core.bars, optionsData: options, startDate: START_DATE, endDate: FINAL_END_DATE });
    if (v5.status !== 'VALID' || v7.status !== 'VALID') throw new Error('V8_ECONOMIC_GATE_REQUIRES_VALID_FROZEN_V5_V7');

    const v7ByDate = new Map(v7.points.map(point => [point.informationDate, point] as const));
    const signalState: SignalStatePoint[] = v5.points
      .filter(point => point.informationDate >= START_DATE && point.informationDate <= FINAL_END_DATE)
      .map(point => ({
        informationDate: point.informationDate,
        active: point.vulnerabilityScorePct >= V5_SIGNAL_SCORE_PCT || (v7ByDate.get(point.informationDate)?.signalScorePct ?? -Infinity) >= V7_SIGNAL_SCORE_PCT
      }))
      .sort((a, b) => a.informationDate.localeCompare(b.informationDate));

    const evaluate = (assetId: string, ticker: string, name: string) => {
      const asset = scan.acceptedDataset.assets.find(row => row.assetId === assetId);
      if (!asset) return { assetId, ticker, name, status: 'INSUFFICIENT_DATA' as const, reason: 'ASSET_NOT_ACCEPTED' };
      return evaluateEconomicAsset({ assetId, ticker, name, bars: asset.bars, signalState });
    };

    const coreCase = evaluate('EUNL', 'EUNL.DE', 'iShares Core MSCI World UCITS ETF');
    const benchmarkCases = BENCHMARK_IDS.map(assetId => {
      const catalog = EUR_VALIDATION_HOLDOUT_UNIVERSE.find(row => row.assetId === assetId)!;
      return evaluate(assetId, catalog.ticker, catalog.name);
    });
    const validBenchmarks = benchmarkCases.filter((row): row is Extract<(typeof benchmarkCases)[number], { status: 'VALID' }> => row.status === 'VALID');
    const holdoutEconomicPasses = validBenchmarks.filter(row => row.economicPass).length;
    const medianHoldoutFinalDeltaEur = median(validBenchmarks.map(row => row.delta.finalValueEur));
    const medianHoldoutDrawdownReductionPctPoints = median(validBenchmarks.map(row => row.delta.drawdownReductionPctPoints));
    const corePass = coreCase.status === 'VALID' && coreCase.economicPass;
    const aggregatePass = validBenchmarks.length === BENCHMARK_IDS.length
      && holdoutEconomicPasses >= MIN_HOLDOUT_ECONOMIC_PASSES
      && (medianHoldoutFinalDeltaEur ?? -Infinity) >= 0
      && (medianHoldoutDrawdownReductionPctPoints ?? -Infinity) >= MIN_DRAWDOWN_REDUCTION_PCT_POINTS;
    const verdict = corePass && aggregatePass
      ? 'V8_CAUSAL_ECONOMIC_GATE_PASS_READY_FOR_SHADOW_PILOT'
      : 'V8_CAUSAL_ECONOMIC_GATE_FAIL_RESEARCH_ONLY';

    console.log('\nFORWARD_RISK_V8_ECONOMIC_RESULT');
    console.log(JSON.stringify({
      methodology: 'FROZEN_V8_VINTAGE_SAFE_25PCT_NEXT_OPEN_ECONOMIC_COUNTERFACTUAL',
      signalDefinition: 'V5 vulnerability >=80 OR V7 options >=80; unchanged.',
      macroSource: macro.source,
      macroPointInTimeVintageSafe: macro.pointInTimeVintageSafe,
      macroFailures: macro.failures,
      optionsSource: options.source,
      policyFrozenBeforeResult: {
        initialCapitalEur: INITIAL_CAPITAL_EUR,
        protectionReductionPct: PROTECTION_REDUCTION_PCT,
        execution: 'NEXT_OPEN_ONLY_INFORMATION_DATE_STRICTLY_BEFORE_EXECUTION_DATE',
        cash: 'HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX',
        broker: 'MYINVESTOR_WHOLE_SHARES_AND_EXISTING_COMMISSION_MODEL',
        tax: 'EXISTING_SPANISH_MODEL_CONTEXT_UNCONFIRMED',
        parameterGridUsed: false
      },
      economicGateFrozenBeforeResult: {
        individual: `finalDeltaEur >= 0 AND drawdownReductionPctPoints >= ${MIN_DRAWDOWN_REDUCTION_PCT_POINTS} AND netBreachProtectionEur > 0`,
        coreMustPass: true,
        requiredHoldoutPasses: MIN_HOLDOUT_ECONOMIC_PASSES,
        validHoldoutsRequired: BENCHMARK_IDS.length,
        medianHoldoutFinalDeltaEurMustBeNonNegative: true,
        medianHoldoutDrawdownReductionPctPointsMinimum: MIN_DRAWDOWN_REDUCTION_PCT_POINTS
      },
      coreCase,
      benchmarkCases,
      aggregate: {
        validBenchmarks: validBenchmarks.length,
        holdoutEconomicPasses,
        medianHoldoutFinalDeltaEur,
        medianHoldoutDrawdownReductionPctPoints,
        aggregatePass
      },
      verdict,
      decisionRule: {
        productionPromotionAllowed: false,
        thresholdsRetuned: false,
        protectionPctRetuned: false,
        nextIfPass: 'Run shadow/paper validation before considering any advisory or production integration.',
        nextIfFail: 'Keep V8 research-only; do not retune the 25% policy or V5/V7 thresholds on this sample.'
      },
      notes: [
        'The baseline and protected paths begin with the same whole-share purchase and initial commission.',
        'Protection changes only at the first tradable open after a strictly earlier V8 information date.',
        'Cash uses the existing historical ECB deposit-facility-rate proxy with a 0% floor and existing cash-interest tax model.',
        'Positive realized gains reserve tax using the existing Spanish tax model; the baseline is not liquidated at the end, so deferred taxation remains an intentional hurdle for the protected strategy.',
        'The 25% action, 13,000 EUR capital scale and economic gate were fixed before this counterfactual result was observed.',
        'No result feeds Custodia, replay sizing, live recommendations or alerts.'
      ]
    }, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => { console.error('FORWARD_RISK_V8_ECONOMIC_FATAL', error); process.exit(1); });
