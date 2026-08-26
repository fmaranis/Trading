import { HistoricalMarketDataRequest, MarketTimeframe } from './types';
import { MarketDataValidationError } from './errors';

export class MarketDataRequestValidator {
  private static readonly VALID_TIMEFRAMES: Set<MarketTimeframe> = new Set(['1d', '1wk', '1mo']);

  public static validate(request: HistoricalMarketDataRequest): void {
    const errors: string[] = [];

    // 1. Symbol validation
    if (!request || typeof request !== 'object') {
      throw new MarketDataValidationError('El objeto de petición es nulo o inválido.', ['Request object must be defined']);
    }

    if (!request.symbol || typeof request.symbol !== 'string' || request.symbol.trim().length === 0) {
      errors.push('El símbolo de mercado no puede estar vacío.');
    }

    // 2. Timeframe validation
    if (!request.timeframe || !this.VALID_TIMEFRAMES.has(request.timeframe)) {
      errors.push(`Timeframe inválido: "${request.timeframe}". Los valores permitidos son: 1d, 1wk, 1mo.`);
    }

    // 3. Date format and range validation
    if (!request.startDate || typeof request.startDate !== 'string' || request.startDate.trim().length === 0) {
      errors.push('La fecha inicial (startDate) es obligatoria y no puede estar vacía.');
    }

    if (!request.endDate || typeof request.endDate !== 'string' || request.endDate.trim().length === 0) {
      errors.push('La fecha final (endDate) es obligatoria y no puede estar vacía.');
    }

    if (request.startDate && request.endDate) {
      const startMs = Date.parse(request.startDate);
      const endMs = Date.parse(request.endDate);

      if (isNaN(startMs)) {
        errors.push(`La fecha inicial (startDate) "${request.startDate}" no es una fecha válida o parseable.`);
      }

      if (isNaN(endMs)) {
        errors.push(`La fecha final (endDate) "${request.endDate}" no es una fecha válida o parseable.`);
      }

      if (!isNaN(startMs) && !isNaN(endMs)) {
        if (startMs >= endMs) {
          errors.push(
            `Rango cronológico inválido: startDate (${request.startDate}) debe ser estrictamente menor que endDate (${request.endDate}).`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new MarketDataValidationError(errors[0], errors);
    }
  }
}
