import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { brokerCommission } from './costAwareExecutionPolicy';
import type { DynamicHistoricalReplayResult, DynamicReplayEquityPoint, DynamicReplaySignal } from './dynamicHistoricalReplay';
import { assessDeteriorationStreak, isDiversifiedCoreCategory } from './portfolioPositionHealth';
import { accrueRemuneratedCash, allCashBenchmark } from './remuneratedCash';
import { estimateSpanishTaxOnRealizedGain, type SpanishTaxSettings } from './spanishTaxModel';
import { StrategyConsensusEngine } from './strategyConsensusEngine';
import { classifyTrendProtectionV2, profitCaptureRatioPct, type TrendProtectionV2Action, type TrendProtectionV2Decision } from './trendProtectionPolicy';

export interface TrendProtectionV2CounterfactualTrade {
  id: string;
  source: 'BASELINE_ENTRY' | 'TREND_PROTECTION_V2';
  signalDate: string;
  executionDate: string;
  assetId: string;
  ticker: string;
  action: 'BUY' | 'ADD' | 'REDUCE' | 'EXIT';
  unitsDelta: number;
  notionalEur: number;
  feeEur: number;
  realizedGainEur: number;
  realizedReturnPct: number | null;
  estimatedTaxEur: number;
  taxDeferredTransferEur: number;
  executionPriceEur: number;
  positionReturnPctAtSignal: number | null;
  positionMfePctAtSignal: number | null;
  givebackFromMfePctPointsAtSignal: number | null;
  profitCaptureRatioPct: number | null;
  reason: string;
}

export interface TrendProtectionV2EntryParity {
  baselineExecutedEntries: number;
  reproducedEntries: number;
  exact: boolean;
  shortfallCount: number;
  shortfallEur: number;
  mismatches: string[];
}

export interface TrendProtectionV2CounterfactualResult {
  policy: 'TREND_PROTECTION_V2';
  methodology: 'FIXED_BASELINE_ENTRIES';
  valid: boolean;
  startDate: string;
  endDate: string;
  initialCapitalEur: number;
  finalValueEur: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  totalFeesEur: number;
  totalEstimatedTaxEur: number;
  totalTransferredEur: number;
  cashInterestEur: number;
  turnoverEur: number;
  managementTurnoverEur: number;
  executedReductions: number;
  executedExits: number;
  actionCounts: Record<TrendProtectionV2Action, number>;
  averageProfitCaptureRatioPct: number | null;
  realizedManagementGainEur: number;
  lossSaleCounts: {
    atOrBelowMinus10Pct: number;
    atOrBelowMinus20Pct: number;
    atOrBelowMinus30Pct: number;
  };
  entryParity: TrendProtectionV2EntryParity;
  deltaVsCurrentPolicy: {
    finalValueEur: number;
    returnPctPoints: number;
    maxDrawdownPctPoints: number;
    feesEur: number;
    estimatedTaxEur: number;
    turnoverEur: number;
  };
  trades: TrendProtectionV2CounterfactualTrade[];
  equityPath: DynamicReplayEquityPoint[];
  notes: string[];
}

interface CounterfactualLot {
  units: number;
  costEur: number;
  acquisitionDate: string;
}

interface CounterfactualHolding {
  assetId: string;
  ticker: string;
  instrumentType: 'ETF_ETC' | 'MUTUAL_FUND';
  units: number;
  lots: CounterfactualLot[];
}

interface ProtectionState {
  mfePct: number;
  armed: boolean;
  observations: number;
  referenceReturnPct: number | null;
  reductionExecuted: boolean;
}

interface ScheduledProtectionSale {
  signalDate: string;
  executionDate: string;
  assetId: string;
  ticker: string;
  action: 'REDUCE' | 'EXIT';
  suggestedReductionPct: number;
  equityAtSignalEur: number;
  currentReturnPct: number | null;
  mfePct: number | null;
  givebackPctPoints: number | null;
  decision: TrendProtectionV2Decision;
}

interface SalePreview {
  scheduled: ScheduledProtectionSale;
  holding: CounterfactualHolding;
  unitsToSell: number;
  price: number;
  grossEur: number;
  feeEur: number;
  transferEur: number;
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
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
function scoreCandidate(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null, defensive: boolean): number {
  return (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45 - (vol ?? 30) * 0.30 - (dd ?? 25) * 0.25 + (defensive ? 2.5 : 0);
}
function catalogItem(catalog: AssetUniverseItem[], assetId: string): AssetUniverseItem | null {
  return catalog.find(item => item.assetId === assetId) ?? null;
}
function assetSeries(dataset: MultiAssetDataset, assetId: string) {
  return dataset.assets.find(asset => asset.assetId === assetId) ?? null;
}
function closeOnOrBefore(dataset: MultiAssetDataset, assetId: string, date: string): number | null {
  const asset = assetSeries(dataset, assetId);
  const bar = asset ? [...asset.bars].reverse().find(item => isoDate(item.timestamp) <= date) : null;
  return bar && bar.close > 0 ? bar.close : null;
}
function barOnDate(dataset: MultiAssetDataset, assetId: string, date: string) {
  return assetSeries(dataset, assetId)?.bars.find(item => isoDate(item.timestamp) === date) ?? null;
}
function nextBarAfter(dataset: MultiAssetDataset, assetId: string, date: string) {
  return assetSeries(dataset, assetId)?.bars.find(item => isoDate(item.timestamp) > date) ?? null;
}
function tradingDates(dataset: MultiAssetDataset, startDate: string, endDate: string): string[] {
  return [...new Set(dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))))]
    .filter(date => date >= startDate && date <= endDate)
    .sort();
}
function buildHistoricalScan(dataset: MultiAssetDataset, catalog: AssetUniverseItem[], date: string, minimumBars: number): AssetUniverseScanResult {
  const candidates: AssetScanCandidate[] = [];
  const acceptedAssets: MultiAssetDataset['assets'] = [];
  for (const full of dataset.assets) {
    const item = catalogItem(catalog, full.assetId);
    if (!item) continue;
    const bars = full.bars.filter(bar => isoDate(bar.timestamp) <= date);
    if (bars.length < minimumBars) continue;
    const prices = bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
    if (prices.length < minimumBars) continue;
    const m20 = pctReturn(prices, 20);
    const m60 = pctReturn(prices, 60);
    const m120 = pctReturn(prices, 120);
    const vol = annualizedVolatility(prices, 60);
    const dd = maxDrawdown(prices, 252);
    const truncated = { ...full, bars };
    acceptedAssets.push(truncated);
    candidates.push({
      asset: item,
      status: 'ACCEPTED',
      bars: bars.length,
      asOfDate: isoDate(bars.at(-1)!.timestamp),
      lastClose: prices.at(-1) ?? null,
      momentum20Pct: m20,
      momentum60Pct: m60,
      momentum120Pct: m120,
      annualizedVolatilityPct: vol,
      maxDrawdownPct: dd,
      score: scoreCandidate(m20, m60, m120, vol, dd, Boolean(item.defensive))
    });
  }
  const acceptedDataset: MultiAssetDataset = { ...dataset, assets: acceptedAssets };
  return {
    scanned: candidates.length,
    accepted: candidates.length,
    rejected: 0,
    selected: candidates,
    candidates,
    dataset: acceptedDataset,
    acceptedDataset,
    rejectionCounts: {}
  };
}
function basisOf(holding: CounterfactualHolding): number {
  return holding.lots.reduce((sum, lot) => sum + lot.costEur, 0);
}
function addLot(holding: CounterfactualHolding, units: number, costEur: number, acquisitionDate: string): void {
  if (!(units > 0)) return;
  holding.lots.push({ units, costEur: Math.max(0, costEur), acquisitionDate });
  holding.lots.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
}
function consumeLots(holding: CounterfactualHolding, unitsToSell: number): number {
  let remaining = Math.max(0, unitsToSell);
  let basis = 0;
  const next: CounterfactualLot[] = [];
  for (const lot of holding.lots) {
    if (remaining <= 1e-12) { next.push(lot); continue; }
    const used = Math.min(remaining, lot.units);
    basis += lot.costEur * used / lot.units;
    const left = lot.units - used;
    if (left > 1e-12) next.push({ ...lot, units: left, costEur: lot.costEur * left / lot.units });
    remaining -= used;
  }
  holding.lots = next;
  return basis;
}
function portfolioValue(dataset: MultiAssetDataset, holdings: Map<string, CounterfactualHolding>, cashEur: number, date: string): { equityEur: number; investedEur: number } {
  let investedEur = 0;
  for (const holding of holdings.values()) investedEur += holding.units * (closeOnOrBefore(dataset, holding.assetId, date) ?? 0);
  return { equityEur: cashEur + investedEur, investedEur };
}
function orderEconomicallyExecutable(notionalEur: number, totalCapitalEur: number): boolean {
  if (!(notionalEur > 0)) return false;
  const policy = executionPolicyForCapital(totalCapitalEur);
  if (notionalEur < policy.minimumOrderNotionalEur - 1e-9) return false;
  return brokerCommission(notionalEur) / notionalEur * 100 <= policy.maximumOrderFeeDragPct + 1e-9;
}
function taxForPositiveGain(gainEur: number, executionDate: string, settings: SpanishTaxSettings, positiveGainByYear: Map<string, number>): number {
  const positive = Math.max(0, gainEur);
  if (positive <= 1e-9) return 0;
  const year = executionDate.slice(0, 4);
  const priorSimulatedGain = positiveGainByYear.get(year) ?? 0;
  const scoped = settings.contextConfirmed
    ? { ...settings, priorSavingsTaxableBaseEur: settings.priorSavingsTaxableBaseEur + priorSimulatedGain }
    : settings;
  const estimate = estimateSpanishTaxOnRealizedGain(positive, scoped, false);
  positiveGainByYear.set(year, priorSimulatedGain + positive);
  return estimate.estimatedTaxEur;
}
function pathMaxDrawdown(path: DynamicReplayEquityPoint[]): number {
  let peak = 0;
  let maximum = 0;
  for (const point of path) {
    peak = Math.max(peak, point.equityEur);
    if (peak > 0) maximum = Math.max(maximum, (peak - point.equityEur) / peak * 100);
  }
  return maximum;
}
function entrySignals(result: DynamicHistoricalReplayResult): DynamicReplaySignal[] {
  return result.signals
    .filter(signal => signal.executed && signal.executionDate && (signal.action === 'BUY' || signal.action === 'ADD') && signal.unitsDelta > 0)
    .sort((a, b) => a.executionDate!.localeCompare(b.executionDate!) || a.id.localeCompare(b.id));
}
function baselineTurnover(result: DynamicHistoricalReplayResult): number {
  return result.signals.filter(signal => signal.executed).reduce((sum, signal) => sum + Math.max(0, signal.notionalEur), 0);
}
function emptyProtectionState(): ProtectionState {
  return { mfePct: 0, armed: false, observations: 0, referenceReturnPct: null, reductionExecuted: false };
}

export function buildTrendProtectionV2Counterfactual(input: {
  result: DynamicHistoricalReplayResult;
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  cashBenchmarkAnnualPct: number;
  minimumBars: number;
  taxSettings: SpanishTaxSettings;
}): TrendProtectionV2CounterfactualResult {
  const baseline = input.result;
  const entries = entrySignals(baseline);
  const entriesByDate = new Map<string, DynamicReplaySignal[]>();
  for (const signal of entries) entriesByDate.set(signal.executionDate!, [...(entriesByDate.get(signal.executionDate!) ?? []), signal]);
  const decisionDates = new Set(baseline.signals.map(signal => signal.signalDate).filter(date => date >= baseline.startDate && date <= baseline.endDate));
  const marketDates = tradingDates(input.dataset, baseline.startDate, baseline.endDate);
  const marketDateSet = new Set(marketDates);
  const timelineDates = [...new Set([...marketDates, ...decisionDates, ...entries.map(signal => signal.executionDate!)])].sort();
  const holdings = new Map<string, CounterfactualHolding>();
  const protectionState = new Map<string, ProtectionState>();
  const scheduledSalesByDate = new Map<string, ScheduledProtectionSale[]>();
  const pendingSaleAssets = new Set<string>();
  const positiveGainByYear = new Map<string, number>();
  const trades: TrendProtectionV2CounterfactualTrade[] = [];
  const equityPath: DynamicReplayEquityPoint[] = [];
  const actionCounts: Record<TrendProtectionV2Action, number> = { HOLD: 0, WATCH: 0, PROTECT: 0, REDUCE: 0, EXIT: 0 };
  const mismatches: string[] = [];
  let reproducedEntries = 0;
  let shortfallEur = 0;
  let cashEur = baseline.initialCapitalEur;
  let cashInterestEur = 0;
  let totalFeesEur = 0;
  let totalEstimatedTaxEur = 0;
  let totalTransferredEur = 0;
  let lastCashDate = baseline.startDate;
  let regime = baseline.equityPath[0]?.regime ?? 'UNKNOWN';
  let method = baseline.equityPath[0]?.method ?? 'N/D';
  const baselineStateByDate = new Map(baseline.equityPath.map(point => [point.date, point]));

  for (const date of timelineDates) {
    if (date < baseline.startDate || date > baseline.endDate) continue;
    if (date > lastCashDate) {
      const accrued = accrueRemuneratedCash(cashEur, input.cashBenchmarkAnnualPct, lastCashDate, date);
      cashEur = accrued.cashEur;
      cashInterestEur += accrued.interestEur;
      lastCashDate = date;
    }

    const entriesToday = entriesByDate.get(date) ?? [];
    const scheduledToday = scheduledSalesByDate.get(date) ?? [];
    const previews: SalePreview[] = [];
    for (const scheduled of scheduledToday) {
      pendingSaleAssets.delete(scheduled.assetId);
      const holding = holdings.get(scheduled.assetId);
      const bar = barOnDate(input.dataset, scheduled.assetId, date);
      if (!holding || !bar || !(bar.open > 0)) continue;
      let unitsToSell = scheduled.action === 'EXIT'
        ? holding.units
        : holding.units * Math.max(0, Math.min(100, scheduled.suggestedReductionPct)) / 100;
      if (holding.instrumentType === 'ETF_ETC') unitsToSell = Math.floor(unitsToSell + 1e-9);
      unitsToSell = Math.min(holding.units, unitsToSell);
      if (!(unitsToSell > 1e-12)) continue;
      const grossEur = unitsToSell * bar.open;
      const feeEur = holding.instrumentType === 'ETF_ETC' ? brokerCommission(grossEur) : 0;
      if (holding.instrumentType === 'ETF_ETC' && !orderEconomicallyExecutable(grossEur, scheduled.equityAtSignalEur)) continue;
      previews.push({ scheduled, holding, unitsToSell, price: bar.open, grossEur, feeEur, transferEur: 0 });
    }

    let fundBuyNeedEur = entriesToday
      .filter(signal => catalogItem(input.catalog, signal.assetId)?.instrumentType === 'MUTUAL_FUND')
      .reduce((sum, signal) => sum + signal.notionalEur, 0);
    for (const preview of previews.filter(item => item.holding.instrumentType === 'MUTUAL_FUND')) {
      preview.transferEur = Math.min(preview.grossEur, fundBuyNeedEur);
      fundBuyNeedEur -= preview.transferEur;
    }

    for (const preview of previews) {
      const { scheduled, holding } = preview;
      const soldBasisEur = consumeLots(holding, preview.unitsToSell);
      const realizedGainEur = preview.grossEur - preview.feeEur - soldBasisEur;
      const taxableFraction = preview.grossEur > 0 ? Math.max(0, 1 - preview.transferEur / preview.grossEur) : 1;
      const estimatedTaxEur = taxForPositiveGain(Math.max(0, realizedGainEur) * taxableFraction, date, input.taxSettings, positiveGainByYear);
      cashEur += Math.max(0, preview.grossEur - preview.feeEur - estimatedTaxEur);
      holding.units = Math.max(0, holding.units - preview.unitsToSell);
      totalFeesEur += preview.feeEur;
      totalEstimatedTaxEur += estimatedTaxEur;
      totalTransferredEur += preview.transferEur;
      const realizedReturnPct = soldBasisEur > 0 ? realizedGainEur / soldBasisEur * 100 : null;
      trades.push({
        id: `V2_${scheduled.signalDate}_${scheduled.assetId}_${scheduled.action}_${date}`,
        source: 'TREND_PROTECTION_V2',
        signalDate: scheduled.signalDate,
        executionDate: date,
        assetId: scheduled.assetId,
        ticker: scheduled.ticker,
        action: scheduled.action,
        unitsDelta: -preview.unitsToSell,
        notionalEur: preview.grossEur,
        feeEur: preview.feeEur,
        realizedGainEur,
        realizedReturnPct,
        estimatedTaxEur,
        taxDeferredTransferEur: preview.transferEur,
        executionPriceEur: preview.price,
        positionReturnPctAtSignal: scheduled.currentReturnPct,
        positionMfePctAtSignal: scheduled.mfePct,
        givebackFromMfePctPointsAtSignal: scheduled.givebackPctPoints,
        profitCaptureRatioPct: profitCaptureRatioPct(realizedReturnPct, scheduled.mfePct),
        reason: scheduled.decision.reason
      });
      const state = protectionState.get(scheduled.assetId);
      if (scheduled.action === 'REDUCE' && state) state.reductionExecuted = true;
      if (holding.units <= 1e-12 || scheduled.action === 'EXIT') {
        holdings.delete(scheduled.assetId);
        protectionState.delete(scheduled.assetId);
      }
    }

    for (const signal of entriesToday) {
      const requiredCash = Math.max(0, signal.notionalEur + signal.feeEur);
      if (cashEur + 1e-9 < requiredCash) {
        const shortage = requiredCash - cashEur;
        shortfallEur += shortage;
        mismatches.push(`${date}:${signal.assetId}:${signal.action}:CASH_SHORTFALL:${shortage.toFixed(2)}`);
        continue;
      }
      const item = catalogItem(input.catalog, signal.assetId);
      if (!item || !(signal.unitsDelta > 0) || !(signal.executionPriceEur != null && signal.executionPriceEur > 0)) {
        mismatches.push(`${date}:${signal.assetId}:${signal.action}:INVALID_BASELINE_ENTRY`);
        continue;
      }
      cashEur = Math.max(0, cashEur - requiredCash);
      const holding = holdings.get(signal.assetId) ?? {
        assetId: signal.assetId,
        ticker: signal.ticker,
        instrumentType: item.instrumentType,
        units: 0,
        lots: []
      };
      holding.units += signal.unitsDelta;
      addLot(holding, signal.unitsDelta, requiredCash, date);
      holdings.set(signal.assetId, holding);
      protectionState.set(signal.assetId, emptyProtectionState());
      totalFeesEur += signal.feeEur;
      reproducedEntries++;
      trades.push({
        id: `ENTRY_${signal.id}`,
        source: 'BASELINE_ENTRY',
        signalDate: signal.signalDate,
        executionDate: date,
        assetId: signal.assetId,
        ticker: signal.ticker,
        action: signal.action as 'BUY' | 'ADD',
        unitsDelta: signal.unitsDelta,
        notionalEur: signal.notionalEur,
        feeEur: signal.feeEur,
        realizedGainEur: 0,
        realizedReturnPct: null,
        estimatedTaxEur: 0,
        taxDeferredTransferEur: 0,
        executionPriceEur: signal.executionPriceEur,
        positionReturnPctAtSignal: null,
        positionMfePctAtSignal: null,
        givebackFromMfePctPointsAtSignal: null,
        profitCaptureRatioPct: null,
        reason: `Entrada fijada al baseline: ${signal.reason}`
      });
    }

    if (decisionDates.has(date) && holdings.size > 0) {
      const scan = buildHistoricalScan(input.dataset, input.catalog, date, input.minimumBars);
      const currentPortfolio = portfolioValue(input.dataset, holdings, cashEur, date);
      for (const holding of [...holdings.values()]) {
        if (pendingSaleAssets.has(holding.assetId)) continue;
        const item = catalogItem(input.catalog, holding.assetId);
        const candidate = scan.candidates.find(row => row.asset.assetId === holding.assetId);
        if (!item || !candidate) continue;
        const assessment = StrategyConsensusEngine.assess(scan, holding.assetId, input.cashBenchmarkAnnualPct);
        if (!assessment) continue;
        const currentPrice = closeOnOrBefore(input.dataset, holding.assetId, date);
        const basisEur = basisOf(holding);
        const currentReturnPct = currentPrice != null && basisEur > 0 ? (currentPrice * holding.units / basisEur - 1) * 100 : null;
        const state = protectionState.get(holding.assetId) ?? emptyProtectionState();
        if (currentReturnPct != null) state.mfePct = Math.max(state.mfePct, currentReturnPct, 0);
        const giveback = currentReturnPct == null ? null : Math.max(0, state.mfePct - currentReturnPct);
        const observationsForDecision = state.armed ? state.observations + 1 : 1;
        const referenceForDecision = state.armed ? state.referenceReturnPct : currentReturnPct;
        const decision = classifyTrendProtectionV2(assessment, {
          currentReturnPct,
          mfePct: state.mfePct,
          givebackFromMfePctPoints: giveback,
          isDiversifiedCore: isDiversifiedCoreCategory(item.category, item.ticker),
          deteriorationStreakSessions: assessDeteriorationStreak(scan, holding.assetId, input.cashBenchmarkAnnualPct),
          momentum20Pct: candidate.momentum20Pct,
          protectionObservations: observationsForDecision,
          protectionReferenceReturnPct: referenceForDecision,
          protectionReductionExecuted: state.reductionExecuted
        });
        actionCounts[decision.action] += 1;
        if (decision.reclaimDetected) {
          state.armed = false;
          state.observations = 0;
          state.referenceReturnPct = null;
          state.reductionExecuted = false;
        } else {
          const protectionActive = decision.winnerProtectionArmed || decision.loserFailureArmed || decision.action === 'PROTECT' || decision.action === 'REDUCE' || decision.action === 'EXIT';
          if (protectionActive) {
            if (!state.armed) {
              state.armed = true;
              state.referenceReturnPct = currentReturnPct;
              state.observations = 1;
              state.reductionExecuted = false;
            } else {
              state.observations = observationsForDecision;
            }
          }
        }
        protectionState.set(holding.assetId, state);

        if (decision.action === 'REDUCE' || decision.action === 'EXIT') {
          const nextBar = nextBarAfter(input.dataset, holding.assetId, date);
          if (!nextBar) continue;
          const executionDate = isoDate(nextBar.timestamp);
          if (executionDate > baseline.endDate) continue;
          const scheduled: ScheduledProtectionSale = {
            signalDate: date,
            executionDate,
            assetId: holding.assetId,
            ticker: item.ticker,
            action: decision.action,
            suggestedReductionPct: decision.action === 'EXIT' ? 100 : Math.max(0, Math.min(100, decision.suggestedReductionPct ?? 25)),
            equityAtSignalEur: currentPortfolio.equityEur,
            currentReturnPct,
            mfePct: state.mfePct,
            givebackPctPoints: giveback,
            decision
          };
          scheduledSalesByDate.set(executionDate, [...(scheduledSalesByDate.get(executionDate) ?? []), scheduled]);
          pendingSaleAssets.add(holding.assetId);
        }
      }
    }

    const baselineState = baselineStateByDate.get(date);
    if (baselineState) { regime = baselineState.regime; method = baselineState.method; }
    if (marketDateSet.has(date)) {
      const current = portfolioValue(input.dataset, holdings, cashEur, date);
      const cashBenchmarkEur = date <= baseline.startDate
        ? baseline.initialCapitalEur
        : allCashBenchmark(baseline.initialCapitalEur, input.cashBenchmarkAnnualPct, baseline.startDate, date).finalEur;
      equityPath.push({ date, equityEur: current.equityEur, cashEur, investedEur: current.investedEur, cashBenchmarkEur, regime, method });
    }
  }

  const finalPortfolio = portfolioValue(input.dataset, holdings, cashEur, baseline.endDate);
  const finalValueEur = finalPortfolio.equityEur;
  const totalReturnPct = (finalValueEur / baseline.initialCapitalEur - 1) * 100;
  const managementTrades = trades.filter(trade => trade.source === 'TREND_PROTECTION_V2');
  const capture = managementTrades.map(trade => trade.profitCaptureRatioPct).filter((value): value is number => value != null && Number.isFinite(value));
  const entryParity: TrendProtectionV2EntryParity = {
    baselineExecutedEntries: entries.length,
    reproducedEntries,
    exact: reproducedEntries === entries.length && mismatches.length === 0,
    shortfallCount: mismatches.filter(value => value.includes('CASH_SHORTFALL')).length,
    shortfallEur,
    mismatches
  };
  const counterfactualTurnover = trades.reduce((sum, trade) => sum + trade.notionalEur, 0);
  const baselineTurnoverEur = baselineTurnover(baseline);
  const managementTurnoverEur = managementTrades.reduce((sum, trade) => sum + trade.notionalEur, 0);
  const maxDrawdownPct = pathMaxDrawdown(equityPath);

  return {
    policy: 'TREND_PROTECTION_V2',
    methodology: 'FIXED_BASELINE_ENTRIES',
    valid: entryParity.exact,
    startDate: baseline.startDate,
    endDate: baseline.endDate,
    initialCapitalEur: baseline.initialCapitalEur,
    finalValueEur,
    totalReturnPct,
    maxDrawdownPct,
    totalFeesEur,
    totalEstimatedTaxEur,
    totalTransferredEur,
    cashInterestEur,
    turnoverEur: counterfactualTurnover,
    managementTurnoverEur,
    executedReductions: managementTrades.filter(trade => trade.action === 'REDUCE').length,
    executedExits: managementTrades.filter(trade => trade.action === 'EXIT').length,
    actionCounts,
    averageProfitCaptureRatioPct: capture.length ? capture.reduce((sum, value) => sum + value, 0) / capture.length : null,
    realizedManagementGainEur: managementTrades.reduce((sum, trade) => sum + trade.realizedGainEur, 0),
    lossSaleCounts: {
      atOrBelowMinus10Pct: managementTrades.filter(trade => (trade.realizedReturnPct ?? Infinity) <= -10).length,
      atOrBelowMinus20Pct: managementTrades.filter(trade => (trade.realizedReturnPct ?? Infinity) <= -20).length,
      atOrBelowMinus30Pct: managementTrades.filter(trade => (trade.realizedReturnPct ?? Infinity) <= -30).length
    },
    entryParity,
    deltaVsCurrentPolicy: {
      finalValueEur: finalValueEur - baseline.finalValueEur,
      returnPctPoints: totalReturnPct - baseline.totalReturnPct,
      maxDrawdownPctPoints: maxDrawdownPct - baseline.decisionPathMaxDrawdownPct,
      feesEur: totalFeesEur - baseline.totalFeesEur,
      estimatedTaxEur: totalEstimatedTaxEur - baseline.totalEstimatedTaxEur,
      turnoverEur: counterfactualTurnover - baselineTurnoverEur
    },
    trades,
    equityPath,
    notes: [
      'Contrafactual V2 de atribución: reproduce exactamente los BUY/ADD realmente ejecutados por CURRENT_POLICY (mismas fechas, unidades, precios y comisiones) y sustituye únicamente la gestión REDUCE/EXIT por TREND_PROTECTION_V2.',
      'Si el cash contrafactual no permite reproducir una entrada baseline exacta, entryParity.exact=false y el A/B se marca valid=false; no se parcializa ni se inventa financiación para maquillar el resultado.',
      'Las decisiones V2 se recalculan causalmente sobre las posiciones y bases de coste del propio camino contrafactual. PROTECT no opera; cada episodio permite como máximo un REDUCE parcial antes de reclaim o hard EXIT.',
      'ETFs se venden en títulos enteros y respetan el mismo gate mínimo/fee-drag. Fondos permiten unidades fraccionarias; fondo→fondo del mismo día difiere fiscalidad hasta el importe emparejado.',
      'deltaVsCurrentPolicy sólo es interpretable como comparación económica cuando valid=true.'
    ]
  };
}

export function appendTrendProtectionV2Counterfactual(input: {
  result: DynamicHistoricalReplayResult;
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  cashBenchmarkAnnualPct: number;
  minimumBars: number;
  taxSettings: SpanishTaxSettings;
}): DynamicHistoricalReplayResult {
  input.result.trendProtectionV2Counterfactual = buildTrendProtectionV2Counterfactual(input);
  input.result.notes.push('TREND_PROTECTION_V2 counterfactual adjunto: mismas entradas baseline; sólo cambia gestión de posiciones. Consultar entryParity.exact antes de interpretar deltas económicos.');
  return input.result;
}
