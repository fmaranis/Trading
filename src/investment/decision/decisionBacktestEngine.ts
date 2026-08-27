import { buildPortfolioProvenance, MultiAssetDataAligner } from '../portfolioBacktesting/multiAssetDataAligner';
import { MutablePortfolioPosition, RebalanceEngine, isRebalanceDate } from '../portfolioBacktesting/rebalanceEngine';
import { MultiAssetDataset, PortfolioBacktestConfig, PortfolioTrade } from '../portfolioBacktesting/types';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import { DecisionBacktestConfig, DecisionBacktestPoint, DecisionBacktestResult } from './types';

const sliceDataset = (dataset: MultiAssetDataset, endDate: string): MultiAssetDataset => ({
  timeframe: dataset.timeframe,
  assets: dataset.assets.map(asset => ({ ...asset, bars: asset.bars.filter(bar => bar.timestamp.slice(0, 10) <= endDate) }))
});

function calculateMaxDrawdown(points: DecisionBacktestPoint[]): number {
  let peak = 0;
  let max = 0;
  for (const p of points) {
    peak = Math.max(peak, p.equity);
    if (peak > 0) max = Math.max(max, (peak - p.equity) / peak * 100);
  }
  return max;
}

export class DecisionBacktestEngine {
  static run(dataset: MultiAssetDataset, config: DecisionBacktestConfig): DecisionBacktestResult {
    if (!(config.initialCapital > 0)) throw new Error('initialCapital debe ser > 0.');
    const provenance = buildPortfolioProvenance(dataset);
    if (provenance.portfolioEvidence !== 'REAL_ONLY') throw new Error('El backtest de decisión exige datos REAL_ONLY.');
    const aligned = MultiAssetDataAligner.align(dataset, 'INTERSECTION');
    const warmupBars = Math.max(config.warmupBars ?? 181, 181);
    if (aligned.rows.length <= warmupBars + 2) throw new Error('Histórico insuficiente para el backtest de decisión.');

    const positions: Record<string, MutablePortfolioPosition> = Object.fromEntries(dataset.assets.map(a => [a.assetId, { assetId: a.assetId, ticker: a.ticker, shares: 0 }]));
    let cash = config.initialCapital;
    let allocated = false;
    let method: DecisionBacktestPoint['method'] = 'WARMUP_CASH';
    let regime: DecisionBacktestPoint['regime'] = 'UNKNOWN';
    let rebalanceCount = 0;
    const trades: PortfolioTrade[] = [];
    const equityCurve: DecisionBacktestPoint[] = [];

    for (let i = 0; i < aligned.rows.length; i++) {
      const row = aligned.rows[i];
      const previousDate = i > 0 ? aligned.rows[i - 1].tradingDate : null;
      const scheduled = i >= warmupBars && previousDate != null && (!allocated || isRebalanceDate(previousDate, row.tradingDate, 'MONTHLY'));
      if (scheduled && previousDate) {
        const historical = sliceDataset(dataset, previousDate);
        const decision = InvestmentDecisionEngine.decide(historical, { capitalEur: Math.max(cash, 1), riskProfile: config.riskProfile, horizonYears: config.horizonYears }, new Date(`${row.tradingDate}T12:00:00Z`));
        const targetWeights = Object.fromEntries(decision.assets.map(a => [a.assetId, a.weight]));
        const pfConfig: PortfolioBacktestConfig = { initialCapital: config.initialCapital, commissionPct: config.commissionPct, slippagePct: config.slippagePct, rebalanceFrequency: 'MONTHLY', executionMode: 'NEXT_OPEN', targetWeights, rebalanceTolerancePct: 0.25, alignmentPolicy: 'INTERSECTION' };
        const prices = Object.fromEntries(dataset.assets.map(a => [a.assetId, row.assets[a.assetId].open]));
        const result = RebalanceEngine.rebalance({ timestamp: row.tradingDate, prices, positions, cash, config: pfConfig, reason: allocated ? 'MONTHLY_REBALANCE' : 'INITIAL_ALLOCATION' });
        cash = result.cash;
        trades.push(...result.trades);
        allocated = true;
        rebalanceCount++;
        method = decision.recommendedMethod;
        regime = decision.marketRegime;
      }
      const positionsValue = dataset.assets.reduce((sum, asset) => sum + positions[asset.assetId].shares * row.assets[asset.assetId].close, 0);
      const equity = cash + positionsValue;
      if (cash < -0.001) throw new Error(`Cash negativo en ${row.tradingDate}.`);
      equityCurve.push({ timestamp: row.tradingDate, equity, cash, regime, method });
    }

    const finalEquity = equityCurve[equityCurve.length - 1].equity;
    const totalCommissionEur = trades.reduce((s, t) => s + t.commissionEur, 0);
    const totalSlippageEur = trades.reduce((s, t) => s + t.slippageEur, 0);
    return { initialCapital: config.initialCapital, finalEquity, totalReturnPct: (finalEquity / config.initialCapital - 1) * 100, maxDrawdownPct: calculateMaxDrawdown(equityCurve), totalTrades: trades.length, totalCommissionEur, totalSlippageEur, totalTradingCostsEur: totalCommissionEur + totalSlippageEur, rebalanceCount, equityCurve, portfolioDatasetFingerprint: provenance.portfolioDatasetFingerprint, notes: ['Decisión con información hasta Close(t-1).', 'Ejecución en Open(t) con NEXT_OPEN.', 'Warm-up mínimo de 181 barras en efectivo.', 'Costes calculados por RebalanceEngine.'] };
  }
}
