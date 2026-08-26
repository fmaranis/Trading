/**
 * Typed error hierarchy for the Market Data architecture.
 * Replaces generic Error throws with specific, auditable failure types.
 */

export class MarketDataError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code = 'MARKET_DATA_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MarketDataProviderError extends MarketDataError {
  public readonly providerId: string;
  public readonly statusCode?: number;

  constructor(providerId: string, message: string, statusCode?: number, details?: Record<string, unknown>) {
    super(`[${providerId}] Error del proveedor: ${message}`, 'PROVIDER_ERROR', details);
    this.name = 'MarketDataProviderError';
    this.providerId = providerId;
    this.statusCode = statusCode;
  }
}

export class MarketDataValidationError extends MarketDataError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super(`Error de validación de datos de mercado: ${message}`, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'MarketDataValidationError';
    this.validationErrors = validationErrors;
  }
}

export class MarketDataRateLimitError extends MarketDataError {
  public readonly providerId: string;
  public readonly retryAfterSeconds?: number;

  constructor(providerId: string, retryAfterSeconds?: number, message?: string) {
    const msg = message || `Límite de peticiones alcanzado en ${providerId}${retryAfterSeconds ? ` (reintentar en ${retryAfterSeconds}s)` : ''}`;
    super(msg, 'RATE_LIMIT_EXCEEDED', { providerId, retryAfterSeconds });
    this.name = 'MarketDataRateLimitError';
    this.providerId = providerId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class MarketDataUnauthorizedError extends MarketDataError {
  public readonly providerId: string;

  constructor(providerId: string, message = 'Credenciales no válidas o no autorizadas para este proveedor.') {
    super(`[${providerId}] No autorizado: ${message}`, 'UNAUTHORIZED', { providerId });
    this.name = 'MarketDataUnauthorizedError';
    this.providerId = providerId;
  }
}

export class MarketDataSymbolNotFoundError extends MarketDataError {
  public readonly symbol: string;
  public readonly providerId?: string;

  constructor(symbol: string, providerId?: string, message?: string) {
    const msg = message || `Símbolo de mercado no encontrado o no soportado: "${symbol}"${providerId ? ` en ${providerId}` : ''}`;
    super(msg, 'SYMBOL_NOT_FOUND', { symbol, providerId });
    this.name = 'MarketDataSymbolNotFoundError';
    this.symbol = symbol;
    this.providerId = providerId;
  }
}

export class MarketDataTimeoutError extends MarketDataError {
  public readonly providerId: string;
  public readonly timeoutMs: number;

  constructor(providerId: string, timeoutMs: number) {
    super(`Petición a ${providerId} abortada por exceder el tiempo límite de ${timeoutMs}ms.`, 'TIMEOUT', { providerId, timeoutMs });
    this.name = 'MarketDataTimeoutError';
    this.providerId = providerId;
    this.timeoutMs = timeoutMs;
  }
}
