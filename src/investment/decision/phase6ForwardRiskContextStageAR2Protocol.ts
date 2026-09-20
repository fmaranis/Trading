import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL as V1 } from './phase6ForwardRiskContextStageAProtocol';

export const PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_PROTOCOL = {
  ...V1,
  version: 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_V1',
  status: 'FUTURE_FORWARD_R2_FROZEN_NOT_OPENED',
  frozenOn: '2026-09-20',
  predecessor: {
    version: V1.version,
    disposition: 'CONSUMED_INVALID_FOR_PROMOTION_TECHNICAL_SIGNAL_MATERIALIZATION_FAILURE',
    openedAt: '2026-09-17T16:52:49.017Z',
    observationsPreserved: 20,
    outcomesOpened: false,
    reason: 'V1 collector bounded the signal dataset at informationDate while V5/V7 require one real successor session only to materialize executionDate, causing all collected contexts to be UNAVAILABLE.'
  },
  sample: {
    ...V1.sample,
    rationale: 'R2 is a fresh temporal replication after V1 was consumed by a pre-outcome technical signal-materialization failure. No V1 outcomes were inspected and no predictive threshold, asset or gate was retuned.',
    predictionStartDate: '2026-09-21',
    predictionEndDate: V1.sample.predictionEndDate,
    historicalOrPreFreezeBackfillAllowed: false,
    deterministicPostFreezeCausalCatchUpAllowed: true,
    replacementAfterOpeningAllowed: false
  },
  observationContinuity: {
    ...V1.observationContinuity,
    firstInformationDate: '2026-09-21',
    successorSessionMaterialization: 'REAL_SUCCESSOR_SESSION_MAY_BE_PRESENT_ONLY_TO_MATERIALIZE_EXECUTION_DATE',
    successorSessionMayAffectSignalComponents: false,
    successorSessionMayAffectGate: false,
    successorSessionMayAffectMacroOrOptionsCutoff: false,
    note: 'For R2, one completed real successor anchor session may be present in the signal-engine dataset solely so unchanged V5/V7/V4 implementations can emit the prior informationDate and executionDate. All score components, macro/options inputs and candidate gate remain cut at informationDate.'
  },
  interpretation: {
    ...V1.interpretation,
    predecessorV1CannotPromote: true,
    r2IsFreshForSignalValidationOnly: true
  }
} as const;
