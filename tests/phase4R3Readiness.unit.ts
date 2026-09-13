import { readFileSync } from 'node:fs';
import { EUR_PORTFOLIO_DISCOVERY_UNIVERSE } from '../src/investment/decision/portfolioDiscoveryUniverse';
import { isStrategicGrowthCoreAssetId, RESEARCH_STRATEGIC_GROWTH_CORE_ASSET_IDS } from '../src/investment/decision/portfolioAssetRole';
import {
  PHASE4_R2_CONSUMED_TICKERS,
  PHASE4_R3_CANDIDATE_POOL,
  PHASE4_R3_COHORT_COUNT,
  PHASE4_R3_CORE,
  PHASE4_R3_DATA_START_DATE,
  PHASE4_R3_END_DATE,
  PHASE4_R3_FRESH_PER_COHORT,
  PHASE4_R3_MINIMUM_BARS,
  PHASE4_R3_REPLAY_START_DATE,
  PHASE4_R3_TARGET_FRESH_ASSETS,
  buildPhase4R3Cohorts,
  selectPhase4R3FreshAssets
} from '../scripts/phase4ReentryCashCustodyV1R3Protocol';

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`PHASE4_R3_READINESS_FAIL:${label}`);
  console.log(`✓ ${label}`);
}

const productTickers = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(row => row.ticker.toUpperCase()));
const productAssetIds = new Set(EUR_PORTFOLIO_DISCOVERY_UNIVERSE.map(row => row.assetId.toUpperCase()));
const poolTickers = PHASE4_R3_CANDIDATE_POOL.map(row => row.ticker.toUpperCase());
const poolIds = PHASE4_R3_CANDIDATE_POOL.map(row => row.assetId);

assert(PHASE4_R3_DATA_START_DATE < PHASE4_R3_REPLAY_START_DATE, 'R3 data begins before replay');
assert(PHASE4_R3_END_DATE < '2004-01-02', 'R3 ends before consumed R2 window');
assert(PHASE4_R3_MINIMUM_BARS === 252, 'R3 preserves 252 causal bar minimum');
assert(PHASE4_R3_COHORT_COUNT === 6 && PHASE4_R3_FRESH_PER_COHORT === 5, 'R3 preserves six disjoint five-asset cohorts');
assert(PHASE4_R3_TARGET_FRESH_ASSETS === 30, 'R3 freezes 30 selected fresh assets');
assert(PHASE4_R3_CANDIDATE_POOL.length > PHASE4_R3_TARGET_FRESH_ASSETS, 'R3 has a frozen coverage pool larger than final sample');
assert(new Set(poolTickers).size === poolTickers.length, 'R3 coverage pool tickers are unique');
assert(new Set(poolIds).size === poolIds.length, 'R3 coverage pool assetIds are unique');
assert(PHASE4_R3_CANDIDATE_POOL.every(row => row.assetId.startsWith('EQ_PH4_R3_')), 'R3 pool uses isolated research identities');
assert(PHASE4_R3_CANDIDATE_POOL.every(row => !productTickers.has(row.ticker.toUpperCase())), 'R3 pool excludes curated production catalogue tickers');
assert(PHASE4_R3_CANDIDATE_POOL.every(row => !PHASE4_R2_CONSUMED_TICKERS.has(row.ticker.toUpperCase())), 'R3 pool excludes consumed R2 tickers');

assert(PHASE4_R3_CORE.assetId === 'CORE_PH4_R3_FIDELITY_WORLD', 'R3 core research identity is frozen');
assert(PHASE4_R3_CORE.isin === 'LU0115769746', 'R3 core ISIN is frozen');
assert(PHASE4_R3_CORE.category === 'GLOBAL_EQUITY', 'R3 core remains broad-global rather than regional');
assert(PHASE4_R3_CORE.instrumentType === 'MUTUAL_FUND', 'R3 core uses explicit mutual-fund data semantics');
assert(isStrategicGrowthCoreAssetId(PHASE4_R3_CORE.assetId), 'R3 core is recognized by the shared strategic-core architecture');
assert(RESEARCH_STRATEGIC_GROWTH_CORE_ASSET_IDS.includes(PHASE4_R3_CORE.assetId as any), 'R3 core is explicitly research-only');
assert(!productAssetIds.has(PHASE4_R3_CORE.assetId.toUpperCase()), 'R3 research core cannot enter production by assetId');
assert(!productTickers.has(PHASE4_R3_CORE.ticker.toUpperCase()), 'R3 research core cannot enter production by ticker/ISIN');

const deterministicFirst = selectPhase4R3FreshAssets(PHASE4_R3_CANDIDATE_POOL.slice(0, 40));
const deterministicSecond = selectPhase4R3FreshAssets([...PHASE4_R3_CANDIDATE_POOL.slice(0, 40)].reverse());
assert(
  deterministicFirst.map(row => row.assetId).join('|') === deterministicSecond.map(row => row.assetId).join('|'),
  'R3 coverage-eligible selection is deterministic and input-order independent'
);
const cohorts = buildPhase4R3Cohorts(deterministicFirst);
assert(cohorts.length === 6 && cohorts.every(rows => rows.length === 5), 'R3 cohort partition is fixed 6x5');
assert(new Set(cohorts.flat().map(row => row.assetId)).size === 30, 'R3 cohorts are disjoint');

const prereg = readFileSync('docs/phase4_reentry_cash_custody_v1_r3_preregistration.md', 'utf8');
assert(prereg.includes('EXIT_PROCEEDS_CUSTODY_V1'), 'R3 prereg preserves frozen custody policy');
assert(prereg.includes('INCONCLUSIVE_INVALID_DATA'), 'R3 prereg fails closed on invalid REAL data');
assert(prereg.includes('frictionIncreaseEur > 0'), 'R3 prereg fixes positive-friction materiality semantics before open');
assert(prereg.includes('current Yahoo discovery: `OFF`'), 'R3 prereg forbids current discovery in historical replay');
assert(prereg.includes('preflight de datos sólo sobre este core'), 'R3 core data preflight is explicitly pre-open');
assert(prereg.includes('La primera consulta de mercado a cualquier asset `EQ_PH4_R3_*` consume la muestra'), 'R3 fresh-sample opening boundary is explicit');

console.log('phase4R3Readiness.unit: PASS');
