import assert from 'node:assert/strict';
import { TIMESFM_PANEL_STICKY_OOS_V1 as P } from '../scripts/timesfmPanelStickyOosV1Protocol.mjs';

assert.equal(P.version,'TIMESFM_PANEL_STICKY_OOS_V1');
assert.equal(P.consumedSampleMayNotValidatePolicy,true);
assert.equal(P.signal.arm,'FULL_PANEL_TARGETS_ONLY');
assert.equal(P.signal.horizonSessions,60);
assert.equal(P.policy.entryRank,1);
assert.equal(P.policy.incumbentRetentionRank,3);
assert.equal(P.policy.relativeReturnFloorPct,0);
assert.equal(P.policy.executionSemantics,'NEXT_OPEN');
assert.equal(P.holdout.firstCalendarMonth,'2025-10');
assert.equal(P.holdout.lastCalendarMonth,'2026-06');
assert.equal(P.holdout.expectedAnchors,9);
assert.equal(P.holdout.minimumUsableAnchors,9);
assert.equal(P.holdout.outcomesThrough,'2026-09-30');
assert.equal(P.holdout.outcomesOpenedBeforeSeal,false);
assert.equal(P.data.sourceType,'REAL');
assert.equal(P.data.syntheticFallback,false);
assert.deepEqual(P.comparators,['LEGACY_APP','EUNL_CORE_DIRECT','PANEL_TOP1_60_NAIVE']);
assert.equal(P.interpretation.minimumScenariosBeatingCore,10);
assert.equal(P.interpretation.minimumScenariosBeatingLegacy,10);
assert.equal(P.interpretation.promotionAuthority,false);
assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);

console.log('timesfmPanelStickyOosV1Protocol.unit: PASS');
