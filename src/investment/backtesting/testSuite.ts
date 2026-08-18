import { FinancialMetricsCalculator } from './metrics';
import { BacktestTrade, EquityPoint } from './types';

export class FinancialTestSuite {
  public static runAllTests(): { name: string; passed: boolean; message: string }[] {
    const results: { name: string; passed: boolean; message: string }[] = [];

    // Test 1: Zero / NaN Check
    try {
      const emptyMetrics = FinancialMetricsCalculator.calculateMetrics(100, 100, [], []);
      const hasNaN = Object.values(emptyMetrics).some(v => typeof v === 'number' && isNaN(v));
      results.push({
        name: 'Métricas Cero / NaN Safe',
        passed: !hasNaN,
        message: hasNaN ? 'Fallo: Contiene valores NaN' : 'OK: Retorna métricas numéricas seguras sin NaNs'
      });
    } catch (e: any) {
      results.push({ name: 'Métricas Cero / NaN Safe', passed: false, message: e.message });
    }

    // Test 2: Standard Trade PnL & Profit Factor
    try {
      const mockTrades: BacktestTrade[] = [
        {
          id: 't1',
          entryDate: '2026-01-01',
          exitDate: '2026-01-05',
          entryPrice: 100,
          exitPrice: 110,
          shares: 1,
          amountInvested: 100,
          pnlEur: 10,
          pnlPct: 10,
          returnFactor: 1.1,
          commissionPaid: 0.1,
          slippagePaid: 0.05,
          exitReason: 'SIGNAL',
          holdingPeriodBars: 4,
          isWin: true
        },
        {
          id: 't2',
          entryDate: '2026-01-06',
          exitDate: '2026-01-10',
          entryPrice: 110,
          exitPrice: 105,
          shares: 1,
          amountInvested: 110,
          pnlEur: -5,
          pnlPct: -4.54,
          returnFactor: 0.95,
          commissionPaid: 0.1,
          slippagePaid: 0.05,
          exitReason: 'STOP_LOSS',
          holdingPeriodBars: 4,
          isWin: false
        }
      ];

      const mockEquity: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 0, drawdownPct: 0 },
        { timestamp: '2026-01-05', equity: 110, cash: 110, drawdownPct: 0 },
        { timestamp: '2026-01-10', equity: 105, cash: 105, drawdownPct: 4.54 }
      ];

      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 105, mockEquity, mockTrades);
      const isProfitFactorCorrect = metrics.profitFactor === 2.0; // 10 / 5 = 2.0
      const isWinRateCorrect = metrics.winRatePct === 50.0; // 1 win out of 2 = 50%

      results.push({
        name: 'Cálculo Exacto de WinRate (50%) & Profit Factor (2.0)',
        passed: isProfitFactorCorrect && isWinRateCorrect,
        message: `WinRate: ${metrics.winRatePct}%, ProfitFactor: ${metrics.profitFactor}`
      });
    } catch (e: any) {
      results.push({ name: 'Cálculo de Trades', passed: false, message: e.message });
    }

    // Test 3: Max Drawdown Accuracy
    try {
      const mockDrawdownCurve: EquityPoint[] = [
        { timestamp: 'D1', equity: 100, cash: 100, drawdownPct: 0 },
        { timestamp: 'D2', equity: 120, cash: 120, drawdownPct: 0 }, // Peak
        { timestamp: 'D3', equity: 90, cash: 90, drawdownPct: 25 }, // Drop from 120 to 90 = -25%
        { timestamp: 'D4', equity: 110, cash: 110, drawdownPct: 8.33 }
      ];

      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 110, mockDrawdownCurve, []);
      const isMaxDrawdownCorrect = metrics.maxDrawdownPct === 25.0;

      results.push({
        name: 'Cálculo Exacto de Max Drawdown (25.0%)',
        passed: isMaxDrawdownCorrect,
        message: `Max Drawdown calculado: ${metrics.maxDrawdownPct}%`
      });
    } catch (e: any) {
      results.push({ name: 'Max Drawdown Test', passed: false, message: e.message });
    }

    return results;
  }
}
