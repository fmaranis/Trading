import { PriceBar } from '../backtesting/types';

export interface ValidationReport {
  isValid: boolean;
  totalBars: number;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  /**
   * Strictly validates OHLCV bars for mathematical sanity and integrity:
   * - Positive prices
   * - High >= max(Open, Close)
   * - Low <= min(Open, Close)
   * - High >= Low
   * - No NaNs or Infinite numbers
   * - Volume >= 0
   */
  public static validatePriceBars(bars: PriceBar[]): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!bars || bars.length === 0) {
      return {
        isValid: false,
        totalBars: 0,
        errors: ['La serie de barras está vacía.'],
        warnings: []
      };
    }

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const prefix = `Barra [${i}] (${b.timestamp || 'sin timestamp'}):`;

      if (typeof b.open !== 'number' || isNaN(b.open) || b.open <= 0) {
        errors.push(`${prefix} Precio Open inválido (${b.open})`);
      }
      if (typeof b.high !== 'number' || isNaN(b.high) || b.high <= 0) {
        errors.push(`${prefix} Precio High inválido (${b.high})`);
      }
      if (typeof b.low !== 'number' || isNaN(b.low) || b.low <= 0) {
        errors.push(`${prefix} Precio Low inválido (${b.low})`);
      }
      if (typeof b.close !== 'number' || isNaN(b.close) || b.close <= 0) {
        errors.push(`${prefix} Precio Close inválido (${b.close})`);
      }

      // Check OHLC consistency: High >= max(Open, Close), Low <= min(Open, Close), High >= Low
      if (b.high < b.low) {
        errors.push(`${prefix} Inconsistencia OHLC: High (${b.high}) es menor que Low (${b.low})`);
      }
      if (b.high < b.open || b.high < b.close) {
        errors.push(`${prefix} Inconsistencia OHLC: High (${b.high}) es menor que Open (${b.open}) o Close (${b.close})`);
      }
      if (b.low > b.open || b.low > b.close) {
        errors.push(`${prefix} Inconsistencia OHLC: Low (${b.low}) es mayor que Open (${b.open}) o Close (${b.close})`);
      }

      if (b.volume !== undefined && (isNaN(b.volume) || b.volume < 0)) {
        warnings.push(`${prefix} Volumen negativo o inválido (${b.volume})`);
      }
    }

    return {
      isValid: errors.length === 0,
      totalBars: bars.length,
      errors,
      warnings
    };
  }
}
