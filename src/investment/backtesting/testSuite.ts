import { FinancialMetricsCalculator } from './metrics';
import { BacktestTrade, EquityPoint, PriceBar } from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { SyntheticDataGenerator } from '../data/syntheticDataGenerator';
import { DataValidator } from '../data/validators';
import { BacktestEngine } from './engine';
import { ALL_AVAILABLE_ASSETS } from '../../data/marketData';
import { ALL_QUANT_STRATEGIES } from '../strategies/standardStrategies';

export class FinancialTestSuite {
  public static runAllTests(): { name: string; passed: boolean; message: string }[] {
    const results: { name: string; passed: boolean; message: string }[] = [];

    // Helper strategy
    const buyHoldStrategy: IStrategy = {
      id: 'test_buy_hold',
      name: 'Test Buy & Hold',
      description: 'Emits BUY on bar 0',
      category: 'BENCHMARK',
      defaultParameters: {},
      generateSignals: (b) => b.map((bar, idx) => ({
        timestamp: bar.timestamp,
        type: idx === 0 ? 'BUY' : 'HOLD',
        price: bar.close,
        reason: idx === 0 ? 'Initial Buy' : ''
      }))
    };

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

    // 11. Reproducibilidad determinista con seed
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

    // 12. Métricas de Ratio: WinRate & Profit Factor
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
          entryCommission: 0.05,
          exitCommission: 0.05,
          entrySlippageEur: 0.02,
          exitSlippageEur: 0.03,
          totalCommission: 0.1,
          totalSlippage: 0.05,
          totalTradingCosts: 0.15,
          grossPnlEur: 10,
          netPnlEur: 9.85,
          grossReturnPct: 10,
          netReturnPct: 9.85,
          pnlEur: 9.85,
          pnlPct: 9.85,
          returnFactor: 1.1,
          commissionPaid: 0.1,
          slippagePaid: 0.05,
          exitReason: 'SIGNAL',
          holdingPeriodBars: 4,
          isWin: true,
          intrabarConflict: false
        },
        {
          id: 't2',
          entryDate: '2026-01-06',
          exitDate: '2026-01-10',
          entryPrice: 110,
          exitPrice: 105,
          shares: 1,
          amountInvested: 110,
          entryCommission: 0.05,
          exitCommission: 0.05,
          entrySlippageEur: 0.02,
          exitSlippageEur: 0.03,
          totalCommission: 0.1,
          totalSlippage: 0.05,
          totalTradingCosts: 0.15,
          grossPnlEur: -5,
          netPnlEur: -5.15,
          grossReturnPct: -4.54,
          netReturnPct: -4.68,
          pnlEur: -5.15,
          pnlPct: -4.68,
          returnFactor: 0.95,
          commissionPaid: 0.1,
          slippagePaid: 0.05,
          exitReason: 'STOP_LOSS',
          holdingPeriodBars: 4,
          isWin: false,
          intrabarConflict: false
        }
      ];

      const mockEquity: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 0, positionMarketValue: 100, drawdownPct: 0 },
        { timestamp: '2026-01-05', equity: 110, cash: 110, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-10', equity: 105, cash: 105, positionMarketValue: 0, drawdownPct: 4.54 }
      ];

      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 105, mockEquity, mockTrades);
      const passed = metrics.winRatePct === 50.0 && metrics.profitFactor > 1.8;

      results.push({
        name: '12. Métricas de Ratio: WinRate (50%) & Profit Factor',
        passed,
        message: `WinRate: ${metrics.winRatePct}%, ProfitFactor: ${metrics.profitFactor}`
      });
    } catch (e: any) {
      results.push({ name: '12. Métricas de Ratio: WinRate & Profit Factor', passed: false, message: e.message });
    }

    // 13. Verificación de Modo NEXT_OPEN (Señal t Close → Ejecución t+1 Open)
    try {
      const customBars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { timestamp: '2026-01-02', open: 108, high: 112, low: 107, close: 110, volume: 1200 },
        { timestamp: '2026-01-03', open: 111, high: 115, low: 109, close: 112, volume: 1100 }
      ];

      const resNextOpen = BacktestEngine.runBacktest(
        buyHoldStrategy,
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
        buyHoldStrategy,
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

    // 15. Last Bar Unfilled (BUY en última barra → 0 trades, 1 unfilled order)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 95, close: 100, volume: 1000 }
      ];
      const lastBarBuyer: IStrategy = {
        id: 'last_bar_buyer',
        name: 'Last Bar Buyer',
        description: 'BUY only on last bar',
        category: 'MOMENTUM',
        defaultParameters: {},
        generateSignals: (b) => [
          { timestamp: b[0].timestamp, type: 'HOLD', price: b[0].close, reason: '' },
          { timestamp: b[1].timestamp, type: 'BUY', price: b[1].close, reason: 'Late signal' }
        ]
      };
      const res = BacktestEngine.runBacktest(lastBarBuyer, bars, 'TEST', 'Test', { executionMode: 'NEXT_OPEN' });
      const passed = res.trades.length === 0 && res.unfilledOrders.length === 1 && res.unfilledOrders[0].type === 'BUY';
      results.push({
        name: '15. Última Barra Sin Ejecutar (0 Trades, 1 Unfilled Order)',
        passed,
        message: passed
          ? 'OK: Señal en última barra no ejecutada registrada en unfilledOrders.'
          : `Fallo: Trades=${res.trades.length}, Unfilled=${res.unfilledOrders.length}`
      });
    } catch (e: any) {
      results.push({ name: '15. Última Barra Sin Ejecutar', passed: false, message: e.message });
    }

    // 16. Stop Loss Intrabar (Salida en esa misma barra cerca de Stop, no al open siguiente)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 }, // Signal BUY
        { timestamp: '2026-01-02', open: 100, high: 102, low: 95, close: 101, volume: 1000 }, // Enters at 100, hits 95 <= 96 stop
        { timestamp: '2026-01-03', open: 101, high: 105, low: 99, close: 103, volume: 1000 }
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        stopLossPct: 4.0, // Stop threshold = 96
        commissionPct: 0,
        slippagePct: 0
      });
      const trade = res.trades[0];
      const passed = trade && trade.exitDate === '2026-01-02' && Math.abs(trade.exitPrice - 96) < 0.01 && trade.exitReason === 'STOP_LOSS';
      results.push({
        name: '16. Stop Loss Intrabar Ejecutado en Misma Barra',
        passed: Boolean(passed),
        message: passed
          ? `OK: Stop Loss ejecutado el ${trade.exitDate} a precio ${trade.exitPrice}€ (no diferido a t+1).`
          : 'Fallo: Stop Loss no se ejecutó en la barra correspondiente.'
      });
    } catch (e: any) {
      results.push({ name: '16. Stop Loss Intrabar', passed: false, message: e.message });
    }

    // 17. Gap Stop (Stop 96, Bar.open 90 → Salida basada en 90, no 96)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 102, low: 98, close: 100, volume: 1000 }, // Enters at 100
        { timestamp: '2026-01-03', open: 90, high: 92, low: 88, close: 91, volume: 1000 } // Gap down open 90 < stop 96
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        stopLossPct: 4.0, // Stop = 96
        commissionPct: 0,
        slippagePct: 0
      });
      const trade = res.trades[0];
      const passed = trade && trade.exitDate === '2026-01-03' && trade.marketExitPrice === 90 && trade.exitPrice === 90 && trade.exitReason === 'STOP_LOSS';
      results.push({
        name: '17. Gap Bajista en Stop Loss (Ejecución a Open 90€, no 96€)',
        passed: Boolean(passed),
        message: passed
          ? `OK: Salida por gap ejecutada a ${trade.exitPrice}€ (precio Open del gap).`
          : `Fallo: Salida ejecutada a ${trade?.exitPrice}€`
      });
    } catch (e: any) {
      results.push({ name: '17. Gap Bajista en Stop Loss', passed: false, message: e.message });
    }

    // 18. Take Profit Intrabar (Tocado por High)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 112, low: 99, close: 103, volume: 1000 } // Enters 100, High 112 >= 110 TP
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        takeProfitPct: 10.0, // TP = 110
        commissionPct: 0,
        slippagePct: 0
      });
      const trade = res.trades[0];
      const passed = trade && trade.exitDate === '2026-01-02' && Math.abs(trade.exitPrice - 110) < 0.01 && trade.exitReason === 'TAKE_PROFIT';
      results.push({
        name: '18. Take Profit Intrabar Tocado por High (110€)',
        passed: Boolean(passed),
        message: passed
          ? `OK: Take Profit ejecutado exactamente a ${trade.exitPrice}€ por High intrabar.`
          : 'Fallo en ejecución de Take Profit.'
      });
    } catch (e: any) {
      results.push({ name: '18. Take Profit Intrabar', passed: false, message: e.message });
    }

    // 19. Conflicto Intrabar (High toca TP y Low toca SL → CONSERVATIVE elige STOP)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 115, low: 92, close: 105, volume: 1000 } // High 115 >= 110, Low 92 <= 95
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        takeProfitPct: 10.0, // TP 110
        stopLossPct: 5.0, // SL 95
        intrabarConflictPolicy: 'CONSERVATIVE',
        commissionPct: 0,
        slippagePct: 0
      });
      const trade = res.trades[0];
      const passed = trade && trade.intrabarConflict && trade.exitReason === 'STOP_LOSS' && Math.abs(trade.exitPrice - 95) < 0.01;
      results.push({
        name: '19. Conflicto Intrabar (Política CONSERVATIVE → Prioriza Stop Loss)',
        passed: Boolean(passed),
        message: passed
          ? 'OK: Detectado conflicto simultáneo TP/SL y resuelto conservadoramente por Stop Loss.'
          : 'Fallo al resolver conflicto intrabar.'
      });
    } catch (e: any) {
      results.push({ name: '19. Conflicto Intrabar', passed: false, message: e.message });
    }

    // 20. Desglose Completo de Costes de Trading
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-03', open: 110, high: 115, low: 108, close: 110, volume: 1000 }
      ];
      const sellStrategy: IStrategy = {
        id: 'buy_sell',
        name: 'Buy Sell',
        description: '',
        category: 'MOMENTUM',
        defaultParameters: {},
        generateSignals: (b) => [
          { timestamp: b[0].timestamp, type: 'BUY', price: b[0].close, reason: '' },
          { timestamp: b[1].timestamp, type: 'SELL', price: b[1].close, reason: '' },
          { timestamp: b[2].timestamp, type: 'HOLD', price: b[2].close, reason: '' }
        ]
      };
      const res = BacktestEngine.runBacktest(sellStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        initialCapital: 1000,
        commissionPct: 0.1,
        slippagePct: 0.05
      });
      const trade = res.trades[0];
      const passed = Boolean(
        trade &&
        trade.entryCommission > 0 &&
        trade.exitCommission > 0 &&
        trade.entrySlippageEur > 0 &&
        trade.exitSlippageEur > 0 &&
        Math.abs(trade.totalTradingCosts - (trade.totalCommission + trade.totalSlippage)) < 0.01
      );
      results.push({
        name: '20. Desglose Completo de Costes (Comisiones + Slippage Entrada/Salida)',
        passed,
        message: passed
          ? `OK: Costes totales=${trade.totalTradingCosts}€ (Comisiones: ${trade.totalCommission}€, Slippage: ${trade.totalSlippage}€).`
          : 'Fallo en desglose de costes.'
      });
    } catch (e: any) {
      results.push({ name: '20. Desglose de Costes', passed: false, message: e.message });
    }

    // 21. Gross vs Net PnL (Gross > Net cuando existen costes)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-03', open: 110, high: 115, low: 108, close: 110, volume: 1000 }
      ];
      const sellStrategy: IStrategy = {
        id: 'buy_sell_2',
        name: 'Buy Sell 2',
        description: '',
        category: 'MOMENTUM',
        defaultParameters: {},
        generateSignals: (b) => [
          { timestamp: b[0].timestamp, type: 'BUY', price: b[0].close, reason: '' },
          { timestamp: b[1].timestamp, type: 'SELL', price: b[1].close, reason: '' },
          { timestamp: b[2].timestamp, type: 'HOLD', price: b[2].close, reason: '' }
        ]
      };
      const res = BacktestEngine.runBacktest(sellStrategy, bars, 'TEST', 'Test', {
        executionMode: 'NEXT_OPEN',
        initialCapital: 1000,
        commissionPct: 0.1,
        slippagePct: 0.05
      });
      const trade = res.trades[0];
      const passed = Boolean(trade && trade.grossPnlEur > trade.netPnlEur && trade.grossReturnPct > trade.netReturnPct);
      results.push({
        name: '21. Relación Gross PnL > Net PnL con Fricción',
        passed,
        message: passed
          ? `OK: Gross PnL (${trade.grossPnlEur}€) > Net PnL (${trade.netPnlEur}€).`
          : 'Fallo: Gross PnL no es estrictamente superior a Net PnL.'
      });
    } catch (e: any) {
      results.push({ name: '21. Gross vs Net PnL', passed: false, message: e.message });
    }

    // 22. Cash Nunca Negativo con positionSizingPct = 100
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-03', open: 90, high: 95, low: 88, close: 92, volume: 1000 }
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        positionSizingPct: 100.0,
        commissionPct: 0.2,
        slippagePct: 0.1
      });
      const noNegativeCash = res.equityCurve.every(pt => pt.cash >= -0.001);
      results.push({
        name: '22. Saldo de Caja Estrictamente No-Negativo (Cash >= 0)',
        passed: noNegativeCash,
        message: noNegativeCash
          ? 'OK: En todas las barras el saldo de caja permaneció no-negativo (sin sobregiro).'
          : 'Fallo: Saldo de caja negativo detectado.'
      });
    } catch (e: any) {
      results.push({ name: '22. Saldo de Caja No-Negativo', passed: false, message: e.message });
    }

    // 23. Benchmark Inmune a Stops de Estrategia
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 102, low: 92, close: 95, volume: 1000 },
        { timestamp: '2026-01-03', open: 96, high: 120, low: 95, close: 118, volume: 1000 }
      ];
      const resWithStops = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        stopLossPct: 2.0,
        trailingStopPct: 2.0
      });
      const resWithoutStops = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        stopLossPct: undefined,
        trailingStopPct: undefined
      });
      const sameBenchmark =
        resWithStops.metrics.benchmarkTotalReturnPct === resWithoutStops.metrics.benchmarkTotalReturnPct &&
        resWithStops.equityCurve[2].benchmarkEquity === resWithoutStops.equityCurve[2].benchmarkEquity;
      results.push({
        name: '23. Benchmark Independiente e Inmune a Parámetros de Riesgo',
        passed: sameBenchmark,
        message: sameBenchmark
          ? `OK: Retorno del Benchmark (${resWithStops.metrics.benchmarkTotalReturnPct}%) permanece inalterado por stops.`
          : 'Fallo: Benchmark afectado por configuración de stops.'
      });
    } catch (e: any) {
      results.push({ name: '23. Benchmark Inmune a Stops', passed: false, message: e.message });
    }

    // 24. Integridad Contable de Curva de Patrimonio (Equity = Cash + MarketValue)
    try {
      const bars: PriceBar[] = [
        { timestamp: '2026-01-01', open: 100, high: 105, low: 98, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 100, high: 105, low: 98, close: 104, volume: 1000 },
        { timestamp: '2026-01-03', open: 105, high: 110, low: 102, close: 108, volume: 1000 }
      ];
      const res = BacktestEngine.runBacktest(buyHoldStrategy, bars, 'TEST', 'Test', {
        initialCapital: 500,
        commissionPct: 0.05,
        slippagePct: 0.02
      });
      const allBarsConsistent = res.equityCurve.every(pt => Math.abs(pt.equity - (pt.cash + pt.positionMarketValue)) <= 0.01);
      results.push({
        name: '24. Ecuación Patrimonial Estricta (Equity ≡ Cash + PositionValue)',
        passed: allBarsConsistent,
        message: allBarsConsistent
          ? 'OK: Todas las barras satisfacen la identidad contable Equity = Cash + PositionMarketValue.'
          : 'Fallo en la ecuación patrimonial.'
      });
    } catch (e: any) {
      results.push({ name: '24. Ecuación Patrimonial', passed: false, message: e.message });
    }

    // 25. Rechazo de Input Desordenado sin Ordenación Silenciosa
    try {
      const unorderedBars: PriceBar[] = [
        { timestamp: '2026-01-05', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2026-01-02', open: 101, high: 106, low: 96, close: 102, volume: 1000 }
      ];
      let threwValidationError = false;
      try {
        BacktestEngine.runBacktest(ALL_QUANT_STRATEGIES[0], unorderedBars, 'TEST', 'Test');
      } catch (e: any) {
        threwValidationError = true;
      }
      results.push({
        name: '25. Input Desordenado Rechazado sin Auto-Ordenación Silenciosa',
        passed: threwValidationError,
        message: threwValidationError
          ? 'OK: BacktestEngine rechaza explícitamente series temporales no ordenadas cronológicamente.'
          : 'Fallo: BacktestEngine procesó u ordenó silenciosamente datos inválidos.'
      });
    } catch (e: any) {
      results.push({ name: '25. Input Desordenado Rechazado', passed: false, message: e.message });
    }

    return results;
  }
}
