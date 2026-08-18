import { FinancialMetricsCalculator } from './metrics';
import { BacktestTrade, EquityPoint } from './types';
import { SyntheticDataGenerator } from '../data/syntheticDataGenerator';
import { StaticReferenceProvider } from '../data/staticReferenceProvider';
import { DataValidator } from '../data/validators';
import { BacktestEngine } from './engine';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { ALL_QUANT_STRATEGIES } from '../strategies/standardStrategies';

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

    // Test 4: Deterministic Synthetic Data Reproducibility with Seed
    try {
      const testAsset = ALL_AVAILABLE_ASSETS[0];
      const runA = SyntheticDataGenerator.generateFromAsset(testAsset, { seed: 9999, totalBars: 50 });
      const runB = SyntheticDataGenerator.generateFromAsset(testAsset, { seed: 9999, totalBars: 50 });
      const runC = SyntheticDataGenerator.generateFromAsset(testAsset, { seed: 1234, totalBars: 50 });

      const sameLength = runA.bars.length === runB.bars.length;
      const exactMatch = runA.bars.every((b, idx) => {
        const ob = runB.bars[idx];
        return b.open === ob.open && b.high === ob.high && b.low === ob.low && b.close === ob.close && b.volume === ob.volume;
      });

      const differentFromRunC = runA.bars.some((b, idx) => b.close !== runC.bars[idx]?.close);

      results.push({
        name: 'Reproducibilidad 100% de Datos Sintéticos con Seed',
        passed: sameLength && exactMatch && differentFromRunC,
        message: exactMatch
          ? 'OK: Mismo seed produce exactamente la misma serie de barras bit a bit.'
          : 'Fallo: Discrepancia entre dos ejecuciones con el mismo seed.'
      });
    } catch (e: any) {
      results.push({ name: 'Reproducibilidad de Datos Sintéticos', passed: false, message: e.message });
    }

    // Test 5: OHLCV Integrity & Validation Pass
    try {
      const testAsset = ALL_AVAILABLE_ASSETS[1] || ALL_AVAILABLE_ASSETS[0];
      const { bars } = SyntheticDataGenerator.generateFromAsset(testAsset, { seed: 555, totalBars: 60 });
      const validation = DataValidator.validatePriceBars(bars);

      results.push({
        name: 'Integridad Matemática OHLCV (High >= Low, no NaNs)',
        passed: validation.isValid && validation.errors.length === 0,
        message: validation.isValid
          ? `OK: ${validation.totalBars} barras validadas sin anomalías OHLC.`
          : `Fallo: ${validation.errors.join('; ')}`
      });
    } catch (e: any) {
      results.push({ name: 'Validación de Barras OHLCV', passed: false, message: e.message });
    }

    // Test 6: Categorías Explícitas de Procedencia (DataProvenance)
    try {
      const testAsset = ALL_AVAILABLE_ASSETS[0];
      const staticData = StaticReferenceProvider.getStaticBarsForAsset(testAsset);
      const syntheticData = SyntheticDataGenerator.generateFromAsset(testAsset, { seed: 777 });

      const isStaticCorrect = staticData.provenance.sourceType === 'STATIC_REFERENCE' && staticData.provenance.isReproducible;
      const isSyntheticCorrect = syntheticData.provenance.sourceType === 'SYNTHETIC' && syntheticData.provenance.seed === 777;

      const backtest = BacktestEngine.runBacktest(
        ALL_QUANT_STRATEGIES[0],
        syntheticData.bars,
        testAsset.ticker,
        testAsset.name,
        {},
        undefined,
        syntheticData.provenance
      );

      const hasProvenanceAttached = backtest.dataProvenance?.sourceType === 'SYNTHETIC';

      results.push({
        name: 'Trazabilidad y Tipos de Procedencia (STATIC vs SYNTHETIC)',
        passed: isStaticCorrect && isSyntheticCorrect && hasProvenanceAttached,
        message: hasProvenanceAttached
          ? 'OK: BacktestResult transporta DataProvenance auditable.'
          : 'Fallo: DataProvenance no fue asignado correctamente.'
      });
    } catch (e: any) {
      results.push({ name: 'Tipos de Procedencia', passed: false, message: e.message });
    }

    return results;
  }
}

