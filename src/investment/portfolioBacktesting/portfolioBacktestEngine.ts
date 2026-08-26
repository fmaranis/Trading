import {
  MultiAssetAccountingError,
  MultiAssetDataError,
  MultiAssetDataset,
  PortfolioAssetSummary,
  PortfolioBacktestConfig,
  PortfolioBacktestResult,
  PortfolioEquityPoint,
  PortfolioTrade,
  UnsupportedMultiCurrencyPortfolioError
} from './types';
import {
  buildPortfolioProvenance,
  MultiAssetDataAligner
} from './multiAssetDataAligner';
import { isRebalanceDate, MutablePortfolioPosition, RebalanceEngine } from './rebalanceEngine';
import { PortfolioMetricsCalculator } from './portfolioMetrics';

const EPS = 1e-12;

export function createEqualWeights(assetIds: string[]): Record<string, number> {
  if (!assetIds.length) return {};
  const w = 1 / assetIds.length;
  return Object.fromEntries(assetIds.map(id => [id, w]));
}

function validateConfig(dataset: MultiAssetDataset, config: PortfolioBacktestConfig): void {
  if (!(config.initialCapital > 0)) throw new MultiAssetDataError('initialCapital debe ser > 0.');
  if (config.commissionPct < 0 || config.slippagePct < 0) throw new MultiAssetDataError('Comisión y slippage deben ser >= 0.');
  if (config.executionMode !== 'NEXT_OPEN') throw new MultiAssetDataError('Paso 9A admite exclusivamente NEXT_OPEN.');

  const ids = new Set(dataset.assets.map(a => a.assetId));
  let sum = 0;
  for (const [assetId, weight] of Object.entries(config.targetWeights)) {
    if (!ids.has(assetId)) throw new MultiAssetDataError(`Peso definido para assetId desconocido: ${assetId}`);
    if (!Number.isFinite(weight) || weight < 0) throw new MultiAssetDataError(`Peso inválido para ${assetId}: ${weight}`);
    sum += weight;
  }
  if (sum > 1 + 1e-10) throw new MultiAssetDataError(`La suma de pesos excede 100%: ${(sum * 100).toFixed(4)}%.`);
  const minCash = (config.minimumCashPct ?? 0) / 100;
  if (minCash < 0 || minCash > 1) throw new MultiAssetDataError('minimumCashPct debe estar entre 0 y 100.');
  if (sum > 1 - minCash + 1e-10) throw new MultiAssetDataError('Los pesos objetivo incumplen el mínimo de cash configurado.');
}

function validateCurrency(dataset: MultiAssetDataset): void {
  const currencies = [...new Set(dataset.assets.map(a => a.currency).filter((x): x is string => !!x))];
  if (currencies.length > 1) {
    throw new UnsupportedMultiCurrencyPortfolioError(`UNSUPPORTED_MULTI_CURRENCY_PORTFOLIO: ${currencies.join(', ')}`);
  }
}

function computeBenchmark(
  dataset: MultiAssetDataset,
  alignedRows: ReturnType<typeof MultiAssetDataAligner.align>['rows'],
  initialCapital: number
): { timestamp: string; equity: number }[] {
  const ids = dataset.assets.map(a => a.assetId);
  const weights = createEqualWeights(ids);
  const first = alignedRows[0];
  const shares: Record<string, number> = {};
  for (const id of ids) shares[id] = (initialCapital * weights[id]) / first.assets[id].open;
  return alignedRows.map(row => ({
    timestamp: row.tradingDate,
    equity: ids.reduce((sum, id) => sum + shares[id] * row.assets[id].close, 0)
  }));
}

export class PortfolioBacktestEngine {
  public static run(dataset: MultiAssetDataset, config: PortfolioBacktestConfig): PortfolioBacktestResult {
    validateConfig(dataset, config);
    validateCurrency(dataset);
    const provenance = buildPortfolioProvenance(dataset);
    if (provenance.portfolioEvidence === 'MIXED') {
      throw new MultiAssetDataError('PORTFOLIO_DATA_INCOMPLETE/MIXED: no se permiten fuentes mezcladas en el Paso 9A.');
    }

    const aligned = MultiAssetDataAligner.align(dataset, config.alignmentPolicy ?? 'INTERSECTION');
    for (const row of aligned.rows) {
      if (Object.keys(row.assets).length !== dataset.assets.length) {
        throw new MultiAssetDataError('UNION_NO_FILL contiene fechas incompletas; use INTERSECTION para ejecutar la cartera sin forward-fill.');
      }
    }

    const positions: Record<string, MutablePortfolioPosition> = Object.fromEntries(
      dataset.assets.map(a => [a.assetId, { assetId: a.assetId, ticker: a.ticker, shares: 0 }])
    );
    const benchmark = computeBenchmark(dataset, aligned.rows, config.initialCapital);
    let cash = config.initialCapital;
    const trades: PortfolioTrade[] = [];
    const equityCurve: PortfolioEquityPoint[] = [];

    for (let i = 0; i < aligned.rows.length; i++) {
      const row = aligned.rows[i];
      const openPrices = Object.fromEntries(dataset.assets.map(a => [a.assetId, row.assets[a.assetId].open]));
      const shouldInitialAllocate = i === 0;
      const shouldRebalance = i > 0 && isRebalanceDate(aligned.rows[i - 1].tradingDate, row.tradingDate, config.rebalanceFrequency);

      if (shouldInitialAllocate || shouldRebalance) {
        const reason: PortfolioTrade['reason'] = shouldInitialAllocate
          ? 'INITIAL_ALLOCATION'
          : config.rebalanceFrequency === 'MONTHLY'
            ? 'MONTHLY_REBALANCE'
            : 'QUARTERLY_REBALANCE';
        const result = RebalanceEngine.rebalance({
          timestamp: row.tradingDate,
          prices: openPrices,
          positions,
          cash,
          config,
          reason
        });
        cash = result.cash;
        trades.push(...result.trades);
      }

      if (cash < -0.001) throw new MultiAssetAccountingError(`Cash negativo en ${row.tradingDate}: ${cash}`);
      if (cash < 0 && cash > -0.001) cash = 0;

      const closePrices = Object.fromEntries(dataset.assets.map(a => [a.assetId, row.assets[a.assetId].close]));
      const rawValues = dataset.assets.map(a => ({
        assetId: a.assetId,
        ticker: a.ticker,
        shares: positions[a.assetId].shares,
        marketPrice: closePrices[a.assetId],
        marketValue: positions[a.assetId].shares * closePrices[a.assetId]
      }));
      const positionsValue = rawValues.reduce((s, p) => s + p.marketValue, 0);
      const equity = cash + positionsValue;
      const state = rawValues.map(p => ({ ...p, portfolioWeight: equity > 0 ? p.marketValue / equity : 0 }));
      const accountingDiff = Math.abs(equity - (cash + state.reduce((s, p) => s + p.marketValue, 0)));
      if (accountingDiff > 0.01) throw new MultiAssetAccountingError(`Descuadre patrimonial en ${row.tradingDate}: ${accountingDiff}`);

      equityCurve.push({
        timestamp: row.tradingDate,
        cash,
        positionsValue,
        equity,
        positions: state,
        benchmarkEquity: benchmark[i].equity
      });
    }

    const benchmarkReturnPct = (benchmark[benchmark.length - 1].equity / benchmark[0].equity - 1) * 100;
    const metrics = PortfolioMetricsCalculator.calculate(config.initialCapital, equityCurve, trades, benchmarkReturnPct);

    const final = equityCurve[equityCurve.length - 1];
    const assetSummaries: PortfolioAssetSummary[] = dataset.assets.map(asset => {
      const finalPos = final.positions.find(p => p.assetId === asset.assetId)!;
      const assetTrades = trades.filter(t => t.assetId === asset.assetId);
      const cashFlow = assetTrades.reduce((sum, t) => {
        const signed = t.side === 'SELL'
          ? (t.notionalEur - t.commissionEur)
          : -(t.notionalEur + t.commissionEur);
        return sum + signed;
      }, 0);
      const contributionEur = cashFlow + finalPos.marketValue;
      return {
        assetId: asset.assetId,
        ticker: asset.ticker,
        targetWeight: config.targetWeights[asset.assetId] ?? 0,
        finalWeight: finalPos.portfolioWeight,
        finalValue: finalPos.marketValue,
        contributionToReturnPct: contributionEur / config.initialCapital * 100,
        totalCommissionEur: assetTrades.reduce((s, t) => s + t.commissionEur, 0),
        totalSlippageEur: assetTrades.reduce((s, t) => s + t.slippageEur, 0)
      };
    });

    if (Math.abs(final.equity - (final.cash + final.positionsValue)) > 0.01 + EPS) {
      throw new MultiAssetAccountingError('Descuadre final de cartera.');
    }

    return {
      config,
      provenance,
      alignedBarsCount: aligned.rows.length,
      equityCurve,
      benchmarkEquityCurve: benchmark,
      trades,
      metrics,
      assetSummaries
    };
  }
}
