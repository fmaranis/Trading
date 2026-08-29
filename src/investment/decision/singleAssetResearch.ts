import type { PriceBar } from '../backtesting/types';
import type { AssetUniverseScanResult, AssetScanCandidate } from './assetUniverseScanner';
import { StrategyConsensusEngine, type StrategyConsensusAssessment } from './strategyConsensusEngine';

export type SingleAssetResearchFrequency = 'MONTHLY' | 'QUARTERLY';
export type SingleAssetResearchSignalAction = 'BUY' | 'ADD' | 'SELL';

export interface SingleAssetResearchSignal {
  id: string;
  action: SingleAssetResearchSignalAction;
  signalDate: string;
  executionDate: string;
  executionPrice: number;
  consensusScore: number;
  favorableVotes: number;
  unfavorableVotes: number;
  structuralDowntrend: boolean;
  buyTheDipCandidate: boolean;
  reason: string;
}

export interface SingleAssetResearchPoint {
  date: string;
  close: number;
}

export interface SingleAssetResearchResult {
  symbol: string;
  displayStartDate: string;
  endDate: string;
  barsUsed: number;
  reviews: number;
  signals: SingleAssetResearchSignal[];
  chart: SingleAssetResearchPoint[];
  currentAssessment: StrategyConsensusAssessment | null;
  buyHoldReturnPct: number | null;
  strategyReturnPct: number | null;
  assetMaxDrawdownPct: number | null;
  warnings: string[];
}

function isoDate(value: string): string { return value.slice(0, 10); }
function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const a = prices[prices.length - 1 - lookback];
  const b = prices[prices.length - 1];
  return a > 0 ? (b / a - 1) * 100 : null;
}
function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) returns.push(Math.log(slice[i] / slice[i - 1]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(prices: number[]): number | null {
  if (!prices.length) return null;
  let peak = prices[0]; let max = 0;
  for (const price of prices) {
    peak = Math.max(peak, price);
    if (peak > 0) max = Math.max(max, (peak - price) / peak * 100);
  }
  return max;
}
function researchScore(m20: number | null, m60: number | null, m120: number | null, vol: number | null, dd: number | null): number {
  return (m20 ?? 0) * 0.20 + (m60 ?? 0) * 0.35 + (m120 ?? 0) * 0.45 - (vol ?? 30) * 0.30 - (dd ?? 25) * 0.25;
}
function periodKey(date: string, frequency: SingleAssetResearchFrequency): string {
  const d = isoDate(date);
  if (frequency === 'MONTHLY') return d.slice(0, 7);
  const month = Number(d.slice(5, 7));
  return `${d.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}
function reviewIndexes(bars: PriceBar[], displayStartDate: string, frequency: SingleAssetResearchFrequency): number[] {
  const lastByPeriod = new Map<string, number>();
  for (let i = 0; i < bars.length; i++) {
    const date = isoDate(bars[i].timestamp);
    if (date < displayStartDate || i < 251) continue;
    lastByPeriod.set(periodKey(date, frequency), i);
  }
  return [...lastByPeriod.values()].sort((a, b) => a - b);
}
function buildScan(symbol: string, bars: PriceBar[]): AssetUniverseScanResult {
  const prices = bars.map(b => b.close).filter(v => Number.isFinite(v) && v > 0);
  const m20 = pctReturn(prices, 20), m60 = pctReturn(prices, 60), m120 = pctReturn(prices, 120);
  const vol = annualizedVolatility(prices, 60), dd = maxDrawdown(prices.slice(-Math.min(252, prices.length)));
  const asset: any = { assetId: 'RESEARCH_ASSET', ticker: symbol, name: symbol, category: 'GLOBAL_EQUITY', currency: 'EUR' };
  const response: any = {
    bars,
    provenance: { sourceType: 'REAL', provider: 'research-provider', symbol, timeframe: '1d', isReproducible: true },
    metadata: {}
  };
  const candidate: AssetScanCandidate = {
    asset,
    status: 'ACCEPTED',
    bars: bars.length,
    asOfDate: bars.length ? isoDate(bars[bars.length - 1].timestamp) : null,
    lastClose: prices.at(-1) ?? null,
    momentum20Pct: m20,
    momentum60Pct: m60,
    momentum120Pct: m120,
    annualizedVolatilityPct: vol,
    maxDrawdownPct: dd,
    score: researchScore(m20, m60, m120, vol, dd),
    response
  };
  const dataset: any = {
    timeframe: '1d',
    assets: [{ assetId: 'RESEARCH_ASSET', ticker: symbol, name: symbol, bars, provenance: response.provenance }]
  };
  return { scanned: 1, accepted: 1, rejected: 0, selected: [candidate], candidates: [candidate], dataset, acceptedDataset: dataset, rejectionCounts: {} };
}

function normalizedStrategyReturn(chartBars: PriceBar[], signals: SingleAssetResearchSignal[]): number | null {
  if (chartBars.length < 2) return null;
  let equity = 100;
  let entryPrice: number | null = null;
  for (const signal of signals) {
    if (signal.action === 'BUY' && entryPrice == null) entryPrice = signal.executionPrice;
    if (signal.action === 'SELL' && entryPrice != null) {
      equity *= signal.executionPrice / entryPrice;
      entryPrice = null;
    }
  }
  if (entryPrice != null) equity *= chartBars[chartBars.length - 1].close / entryPrice;
  return equity - 100;
}

export class SingleAssetResearchEngine {
  static run(input: {
    symbol: string;
    bars: PriceBar[];
    displayStartDate: string;
    endDate?: string;
    frequency?: SingleAssetResearchFrequency;
    cashBenchmarkAnnualPct?: number;
  }): SingleAssetResearchResult {
    const symbol = input.symbol.trim().toUpperCase();
    const frequency = input.frequency ?? 'MONTHLY';
    const cashBenchmarkAnnualPct = input.cashBenchmarkAnnualPct ?? 2.5;
    const bars = [...input.bars]
      .filter(b => Number.isFinite(b.open) && Number.isFinite(b.close) && b.open > 0 && b.close > 0)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (bars.length < 252) throw new Error('INSUFFICIENT_HISTORY: se requieren al menos 252 sesiones previas para usar el mismo motor causal.');

    const displayStartDate = input.displayStartDate;
    const chartBars = bars.filter(b => isoDate(b.timestamp) >= displayStartDate && (!input.endDate || isoDate(b.timestamp) <= input.endDate));
    if (chartBars.length < 2) throw new Error('NO_BARS_IN_SELECTED_PERIOD');

    const indexes = reviewIndexes(bars, displayStartDate, frequency);
    const signals: SingleAssetResearchSignal[] = [];
    let holding = false;
    let addRegime = false;

    for (const index of indexes) {
      const nextBar = bars[index + 1];
      if (!nextBar) continue;
      const snapshot = bars.slice(0, index + 1);
      const assessment = StrategyConsensusEngine.assess(buildScan(symbol, snapshot), 'RESEARCH_ASSET', cashBenchmarkAnnualPct);
      if (!assessment) continue;
      const signalDate = isoDate(snapshot[snapshot.length - 1].timestamp);
      const executionDate = isoDate(nextBar.timestamp);
      if (executionDate < displayStartDate || (input.endDate && executionDate > input.endDate)) continue;

      if (!holding && assessment.newMoneyAction === 'BUY') {
        signals.push({ id: `${symbol}_${signalDate}_BUY`, action: 'BUY', signalDate, executionDate, executionPrice: nextBar.open, consensusScore: assessment.consensusScore, favorableVotes: assessment.favorableVotes, unfavorableVotes: assessment.unfavorableVotes, structuralDowntrend: assessment.structuralDowntrend, buyTheDipCandidate: assessment.buyTheDipCandidate, reason: assessment.explanation });
        holding = true;
        addRegime = false;
        continue;
      }
      if (holding && assessment.existingPositionAction === 'REDUCE_REVIEW') {
        signals.push({ id: `${symbol}_${signalDate}_SELL`, action: 'SELL', signalDate, executionDate, executionPrice: nextBar.open, consensusScore: assessment.consensusScore, favorableVotes: assessment.favorableVotes, unfavorableVotes: assessment.unfavorableVotes, structuralDowntrend: assessment.structuralDowntrend, buyTheDipCandidate: assessment.buyTheDipCandidate, reason: assessment.explanation });
        holding = false;
        addRegime = false;
        continue;
      }
      if (holding && assessment.existingPositionAction === 'ADD') {
        if (!addRegime) signals.push({ id: `${symbol}_${signalDate}_ADD`, action: 'ADD', signalDate, executionDate, executionPrice: nextBar.open, consensusScore: assessment.consensusScore, favorableVotes: assessment.favorableVotes, unfavorableVotes: assessment.unfavorableVotes, structuralDowntrend: assessment.structuralDowntrend, buyTheDipCandidate: assessment.buyTheDipCandidate, reason: assessment.explanation });
        addRegime = true;
      } else addRegime = false;
    }

    const fullAssessment = StrategyConsensusEngine.assess(buildScan(symbol, bars), 'RESEARCH_ASSET', cashBenchmarkAnnualPct);
    const firstClose = chartBars[0].close;
    const lastClose = chartBars[chartBars.length - 1].close;
    const warnings: string[] = [
      'RESEARCH_ONLY: este replay estudia un activo aislado; no equivale a una orden sobre la cartera real.',
      'CAUSAL_NEXT_OPEN: cada marca se ejecuta en la primera sesión posterior a la fecha de señal.'
    ];
    return {
      symbol,
      displayStartDate,
      endDate: isoDate(chartBars[chartBars.length - 1].timestamp),
      barsUsed: bars.length,
      reviews: indexes.length,
      signals,
      chart: chartBars.map(b => ({ date: isoDate(b.timestamp), close: b.close })),
      currentAssessment: fullAssessment,
      buyHoldReturnPct: firstClose > 0 ? (lastClose / firstClose - 1) * 100 : null,
      strategyReturnPct: normalizedStrategyReturn(chartBars, signals),
      assetMaxDrawdownPct: maxDrawdown(chartBars.map(b => b.close)),
      warnings
    };
  }
}
