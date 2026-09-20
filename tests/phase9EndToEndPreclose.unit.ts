import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`PHASE9_END_TO_END_PRECLOSE_FAIL:${label}`);
}

const state = read('PROJECT_STATE.md');
const routes = read('server/researchValidationRoutes.ts');
const productSurface = read('tests/productSurfaceClosureV1.unit.ts');
const historicalMaster = read('src/investment/decision/historicalInstrumentMaster.ts');
const causalReplay = read('src/investment/decision/causalUniverseBacktestEngine.ts');

assert(state.includes('FASE 1  BASE PRODUCTIVA V1                    DONE'), 'PHASE1_NOT_CLOSED');
assert(state.includes('FASE 2  USUARIOS / SEGURIDAD / AUTONOMÍA      DONE'), 'PHASE2_NOT_CLOSED');
assert(state.includes('FASE 3  PROTOCOLO ECONÓMICO FINAL             DONE / FROZEN'), 'PHASE3_NOT_FROZEN');
assert(state.includes('FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         CLOSED'), 'PHASE4_NOT_CLOSED');
assert(state.includes('FASE 5  PROTECCIÓN DE GRANDES GANADORES       CLOSED'), 'PHASE5_NOT_CLOSED');
assert(state.includes('FASE 6  FORWARD RISK V8 COMO CONTEXTO         V1 CONSUMED TECHNICAL FAIL · R2 OPENED/COLLECTING'), 'PHASE6_STATE_NOT_EXPLICIT');
assert(state.includes('FASE 7  QUALITY FUTURE FORWARD                WAITING/COLLECTING'), 'PHASE7_STATE_NOT_EXPLICIT');
assert(state.includes('FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      STRUCTURAL CLOSED · REAL MASTER POPULATION PENDING'), 'PHASE8_STATE_NOT_EXPLICIT');
assert(state.includes('Allocation/opportunity productivo: `LEGACY`'), 'PRODUCTION_LEGACY_NOT_EXPLICIT');
assert(state.includes('Forward Risk: sin autoridad productiva'), 'FORWARD_RISK_PRODUCT_AUTHORITY_LEAK');
assert(state.includes('current Yahoo discovery no puede usarse retrospectivamente'), 'CURRENT_DISCOVERY_HISTORY_GUARD_MISSING');

assert(routes.includes("id: 'phase6-forward-risk-context-stage-a-r2-readiness'"), 'PHASE6_R2_JOB_MISSING');
assert(routes.includes("id: 'quality-allocation-dynamic-future-forward-v1'"), 'PHASE7_JOB_MISSING');
assert(routes.includes("'phase8-historical-instrument-master-v1'"), 'PHASE8_HISTORY_ENTRY_MISSING');
assert(!routes.includes("id: 'phase8-historical-instrument-master-v1',\n    name: 'Fase 8 · universo histórico PIT · cierre estructural',\n    description:"), 'PHASE8_STILL_ACTIVE_JOB');
assert(routes.includes("id: 'phase9-end-to-end-preclose-v1'"), 'PHASE9_JOB_NOT_WIRED');

assert(productSurface.includes('Portfolio candidate gate: 21/21 invariants passed.') === false, 'PRODUCT_SURFACE_EMBEDS_CANDIDATE_TEST_OUTPUT');
assert(productSurface.includes('backend portfolio alerts cannot create a parallel rotation recommendation'), 'PARALLEL_ALERT_ENGINE_GUARD_MISSING');

assert(historicalMaster.includes("CURRENT_REFERENCE_ONLY"), 'PIT_CURRENT_REFERENCE_CLASS_MISSING');
assert(historicalMaster.includes("COMPLETE_POINT_IN_TIME"), 'PIT_COMPLETE_CLASS_MISSING');
assert(historicalMaster.includes('HISTORICAL_INSTRUMENT_MASTER_CURRENT_REFERENCE_CANNOT_FILTER_HISTORICAL_UNIVERSE'), 'PIT_CURRENT_HISTORY_BLOCK_MISSING');
assert(causalReplay.includes('historicalInstrumentMaster'), 'PIT_MASTER_NOT_IN_CAUSAL_REPLAY');
assert(causalReplay.includes('HISTORICAL_INSTRUMENT_MASTER_COMPLETE_CATALOG_GAP'), 'PIT_COMPLETE_CATALOG_FAIL_CLOSED_MISSING');
assert(causalReplay.includes('HISTORICAL_INSTRUMENT_MASTER_COMPLETE_DATASET_GAP'), 'PIT_COMPLETE_DATASET_FAIL_CLOSED_MISSING');

const remainingExternalTracks = [
  {
    id: 'PHASE6_FORWARD_RISK_R2',
    status: 'OPENED_COLLECTING',
    blockerType: 'PROSPECTIVE_CALENDAR',
    requiresCodeChangeNow: false
  },
  {
    id: 'PHASE7_QUALITY_FUTURE_FORWARD',
    status: 'WAITING_COLLECTING',
    blockerType: 'PROSPECTIVE_CALENDAR',
    requiresCodeChangeNow: false
  },
  {
    id: 'PHASE8_HISTORICAL_PIT_MASTER',
    status: 'STRUCTURAL_CLOSED_DATA_POPULATION_PENDING',
    blockerType: 'EXTERNAL_HISTORICAL_REFERENCE_DATA',
    requiresCodeChangeNow: false
  }
];

console.log('PHASE9_END_TO_END_PRECLOSE_RESULT', JSON.stringify({
  status: 'TECHNICAL_V1_PRECLOSE_PASS',
  productionDefault: 'LEGACY',
  coreArchitecture: 'CORE_ARCHITECTURE_V1',
  parallelProductEnginesAllowed: false,
  longReplayExecuted: false,
  externalApiCalled: false,
  remainingExternalTracks,
  interpretation: 'All immediately testable V1 technical closure surfaces are consolidated here. Remaining items are calendar/data evidence tracks and do not justify repeated code/test churn.'
}));
