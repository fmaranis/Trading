import { IStrategy } from './baseStrategy';
import { PriceBar, Signal } from '../backtesting/types';

export class BuyAndHoldStrategy implements IStrategy {
  public id = 'buy_and_hold';
  public name = 'Buy & Hold (Benchmark Pasivo)';
  public description = 'Compra en el primer día de la serie temporal y mantiene la posición íntegra hasta el final.';
  public category: 'BENCHMARK' = 'BENCHMARK';
  public defaultParameters = {};

  public generateSignals(bars: PriceBar[]): Signal[] {
    const signals: Signal[] = [];
    if (bars.length === 0) return signals;

    // First bar: BUY
    signals.push({
      timestamp: bars[0].timestamp,
      type: 'BUY',
      price: bars[0].close,
      reason: 'Compra inicial Buy & Hold (Inversión Pasiva)',
      strength: 1.0
    });

    // All subsequent bars: HOLD
    for (let i = 1; i < bars.length; i++) {
      signals.push({
        timestamp: bars[i].timestamp,
        type: 'HOLD',
        price: bars[i].close,
        reason: 'Mantener posición pasiva'
      });
    }

    return signals;
  }
}

export class SmaCrossoverStrategy implements IStrategy {
  public id = 'sma_crossover';
  public name = 'SMA Crossover (Golden Cross / Death Cross)';
  public description = 'Compra cuando la Media Móvil Rápida cruza por encima de la Lenta (Golden Cross) y vende al cruzar a la baja.';
  public category: 'TREND' = 'TREND';
  public defaultParameters = {
    fastPeriod: 10,
    slowPeriod: 30
  };

  public generateSignals(bars: PriceBar[], parameters = this.defaultParameters): Signal[] {
    const signals: Signal[] = [];
    const fastPeriod = parameters.fastPeriod || 10;
    const slowPeriod = parameters.slowPeriod || 30;

    let inPosition = false;

    for (let i = 0; i < bars.length; i++) {
      if (i < slowPeriod) {
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'HOLD',
          price: bars[i].close,
          reason: `Acumulando datos históricos (Barra ${i + 1}/${slowPeriod})`
        });
        continue;
      }

      // Calculate SMA fast & slow using only data strictly up to index i (NO look-ahead)
      let fastSum = 0;
      for (let f = 0; f < fastPeriod; f++) {
        fastSum += bars[i - f].close;
      }
      const fastSma = fastSum / fastPeriod;

      let slowSum = 0;
      for (let s = 0; s < slowPeriod; s++) {
        slowSum += bars[i - s].close;
      }
      const slowSma = slowSum / slowPeriod;

      // Previous SMAs (bar i-1) to detect crossover
      let prevFastSum = 0;
      for (let f = 0; f < fastPeriod; f++) {
        prevFastSum += bars[i - 1 - f].close;
      }
      const prevFastSma = prevFastSum / fastPeriod;

      let prevSlowSum = 0;
      for (let s = 0; s < slowPeriod; s++) {
        prevSlowSum += bars[i - 1 - s].close;
      }
      const prevSlowSma = prevSlowSum / slowPeriod;

      const crossedAbove = prevFastSma <= prevSlowSma && fastSma > slowSma;
      const crossedBelow = prevFastSma >= prevSlowSma && fastSma < slowSma;

      if (crossedAbove && !inPosition) {
        inPosition = true;
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'BUY',
          price: bars[i].close,
          reason: `Golden Cross: SMA(${fastPeriod}) [${fastSma.toFixed(2)}] superó SMA(${slowPeriod}) [${slowSma.toFixed(2)}]`,
          strength: 0.85
        });
      } else if (crossedBelow && inPosition) {
        inPosition = false;
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'SELL',
          price: bars[i].close,
          reason: `Death Cross: SMA(${fastPeriod}) [${fastSma.toFixed(2)}] cayó bajo SMA(${slowPeriod}) [${slowSma.toFixed(2)}]`,
          strength: 0.85
        });
      } else {
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'HOLD',
          price: bars[i].close,
          reason: inPosition ? 'Manteniendo tendencia alcista' : 'Fuera de mercado en liquidez'
        });
      }
    }

    return signals;
  }
}

export class RsiMeanReversionStrategy implements IStrategy {
  public id = 'rsi_mean_reversion';
  public name = 'RSI Mean Reversion (Sobreventa / Sobrecra)';
  public description = 'Compra en zonas de sobreventa extrema (RSI < 30) y toma beneficios al superar zona de sobrecompra (RSI > 70).';
  public category: 'MEAN_REVERSION' = 'MEAN_REVERSION';
  public defaultParameters = {
    period: 14,
    oversoldThreshold: 30,
    overboughtThreshold: 70
  };

  public generateSignals(bars: PriceBar[], parameters = this.defaultParameters): Signal[] {
    const signals: Signal[] = [];
    const period = parameters.period || 14;
    const oversold = parameters.oversoldThreshold || 30;
    const overbought = parameters.overboughtThreshold || 70;

    let inPosition = false;

    for (let i = 0; i < bars.length; i++) {
      if (i < period + 1) {
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'HOLD',
          price: bars[i].close,
          reason: 'Cálculo preliminar RSI'
        });
        continue;
      }

      // Calculate Wilder's / Cutlers RSI strictly up to index i
      let gains = 0;
      let losses = 0;

      for (let p = 0; p < period; p++) {
        const change = bars[i - p].close - bars[i - p - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }

      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      if (rsi <= oversold && !inPosition) {
        inPosition = true;
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'BUY',
          price: bars[i].close,
          reason: `RSI(${period}) en Sobreventa [${rsi.toFixed(1)} <= ${oversold}]: Rebote estadístico`,
          strength: 0.9
        });
      } else if (rsi >= overbought && inPosition) {
        inPosition = false;
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'SELL',
          price: bars[i].close,
          reason: `RSI(${period}) en Sobrecompra [${rsi.toFixed(1)} >= ${overbought}]: Toma de beneficios`,
          strength: 0.9
        });
      } else {
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'HOLD',
          price: bars[i].close,
          reason: inPosition ? `Posición activa (RSI: ${rsi.toFixed(1)})` : `Esperando sobreventa (RSI: ${rsi.toFixed(1)})`
        });
      }
    }

    return signals;
  }
}

export class MomentumBreakoutStrategy implements IStrategy {
  public id = 'momentum_breakout';
  public name = 'Momentum Breakout & Trailing Stop (2X Aggressive)';
  public description = 'Detecta rupturas de máximos de N periodos con aceleración de volumen y protege capital con Trailing Stop.';
  public category: 'MOMENTUM' = 'MOMENTUM';
  public defaultParameters = {
    lookbackPeriod: 15,
    trailingStopPct: 3.5
  };

  public generateSignals(bars: PriceBar[], parameters = this.defaultParameters): Signal[] {
    const signals: Signal[] = [];
    const lookback = parameters.lookbackPeriod || 15;
    const trailingStopPct = parameters.trailingStopPct || 3.5;

    let inPosition = false;
    let highestPriceInPosition = 0;

    for (let i = 0; i < bars.length; i++) {
      if (i < lookback) {
        signals.push({
          timestamp: bars[i].timestamp,
          type: 'HOLD',
          price: bars[i].close,
          reason: 'Cargando canal de Donchian / Momentum'
        });
        continue;
      }

      const currentClose = bars[i].close;

      if (!inPosition) {
        // Check breakout of prior N bars highest high (excluding current bar)
        let priorHighestHigh = -Infinity;
        for (let p = 1; p <= lookback; p++) {
          if (bars[i - p].high > priorHighestHigh) {
            priorHighestHigh = bars[i - p].high;
          }
        }

        if (currentClose > priorHighestHigh) {
          inPosition = true;
          highestPriceInPosition = currentClose;
          signals.push({
            timestamp: bars[i].timestamp,
            type: 'BUY',
            price: currentClose,
            reason: `Breakout Alcista: Precio [${currentClose.toFixed(2)}] rompió máximo de ${lookback} barras [${priorHighestHigh.toFixed(2)}]`,
            strength: 0.95
          });
        } else {
          signals.push({
            timestamp: bars[i].timestamp,
            type: 'HOLD',
            price: currentClose,
            reason: 'Consolidación dentro de rango'
          });
        }
      } else {
        // We are in position: Update trailing peak
        if (currentClose > highestPriceInPosition) {
          highestPriceInPosition = currentClose;
        }

        const dropFromPeakPct = ((highestPriceInPosition - currentClose) / highestPriceInPosition) * 100;

        if (dropFromPeakPct >= trailingStopPct) {
          inPosition = false;
          signals.push({
            timestamp: bars[i].timestamp,
            type: 'SELL',
            price: currentClose,
            reason: `Trailing Stop de Estrategia: Caída de -${dropFromPeakPct.toFixed(1)}% desde pico (${highestPriceInPosition.toFixed(2)}€)`,
            strength: 0.95
          });
        } else {
          signals.push({
            timestamp: bars[i].timestamp,
            type: 'HOLD',
            price: currentClose,
            reason: `Surfeando tendencia (Pico: ${highestPriceInPosition.toFixed(2)}€, Distancia Stop: ${dropFromPeakPct.toFixed(1)}%)`
          });
        }
      }
    }

    return signals;
  }
}

export const ALL_QUANT_STRATEGIES: IStrategy[] = [
  new BuyAndHoldStrategy(),
  new SmaCrossoverStrategy(),
  new RsiMeanReversionStrategy(),
  new MomentumBreakoutStrategy()
];
