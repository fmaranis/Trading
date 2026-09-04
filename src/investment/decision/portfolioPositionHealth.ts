import type { PriceBar } from '../backtesting/types';
import { HistoricalMarketDataService } from '../data/marketData/historicalMarketDataService';
import { FundMarketDataService } from '../data/marketData/fundMarketData';
import type { AssetUniverseCategory } from './assetUniverse';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import { PortfolioExecutionHistoryService, type PortfolioExecutionHistoryEntry } from './portfolioExecutionHistory';
import { isPortfolioEquityTicker } from './portfolioDiscoveryUniverse';
import { SingleAssetResearchEngine } from './singleAssetResearch';
import { TaxLotLedgerService } from './spanishTaxModel';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';
import { classifyTrendProtectionV1, type TrendProtectionDecision } from './trendProtectionPolicy';
import type { UserPortfolioState } from './userPortfolio';

export type PortfolioPositionHealthAction = 'ADD' | 'HOLD' | 'WATCH' | 'REDUCE' | 'EXIT' | 'DATA_MISSING';

export interface PositionHealthContext {
  category?: AssetUniverseCategory | 'UNKNOWN' | null;
  isDiversifiedCore?: boolean | null;
  currentReturnPct?: number | null;
  mfePct?: number | null;
  givebackFromMfePctPoints?: number | null;
  deteriorationStreakSessions?: number | null;
  momentum20Pct?: number | null;
}

export interface PortfolioPositionHealthSnapshot {
  key: string;
  label: string;
  tickerOrIsin: string;
  action: PortfolioPositionHealthAction;
  reason: string;
  source: 'UNIVERSE_SCAN' | 'ARBITRARY_REAL_SERIES';
  currency: string | null;
  currentUnitPrice: number | null;
  currentValueEur: number | null;
  consensusScore: number | null;
  favorableVotes: number | null;
  unfavorableVotes: number | null;
  structuralDowntrend: boolean | null;
  excessVsCashPctPoints: number | null;
  suggestedReductionPct: number | null;
  category?: AssetUniverseCategory | 'UNKNOWN' | null;
  isDiversifiedCore?: boolean | null;
  currentReturnPct?: number | null;
  mfePct?: number | null;
  givebackFromMfePctPoints?: number | null;
  deteriorationStreakSessions?: number | null;
  momentum20Pct?: number | null;
  trendProtectionV1?: TrendProtectionDecision | null;
}

export interface PortfolioPositionHealthResult {
  generatedAt: string;
  byKey: Record<string, PortfolioPositionHealthSnapshot>;
  positions: PortfolioPositionHealthSnapshot[];
  warnings: string[];
}

const DIVERSIFIED_CORE_CATEGORIES = new Set<AssetUniverseCategory>([
  'GLOBAL_EQUITY',
  'US_EQUITY',
  'EUROPE_EQUITY',
  'JAPAN_EQUITY',
  'EMERGING_EQUITY',
  'GOV_BONDS',
  'CORP_BONDS',
  'AGG_BONDS',
  'MONEY_MARKET'
]);
const WATCH_MIN_DETERIORATION_SESSIONS = 3;
const REDUCE_MIN_DETERIORATION_SESSIONS = 10;
const REDUCE_MIN_MFE_PCT = 5;
const REDUCE_MIN_GIVEBACK_PP = 15;
const WATCH_MIN_GIVEBACK_PP = 8;
const WATCH_MAX_CURRENT_RETURN_PCT = -3;
// Eleven observations are enough to distinguish a fresh threshold crossing from
// longer persistent weakness in audit output. Tactical eligibility itself begins
// at session 10 and remains available until a REDUCE actually executes/rebases MFE.
const HEALTH_STREAK_LOOKBACK_SESSIONS = 11;

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function barDate(bar: PriceBar): string { return bar.timestamp.slice(0, 10); }
function twoYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 2); return isoDate(d); }
function oneYearAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 1); return isoDate(d); }
function looksLikeIsin(value: string): boolean { return /^[A-Z]{2}[A-Z0-9]{10}$/.test(value.toUpperCase()); }
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
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
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

export function isDiversifiedCoreCategory(
  category: AssetUniverseCategory | 'UNKNOWN' | null | undefined,
  tickerOrAssetId?: string | null
): boolean {
  if (tickerOrAssetId && (tickerOrAssetId.toUpperCase().startsWith('EQ_') || isPortfolioEquityTicker(tickerOrAssetId))) return false;
  return category != null && category !== 'UNKNOWN' && DIVERSIFIED_CORE_CATEGORIES.has(category);
}

export function classifyPositionHealth(
  assessment: StrategyConsensusAssessment | null,
  excessVsCashPctPoints: number | null,
  context: PositionHealthContext = {}
): Pick<PortfolioPositionHealthSnapshot, 'action' | 'reason' | 'suggestedReductionPct'> {
  if (!assessment) return { action: 'DATA_MISSING', reason: 'No hay evidencia causal suficiente para evaluar esta posición.', suggestedReductionPct: null };

  // Normalize the audit/context classification from the actual instrument identity.
  // This prevents a single stock such as EQ_FERROVIAL from inheriting broad-index
  // protection merely because both happen to use the EUROPE_EQUITY category.
  const instrumentIdentity = assessment.assetId || assessment.ticker;
  if (context.category != null && instrumentIdentity) {
    context.isDiversifiedCore = isDiversifiedCoreCategory(context.category, instrumentIdentity);
  }

  if (assessment.structuralDowntrend && assessment.unfavorableVotes >= 4 && assessment.consensusScore <= -3) {
    return {
      action: 'EXIT',
      reason: `Deterioro estructural fuerte: consenso ${assessment.consensusScore}, ${assessment.unfavorableVotes} señales adversas y tendencia larga rota. Revisar salida completa; no se vende por simple sobreponderación.`,
      suggestedReductionPct: 100
    };
  }

  const streak = Math.max(0, context.deteriorationStreakSessions ?? 0);
  const currentReturn = context.currentReturnPct;
  const mfe = context.mfePct;
  const giveback = context.givebackFromMfePctPoints;
  const momentum20 = context.momentum20Pct ?? assessment.momentum20Pct;
  const weakMultiSignal = assessment.consensusScore <= -1 && assessment.unfavorableVotes >= 2;
  const tacticalGivebackReduction = context.isDiversifiedCore === false
    && weakMultiSignal
    // First eligible session at or after 10. MFE is rebased only after an
    // actually executed ADD/REDUCE episode boundary, both in replay and live.
    && streak >= REDUCE_MIN_DETERIORATION_SESSIONS
    && mfe != null && mfe >= REDUCE_MIN_MFE_PCT
    && giveback != null && giveback >= REDUCE_MIN_GIVEBACK_PP
    && currentReturn != null && currentReturn < 0
    && momentum20 != null && momentum20 <= 0;

  if (tacticalGivebackReduction) {
    return {
      action: 'REDUCE',
      reason: `Deterioro individual persistente en posición satélite: ${streak} sesiones consecutivas con evidencia débil, MFE ${mfe!.toFixed(1)}%, retorno actual ${currentReturn!.toFixed(1)}%, devolución ${giveback!.toFixed(1)} pp y momentum 20d ${momentum20!.toFixed(1)}%. Reducir 50% en la primera sesión realmente elegible a partir de la décima; tras ejecución el motor rebasa MFE para no vender otra vez por el mismo máximo previo.`,
      suggestedReductionPct: 50
    };
  }

  if (assessment.existingPositionAction === 'REDUCE_REVIEW') {
    return {
      action: 'REDUCE',
      reason: `Deterioro estructural confirmado por ${assessment.unfavorableVotes} señales adversas. Revisar reducción parcial; la decisión procede de la salud del activo, no del peso de cartera.`,
      suggestedReductionPct: 50
    };
  }

  const materialLossOrGiveback = (currentReturn != null && currentReturn <= WATCH_MAX_CURRENT_RETURN_PCT)
    || (giveback != null && giveback >= WATCH_MIN_GIVEBACK_PP);
  if (weakMultiSignal && streak >= WATCH_MIN_DETERIORATION_SESSIONS && materialLossOrGiveback) {
    const details = [
      `${streak} sesiones consecutivas de deterioro`,
      currentReturn == null ? null : `retorno ${currentReturn.toFixed(1)}%`,
      mfe == null ? null : `MFE ${mfe.toFixed(1)}%`,
      giveback == null ? null : `giveback ${giveback.toFixed(1)} pp`,
      momentum20 == null ? null : `momentum 20d ${momentum20.toFixed(1)}%`
    ].filter(Boolean).join(' · ');
    return {
      action: 'WATCH',
      reason: `WATCH por deterioro persistente (${details}). Todavía no se reduce: WATCH es una zona intermedia y una recuperación corta debe poder devolver la posición a HOLD.`,
      suggestedReductionPct: null
    };
  }

  if (assessment.existingPositionAction === 'ADD' && (excessVsCashPctPoints ?? -Infinity) > 0) {
    return {
      action: 'ADD',
      reason: `La posición mantiene consenso favorable y supera el efectivo por ${(excessVsCashPctPoints ?? 0).toFixed(2)} pp según el proxy histórico actual.`,
      suggestedReductionPct: null
    };
  }
  if (assessment.newMoneyAction === 'AVOID' || (excessVsCashPctPoints != null && excessVsCashPctPoints <= 0)) {
    return {
      action: 'WATCH',
      reason: assessment.structuralDowntrend
        ? 'La tendencia se está deteriorando, pero todavía no alcanza el umbral multiseñal exigido para reducir.'
        : `No justifica añadir dinero ahora${excessVsCashPctPoints == null ? '' : ` frente al efectivo (${excessVsCashPctPoints.toFixed(2)} pp)`}; mantener bajo vigilancia sin vender por una sola señal débil.`,
      suggestedReductionPct: null
    };
  }
  return {
    action: 'HOLD',
    reason: 'No existe deterioro estructural suficiente para reducir y tampoco hay una señal clara de aumentar la posición.',
    suggestedReductionPct: null
  };
}

function candidateFor(scan: AssetUniverseScanResult, key: string) {
  const normalized = key.toUpperCase();
  return scan.candidates.find(c => c.asset.assetId === key || c.asset.ticker.toUpperCase() === normalized || c.asset.isin?.toUpperCase() === normalized);
}

function prefixAssessment(scan: AssetUniverseScanResult, assetId: string, endIndex: number, cashBenchmarkAnnualPct: number): StrategyConsensusAssessment | null {
  const candidate = scan.candidates.find(c => c.asset.assetId === assetId);
  const series = scan.acceptedDataset.assets.find(a => a.assetId === assetId);
  if (!candidate || !series || endIndex < 59) return null;
  const bars = series.bars.slice(0, endIndex + 1);
  const prices = bars.map(bar => bar.close).filter(price => Number.isFinite(price) && price > 0);
  if (prices.length < 60) return null;
  const prefixCandidate = {
    ...candidate,
    bars: bars.length,
    asOfDate: barDate(bars.at(-1)!),
    lastClose: prices.at(-1) ?? null,
    momentum20Pct: pctReturn(prices, 20),
    momentum60Pct: pctReturn(prices, 60),
    momentum120Pct: pctReturn(prices, 120),
    annualizedVolatilityPct: annualizedVolatility(prices, 60),
    maxDrawdownPct: maxDrawdown(prices, 252)
  };
  const prefixSeries = { ...series, bars };
  const prefixScan: AssetUniverseScanResult = {
    ...scan,
    scanned: 1,
    accepted: 1,
    rejected: 0,
    selected: [prefixCandidate],
    candidates: [prefixCandidate],
    dataset: { ...scan.acceptedDataset, assets: [prefixSeries] },
    acceptedDataset: { ...scan.acceptedDataset, assets: [prefixSeries] },
    rejectionCounts: {}
  };
  return StrategyConsensusEngine.assess(prefixScan, assetId, cashBenchmarkAnnualPct);
}

export function assessDeteriorationStreak(
  scan: AssetUniverseScanResult,
  assetId: string,
  cashBenchmarkAnnualPct: number,
  lookbackSessions = HEALTH_STREAK_LOOKBACK_SESSIONS
): number {
  const series = scan.acceptedDataset.assets.find(a => a.assetId === assetId);
  if (!series?.bars.length) return 0;
  let streak = 0;
  const lastIndex = series.bars.length - 1;
  const firstIndex = Math.max(0, lastIndex - Math.max(1, lookbackSessions) + 1);
  for (let index = lastIndex; index >= firstIndex; index--) {
    const assessment = prefixAssessment(scan, assetId, index, cashBenchmarkAnnualPct);
    if (!assessment || assessment.consensusScore > -1 || assessment.unfavorableVotes < 2) break;
    streak++;
  }
  return streak;
}

function positionPathContext(input: {
  bars: PriceBar[];
  acquisitionDate: string | null | undefined;
  investedEur: number | null | undefined;
  units: number | null | undefined;
  category: AssetUniverseCategory | 'UNKNOWN' | null | undefined;
  tickerOrAssetId?: string | null;
  deteriorationStreakSessions: number;
  momentum20Pct: number | null | undefined;
}): PositionHealthContext {
  const base: PositionHealthContext = {
    category: input.category ?? 'UNKNOWN',
    isDiversifiedCore: isDiversifiedCoreCategory(input.category, input.tickerOrAssetId),
    deteriorationStreakSessions: input.deteriorationStreakSessions,
    momentum20Pct: input.momentum20Pct ?? null,
    currentReturnPct: null,
    mfePct: null,
    givebackFromMfePctPoints: null
  };
  if (!input.acquisitionDate || !(input.investedEur != null && input.investedEur > 0) || !(input.units != null && input.units > 0)) return base;
  const heldBars = input.bars.filter(bar => barDate(bar) >= input.acquisitionDate! && Number.isFinite(bar.close) && bar.close > 0);
  if (!heldBars.length) return base;
  const returns = heldBars.map(bar => (bar.close * input.units! / input.investedEur! - 1) * 100);
  const currentReturnPct = returns.at(-1) ?? null;
  const mfePct = returns.length ? Math.max(...returns, 0) : null;
  return {
    ...base,
    currentReturnPct,
    mfePct,
    givebackFromMfePctPoints: currentReturnPct == null || mfePct == null ? null : Math.max(0, mfePct - currentReturnPct)
  };
}

function executionKeys(entry: PortfolioExecutionHistoryEntry): string[] {
  return [entry.sourceId, entry.sourceIsin, entry.targetAssetId, entry.targetTicker, entry.targetIsin]
    .map(value => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);
}

function latestEpisodeDate(
  history: PortfolioExecutionHistoryEntry[],
  keys: Array<string | null | undefined>,
  actions: PortfolioExecutionHistoryEntry['action'][]
): string | null {
  const wanted = new Set(keys.map(value => String(value ?? '').trim().toUpperCase()).filter(Boolean));
  if (!wanted.size) return null;
  return history
    .filter(entry => actions.includes(entry.action) && executionKeys(entry).some(key => wanted.has(key)))
    .map(entry => entry.appliedAt.slice(0, 10))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? null;
}

function laterDate(a: string | null | undefined, b: string | null | undefined): string | null {
  const dates = [a, b].filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))).sort();
  return dates.at(-1) ?? null;
}

function trackedListedPathContext(input: {
  scan: AssetUniverseScanResult;
  assetId: string;
  ticker: string;
  isin?: string | null;
  shares: number;
  category: AssetUniverseCategory;
  deteriorationStreakSessions: number;
  momentum20Pct: number | null | undefined;
  history: PortfolioExecutionHistoryEntry[];
}): { context: PositionHealthContext; basisComplete: boolean; trackedShares: number } {
  const series = input.scan.acceptedDataset.assets.find(asset => asset.assetId === input.assetId);
  const lots = TaxLotLedgerService.lots(input.ticker);
  const trackedShares = lots.reduce((sum, lot) => sum + Math.max(0, lot.shares), 0);
  const investedEur = lots.reduce((sum, lot) => sum + Math.max(0, lot.acquisitionCostEur), 0);
  const basisComplete = input.shares > 0 && Math.abs(trackedShares - input.shares) <= Math.max(1e-7, input.shares * 1e-7) && investedEur > 0;
  const latestLotDate = lots.map(lot => lot.acquisitionDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? null;
  const latestExecutionDate = latestEpisodeDate(input.history, [input.assetId, input.ticker, input.isin], ['BUY_ETF', 'SELL_ETF']);
  const episodeStartDate = laterDate(latestLotDate, latestExecutionDate);

  return {
    basisComplete,
    trackedShares,
    context: positionPathContext({
      bars: series?.bars ?? [],
      acquisitionDate: basisComplete ? episodeStartDate : null,
      investedEur: basisComplete ? investedEur : null,
      units: basisComplete ? input.shares : null,
      category: input.category,
      tickerOrAssetId: input.assetId,
      deteriorationStreakSessions: input.deteriorationStreakSessions,
      momentum20Pct: input.momentum20Pct
    })
  };
}

function assessmentSnapshot(input: {
  key: string;
  label: string;
  tickerOrIsin: string;
  assessment: StrategyConsensusAssessment | null;
  source: PortfolioPositionHealthSnapshot['source'];
  currency: string | null;
  currentUnitPrice: number | null;
  currentValueEur: number | null;
  momentum120Pct: number | null | undefined;
  cashBenchmarkAnnualPct: number;
  context?: PositionHealthContext;
}): PortfolioPositionHealthSnapshot {
  const cash = assessAgainstCashBenchmark({ momentum120Pct: input.momentum120Pct, benchmarkAnnualPct: input.cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
  const context = input.context ?? {};
  const classification = classifyPositionHealth(input.assessment, cash.excessVsCashPctPoints, context);
  const trendProtectionV1 = input.assessment
    ? classifyTrendProtectionV1(input.assessment, {
        currentReturnPct: context.currentReturnPct ?? null,
        mfePct: context.mfePct ?? null,
        givebackFromMfePctPoints: context.givebackFromMfePctPoints ?? null,
        isDiversifiedCore: context.isDiversifiedCore ?? false
      })
    : null;
  return {
    key: input.key,
    label: input.label,
    tickerOrIsin: input.tickerOrIsin,
    action: classification.action,
    reason: classification.reason,
    source: input.source,
    currency: input.currency,
    currentUnitPrice: input.currentUnitPrice,
    currentValueEur: input.currentValueEur,
    consensusScore: input.assessment?.consensusScore ?? null,
    favorableVotes: input.assessment?.favorableVotes ?? null,
    unfavorableVotes: input.assessment?.unfavorableVotes ?? null,
    structuralDowntrend: input.assessment?.structuralDowntrend ?? null,
    excessVsCashPctPoints: cash.excessVsCashPctPoints,
    suggestedReductionPct: classification.suggestedReductionPct,
    category: context.category ?? null,
    isDiversifiedCore: context.isDiversifiedCore ?? null,
    currentReturnPct: context.currentReturnPct ?? null,
    mfePct: context.mfePct ?? null,
    givebackFromMfePctPoints: context.givebackFromMfePctPoints ?? null,
    deteriorationStreakSessions: context.deteriorationStreakSessions ?? null,
    momentum20Pct: context.momentum20Pct ?? input.assessment?.momentum20Pct ?? null,
    trendProtectionV1
  };
}

async function arbitraryBars(symbol: string): Promise<{ bars: PriceBar[]; currency: string | null; currentPrice: number | null }> {
  const endDate = isoDate(new Date());
  if (looksLikeIsin(symbol)) {
    const fund = await FundMarketDataService.history(symbol, twoYearsAgo(), endDate);
    const bars: PriceBar[] = fund.points.map(point => ({ timestamp: `${point.date}T00:00:00.000Z`, open: point.nav, high: point.nav, low: point.nav, close: point.nav, volume: 0 }));
    return { bars, currency: fund.currency || null, currentPrice: fund.latestNav };
  }
  const response = await HistoricalMarketDataService.getHistoricalBars({ symbol, startDate: twoYearsAgo(), endDate, timeframe: '1d', adjusted: true }, { forceRefresh: false, maxRetries: 1 });
  return { bars: response.bars, currency: response.metadata.currency ?? null, currentPrice: response.bars.at(-1)?.close ?? null };
}

async function evaluateArbitrary(input: {
  key: string;
  label: string;
  symbol: string;
  unitsOrShares: number | null;
  cashBenchmarkAnnualPct: number;
}): Promise<PortfolioPositionHealthSnapshot> {
  const data = await arbitraryBars(input.symbol);
  const research = SingleAssetResearchEngine.run({ symbol: input.symbol, bars: data.bars, displayStartDate: oneYearAgo(), endDate: isoDate(new Date()), frequency: 'MONTHLY', cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct });
  const currentValueEur = data.currency === 'EUR' && data.currentPrice != null && input.unitsOrShares != null
    ? data.currentPrice * input.unitsOrShares
    : null;
  return assessmentSnapshot({
    key: input.key,
    label: input.label,
    tickerOrIsin: input.symbol,
    assessment: research.currentAssessment,
    source: 'ARBITRARY_REAL_SERIES',
    currency: data.currency,
    currentUnitPrice: data.currentPrice,
    currentValueEur,
    momentum120Pct: research.currentAssessment?.momentum120Pct,
    cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct
  });
}

export class PortfolioPositionHealthService {
  static async evaluate(portfolio: UserPortfolioState, scan: AssetUniverseScanResult, cashBenchmarkAnnualPct: number): Promise<PortfolioPositionHealthResult> {
    const positions: PortfolioPositionHealthSnapshot[] = [];
    const warnings: string[] = [];
    const executionHistory = PortfolioExecutionHistoryService.load();

    for (const holding of portfolio.holdings) {
      const candidate = candidateFor(scan, holding.ticker);
      if (candidate?.status === 'ACCEPTED') {
        const assessment = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);
        const price = candidate.lastClose ?? null;
        const deteriorationStreakSessions = assessDeteriorationStreak(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);
        const tracked = trackedListedPathContext({
          scan,
          assetId: candidate.asset.assetId,
          ticker: candidate.asset.ticker,
          isin: candidate.asset.isin,
          shares: holding.shares,
          category: candidate.asset.category,
          deteriorationStreakSessions,
          momentum20Pct: candidate.momentum20Pct,
          history: executionHistory
        });
        if (!tracked.basisComplete) {
          warnings.push(`POSITION_COST_BASIS_INCOMPLETE:${holding.ticker.toUpperCase()}:tracked=${tracked.trackedShares.toFixed(6)}:portfolio=${holding.shares.toFixed(6)}`);
        }
        positions.push(assessmentSnapshot({
          key: holding.ticker.toUpperCase(),
          label: candidate.asset.name,
          tickerOrIsin: holding.ticker.toUpperCase(),
          assessment,
          source: 'UNIVERSE_SCAN',
          currency: 'EUR',
          currentUnitPrice: price,
          currentValueEur: price != null ? price * holding.shares : null,
          momentum120Pct: candidate.momentum120Pct,
          cashBenchmarkAnnualPct,
          context: tracked.context
        }));
        continue;
      }
      try {
        const monitored = await evaluateArbitrary({ key: holding.ticker.toUpperCase(), label: holding.ticker.toUpperCase(), symbol: holding.ticker.toUpperCase(), unitsOrShares: holding.shares, cashBenchmarkAnnualPct });
        positions.push(monitored);
        if (monitored.currency && monitored.currency !== 'EUR') warnings.push(`FX_REQUIRED:${holding.ticker.toUpperCase()}:${monitored.currency}`);
      } catch (error: any) {
        positions.push({ key: holding.ticker.toUpperCase(), label: holding.ticker.toUpperCase(), tickerOrIsin: holding.ticker.toUpperCase(), action: 'DATA_MISSING', reason: error?.message || String(error), source: 'ARBITRARY_REAL_SERIES', currency: null, currentUnitPrice: null, currentValueEur: null, consensusScore: null, favorableVotes: null, unfavorableVotes: null, structuralDowntrend: null, excessVsCashPctPoints: null, suggestedReductionPct: null });
      }
    }

    for (const fund of portfolio.funds ?? []) {
      const candidate = candidateFor(scan, fund.isin) ?? candidateFor(scan, fund.id);
      if (candidate?.status === 'ACCEPTED') {
        const assessment = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);
        const nav = candidate.lastClose ?? null;
        const value = nav != null && fund.units != null ? nav * fund.units : fund.currentValueEur ?? null;
        const series = scan.acceptedDataset.assets.find(asset => asset.assetId === candidate.asset.assetId);
        const latestExecutionDate = latestEpisodeDate(
          executionHistory,
          [fund.id, fund.isin, candidate.asset.assetId, candidate.asset.ticker, candidate.asset.isin],
          ['SUBSCRIBE_FUND', 'REDEEM_FUND', 'TRANSFER_FUND']
        );
        const episodeStartDate = laterDate(fund.acquisitionDate, latestExecutionDate);
        const context = positionPathContext({
          bars: series?.bars ?? [],
          acquisitionDate: episodeStartDate,
          investedEur: fund.investedEur,
          units: fund.units,
          category: candidate.asset.category,
          tickerOrAssetId: candidate.asset.assetId,
          deteriorationStreakSessions: assessDeteriorationStreak(scan, candidate.asset.assetId, cashBenchmarkAnnualPct),
          momentum20Pct: candidate.momentum20Pct
        });
        positions.push(assessmentSnapshot({
          key: fund.id,
          label: fund.name,
          tickerOrIsin: fund.isin,
          assessment,
          source: 'UNIVERSE_SCAN',
          currency: 'EUR',
          currentUnitPrice: nav,
          currentValueEur: value,
          momentum120Pct: candidate.momentum120Pct,
          cashBenchmarkAnnualPct,
          context
        }));
        continue;
      }
      try {
        const monitored = await evaluateArbitrary({ key: fund.id, label: fund.name, symbol: fund.isin, unitsOrShares: fund.units ?? null, cashBenchmarkAnnualPct });
        positions.push(monitored);
      } catch (error: any) {
        positions.push({ key: fund.id, label: fund.name, tickerOrIsin: fund.isin, action: 'DATA_MISSING', reason: error?.message || String(error), source: 'ARBITRARY_REAL_SERIES', currency: null, currentUnitPrice: null, currentValueEur: fund.currentValueEur ?? null, consensusScore: null, favorableVotes: null, unfavorableVotes: null, structuralDowntrend: null, excessVsCashPctPoints: null, suggestedReductionPct: null });
      }
    }

    const byKey: Record<string, PortfolioPositionHealthSnapshot> = {};
    for (const position of positions) {
      byKey[position.key] = position;
      byKey[position.tickerOrIsin.toUpperCase()] = position;
    }
    return { generatedAt: new Date().toISOString(), byKey, positions, warnings };
  }
}
