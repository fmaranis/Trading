export interface MarketSymbolMapping {
  assetId: string;
  internalTicker: string;
  name: string;
  providerSymbols: Record<string, string>; // e.g. { yahoo_finance: 'VWCE.DE', stooq: 'VWCE.DE' }
  defaultProviderSymbol: string;
}

export class SymbolMappingService {
  private static readonly MAPPINGS: Map<string, MarketSymbolMapping> = new Map([
    [
      'vanguard-msci-world',
      {
        assetId: 'vanguard-msci-world',
        internalTicker: 'VGMSCIW',
        name: 'Vanguard Global Stock Index Fund / MSCI World',
        providerSymbols: {
          yahoo_finance: 'VWCE.DE',
          stooq: 'VWCE.DE',
          mock: 'VWCE.DE'
        },
        defaultProviderSymbol: 'VWCE.DE'
      }
    ],
    [
      'nasdaq100-momentum',
      {
        assetId: 'nasdaq100-momentum',
        internalTicker: 'EQQQ',
        name: 'Invesco EQQQ Nasdaq-100 Mega-Growth ETF',
        providerSymbols: {
          yahoo_finance: 'EQQQ.DE',
          stooq: 'EQQQ.DE',
          mock: 'EQQQ.DE'
        },
        defaultProviderSymbol: 'EQQQ.DE'
      }
    ],
    [
      'vaneck-semiconductors',
      {
        assetId: 'vaneck-semiconductors',
        internalTicker: 'SMH',
        name: 'VanEck Semiconductor UCITS ETF',
        providerSymbols: {
          yahoo_finance: 'SMH',
          stooq: 'SMH.US',
          mock: 'SMH'
        },
        defaultProviderSymbol: 'SMH'
      }
    ],
    [
      'crypto-etp-regulated',
      {
        assetId: 'crypto-etp-regulated',
        internalTicker: 'CBTC',
        name: '21Shares Bitcoin Physical Core ETP',
        providerSymbols: {
          yahoo_finance: 'BTC-EUR',
          stooq: 'BTC-EUR',
          mock: 'CBTC'
        },
        defaultProviderSymbol: 'BTC-EUR'
      }
    ],
    [
      'wisdomtree-physical-gold',
      {
        assetId: 'wisdomtree-physical-gold',
        internalTicker: 'PHAU',
        name: 'WisdomTree Physical Gold ETC',
        providerSymbols: {
          yahoo_finance: '4GLD.DE',
          stooq: '4GLD.DE',
          mock: 'PHAU'
        },
        defaultProviderSymbol: '4GLD.DE'
      }
    ],
    [
      'uranium-clean-energy',
      {
        assetId: 'uranium-clean-energy',
        internalTicker: 'URNU',
        name: 'Global X Uranium UCITS ETF',
        providerSymbols: {
          yahoo_finance: 'URNU.DE',
          stooq: 'URNU.DE',
          mock: 'URNU'
        },
        defaultProviderSymbol: 'URNU.DE'
      }
    ],
    [
      'vanguard-global-bond',
      {
        assetId: 'vanguard-global-bond',
        internalTicker: 'VGLEURH',
        name: 'Vanguard Global Bond Index EUR Hedged',
        providerSymbols: {
          yahoo_finance: 'VAGF.DE',
          stooq: 'VAGF.DE',
          mock: 'VAGF.DE'
        },
        defaultProviderSymbol: 'VAGF.DE'
      }
    ],
    [
      'groupama-tresorerie',
      {
        assetId: 'groupama-tresorerie',
        internalTicker: 'GOPTRIC',
        name: 'Groupama Trésorerie IC',
        providerSymbols: {
          yahoo_finance: 'XEON.DE', // EUR Overnight Rate Swap ETF (proxy for short term money market)
          stooq: 'XEON.DE',
          mock: 'GOPTRIC'
        },
        defaultProviderSymbol: 'XEON.DE'
      }
    ],
    [
      'ishares-euro-inflation-bond',
      {
        assetId: 'ishares-euro-inflation-bond',
        internalTicker: 'IEUINFL',
        name: 'iShares Euro Inflation Linked Bond',
        providerSymbols: {
          yahoo_finance: 'IBCI.DE',
          stooq: 'IBCI.DE',
          mock: 'IEUINFL'
        },
        defaultProviderSymbol: 'IBCI.DE'
      }
    ]
  ]);

  /**
   * Resolves the market provider symbol for a given internal asset ID or ticker string.
   * If the input is already a direct market ticker (e.g. 'AAPL', 'MSFT', 'SPY', 'VWCE.DE'),
   * and no assetId matches, it preserves the ticker as the symbol.
   */
  public static resolveProviderSymbol(assetIdOrTicker: string, providerId = 'yahoo_finance'): string | null {
    if (!assetIdOrTicker || typeof assetIdOrTicker !== 'string') {
      return null;
    }

    const key = assetIdOrTicker.trim().toLowerCase();
    const mapping = this.MAPPINGS.get(key);

    if (mapping) {
      return mapping.providerSymbols[providerId] || mapping.defaultProviderSymbol;
    }

    // Check if internalTicker matches
    for (const m of this.MAPPINGS.values()) {
      if (m.internalTicker.toLowerCase() === key) {
        return m.providerSymbols[providerId] || m.defaultProviderSymbol;
      }
    }

    // Direct market ticker passed (e.g. 'SPY', 'QQQ', 'VWCE.DE')
    if (assetIdOrTicker.length >= 1 && assetIdOrTicker.length <= 15 && !assetIdOrTicker.includes(' ')) {
      return assetIdOrTicker.toUpperCase();
    }

    return null;
  }

  public static getMapping(assetIdOrTicker: string): MarketSymbolMapping | null {
    const key = (assetIdOrTicker || '').trim().toLowerCase();
    const mapping = this.MAPPINGS.get(key);
    if (mapping) return mapping;

    for (const m of this.MAPPINGS.values()) {
      if (m.internalTicker.toLowerCase() === key) {
        return m;
      }
    }

    return null;
  }

  public static getAllMappings(): MarketSymbolMapping[] {
    return Array.from(this.MAPPINGS.values());
  }
}
