export type ForwardRiskV9State = 'NORMAL' | 'ALERTA' | 'PROTECCION' | 'RECUPERACION';

export interface ForwardRiskV9PolicyFreeze {
  readonly status: 'NOT_FROZEN' | 'FROZEN';
  readonly fingerprint: string | null;
}

/**
 * V9 pre-registration boundary.
 *
 * IMPORTANT: this file intentionally does NOT implement the V9 state machine.
 * The historical blind holdout is sealed before transition rules, durations,
 * action sizes or recovery rules are designed. Those rules may be developed
 * only on the acknowledged development sample and must receive a committed
 * fingerprint here before the blind holdout can be opened.
 */
export const FORWARD_RISK_V9_VALIDATION_PROTOCOL = {
  protocolVersion: 'V9_PREREG_2026_09_07',
  sealedAt: '2026-09-07',
  researchOnly: true,
  productionPromotionAllowed: false,

  objective: 'Convert the frozen V8 predictive evidence into a causal, persistent decision state without retrospective tuning on validation outcomes.',

  frozenSignalInput: {
    architecture: 'V8',
    rule: 'V5_VULNERABILITY_GTE_80_OR_V7_OPTIONS_GTE_80',
    v5ThresholdPct: 80,
    v7ThresholdPct: 80,
    thresholdsRetunableInV9: false,
    outcomeDataAllowedAsStateInput: false
  },

  stateAlphabet: ['NORMAL', 'ALERTA', 'PROTECCION', 'RECUPERACION'] as const satisfies readonly ForwardRiskV9State[],

  developmentSample: {
    endDateInclusive: '2026-09-01',
    status: 'ACKNOWLEDGED_CONTAMINATED_FOR_DESIGN_ONLY',
    allowedPurpose: 'DESIGN_AND_DEBUG_V9_TRANSITIONS_ONLY',
    notes: [
      'V8 EUNL and previously inspected V8 benchmark/economic/fragmentation data may be used for V9 design.',
      'EUR_VALIDATION_HOLDOUT_UNIVERSE is NOT blind for V9: brokerAwareExecutionSweepLive.ts already scans it and ranks losses, drawdowns and volatility.',
      'No result from the development sample may be reported as unbiased V9 out-of-sample evidence.'
    ]
  },

  historicalBlindHoldout: {
    status: 'SEALED',
    selectionBasis: 'STRUCTURAL_ONLY_NO_HISTORICAL_OUTCOME_QUERY_FOR_V9',
    eligibility: [
      'UCITS equity ETF',
      'EUR listing on Deutsche Boerse/Xetra',
      'not present in EUR_ASSET_UNIVERSE',
      'not present in EUR_VALIDATION_HOLDOUT_UNIVERSE',
      'regional/style diversification selected before V9 policy design'
    ],
    assets: [
      { assetId: 'V9_BLIND_SPPW', ticker: 'SPPW.DE', name: 'State Street SPDR MSCI World UCITS ETF (Acc)', exposure: 'GLOBAL_EQUITY' },
      { assetId: 'V9_BLIND_SPY5', ticker: 'SPY5.DE', name: 'State Street SPDR S&P 500 UCITS ETF (Dist)', exposure: 'US_EQUITY' },
      { assetId: 'V9_BLIND_SPYM', ticker: 'SPYM.DE', name: 'State Street SPDR MSCI Emerging Markets UCITS ETF', exposure: 'EMERGING_EQUITY' },
      { assetId: 'V9_BLIND_ZPRS', ticker: 'ZPRS.DE', name: 'State Street SPDR MSCI World Small Cap UCITS ETF (Acc)', exposure: 'GLOBAL_SMALL_CAP' },
      { assetId: 'V9_BLIND_VGEU', ticker: 'VGEU.DE', name: 'Vanguard FTSE Developed Europe UCITS ETF', exposure: 'EUROPE_EQUITY' },
      { assetId: 'V9_BLIND_ZPDJ', ticker: 'ZPDJ.DE', name: 'State Street SPDR MSCI Japan UCITS ETF', exposure: 'JAPAN_EQUITY' }
    ] as const,
    openPolicy: 'ONE_SHOT_AFTER_POLICY_FINGERPRINT_IS_COMMITTED',
    replacementAfterOpeningAllowed: false,
    insufficientDataReplacementAllowed: false
  },

  futureForwardConfirmation: {
    status: 'RESERVED',
    startDateInclusive: '2026-09-08',
    purpose: 'TEMPORALLY_VIRGIN_CONFIRMATION',
    tuningAllowedAfterStart: false,
    note: 'This is the strongest unbiased confirmation because these observations did not exist when the V9 contract was sealed.'
  },

  policyFreeze: {
    status: 'NOT_FROZEN',
    fingerprint: null
  } satisfies ForwardRiskV9PolicyFreeze,

  mandatoryFreezeBeforeOpeningHoldout: [
    'complete causal transition table',
    'entry/exit confirmation and persistence rules',
    'mapping from states to economic actions',
    'NEXT_OPEN execution semantics',
    'fees, cash remuneration and Spanish tax treatment',
    'predictive and economic PASS/FAIL gates',
    'single immutable policy fingerprint committed to main'
  ],

  antiLeakageRules: [
    'Do not fetch or inspect historical price series for V9 blind assets before policyFreeze.status is FROZEN.',
    'Do not select, replace or drop blind assets using returns, drawdowns, volatility, crisis behavior or V9 outcomes.',
    'Do not alter V8 thresholds in V9.',
    'Do not tune V9 after the historical blind holdout is opened.',
    'A failed blind validation retires the frozen V9 contract; a successor requires a newly sealed holdout.',
    'Long validation runs execute locally; never use GitHub Actions.'
  ]
} as const;

export function assertForwardRiskV9HistoricalHoldoutUnlocked(): string {
  const freeze: ForwardRiskV9PolicyFreeze = FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze;
  if (freeze.status !== 'FROZEN' || !freeze.fingerprint) {
    throw new Error('V9_BLIND_HOLDOUT_LOCKED_POLICY_NOT_FROZEN');
  }
  return freeze.fingerprint;
}
