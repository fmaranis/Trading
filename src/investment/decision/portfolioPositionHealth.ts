import type { PriceBar } from '../backtesting/types';
import { HistoricalMarketDataService } from '../data/marketData/historicalMarketDataService';
import { FundMarketDataService } from '../data/marketData/fundMarketData';
import type { AssetUniverseScanResult } from './assetUniverseScanner';
import { assessAgainstCashBenchmark } from './cashBenchmark';
import { SingleAssetResearchEngine } from './singleAssetResearch';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';
import type { UserPortfolioState } from './userPortfolio';

export type PortfolioPositionHealthAction = 'ADD' | 'HOLD' | 'WATCH' | 'REDUCE' | 'EXIT' | 'DATA_MISSING';

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
}

export interface PortfolioPositionHealthResult {
  generatedAt: string;
  byKey: Record<string, PortfolioPositionHealthSnapshot>;
  positions: PortfolioPositionHealthSnapshot[];
  warnings: string[];
}

function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
function twoYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 2); return isoDate(d); }
function oneYearAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 1); return isoDate(d); }
function looksLikeIsin(value: string): boolean { return /^[A-Z]{2}[A-Z0-9]{10}$/.test(value.toUpperCase()); }

export function classifyPositionHealth(
  assessment: StrategyConsensusAssessment | null,
  excessVsCashPctPoints: number | null
): Pick<PortfolioPositionHealthSnapshot, 'action' | 'reason' | 'suggestedReductionPct'> {
  if (!assessment) return { action: 'DATA_MISSING', reason: 'No hay evidencia causal suficiente para evaluar esta posición.', suggestedReductionPct: null };

  if (assessment.structuralDowntrend && assessment.unfavorableVotes >= 4 && assessment.consensusScore <= -3) {
    return {
      action: 'EXIT',
      reason: `Deterioro estructural fuerte: consenso ${assessment.consensusScore}, ${assessment.unfavorableVotes} señales adversas y tendencia larga rota. Revisar salida completa; no se vende por simple sobreponderación.`,
      suggestedReductionPct: 100
    };
  }
  if (assessment.existingPositionAction === 'REDUCE_REVIEW') {
    return {
      action: 'REDUCE',
      reason: `Deterioro estructural confirmado por ${assessment.unfavorableVotes} señales adversas. Revisar reducción parcial; la decisión procede de la salud del activo, no del peso de cartera.`,
      suggestedReductionPct: 50
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
}): PortfolioPositionHealthSnapshot {
  const cash = assessAgainstCashBenchmark({ momentum120Pct: input.momentum120Pct, benchmarkAnnualPct: input.cashBenchmarkAnnualPct, notionalEur: 0, estimatedFeeEur: 0 });
  const classification = classifyPositionHealth(input.assessment, cash.excessVsCashPctPoints);
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
    suggestedReductionPct: classification.suggestedReductionPct
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

    for (const holding of portfolio.holdings) {
      const candidate = candidateFor(scan, holding.ticker);
      if (candidate?.status === 'ACCEPTED') {
        const assessment = StrategyConsensusEngine.assess(scan, candidate.asset.assetId, cashBenchmarkAnnualPct);
        const price = candidate.lastClose ?? null;
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
          cashBenchmarkAnnualPct
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
          cashBenchmarkAnnualPct
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
