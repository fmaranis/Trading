import { FinancialMetricsCalculator } from './metrics';
import { BacktestTrade, EquityPoint, PriceBar } from './types';
import { IStrategy } from '../strategies/baseStrategy';
import { SyntheticDataGenerator } from '../data/syntheticDataGenerator';
import { DataValidator } from '../data/validators';
import { BacktestEngine } from './engine';
import { WalkForwardEngine } from './walkForward';
import { WalkForwardConfig, ParameterRange } from './types';
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

    // 26. Detección de Frecuencia Temporal (Daily, Weekly, Monthly, Unknown)
    try {
      const dailyCurve: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-05', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-06', equity: 103, cash: 103, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const weeklyCurve: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-08', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-15', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const monthlyCurve: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-02-01', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-03-01', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 }
      ];

      const dailyFreq = FinancialMetricsCalculator.detectFrequency(dailyCurve);
      const weeklyFreq = FinancialMetricsCalculator.detectFrequency(weeklyCurve);
      const monthlyFreq = FinancialMetricsCalculator.detectFrequency(monthlyCurve);

      const passed =
        dailyFreq.frequency === 'DAILY' && dailyFreq.periodsPerYear === 252 &&
        weeklyFreq.frequency === 'WEEKLY' && weeklyFreq.periodsPerYear === 52 &&
        monthlyFreq.frequency === 'MONTHLY' && monthlyFreq.periodsPerYear === 12;

      results.push({
        name: '26. Detección Rigurosa de Frecuencia Temporal',
        passed,
        message: passed
          ? `OK: Frecuencias detectadas correctamente (Daily=252, Weekly=52, Monthly=12).`
          : `Fallo en detección: D=${dailyFreq.frequency}, W=${weeklyFreq.frequency}, M=${monthlyFreq.frequency}`
      });
    } catch (e: any) {
      results.push({ name: '26. Detección de Frecuencia', passed: false, message: e.message });
    }

    // 27. Retornos Periódicos Decimales Exactos
    try {
      const eqCurve: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 105, cash: 105, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-03', equity: 102.9, cash: 102.9, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-04', equity: 108.045, cash: 108.045, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const returns = FinancialMetricsCalculator.calculatePeriodicReturns(eqCurve);
      const expected = [0.05, -0.02, 0.05];
      const passed = returns.length === 3 && returns.every((r, idx) => Math.abs(r - expected[idx]) < 1e-6);

      results.push({
        name: '27. Retornos Periódicos Decimales Exactos',
        passed,
        message: passed
          ? 'OK: Retornos periódicos calculados en formato decimal exacto (+5%, -2%, +5%).'
          : `Fallo en retornos: ${JSON.stringify(returns)}`
      });
    } catch (e: any) {
      results.push({ name: '27. Retornos Periódicos', passed: false, message: e.message });
    }

    // 28. Varianza y Desviación Típica Muestral (n-1)
    try {
      const vec = [0.02, -0.01, 0.04, 0.01];
      const mean = (0.02 - 0.01 + 0.04 + 0.01) / 4; // 0.015
      const sqDiffs = [(0.02 - 0.015) ** 2, (-0.01 - 0.015) ** 2, (0.04 - 0.015) ** 2, (0.01 - 0.015) ** 2];
      const expectedVar = sqDiffs.reduce((a, b) => a + b, 0) / 3; // sample variance (n - 1 = 3)
      const expectedStd = Math.sqrt(expectedVar);

      const metrics = FinancialMetricsCalculator.calculateMetrics(
        100,
        106.12,
        [
          { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
          { timestamp: '2026-01-02', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 },
          { timestamp: '2026-01-03', equity: 100.98, cash: 100.98, positionMarketValue: 0, drawdownPct: 0 },
          { timestamp: '2026-01-04', equity: 105.0192, cash: 105.0192, positionMarketValue: 0, drawdownPct: 0 },
          { timestamp: '2026-01-05', equity: 106.069392, cash: 106.069392, positionMarketValue: 0, drawdownPct: 0 }
        ],
        [],
        0,
        0,
        { frequency: 'DAILY', periodsPerYear: 252 }
      );

      const computedAnnualVol = metrics.annualizedVolatilityPct;
      const expectedAnnualVol = expectedStd * Math.sqrt(252) * 100;
      const passed = computedAnnualVol !== null && Math.abs(computedAnnualVol - expectedAnnualVol) < 0.01;

      results.push({
        name: '28. Varianza y Desviación Típica Muestral (n-1)',
        passed,
        message: passed
          ? `OK: Volatilidad anualizada muestral exacta (${computedAnnualVol?.toFixed(2)}%).`
          : `Fallo: esperado ${expectedAnnualVol}, obtenido ${computedAnnualVol}`
      });
    } catch (e: any) {
      results.push({ name: '28. Varianza Muestral', passed: false, message: e.message });
    }

    // 29. Covarianza y Correlación Muestral con Benchmark Alineado
    try {
      const eqStrat: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 100 },
        { timestamp: '2026-01-02', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 101 },
        { timestamp: '2026-01-03', equity: 104, cash: 104, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 102 },
        { timestamp: '2026-01-04', equity: 106, cash: 106, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 103 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(
        100,
        106,
        eqStrat,
        [],
        3,
        0,
        { frequency: 'DAILY', periodsPerYear: 252 }
      );

      const passed =
        metrics.benchmarkCorrelation !== null &&
        Math.abs(metrics.benchmarkCorrelation - 1.0) < 0.001 &&
        metrics.rSquared !== null &&
        Math.abs(metrics.rSquared - 1.0) < 0.001 &&
        metrics.beta !== null &&
        Math.abs(metrics.beta - 2.0) < 0.05;

      results.push({
        name: '29. Covarianza, Beta y Correlación Perfecta Muestral',
        passed,
        message: passed
          ? `OK: Correlación = ${metrics.benchmarkCorrelation?.toFixed(2)}, R² = ${metrics.rSquared?.toFixed(2)}, Beta = ${metrics.beta?.toFixed(2)}.`
          : `Fallo en correlación/beta: Corr=${metrics.benchmarkCorrelation}, Beta=${metrics.beta}`
      });
    } catch (e: any) {
      results.push({ name: '29. Covarianza y Correlación', passed: false, message: e.message });
    }

    // 30. CAGR Basado en Timestamps Reales (Años Transcurridos)
    try {
      const eqCurve2Years: EquityPoint[] = [
        { timestamp: '2024-01-01T00:00:00Z', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-01T00:00:00Z', equity: 121, cash: 121, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 121, eqCurve2Years, []);
      // 100 -> 121 in 2.0 years => (1.21)^(0.5) - 1 = 1.1 - 1 = 10.0%
      const passed = metrics.cagrPct !== null && Math.abs(metrics.cagrPct - 10.0) < 0.1;

      results.push({
        name: '30. CAGR Temporal Basado en Timestamps Exactos',
        passed,
        message: passed
          ? `OK: CAGR exacto calculado a partir de fechas calendario (${metrics.cagrPct?.toFixed(2)}%).`
          : `Fallo en CAGR: ${metrics.cagrPct}`
      });
    } catch (e: any) {
      results.push({ name: '30. CAGR Temporal', passed: false, message: e.message });
    }

    // 31. Sharpe Ratio con Tasa Libre de Riesgo Anualizada
    try {
      const eqDaily: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-05', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-06', equity: 103, cash: 103, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 103, eqDaily, [], 0, 3.0, {
        frequency: 'DAILY',
        periodsPerYear: 252
      });
      const passed = metrics.sharpeRatio !== null && metrics.sharpeRatio > 0 && !isNaN(metrics.sharpeRatio);

      results.push({
        name: '31. Sharpe Ratio Anualizado con Descuento de Rf Periódico',
        passed,
        message: passed
          ? `OK: Sharpe Ratio calculado con Rf periódica (${metrics.sharpeRatio?.toFixed(2)}).`
          : `Fallo en Sharpe: ${metrics.sharpeRatio}`
      });
    } catch (e: any) {
      results.push({ name: '31. Sharpe Ratio', passed: false, message: e.message });
    }

    // 32. Sortino Ratio con Downside Deviation y MAR
    try {
      const eqVol: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 103, cash: 103, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-03', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-04', equity: 105, cash: 105, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-05', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-06', equity: 107, cash: 107, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 107, eqVol, [], 0, 2.0, {
        frequency: 'DAILY',
        periodsPerYear: 252
      });
      const passed = metrics.sortinoRatio !== null && metrics.sortinoRatio > 0;

      results.push({
        name: '32. Sortino Ratio con Downside Deviation Frente a MAR',
        passed,
        message: passed
          ? `OK: Sortino Ratio calculado exclusivamente sobre caídas (${metrics.sortinoRatio?.toFixed(2)}).`
          : `Fallo en Sortino: ${metrics.sortinoRatio}`
      });
    } catch (e: any) {
      results.push({ name: '32. Sortino Ratio', passed: false, message: e.message });
    }

    // 33. Max Drawdown y Duración de Caída
    try {
      const eqDD: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 120, cash: 120, positionMarketValue: 0, drawdownPct: 0 }, // Peak
        { timestamp: '2026-01-03', equity: 108, cash: 108, positionMarketValue: 0, drawdownPct: 10 },
        { timestamp: '2026-01-04', equity: 96, cash: 96, positionMarketValue: 0, drawdownPct: 20 },  // Trough: (120-96)/120 = 20%
        { timestamp: '2026-01-05', equity: 114, cash: 114, positionMarketValue: 0, drawdownPct: 5 },
        { timestamp: '2026-01-06', equity: 130, cash: 130, positionMarketValue: 0, drawdownPct: 0 }  // Recovery
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 130, eqDD, []);
      const passed =
        Math.abs(metrics.maxDrawdownPct - 20.0) < 0.01 &&
        metrics.maxDrawdownDurationBars === 3 &&
        metrics.maxDrawdownStart === '2026-01-02' &&
        metrics.maxDrawdownTrough === '2026-01-04' &&
        metrics.maxDrawdownRecovery === '2026-01-06';

      results.push({
        name: '33. Max Drawdown y Trazabilidad de Duración/Recuperación',
        passed,
        message: passed
          ? `OK: Max Drawdown = ${metrics.maxDrawdownPct}% (Pico: ${metrics.maxDrawdownStart}, Fondo: ${metrics.maxDrawdownTrough}, Recuperación: ${metrics.maxDrawdownRecovery}).`
          : `Fallo en Max DD: ${metrics.maxDrawdownPct}%, Start: ${metrics.maxDrawdownStart}, End: ${metrics.maxDrawdownRecovery}`
      });
    } catch (e: any) {
      results.push({ name: '33. Max Drawdown', passed: false, message: e.message });
    }

    // 34. Calmar Ratio (CAGR / Max DD)
    try {
      const eqCalmar: EquityPoint[] = [
        { timestamp: '2025-01-01T00:00:00Z', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2025-06-01T00:00:00Z', equity: 90, cash: 90, positionMarketValue: 0, drawdownPct: 10 },
        { timestamp: '2026-01-01T00:00:00Z', equity: 120, cash: 120, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 120, eqCalmar, []);
      // CAGR ~ 20%, Max DD = 10% => Calmar ~ 2.0
      const passed = metrics.calmarRatio !== null && Math.abs(metrics.calmarRatio - 2.0) < 0.1;

      results.push({
        name: '34. Calmar Ratio (CAGR / Max Drawdown)',
        passed,
        message: passed
          ? `OK: Calmar Ratio exacto (${metrics.calmarRatio?.toFixed(2)}).`
          : `Fallo en Calmar: ${metrics.calmarRatio}`
      });
    } catch (e: any) {
      results.push({ name: '34. Calmar Ratio', passed: false, message: e.message });
    }

    // 35. Profit Factor y Win/Loss Ratio con Manejo Seguro de Cero Pérdidas (Null)
    try {
      const winTrades: BacktestTrade[] = [
        {
          id: 'T1',
          entryDate: '2026-01-01',
          exitDate: '2026-01-02',
          entryPrice: 100,
          exitPrice: 110,
          shares: 1,
          amountInvested: 100,
          entryCommission: 0,
          exitCommission: 0,
          entrySlippageEur: 0,
          exitSlippageEur: 0,
          totalCommission: 0,
          totalSlippage: 0,
          totalTradingCosts: 0,
          grossPnlEur: 10,
          netPnlEur: 10,
          grossReturnPct: 10,
          netReturnPct: 10,
          pnlEur: 10,
          pnlPct: 10,
          commissionPaid: 0,
          slippagePaid: 0,
          returnFactor: 1.1,
          exitReason: 'TAKE_PROFIT',
          holdingPeriodBars: 1,
          isWin: true,
          intrabarConflict: false
        }
      ];
      const metricsNoLoss = FinancialMetricsCalculator.calculateMetrics(100, 110, [], winTrades);
      const passed = metricsNoLoss.profitFactor === null && metricsNoLoss.winLossRatio === null;

      results.push({
        name: '35. Profit Factor Nulo en Ausencia de Pérdidas (Sin Divisiones por Cero)',
        passed,
        message: passed
          ? 'OK: Profit Factor y Win/Loss Ratio son null (no 99.9 ni Infinity) cuando no hay trades perdedores.'
          : `Fallo: Profit Factor = ${metricsNoLoss.profitFactor}`
      });
    } catch (e: any) {
      results.push({ name: '35. Profit Factor Seguro', passed: false, message: e.message });
    }

    // 36. Esperanza Matemática por Operación (Expectancy)
    try {
      const trades: BacktestTrade[] = [
        {
          id: 'T1',
          entryDate: '2026-01-01',
          exitDate: '2026-01-02',
          entryPrice: 100,
          exitPrice: 110,
          shares: 1,
          amountInvested: 100,
          entryCommission: 0,
          exitCommission: 0,
          entrySlippageEur: 0,
          exitSlippageEur: 0,
          totalCommission: 0,
          totalSlippage: 0,
          totalTradingCosts: 0,
          grossPnlEur: 10,
          netPnlEur: 10,
          grossReturnPct: 10,
          netReturnPct: 10,
          pnlEur: 10,
          pnlPct: 10,
          commissionPaid: 0,
          slippagePaid: 0,
          returnFactor: 1.1,
          exitReason: 'SIGNAL',
          holdingPeriodBars: 1,
          isWin: true,
          intrabarConflict: false
        },
        {
          id: 'T2',
          entryDate: '2026-01-03',
          exitDate: '2026-01-04',
          entryPrice: 100,
          exitPrice: 95,
          shares: 1,
          amountInvested: 100,
          entryCommission: 0,
          exitCommission: 0,
          entrySlippageEur: 0,
          exitSlippageEur: 0,
          totalCommission: 0,
          totalSlippage: 0,
          totalTradingCosts: 0,
          grossPnlEur: -5,
          netPnlEur: -5,
          grossReturnPct: -5,
          netReturnPct: -5,
          pnlEur: -5,
          pnlPct: -5,
          commissionPaid: 0,
          slippagePaid: 0,
          returnFactor: 0.95,
          exitReason: 'STOP_LOSS',
          holdingPeriodBars: 1,
          isWin: false,
          intrabarConflict: false
        }
      ];
      // 50% win (10€), 50% loss (5€) => Expectancy = 0.5 * 10 - 0.5 * 5 = +2.50 €
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 105, [], trades);
      const passed = Math.abs(metrics.expectancyEur - 2.50) < 0.01;

      results.push({
        name: '36. Esperanza Matemática por Trade (Expectancy EUR y %)',
        passed,
        message: passed
          ? `OK: Esperanza matemática exacta (+${metrics.expectancyEur.toFixed(2)} € por operación).`
          : `Fallo en Expectancy: ${metrics.expectancyEur}`
      });
    } catch (e: any) {
      results.push({ name: '36. Expectancy', passed: false, message: e.message });
    }

    // 37. Desglose Integral de Costes de Trading
    try {
      const tradesWithCosts: BacktestTrade[] = [
        {
          id: 'T1',
          entryDate: '2026-01-01',
          exitDate: '2026-01-02',
          entryPrice: 100.02,
          exitPrice: 109.98,
          shares: 1,
          amountInvested: 100,
          entryCommission: 0.05,
          exitCommission: 0.05,
          entrySlippageEur: 0.02,
          exitSlippageEur: 0.02,
          totalCommission: 0.10,
          totalSlippage: 0.04,
          totalTradingCosts: 0.14,
          grossPnlEur: 10,
          netPnlEur: 9.86,
          grossReturnPct: 10,
          netReturnPct: 9.86,
          pnlEur: 9.86,
          pnlPct: 9.86,
          commissionPaid: 0.10,
          slippagePaid: 0.04,
          returnFactor: 1.0986,
          exitReason: 'SIGNAL',
          holdingPeriodBars: 1,
          isWin: true,
          intrabarConflict: false
        }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 109.86, [], tradesWithCosts);
      const passed =
        Math.abs(metrics.totalCommissionEur - 0.10) < 0.001 &&
        Math.abs(metrics.totalSlippageEur - 0.04) < 0.001 &&
        Math.abs(metrics.totalTradingCostsEur - 0.14) < 0.001 &&
        Math.abs(metrics.tradingCostsPctOfInitialCapital - 0.14) < 0.001;

      results.push({
        name: '37. Desglose Integral de Costes de Trading e Impacto en Capital',
        passed,
        message: passed
          ? `OK: Costes desglosados (Comisiones: ${metrics.totalCommissionEur}€, Slippage: ${metrics.totalSlippageEur}€, Total: ${metrics.totalTradingCostsEur}€).`
          : `Fallo en costes: Comm=${metrics.totalCommissionEur}, Slip=${metrics.totalSlippageEur}`
      });
    } catch (e: any) {
      results.push({ name: '37. Desglose de Costes', passed: false, message: e.message });
    }

    // 38. Jensen's Alpha Anualizado y Ratio de Información con Benchmark
    try {
      const eqAlpha: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 100 },
        { timestamp: '2026-01-02', equity: 104, cash: 104, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 102 },
        { timestamp: '2026-01-03', equity: 102, cash: 102, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 101 },
        { timestamp: '2026-01-04', equity: 108, cash: 108, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 104 },
        { timestamp: '2026-01-05', equity: 106, cash: 106, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 103 },
        { timestamp: '2026-01-06', equity: 112, cash: 112, positionMarketValue: 0, drawdownPct: 0, benchmarkEquity: 106 }
      ];
      const metrics = FinancialMetricsCalculator.calculateMetrics(100, 112, eqAlpha, [], 6, 2.0, {
        frequency: 'DAILY',
        periodsPerYear: 252
      });

      const passed = metrics.alphaAnnualizedPct !== null && metrics.informationRatio !== null;

      results.push({
        name: '38. Jensen Alpha Anualizado y Information Ratio con Benchmark',
        passed,
        message: passed
          ? `OK: Alpha = ${metrics.alphaAnnualizedPct?.toFixed(2)}%, IR = ${metrics.informationRatio?.toFixed(2)}.`
          : `Fallo en Alpha/IR: Alpha=${metrics.alphaAnnualizedPct}, IR=${metrics.informationRatio}`
      });
    } catch (e: any) {
      results.push({ name: '38. Alpha e IR', passed: false, message: e.message });
    }

    // 39. Diagnóstico de Calidad de Métricas (FULL / PARTIAL / INSUFFICIENT_DATA)
    try {
      const shortCurve: EquityPoint[] = [
        { timestamp: '2026-01-01', equity: 100, cash: 100, positionMarketValue: 0, drawdownPct: 0 },
        { timestamp: '2026-01-02', equity: 101, cash: 101, positionMarketValue: 0, drawdownPct: 0 }
      ];
      const midCurve: EquityPoint[] = Array.from({ length: 5 }, (_, i) => ({
        timestamp: `2026-01-0${i + 1}`,
        equity: 100 + i,
        cash: 100 + i,
        positionMarketValue: 0,
        drawdownPct: 0
      }));
      const fullCurve: EquityPoint[] = Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
        equity: 100 + i * 0.5,
        cash: 100 + i * 0.5,
        positionMarketValue: 0,
        drawdownPct: 0
      }));

      const mShort = FinancialMetricsCalculator.calculateMetrics(100, 101, shortCurve, []);
      const mMid = FinancialMetricsCalculator.calculateMetrics(100, 104, midCurve, []);
      const mFull = FinancialMetricsCalculator.calculateMetrics(100, 110, fullCurve, []);

      const passed =
        mShort.diagnostics.quality === 'INSUFFICIENT_DATA' &&
        mMid.diagnostics.quality === 'PARTIAL' &&
        mFull.diagnostics.quality === 'FULL';

      results.push({
        name: '39. Diagnóstico de Calidad de Métricas (FULL / PARTIAL / INSUFFICIENT_DATA)',
        passed,
        message: passed
          ? 'OK: Trazabilidad de calidad auditada según el tamaño de muestra y regularidad temporal.'
          : `Fallo: Short=${mShort.diagnostics.quality}, Mid=${mMid.diagnostics.quality}, Full=${mFull.diagnostics.quality}`
      });
    } catch (e: any) {
      results.push({ name: '39. Diagnóstico de Calidad', passed: false, message: e.message });
    }

    // 40. Holdout Validation (70/30 Split) con Separación Estricta
    try {
      const bars = SyntheticDataGenerator.generateBars(60, { basePrice: 100, volatility: 0.01, trend: 0.001 });
      const holdoutRes = WalkForwardEngine.runHoldoutValidation(buyHoldStrategy, bars, 0.70);
      const passed =
        holdoutRes.inSampleResult.equityCurve.length === 42 &&
        holdoutRes.outOfSampleResult.equityCurve.length === 18 &&
        typeof holdoutRes.efficiencyRatio === 'number' &&
        typeof holdoutRes.isRobust === 'boolean';

      results.push({
        name: '40. Holdout Validation (Partición In-Sample / Out-of-Sample 70-30)',
        passed,
        message: passed
          ? `OK: Holdout ejecutado con 42 barras Train y 18 barras Test (Efficiency Ratio: ${holdoutRes.efficiencyRatio}).`
          : 'Fallo en partición de Holdout Validation.'
      });
    } catch (e: any) {
      results.push({ name: '40. Holdout Validation', passed: false, message: e.message });
    }

    // 41. Generación de Rejilla de Parámetros (Cartesian Product)
    try {
      const grid: ParameterRange[] = [
        { name: 'fastPeriod', values: [5, 10] },
        { name: 'slowPeriod', values: [20, 50, 100] },
        { name: 'threshold', values: [1.5] }
      ];
      const combinations = WalkForwardEngine.generateParameterCombinations(grid);
      const passed =
        combinations.length === 6 &&
        combinations.every(c => 'fastPeriod' in c && 'slowPeriod' in c && 'threshold' in c);

      results.push({
        name: '41. Generación de Rejilla de Parámetros (Producto Cartesiano)',
        passed,
        message: passed
          ? `OK: ${combinations.length} combinaciones generadas exactamente a partir de la rejilla.`
          : `Fallo: se generaron ${combinations.length} combinaciones (esperadas 6).`
      });
    } catch (e: any) {
      results.push({ name: '41. Rejilla Parámetros', passed: false, message: e.message });
    }

    // 42. Aislamiento Estricto de Datos: Cero Fuga de Información en WFO Train vs Test
    try {
      // Creamos dos series que tienen EXACTAMENTE los mismos datos en los primeros 30 compases (Train),
      // pero datos completamente divergentes en los compases 31-45 (Test).
      const trainPart = SyntheticDataGenerator.generateBars(30, { basePrice: 100, volatility: 0.01, trend: 0.002, seed: 123 });
      const testPartA = SyntheticDataGenerator.generateBars(15, { basePrice: 110, volatility: 0.02, trend: 0.005, seed: 456 });
      const testPartB = SyntheticDataGenerator.generateBars(15, { basePrice: 110, volatility: 0.05, trend: -0.01, seed: 789 });

      // Ajustamos fechas correlativas para la serie B
      const seriesA = [...trainPart, ...testPartA];
      const seriesB = [...trainPart, ...testPartB.map((b, idx) => ({ ...b, timestamp: `2026-02-${(idx + 1).toString().padStart(2, '0')}` }))];

      const rsiStrat = ALL_QUANT_STRATEGIES.find(s => s.id === 'rsi_mean_reversion') || ALL_QUANT_STRATEGIES[0];
      const wfoCfg: WalkForwardConfig = {
        trainWindowBars: 30,
        testWindowBars: 15,
        stepBars: 15,
        optimizationMetric: 'TOTAL_RETURN',
        minimumTrades: 0,
        parameterGrid: [
          { name: 'oversold', values: [20, 30, 40] },
          { name: 'overbought', values: [60, 70, 80] }
        ]
      };

      const resA = WalkForwardEngine.runWalkForwardOptimization(rsiStrat, seriesA, wfoCfg);
      const resB = WalkForwardEngine.runWalkForwardOptimization(rsiStrat, seriesB, wfoCfg);

      // Los parámetros seleccionados en la ventana 1 (Train) DEBEN SER IDÉNTICOS,
      // demostrando que ningún dato de Test afectó a la optimización de Train.
      const paramMatch = JSON.stringify(resA.windows[0].selectedParameters) === JSON.stringify(resB.windows[0].selectedParameters);
      const trainScoreMatch = Math.abs(resA.windows[0].trainMetrics.totalReturnPct - resB.windows[0].trainMetrics.totalReturnPct) < 1e-6;
      const testDiffers = resA.windows[0].testMetrics.totalReturnPct !== resB.windows[0].testMetrics.totalReturnPct;

      const passed = paramMatch && trainScoreMatch && testDiffers;

      results.push({
        name: '42. Aislamiento Estricto de Datos: Cero Fuga de Información en WFO Train vs Test',
        passed,
        message: passed
          ? 'OK: Los parámetros de Train son 100% idénticos e inmunes a cambios futuros en Test (cero lookahead bias).'
          : 'Fallo: Hubo fuga de información entre Train y Test.'
      });
    } catch (e: any) {
      results.push({ name: '42. Aislamiento WFO', passed: false, message: e.message });
    }

    // 43. Desplazamiento y Segmentación de Ventanas Rolling WFO
    try {
      const bars = SyntheticDataGenerator.generateBars(80, { basePrice: 100, volatility: 0.01 });
      const wfoCfg: WalkForwardConfig = {
        trainWindowBars: 30,
        testWindowBars: 10,
        stepBars: 10,
        optimizationMetric: 'SHARPE',
        minimumTrades: 0,
        parameterGrid: [{ name: 'param', values: [1, 2] }]
      };

      const wfoRes = WalkForwardEngine.runWalkForwardOptimization(buyHoldStrategy, bars, wfoCfg);
      // Con 80 barras:
      // W1: Train [0..30], Test [30..40]
      // W2: Train [10..40], Test [40..50]
      // W3: Train [20..50], Test [50..60]
      // W4: Train [30..60], Test [60..70]
      // W5: Train [40..70], Test [70..80]
      // Total 5 ventanas
      const passed =
        wfoRes.windows.length === 5 &&
        wfoRes.windows[0].trainBarsCount === 30 &&
        wfoRes.windows[0].testBarsCount === 10 &&
        wfoRes.windows[4].testBarsCount === 10;

      results.push({
        name: '43. Desplazamiento Secuencial de Ventanas Rolling WFO',
        passed,
        message: passed
          ? `OK: ${wfoRes.windows.length} ventanas rolling ejecutadas secuencialmente sin solapamiento en Test.`
          : `Fallo: Se generaron ${wfoRes.windows.length} ventanas (esperadas 5).`
      });
    } catch (e: any) {
      results.push({ name: '43. Desplazamiento WFO', passed: false, message: e.message });
    }

    // 44. Encadenamiento Continuo de Equity Out-of-Sample (Stitched Curve)
    try {
      const bars = SyntheticDataGenerator.generateBars(60, { basePrice: 100, volatility: 0.01, trend: 0.001 });
      const wfoCfg: WalkForwardConfig = {
        trainWindowBars: 30,
        testWindowBars: 15,
        stepBars: 15,
        optimizationMetric: 'SHARPE',
        minimumTrades: 0,
        parameterGrid: [{ name: 'param', values: [1] }]
      };

      const wfoRes = WalkForwardEngine.runWalkForwardOptimization(buyHoldStrategy, bars, wfoCfg, { initialCapital: 10000 });
      const stitched = wfoRes.combinedOutOfSampleEquity;

      // La curva cosida debe tener puntos continuos y capital preservado
      const hasPoints = stitched.length === 30; // 2 ventanas de 15 barras = 30 barras test
      const finalEqConsistent = Math.abs(wfoRes.combinedOutOfSampleMetrics.finalEquity - stitched[stitched.length - 1].equity) < 0.1;
      const passed = hasPoints && finalEqConsistent && wfoRes.combinedOutOfSampleMetrics.initialCapital === 10000;

      results.push({
        name: '44. Encadenamiento Continuo de Curva de Equity Out-of-Sample',
        passed,
        message: passed
          ? `OK: Curva OOS encadenada (${stitched.length} compases, Capital final: ${wfoRes.combinedOutOfSampleMetrics.finalEquity.toFixed(2)} €).`
          : 'Fallo en encadenamiento de curva de equity Out-of-Sample.'
      });
    } catch (e: any) {
      results.push({ name: '44. Curva OOS Encadenada', passed: false, message: e.message });
    }

    // 45. Diagnóstico de Robustez y Estabilidad de Parámetros WFO
    try {
      const bars = SyntheticDataGenerator.generateBars(60, { basePrice: 100, volatility: 0.01 });
      const wfoCfg: WalkForwardConfig = {
        trainWindowBars: 30,
        testWindowBars: 15,
        stepBars: 15,
        optimizationMetric: 'TOTAL_RETURN',
        minimumTrades: 0,
        parameterGrid: [{ name: 'dummyParam', values: [5, 10] }]
      };

      const wfoRes = WalkForwardEngine.runWalkForwardOptimization(buyHoldStrategy, bars, wfoCfg);
      const stability = wfoRes.parameterStability['dummyParam'];
      const passed =
        stability !== undefined &&
        typeof stability.stabilityPct === 'number' &&
        typeof wfoRes.robustnessScore === 'number' &&
        wfoRes.robustnessScore >= 0 && wfoRes.robustnessScore <= 100 &&
        typeof wfoRes.diagnosis === 'string' &&
        wfoRes.diagnosis.length > 0;

      results.push({
        name: '45. Estabilidad de Parámetros y Score Cuantitativo de Robustez',
        passed,
        message: passed
          ? `OK: Score de Robustez = ${wfoRes.robustnessScore}/100, Estabilidad = ${stability.stabilityPct}%, Diagnóstico: "${wfoRes.diagnosis.slice(0, 40)}...".`
          : 'Fallo en diagnóstico de robustez/estabilidad.'
      });
    } catch (e: any) {
      results.push({ name: '45. Estabilidad de Parámetros', passed: false, message: e.message });
    }

    return results;
  }
}

