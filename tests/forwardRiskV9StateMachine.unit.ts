import {
  FORWARD_RISK_V9_ECONOMIC_GATE,
  FORWARD_RISK_V9_POLICY,
  FORWARD_RISK_V9_PREDICTIVE_GATE,
  runForwardRiskV9StateMachine,
  type ForwardRiskV9SignalPoint
} from '../src/investment/decision/forwardRiskV9StateMachine';

function points(values: boolean[]): ForwardRiskV9SignalPoint[] {
  return values.map((active, index) => ({
    informationDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
    active
  }));
}
function actions(values: boolean[]) {
  return runForwardRiskV9StateMachine(points(values)).map(point => point.action);
}
function count<T>(values: T[], expected: T): number {
  return values.filter(value => value === expected).length;
}
function requireValue(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FORWARD_RISK_V9_STATE_MACHINE_GUARD_FAIL:${label}`);
}

requireValue(FORWARD_RISK_V9_POLICY.alertOnHitsRequired === 2, 'ALERT_HITS_CHANGED');
requireValue(FORWARD_RISK_V9_POLICY.alertWindowSessions === 3, 'ALERT_WINDOW_CHANGED');
requireValue(FORWARD_RISK_V9_POLICY.recoveryOffSessionsRequired === 5, 'RECOVERY_WINDOW_CHANGED');
requireValue(FORWARD_RISK_V9_POLICY.protectionReductionPct === 25, 'PROTECTION_SIZE_CHANGED');
requireValue(FORWARD_RISK_V9_POLICY.executionMode === 'NEXT_OPEN', 'EXECUTION_MODE_CHANGED');

requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.eventThresholdPct === 5, 'EVENT_THRESHOLD_CHANGED');
requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.prePeakLookbackSessions === 63, 'PRE_PEAK_LOOKBACK_CHANGED');
requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.minimumAnticipationRatePct === 50, 'ANTICIPATION_GATE_CHANGED');
requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.minimumMedianLeadSessionsBeforePeak === 10, 'LEAD_GATE_CHANGED');
requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.maximumFalseProtectedTimePct === 35, 'FALSE_PROTECTION_GATE_CHANGED');
requireValue(FORWARD_RISK_V9_PREDICTIVE_GATE.validBlindAssetsRequired === 6, 'PREDICTIVE_VALID_ASSETS_CHANGED');

requireValue(FORWARD_RISK_V9_ECONOMIC_GATE.initialCapitalEur === 13_000, 'CAPITAL_CHANGED');
requireValue(FORWARD_RISK_V9_ECONOMIC_GATE.protectionReductionPct === 25, 'ECONOMIC_PROTECTION_SIZE_CHANGED');
requireValue(FORWARD_RISK_V9_ECONOMIC_GATE.minimumDrawdownReductionPctPoints === 1, 'DRAWDOWN_GATE_CHANGED');
requireValue(FORWARD_RISK_V9_ECONOMIC_GATE.minimumIndividualPasses === 4, 'INDIVIDUAL_PASS_COUNT_CHANGED');
requireValue(FORWARD_RISK_V9_ECONOMIC_GATE.validBlindAssetsRequired === 6, 'ECONOMIC_VALID_ASSETS_CHANGED');

// One isolated ON observation must create ALERTA only and never trade.
const isolated = runForwardRiskV9StateMachine(points([true, false, false]));
requireValue(isolated[0].state === 'ALERTA', 'FIRST_ON_MUST_ALERT');
requireValue(isolated.at(-1)?.state === 'NORMAL', 'ISOLATED_ALERT_MUST_EXPIRE');
requireValue(count(isolated.map(point => point.action), 'SELL_25_PCT_NEXT_OPEN') === 0, 'ISOLATED_SPIKE_MUST_NOT_SELL');

// Two ON hits inside the three-session alert window must protect once.
const clustered = runForwardRiskV9StateMachine(points([true, false, true]));
requireValue(clustered.at(-1)?.state === 'PROTECCION', 'TWO_OF_THREE_MUST_PROTECT');
requireValue(clustered.at(-1)?.action === 'SELL_25_PCT_NEXT_OPEN', 'PROTECTION_ENTRY_MUST_SELL_ONCE');

// Five consecutive OFF sessions are required to restore after protection.
const fullCycle = actions([true, true, false, false, false, false, false]);
requireValue(count(fullCycle, 'SELL_25_PCT_NEXT_OPEN') === 1, 'FULL_CYCLE_MUST_HAVE_ONE_SELL');
requireValue(count(fullCycle, 'BUY_BACK_NEXT_OPEN') === 1, 'FULL_CYCLE_MUST_HAVE_ONE_BUYBACK');
requireValue(fullCycle[6] === 'BUY_BACK_NEXT_OPEN', 'BUYBACK_MUST_WAIT_FOR_FIFTH_OFF');

// A relapse during recovery returns to PROTECCION but must not stack another sale.
const relapse = runForwardRiskV9StateMachine(points([
  true, true,             // enter protection
  false, false,           // recovery starts but is not complete
  true,                   // relapse: still reduced, no new sell
  false, false, false, false, false // later clean recovery
]));
const relapseActions = relapse.map(point => point.action);
requireValue(count(relapseActions, 'SELL_25_PCT_NEXT_OPEN') === 1, 'RELAPSE_MUST_NOT_STACK_SELLS');
requireValue(relapse[4].state === 'PROTECCION' && relapse[4].action === 'NONE', 'RELAPSE_MUST_REENTER_PROTECTION_WITHOUT_TRADE');
requireValue(count(relapseActions, 'BUY_BACK_NEXT_OPEN') === 1, 'RELAPSE_PATH_MUST_EVENTUALLY_BUY_BACK_ONCE');

// Duplicate information dates are rejected rather than silently changing state twice in one session.
let duplicateRejected = false;
try {
  runForwardRiskV9StateMachine([
    { informationDate: '2026-01-01', active: true },
    { informationDate: '2026-01-01', active: true }
  ]);
} catch (error) {
  duplicateRejected = error instanceof Error && error.message === 'V9_DUPLICATE_INFORMATION_DATE:2026-01-01';
}
requireValue(duplicateRejected, 'DUPLICATE_INFORMATION_DATE_MUST_FAIL');

console.log('forwardRiskV9StateMachine.unit: PASS');
