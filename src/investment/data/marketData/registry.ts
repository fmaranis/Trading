import { MarketDataProvider } from './types';
import { MarketDataProviderError } from './errors';

export class MarketDataProviderRegistry {
  private providers: Map<string, MarketDataProvider> = new Map();
  private defaultProviderId: string | null = null;

  public register(provider: MarketDataProvider): void {
    if (!provider || !provider.id) {
      throw new Error('Provider must be defined with a valid non-empty id.');
    }
    this.providers.set(provider.id.toLowerCase(), provider);
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id.toLowerCase();
    }
  }

  public getProvider(id: string): MarketDataProvider {
    const provider = this.providers.get(id.toLowerCase());
    if (!provider) {
      throw new MarketDataProviderError(id, `Proveedor de datos no registrado: "${id}".`);
    }
    return provider;
  }

  public hasProvider(id: string): boolean {
    return this.providers.has(id.toLowerCase());
  }

  public getAvailableProviders(): MarketDataProvider[] {
    return Array.from(this.providers.values());
  }

  public getDefaultProvider(): MarketDataProvider {
    if (!this.defaultProviderId || !this.providers.has(this.defaultProviderId)) {
      const first = Array.from(this.providers.values())[0];
      if (!first) {
        throw new MarketDataProviderError('UNKNOWN', 'No hay ningún proveedor de datos registrado en el sistema.');
      }
      return first;
    }
    return this.providers.get(this.defaultProviderId)!;
  }

  public setDefaultProvider(id: string): void {
    if (!this.providers.has(id.toLowerCase())) {
      throw new MarketDataProviderError(id, `No se puede establecer como proveedor predeterminado: "${id}" no está registrado.`);
    }
    this.defaultProviderId = id.toLowerCase();
  }

  public clear(): void {
    this.providers.clear();
    this.defaultProviderId = null;
  }
}
