const KNOWN_ISIN_BY_TICKER: Record<string, string> = {
  'ASML.AS': 'NL0010273215',
  'SAP.DE': 'DE0007164600',
  'SIE.DE': 'DE0007236101',
  'ALV.DE': 'DE0008404005',
  'DTE.DE': 'DE0005557508',
  'RHM.DE': 'DE0007030009',
  'DB1.DE': 'DE0005810055',
  'ADS.DE': 'DE000A1EWWW0',
  'AIR.PA': 'NL0000235190',
  'MC.PA': 'FR0000121014',
  'OR.PA': 'FR0000120321',
  'AI.PA': 'FR0000120073',
  'SU.PA': 'FR0000121972',
  'TTE.PA': 'FR0000120271',
  'SAN.PA': 'FR0000120578',
  'BNP.PA': 'FR0000131104',
  'SAN.MC': 'ES0113900J37',
  'BBVA.MC': 'ES0113211835',
  'ITX.MC': 'ES0148396007',
  'IBE.MC': 'ES0144580Y14',
  'FER.MC': 'NL0015001FS8',
  'REP.MC': 'ES0173516115',
  'ENEL.MI': 'IT0003128367',
  'ISP.MI': 'IT0000072618',
  'UCG.MI': 'IT0005239360',
  'ENI.MI': 'IT0003132476',
  'VWCE.DE': 'IE00BK5BQT80',
  'EUNL.DE': 'IE00B4L5Y983',
  'SXR8.DE': 'IE00B5BMR087',
  'VUSA.DE': 'IE00B3XXRP09',
  'EQQQ.DE': 'IE0032077012',
  'SXRV.DE': 'IE00B53SZB19',
  'EXSA.DE': 'DE0002635307',
  'IS3N.DE': 'IE00BKM4GZ66',
  'EIMI.DE': 'IE00BKM4GZ66',
  'IUSN.DE': 'IE00BF4RFH31',
  'ZPRV.DE': 'IE00BSPLC413',
  'VVSM.DE': 'IE00BMC38736',
  'QDVE.DE': 'IE00B3WJKG14',
  'IQQH.DE': 'IE00B1XNHC34',
  'VHYD.DE': 'IE00B8GKDB10',
  'VAGF.DE': 'IE00BG47KH54',
  'EUNA.DE': 'IE00BDBRDM35',
  'DBX0AN.DE': 'LU0290358497',
  'XEON.DE': 'LU0290358497',
  '4GLD.DE': 'DE000A0S9GB0',
  'SGLD.DE': 'IE00B579F325'
};

export function isValidIsin(value: string | null | undefined): boolean {
  return Boolean(value && /^[A-Z]{2}[A-Z0-9]{10}$/.test(value.trim().toUpperCase()));
}

export function resolveSecurityIsin(ticker: string | null | undefined, explicitIsin?: string | null): string | null {
  const explicit = explicitIsin?.trim().toUpperCase() ?? '';
  if (isValidIsin(explicit)) return explicit;
  const key = ticker?.trim().toUpperCase() ?? '';
  if (isValidIsin(key)) return key;
  return KNOWN_ISIN_BY_TICKER[key] ?? null;
}

export function preferredBrokerSearchCode(ticker: string | null | undefined, explicitIsin?: string | null): string {
  return resolveSecurityIsin(ticker, explicitIsin) ?? ticker?.trim().toUpperCase() ?? '';
}
