import type { ForwardRiskV9State } from './forwardRiskV9ValidationProtocol';

export type ForwardRiskV9Action = 'NONE' | 'SELL_25_PCT_NEXT_OPEN' | 'BUY_BACK_NEXT_OPEN';

export type ForwardRiskV9SignalPoint = {
  informationDate: string;
  active: boolean;
};

export type ForwardRiskV9StatePoint = ForwardRiskV9SignalPoint & {
  previousState: ForwardRiskV9State;
  state: ForwardRiskV9State;
  action: ForwardRiskV9Action;
  protectedCapital: boolean;
  alertHits: number;
  alertWindowAgeSessions: number;
  recoveryOffStreakSessions: number;
};

/**
 * V9 policy candidate frozen before opening the V9 blind holdout.
 *
 * Design principles:
 * - V8 predictive thresholds stay untouched.
 * - isolated one-session ON spikes do not trade;
 * - clustered warning evidence can protect quickly;
 * - recovery is deliberately slower than entry (hysteresis);
 * - one protection episode creates at most one SELL and one BUY_BACK;
 * - relapses while already reduced never stack another 25% sale.
 */
export const FORWARD_RISK_V9_POLICY = {
  policyVersion: 'V9_POLICY_1',
  v8SignalRule: 'V5_VULNERABILITY_GTE_80_OR_V7_OPTIONS_GTE_80',
  alertOnHitsRequired: 2,
  alertWindowSessions: 3,
  recoveryOffSessionsRequired: 5,
  protectionReductionPct: 25,
  executionMode: 'NEXT_OPEN',
  stateAlphabet: ['NORMAL', 'ALERTA', 'PROTECCION', 'RECUPERACION'] as const,
  economicSemantics: {
    enterProtection: 'SELL_25_PCT_ONCE',
    remainProtected: 'NO_ADDITIONAL_SELLS',
    enterRecovery: 'NO_TRADE_KEEP_25_PCT_REDUCED',
    relapseDuringRecovery: 'RETURN_TO_PROTECCION_NO_ADDITIONAL_SELL',
    completeRecovery: 'BUY_BACK_ONCE'
  }
} as const;

export const FORWARD_RISK_V9_PREDICTIVE_GATE = {
  eventThresholdPct: 5,
  prePeakLookbackSessions: 63,
  minimumAnticipationRatePct: 50,
  minimumMedianLeadSessionsBeforePeak: 10,
  maximumFalseProtectedTimePct: 35,
  validBlindAssetsRequired: 6,
  actionDateForAnticipation: 'PROTECCION_ENTRY_INFORMATION_DATE'
} as const;

/** Reuses the V8 economic gate unchanged so V9 tests temporal policy, not a new economic objective. */
export const FORWARD_RISK_V9_ECONOMIC_GATE = {
  initialCapitalEur: 13_000,
  protectionReductionPct: 25,
  minimumDrawdownReductionPctPoints: 1,
  individualRule: 'finalDeltaEur >= 0 AND drawdownReductionPctPoints >= 1 AND netBreachProtectionEur > 0',
  validBlindAssetsRequired: 6,
  minimumIndividualPasses: 4,
  medianFinalDeltaEurMustBeNonNegative: true,
  minimumMedianDrawdownReductionPctPoints: 1,
  executionMode: 'NEXT_OPEN',
  wholeShares: true,
  broker: 'MYINVESTOR',
  cashMode: 'HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX',
  taxMode: 'EXISTING_SPANISH_MODEL_CONTEXT_UNCONFIRMED'
} as const;

function isProtectedState(state: ForwardRiskV9State): boolean {
  return state === 'PROTECCION' || state === 'RECUPERACION';
}

export function runForwardRiskV9StateMachine(signalPoints: ForwardRiskV9SignalPoint[]): ForwardRiskV9StatePoint[] {
  const sorted = [...signalPoints].sort((a, b) => a.informationDate.localeCompare(b.informationDate));
  const seenDates = new Set<string>();
  let state: ForwardRiskV9State = 'NORMAL';
  let alertHits = 0;
  let alertWindowAgeSessions = 0;
  let recoveryOffStreakSessions = 0;
  const out: ForwardRiskV9StatePoint[] = [];

  for (const point of sorted) {
    if (seenDates.has(point.informationDate)) throw new Error(`V9_DUPLICATE_INFORMATION_DATE:${point.informationDate}`);
    seenDates.add(point.informationDate);

    const previousState = state;
    let action: ForwardRiskV9Action = 'NONE';

    switch (state) {
      case 'NORMAL': {
        alertHits = 0;
        alertWindowAgeSessions = 0;
        recoveryOffStreakSessions = 0;
        if (point.active) {
          state = 'ALERTA';
          alertHits = 1;
          alertWindowAgeSessions = 1;
        }
        break;
      }

      case 'ALERTA': {
        alertWindowAgeSessions += 1;
        if (point.active) alertHits += 1;

        if (alertHits >= FORWARD_RISK_V9_POLICY.alertOnHitsRequired) {
          state = 'PROTECCION';
          action = 'SELL_25_PCT_NEXT_OPEN';
          alertHits = 0;
          alertWindowAgeSessions = 0;
          recoveryOffStreakSessions = 0;
        } else if (alertWindowAgeSessions >= FORWARD_RISK_V9_POLICY.alertWindowSessions) {
          state = 'NORMAL';
          alertHits = 0;
          alertWindowAgeSessions = 0;
        }
        break;
      }

      case 'PROTECCION': {
        alertHits = 0;
        alertWindowAgeSessions = 0;
        if (point.active) {
          recoveryOffStreakSessions = 0;
        } else {
          state = 'RECUPERACION';
          recoveryOffStreakSessions = 1;
        }
        break;
      }

      case 'RECUPERACION': {
        alertHits = 0;
        alertWindowAgeSessions = 0;
        if (point.active) {
          state = 'PROTECCION';
          recoveryOffStreakSessions = 0;
          // Capital is already reduced. A relapse must never stack another sale.
          action = 'NONE';
        } else {
          recoveryOffStreakSessions += 1;
          if (recoveryOffStreakSessions >= FORWARD_RISK_V9_POLICY.recoveryOffSessionsRequired) {
            state = 'NORMAL';
            recoveryOffStreakSessions = 0;
            action = 'BUY_BACK_NEXT_OPEN';
          }
        }
        break;
      }
    }

    out.push({
      ...point,
      previousState,
      state,
      action,
      protectedCapital: isProtectedState(state),
      alertHits,
      alertWindowAgeSessions,
      recoveryOffStreakSessions
    });
  }

  return out;
}
