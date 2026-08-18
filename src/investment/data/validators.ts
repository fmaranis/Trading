import { PriceBar } from '../backtesting/types';

export interface ValidationReport {
  isValid: boolean;
  totalBars: number;
  errors: string[];
  warnings: string[];
}

export class DataValidationError extends Error {
  public readonly errors: string[];
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'DataValidationError';
    this.errors = errors;
  }
}

export class DataValidator {
  /**
   * Strictly validates OHLCV bars for mathematical sanity and integrity:
   * - Dataset cannot be empty (errors if empty)
   * - timestamp non-empty string, valid parseable date
   * - unique timestamps (no duplicates -> error)
   * - strictly ordered chronologically (strictly ascending -> error if unordered or equal)
   * - strict numerical validation on open, high, low, close with Number.isFinite() > 0 (rejects NaN, Infinity, -Infinity)
   * - High >= max(Open, Close)
   * - Low <= min(Open, Close)
   * - High >= Low
   * - Volume (when present) must be Number.isFinite() >= 0 (rejects NaN, Infinity, negative -> error)
   * 
   * Does NOT auto-sort or silently fix; rejects invalid datasets immediately.
   */
  public static validatePriceBars(bars: PriceBar[]): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!bars || !Array.isArray(bars) || bars.length === 0) {
      return {
        isValid: false,
        totalBars: 0,
        errors: ['La serie de barras está vacía o no es un array válido.'],
        warnings: []
      };
    }

    const seenTimestamps = new Set<string>();
    let prevTime = -Infinity;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const prefix = `Barra [${i}] (${b?.timestamp || 'sin timestamp'}):`;

      if (!b) {
        errors.push(`${prefix} Elemento de barra nulo o indefinido.`);
        continue;
      }

      // 1. Timestamp validation
      if (!b.timestamp || typeof b.timestamp !== 'string' || b.timestamp.trim() === '') {
        errors.push(`${prefix} Timestamp vacío o no válido.`);
      } else {
        const trimmedTs = b.timestamp.trim();
        
        // Check uniqueness (duplicate -> ERROR)
        if (seenTimestamps.has(trimmedTs)) {
          errors.push(`${prefix} Timestamp duplicado detectado: "${trimmedTs}".`);
        }
        seenTimestamps.add(trimmedTs);

        // Check chronological ordering & validity
        const parsedTime = Date.parse(trimmedTs);
        if (isNaN(parsedTime)) {
          errors.push(`${prefix} Formato de timestamp no reconocido o fecha no parseable: "${trimmedTs}".`);
        } else {
          if (parsedTime <= prevTime) {
            errors.push(`${prefix} Serie desordenada o no estrictamente creciente en el tiempo (${trimmedTs} <= anterior).`);
          }
          prevTime = parsedTime;
        }
      }

      // 2. Strict numerical validation on Prices (Number.isFinite > 0)
      if (typeof b.open !== 'number' || !Number.isFinite(b.open) || b.open <= 0) {
        errors.push(`${prefix} Precio Open inválido (${b.open}). Debe ser número finito > 0.`);
      }
      if (typeof b.high !== 'number' || !Number.isFinite(b.high) || b.high <= 0) {
        errors.push(`${prefix} Precio High inválido (${b.high}). Debe ser número finito > 0.`);
      }
      if (typeof b.low !== 'number' || !Number.isFinite(b.low) || b.low <= 0) {
        errors.push(`${prefix} Precio Low inválido (${b.low}). Debe ser número finito > 0.`);
      }
      if (typeof b.close !== 'number' || !Number.isFinite(b.close) || b.close <= 0) {
        errors.push(`${prefix} Precio Close inválido (${b.close}). Debe ser número finito > 0.`);
      }

      // 3. OHLC geometric consistency (only evaluate if numbers are finite)
      if (Number.isFinite(b.high) && Number.isFinite(b.low) && b.high < b.low) {
        errors.push(`${prefix} Inconsistencia OHLC: High (${b.high}) es menor que Low (${b.low}).`);
      }
      if (Number.isFinite(b.high) && Number.isFinite(b.open) && b.high < b.open) {
        errors.push(`${prefix} Inconsistencia OHLC: High (${b.high}) es menor que Open (${b.open}).`);
      }
      if (Number.isFinite(b.high) && Number.isFinite(b.close) && b.high < b.close) {
        errors.push(`${prefix} Inconsistencia OHLC: High (${b.high}) es menor que Close (${b.close}).`);
      }
      if (Number.isFinite(b.low) && Number.isFinite(b.open) && b.low > b.open) {
        errors.push(`${prefix} Inconsistencia OHLC: Low (${b.low}) es mayor que Open (${b.open}).`);
      }
      if (Number.isFinite(b.low) && Number.isFinite(b.close) && b.low > b.close) {
        errors.push(`${prefix} Inconsistencia OHLC: Low (${b.low}) es mayor que Close (${b.close}).`);
      }

      // 4. Strict numerical validation on Volume (Number.isFinite >= 0, invalid is ERROR)
      if (b.volume !== undefined) {
        if (typeof b.volume !== 'number' || !Number.isFinite(b.volume) || b.volume < 0) {
          errors.push(`${prefix} Volumen inválido (${b.volume}). Debe ser número finito >= 0.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      totalBars: bars.length,
      errors,
      warnings
    };
  }

  public static assertValidPriceBars(bars: PriceBar[]): void {
    const report = this.validatePriceBars(bars);
    if (!report.isValid) {
      throw new DataValidationError(
        `Fallo de validación de integridad en dataset (${report.errors.length} errores): ${report.errors[0]}`,
        report.errors
      );
    }
  }
}
