import { EquityPoint } from '../backtesting/types';
import { FinancialMetricsCalculator } from '../backtesting/metrics';
import { PortfolioEquityPoint, PortfolioMetrics, PortfolioTrade } from './types';

function toCanonicalEquity(curve: PortfolioEquityPoint[]): EquityPoint[] {
  let peak = 0;
  return curve.map(point => {
    peak = Math.max(peak, point.equity);
    const drawdownPct = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return {
      timestamp: point.timestamp,
      equity: point.equity,
      cash: point.cash,
      positionMarketValue: point.positionsValue,
      drawdownPct,
      benchmarkEquity: point.benchmarkEquity
    };
  });
}

export class PortfolioMetricsCalculator {
  public static calculate(
    initialCapital: number,
    curve: PortfolioEquityPoint[],
    trades: PortfolioTrade[],
    benchmarkReturnPct: number,
    riskFreeRateAnnualPct: number = 3
  ): PortfolioMetrics {
    const canonical = toCanonicalEquity(curve);
    const finalEquity = curve[curve.length - 1]?.equity ?? initialCapital;
    const financial = FinancialMetricsCalculator.calculateMetrics(
      initialCapital,
      finalEquity,
      canonical,
      [],
      benchmarkReturnPct,
      riskFreeRateAnnualPct
    );

    const averageCashPct = curve.length
      ? curve.reduce((sum, p) => sum + (p.equity > 0 ? p.cash / p.equity : 0), 0) / curve.length * 100
      : 0;
    const averageNumberOfPositions = curve.length
      ? curve.reduce((sum, p) => sum + p.positions.filter(x => x.shares > 1e-12).length, 0) / curve.length
      : 0;
    const maxSingleAssetWeightPct = curve.reduce(
      (max, p) => Math.max(max, ...p.positions.map(pos => pos.portfolioWeight * 100), 0),
      0
    );
    const totalCommissionEur = trades.reduce((s, t) => s + t.commissionEur, 0);
    const totalSlippageEur = trades.reduce((s, t) => s + t.slippageEur, 0);
    const totalTradingCostsEur = totalCommissionEur + totalSlippageEur;

    let annualizedTurnoverPct: number | null = null;
    if (curve.length >= 2) {
      const averageEquity = curve.reduce((s, p) => s + p.equity, 0) / curve.length;
      const tradedNotional = trades.reduce((s, t) => s + Math.abs(t.notionalEur), 0);
      const first = Date.parse(curve[0].timestamp);
      const last = Date.parse(curve[curve.length - 1].timestamp);
      const years = (last - first) / (365.2425 * 24 * 3600 * 1000);
      if (averageEquity > 0 && years > 0) annualizedTurnoverPct = (tradedNotional / averageEquity) / years * 100;
    }

    return {
      financial,
      averageCashPct,
      averageNumberOfPositions,
      maxSingleAssetWeightPct,
      annualizedTurnoverPct,
      totalCommissionEur,
      totalSlippageEur,
      totalTradingCostsEur
    };
  }
}
