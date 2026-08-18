import { Asset, EducationalPill, AlertRule } from '../types';

export const CONSERVATIVE_ASSETS: Asset[] = [
  {
    id: 'groupama-tresorerie',
    isin: 'FR0000989626',
    name: 'Groupama Trésorerie IC',
    ticker: 'GOPTRIC',
    category: 'monetario',
    categoryLabel: 'Fondo Monetario Euro',
    description: 'Fondo del mercado monetario denominado en Euros que invierte en deuda soberana y pagarés corporativos de máxima calidad crediticia a muy corto plazo (€STR/Euribor).',
    currentPrice: 104.82,
    change24h: 0.01,
    change1y: 3.65,
    ter: 0.08, // 0.08%
    riskLevel: 1, // Escala CNMV 1/7
    volatilityAnnual: 0.28,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: true,
    taxAdvantageNote: 'Fondo de inversión traspasable en España sin tributar por plusvalías al cambiar a otro fondo.',
    historicalPrices: [
      { date: '2025-08', price: 101.12 },
      { date: '2025-10', price: 101.75 },
      { date: '2025-12', price: 102.40 },
      { date: '2026-02', price: 103.10 },
      { date: '2026-04', price: 103.80 },
      { date: '2026-06', price: 104.35 },
      { date: '2026-08', price: 104.82 },
    ]
  },
  {
    id: 'vanguard-global-bond',
    isin: 'IE00B18GC888',
    name: 'Vanguard Global Bond Index Euro-Hedged',
    ticker: 'VGLEURH',
    category: 'renta_fija',
    categoryLabel: 'Renta Fija Global Cubierta a EUR',
    description: 'Rastrea el índice Bloomberg Global Aggregate Float Adjusted. Máxima diversificación en bonos gubernamentales y corporativos de grado de inversión globales con cobertura de divisa en euros.',
    currentPrice: 98.40,
    change24h: -0.05,
    change1y: 4.12,
    ter: 0.10, // 0.10%
    riskLevel: 2, // Escala CNMV 2/7
    volatilityAnnual: 3.45,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: true,
    taxAdvantageNote: 'Traspaso fiscal diferido en España. Ideal como ancla conservadora defensiva.',
    historicalPrices: [
      { date: '2025-08', price: 94.50 },
      { date: '2025-10', price: 95.80 },
      { date: '2025-12', price: 96.20 },
      { date: '2026-02', price: 97.10 },
      { date: '2026-04', price: 97.90 },
      { date: '2026-06', price: 98.60 },
      { date: '2026-08', price: 98.40 },
    ]
  },
  {
    id: 'vanguard-msci-world',
    isin: 'IE00B03HD191',
    name: 'Vanguard Global Stock Index Fund EUR',
    ticker: 'VGMSCIW',
    category: 'renta_variable',
    categoryLabel: 'Renta Variable Global Desarrollada',
    description: 'Replica el índice MSCI World con más de 1.450 compañías líderes en 23 países desarrollados (Apple, Microsoft, Nvidia, Amazon, Alphabet, Nestlé, ASML, etc.).',
    currentPrice: 42.15,
    change24h: 0.38,
    change1y: 14.80,
    ter: 0.18, // 0.18%
    riskLevel: 4, // Escala CNMV 4/7
    volatilityAnnual: 11.20,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: true,
    taxAdvantageNote: 'Fondo indexado traspasable. Gran motor de crecimiento a largo plazo con diversificación mundial.',
    historicalPrices: [
      { date: '2025-08', price: 36.70 },
      { date: '2025-10', price: 37.40 },
      { date: '2025-12', price: 39.10 },
      { date: '2026-02', price: 38.50 },
      { date: '2026-04', price: 40.80 },
      { date: '2026-06', price: 41.60 },
      { date: '2026-08', price: 42.15 },
    ]
  },
  {
    id: 'ishares-euro-inflation-bond',
    isin: 'IE00B0M63X26',
    name: 'iShares Euro Inflation Linked Bond Index',
    ticker: 'IEUINFL',
    category: 'renta_fija',
    categoryLabel: 'Bonos Ligados a la Inflación EUR',
    description: 'Invierte en bonos soberanos europeos (Francia, Alemania, Italia, España) cuyo principal y cupones se ajustan directamente al IPC europeo para proteger el poder adquisitivo.',
    currentPrice: 215.30,
    change24h: 0.12,
    change1y: 2.90,
    ter: 0.14,
    riskLevel: 2,
    volatilityAnnual: 4.10,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: true,
    taxAdvantageNote: 'Fondo traspasable defensivo anti-inflación.',
    historicalPrices: [
      { date: '2025-08', price: 209.20 },
      { date: '2025-10', price: 210.50 },
      { date: '2025-12', price: 212.00 },
      { date: '2026-02', price: 213.40 },
      { date: '2026-04', price: 214.20 },
      { date: '2026-06', price: 214.90 },
      { date: '2026-08', price: 215.30 },
    ]
  },
  {
    id: 'wisdomtree-physical-gold',
    isin: 'JE00B1VS3770',
    name: 'WisdomTree Physical Gold ETC',
    ticker: 'PHAU',
    category: 'materias_primas',
    categoryLabel: 'Oro Físico Asignado (Cobertura)',
    description: 'Instrumento respaldado al 100% por lingotes de oro físico custodiados en bóvedas de Londres (HSBC). Actúa como activo refugio y descorrelacionador en fases de estrés monetario.',
    currentPrice: 218.40,
    change24h: 0.45,
    change1y: 21.30,
    ter: 0.39,
    riskLevel: 4,
    volatilityAnnual: 12.80,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: false,
    taxAdvantageNote: 'ETC cotizado. En España tributa en liquidación como ganancia patrimonial (no aplica régimen de traspasos).',
    historicalPrices: [
      { date: '2025-08', price: 180.00 },
      { date: '2025-10', price: 188.50 },
      { date: '2025-12', price: 195.00 },
      { date: '2026-02', price: 202.40 },
      { date: '2026-04', price: 208.00 },
      { date: '2026-06', price: 214.50 },
      { date: '2026-08', price: 218.40 },
    ]
  }
];

export const HIGH_GROWTH_MOMENTUM_ASSETS: Asset[] = [
  {
    id: 'vaneck-semiconductors',
    isin: 'IE00BMC38736',
    name: 'VanEck Semiconductor UCITS (AI & Chips Momentum)',
    ticker: 'SMH',
    category: 'semiconductores',
    categoryLabel: 'Chips, IA & Semiconductores',
    description: 'Exposición agresiva de alto beta a los gigantes de hardware de inteligencia artificial: Nvidia, TSMC, ASML, Broadcom, AMD y Qualcomm.',
    currentPrice: 38.60,
    change24h: 2.15,
    change1y: 48.20,
    ter: 0.35,
    riskLevel: 6,
    volatilityAnnual: 28.50,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: false,
    taxAdvantageNote: 'Instrumento de alta volatilidad diseñado para momentum rápido y estrategias de breakout.',
    isHighGrowth: true,
    historicalPrices: [
      { date: '2025-08', price: 26.10 },
      { date: '2025-10', price: 29.40 },
      { date: '2025-12', price: 32.80 },
      { date: '2026-02', price: 31.50 },
      { date: '2026-04', price: 35.20 },
      { date: '2026-06', price: 37.10 },
      { date: '2026-08', price: 38.60 }
    ]
  },
  {
    id: 'nasdaq100-momentum',
    isin: 'IE0032077012',
    name: 'Invesco EQQQ Nasdaq-100 Mega-Growth ETF',
    ticker: 'EQQQ',
    category: 'megatrend',
    categoryLabel: 'Tecnología & Megatendencias',
    description: 'Las 100 empresas no financieras más innovadoras y de mayor crecimiento en el Nasdaq. Motor clásico para duplicar capital en fases alcistas.',
    currentPrice: 480.25,
    change24h: 1.45,
    change1y: 29.60,
    ter: 0.30,
    riskLevel: 5,
    volatilityAnnual: 19.80,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: false,
    taxAdvantageNote: 'Alta liquidez e ideal para algoritmos de seguimiento de tendencia y trailing stop.',
    isHighGrowth: true,
    historicalPrices: [
      { date: '2025-08', price: 370.50 },
      { date: '2025-10', price: 395.00 },
      { date: '2025-12', price: 420.20 },
      { date: '2026-02', price: 410.80 },
      { date: '2026-04', price: 445.00 },
      { date: '2026-06', price: 468.30 },
      { date: '2026-08', price: 480.25 }
    ]
  },
  {
    id: 'crypto-etp-regulated',
    isin: 'CH0454664001',
    name: '21Shares Bitcoin Physical Core ETP (Regulado UCITS)',
    ticker: 'CBTC',
    category: 'crypto_etp',
    categoryLabel: 'Activos Digitales & Crypto ETP',
    description: 'ETP regulado respaldado físicamente en custodia institucional con frío 100%. Máxima volatilidad y asimetría de retorno para impulsos de aceleración.',
    currentPrice: 52.40,
    change24h: 3.80,
    change1y: 64.30,
    ter: 0.21,
    riskLevel: 7,
    volatilityAnnual: 55.40,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: false,
    taxAdvantageNote: 'Altísima volatilidad. Usado por el bot con stops ceñidos (-3%) para buscar doblar capital.',
    isHighGrowth: true,
    historicalPrices: [
      { date: '2025-08', price: 31.90 },
      { date: '2025-10', price: 38.40 },
      { date: '2025-12', price: 44.20 },
      { date: '2026-02', price: 42.00 },
      { date: '2026-04', price: 48.90 },
      { date: '2026-06', price: 50.50 },
      { date: '2026-08', price: 52.40 }
    ]
  },
  {
    id: 'uranium-clean-energy',
    isin: 'IE000NDWFGA5',
    name: 'Global X Uranium & Nuclear Breakout UCITS',
    ticker: 'URNU',
    category: 'megatrend',
    categoryLabel: 'Energía Nuclear & Uranio',
    description: 'Megatendencia de centros de datos de IA y energía nuclear limpia. Ciclo alcista de materias primas críticas con fuerte inercia de precios.',
    currentPrice: 24.80,
    change24h: 1.90,
    change1y: 38.10,
    ter: 0.65,
    riskLevel: 6,
    volatilityAnnual: 34.20,
    currency: 'EUR',
    minInvestment: 1.0,
    isIndexFund: false,
    taxAdvantageNote: 'Sectorial de alta beta para estrategias de momentum explosivo.',
    isHighGrowth: true,
    historicalPrices: [
      { date: '2025-08', price: 17.90 },
      { date: '2025-10', price: 19.50 },
      { date: '2025-12', price: 21.80 },
      { date: '2026-02', price: 20.90 },
      { date: '2026-04', price: 23.10 },
      { date: '2026-06', price: 24.00 },
      { date: '2026-08', price: 24.80 }
    ]
  }
];

export const ALL_AVAILABLE_ASSETS: Asset[] = [
  ...CONSERVATIVE_ASSETS,
  ...HIGH_GROWTH_MOMENTUM_ASSETS
];

export const INITIAL_PORTFOLIO_STATE = {
  initialCapital: 100.0,
  cashBalance: 40.0,
  vaultWithdrawnAmount: 0.0,
  positions: [
    {
      assetId: 'groupama-tresorerie',
      shares: 0.2862,
      averageBuyPrice: 104.82,
      currentPrice: 104.82,
      investedAmount: 30.00,
      currentValuation: 30.00,
      pnlAmount: 0.00,
      pnlPercentage: 0.00,
      weightPercentage: 30.00,
    },
    {
      assetId: 'vanguard-global-bond',
      shares: 0.2032,
      averageBuyPrice: 98.40,
      currentPrice: 98.40,
      investedAmount: 20.00,
      currentValuation: 20.00,
      pnlAmount: 0.00,
      pnlPercentage: 0.00,
      weightPercentage: 20.00,
    },
    {
      assetId: 'vanguard-msci-world',
      shares: 0.2372,
      averageBuyPrice: 42.15,
      currentPrice: 42.15,
      investedAmount: 10.00,
      currentValuation: 10.00,
      pnlAmount: 0.00,
      pnlPercentage: 0.00,
      weightPercentage: 10.00,
    }
  ]
};

export const INITIAL_ALERT_RULES: AlertRule[] = [
  {
    id: 'alert-drawdown-preventive',
    type: 'MAX_DRAWDOWN',
    threshold: 3.0,
    comparison: 'ABOVE',
    message: 'Aviso preventivo: La cartera acumula un -3.0% de caída temporal. No requiere acción.',
    active: true,
    createdAt: '2026-08-01',
    severity: 'medium'
  },
  {
    id: 'alert-drawdown-critical',
    type: 'MAX_DRAWDOWN',
    threshold: 5.0,
    comparison: 'ABOVE',
    message: 'Guardia de Drawdown Activada (-5.0% alcanzado). Se recomienda pausar compras de riesgo.',
    active: true,
    createdAt: '2026-08-01',
    severity: 'high'
  },
  {
    id: 'alert-rebalance-equity',
    type: 'REBALANCE_NEEDED',
    threshold: 20.0,
    comparison: 'ABOVE',
    message: 'Desvío de asignación: La renta variable supera el 20% del patrimonio total.',
    active: true,
    createdAt: '2026-08-01',
    severity: 'medium'
  },
  {
    id: 'alert-dca-monthly',
    type: 'DCA_REMINDER',
    threshold: 1.0,
    comparison: 'ABOVE',
    message: 'Recordatorio mensual de aportación periódica disciplinada (DCA de 15€ o 25€).',
    active: true,
    createdAt: '2026-08-01',
    severity: 'low'
  }
];

export const EDUCATIONAL_PILLS: EducationalPill[] = [
  {
    id: 'capital-preservation',
    title: 'La Regla de Oro: Preservar el Capital',
    tag: 'Gestión de Riesgo',
    readTime: '3 min de lectura',
    summary: 'Por qué recuperarse de una pérdida del 50% requiere ganar un 100%, y cómo un capital inicial de 100 € debe gestionarse con rigor defensivo.',
    content: 'En la inversión conservadora, el objetivo prioritario nunca es "hacerse rico rápido", sino evitar a toda costa la pérdida permanente de capital. Las matemáticas de las pérdidas son implacables: si pierdes un 10%, necesitas un 11.1% para recuperar; pero si pierdes un 50%, necesitas un 100% de rentabilidad solo para empatar. Con un capital inicial de 100 €, la regla número uno es mantener un colchón de liquidez (mínimo 20-40%) y nunca concentrar más del 20-30% en un único activo de riesgo.',
    keyTakeaway: 'Proteger la base de 100 € es 10 veces más importante que buscar rentabilidades de dos dígitos.',
    riskNote: 'Toda inversión en renta variable o fija conlleva riesgo de fluctuación de mercado.'
  },
  {
    id: 'spanish-tax-transfers',
    title: 'El Régimen de Traspasos de Fondos en España',
    tag: 'Fiscalidad',
    readTime: '4 min de lectura',
    summary: 'Cómo funciona la ventaja fiscal exclusiva de los fondos de inversión en España (Art. 94 Ley IRPF) frente a acciones o ETFs.',
    content: 'En España, las personas físicas residentes fiscales disfrutan del mecanismo de "traspaso de fondos de inversión". Esto significa que puedes mover tu dinero de un fondo (por ejemplo, monetario) a otro fondo (por ejemplo, indexado global) sin vender ni tributar por las plusvalías generadas. Las ganancias quedan diferidas hasta que retires definitivamente el dinero a tu cuenta corriente. Esto permite que el 100% del capital siga generando interés compuesto sin ser mermado por retenciones intermedias del 19% al 28%.',
    keyTakeaway: 'Los fondos indexados permiten rebalancear la cartera sin pagar peaje fiscal inmediato en España.',
    riskNote: 'Esta normativa aplica a fondos registrados en la CNMV. Consulta a un asesor fiscal colegiado para tu situación particular.'
  },
  {
    id: 'ter-cost-impact',
    title: 'El Silencioso Dragón del TER (Comisiones Totales)',
    tag: 'Costes (TER)',
    readTime: '3 min de lectura',
    summary: 'Una diferencia del 1.5% anual en comisiones puede comerse más del 35% de tu patrimonio final en 20 años.',
    content: 'El TER (Total Expense Ratio) representa el coste porcentual anual que descuenta la gestora del valor liquidativo del fondo. Mientras los fondos tradicionales de banca comercial cobran entre 1.50% y 2.20% anual más comisiones de custodia, los fondos indexados como Vanguard, Amundi o iShares tienen TERs entre 0.06% y 0.20%. En una inversión a largo plazo, ahorrarte un 1.5% en costes anuales equivale a ganar un 1.5% más de rentabilidad neta segura cada año.',
    keyTakeaway: 'Exige siempre fondos con TER inferior al 0.30% y brokers sin comisiones de custodia.',
    riskNote: 'Menor comisión no garantiza rentabilidad positiva, pero reduce el obstáculo para el inversor.'
  },
  {
    id: 'dca-strategy',
    title: 'DCA (Dollar-Cost Averaging): El Antídoto a la Ansiedad',
    tag: 'Psicología',
    readTime: '3 min de lectura',
    summary: 'Aportaciones periódicas constantes (p. ej. 15€ o 25€ al mes) para eliminar el estrés del "market timing".',
    content: 'Predecir cuándo el mercado está en su punto más bajo es prácticamente imposible, incluso para profesionales. La estrategia de promediado de costes (DCA) consiste en invertir una cantidad fija en intervalos regulares (por ejemplo, cada mes tras recibir la nómina). Cuando el mercado cae, tus euros compran más participaciones a menor precio; cuando sube, compran menos pero tu cartera se revaloriza.',
    keyTakeaway: 'Automatizar aportaciones mensuales neutraliza el pánico y el FOMO (miedo a quedarse fuera).',
    riskNote: 'El DCA suaviza la volatilidad pero no elimina el riesgo general de mercado.'
  }
];
