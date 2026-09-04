import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import type { AssetScanCandidate, AssetUniverseScanResult } from './assetUniverseScanner';
import { executionPolicyForCapital } from './adaptiveExecutionPolicy';
import { assessAgainstCashBenchmark, DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';
import { brokerCommission } from './costAwareExecutionPolicy';
import type { EntryTimingSetup, EntryTimingState } from './entryTiming';
import { HistoricalDecisionReplayEngine } from './historicalDecisionReplay';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import { PortfolioCandidateGate } from './portfolioCandidateGate';
import { PortfolioDecisionEngine, type PortfolioPositionDecision } from './portfolioDecisionEngine';
import { assessDeteriorationStreak, classifyPositionHealth, isDiversifiedCoreCategory, type PortfolioPositionHealthSnapshot, type PositionHealthContext } from './portfolioPositionHealth';
import { accrueRemuneratedCash, allCashBenchmark } from './remuneratedCash';
import { estimateSpanishTaxOnRealizedGain, type SpanishTaxSettings } from './spanishTaxModel';
import { StrategyConsensusEngine, type StrategyConsensusAssessment, type TrendStructureState } from './strategyConsensusEngine';
import { classifyTrendProtectionV1, type TrendProtectionAction } from './trendProtectionPolicy';
import type { FundPosition } from './fundPortfolio';
import type { InvestmentDecisionResult, InvestmentHorizonYears, InvestorRiskProfile } from './types';
import type { UserPortfolioState } from './userPortfolio';

export type DynamicReplayFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
export type DynamicReplaySignalAction = 'BUY' | 'ADD' | 'HOLD' | 'WATCH' | 'AVOID' | 'REDUCE' | 'EXIT';
export type DynamicReplayEventType = 'BUY' | 'ADD' | 'REDUCE' | 'EXIT' | 'TRANSFER';
export type DynamicReplayDeploymentSession = 1 | 5 | 20 | 60;
export type DynamicReplaySimulationMode = 'CUSTODIA_ENGINE' | 'HOLD_ONLY';
export type DynamicReplayInitialPortfolioSource = 'ZERO' | 'MANUAL' | 'CURRENT_PORTFOLIO';

export interface DynamicReplayInitialAllocation {
  assetId: string;
  amountEur: number;
}

export interface DynamicReplayInitialPortfolio {
  source: Exclude<DynamicReplayInitialPortfolioSource, 'ZERO'>;
  cashEur: number;
  allocations: DynamicReplayInitialAllocation[];
}

export interface DynamicReplaySignal {
  id: string;
  signalDate: string;
  executionDate: string | null;
  assetId: string;
  ticker: string;
  action: DynamicReplaySignalAction;
  targetWeight: number;
  currentWeight: number;
  recommendedAmountEur: number;
  consensusScore: number | null;
  favorableVotes: number | null;
  unfavorableVotes: number | null;
  structuralDowntrend: boolean;
  buyTheDipCandidate: boolean;
  timingState: EntryTimingState | null;
  timingSetup: EntryTimingSetup | null;
  timingScore: number | null;
  suggestedInitialFraction: number | null;
  positionCurrentReturnPct?: number | null;
  positionMfePct?: number | null;
  positionGivebackFromMfePctPoints?: number | null;
  positionDeteriorationStreakSessions?: number | null;
  positionIsDiversifiedCore?: boolean | null;
  trendProtectionV1Action?: TrendProtectionAction | null;
  trendProtectionV1SuggestedReductionPct?: number | null;
  trendProtectionV1WinnerProtectionArmed?: boolean | null;
  trendProtectionV1LoserFailureArmed?: boolean | null;
  trendProtectionV1Reason?: string | null;
  trendStructureState?: TrendStructureState | null;
  trendSlope20AnnualizedPct?: number | null;
  trendSlope60AnnualizedPct?: number | null;
  trendSlopeAccelerationPctPoints?: number | null;
  trendSma20SlopeAnnualizedPct?: number | null;
  trendBreakdown20?: boolean | null;
  isInitialAllocation?: boolean;
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

export interface DynamicReplayDeploymentHorizon {
  sessionsFromStart: DynamicReplayDeploymentSession;
  date: string | null;
  netCommittedEur: number | null;
  netCommittedPctOfInitialCapital: number | null;
  investedMarketValueEur: number | null;
  investedPctOfEquity: number | null;
}

export interface DynamicReplayTimingStateCounts {
  WAIT: number;
  ENTRY_READY: number;
  ENTRY_STRONG: number;
}

export interface DynamicReplayTrendProtectionV1Counts {
  HOLD: number;
  WATCH: number;
  REDUCE: number;
  EXIT: number;
  winnerProtectionArmed: number;
  loserFailureArmed: number;
  earlierProtectionCandidates: number;
}

export interface DynamicHistoricalReplayResult {
  requestedStartDate: string;
  startDate: string;
  endDate: string;
  frequency: DynamicReplayFrequency;
  initialCapitalEur: number;
  simulationMode?: DynamicReplaySimulationMode;
  initialPortfolioSource?: DynamicReplayInitialPortfolioSource;
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
  timingStateCounts: DynamicReplayTimingStateCounts;
  trendProtectionV1Counts: DynamicReplayTrendProtectionV1Counts;
  deploymentHorizons: DynamicReplayDeploymentHorizon[];
  totalFeesEur: number;
  totalEstimatedTaxEur: number;
  totalTransferredEur: number;
  cashInterestEur: number;
  taxMethod: 'CONFIGURED_PROGRESSIVE' | 'CONSERVATIVE_MAX_RATE';
  operationalParity: 'CURRENT_IN_UNIVERSE_CHAIN' | 'HOLD_ONLY_NO_DECISIONS';
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
  initialStateFractional?: boolean;
}

interface PlannedSignal {
  signal: DynamicReplaySignal;
  assessment: StrategyConsensusAssessment | null;
  rotationPairAssetId?: string | null;
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

interface ReplayPositionHealthState {
  mfePct: number;
}

const DEFAULT_TAX_SETTINGS: SpanishTaxSettings = { priorSavingsTaxableBaseEur: 0, contextConfirmed: false };
const DEPLOYMENT_SESSIONS: readonly DynamicReplayDeploymentSession[] = [1, 5, 20, 60];

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

function buildHistoricalFullScan(input: {
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  date: string;
  minimumBars: number;
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
  const acceptedDataset: MultiAssetDataset = { ...input.dataset, assets: acceptedAssets };
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
function seedInitialPortfolio(input: {
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  startDate: string;
  initialCapitalEur: number;
  initialPortfolio?: DynamicReplayInitialPortfolio;
}): { holdings: Map<string, Holding>; cashEur: number; signals: DynamicReplaySignal[] } {
  const holdings = new Map<string, Holding>();
  if (!input.initialPortfolio) return { holdings, cashEur: input.initialCapitalEur, signals: [] };

  const normalized = input.initialPortfolio.allocations
    .map(row => ({ assetId: String(row.assetId || '').trim(), amountEur: Math.max(0, Number(row.amountEur) || 0) }))
    .filter(row => row.assetId && row.amountEur > 0);
  const cashEur = Math.max(0, Number(input.initialPortfolio.cashEur) || 0);
  const specifiedCapital = cashEur + normalized.reduce((sum, row) => sum + row.amountEur, 0);
  if (Math.abs(specifiedCapital - input.initialCapitalEur) > 0.02) {
    throw new Error(`La cartera inicial suma ${specifiedCapital.toFixed(2)} € y no coincide con el capital inicial ${input.initialCapitalEur.toFixed(2)} €.`);
  }

  const signals: DynamicReplaySignal[] = [];
  for (const row of normalized) {
    const item = catalogItem(input.catalog, row.assetId);
    if (!item) throw new Error(`La posición inicial ${row.assetId} no pertenece al universo disponible del replay.`);
    const price = closeOnOrBefore(input.dataset, row.assetId, input.startDate);
    if (!(price != null && price > 0)) throw new Error(`No hay precio REAL para iniciar ${item.ticker} en ${input.startDate}.`);
    const units = row.amountEur / price;
    const holding: Holding = {
      assetId: row.assetId,
      ticker: item.ticker,
      instrumentType: instrumentType(input.catalog, row.assetId),
      units,
      lots: [],
      initialStateFractional: true
    };
    addLot(holding, units, row.amountEur, input.startDate);
    holdings.set(row.assetId, holding);
    signals.push({
      id: `${input.startDate}_${row.assetId}_INITIAL`, signalDate: input.startDate, executionDate: input.startDate,
      assetId: row.assetId, ticker: item.ticker, action: 'BUY', targetWeight: input.initialCapitalEur > 0 ? row.amountEur / input.initialCapitalEur : 0,
      currentWeight: 0, recommendedAmountEur: row.amountEur,
      consensusScore: null, favorableVotes: null, unfavorableVotes: null, structuralDowntrend: false, buyTheDipCandidate: false,
      timingState: null, timingSetup: null, timingScore: null, suggestedInitialFraction: null,
      isInitialAllocation: true, executed: true, unitsDelta: units, notionalEur: row.amountEur, feeEur: 0,
      realizedGainEur: 0, estimatedTaxEur: 0, taxDeferredTransferEur: 0, executionPriceEur: price,
      reason: 'Posición de partida definida por el usuario. Es estado inicial del replay, no una compra decidida por Custodia.'
    });
  }
  return { holdings, cashEur, signals };
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
function historicalCashOnlyDecision(scan: AssetUniverseScanResult, capitalEur: number, riskProfile: InvestorRiskProfile, horizonYears: InvestmentHorizonYears): InvestmentDecisionResult {
  const asOfDate = scan.candidates.map(candidate => candidate.asOfDate).filter(Boolean).sort().at(-1) ?? latestDatasetDate(scan.acceptedDataset);
  const recommendedMethod: InvestmentDecisionResult['recommendedMethod'] = riskProfile === 'LOW' ? 'INVERSE_VOLATILITY' : riskProfile === 'MEDIUM' ? 'RISK_PARITY_ERC' : 'RELATIVE_MOMENTUM';
  return {
    generatedAt: `${asOfDate}T23:59:59.000Z`, asOfDate, dataAgeDays: 0, currency: 'EUR', capitalEur, riskProfile, horizonYears,
    marketRegime: 'UNKNOWN', regimeTrendPct: null, regimeVolatilityPct: null, confidence: 'MEDIUM', confidenceScore: 70,
    recommendedMethod, cashWeight: 1, cashAmountEur: capitalEur, assets: [],
    portfolioDatasetFingerprint: `HISTORICAL_CASH_ONLY:${asOfDate}`, evidence: 'REAL_ONLY',
    warnings: ['Ningún candidato histórico supera simultáneamente cash + consenso BUY.'],
    summary: 'Mantener el capital en efectivo.', methodology: ['Gate histórico REAL + cash + consenso.']
  };
}
function basisOf(holding: Holding): number { return holding.lots.reduce((sum, lot) => sum + lot.costEur, 0); }
function fundCategory(item: AssetUniverseItem): FundPosition['category'] {
  return item.category === 'GLOBAL_EQUITY' ? 'GLOBAL_EQUITY' : item.category === 'EMERGING_EQUITY' ? 'EMERGING_EQUITY' : 'OTHER';
}
function buildSimulatedPortfolio(input: {
  holdings: Map<string, Holding>;
  cashEur: number;
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  date: string;
}): { portfolio: UserPortfolioState; fundMarketValues: Record<string, number> } {
  const listed: UserPortfolioState['holdings'] = [];
  const funds: FundPosition[] = [];
  const fundMarketValues: Record<string, number> = {};
  for (const holding of input.holdings.values()) {
    const item = catalogItem(input.catalog, holding.assetId);
    if (!item) continue;
    const value = holdingValue(input.dataset, holding, input.date);
    if (holding.instrumentType === 'MUTUAL_FUND') {
      const isin = item.isin ?? item.ticker;
      funds.push({
        id: holding.assetId,
        isin,
        name: item.name,
        category: fundCategory(item),
        investedEur: basisOf(holding),
        acquisitionDate: holding.lots[0]?.acquisitionDate ?? input.date,
        currentValueEur: value,
        units: holding.units,
        transferable: true,
        broker: 'MyInvestor'
      });
      fundMarketValues[holding.assetId] = value;
    } else {
      listed.push({ ticker: item.ticker, shares: holding.units });
    }
  }
  return {
    portfolio: {
      cashEur: Math.max(0, input.cashEur), holdings: listed, funds,
      stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
      portfolioDataVersion: 2,
      updatedAt: `${input.date}T23:59:59.000Z`
    },
    fundMarketValues
  };
}
function buildHistoricalHealthMap(input: {
  holdings: Map<string, Holding>;
  scan: AssetUniverseScanResult;
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  date: string;
  cashBenchmarkAnnualPct: number;
  stateByAsset: Map<string, ReplayPositionHealthState>;
}): Record<string, PortfolioPositionHealthSnapshot> {
  const out: Record<string, PortfolioPositionHealthSnapshot> = {};
  const activeIds = new Set(input.holdings.keys());
  for (const assetId of [...input.stateByAsset.keys()]) if (!activeIds.has(assetId)) input.stateByAsset.delete(assetId);
  for (const holding of input.holdings.values()) {
    const item = catalogItem(input.catalog, holding.assetId);
    const candidate = input.scan.candidates.find(row => row.asset.assetId === holding.assetId);
    if (!item || !candidate) continue;
    const assessment = StrategyConsensusEngine.assess(input.scan, holding.assetId, input.cashBenchmarkAnnualPct);
    const cash = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: input.cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
    const price = closeOnOrBefore(input.dataset, holding.assetId, input.date);
    const currentValueEur = price == null ? null : price * holding.units;
    const basisEur = basisOf(holding);
    const currentReturnPct = currentValueEur != null && basisEur > 0 ? (currentValueEur / basisEur - 1) * 100 : null;
    const previous = input.stateByAsset.get(holding.assetId);
    const mfePct = currentReturnPct == null ? previous?.mfePct ?? 0 : Math.max(previous?.mfePct ?? 0, currentReturnPct, 0);
    input.stateByAsset.set(holding.assetId, { mfePct });
    const context: PositionHealthContext = {
      category: item.category,
      isDiversifiedCore: isDiversifiedCoreCategory(item.category),
      currentReturnPct,
      mfePct,
      givebackFromMfePctPoints: currentReturnPct == null ? null : Math.max(0, mfePct - currentReturnPct),
      deteriorationStreakSessions: assessDeteriorationStreak(input.scan, holding.assetId, input.cashBenchmarkAnnualPct),
      momentum20Pct: candidate.momentum20Pct
    };
    const classification = classifyPositionHealth(assessment, cash.excessVsCashPctPoints, context);
    const trendProtectionV1 = assessment
      ? classifyTrendProtectionV1(assessment, {
          currentReturnPct: context.currentReturnPct ?? null,
          mfePct: context.mfePct ?? null,
          givebackFromMfePctPoints: context.givebackFromMfePctPoints ?? null,
          isDiversifiedCore: context.isDiversifiedCore ?? false
        })
      : null;
    const snapshot: PortfolioPositionHealthSnapshot = {
      key: holding.instrumentType === 'MUTUAL_FUND' ? holding.assetId : item.ticker.toUpperCase(),
      label: item.name,
      tickerOrIsin: holding.instrumentType === 'MUTUAL_FUND' ? (item.isin ?? item.ticker) : item.ticker,
      action: classification.action,
      reason: classification.reason,
      source: 'UNIVERSE_SCAN',
      currency: 'EUR',
      currentUnitPrice: price,
      currentValueEur,
      consensusScore: assessment?.consensusScore ?? null,
      favorableVotes: assessment?.favorableVotes ?? null,
      unfavorableVotes: assessment?.unfavorableVotes ?? null,
      structuralDowntrend: assessment?.structuralDowntrend ?? null,
      excessVsCashPctPoints: cash.excessVsCashPctPoints,
      suggestedReductionPct: classification.suggestedReductionPct,
      category: context.category,
      isDiversifiedCore: context.isDiversifiedCore,
      currentReturnPct: context.currentReturnPct,
      mfePct: context.mfePct,
      givebackFromMfePctPoints: context.givebackFromMfePctPoints,
      deteriorationStreakSessions: context.deteriorationStreakSessions,
      momentum20Pct: context.momentum20Pct,
      trendProtectionV1
    };
    out[snapshot.key] = snapshot;
    out[snapshot.tickerOrIsin.toUpperCase()] = snapshot;
    out[holding.assetId] = snapshot;
  }
  return out;
}
function healthAuditFields(snapshot: PortfolioPositionHealthSnapshot | undefined) {
  const trend = snapshot?.trendProtectionV1;
  return {
    positionCurrentReturnPct: snapshot?.currentReturnPct ?? null,
    positionMfePct: snapshot?.mfePct ?? null,
    positionGivebackFromMfePctPoints: snapshot?.givebackFromMfePctPoints ?? null,
    positionDeteriorationStreakSessions: snapshot?.deteriorationStreakSessions ?? null,
    positionIsDiversifiedCore: snapshot?.isDiversifiedCore ?? null,
    trendProtectionV1Action: trend?.action ?? null,
    trendProtectionV1SuggestedReductionPct: trend?.suggestedReductionPct ?? null,
    trendProtectionV1WinnerProtectionArmed: trend?.winnerProtectionArmed ?? null,
    trendProtectionV1LoserFailureArmed: trend?.loserFailureArmed ?? null,
    trendProtectionV1Reason: trend?.reason ?? null
  };
}
function trendAuditFields(assessment: StrategyConsensusAssessment | null) {
  const trend = assessment?.trendStructure;
  return {
    trendStructureState: trend?.state ?? null,
    trendSlope20AnnualizedPct: trend?.regressionSlope20AnnualizedPct ?? null,
    trendSlope60AnnualizedPct: trend?.regressionSlope60AnnualizedPct ?? null,
    trendSlopeAccelerationPctPoints: trend?.slopeAcceleration20vs60PctPoints ?? null,
    trendSma20SlopeAnnualizedPct: trend?.sma20Slope20AnnualizedPct ?? null,
    trendBreakdown20: trend?.breakdown20 ?? null
  };
}
function findHoldingForPosition(position: PortfolioPositionDecision, holdings: Map<string, Holding>, catalog: AssetUniverseItem[]): Holding | null {
  for (const holding of holdings.values()) {
    const item = catalogItem(catalog, holding.assetId);
    if (!item) continue;
    if (position.id === holding.assetId || position.id.toUpperCase() === item.ticker.toUpperCase() || position.id.toUpperCase() === (item.isin ?? '').toUpperCase()) return holding;
  }
  return null;
}
function orderEconomicallyExecutable(notionalEur: number, totalCapitalEur: number): boolean {
  if (!(notionalEur > 0)) return false;
  const policy = executionPolicyForCapital(totalCapitalEur);
  if (notionalEur < policy.minimumOrderNotionalEur - 1e-9) return false;
  const fee = brokerCommission(notionalEur);
  return fee / notionalEur * 100 <= policy.maximumOrderFeeDragPct + 1e-9;
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
  for (const asset of input.dataset.assets) barsByAssetDate.set(asset.assetId, new Map(asset.bars.map(bar => [isoDate(bar.timestamp), bar.close])));
  const lastPrice = new Map<string, number>();
  const holdings = new Map<string, number>();
  const signalsByDate = new Map<string, DynamicReplaySignal[]>();
  for (const signal of input.signals.filter(signal => signal.executed && signal.executionDate)) {
    const date = signal.executionDate!;
    signalsByDate.set(date, [...(signalsByDate.get(date) ?? []), signal]);
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
      if (signal.unitsDelta < 0) cashEur += Math.max(0, signal.notionalEur - signal.feeEur - signal.estimatedTaxEur);
      else if (signal.unitsDelta > 0) cashEur = Math.max(0, cashEur - signal.notionalEur - signal.feeEur);
      const units = Math.max(0, (holdings.get(signal.assetId) ?? 0) + signal.unitsDelta);
      if (units <= 1e-12) holdings.delete(signal.assetId); else holdings.set(signal.assetId, units);
    }
    let investedEur = 0;
    for (const [assetId, units] of holdings) investedEur += units * (lastPrice.get(assetId) ?? 0);
    const cashBenchmarkEur = date <= input.startDate ? input.initialCapitalEur : allCashBenchmark(input.initialCapitalEur, input.cashBenchmarkAnnualPct, input.startDate, date).finalEur;
    path.push({ date, equityEur: cashEur + investedEur, cashEur, investedEur, cashBenchmarkEur, regime, method });
  }
  return path;
}
function buildDeploymentHorizons(input: {
  path: DynamicReplayEquityPoint[];
  signals: DynamicReplaySignal[];
  initialCapitalEur: number;
}): DynamicReplayDeploymentHorizon[] {
  return DEPLOYMENT_SESSIONS.map(sessionsFromStart => {
    const point = input.path[sessionsFromStart] ?? null;
    if (!point) {
      return {
        sessionsFromStart,
        date: null,
        netCommittedEur: null,
        netCommittedPctOfInitialCapital: null,
        investedMarketValueEur: null,
        investedPctOfEquity: null
      };
    }
    let netCommittedEur = 0;
    for (const signal of input.signals) {
      if (!signal.executed || !signal.executionDate || signal.executionDate > point.date) continue;
      if (signal.unitsDelta > 0) netCommittedEur += signal.notionalEur + signal.feeEur;
      else if (signal.unitsDelta < 0) netCommittedEur -= Math.max(0, signal.notionalEur - signal.feeEur - signal.estimatedTaxEur);
    }
    netCommittedEur = Math.max(0, netCommittedEur);
    return {
      sessionsFromStart,
      date: point.date,
      netCommittedEur,
      netCommittedPctOfInitialCapital: input.initialCapitalEur > 0 ? netCommittedEur / input.initialCapitalEur * 100 : null,
      investedMarketValueEur: point.investedEur,
      investedPctOfEquity: point.equityEur > 0 ? point.investedEur / point.equityEur * 100 : null
    };
  });
}
function timingCounts(signals: DynamicReplaySignal[]): DynamicReplayTimingStateCounts {
  const counts: DynamicReplayTimingStateCounts = { WAIT: 0, ENTRY_READY: 0, ENTRY_STRONG: 0 };
  for (const signal of signals) if (!signal.isInitialAllocation && signal.timingState) counts[signal.timingState] += 1;
  return counts;
}
function trendProtectionCounts(signals: DynamicReplaySignal[]): DynamicReplayTrendProtectionV1Counts {
  const counts: DynamicReplayTrendProtectionV1Counts = {
    HOLD: 0,
    WATCH: 0,
    REDUCE: 0,
    EXIT: 0,
    winnerProtectionArmed: 0,
    loserFailureArmed: 0,
    earlierProtectionCandidates: 0
  };
  for (const signal of signals) {
    if (signal.isInitialAllocation) continue;
    const action = signal.trendProtectionV1Action;
    if (action) counts[action] += 1;
    if (signal.trendProtectionV1WinnerProtectionArmed) counts.winnerProtectionArmed += 1;
    if (signal.trendProtectionV1LoserFailureArmed) counts.loserFailureArmed += 1;
    if ((action === 'REDUCE' || action === 'EXIT') && signal.action !== 'REDUCE' && signal.action !== 'EXIT') counts.earlierProtectionCandidates += 1;
  }
  return counts;
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
    simulationMode?: DynamicReplaySimulationMode;
    initialPortfolio?: DynamicReplayInitialPortfolio;
  }): DynamicHistoricalReplayResult {
    if (!(input.initialCapitalEur > 0)) throw new Error('El capital del replay dinámico debe ser > 0.');
    const frequency = input.frequency ?? 'MONTHLY';
    const minimumBars = input.minimumBars ?? 252;
    const simulationMode = input.simulationMode ?? 'CUSTODIA_ENGINE';
    const initialPortfolioSource: DynamicReplayInitialPortfolioSource = input.initialPortfolio?.source ?? 'ZERO';
    const cashBenchmarkAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    const taxSettings = input.taxSettings ?? DEFAULT_TAX_SETTINGS;
    const endDate = latestDatasetDate(input.dataset);
    if (input.startDate >= endDate) throw new Error('La fecha inicial debe ser anterior al último dato REAL.');

    const seeded = seedInitialPortfolio({ dataset: input.dataset, catalog: input.catalog, startDate: input.startDate, initialCapitalEur: input.initialCapitalEur, initialPortfolio: input.initialPortfolio });
    const holdings = seeded.holdings;
    const positionHealthStateByAsset = new Map<string, ReplayPositionHealthState>();
    const signals: DynamicReplaySignal[] = [...seeded.signals];
    const events: DynamicReplayEvent[] = [];
    const decisionStates: DecisionState[] = [];
    const positiveGainByYear = new Map<string, number>();
    let cashEur = seeded.cashEur;
    let cashInterestEur = 0;
    let totalFeesEur = 0;
    let totalEstimatedTaxEur = 0;
    let totalTransferredEur = 0;
    let lastCashDate: string | null = null;
    let firstDecisionDate: string | null = null;
    let lastDecisionDate: string | null = null;
    let decisions = 0;

    if (simulationMode === 'HOLD_ONLY') {
      firstDecisionDate = input.startDate;
      lastCashDate = input.startDate;
      if (endDate > input.startDate) {
        const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, input.startDate, endDate);
        cashEur = accrued.cashEur;
        cashInterestEur = accrued.interestEur;
      }
      decisionStates.push({ date: input.startDate, regime: 'HOLD_ONLY', method: 'SIN_MOTOR' });
      const finalPortfolio = portfolioValue(input.dataset, holdings, cashEur, endDate);
      const finalValueEur = finalPortfolio.equityEur;
      const totalReturnPct = (finalValueEur / input.initialCapitalEur - 1) * 100;
      const allCash = allCashBenchmark(input.initialCapitalEur, cashBenchmarkAnnualPct, input.startDate, endDate);
      const equityPath = buildDailyEquityPath({ dataset: input.dataset, signals, initialCapitalEur: input.initialCapitalEur, cashBenchmarkAnnualPct, startDate: input.startDate, endDate, decisionStates });
      const deploymentHorizons = buildDeploymentHorizons({ path: equityPath, signals, initialCapitalEur: input.initialCapitalEur });
      return {
        requestedStartDate: input.startDate,
        startDate: input.startDate,
        endDate,
        frequency,
        initialCapitalEur: input.initialCapitalEur,
        simulationMode,
        initialPortfolioSource,
        finalValueEur,
        totalReturnPct,
        staticBuyHoldFinalEur: finalValueEur,
        staticBuyHoldReturnPct: totalReturnPct,
        allCashFinalEur: allCash.finalEur,
        allCashReturnPct: allCash.returnPct,
        excessFinalEurVsStatic: 0,
        excessReturnVsStaticPctPoints: 0,
        excessFinalEurVsCash: finalValueEur - allCash.finalEur,
        excessReturnVsCashPctPoints: totalReturnPct - allCash.returnPct,
        decisionPathMaxDrawdownPct: pathMaxDrawdown(equityPath),
        decisions: 0,
        materialSignals: 0,
        executedBuys: 0,
        executedAdds: 0,
        executedReductions: 0,
        executedExits: 0,
        timingStateCounts: { WAIT: 0, ENTRY_READY: 0, ENTRY_STRONG: 0 },
        trendProtectionV1Counts: { HOLD: 0, WATCH: 0, REDUCE: 0, EXIT: 0, winnerProtectionArmed: 0, loserFailureArmed: 0, earlierProtectionCandidates: 0 },
        deploymentHorizons,
        totalFeesEur: 0,
        totalEstimatedTaxEur: 0,
        totalTransferredEur: 0,
        cashInterestEur,
        taxMethod: taxSettings.contextConfirmed ? 'CONFIGURED_PROGRESSIVE' : 'CONSERVATIVE_MAX_RATE',
        operationalParity: 'HOLD_ONLY_NO_DECISIONS',
        signals,
        events,
        equityPath,
        notes: [
          'Modo MANTENER CARTERA: las posiciones iniciales se valoran a lo largo del periodo sin BUY/ADD/WATCH/REDUCE/EXIT/ROTATE del motor.',
          'El efectivo no invertido conserva exactamente la misma remuneración histórica/configurada y fiscalidad del cash que el replay normal.',
          'Las posiciones iniciales son estado de partida definido por el usuario; no son recomendaciones ni decisiones de Custodia.',
          'Toda la valoración usa únicamente precios REAL disponibles en el dataset del replay.'
        ]
      };
    }

    for (const requestedDate of requestedDecisionDates(input.dataset, input.startDate, endDate, frequency)) {
      const fullScan = buildHistoricalFullScan({ dataset: input.dataset, catalog: input.catalog, date: requestedDate, minimumBars });
      if (fullScan.accepted < 1) continue;
      const decisionDate = requestedDate;
      if (decisionDate >= endDate || decisionDate === lastDecisionDate) continue;
      if (lastDecisionDate && decisionDate < lastDecisionDate) continue;

      if (!firstDecisionDate) { firstDecisionDate = decisionDate; lastCashDate = decisionDate; }
      else if (lastCashDate && decisionDate > lastCashDate) {
        const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, decisionDate);
        cashEur = accrued.cashEur; cashInterestEur += accrued.interestEur; lastCashDate = decisionDate;
      }

      const current = portfolioValue(input.dataset, holdings, cashEur, decisionDate);
      const dateScan = buildHistoricalFullScan({ dataset: input.dataset, catalog: input.catalog, date: decisionDate, minimumBars });
      const dateGate = PortfolioCandidateGate.apply(dateScan, cashBenchmarkAnnualPct, 12);
      const gateEntryByAsset = new Map(dateGate.entries.map(entry => [entry.assetId, entry]));
      const liveDecision = dateGate.scan.selected.length > 0
        ? InvestmentDecisionEngine.decide(dateGate.scan.dataset, { capitalEur: Math.max(1, current.equityEur), riskProfile: input.riskProfile, horizonYears: input.horizonYears }, new Date(`${decisionDate}T23:59:59Z`))
        : historicalCashOnlyDecision(dateScan, Math.max(1, current.equityEur), input.riskProfile, input.horizonYears);
      decisionStates.push({ date: decisionDate, regime: liveDecision.marketRegime, method: liveDecision.recommendedMethod });

      const simulated = buildSimulatedPortfolio({ holdings, cashEur, dataset: input.dataset, catalog: input.catalog, date: decisionDate });
      const healthMap = buildHistoricalHealthMap({ holdings, scan: dateGate.scan, dataset: input.dataset, catalog: input.catalog, date: decisionDate, cashBenchmarkAnnualPct, stateByAsset: positionHealthStateByAsset });
      const portfolioDecision = PortfolioDecisionEngine.evaluate({
        portfolio: simulated.portfolio,
        scan: dateGate.scan,
        decision: liveDecision,
        fundMarketValues: simulated.fundMarketValues,
        positionHealth: healthMap,
        cashBenchmarkAnnualPct
      });

      const plannedByAsset = new Map<string, PlannedSignal>();
      const rotationIncumbentByChallenger = new Map<string, string>();
      for (const position of portfolioDecision.existingPositions) {
        if (position.assetId && position.rotationChallengerAssetId) rotationIncumbentByChallenger.set(position.rotationChallengerAssetId, position.assetId);
      }
      const ensureAssessment = (assetId: string) => StrategyConsensusEngine.assess(dateGate.scan, assetId, cashBenchmarkAnnualPct);
      for (const contribution of portfolioDecision.contributions) {
        const item = catalogItem(input.catalog, contribution.assetId);
        if (!item) continue;
        const holding = holdings.get(contribution.assetId);
        const heldValue = holding ? holdingValue(input.dataset, holding, decisionDate) : 0;
        const currentWeight = current.equityEur > 0 ? heldValue / current.equityEur : 0;
        const targetValue = contribution.targetAssetValueEur ?? heldValue + contribution.amountEur;
        const assessment = ensureAssessment(contribution.assetId);
        const gateEntry = gateEntryByAsset.get(contribution.assetId);
        const health = holding ? healthMap[contribution.assetId] : undefined;
        plannedByAsset.set(contribution.assetId, {
          assessment,
          rotationPairAssetId: rotationIncumbentByChallenger.get(contribution.assetId) ?? null,
          signal: {
            id: `${decisionDate}_${contribution.assetId}_${holding ? 'ADD' : 'BUY'}`,
            signalDate: decisionDate,
            executionDate: null,
            assetId: contribution.assetId,
            ticker: contribution.ticker,
            action: holding ? 'ADD' : 'BUY',
            targetWeight: current.equityEur > 0 ? clamp(targetValue / current.equityEur, 0, 1) : 0,
            currentWeight,
            recommendedAmountEur: contribution.amountEur,
            consensusScore: assessment?.consensusScore ?? null,
            favorableVotes: assessment?.favorableVotes ?? null,
            unfavorableVotes: assessment?.unfavorableVotes ?? null,
            structuralDowntrend: assessment?.structuralDowntrend ?? false,
            buyTheDipCandidate: assessment?.buyTheDipCandidate ?? false,
            timingState: gateEntry?.timingState ?? contribution.timingState ?? null,
            timingSetup: gateEntry?.timingSetup ?? null,
            timingScore: gateEntry?.timingScore ?? null,
            suggestedInitialFraction: gateEntry?.suggestedInitialFraction ?? contribution.suggestedInitialFraction ?? null,
            ...healthAuditFields(health),
            ...trendAuditFields(assessment),
            executed: false, unitsDelta: 0, notionalEur: 0, feeEur: 0, realizedGainEur: 0, estimatedTaxEur: 0, taxDeferredTransferEur: 0, executionPriceEur: null,
            reason: contribution.reason
          }
        });
      }

      for (const position of portfolioDecision.existingPositions.filter(position => position.action === 'REDUCE' || position.action === 'EXIT')) {
        const holding = findHoldingForPosition(position, holdings, input.catalog);
        if (!holding) continue;
        const item = catalogItem(input.catalog, holding.assetId);
        if (!item) continue;
        const assessment = ensureAssessment(holding.assetId);
        const heldValue = holdingValue(input.dataset, holding, decisionDate);
        const currentWeight = current.equityEur > 0 ? heldValue / current.equityEur : 0;
        const reductionPct = position.action === 'EXIT' ? 100 : Math.max(0, Math.min(100, position.suggestedReductionPct ?? 50));
        const recommendedAmount = heldValue * reductionPct / 100;
        plannedByAsset.set(holding.assetId, {
          assessment,
          rotationPairAssetId: position.rotationChallengerAssetId ?? null,
          signal: {
            id: `${decisionDate}_${holding.assetId}_${position.action}`,
            signalDate: decisionDate, executionDate: null, assetId: holding.assetId, ticker: item.ticker,
            action: position.action as 'REDUCE' | 'EXIT', targetWeight: position.action === 'EXIT' ? 0 : currentWeight * (1 - reductionPct / 100), currentWeight,
            recommendedAmountEur: recommendedAmount,
            consensusScore: assessment?.consensusScore ?? null, favorableVotes: assessment?.favorableVotes ?? null, unfavorableVotes: assessment?.unfavorableVotes ?? null,
            structuralDowntrend: assessment?.structuralDowntrend ?? false, buyTheDipCandidate: assessment?.buyTheDipCandidate ?? false,
            timingState: null, timingSetup: null, timingScore: null, suggestedInitialFraction: null,
            ...healthAuditFields(healthMap[holding.assetId]),
            ...trendAuditFields(assessment),
            executed: false, unitsDelta: 0, notionalEur: 0, feeEur: 0, realizedGainEur: 0, estimatedTaxEur: 0, taxDeferredTransferEur: 0, executionPriceEur: null,
            reason: position.reason
          }
        });
      }

      const timingTraceIds = dateGate.entries.filter(entry => entry.timingState != null).map(entry => entry.assetId);
      const traceIds = new Set<string>([
        ...timingTraceIds,
        ...dateGate.scan.selected.slice(0, 5).map(candidate => candidate.asset.assetId),
        ...holdings.keys()
      ]);
      for (const assetId of traceIds) {
        if (plannedByAsset.has(assetId)) continue;
        const item = catalogItem(input.catalog, assetId);
        if (!item) continue;
        const assessment = ensureAssessment(assetId);
        const holding = holdings.get(assetId);
        const gateEntry = gateEntryByAsset.get(assetId);
        const health = holding ? healthMap[assetId] : undefined;
        const heldValue = holding ? holdingValue(input.dataset, holding, decisionDate) : 0;
        const currentWeight = current.equityEur > 0 ? heldValue / current.equityEur : 0;
        const traceAction: DynamicReplaySignalAction = holding ? (health?.action === 'WATCH' ? 'WATCH' : 'HOLD') : 'AVOID';
        const traceReason = holding
          ? health?.reason ?? 'La cadena operativa actual no exige mover esta posición en esta fecha.'
          : gateEntry?.timingState === 'WAIT'
            ? `Entrada no financiada: Entry Timing = WAIT (${gateEntry.timingSetup ?? 'NONE'}, score ${gateEntry.timingScore ?? 'N/D'}).`
            : 'Candidato sin una compra financiada por la cadena operativa actual en esta fecha.';
        plannedByAsset.set(assetId, {
          assessment,
          rotationPairAssetId: null,
          signal: {
            id: `${decisionDate}_${assetId}_${traceAction}`,
            signalDate: decisionDate, executionDate: null, assetId, ticker: item.ticker,
            action: traceAction, targetWeight: currentWeight, currentWeight, recommendedAmountEur: 0,
            consensusScore: assessment?.consensusScore ?? gateEntry?.consensusScore ?? null,
            favorableVotes: assessment?.favorableVotes ?? gateEntry?.favorableVotes ?? null,
            unfavorableVotes: assessment?.unfavorableVotes ?? gateEntry?.unfavorableVotes ?? null,
            structuralDowntrend: assessment?.structuralDowntrend ?? false,
            buyTheDipCandidate: assessment?.buyTheDipCandidate ?? false,
            timingState: gateEntry?.timingState ?? null,
            timingSetup: gateEntry?.timingSetup ?? null,
            timingScore: gateEntry?.timingScore ?? null,
            suggestedInitialFraction: gateEntry?.suggestedInitialFraction ?? null,
            ...healthAuditFields(health),
            ...trendAuditFields(assessment),
            executed: false, unitsDelta: 0, notionalEur: 0, feeEur: 0, realizedGainEur: 0, estimatedTaxEur: 0, taxDeferredTransferEur: 0, executionPriceEur: null,
            reason: traceReason
          }
        });
      }

      const planned = [...plannedByAsset.values()];
      const tradePlans = planned.filter(plan => ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(plan.signal.action));
      const nextDates = tradePlans.map(plan => nextBarAfter(input.dataset, plan.signal.assetId, decisionDate)).filter(Boolean).map(bar => isoDate(bar!.timestamp));
      const commonExecutionDate = nextDates.length === tradePlans.length && nextDates.length ? [...nextDates].sort().at(-1)! : null;

      if (commonExecutionDate && lastCashDate && commonExecutionDate > lastCashDate) {
        const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, commonExecutionDate);
        cashEur = accrued.cashEur; cashInterestEur += accrued.interestEur; lastCashDate = commonExecutionDate;
      }

      if (commonExecutionDate) {
        const blockedRotationSellIds = new Set<string>();
        const blockedRotationBuyIds = new Set<string>();
        const rotationSales = tradePlans.filter(plan => (plan.signal.action === 'REDUCE' || plan.signal.action === 'EXIT') && plan.rotationPairAssetId);
        for (const salePlan of rotationSales) {
          const challengerAssetId = salePlan.rotationPairAssetId!;
          const challengerPlan = tradePlans.find(plan =>
            (plan.signal.action === 'BUY' || plan.signal.action === 'ADD')
            && plan.signal.assetId === challengerAssetId
            && plan.rotationPairAssetId === salePlan.signal.assetId
          );
          let executablePair = Boolean(challengerPlan);
          const saleHolding = holdings.get(salePlan.signal.assetId);
          const saleBar = executionBarOnOrAfter(input.dataset, salePlan.signal.assetId, commonExecutionDate);
          if (!saleHolding || !saleBar || !(saleBar.open > 0)) executablePair = false;

          let availableAfterSale = cashEur;
          if (executablePair && saleHolding && saleBar) {
            let unitsToSell = salePlan.signal.action === 'EXIT'
              ? saleHolding.units
              : Math.min(saleHolding.units, salePlan.signal.recommendedAmountEur / saleBar.open);
            if (saleHolding.instrumentType === 'ETF_ETC' && !saleHolding.initialStateFractional) unitsToSell = Math.floor(unitsToSell + 1e-9);
            if (!(unitsToSell > 1e-12)) executablePair = false;
            else {
              const gross = unitsToSell * saleBar.open;
              const fee = saleHolding.instrumentType === 'ETF_ETC' ? brokerCommission(gross) : 0;
              if (saleHolding.instrumentType === 'ETF_ETC' && !orderEconomicallyExecutable(gross, current.equityEur)) executablePair = false;
              const basisPreview = saleHolding.units > 0 ? basisOf(saleHolding) * (unitsToSell / saleHolding.units) : 0;
              const conservativeTaxReserve = Math.max(0, gross - fee - basisPreview) * 0.30;
              availableAfterSale += Math.max(0, gross - fee - conservativeTaxReserve);
            }
          }

          if (executablePair && challengerPlan) {
            const buyBar = executionBarOnOrAfter(input.dataset, challengerPlan.signal.assetId, commonExecutionDate);
            const type = instrumentType(input.catalog, challengerPlan.signal.assetId);
            if (!buyBar || !(buyBar.open > 0)) executablePair = false;
            else if (type === 'MUTUAL_FUND') {
              const desiredSpend = Math.min(challengerPlan.signal.recommendedAmountEur, availableAfterSale);
              executablePair = desiredSpend > 1e-9;
            } else {
              const desiredSpend = Math.min(challengerPlan.signal.recommendedAmountEur, availableAfterSale);
              let unitsToBuy = Math.floor(desiredSpend / buyBar.open + 1e-9);
              let fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * buyBar.open) : 0;
              while (unitsToBuy > 0 && unitsToBuy * buyBar.open + fee > availableAfterSale + 1e-9) {
                unitsToBuy--;
                fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * buyBar.open) : 0;
              }
              executablePair = unitsToBuy > 0 && orderEconomicallyExecutable(unitsToBuy * buyBar.open, current.equityEur);
            }
          }

          if (!executablePair) {
            blockedRotationSellIds.add(salePlan.signal.assetId);
            blockedRotationBuyIds.add(challengerAssetId);
            const auditSuffix = ' Ejecución bloqueada: la rotación 1:1 es atómica y el challenger no era realmente ejecutable en la misma fecha; se conserva el incumbent y no se abre la plaza.';
            salePlan.signal.reason += auditSuffix;
            if (challengerPlan) challengerPlan.signal.reason += auditSuffix;
          }
        }

        const executedSales: ExecutedSale[] = [];
        for (const plan of tradePlans.filter(plan => plan.signal.action === 'REDUCE' || plan.signal.action === 'EXIT')) {
          if (blockedRotationSellIds.has(plan.signal.assetId)) continue;
          const holding = holdings.get(plan.signal.assetId);
          const bar = executionBarOnOrAfter(input.dataset, plan.signal.assetId, commonExecutionDate);
          if (!holding || !bar || !(bar.open > 0)) continue;
          const price = bar.open;
          let unitsToSell = plan.signal.action === 'EXIT' ? holding.units : Math.min(holding.units, plan.signal.recommendedAmountEur / price);
          if (holding.instrumentType === 'ETF_ETC' && !holding.initialStateFractional) unitsToSell = Math.floor(unitsToSell + 1e-9);
          if (!(unitsToSell > 1e-12)) continue;
          const gross = unitsToSell * price;
          const fee = holding.instrumentType === 'ETF_ETC' ? brokerCommission(gross) : 0;
          if (holding.instrumentType === 'ETF_ETC' && !orderEconomicallyExecutable(gross, current.equityEur)) continue;
          const basis = consumeLots(holding, unitsToSell);
          const realizedGain = gross - fee - basis;
          cashEur += Math.max(0, gross - fee);
          holding.units = Math.max(0, holding.units - unitsToSell);
          if (holding.units <= 1e-12) {
            holdings.delete(holding.assetId);
            positionHealthStateByAsset.delete(holding.assetId);
          } else if (plan.signal.action === 'REDUCE') {
            positionHealthStateByAsset.delete(holding.assetId);
          }
          totalFeesEur += fee;
          Object.assign(plan.signal, { executed: true, executionDate: isoDate(bar.timestamp), unitsDelta: -unitsToSell, notionalEur: gross, feeEur: fee, realizedGainEur: realizedGain, executionPriceEur: price });
          executedSales.push({ plan, holdingType: holding.instrumentType, grossEur: gross, feeEur: fee, costBasisEur: basis, realizedGainEur: realizedGain, transferPlannedEur: 0, transferRemainingEur: 0 });
        }

        const buyPlans = tradePlans.filter(plan => plan.signal.action === 'BUY' || plan.signal.action === 'ADD').sort((a, b) => {
          const rotationRank = Number(Boolean(b.rotationPairAssetId)) - Number(Boolean(a.rotationPairAssetId));
          if (rotationRank) return rotationRank;
          const typeA = instrumentType(input.catalog, a.signal.assetId), typeB = instrumentType(input.catalog, b.signal.assetId);
          if (typeA !== typeB) return typeA === 'MUTUAL_FUND' ? -1 : 1;
          return b.signal.recommendedAmountEur - a.signal.recommendedAmountEur;
        });
        const fundSales = executedSales.filter(sale => sale.holdingType === 'MUTUAL_FUND');
        const desiredFundBuyEur = buyPlans.filter(plan => !blockedRotationBuyIds.has(plan.signal.assetId) && instrumentType(input.catalog, plan.signal.assetId) === 'MUTUAL_FUND').reduce((sum, plan) => sum + plan.signal.recommendedAmountEur, 0);
        let remainingTransferPotential = Math.min(fundSales.reduce((sum, sale) => sum + sale.grossEur, 0), desiredFundBuyEur);
        for (const sale of fundSales) {
          const paired = Math.min(sale.grossEur, remainingTransferPotential);
          sale.transferPlannedEur = paired; sale.transferRemainingEur = paired; sale.plan.signal.taxDeferredTransferEur = paired; remainingTransferPotential -= paired;
        }

        for (const sale of executedSales) {
          const taxableFraction = sale.holdingType === 'MUTUAL_FUND' && sale.grossEur > 0 ? Math.max(0, (sale.grossEur - sale.transferPlannedEur) / sale.grossEur) : 1;
          const taxableGain = Math.max(0, sale.realizedGainEur) * taxableFraction;
          const tax = taxForPositiveGain(taxableGain, commonExecutionDate, taxSettings, positiveGainByYear);
          sale.plan.signal.estimatedTaxEur = tax;
          cashEur = Math.max(0, cashEur - tax); totalEstimatedTaxEur += tax;
          const signal = sale.plan.signal;
          events.push({ id: `event_${signal.id}`, date: commonExecutionDate, type: signal.action as 'REDUCE' | 'EXIT', ticker: signal.ticker, amountEur: sale.grossEur, feeEur: sale.feeEur, taxEur: tax, realizedGainEur: sale.realizedGainEur, label: `${signal.action === 'EXIT' ? 'SALIR' : 'REDUCIR'} ${signal.ticker}`, detail: `${sale.grossEur.toFixed(2)} € vendidos · comisión ${sale.feeEur.toFixed(2)} € · plusvalía realizada ${sale.realizedGainEur.toFixed(2)} € · reserva fiscal ${tax.toFixed(2)} €${sale.transferPlannedEur > 0 ? ` · ${sale.transferPlannedEur.toFixed(2)} € preparados para traspaso` : ''}.` });
        }

        for (const plan of buyPlans) {
          if (blockedRotationBuyIds.has(plan.signal.assetId)) continue;
          const bar = executionBarOnOrAfter(input.dataset, plan.signal.assetId, commonExecutionDate);
          if (!bar || !(bar.open > 0) || cashEur <= 0) continue;
          const type = instrumentType(input.catalog, plan.signal.assetId);
          const existing = holdings.get(plan.signal.assetId);
          const price = bar.open;
          const desiredSpend = Math.min(plan.signal.recommendedAmountEur, cashEur);
          let unitsToBuy = 0, fee = 0, spend = 0;
          if (type === 'MUTUAL_FUND') {
            spend = desiredSpend; unitsToBuy = spend / price;
          } else {
            unitsToBuy = Math.floor(desiredSpend / price + 1e-9);
            fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * price) : 0;
            while (unitsToBuy > 0 && unitsToBuy * price + fee > cashEur + 1e-9) { unitsToBuy--; fee = unitsToBuy > 0 ? brokerCommission(unitsToBuy * price) : 0; }
            spend = unitsToBuy * price + fee;
            if (unitsToBuy > 0 && !orderEconomicallyExecutable(unitsToBuy * price, current.equityEur)) { unitsToBuy = 0; spend = 0; fee = 0; }
          }
          if (!(unitsToBuy > 1e-12) || spend > cashEur + 1e-9) continue;
          cashEur = Math.max(0, cashEur - spend);
          const nextHolding: Holding = existing ?? { assetId: plan.signal.assetId, ticker: plan.signal.ticker, instrumentType: type, units: 0, lots: [] };
          nextHolding.units += unitsToBuy; addLot(nextHolding, unitsToBuy, spend, commonExecutionDate); holdings.set(nextHolding.assetId, nextHolding);
          if (plan.signal.action === 'ADD') positionHealthStateByAsset.delete(plan.signal.assetId);
          totalFeesEur += fee;
          Object.assign(plan.signal, { executed: true, executionDate: isoDate(bar.timestamp), unitsDelta: unitsToBuy, notionalEur: unitsToBuy * price, feeEur: fee, executionPriceEur: price });

          if (type === 'MUTUAL_FUND') {
            let transferNeed = plan.signal.notionalEur;
            for (const sale of fundSales) {
              if (transferNeed <= 1e-9) break;
              const amount = Math.min(transferNeed, sale.transferRemainingEur);
              if (amount <= 1e-9) continue;
              sale.transferRemainingEur -= amount; transferNeed -= amount; plan.signal.taxDeferredTransferEur += amount; totalTransferredEur += amount;
              events.push({ id: `transfer_${sale.plan.signal.id}_${plan.signal.id}_${events.length}`, date: commonExecutionDate, type: 'TRANSFER', sourceTicker: sale.plan.signal.ticker, targetTicker: plan.signal.ticker, amountEur: amount, feeEur: 0, taxEur: 0, realizedGainEur: 0, label: `TRASPASO ${sale.plan.signal.ticker} → ${plan.signal.ticker}`, detail: `${amount.toFixed(2)} € tratados como traspaso fondo→fondo fiscalmente diferido; impuesto inmediato estimado 0 € para esa parte.` });
            }
          }
          events.push({ id: `event_${plan.signal.id}`, date: commonExecutionDate, type: plan.signal.action as 'BUY' | 'ADD', ticker: plan.signal.ticker, amountEur: plan.signal.notionalEur, feeEur: fee, taxEur: 0, realizedGainEur: 0, label: `${plan.signal.action === 'BUY' ? 'COMPRAR' : 'AÑADIR'} ${plan.signal.ticker}`, detail: `${plan.signal.notionalEur.toFixed(2)} € invertidos · comisión ${fee.toFixed(2)} €${plan.signal.taxDeferredTransferEur > 0 ? ` · ${plan.signal.taxDeferredTransferEur.toFixed(2)} € procedentes de traspaso fiscalmente diferido` : ''}.` });
        }
      }

      signals.push(...planned.map(plan => plan.signal));
      lastDecisionDate = decisionDate;
      decisions++;
    }

    if (!firstDecisionDate) throw new Error('No hay una fecha con suficiente historia causal para iniciar el replay dinámico.');
    if (lastCashDate && endDate > lastCashDate) {
      const accrued = accrueRemuneratedCash(cashEur, cashBenchmarkAnnualPct, lastCashDate, endDate);
      cashEur = accrued.cashEur; cashInterestEur += accrued.interestEur;
    }
    const resultStartDate = input.initialPortfolio ? input.startDate : firstDecisionDate;
    const finalPortfolio = portfolioValue(input.dataset, holdings, cashEur, endDate);
    const finalValueEur = finalPortfolio.equityEur;
    const totalReturnPct = (finalValueEur / input.initialCapitalEur - 1) * 100;
    const allCash = allCashBenchmark(input.initialCapitalEur, cashBenchmarkAnnualPct, resultStartDate, endDate);

    let staticFinal: number | null = null;
    let staticReturn: number | null = null;
    if (input.initialPortfolio) {
      const holdStates: DecisionState[] = [{ date: input.startDate, regime: 'HOLD_ONLY', method: 'SIN_MOTOR' }];
      const holdPath = buildDailyEquityPath({ dataset: input.dataset, signals: seeded.signals, initialCapitalEur: input.initialCapitalEur, cashBenchmarkAnnualPct, startDate: input.startDate, endDate, decisionStates: holdStates });
      staticFinal = holdPath.at(-1)?.equityEur ?? null;
      staticReturn = staticFinal == null ? null : (staticFinal / input.initialCapitalEur - 1) * 100;
    } else {
      const staticResult = HistoricalDecisionReplayEngine.run({ dataset: input.dataset, catalog: input.catalog, requestedDates: [input.startDate], initialCapitalEur: input.initialCapitalEur, riskProfile: input.riskProfile, horizonYears: input.horizonYears, cashBenchmarkAnnualPct, minimumBars }).cases[0] ?? null;
      staticFinal = staticResult?.finalValueEur ?? null;
      staticReturn = staticResult?.totalReturnPct ?? null;
    }

    const material = signals.filter(signal => !signal.isInitialAllocation && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action));
    const equityPath = buildDailyEquityPath({ dataset: input.dataset, signals, initialCapitalEur: input.initialCapitalEur, cashBenchmarkAnnualPct, startDate: resultStartDate, endDate, decisionStates });
    const timingStateCounts = timingCounts(signals);
    const trendProtectionV1Counts = trendProtectionCounts(signals);
    const deploymentHorizons = buildDeploymentHorizons({ path: equityPath, signals, initialCapitalEur: input.initialCapitalEur });

    return {
      requestedStartDate: input.startDate, startDate: resultStartDate, endDate, frequency, initialCapitalEur: input.initialCapitalEur,
      simulationMode, initialPortfolioSource,
      finalValueEur, totalReturnPct, staticBuyHoldFinalEur: staticFinal, staticBuyHoldReturnPct: staticReturn,
      allCashFinalEur: allCash.finalEur, allCashReturnPct: allCash.returnPct,
      excessFinalEurVsStatic: staticFinal == null ? null : finalValueEur - staticFinal,
      excessReturnVsStaticPctPoints: staticReturn == null ? null : totalReturnPct - staticReturn,
      excessFinalEurVsCash: finalValueEur - allCash.finalEur, excessReturnVsCashPctPoints: totalReturnPct - allCash.returnPct,
      decisionPathMaxDrawdownPct: pathMaxDrawdown(equityPath), decisions, materialSignals: material.length,
      executedBuys: signals.filter(signal => !signal.isInitialAllocation && signal.action === 'BUY' && signal.executed).length,
      executedAdds: signals.filter(signal => !signal.isInitialAllocation && signal.action === 'ADD' && signal.executed).length,
      executedReductions: signals.filter(signal => !signal.isInitialAllocation && signal.action === 'REDUCE' && signal.executed).length,
      executedExits: signals.filter(signal => !signal.isInitialAllocation && signal.action === 'EXIT' && signal.executed).length,
      timingStateCounts, trendProtectionV1Counts, deploymentHorizons,
      totalFeesEur, totalEstimatedTaxEur, totalTransferredEur, cashInterestEur,
      taxMethod: taxSettings.contextConfirmed ? 'CONFIGURED_PROGRESSIVE' : 'CONSERVATIVE_MAX_RATE',
      operationalParity: 'CURRENT_IN_UNIVERSE_CHAIN',
      signals, events: events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), equityPath,
      notes: [
        input.initialPortfolio
          ? `El replay parte de una cartera inicial ${initialPortfolioSource}: ${input.initialPortfolio.allocations.length} posiciones y ${input.initialPortfolio.cashEur.toFixed(2)} € de cash; esa asignación es estado inicial y no una decisión del motor.`
          : 'El replay parte de cero, exactamente como el comportamiento histórico anterior a esta ampliación.',
        'Cada fecha reconstruye la misma cadena operativa in-universe que usa la pantalla actual: universo REAL → cash+consenso → PortfolioCandidateGate → InvestmentDecisionEngine → PortfolioDecisionEngine con objetivos estables → salud individual para WATCH/REDUCE/EXIT.',
        'Cada decisión usa exclusivamente datos disponibles hasta esa fecha; nunca se eligen compras o ventas mirando el resultado futuro.',
        'La fecha operativa de señal es siempre la fecha de decisión solicitada; el asOfDate de los datos puede ser anterior sin desplazar la señal fuera de la ventana del replay.',
        'DAILY revisa cada sesión disponible; WEEKLY/MONTHLY/QUARTERLY reducen la frecuencia de decisión. La ejecución siempre ocurre después de la señal.',
        'Las señales conservan timingState, timingSetup, timingScore y suggestedInitialFraction; WAIT queda auditado como NO COMPRAR y READY/STRONG permanecen visibles aunque el candidato no reciba capital.',
        'Las posiciones existentes conservan auditoría causal de retorno, MFE, giveback, persistencia de deterioro y clasificación core/satélite. WATCH es explícito pero no operativo; REDUCE por giveback se reserva a satélites y requiere persistencia, MFE previo y momentum 20d no recuperado.',
        'TREND_PROTECTION_V1 es sólo diagnóstico en este replay: registra pendientes 20/60, aceleración, ruptura, protección de ganador y fallo de tesis, pero NO altera ninguna orden ni la trayectoria patrimonial baseline.',
        'Tras un ADD o un REDUCE ejecutado se reinicia la referencia MFE de la posición resultante para no mezclar el máximo de una exposición anterior con la nueva base/tramo restante.',
        'Una compra ejecutada cuenta contra el objetivo estable del activo en las decisiones posteriores; el replay no redistribuye desde cero el efectivo restante después de cada operación.',
        'ETFs comprados por el motor usan títulos enteros y la comisión MyInvestor modelada. Las posiciones iniciales son un estado contrafactual exacto en euros y pueden contener unidades fraccionarias para conservar el importe de partida solicitado.',
        'Las rotaciones competitivas 1:1 son atómicas en ejecución: si el challenger no puede comprarse realmente en la fecha común de ejecución, no se vende el incumbent ni se abre una plaza ficticia.',
        'La salud histórica de posiciones del universo usa la misma función pura classifyPositionHealth.',
        'Fondo→fondo se empareja como traspaso fiscalmente diferido cuando coincide en el mismo cambio. La parte no diferida soporta la reserva fiscal estimada.',
        taxSettings.contextConfirmed ? 'La fiscalidad usa la escala española del ahorro y la base previa configurada.' : 'El contexto fiscal anual no está confirmado: las plusvalías imponibles reservan conservadoramente el 30%.',
        'La trayectoria se valora en cada sesión disponible y se compara con mantener todo el capital en la cuenta remunerada.',
        'Permanece el sesgo de supervivencia del catálogo actual y no se reconstruyen cambios históricos de comercialización/disponibilidad del broker.'
      ]
    };
  }
}
