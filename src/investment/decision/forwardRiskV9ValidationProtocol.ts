export type ForwardRiskV9State = 'NORMAL' | 'ALERTA' | 'PROTECCION' | 'RECUPERACION';

export interface ForwardRiskV9PolicyFreeze {
  readonly status: 'NOT_FROZEN' | 'FROZEN';
  readonly fingerprint: string | null;
}

export interface ForwardRiskV9LocalGateRecord {
  readonly status: 'PENDING' | 'PASS';
}

/**
 * V9 historical record.
 *
 * The policy was frozen and the blind sample was opened exactly once after the
 * local implementation guards passed. The blind result failed the preregistered
 * predictive/economic gates, so V9_POLICY_1 is retired. The six blind assets are
 * permanently contaminated for successor validation and must not be reused.
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
    status: 'OPENED_CONSUMED_FAIL_2026_09_07',
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
    openPolicy: 'ONE_SHOT_AFTER_POLICY_FINGERPRINT_AND_LOCAL_GATES',
    replacementAfterOpeningAllowed: false,
    insufficientDataReplacementAllowed: false
  },

  blindOutcome: {
    status: 'FAIL',
    verdict: 'V9_BLIND_FAIL_RETIRE_V9_POLICY_1',
    openedAndConsumedAt: '2026-09-07',
    predictive: {
      validAssets: 6,
      auditableEpisodes: 56,
      anticipatedEpisodes: 22,
      anticipationRatePct: 39.29,
      medianLeadSessionsBeforePeak: 39,
      falseProtectedTimePct: 26.13
    },
    economic: {
      validAssets: 6,
      individualPasses: 0,
      medianFinalDeltaEurApprox: -6791,
      medianDrawdownReductionPctPointsApprox: 5.96
    },
    dataQualityNote: 'ZPDJ.DE showed a suspicious historical-series discontinuity; this does not rescue V9 because the other five assets also failed the individual economic gate.',
    disposition: 'RETIRED_NO_V9_1_ON_OPENED_HOLDOUT'
  },

  futureForwardConfirmation: {
    status: 'CANCELLED_FOR_RETIRED_POLICY',
    startDateInclusive: '2026-09-08',
    purpose: 'TEMPORALLY_VIRGIN_CONFIRMATION',
    tuningAllowedAfterStart: false,
    note: 'V9_POLICY_1 failed its historical blind gate and is retired; future observations are not used to rescue or retune it.'
  },

  policyFreeze: {
    status: 'FROZEN',
    fingerprint: 'sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0'
  } satisfies ForwardRiskV9PolicyFreeze,

  localImplementationGates: {
    status: 'PASS',
    recordedAt: '2026-09-07',
    evidence: [
      'forwardRiskV9StateMachine.unit: PASS',
      'forwardRiskV9ValidationProtocol.unit: PASS',
      'npm run lint / tsc --noEmit: PASS'
    ],
    required: [
      'npx tsx tests/forwardRiskV9StateMachine.unit.ts',
      'npx tsx tests/forwardRiskV9ValidationProtocol.unit.ts',
      'npm run lint'
    ]
  } satisfies ForwardRiskV9LocalGateRecord & { readonly recordedAt: string; readonly evidence: readonly string[]; readonly required: readonly string[] },

  frozenPolicySummary: {
    policyVersion: 'V9_POLICY_1',
    alertOnHitsRequired: 2,
    alertWindowSessions: 3,
    recoveryOffSessionsRequired: 5,
    protectionReductionPct: 25,
    executionMode: 'NEXT_OPEN',
    predictiveGate: 'anticipation>=50%, medianLead>=10 sessions, falseProtectedTime<=35%, 6 valid blind assets',
    economicGate: 'same V8 gate: individual finalDelta>=0, drawdown reduction>=1pp, netBreachProtection>0; 6 valid, >=4 passes, median finalDelta>=0, median drawdown reduction>=1pp'
  },

  mandatoryFreezeBeforeOpeningHoldout: [
    'complete causal transition table',
    'entry/exit confirmation and persistence rules',
    'mapping from states to economic actions',
    'NEXT_OPEN execution semantics',
    'fees, cash remuneration and Spanish tax treatment',
    'predictive and economic PASS/FAIL gates',
    'single immutable policy fingerprint committed to main',
    'local TypeScript and V9 unit guards recorded PASS'
  ],

  antiLeakageRules: [
    'Do not fetch or inspect historical price series for V9 blind assets before policyFreeze.status is FROZEN and localImplementationGates.status is PASS.',
    'Do not select, replace or drop blind assets using returns, drawdowns, volatility, crisis behavior or V9 outcomes.',
    'Do not alter V8 thresholds in V9.',
    'Do not tune V9 after the historical blind holdout is opened.',
    'A failed blind validation retires the frozen V9 contract; a successor requires a newly sealed holdout.',
    'Long validation runs execute locally; never use GitHub Actions.'
  ]
} as const;

export function assertForwardRiskV9HistoricalHoldoutUnlocked(): string {
  const freeze: ForwardRiskV9PolicyFreeze = FORWARD_RISK_V9_VALIDATION_PROTOCOL.policyFreeze;
  const localGates: ForwardRiskV9LocalGateRecord = FORWARD_RISK_V9_VALIDATION_PROTOCOL.localImplementationGates;
  if (freeze.status !== 'FROZEN' || !freeze.fingerprint) {
    throw new Error('V9_BLIND_HOLDOUT_LOCKED_POLICY_NOT_FROZEN');
  }
  if (localGates.status !== 'PASS') {
    throw new Error('V9_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED');
  }
  return freeze.fingerprint;
}
