import { FinancialMetricsCalculator } from './metrics';
import { BacktestTrade, EquityPoint, PriceBar } from './types';
import { SyntheticDataGenerator } from '../data/syntheticDataGenerator';
import { DataValidator } from '../data/validators';
import { BacktestEngine } from './engine';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { ALL_QUANT_STRATEGIES } from '../strategies/standardStrategies';

export class FinancialTestSuite {
  public static runAllTests(): { name: string; passed: boolean; message: string }[] {
    const results: { name: string; passed: boolean; message: string }[] = [];

    // 1. Infinity en close → rechazado
    try {
      const barsWithInfClose: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 95, close: Infinity, volume: 1000 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithInfClose);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('Close'));
      results.push({
        name: '1. Infinity en Close → Rechazado',
        passed,
        message: passed ? 'OK: Infinity en Close detectado y rechazado.' : 'Fallo: No se rechazó Infinity en Close.'
      });
    } catch (e: any) {
      results.push({ name: '1. Infinity en Close → Rechazado', passed: false, message: e.message });
    }

    // 2. NaN en open → rechazado
    try {
      const barsWithNaNOpen: PriceBar[] = [
        { timestamp: '2026-01-01', open: NaN, high: 105, low: 95, close: 100, volume: 1000 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithNaNOpen);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('Open'));
      results.push({
        name: '2. NaN en Open → Rechazado',
        passed,
        message: passed ? 'OK: NaN en Open detectado y rechazado.' : 'Fallo: No se rechazó NaN en Open.'
      });
    } catch (e: any) {
      results.push({ name: '2. NaN en Open → Rechazado', passed: false, message: e.message });
    }

    // 3. -Infinity en high → rechazado
    try {
      const barsWithNegInfHigh: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: -Infinity, low: 95, close: 100, volume: 1000 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithNegInfHigh);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('High'));
      results.push({
        name: '3. -Infinity en High → Rechazado',
        passed,
        message: passed ? 'OK: -Infinity en High detectado y rechazado.' : 'Fallo: No se rechazó -Infinity en High.'
      });
    } catch (e: any) {
      results.push({ name: '3. -Infinity en High → Rechazado', passed: false, message: e.message });
    }

    // 4. Volumen negativo → rechazado
    try {
      const barsWithNegVol: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: -500 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithNegVol);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('Volumen'));
      results.push({
        name: '4. Volumen Negativo → Rechazado',
        passed,
        message: passed ? 'OK: Volumen negativo detectado y rechazado.' : 'Fallo: No se rechazó volumen negativo.'
      });
    } catch (e: any) {
      results.push({ name: '4. Volumen Negativo → Rechazado', passed: false, message: e.message });
    }

    // 5. Volumen Infinity → rechazado
    try {
      const barsWithInfVol: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: Infinity }
      ];
      const rep = DataValidator.validatePriceBars(barsWithInfVol);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('Volumen'));
      results.push({
        name: '5. Volumen Infinity → Rechazado',
        passed,
        message: passed ? 'OK: Volumen Infinity detectado y rechazado.' : 'Fallo: No se rechazó volumen Infinity.'
      });
    } catch (e: any) {
      results.push({ name: '5. Volumen Infinity → Rechazado', passed: false, message: e.message });
    }

    // 6. Timestamp duplicado → rechazado
    try {
      const barsWithDupTs: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2026-01-01', open: 101, high: 106, low: 96, close: 102, volume: 1000 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithDupTs);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('duplicado'));
      results.push({
        name: '6. Timestamp Duplicado → Rechazado',
        passed,
        message: passed ? 'OK: Timestamp duplicado detectado y rechazado.' : 'Fallo: No se rechazó timestamp duplicado.'
      });
    } catch (e: any) {
      results.push({ name: '6. Timestamp Duplicado → Rechazado', passed: false, message: e.message });
    }

    // 7. Timestamps desordenados → rechazado
    try {
      const barsWithUnorderedTs: PriceBar[] = [
        { timestamp: '2026-01-05', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 101, high: 106, low: 96, close: 102, volume: 1000 }
      ];
      const rep = DataValidator.validatePriceBars(barsWithUnorderedTs);
      const passed = !rep.isValid && rep.errors.some(e => e.includes('desordenada') || e.includes('creciente'));
      results.push({
        name: '7. Timestamps Desordenados → Rechazado',
        passed,
        message: passed ? 'OK: Serie desordenada detectada y rechazada.' : 'Fallo: No se rechazaron timestamps desordenados.'
      });
    } catch (e: any) {
      results.push({ name: '7. Timestamps Desordenados → Rechazado', passed: false, message: e.message });
    }

    // 8. Dataset vacío → rechazado
    try {
      const repEmpty = DataValidator.validatePriceBars([]);
      const passed = !repEmpty.isValid && repEmpty.errors.length > 0;
      results.push({
        name: '8. Dataset Vacío → Rechazado',
        passed,
        message: passed ? 'OK: Dataset vacío detectado y rechazado.' : 'Fallo: Dataset vacío fue aceptado.'
      });
    } catch (e: any) {
      results.push({ name: '8. Dataset Vacío → Rechazado', passed: false, message: e.message });
    }

    // 9. OHLC correcto → aceptado
    try {
      const validBars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 108, low: 98, close: 105, volume: 12000 },
        { timestamp: '2026-01-02', open: 105, high: 110, low: 103, close: 108, volume: 14500 }
      ];
      const repValid = DataValidator.validatePriceBars(validBars);
      const passed = repValid.isValid && repValid.errors.length === 0;
      results.push({
        name: '9. OHLC Correcto → Aceptado',
        passed,
        message: passed ? `OK: ${repValid.totalBars} barras válidas aceptadas.` : `Fallo: ${repValid.errors.join('; ')}`
      });
    } catch (e: any) {
      results.push({ name: '9. OHLC Correcto → Aceptado', passed: false, message: e.message });
    }

    // 10. Todos los BacktestResult incluyen DataProvenance
    try {
      const testAsset = ALL_AVAILABLE_ASSETS[0];
      const validBars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 108, low: 98, close: 105, volume: 12000 },
        { timestamp: '2026-01-02', open: 105, high: 110, low: 103, close: 108, volume: 14500 }
      ];
      const resFallback = BacktestEngine.runBacktest(ALL_QUANT_STRATEGIES[0], validBars, testAsset.ticker, testAsset.name);
      const resExplicit = BacktestEngine.runBacktest(ALL_QUANT_STRATEGIES[1], validBars, testAsset.ticker, testAsset.name, {}, undefined, {
        sourceType: 'SYNTHETIC',
        provider: 'Explicit Provider',
        isReproducible: true
      });

      const hasProv1 = resFallback.dataProvenance && typeof resFallback.dataProvenance.sourceType === 'string' && resFallback.dataProvenance.isReproducible;
      const hasProv2 = resExplicit.dataProvenance && resExplicit.dataProvenance.sourceType === 'SYNTHETIC';
      const passed = Boolean(hasProv1 && hasProv2);

      results.push({
        name: '10. BacktestResult Incluye DataProvenance Obligatorio',
        passed,
        message: passed ? 'OK: Todo BacktestResult contiene procedencia obligatoria y no-opcional.' : 'Fallo: BacktestResult sin procedencia.'
      });
    } catch (e: any) {
      results.push({ name: '10. BacktestResult Incluye DataProvenance Obligatorio', passed: false, message: e.message });
    }

    // Métricas Adicionales: Reproducibilidad determinista con seed
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
        name: '11. Reproducibilidad 100% Determinista (Mulberry32 PRNG)',
        passed: sameLength && exactMatch && differentFromRunC,
        message: exactMatch ? 'OK: Mismo seed produce exactamente la misma serie bit a bit.' : 'Fallo de reproducibilidad.'
      });
    } catch (e: any) {
      results.push({ name: '11. Reproducibilidad 100% Determinista (Mulberry32 PRNG)', passed: false, message: e.message });
    }

    // Métricas Adicionales: WinRate, Profit Factor & Max Drawdown
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
      const passed = metrics.profitFactor === 2.0 && metrics.winRatePct === 50.0;

      results.push({
        name: '12. Métricas de Ratio: WinRate (50%) & Profit Factor (2.0)',
        passed,
        message: `WinRate: ${metrics.winRatePct}%, ProfitFactor: ${metrics.profitFactor}`
      });
    } catch (e: any) {
      results.push({ name: '12. Métricas de Ratio: WinRate (50%) & Profit Factor (2.0)', passed: false, message: e.message });
    }

    // 13. Verificación de Modo NEXT_OPEN (Señal t Close → Ejecución t+1 Open)
    try {
      const customBars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { timestamp: '2026-01-02', open: 108, high: 112, low: 107, close: 110, volume: 1200 },
        { timestamp: '2026-01-03', open: 111, high: 115, low: 109, close: 112, volume: 1100 }
      ];

      // BuyAndHold emits BUY signal on bar 0 (2026-01-01)
      const resNextOpen = BacktestEngine.runBacktest(
        ALL_QUANT_STRATEGIES[0],
        customBars,
        'TEST_ASSET',
        'Test Asset',
        { executionMode: 'NEXT_OPEN', commissionPct: 0, slippagePct: 0 }
      );

      const trade = resNextOpen.trades[0];
      const correctSignalDate = trade?.signalDate === '2026-01-01';
      const correctEntryDate = trade?.entryDate === '2026-01-02';
      const correctEntryPrice = trade?.entryPrice === 108; // Bar 1 open price
      const passed = Boolean(
        resNextOpen.executionMode === 'NEXT_OPEN' &&
        trade &&
        correctSignalDate &&
        correctEntryDate &&
        correctEntryPrice
      );

      results.push({
        name: '13. Ejecución Estricta NEXT_OPEN (Señal t Close → Ejecución t+1 Open)',
        passed,
        message: passed
          ? `OK: Señal emitida en ${trade?.signalDate} (Close 102€) ejecutada en ${trade?.entryDate} a precio Open (${trade?.entryPrice}€).`
          : `Fallo: Señal o ejecución incorrecta (${trade?.signalDate} -> ${trade?.entryDate} a ${trade?.entryPrice}€)`
      });
    } catch (e: any) {
      results.push({ name: '13. Ejecución Estricta NEXT_OPEN', passed: false, message: e.message });
    }

    // 14. Verificación de Modo SAME_CLOSE (Experimental)
    try {
      const customBars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { timestamp: '2026-01-02', open: 108, high: 112, low: 107, close: 110, volume: 1200 }
      ];

      const resSameClose = BacktestEngine.runBacktest(
        ALL_QUANT_STRATEGIES[0],
        customBars,
        'TEST_ASSET',
        'Test Asset',
        { executionMode: 'SAME_CLOSE', commissionPct: 0, slippagePct: 0 }
      );

      const trade = resSameClose.trades[0];
      const isSameDate = trade?.entryDate === '2026-01-01';
      const isSamePrice = trade?.entryPrice === 102; // Bar 0 close
      const passed = resSameClose.executionMode === 'SAME_CLOSE' && isSameDate && isSamePrice;

      results.push({
        name: '14. Modo Experimental SAME_CLOSE (Mismo Close)',
        passed,
        message: passed
          ? 'OK: Modo SAME_CLOSE marcado explícitamente en BacktestResult y ejecutado en Close.'
          : 'Fallo en modo SAME_CLOSE.'
      });
    } catch (e: any) {
      results.push({ name: '14. Modo Experimental SAME_CLOSE', passed: false, message: e.message });
    }

    return results;
  }
}
