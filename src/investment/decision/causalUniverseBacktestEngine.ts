import { buildPortfolioProvenance } from '../portfolioBacktesting/multiAssetDataAligner';
import { MutablePortfolioPosition, RebalanceEngine, isRebalanceDate } from '../portfolioBacktesting/rebalanceEngine';
import { MultiAssetDataset, PortfolioBacktestConfig, PortfolioTrade } from '../portfolioBacktesting/types';
import { AssetUniverseItem } from './assetUniverse';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import { DecisionBacktestConfig, DecisionBacktestPoint, InvestmentDecisionResult } from './types';

export const CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS = 252;

export interface CausalUniverseSelectionRecord {
  informationEndDate: string;
  executionDate: string;
  selectedTickers: string[];
  selectedAssetIds: string[];
  scores: Record<string, number>;
  regime: InvestmentDecisionResult['marketRegime'];
  method: InvestmentDecisionResult['recommendedMethod'];
}

export interface CausalUniverseBacktestResult {
  scope: 'CAUSAL_SELECTION_WITHIN_CURRENTLY_VALIDATED_UNIVERSE';
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  totalCommissionEur: number;
  totalSlippageEur: number;
  totalTradingCostsEur: number;
  rebalanceCount: number;
  equityCurve: DecisionBacktestPoint[];
  selectionHistory: CausalUniverseSelectionRecord[];
  universeDatasetFingerprint: string;
  notes: string[];
}

function commonTradingDates(dataset: MultiAssetDataset): string[] {
  const sets = dataset.assets.map(asset => new Set(asset.bars.map(b => b.timestamp.slice(0, 10))));
  if (!sets.length) return [];
  return [...sets[0]].filter(d => sets.every(set => set.has(d))).sort();
}

function barByDate(dataset: MultiAssetDataset): Record<string, Map<string, any>> {
  return Object.fromEntries(dataset.assets.map(a => [a.assetId, new Map(a.bars.map(b => [b.timestamp.slice(0, 10), b]))]));
}

function sliceDataset(dataset: MultiAssetDataset, assetIds: string[], endDate: string): MultiAssetDataset {
  const wanted = new Set(assetIds);
  return {
    timeframe: dataset.timeframe,
    assets: dataset.assets
      .filter(asset => wanted.has(asset.assetId))
      .map(asset => ({ ...asset, bars: asset.bars.filter(bar => bar.timestamp.slice(0, 10) <= endDate) }))
  };
}

function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const start = prices[prices.length - 1 - lookback];
  const end = prices[prices.length - 1];
  return start > 0 ? (end / start - 1) * 100 : null;
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

function maxDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  let peak = slice[0];
  let max = 0;
  for (const p of slice) {
    peak = Math.max(peak, p);
    if (peak > 0) max = Math.max(max, (peak - p) / peak * 100);
  }
  return max;
}

function scoreCandidate(prices: number[], defensive: boolean): number | null {
  if (prices.length < CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS) return null;
  const m20 = pctReturn(prices, 20) ?? 0;
  const m60 = pctReturn(prices, 60) ?? 0;
  const m120 = pctReturn(prices, 120) ?? 0;
  const vol = annualizedVolatility(prices, 60) ?? 30;
  const dd = maxDrawdown(prices, 252) ?? 25;
  return m20 * 0.20 + m60 * 0.35 + m120 * 0.45 - vol * 0.30 - dd * 0.25 + (defensive ? 2.5 : 0);
}

function selectDiversified(
  dataset: MultiAssetDataset,
  catalog: AssetUniverseItem[],
  informationEndDate: string,
  maxSelected: number
): { assetIds: string[]; scores: Record<string, number> } {
  const catalogById = new Map(catalog.map(x => [x.assetId, x]));
  const ranked = dataset.assets.map(asset => {
    const item = catalogById.get(asset.assetId);
    const prices = asset.bars.filter(b => b.timestamp.slice(0, 10) <= informationEndDate).map(b => b.close);
    return { asset, item, score: scoreCandidate(prices, Boolean(item?.defensive)) };
  }).filter(x => x.item && x.score != null)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

  const selected: typeof ranked = [];
  const categoryCount = new Map<string, number>();
  const bestDefensive = ranked.find(x => x.item?.defensive);
  if (bestDefensive) {
    selected.push(bestDefensive);
    categoryCount.set(bestDefensive.item!.category, 1);
  }
  for (const candidate of ranked) {
    if (selected.some(s => s.asset.assetId === candidate.asset.assetId)) continue;
    if (selected.length >= maxSelected) break;
    const category = candidate.item!.category;
    if ((categoryCount.get(category) ?? 0) >= 1) continue;
    selected.push(candidate);
    categoryCount.set(category, 1);
  }
  return {
    assetIds: selected.map(x => x.asset.assetId),
    scores: Object.fromEntries(selected.map(x => [x.asset.ticker, Number((x.score ?? 0).toFixed(6))]))
  };
}

function calculateMaxDrawdown(points: DecisionBacktestPoint[]): number {
  let peak = 0;
  let max = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) max = Math.max(max, (peak - point.equity) / peak * 100);
  }
  return max;
}

export class CausalUniverseBacktestEngine {
  static run(
    universeDataset: MultiAssetDataset,
    catalog: AssetUniverseItem[],
    config: DecisionBacktestConfig,
    maxSelected = 8
  ): CausalUniverseBacktestResult {
    if (!(config.initialCapital > 0)) throw new Error('initialCapital debe ser > 0.');
    if (universeDataset.assets.length < 2) throw new Error('Se requieren al menos 2 activos en el universo causal.');
    const provenance = buildPortfolioProvenance(universeDataset);
    if (provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('El backtest causal exige universo REAL_ONLY.');

    const dates = commonTradingDates(universeDataset);
    const warmupBars = Math.max(config.warmupBars ?? CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS, CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS);
    if (dates.length <= warmupBars + 2) throw new Error('Histórico común insuficiente para backtest causal de selección.');
    const bars = barByDate(universeDataset);
    const positions: Record<string, MutablePortfolioPosition> = Object.fromEntries(
      universeDataset.assets.map(a => [a.assetId, { assetId: a.assetId, ticker: a.ticker, shares: 0 }])
    );

    let cash = config.initialCapital;
    let allocated = false;
    let method: DecisionBacktestPoint['method'] = 'WARMUP_CASH';
    let regime: DecisionBacktestPoint['regime'] = 'UNKNOWN';
    let rebalanceCount = 0;
    const trades: PortfolioTrade[] = [];
    const equityCurve: DecisionBacktestPoint[] = [];
    const selectionHistory: CausalUniverseSelectionRecord[] = [];

    for (let i = 0; i < dates.length; i++) {
      const executionDate = dates[i];
      const previousDate = i > 0 ? dates[i - 1] : null;
      const scheduled = i >= warmupBars && previousDate != null && (!allocated || isRebalanceDate(previousDate, executionDate, 'MONTHLY'));

      if (scheduled && previousDate) {
        const selection = selectDiversified(universeDataset, catalog, previousDate, Math.min(maxSelected, 8));
        if (selection.assetIds.length >= 2) {
          const historicalSelected = sliceDataset(universeDataset, selection.assetIds, previousDate);
          const equityBefore = cash + universeDataset.assets.reduce((sum, asset) => {
            const p = bars[asset.assetId].get(previousDate);
            return sum + positions[asset.assetId].shares * (p?.close ?? 0);
          }, 0);
          const decision = InvestmentDecisionEngine.decide(
            historicalSelected,
            { capitalEur: Math.max(equityBefore, 1), riskProfile: config.riskProfile, horizonYears: config.horizonYears },
            new Date(`${executionDate}T12:00:00Z`)
          );
          const targetWeights = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, 0]));
          for (const a of decision.assets) targetWeights[a.assetId] = a.weight;
          const prices = Object.fromEntries(universeDataset.assets.map(a => [a.assetId, bars[a.assetId].get(executionDate)!.open]));
          const pfConfig: PortfolioBacktestConfig = {
            initialCapital: config.initialCapital,
            commissionPct: config.commissionPct,
            slippagePct: config.slippagePct,
            rebalanceFrequency: 'MONTHLY',
            executionMode: 'NEXT_OPEN',
            targetWeights,
            rebalanceTolerancePct: 0.25,
            alignmentPolicy: 'INTERSECTION'
          };
          const result = RebalanceEngine.rebalance({
            timestamp: executionDate,
            prices,
            positions,
            cash,
            config: pfConfig,
            reason: allocated ? 'MONTHLY_REBALANCE' : 'INITIAL_ALLOCATION'
          });
          cash = result.cash;
          trades.push(...result.trades);
          allocated = true;
          rebalanceCount++;
          method = decision.recommendedMethod;
          regime = decision.marketRegime;
          selectionHistory.push({
            informationEndDate: previousDate,
            executionDate,
            selectedAssetIds: selection.assetIds,
            selectedTickers: selection.assetIds.map(id => universeDataset.assets.find(a => a.assetId === id)!.ticker),
            scores: selection.scores,
            regime,
            method
          });
        }
      }

      const positionsValue = universeDataset.assets.reduce((sum, asset) => {
        const close = bars[asset.assetId].get(executionDate)!.close;
        return sum + positions[asset.assetId].shares * close;
      }, 0);
      const equity = cash + positionsValue;
      if (cash < -0.001) throw new Error(`Cash negativo en ${executionDate}.`);
      equityCurve.push({ timestamp: executionDate, equity, cash, regime, method });
    }

    const finalEquity = equityCurve.at(-1)!.equity;
    const totalCommissionEur = trades.reduce((s, t) => s + t.commissionEur, 0);
    const totalSlippageEur = trades.reduce((s, t) => s + t.slippageEur, 0);
    return {
      scope: 'CAUSAL_SELECTION_WITHIN_CURRENTLY_VALIDATED_UNIVERSE',
      initialCapital: config.initialCapital,
      finalEquity,
      totalReturnPct: (finalEquity / config.initialCapital - 1) * 100,
      maxDrawdownPct: calculateMaxDrawdown(equityCurve),
      totalTrades: trades.length,
      totalCommissionEur,
      totalSlippageEur,
      totalTradingCostsEur: totalCommissionEur + totalSlippageEur,
      rebalanceCount,
      equityCurve,
      selectionHistory,
      universeDatasetFingerprint: provenance.portfolioDatasetFingerprint,
      notes: [
        `Cada activo necesita al menos ${CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS} barras previas para ser puntuable, alineado con el mínimo del scanner.`,
        'En cada rebalanceo, ranking y shortlist usan solo datos hasta Close(t-1).',
        'La asignación se calcula solo sobre el shortlist causal y se ejecuta en Open(t).',
        'Los activos que salen del shortlist reciben peso objetivo 0 y se liquidan con costes.',
        'Persiste riesgo residual de survivorship porque el catálogo parte de instrumentos actualmente consultables.'
      ]
    };
  }
}
