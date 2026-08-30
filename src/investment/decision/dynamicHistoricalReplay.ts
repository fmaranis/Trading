import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import { DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';
import { brokerCommission } from './costAwareExecutionPolicy';
import { buildHistoricalShortlist } from './historicalShortlist';
import { HistoricalDecisionReplayEngine } from './historicalDecisionReplay';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import { accrueRemuneratedCash, allCashBenchmark } from './remuneratedCash';
import { estimateSpanishTaxOnRealizedGain, type SpanishTaxSettings } from './spanishTaxModel';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';
import type { InvestmentHorizonYears, InvestorRiskProfile } from './types';

export type DynamicReplayFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
export type DynamicReplaySignalAction = 'BUY' | 'ADD' | 'HOLD' | 'AVOID' | 'REDUCE' | 'EXIT';
export type DynamicReplayEventType = 'BUY' | 'ADD' | 'REDUCE' | 'EXIT' | 'TRANSFER';

export interface DynamicReplaySignal {
  id: string;
  signalDate: string;
  executionDate: string | null;
  assetId: string;
  ticker: string;
  action: DynamicReplaySignalAction;
  targetWeight: number;
  currentWeight: number;
  consensusScore: number | null;
  favorableVotes: number | null;
  unfavorableVotes: number | null;
  structuralDowntrend: boolean;
  buyTheDipCandidate: boolean;
  executed: boolean;
  unitsDelta: number;
  notionalEur: number;
  feeEur: number;
  realizedGainEur: number;
  estimatedTaxEur: number;
  taxDeferredTransferEur: number;
  executionPriceEur: number | null;
  reason: string;
}

export interface DynamicReplayEvent {
  id: string;
  date: string;
  type: DynamicReplayEventType;
  ticker?: string;
  sourceTicker?: string;
  targetTicker?: string;
  amountEur: number;
  feeEur: number;
  taxEur: number;
  realizedGainEur: number;
  label: string;
  detail: string;
}

export interface DynamicReplayEquityPoint {
  date: string;
  equityEur: number;
  cashEur: number;
  investedEur: number;
  cashBenchmarkEur: number;
  regime: string;
  method: string;
}

export interface DynamicHistoricalReplayResult {
  requestedStartDate: string;
  startDate: string;
  endDate: string;
  frequency: DynamicReplayFrequency;
  initialCapitalEur: number;
  finalValueEur: number;
  totalReturnPct: number;
  staticBuyHoldFinalEur: number | null;
  staticBuyHoldReturnPct: number | null;
  allCashFinalEur: number;
  allCashReturnPct: number;
  excessFinalEurVsStatic: number | null;
  excessReturnVsStaticPctPoints: number | null;
  excessFinalEurVsCash: number;
  excessReturnVsCashPctPoints: number;
  decisionPathMaxDrawdownPct: number;
  decisions: number;
  materialSignals: number;
  executedBuys: number;
  executedAdds: number;
  executedReductions: number;
  executedExits: number;
  totalFeesEur: number;
  totalEstimatedTaxEur: number;
  totalTransferredEur: number;
  cashInterestEur: number;
  taxMethod: 'CONFIGURED_PROGRESSIVE' | 'CONSERVATIVE_MAX_RATE';
  signals: DynamicReplaySignal[];
  events: DynamicReplayEvent[];
  equityPath: DynamicReplayEquityPoint[];
  notes: string[];
}

interface ReplayLot {
  units: number;
  costEur: number;
  acquisitionDate: string;
}

interface Holding {
  assetId: string;
  ticker: string;
  instrumentType: 'ETF_ETC' | 'MUTUAL_FUND';
  units: number;
  lots: ReplayLot[];
}

interface PlannedSignal {
  signal: DynamicReplaySignal;
  assessment: StrategyConsensusAssessment | null;
}

interface ExecutedSale {
  plan: PlannedSignal;
  holdingType: 'ETF_ETC' | 'MUTUAL_FUND';
  grossEur: number;
  feeEur: number;
  costBasisEur: number;
  realizedGainEur: number;
  transferPlannedEur: number;
  transferRemainingEur: number;
}

interface DecisionState {
  date: string;
  regime: string;
  method: string;
}

const MIN_WEIGHT_DELTA = 0.01;
const DEFAULT_TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function clamp(x: number, min: number, max: number): number { return Math.min(max, Math.max(min, x)); }
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
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  let peak = slice[0];
  let max = 0;
  for (const price of slice) {
    peak = Math.max(peak, price);
    if (peak > 0) max = Math.max(max, (peak - price) / peak * 100);
  }
  return max;
}
function scoreCandidate(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null, defensive: boolean): number {
  const momentum = (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45;
  const riskPenalty = (vol ?? 30) * 0.30 + (dd ?? 25) * 0.25;
  return momentum - riskPenalty + (defensive ? 2.5 : 0);
}
function latestDatasetDate(dataset: MultiAssetDataset): string {
  const dates = dataset.assets.flatMap(asset => asset.bars.slice(-1).map(bar => isoDate(bar.timestamp))).sort();
  if (!dates.length) throw new Error('No hay barras para replay dinámico.');
  return dates[dates.length - 1];
}
function assetById(dataset: MultiAssetDataset, assetId: string) {
  return dataset.assets.find(asset => asset.assetId === assetId) ?? null;
}
function catalogItem(catalog: AssetUniverseItem[], assetId: string): AssetUniverseItem | null {
  return catalog.find(asset => asset.assetId === assetId) ?? null;
}
function instrumentType(catalog: AssetUniverseItem[], assetId: string): 'ETF_ETC' | 'MUTUAL_FUND' {
  return catalogItem(catalog, assetId)?.instrumentType ?? 'ETF_ETC';
}
function closeOnOrBefore(dataset: MultiAssetDataset, assetId: string, date: string): number | null {
  const asset = assetById(dataset, assetId);
  if (!asset) return null;
  const bar = [...asset.bars].reverse().find(item => isoDate(item.timestamp) <= date);
  return bar && bar.close > 0 ? bar.close : null;
}
function nextBarAfter(dataset: MultiAssetDataset, assetId: string, date: string) {
  const asset = assetById(dataset, assetId);
  if (!asset) return null;
  return asset.bars.find(item => isoDate(item.timestamp) > date) ?? null;
}
function executionBarOnOrAfter(dataset: MultiAssetDataset, assetId: string, date: string) {
  const asset = assetById(dataset, assetId);
  if (!asset) return null;
  return asset.bars.find(item => isoDate(item.timestamp) >= date) ?? null;
}
function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function tradingDates(dataset: MultiAssetDataset, startDate: string, endDate: string): string[] {
  return [...new Set(dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))))]
    .filter(date => date >= startDate && date <= endDate)
    .sort();
}
function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function requestedDecisionDates(dataset: MultiAssetDataset, startDate: string, endDate: string, frequency: DynamicReplayFrequency): string[] {
  if (frequency === 'DAILY') return tradingDates(dataset, startDate, endDate).filter(date => date < endDate);
  if (frequency === 'WEEKLY') {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const date of tradingDates(dataset, startDate, endDate)) {
      if (date >= endDate) continue;
      const key = weekKey(date);
      if (!seen.has(key)) { seen.add(key); out.push(date); }
    }
    return out;
  }
  const step = frequency === 'MONTHLY' ? 1 : 3;
  const out = [startDate];
  let cursor = addMonths(startDate, step);
  while (cursor < endDate) {
    out.push(cursor);
    cursor = addMonths(cursor, step);
  }
  return [...new Set(out)];
}
function buildHistoricalConsensusScan(input: {
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  date: string;
  minimumBars: number;
  selectedIds: string[];
  selectedDataset: MultiAssetDataset;
}): AssetUniverseScanResult {
  const candidates: AssetScanCandidate[] = [];
  const acceptedAssets: MultiAssetDataset['assets'] = [];
  for (const full of input.dataset.assets) {
    const item = catalogItem(input.catalog, full.assetId);
    if (!item) continue;
    const bars = full.bars.filter(bar => isoDate(bar.timestamp) <= input.date);
    if (bars.length < input.minimumBars) continue;
    const prices = bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
    if (prices.length < input.minimumBars) continue;
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
  const selectedSet = new Set(input.selectedIds);
  return {
    scanned: candidates.length,
    accepted: candidates.length,
    rejected: 0,
    selected: candidates.filter(candidate => selectedSet.has(candidate.asset.assetId)),
    candidates,
    dataset: input.selectedDataset,
    acceptedDataset: { ...input.dataset, assets: acceptedAssets },
    rejectionCounts: {}
  };
}
function holdingValue(dataset: MultiAssetDataset, holding: Holding, date: string): number {
  const price = closeOnOrBefore(dataset, holding.assetId, date);
  return price == null ? 0 : holding.units * price;
}
function portfolioValue(dataset: MultiAssetDataset, holdings: Map<string, Holding>, cashEur: number, date: string): { equityEur: number; investedEur: number } {
  const investedEur = [...holdings.values()].reduce((sum, holding) => sum + holdingValue(dataset, holding, date), 0);
  return { equityEur: cashEur + investedEur, investedEur };
}
function pathMaxDrawdown(path: DynamicReplayEquityPoint[]): number {
  let peak = 0;
  let max = 0;
  for (const point of path) {
    peak = Math.max(peak, point.equityEur);
    if (peak > 0) max = Math.max(max, (peak - point.equityEur) / peak * 100);
  }
  return max;
}
function actionReason(assessment: StrategyConsensusAssessment | null, method: string, regime: string): string {
  if (!assessment) return `Sin consenso causal suficiente. Método ${method}; régimen ${regime}.`;
  return `${assessment.explanation} Consenso ${assessment.consensusScore > 0 ? '+' : ''}${assessment.consensusScore}; ${assessment.favorableVotes} favorables / ${assessment.unfavorableVotes} adversas. Método ${method}; régimen ${regime}.`;
}
function addLot(holding: Holding, units: number, costEur: number, acquisitionDate: string): void {
  if (!(units > 0)) return;
  holding.lots.push({ units, costEur: Math.max(0, costEur), acquisitionDate });
  holding.lots.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
}
function consumeLots(holding: Holding, unitsToSell: number): number {
  let remaining = Math.max(0, unitsToSell);
  let basis = 0;
  const next: ReplayLot[] = [];
  for (const lot of holding.lots) {
    if (remaining <= 1e-12) { next.push(lot); continue; }
    const used = Math.min(remaining, lot.units);
    basis += lot.costEur * (used / lot.units);
    const unitsLeft = lot.units - used;
    if (unitsLeft > 1e-12) next.push({ ...lot, units: unitsLeft, costEur: lot.costEur * (unitsLeft / lot.units) });
    remaining -= used;
  }
  holding.lots = next;
  return basis;
}
function taxForPositiveGain(gainEur: number, executionDate: string, settings: SpanishTaxSettings, positiveGainByYear: Map<string, number>): number {
  const positive = Math.max(0, gainEur);
  if (positive <= 1e-9) return 0;
  const year = executionDate.slice(0, 4);
  const priorSimulatedGain = positiveGainByYear.get(year) ?? 0;
  const scopedSettings = settings.contextConfirmed
    ? { ...settings, priorSavingsTaxableBaseEur: settings.priorSavingsTaxableBaseEur + priorSimulatedGain }
    : settings;
  const estimate = estimateSpanishTaxOnRealizedGain(positive, scopedSettings, false);
  positiveGainByYear.set(year, priorSimulatedGain + positive);
  return estimate.estimatedTaxEur;
}
function buildDailyEquityPath(input: {
  dataset: MultiAssetDataset;
  signals: DynamicReplaySignal[];
  initialCapitalEur: number;
  cashBenchmarkAnnualPct: number;
  startDate: string;
  endDate: string;
  decisionStates: DecisionState[];
}): DynamicReplayEquityPoint[] {
  const dates = tradingDates(input.dataset, input.startDate, input.endDate);
  if (!dates.length) return [];
  const barsByAssetDate = new Map<string, Map<string, number>>();
  for (const asset of input.dataset.assets) {
    barsByAssetDate.set(asset.assetId, new Map(asset.bars.map(bar => [isoDate(bar.timestamp), bar.close])));
  }
  const lastPrice = new Map<string, number>();
  const holdings = new Map<string, number>();
  const signalsByDate = new Map<string, DynamicReplaySignal[]>();
  for (const signal of input.signals.filter(signal => signal.executed && signal.executionDate)) {
    const date = signal.executionDate!;
    const list = signalsByDate.get(date) ?? [];
    list.push(signal);
    signalsByDate.set(date, list);
  }
  const states = [...input.decisionStates].sort((a, b) => a.date.localeCompare(b.date));
  let stateIndex = 0;
  let regime = states[0]?.regime ?? 'UNKNOWN';
  let method = states[0]?.method ?? 'N/D';
  let cashEur = input.initialCapitalEur;
  let lastCashDate = input.startDate;
  const path: DynamicReplayEquityPoint[] = [];

  for (const date of dates) {
    if (date > lastCashDate) {
      cashEur = accrueRemuneratedCash(cashEur, input.cashBenchmarkAnnualPct, lastCashDate, date).cashEur;
      lastCashDate = date;
    }
    while (stateIndex < states.length && states[stateIndex].date <= date) {
      regime = states[stateIndex].regime;
      method = states[stateIndex].method;
      stateIndex++;
    }
    for (const asset of input.dataset.assets) {
      const price = barsByAssetDate.get(asset.assetId)?.get(date);
      if (price != null && price > 0) lastPrice.set(asset.assetId, price);
    }
    const daySignals = [...(signalsByDate.get(date) ?? [])].sort((a, b) => {
      const rank = (s: DynamicReplaySignal) => s.action === 'REDUCE' || s.action === 'EXIT' ? 0 : 1;
      return rank(a) - rank(b);
    });
    for (const signal of daySignals) {
      if (signal.unitsDelta < 0) {
        cashEur += Math.max(0, signal.notionalEur - signal.feeEur - signal.estimatedTaxEur);
      } else if (signal.unitsDelta > 0) {
        cashEur = Math.max(0, cashEur - signal.notionalEur - signal.feeEur);
      }
      const units = Math.max(0, (holdings.get(signal.assetId) ?? 0) + signal.unitsDelta);
      if (units <= 1e-12) holdings.delete(signal.assetId); else holdings.set(signal.assetId, units);
    }
    let investedEur = 0;
    for (const [assetId, units] of holdings) investedEur += units * (lastPrice.get(assetId) ?? 0);
    const cashBenchmarkEur = date <= input.startDate
      ? input.initialCapitalEur
      : allCashBenchmark(input.initialCapitalEur, input.cashBenchmarkAnnualPct, input.startDate, date).finalEur;
    path.push({ date, equityEur: cashEur + investedEur, cashEur, investedEur, cashBenchmarkEur, regime, method });
  }
  return path;
}

export class DynamicHistoricalReplayEngine {
  static run(input: {
    dataset: MultiAssetDataset;
    catalog: AssetUniverseItem[];
    startDate: string;
    frequency?: DynamicReplayFrequency;
    initialCapitalEur: number;
    riskProfile: InvestorRiskProfile;
    horizonYears: InvestmentHorizonYears;
    cashBenchmarkAnnualPct?: number;
    minimumBars?: number;
    taxSettings?: SpanishTaxSettings;
  }): DynamicHistoricalReplayResult {
    if (!(input.initialCapitalEur > 0)) throw new Error('El capital del replay dinámico debe ser > 0.');
    const frequency = input.frequency ?? 'MONTHLY';
    const minimumBars = input.minimumBars ?? 252;
    const cashBenchmarkAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct)
      ? Math.max(0, Number(input.cashBenchmarkAnnualPct))
      : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    const taxSettings = input.taxSettings ?? DEFAULT_TAX_SETTINGS;
    const endDate = latestDatasetDate(input.dataset);
    if (input.startDate >= endDate) throw new Error('La fecha inicial debe ser anterior al último dato REAL.');

    const holdings = new Map<string, Holding>();
    const signals: DynamicReplaySignal[] = [];
    const events: DynamicReplayEvent[] = [];
    const decisionStates: DecisionState[] = [];
    const positiveGainByYear = new Map<string, number>();
    let cashEur = input.initialCapitalEur;
    let cashInterestEur = 0;
    let totalFeesEur = 0;
    let totalEstimatedTaxEur = 0;
    let totalTransferredEur = 0;
    let lastCashDate: string | null = null;
    let firstDecisionDate: string | null = null;
    let lastDecisionDate: string | null = null;
    let decisions = 0;

    for (const requestedDate of requestedDecisionDates(input.dataset, input.startDate, endDate, frequency)) {
      const shortlist = buildHistoricalShortlist({
        dataset: input.dataset,
        catalog: input.catalog,
        requestedDate,
        minimumBars,
        maxSelected: 8
      });
      if (shortlist.dataset.assets.length < 2) continue;

      const provisionalValue = lastDecisionDate
        ? portfolioValue(input.dataset, holdings, cashEur, lastDecisionDate).equityEur
        : input.initialCapitalEur;
      const decision = InvestmentDecisionEngine.decide(
        shortlist.dataset,
        { capitalEur: Math.max(1, provisionalValue), riskProfile: input.riskProfile, horizonYears: input.horizonYears },
        new Date(`${requestedDate}T23:59:59Z`)
      );
      const decisionDate = decision.asOfDate;
      if (decisionDate >= endDate || decisionDate === lastDecisionDate) continue;
      if (lastDecisionDate && decisionDate < lastDecisionDate) continue;

      if (!firstDecisionDate) {
        firstDecisionDate = decisionDate;
        lastCashDate = decisionDate;
      } else if (lastCashDate && decisionDate > lastCashDate) {
        const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, decisionDate);
        cashEur = accrued.cashEur;
        cashInterestEur += accrued.interestEur;
        lastCashDate = decisionDate;
      }

      const current = portfolioValue(input.dataset, holdings, cashEur, decisionDate);
      const liveDecision = InvestmentDecisionEngine.decide(
        shortlist.dataset,
        { capitalEur: Math.max(1, current.equityEur), riskProfile: input.riskProfile, horizonYears: input.horizonYears },
        new Date(`${requestedDate}T23:59:59Z`)
      );
      decisionStates.push({ date: decisionDate, regime: liveDecision.marketRegime, method: liveDecision.recommendedMethod });
      const targetWeights = new Map(liveDecision.assets.map(asset => [asset.assetId, asset.weight]));
      const historicalScan = buildHistoricalConsensusScan({
        dataset: input.dataset,
        catalog: input.catalog,
        date: decisionDate,
        minimumBars,
        selectedIds: shortlist.selectedAssetIds,
        selectedDataset: shortlist.dataset
      });
      const ids = new Set<string>([...shortlist.selectedAssetIds, ...holdings.keys()]);
      const planned: PlannedSignal[] = [];

      for (const assetId of ids) {
        const item = catalogItem(input.catalog, assetId);
        if (!item) continue;
        const assessment = StrategyConsensusEngine.assess(historicalScan, assetId, cashBenchmarkAnnualPct);
        const holding = holdings.get(assetId);
        const heldValue = holding ? holdingValue(input.dataset, holding, decisionDate) : 0;
        const currentWeight = current.equityEur > 0 ? heldValue / current.equityEur : 0;
        const targetWeight = clamp(targetWeights.get(assetId) ?? 0, 0, 1);
        let action: DynamicReplaySignalAction;

        if (holding && holding.units > 1e-12) {
          if (assessment?.existingPositionAction === 'REDUCE_REVIEW' && targetWeight < currentWeight - MIN_WEIGHT_DELTA) {
            action = targetWeight <= 0.005 ? 'EXIT' : 'REDUCE';
          } else if (targetWeight > currentWeight + MIN_WEIGHT_DELTA && assessment?.existingPositionAction === 'ADD') {
            action = 'ADD';
          } else {
            action = 'HOLD';
          }
        } else {
          action = targetWeight > MIN_WEIGHT_DELTA && assessment?.newMoneyAction === 'BUY' ? 'BUY' : 'AVOID';
        }

        planned.push({
          assessment,
          signal: {
            id: `${decisionDate}_${assetId}_${action}`,
            signalDate: decisionDate,
            executionDate: null,
            assetId,
            ticker: item.ticker,
            action,
            targetWeight,
            currentWeight,
            consensusScore: assessment?.consensusScore ?? null,
            favorableVotes: assessment?.favorableVotes ?? null,
            unfavorableVotes: assessment?.unfavorableVotes ?? null,
            structuralDowntrend: assessment?.structuralDowntrend ?? false,
            buyTheDipCandidate: assessment?.buyTheDipCandidate ?? false,
            executed: false,
            unitsDelta: 0,
            notionalEur: 0,
            feeEur: 0,
            realizedGainEur: 0,
            estimatedTaxEur: 0,
            taxDeferredTransferEur: 0,
            executionPriceEur: null,
            reason: actionReason(assessment, liveDecision.recommendedMethod, liveDecision.marketRegime)
          }
        });
      }

      const tradePlans = planned.filter(plan => ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(plan.signal.action));
      const nextDates = tradePlans.map(plan => nextBarAfter(input.dataset, plan.signal.assetId, decisionDate)).filter(Boolean).map(bar => isoDate(bar!.timestamp));
      const commonExecutionDate = nextDates.length === tradePlans.length && nextDates.length
        ? [...nextDates].sort().at(-1)!
        : null;

      if (commonExecutionDate && lastCashDate && commonExecutionDate > lastCashDate) {
        const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, commonExecutionDate);
        cashEur = accrued.cashEur;
        cashInterestEur += accrued.interestEur;
        lastCashDate = commonExecutionDate;
      }

      if (commonExecutionDate) {
        const executedSales: ExecutedSale[] = [];
        const sellPlans = tradePlans.filter(plan => plan.signal.action === 'REDUCE' || plan.signal.action === 'EXIT');
        for (const plan of sellPlans) {
          const holding = holdings.get(plan.signal.assetId);
          const bar = executionBarOnOrAfter(input.dataset, plan.signal.assetId, commonExecutionDate);
          if (!holding || !bar || !(bar.open > 0)) continue;
          const price = bar.open;
          const targetEur = plan.signal.action === 'EXIT' ? 0 : current.equityEur * plan.signal.targetWeight;
          let unitsToSell = 0;
          if (holding.instrumentType === 'MUTUAL_FUND') {
            const targetUnits = Math.max(0, targetEur / price);
            unitsToSell = Math.max(0, holding.units - targetUnits);
          } else {
            const targetUnits = Math.max(0, Math.floor(targetEur / price));
            unitsToSell = Math.max(0, Math.floor(holding.units - targetUnits));
          }
          unitsToSell = Math.min(holding.units, unitsToSell);
          if (!(unitsToSell > 1e-12)) continue;
          const gross = unitsToSell * price;
          const fee = holding.instrumentType === 'ETF_ETC' ? brokerCommission(gross) : 0;
          const basis = consumeLots(holding, unitsToSell);
          const realizedGain = gross - fee - basis;
          cashEur += Math.max(0, gross - fee);
          holding.units = Math.max(0, holding.units - unitsToSell);
          if (holding.units <= 1e-12) holdings.delete(holding.assetId);
          totalFeesEur += fee;
          plan.signal.executed = true;
          plan.signal.executionDate = isoDate(bar.timestamp);
          plan.signal.unitsDelta = -unitsToSell;
          plan.signal.notionalEur = gross;
          plan.signal.feeEur = fee;
          plan.signal.realizedGainEur = realizedGain;
          plan.signal.executionPriceEur = price;
          executedSales.push({ plan, holdingType: holding.instrumentType, grossEur: gross, feeEur: fee, costBasisEur: basis, realizedGainEur: realizedGain, transferPlannedEur: 0, transferRemainingEur: 0 });
        }

        const buyPlans = tradePlans
          .filter(plan => plan.signal.action === 'BUY' || plan.signal.action === 'ADD')
          .sort((a, b) => {
            const typeA = instrumentType(input.catalog, a.signal.assetId);
            const typeB = instrumentType(input.catalog, b.signal.assetId);
            if (typeA !== typeB) return typeA === 'MUTUAL_FUND' ? -1 : 1;
            return (b.signal.targetWeight - b.signal.currentWeight) - (a.signal.targetWeight - a.signal.currentWeight);
          });

        const fundSales = executedSales.filter(sale => sale.holdingType === 'MUTUAL_FUND');
        const desiredFundBuyEur = buyPlans
          .filter(plan => instrumentType(input.catalog, plan.signal.assetId) === 'MUTUAL_FUND')
          .reduce((sum, plan) => {
            const bar = executionBarOnOrAfter(input.dataset, plan.signal.assetId, commonExecutionDate);
            if (!bar || !(bar.open > 0)) return sum;
            const existing = holdings.get(plan.signal.assetId);
            const currentUnits = existing?.units ?? 0;
            const targetEur = current.equityEur * plan.signal.targetWeight;
            return sum + Math.max(0, targetEur - currentUnits * bar.open);
          }, 0);
        let remainingTransferPotential = Math.min(fundSales.reduce((sum, sale) => sum + sale.grossEur, 0), desiredFundBuyEur);
        for (const sale of fundSales) {
          const paired = Math.min(sale.grossEur, remainingTransferPotential);
          sale.transferPlannedEur = paired;
          sale.transferRemainingEur = paired;
          sale.plan.signal.taxDeferredTransferEur = paired;
          remainingTransferPotential -= paired;
        }

        for (const sale of executedSales) {
          const taxableFraction = sale.holdingType === 'MUTUAL_FUND' && sale.grossEur > 0
            ? Math.max(0, (sale.grossEur - sale.transferPlannedEur) / sale.grossEur)
            : 1;
          const taxableGain = Math.max(0, sale.realizedGainEur) * taxableFraction;
          const tax = taxForPositiveGain(taxableGain, commonExecutionDate, taxSettings, positiveGainByYear);
          sale.plan.signal.estimatedTaxEur = tax;
          cashEur = Math.max(0, cashEur - tax);
          totalEstimatedTaxEur += tax;
          const signal = sale.plan.signal;
          events.push({
            id: `event_${signal.id}`,
            date: commonExecutionDate,
            type: signal.action as 'REDUCE' | 'EXIT',
            ticker: signal.ticker,
            amountEur: sale.grossEur,
            feeEur: sale.feeEur,
            taxEur: tax,
            realizedGainEur: sale.realizedGainEur,
            label: `${signal.action === 'EXIT' ? 'SALIR' : 'REDUCIR'} ${signal.ticker}`,
            detail: `${sale.grossEur.toFixed(2)} € vendidos · coste ${sale.feeEur.toFixed(2)} € · plusvalía realizada ${sale.realizedGainEur.toFixed(2)} € · reserva fiscal ${tax.toFixed(2)} €${sale.transferPlannedEur > 0 ? ` · ${sale.transferPlannedEur.toFixed(2)} € preparados para traspaso` : ''}.`
          });
        }

        for (const plan of buyPlans) {
          const bar = executionBarOnOrAfter(input.dataset, plan.signal.assetId, commonExecutionDate);
          if (!bar || !(bar.open > 0) || cashEur <= 0) continue;
          const type = instrumentType(input.catalog, plan.signal.assetId);
          const existing = holdings.get(plan.signal.assetId);
          const currentUnits = existing?.units ?? 0;
          const price = bar.open;
          const targetEur = current.equityEur * plan.signal.targetWeight;
          const currentEur = currentUnits * price;
          const gapEur = Math.max(0, targetEur - currentEur);
          if (gapEur <= 0.01) continue;

          let unitsToBuy = 0;
          let fee = 0;
          let spend = 0;
          if (type === 'MUTUAL_FUND') {
            spend = Math.min(gapEur, cashEur);
            unitsToBuy = spend / price;
          } else {
            unitsToBuy = Math.floor(gapEur / price);
            fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * price) : 0;
            while (unitsToBuy > 0 && unitsToBuy * price + fee > cashEur + 1e-9) {
              unitsToBuy--;
              fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * price) : 0;
            }
            spend = unitsToBuy * price + fee;
          }
          if (!(unitsToBuy > 1e-12) || spend > cashEur + 1e-9) continue;
          cashEur = Math.max(0, cashEur - spend);
          const nextHolding: Holding = existing ?? { assetId: plan.signal.assetId, ticker: plan.signal.ticker, instrumentType: type, units: 0, lots: [] };
          nextHolding.units += unitsToBuy;
          addLot(nextHolding, unitsToBuy, spend, commonExecutionDate);
          holdings.set(nextHolding.assetId, nextHolding);
          totalFeesEur += fee;
          plan.signal.executed = true;
          plan.signal.executionDate = isoDate(bar.timestamp);
          plan.signal.unitsDelta = unitsToBuy;
          plan.signal.notionalEur = unitsToBuy * price;
          plan.signal.feeEur = fee;
          plan.signal.executionPriceEur = price;

          if (type === 'MUTUAL_FUND') {
            let transferNeed = plan.signal.notionalEur;
            for (const sale of fundSales) {
              if (transferNeed <= 1e-9) break;
              const amount = Math.min(transferNeed, sale.transferRemainingEur);
              if (amount <= 1e-9) continue;
              sale.transferRemainingEur -= amount;
              transferNeed -= amount;
              plan.signal.taxDeferredTransferEur += amount;
              totalTransferredEur += amount;
              events.push({
                id: `transfer_${sale.plan.signal.id}_${plan.signal.id}_${events.length}`,
                date: commonExecutionDate,
                type: 'TRANSFER',
                sourceTicker: sale.plan.signal.ticker,
                targetTicker: plan.signal.ticker,
                amountEur: amount,
                feeEur: 0,
                taxEur: 0,
                realizedGainEur: 0,
                label: `TRASPASO ${sale.plan.signal.ticker} → ${plan.signal.ticker}`,
                detail: `${amount.toFixed(2)} € tratados como traspaso fondo→fondo fiscalmente diferido; impuesto inmediato estimado 0 € para esa parte.`
              });
            }
          }

          events.push({
            id: `event_${plan.signal.id}`,
            date: commonExecutionDate,
            type: plan.signal.action as 'BUY' | 'ADD',
            ticker: plan.signal.ticker,
            amountEur: plan.signal.notionalEur,
            feeEur: fee,
            taxEur: 0,
            realizedGainEur: 0,
            label: `${plan.signal.action === 'BUY' ? 'COMPRAR' : 'AÑADIR'} ${plan.signal.ticker}`,
            detail: `${plan.signal.notionalEur.toFixed(2)} € invertidos · coste ${fee.toFixed(2)} €${plan.signal.taxDeferredTransferEur > 0 ? ` · ${plan.signal.taxDeferredTransferEur.toFixed(2)} € procedentes de traspaso fiscalmente diferido` : ''}.`
          });
        }
      }

      signals.push(...planned.map(plan => plan.signal));
      lastDecisionDate = decisionDate;
      decisions++;
    }

    if (!firstDecisionDate) throw new Error('No hay una fecha con al menos dos activos y suficiente historia causal para iniciar el replay dinámico.');
    if (lastCashDate && endDate > lastCashDate) {
      const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, endDate);
      cashEur = accrued.cashEur;
      cashInterestEur += accrued.interestEur;
    }
    const finalPortfolio = portfolioValue(input.dataset, holdings, cashEur, endDate);
    const finalValueEur = finalPortfolio.equityEur;
    const totalReturnPct = (finalValueEur / input.initialCapitalEur - 1) * 100;
    const allCash = allCashBenchmark(input.initialCapitalEur, cashBenchmarkAnnualPct, firstDecisionDate, endDate);
    const staticResult = HistoricalDecisionReplayEngine.run({
      dataset: input.dataset,
      catalog: input.catalog,
      requestedDates: [input.startDate],
      initialCapitalEur: input.initialCapitalEur,
      riskProfile: input.riskProfile,
      horizonYears: input.horizonYears,
      cashBenchmarkAnnualPct,
      minimumBars
    }).cases[0] ?? null;
    const staticFinal = staticResult?.finalValueEur ?? null;
    const staticReturn = staticResult?.totalReturnPct ?? null;
    const material = signals.filter(signal => ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action));
    const equityPath = buildDailyEquityPath({
      dataset: input.dataset,
      signals,
      initialCapitalEur: input.initialCapitalEur,
      cashBenchmarkAnnualPct,
      startDate: firstDecisionDate,
      endDate,
      decisionStates
    });

    return {
      requestedStartDate: input.startDate,
      startDate: firstDecisionDate,
      endDate,
      frequency,
      initialCapitalEur: input.initialCapitalEur,
      finalValueEur,
      totalReturnPct,
      staticBuyHoldFinalEur: staticFinal,
      staticBuyHoldReturnPct: staticReturn,
      allCashFinalEur: allCash.finalEur,
      allCashReturnPct: allCash.returnPct,
      excessFinalEurVsStatic: staticFinal == null ? null : finalValueEur - staticFinal,
      excessReturnVsStaticPctPoints: staticReturn == null ? null : totalReturnPct - staticReturn,
      excessFinalEurVsCash: finalValueEur - allCash.finalEur,
      excessReturnVsCashPctPoints: totalReturnPct - allCash.returnPct,
      decisionPathMaxDrawdownPct: pathMaxDrawdown(equityPath),
      decisions,
      materialSignals: material.length,
      executedBuys: signals.filter(signal => signal.action === 'BUY' && signal.executed).length,
      executedAdds: signals.filter(signal => signal.action === 'ADD' && signal.executed).length,
      executedReductions: signals.filter(signal => signal.action === 'REDUCE' && signal.executed).length,
      executedExits: signals.filter(signal => signal.action === 'EXIT' && signal.executed).length,
      totalFeesEur,
      totalEstimatedTaxEur,
      totalTransferredEur,
      cashInterestEur,
      taxMethod: taxSettings.contextConfirmed ? 'CONFIGURED_PROGRESSIVE' : 'CONSERVATIVE_MAX_RATE',
      signals,
      events: events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
      equityPath,
      notes: [
        'Cada decisión se reconstruye causalmente con datos disponibles hasta esa fecha; nunca se eligen compras o ventas mirando el resultado futuro.',
        'La prueba puede revisar cada sesión, semana, mes o trimestre. Cada operación se ejecuta después de la señal usando la primera apertura común disponible.',
        'Una compra nueva exige consenso BUY; una ampliación exige ADD. Un cambio teórico de peso por sí solo no autoriza operar.',
        'Una reducción/venta exige deterioro estructural (REDUCE_REVIEW) y que el asignador de esa misma fecha pida menos exposición.',
        'ETFs usan títulos enteros y comisión MyInvestor modelada; fondos usan unidades fraccionarias. Fondo→fondo se empareja como traspaso fiscalmente diferido cuando coincide en el mismo cambio.',
        taxSettings.contextConfirmed
          ? 'La fiscalidad usa la escala española del ahorro y la base previa configurada; la reserva se descuenta de forma conservadora al realizar ganancias.'
          : 'El contexto fiscal anual no está confirmado: las plusvalías imponibles reservan conservadoramente el 30%. Es una estimación de fricción, no una liquidación tributaria histórica exacta.',
        'La trayectoria de patrimonio se valora en cada sesión disponible y se compara en la misma gráfica con mantener todo el capital en la cuenta remunerada.',
        'Permanece el sesgo de supervivencia del catálogo actual y no se reconstruyen cambios históricos de comercialización/disponibilidad del broker.'
      ]
    };
  }
}
